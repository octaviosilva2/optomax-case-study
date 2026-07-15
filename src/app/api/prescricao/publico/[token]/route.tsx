// Endpoint PÚBLICO para download do PDF da prescrição via token HMAC.
// SEM autenticação de usuário: o token assinado É a credencial.
//
// Fluxo:
//   1. Server action `gerarLinkPublicoPrescricao` (autenticada) emite o token
//      após validar acesso da org logada → token vai para o WhatsApp do paciente.
//   2. Paciente abre o link → este endpoint valida HMAC + expiração.
//   3. Service role bypassa RLS porque não há sessão; a credencial é o token.
//
// Comparado ao /api/prescricao/[id]:
//   - Sem assertActiveOrg / sem checagem cross-tenant via profile (não há usuário).
//   - Service role client (bypassa RLS).
//   - Content-Disposition: `inline` por padrão (mostra o PDF na aba/viewer),
//     `attachment` quando `?download=1` — espelha o endpoint privado e atende
//     a UX da página pública /p/[token] (botão Visualizar vs Baixar).
//     Etapa 13 (13/05/2026): mudou de `attachment` fixo → condicional.

import { NextRequest, NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { Readable } from 'node:stream'
import {
  TemplatePDF,
  type DadosPDFPrescricao,
} from '@/lib/pdf/TemplatePDF'
import { verificarTokenPrescricao } from '@/lib/auth/hmac-token'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NovaPrescricao } from '@/types/clinical'
import type { Json } from '@/types/database'

// O renderer usa APIs de Node — runtime Edge não funciona.
export const runtime = 'nodejs'
// PDF gerado on-demand a partir do estado atual do banco.
export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { token } = await params
  // `?download=1` força attachment; sem o parâmetro, abre inline no viewer.
  const forcarDownload = req.nextUrl.searchParams.get('download') === '1'

  // 1) Valida token HMAC (assinatura + expiração)
  const verif = await verificarTokenPrescricao(token)
  if (!verif.ok) {
    return new NextResponse(verif.error, { status: 403 })
  }

  // 2) Busca prescription via service role (bypassa RLS — token é a credencial)
  // F2-A04: inclui `patients.deleted_at` pra bloqueio LGPD §12.4.
  const supabase = createAdminClient()
  const { data: prescricaoRow, error: errPresc } = await supabase
    .from('prescriptions')
    .select(
      `
      id, org_id, patient_id, clinical_record_id, prescription_type, dados_prescricao, created_at,
      patients:patient_id ( id, nome, cpf, data_nascimento, deleted_at ),
      clinical_records:clinical_record_id ( id, finalizado_em, finalizado_por )
    `,
    )
    .eq('id', verif.prescricaoId)
    .is('deleted_at', null)
    .single()

  if (errPresc || !prescricaoRow) {
    console.error('[prescricao publico] não encontrou', {
      prescricaoId: verif.prescricaoId,
      errCode: errPresc?.code,
      errMessage: errPresc?.message,
    })
    return new NextResponse('Prescrição não encontrada', { status: 404 })
  }

  // Supabase tipa relação 1:1 ora como objeto, ora como array — normaliza.
  const pacienteRaw = Array.isArray(prescricaoRow.patients)
    ? prescricaoRow.patients[0]
    : prescricaoRow.patients
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = prescricaoRow.clinical_records as any

  if (!pacienteRaw) {
    return new NextResponse('Dados da prescrição inconsistentes', { status: 500 })
  }

  // F2-A04: bloqueio LGPD §12.4 — paciente soft-deleted não gera PDF nem
  // por canal público (link via WhatsApp). 410 Gone é mais semântico que 404.
  if (pacienteRaw.deleted_at !== null) {
    return new NextResponse('Recurso indisponível', { status: 410 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = pacienteRaw as any

  // 3) Busca organização (não-bloqueante: usa fallback se falhar)
  const { data: organizacaoRow } = await supabase
    .from('organizations')
    .select('id, nome_clinica, endereco, telefone')
    .eq('id', prescricaoRow.org_id)
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
  if (record?.finalizado_por) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('nome_completo, cro_cboo, formacoes, signature_url')
      .eq('id', record.finalizado_por)
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
  // Falhas não-fatais: PDF cai no fallback (linha vazia + nome).
  let signatureDataUrl: string | null = null
  if (profissional.signature_url) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('signatures')
        .download(profissional.signature_url)
      if (dlErr) {
        console.warn('[prescricao publico] falha ao baixar assinatura:', dlErr.message)
      } else if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer())
        signatureDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      console.warn('[prescricao publico] erro ao processar assinatura (não-fatal):', e)
    }
  }

  // 5) Monta payload do template (idêntico ao endpoint privado)
  const dadosPrescricao = (prescricaoRow.dados_prescricao ?? {}) as Partial<NovaPrescricao> & {
    [k: string]: Json | undefined
  }
  const dataAtendimento =
    record?.finalizado_em ?? prescricaoRow.created_at ?? null

  const dados: DadosPDFPrescricao = {
    organizacao: {
      // nome_clinica é NOT NULL no template — fallback se DB devolveu null
      nome_clinica: organizacao.nome_clinica ?? 'Clínica',
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

  // 6) Renderiza PDF (streaming — não bloqueia o event loop)
  let webStream: ReadableStream
  try {
    const nodeStream = (await renderToStream(<TemplatePDF dados={dados} />)) as unknown as Readable
    webStream = Readable.toWeb(nodeStream) as ReadableStream
  } catch (e) {
    console.error('[prescricao publico] erro ao renderizar:', e)
    return new NextResponse('Falha ao gerar PDF', { status: 500 })
  }

  // 7) Filename amigável (mesmo padrão do endpoint privado)
  const slugPaciente = (paciente.nome as string)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
  const dataArq = dataAtendimento
    ? new Date(dataAtendimento).toISOString().slice(0, 10)
    : 'prescricao'
  const filename = `prescricao-${slugPaciente || 'paciente'}-${dataArq}.pdf`

  // 8) Loga evento (não-bloqueante).
  // Não há user_id de sessão; usa finalizado_por como ator. Se for null,
  // pula o log (events.user_id agora aceita NULL — F6-A07 / Fase 11.2 —,
  // mas sem ator o evento perde valor analítico no painel /admin).
  if (record?.finalizado_por) {
    void supabase
      .from('events')
      .insert({
        org_id: prescricaoRow.org_id,
        user_id: record.finalizado_por,
        event_name: 'prescription_pdf_public_downloaded',
        payload: { prescription_id: prescricaoRow.id },
      })
      .then(({ error }) => {
        if (error) console.warn('[prescricao publico] log evento falhou:', error.message)
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
