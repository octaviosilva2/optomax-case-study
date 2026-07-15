// Route handler que gera o PDF da ficha clínica a partir de um clinical_records.id.
// - Autenticação obrigatória.
// - Validação 3 camadas (auth → profile.org_id → record pertence à org).
// - Renderização server-side com @react-pdf/renderer (runtime Node, não Edge,
//   porque o renderer depende de APIs de Node).
// - ?download=1 → Content-Disposition: attachment; senão inline (preview).
//
// Espelha o padrão de /api/prescricao/[id]/route.tsx, mas:
//   - busca clinical_records (não prescriptions);
//   - renderiza TemplateFichaPDF (só dados clínicos da ficha, sem prescrição);
//   - eventos `clinical_record_pdf_generated` / `_downloaded`.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderToStream } from '@react-pdf/renderer'
import { Readable } from 'node:stream'
import {
  TemplateFichaPDF,
  type DadosPDFFicha,
} from '@/lib/pdf/TemplateFichaPDF'
import { logEventServer } from '@/lib/events'
import { assertActiveOrg } from '@/lib/auth-guards'
import { calcularIdade } from '@/lib/utils/idade'
import type { FichaClinica } from '@/types/clinical'

// O renderer usa APIs de Node (Buffer, fs implícito). Forçamos runtime Node.
export const runtime = 'nodejs'
// Cada PDF é gerado on-demand a partir do estado atual do banco — não cacheia.
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: Promise<{ recordId: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { recordId } = await params
  const supabase = await createClient()

  // ---- Camadas 1-2-3: auth + profile + org ativa ----
  const ctx = await assertActiveOrg(supabase)
  if (!ctx.ok) {
    return new NextResponse(ctx.message, { status: ctx.status })
  }
  const user = { id: ctx.userId }

  // Profile do usuário atual — usado como fallback de profissional (records antigos
  // sem `finalizado_por` preenchido).
  const { data: profileUsuario } = await supabase
    .from('profiles')
    .select('id, org_id, nome_completo, cro_cboo, formacoes, signature_url')
    .eq('id', ctx.userId)
    .single()
  if (!profileUsuario) {
    return new NextResponse('Perfil não encontrado', { status: 403 })
  }

  // ---- Camada 3: record pertence à org do usuário ----
  // JOIN com patients para já trazer dados do paciente.
  // F2-A02: inclui `deleted_at` pra bloquear PDF de paciente soft-deletado
  // (LGPD §12.4 promete que "excluir" não vaza PII nem por canal alternativo).
  const { data: recordRow, error: errRec } = await supabase
    .from('clinical_records')
    .select(
      `
      id, org_id, patient_id, appointment_id, modelo, clinical_data, status, finalizado_em, finalizado_por, created_at,
      patients:patient_id ( id, nome, cpf, data_nascimento, deleted_at ),
      appointments:appointment_id ( data_hora, duracao, titulo )
    `,
    )
    .eq('id', recordId)
    .eq('org_id', profileUsuario.org_id)
    .single()

  if (errRec || !recordRow) {
    console.error('[ficha GET] falha ao buscar record', {
      recordId,
      orgIdDoProfile: profileUsuario.org_id,
      errCode: errRec?.code,
      errMessage: errRec?.message,
      rowRetornou: !!recordRow,
    })
    return new NextResponse('Ficha não encontrada', { status: 404 })
  }

  // Supabase tipa relação 1:1 ora como objeto, ora como array — normaliza.
  const pacienteRaw = Array.isArray(recordRow.patients)
    ? recordRow.patients[0]
    : recordRow.patients
  if (!pacienteRaw) {
    return new NextResponse('Dados da ficha inconsistentes', { status: 500 })
  }

  // F2-A02: bloqueio LGPD §12.4 — paciente soft-deleted não pode ter PDF gerado.
  // 410 Gone é mais semântico que 404 ("recurso existia mas foi removido").
  if (pacienteRaw.deleted_at !== null) {
    return new NextResponse('Recurso indisponível', { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = pacienteRaw as any

  // Dados do agendamento (bloco "Atendimento" do modelo resumido). Relação 1:1
  // pode vir como objeto ou array; record sem appointment_id → null (walk-in).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appointmentRaw: any = Array.isArray((recordRow as any).appointments)
    ? (recordRow as any).appointments[0]
    : (recordRow as any).appointments
  const atendimento = appointmentRaw
    ? {
        data_hora: appointmentRaw.data_hora ?? null,
        duracao: appointmentRaw.duracao ?? null,
        titulo: appointmentRaw.titulo ?? null,
      }
    : null

  // ---- Organização (query não-bloqueante) ----
  const { data: organizacaoRow, error: errOrg } = await supabase
    .from('organizations')
    .select('id, nome_clinica, endereco, telefone')
    .eq('id', recordRow.org_id)
    .single()

  if (errOrg) {
    console.warn('[ficha GET] falha ao buscar organização (não-fatal):', {
      orgId: recordRow.org_id,
      errCode: errOrg.code,
      errMessage: errOrg.message,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizacao: any = organizacaoRow ?? {
    id: recordRow.org_id,
    nome_clinica: 'Clínica',
    endereco: null,
    telefone: null,
  }

  // ---- Profissional responsável ----
  // Mesma lógica do endpoint de prescrição:
  //   1. finalizado_por — autor legal, imutável após finalização.
  //   2. usuário atual — fallback para records antigos sem finalizado_por.
  let profissional = {
    nome_completo: profileUsuario.nome_completo,
    cro_cboo: profileUsuario.cro_cboo,
    formacoes: profileUsuario.formacoes,
    signature_url: profileUsuario.signature_url as string | null,
  }

  if (recordRow.finalizado_por && recordRow.finalizado_por !== user.id) {
    const { data: profileFinalizador } = await supabase
      .from('profiles')
      .select('nome_completo, cro_cboo, formacoes, signature_url, org_id')
      .eq('id', recordRow.finalizado_por)
      .single()
    // Defesa cross-tenant: profile precisa ser da mesma org.
    if (profileFinalizador && profileFinalizador.org_id === profileUsuario.org_id) {
      profissional = {
        nome_completo: profileFinalizador.nome_completo,
        cro_cboo: profileFinalizador.cro_cboo,
        formacoes: profileFinalizador.formacoes,
        signature_url: profileFinalizador.signature_url as string | null,
      }
    }
  }

  // ---- Assinatura digital → data URL base64 (embutida no PDF) ----
  // Usa admin client porque o bucket "signatures" tem RLS restrita ao dono:
  // se o PDF está sendo gerado por outro usuário da mesma org (ex: secretária
  // exportando ficha do optometrista), o cliente normal não consegue ler.
  // Falhas aqui são não-fatais — o PDF cai no fallback (linha vazia + nome).
  let signatureDataUrl: string | null = null
  if (profissional.signature_url) {
    try {
      const admin = createAdminClient()
      const { data: blob, error: dlErr } = await admin.storage
        .from('signatures')
        .download(profissional.signature_url)
      if (dlErr) {
        console.warn('[ficha PDF] falha ao baixar assinatura:', dlErr.message)
      } else if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer())
        signatureDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.warn('[ficha PDF] erro ao processar assinatura (não-fatal):', e)
    }
  }

  // ---- Idade do paciente ----
  // calcularIdade lida com Date inválido retornando NaN — convertemos em null
  // para o template renderizar "—" no lugar.
  let idade: number | null = null
  if (paciente.data_nascimento) {
    const i = calcularIdade(paciente.data_nascimento)
    idade = Number.isFinite(i) ? i : null
  }

  // ---- Modelo da ficha + JSONB ----
  const fichaJson = (recordRow.clinical_data ?? {}) as FichaClinica
  const modelo: 'resumido' | 'completo' =
    recordRow.modelo === 'completo' ? 'completo' : 'resumido'

  // Data do atendimento: prefere finalizado_em; fallback created_at.
  const dataAtendimento = recordRow.finalizado_em ?? recordRow.created_at ?? null

  const dados: DadosPDFFicha = {
    organizacao: {
      nome_clinica: organizacao.nome_clinica ?? 'Clínica',
      endereco: organizacao.endereco ?? null,
      telefone: organizacao.telefone ?? null,
    },
    paciente: {
      nome: paciente.nome,
      cpf: paciente.cpf ?? null,
      data_nascimento: paciente.data_nascimento ?? null,
      idade,
    },
    profissional: {
      nome_completo: profissional.nome_completo,
      cro_cboo: profissional.cro_cboo,
      formacoes: profissional.formacoes,
      signature_data_url: signatureDataUrl,
    },
    ficha: fichaJson,
    modelo,
    dataAtendimento,
    geradoEm: new Date().toISOString(),
    atendimento,
  }

  // ---- Renderização do PDF (streaming) ----
  let webStream: ReadableStream
  try {
    const nodeStream = (await renderToStream(<TemplateFichaPDF dados={dados} />)) as unknown as Readable
    webStream = Readable.toWeb(nodeStream) as ReadableStream
  } catch (e) {
    console.error('[ficha PDF] erro ao renderizar:', e)
    return new NextResponse('Falha ao gerar PDF', { status: 500 })
  }

  // ---- Resposta ----
  const url = new URL(req.url)
  const isDownload = url.searchParams.get('download') === '1'

  // Eventos: pdf gerado sempre; download adicional se for ?download=1.
  await logEventServer(supabase, {
    userId: user.id,
    orgId: profileUsuario.org_id,
    eventName: 'clinical_record_pdf_generated',
    payload: { record_id: recordRow.id },
  })
  if (isDownload) {
    await logEventServer(supabase, {
      userId: user.id,
      orgId: profileUsuario.org_id,
      eventName: 'clinical_record_pdf_downloaded',
      payload: { record_id: recordRow.id },
    })
  }

  // Nome do arquivo amigável e seguro: remove caracteres não-ASCII problemáticos.
  // Range ̀-ͯ cobre os "combining diacritical marks" produzidos por NFD.
  const slugPaciente = (paciente.nome as string)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
  const dataArq = dataAtendimento
    ? new Date(dataAtendimento).toISOString().slice(0, 10)
    : 'ficha'
  const filename = `ficha-${slugPaciente || 'paciente'}-${dataArq}.pdf`

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  })

  return new NextResponse(webStream, { status: 200, headers })
}
