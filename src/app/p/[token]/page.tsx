// Página pública intermediária para a prescrição (PDF).
// Etapa 13 #36 (13/05/2026): paciente recebe `/p/[token]` no WhatsApp ao
// invés do download direto do PDF — assim o link fica visualmente mais
// curto e a tela oferece dois CTAs claros (Visualizar / Baixar).
//
// Sem header/sidebar do app: este arquivo fica em `app/p/[token]/page.tsx`,
// herdando apenas o `app/layout.tsx` raiz (fontes + metadata).
//
// Sem autenticação de usuário: o token HMAC é a credencial. Service role
// (`createAdminClient`) bypassa RLS para buscar dados mínimos (paciente +
// clínica). Endpoint do PDF (`/api/prescricao/publico/[token]`) revalida o
// mesmo token na hora do download.
//
// LGPD/Privacidade: a página NÃO expõe CPF, data de nascimento, anamnese,
// diagnóstico nem a prescrição em texto. Apenas: nome da clínica, nome do
// paciente, data de emissão e data de expiração do link.

import { Eye, Download, Clock, AlertCircle } from 'lucide-react'
import { verificarTokenPrescricao, decodificarExpiracao } from '@/lib/auth/hmac-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatarDataExtensa } from '@/lib/utils/data'
import { Wordmark } from '@/components/brand/Wordmark'

// Token novo (gerado pela action) tem validade 7 dias. Página é puramente
// dinâmica — não há nada para cachear, e o token é único por requisição.
export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ token: string }> }

// UI dedicada de erro — mesma estrutura que a tela principal, só muda o
// conteúdo. Mantém a marca da clínica omitida (não sabemos qual é em caso
// de token totalmente inválido). Identidade editorial: H1 em serifa, Wordmark no rodapé.
function TelaErro({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          {/* H1 em serifa (identidade editorial) */}
          <h1 className="text-page-title">{titulo}</h1>
          <p className="text-meta leading-relaxed">
            {descricao}
          </p>
        </div>
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-meta-xs">
            Peça um link novo ao seu optometrista.
          </p>
          {/* Assinatura da marca */}
          <Wordmark size="sm" className="text-muted-foreground/60" />
        </div>
      </section>
    </main>
  )
}

export default async function PrescricaoPublicaPage({ params }: PageProps) {
  const { token } = await params

  // 1) Valida HMAC + expiração + tipo === 'prescricao'.
  const verif = await verificarTokenPrescricao(token)
  if (!verif.ok) {
    return (
      <TelaErro
        titulo="Link expirado ou inválido"
        descricao="Este link só é válido por 7 dias a partir do envio. Se expirou ou foi adulterado, não conseguimos exibir a prescrição."
      />
    )
  }

  // 2) Busca metadados mínimos da prescrição (service role — sem sessão).
  // Não puxamos `dados_prescricao` aqui: a página não exibe valores clínicos.
  // F2-A06: inclui `patients.deleted_at` pra bloqueio LGPD §12.4.
  const supabase = createAdminClient()
  const { data: prescricao } = await supabase
    .from('prescriptions')
    .select(
      `
      id, org_id, patient_id, clinical_record_id, created_at,
      patients:patient_id ( nome, deleted_at ),
      organizations:org_id ( nome_clinica ),
      clinical_records:clinical_record_id ( finalizado_em )
    `,
    )
    .eq('id', verif.prescricaoId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!prescricao) {
    return (
      <TelaErro
        titulo="Prescrição não encontrada"
        descricao="Não localizamos esta prescrição. Pode ter sido removida pelo profissional."
      />
    )
  }

  // Supabase tipa relações 1:1 como objeto único em `.maybeSingle()` — extrai
  // com cast (mesmo padrão dos endpoints de PDF).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = prescricao.patients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizacao = prescricao.organizations as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const record = prescricao.clinical_records as any

  // F2-A06: bloqueio LGPD §12.4 — se o paciente foi soft-deleted, não exibe
  // nome nem dados da prescrição. Reaproveita a TelaErro pra não vazar PII
  // (nem nome da clínica) em landing pública.
  if (!paciente || paciente.deleted_at !== null) {
    return (
      <TelaErro
        titulo="Recurso indisponível"
        descricao="Esta prescrição não está mais disponível para acesso público."
      />
    )
  }

  // Nome da clínica em fallback: caso a row tenha sido removida (raro), não
  // queremos quebrar a página.
  const nomeClinica = organizacao?.nome_clinica ?? 'Clínica'
  const nomePaciente = paciente?.nome ?? 'paciente'

  // Data de emissão: prioriza `finalizado_em` do clinical_record; se não houver
  // (prescrição rápida sem ficha), usa `created_at` da própria prescrição.
  const dataEmissaoIso = record?.finalizado_em ?? prescricao.created_at
  const dataEmissaoTxt = formatarDataExtensa(dataEmissaoIso)

  // Data de expiração: lida do próprio token (já validado acima).
  // Fallback defensivo se decodificarExpiracao retornar null por algum motivo.
  const expiraEm = decodificarExpiracao(token)
  const dataExpTxt = expiraEm ? formatarDataExtensa(expiraEm) : '—'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        {/* Cabeçalho editorial: eyebrow da clínica + H1 em serifa */}
        <header className="space-y-2 text-center">
          <p className="text-eyebrow tracking-widest">
            {nomeClinica}
          </p>
          <h1 className="text-page-title">Prescrição</h1>
        </header>

        {/* Bloco de identificação do destinatário e data de emissão */}
        <div className="space-y-1 text-center">
          <p className="text-meta">
            Para: <strong className="text-foreground">{nomePaciente}</strong>
          </p>
          <p className="text-meta">
            Emitida em <span className="tabular-nums">{dataEmissaoTxt}</span>
          </p>
        </div>

        {/* Botões de ação — grid mantém 2 colunas inclusive em mobile.
            target="_blank" no "Visualizar" deixa SO/browser decidir entre
            inline e abrir no app de PDF. O "Baixar" não usa target para que
            o Content-Disposition: attachment funcione na própria aba. */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`/api/prescricao/publico/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <Eye className="h-4 w-4" />
            Visualizar PDF
          </a>
          <a
            href={`/api/prescricao/publico/${token}?download=1`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </a>
        </div>

        {/* Rodapé editorial: expiração + assinatura da marca */}
        <footer className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-meta-xs">
              Este link expira em <span className="tabular-nums">{dataExpTxt}</span>
            </p>
          </div>
          {/* Assinatura da marca */}
          <div className="flex justify-center">
            <Wordmark size="sm" className="text-muted-foreground/60" />
          </div>
        </footer>
      </section>
    </main>
  )
}
