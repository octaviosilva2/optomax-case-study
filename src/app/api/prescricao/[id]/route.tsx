// Route handler que gera o PDF da prescrição a partir de uma prescription.id.
// - Autenticação obrigatória.
// - Validação 3 camadas (auth → profile.org_id → prescription pertence à org).
// - Renderização server-side com @react-pdf/renderer (runtime Node, não Edge,
//   porque o renderer depende de APIs de Node).
// - ?download=1 → Content-Disposition: attachment; senão inline (preview).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToStream } from '@react-pdf/renderer'
import { Readable } from 'node:stream'
import {
  TemplatePDF,
  type DadosPDFPrescricao,
} from '@/lib/pdf/TemplatePDF'
import { logEventServer } from '@/lib/events'
import { assertActiveOrg } from '@/lib/auth-guards'
import type { NovaPrescricao } from '@/types/clinical'
import type { Json } from '@/types/database'

// O renderer usa APIs de Node (Buffer, fs implícito). Forçamos runtime Node.
export const runtime = 'nodejs'
// Cada PDF é gerado on-demand a partir do estado atual do banco — não cacheia.
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()

  // ---- Camadas 1-2-3: auth + profile + org ativa ----
  // Bloqueia geração de PDF se a organização foi desativada via /admin.
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) {
    return new NextResponse(ctx.message, { status: ctx.status })
  }
  const user = { id: ctx.userId }

  // Profile com dados visuais do PDF (nome, CRO, formações, assinatura)
  const { data: profileUsuario } = await supabase
    .from('profiles')
    .select('id, org_id, nome_completo, cro_cboo, formacoes, signature_url')
    .eq('id', ctx.userId)
    .single()
  if (!profileUsuario) {
    return new NextResponse('Perfil não encontrado', { status: 403 })
  }

  // ---- Camada 3: prescription pertence à org do usuário ----
  // JOIN apenas com patients e clinical_records — organizations é buscada
  // separadamente para não bloquear o PDF se houver erro de RLS/schema lá.
  // F2-A03: inclui `patients.deleted_at` pra bloqueio LGPD §12.4.
  const { data: prescricaoRow, error: errPresc } = await supabase
    .from('prescriptions')
    .select(
      `
      id, org_id, patient_id, clinical_record_id, prescription_type, status, dados_prescricao, created_at, updated_at,
      patients:patient_id ( id, nome, cpf, data_nascimento, deleted_at ),
      clinical_records:clinical_record_id ( id, finalizado_em, status, finalizado_por, last_edited_by )
    `,
    )
    .eq('id', id)
    .eq('org_id', profileUsuario.org_id)
    .is('deleted_at', null)
    .single()

  if (errPresc || !prescricaoRow) {
    // Log estruturado para diagnóstico — revela se é falha de RLS (PGRST116),
    // permissão negada (42501), org_id nulo ou mismatch, etc.
    console.error('[prescricao GET] falha ao buscar prescrição', {
      id,
      orgIdDoProfile: profileUsuario.org_id,
      errCode: errPresc?.code,
      errMessage: errPresc?.message,
      errDetails: errPresc?.details,
      rowRetornou: !!prescricaoRow,
    })
    return new NextResponse('Prescrição não encontrada', { status: 404 })
  }

  // B3 (edge case 4/8): rascunho de receita avulsa NÃO tem PDF — a receita só
  // expõe documento após finalizada. Trata como "não encontrada" (404, mesmo
  // formato acima) para não vazar existência de rascunho por URL direta.
  if (prescricaoRow.status === 'rascunho') {
    return new NextResponse('Prescrição não encontrada', { status: 404 })
  }

  // Supabase tipa relações 1:1 ora como array, ora como objeto — normaliza.
  const pacienteRaw = Array.isArray(prescricaoRow.patients)
    ? prescricaoRow.patients[0]
    : prescricaoRow.patients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = prescricaoRow.clinical_records as any

  if (!pacienteRaw) {
    return new NextResponse('Dados da prescrição inconsistentes', { status: 500 })
  }

  // F2-A03: bloqueio LGPD §12.4 — paciente soft-deleted não gera PDF.
  if (pacienteRaw.deleted_at !== null) {
    return new NextResponse('Recurso indisponível', { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = pacienteRaw as any

  // ---- Organização (query não-bloqueante) ----
  // Buscada separadamente para que falha de RLS ou schema em organizations
  // não derrube a geração do PDF. Se não achar, gera o PDF com fallback.
  const { data: organizacaoRow, error: errOrg } = await supabase
    .from('organizations')
    .select('id, nome_clinica, endereco, telefone')
    .eq('id', prescricaoRow.org_id)
    .single()

  if (errOrg) {
    console.warn('[prescricao GET] falha ao buscar organização (não-fatal):', {
      orgId: prescricaoRow.org_id,
      errCode: errOrg.code,
      errMessage: errOrg.message,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizacao: any = organizacaoRow ?? {
    id: prescricaoRow.org_id,
    nome_clinica: 'Clínica',
    endereco: null,
    telefone: null,
  }

  // ---- Profissional responsável ----
  // Ordem de preferência:
  //   1. finalizado_por — quem finalizou o atendimento; é o autor legal da
  //      prescrição. IMUTÁVEL após finalização (assistente reabrir não troca).
  //   2. usuário atual gerando o PDF — fallback para records antigos sem
  //      finalizado_por preenchido (pré-PR2).
  //
  // Não usamos mais last_edited_by aqui: ele muda quando qualquer pessoa
  // edita pós-finalização, o que adulteraria a autoria do documento.
  let profissional = {
    nome_completo: profileUsuario.nome_completo,
    cro_cboo: profileUsuario.cro_cboo,
    formacoes: profileUsuario.formacoes,
    signature_url: profileUsuario.signature_url as string | null,
  }

  if (record?.finalizado_por && record.finalizado_por !== user.id) {
    const { data: profileFinalizador } = await supabase
      .from('profiles')
      .select('nome_completo, cro_cboo, formacoes, signature_url, org_id')
      .eq('id', record.finalizado_por)
      .single()
    // Defesa cross-tenant: profile precisa ser da mesma org. Mesmo que o
    // finalizado_por nunca mude, paranoia extra contra dados malformados.
    if (profileFinalizador && profileFinalizador.org_id === profileUsuario.org_id) {
      profissional = {
        nome_completo: profileFinalizador.nome_completo,
        cro_cboo: profileFinalizador.cro_cboo,
        formacoes: profileFinalizador.formacoes,
        signature_url: profileFinalizador.signature_url as string | null,
      }
    }
  }

  // ---- Assinatura digital → data URL base64 ----
  // Admin client porque o bucket "signatures" tem RLS restrita ao dono.
  // Falhas não-fatais: PDF cai no fallback (linha vazia + nome).
  let signatureDataUrl: string | null = null
  if (profissional.signature_url) {
    try {
      const admin = createAdminClient()
      const { data: blob, error: dlErr } = await admin.storage
        .from('signatures')
        .download(profissional.signature_url)
      if (dlErr) {
        console.warn('[prescricao PDF] falha ao baixar assinatura:', dlErr.message)
      } else if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer())
        signatureDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.warn('[prescricao PDF] erro ao processar assinatura (não-fatal):', e)
    }
  }

  // ---- Monta payload do template ----
  const dadosPrescricao = (prescricaoRow.dados_prescricao ?? {}) as Partial<NovaPrescricao> & {
    [k: string]: Json | undefined
  }

  // Data do atendimento: prefere finalizado_em (mais semanticamente correto);
  // fallback para created_at da prescription.
  const dataAtendimento =
    record?.finalizado_em ?? prescricaoRow.created_at ?? null

  const dados: DadosPDFPrescricao = {
    organizacao: {
      nome_clinica: organizacao.nome_clinica,
      endereco: organizacao.endereco ?? null,
      telefone: organizacao.telefone ?? null,
    },
    paciente: {
      nome: paciente.nome,
      cpf: paciente.cpf ?? null,
      data_nascimento: paciente.data_nascimento ?? null,
    },
    profissional: {
      nome_completo: profissional.nome_completo,
      cro_cboo: profissional.cro_cboo,
      formacoes: profissional.formacoes,
      signature_data_url: signatureDataUrl,
    },
    prescricao: dadosPrescricao,
    dataAtendimento,
    geradoEm: new Date().toISOString(),
  }

  // ---- Renderização do PDF (streaming) ----
  // renderToStream evita bloquear o event loop do Node: o Node consegue servir
  // outras requisições enquanto o PDF é gerado. Em SLC 1.0 (10 testers) o ganho
  // já é perceptível em concorrência; em escala maior, mover para fila/edge.
  let webStream: ReadableStream
  try {
    const nodeStream = (await renderToStream(<TemplatePDF dados={dados} />)) as unknown as Readable
    webStream = Readable.toWeb(nodeStream) as ReadableStream
  } catch (e) {
    console.error('[prescricao PDF] erro ao renderizar:', e)
    return new NextResponse('Falha ao gerar PDF', { status: 500 })
  }

  // ---- Resposta ----
  const url = new URL(req.url)
  const isDownload = url.searchParams.get('download') === '1'

  // Eventos: pdf gerado sempre; download adicional se for ?download=1.
  // Não-bloqueante — usado pelo painel /admin para acompanhar entrega de valor.
  await logEventServer(supabase, {
    userId: user.id,
    orgId: profileUsuario.org_id,
    eventName: 'prescription_pdf_generated',
    payload: { prescription_id: prescricaoRow.id },
  })

  // Dashboard V2 FASE F: marca timestamp da primeira geração do PDF.
  // Usado pelo dashboard para identificar "receitas sem PDF" (pendências).
  // Atualiza apenas se pdf_gerado_em ainda é null (primeira vez).
  // Não-bloqueante — falha não impede entrega do PDF.
  const adminClient = createAdminClient()
  await adminClient
    .from('prescriptions')
    .update({ pdf_gerado_em: new Date().toISOString() })
    .eq('id', prescricaoRow.id)
    .is('pdf_gerado_em', null)
  if (isDownload) {
    await logEventServer(supabase, {
      userId: user.id,
      orgId: profileUsuario.org_id,
      eventName: 'prescription_pdf_downloaded',
      payload: { prescription_id: prescricaoRow.id },
    })
  }

  // Nome do arquivo amigável e seguro: remove caracteres não-ASCII problemáticos.
  // Range ̀-ͯ cobre os "combining diacritical marks" produzidos por NFD —
  // escape explícito (não depender de bytes invisíveis no source file).
  const slugPaciente = (paciente.nome as string)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
  const dataArq = dataAtendimento
    ? new Date(dataAtendimento).toISOString().slice(0, 10)
    : 'prescricao'
  const filename = `prescricao-${slugPaciente || 'paciente'}-${dataArq}.pdf`

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
    // Sem cache — sempre regenera com o estado atual.
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  })

  // Streaming: o NextResponse encaminha o web stream para o cliente conforme
  // o PDF é gerado, sem precisar buferizar tudo em memória.
  return new NextResponse(webStream, { status: 200, headers })
}
