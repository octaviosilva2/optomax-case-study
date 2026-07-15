// Endpoint PÚBLICO para download do PDF da ficha clínica via token HMAC.
// SEM autenticação de usuário: o token assinado É a credencial.
//
// Fluxo:
//   1. Server action `gerarLinkPublicoFicha` (autenticada) emite o token
//      após validar acesso da org logada → token vai para o WhatsApp do paciente.
//   2. Paciente abre o link → este endpoint valida HMAC + expiração + tipo.
//   3. Service role bypassa RLS porque não há sessão; a credencial é o token.
//
// Comparado ao /api/ficha/[recordId]:
//   - Sem assertActiveOrg / sem checagem cross-tenant via profile (não há usuário).
//   - Service role client (bypassa RLS).
//   - Content-Disposition: `inline` por padrão (mostra o PDF na aba/viewer),
//     `attachment` quando `?download=1` — espelha o endpoint privado e atende
//     a UX da página pública /f/[token] (botão Visualizar vs Baixar).
//     Etapa 13 (13/05/2026): mudou de `attachment` fixo → condicional.
//   - Defesa de tipo: verificarTokenFicha rejeita tokens emitidos para prescrição.

import { NextRequest, NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { Readable } from 'node:stream'
import {
  TemplateFichaPDF,
  type DadosPDFFicha,
} from '@/lib/pdf/TemplateFichaPDF'
import { verificarTokenFicha } from '@/lib/auth/hmac-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcularIdade } from '@/lib/utils/idade'
import type { FichaClinica } from '@/types/clinical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  // `?download=1` força attachment; sem o parâmetro, abre inline no viewer.
  const forcarDownload = req.nextUrl.searchParams.get('download') === '1'

  // 1) Valida token HMAC (assinatura + expiração + tipo === 'ficha')
  const verif = await verificarTokenFicha(token)
  if (!verif.ok) {
    return new NextResponse(verif.error, { status: 403 })
  }

  // 2) Busca record via service role (bypassa RLS — token é a credencial)
  // F2-A05: inclui `patients.deleted_at` pra bloqueio LGPD §12.4.
  const supabase = createAdminClient()
  const { data: recordRow, error: errRec } = await supabase
    .from('clinical_records')
    .select(
      `
      id, org_id, patient_id, appointment_id, modelo, clinical_data, status, finalizado_em, finalizado_por, created_at,
      patients:patient_id ( id, nome, cpf, data_nascimento, deleted_at ),
      appointments:appointment_id ( data_hora, duracao, titulo )
    `,
    )
    .eq('id', verif.recordId)
    .single()

  if (errRec || !recordRow) {
    console.error('[ficha publico] não encontrou', {
      recordId: verif.recordId,
      errCode: errRec?.code,
      errMessage: errRec?.message,
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

  // F2-A05: bloqueio LGPD §12.4 — paciente soft-deleted não gera PDF público.
  if (pacienteRaw.deleted_at !== null) {
    return new NextResponse('Recurso indisponível', { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = pacienteRaw as any

  // Dados do agendamento (bloco "Atendimento" do modelo resumido).
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

  // 3) Busca organização (não-bloqueante: usa fallback se falhar)
  const { data: organizacaoRow } = await supabase
    .from('organizations')
    .select('id, nome_clinica, endereco, telefone')
    .eq('id', recordRow.org_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizacao: any = organizacaoRow ?? {
    nome_clinica: 'Clínica',
    endereco: null,
    telefone: null,
  }

  // 4) Profissional responsável: SEMPRE finalizado_por (autoria legal).
  // Não há usuário logado, então não há fallback — se finalizado_por for null
  // (ficha legada/pré-PR2), usa placeholder genérico.
  let profissional: {
    nome_completo: string | null
    cro_cboo: string | null
    formacoes: string[] | null
    signature_url: string | null
  } = {
    nome_completo: 'Profissional',
    cro_cboo: null,
    formacoes: null,
    signature_url: null,
  }
  if (recordRow.finalizado_por) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('nome_completo, cro_cboo, formacoes, signature_url')
      .eq('id', recordRow.finalizado_por)
      // Defesa em profundidade: o profile precisa ser da mesma org do record.
      // Endpoint público usa admin client (sem RLS), então o filtro é explícito.
      .eq('org_id', recordRow.org_id)
      .single()
    if (prof) {
      profissional = {
        nome_completo: prof.nome_completo,
        cro_cboo: prof.cro_cboo,
        formacoes: prof.formacoes,
        signature_url: prof.signature_url as string | null,
      }
    }
  }

  // 4.1) Assinatura → data URL base64 (admin client já é o cliente atual).
  // Falhas são não-fatais: PDF cai no fallback (linha vazia + nome).
  let signatureDataUrl: string | null = null
  if (profissional.signature_url) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('signatures')
        .download(profissional.signature_url)
      if (dlErr) {
        console.warn('[ficha publico] falha ao baixar assinatura:', dlErr.message)
      } else if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer())
        signatureDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.warn('[ficha publico] erro ao processar assinatura (não-fatal):', e)
    }
  }

  // 5) Idade do paciente (mesma lógica do endpoint privado)
  let idade: number | null = null
  if (paciente.data_nascimento) {
    const i = calcularIdade(paciente.data_nascimento)
    idade = Number.isFinite(i) ? i : null
  }

  // 6) Monta payload do template
  const fichaJson = (recordRow.clinical_data ?? {}) as FichaClinica
  const modelo: 'resumido' | 'completo' =
    recordRow.modelo === 'completo' ? 'completo' : 'resumido'
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

  // 7) Renderiza PDF (streaming — não bloqueia o event loop)
  let webStream: ReadableStream
  try {
    const nodeStream = (await renderToStream(<TemplateFichaPDF dados={dados} />)) as unknown as Readable
    webStream = Readable.toWeb(nodeStream) as ReadableStream
  } catch (e) {
    console.error('[ficha publico] erro ao renderizar:', e)
    return new NextResponse('Falha ao gerar PDF', { status: 500 })
  }

  // 8) Filename amigável (mesmo padrão do endpoint privado)
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

  // 9) Loga evento (não-bloqueante).
  // Não há user_id de sessão; usa finalizado_por como ator. Se for null,
  // pula o log (events.user_id agora aceita NULL — F6-A07 / Fase 11.2 —,
  // mas sem ator o evento perde valor analítico no painel /admin).
  if (recordRow.finalizado_por) {
    void supabase
      .from('events')
      .insert({
        org_id: recordRow.org_id,
        user_id: recordRow.finalizado_por,
        event_name: 'clinical_record_pdf_public_downloaded',
        payload: { record_id: recordRow.id },
      })
      .then(({ error }) => {
        if (error) console.warn('[ficha publico] log evento falhou:', error.message)
      })
  }

  // Disposition condicional: inline (default) mostra na aba; attachment baixa.
  const disposition = forcarDownload
    ? `attachment; filename="${filename}"`
    : `inline; filename="${filename}"`

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
