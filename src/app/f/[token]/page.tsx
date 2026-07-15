// Página pública intermediária para a ficha clínica (PDF).
// Etapa 13 #37 (13/05/2026): paciente recebe `/f/[token]` no WhatsApp e
// escolhe entre visualizar ou baixar — mesma UX da `/p/[token]`.
//
// Sem header/sidebar do app: este arquivo fica em `app/f/[token]/page.tsx`,
// herdando apenas o `app/layout.tsx` raiz (fontes + metadata).
//
// Sem autenticação de usuário: o token HMAC é a credencial. Service role
// (`createAdminClient`) bypassa RLS para buscar dados mínimos. O endpoint do
// PDF (`/api/ficha/publico/[token]`) revalida o mesmo token na hora do download.
//
// LGPD/Privacidade: a página NÃO expõe CPF, data de nascimento, dados
// clínicos nem prescrição. Apenas: nome da clínica, nome do paciente, data
// do atendimento e data de expiração do link.

import { Eye, Download, Clock, AlertCircle } from 'lucide-react'
import { verificarTokenFicha, decodificarExpiracao } from '@/lib/auth/hmac-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatarDataExtensa } from '@/lib/utils/data'
import { Wordmark } from '@/components/brand/Wordmark'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ token: string }> }

// UI de erro idêntica em estrutura à página de prescrição — mantém a
// experiência consistente quando o paciente abre um link inválido,
// independente de ser ficha ou prescrição. Identidade editorial: H1 em serifa, Wordmark no rodapé.
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

export default async function FichaPublicaPage({ params }: PageProps) {
  const { token } = await params

  // 1) Valida HMAC + expiração + tipo === 'ficha'.
  // Token de prescrição não passa aqui (defesa cross-tipo do hmac-token.ts).
  const verif = await verificarTokenFicha(token)
  if (!verif.ok) {
    return (
      <TelaErro
        titulo="Link expirado ou inválido"
        descricao="Este link só é válido por 7 dias a partir do envio. Se expirou ou foi adulterado, não conseguimos exibir a ficha."
      />
    )
  }

  // 2) Busca metadados mínimos do clinical_record (service role — sem sessão).
  // Não puxamos `clinical_data` aqui: a página não exibe nenhum dado clínico.
  // F2-A07: inclui `patients.deleted_at` pra bloqueio LGPD §12.4.
  const supabase = createAdminClient()
  const { data: record } = await supabase
    .from('clinical_records')
    .select(
      `
      id, org_id, patient_id, finalizado_em, created_at,
      patients:patient_id ( nome, deleted_at ),
      organizations:org_id ( nome_clinica )
    `,
    )
    .eq('id', verif.recordId)
    .maybeSingle()

  if (!record) {
    return (
      <TelaErro
        titulo="Ficha não encontrada"
        descricao="Não localizamos esta ficha clínica. Pode ter sido removida pelo profissional."
      />
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paciente = record.patients as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizacao = record.organizations as any

  // F2-A07: bloqueio LGPD §12.4 — paciente soft-deleted não aparece em landing
  // pública. Reaproveita TelaErro pra esconder até o nome da clínica.
  if (!paciente || paciente.deleted_at !== null) {
    return (
      <TelaErro
        titulo="Recurso indisponível"
        descricao="Esta ficha não está mais disponível para acesso público."
      />
    )
  }

  const nomeClinica = organizacao?.nome_clinica ?? 'Clínica'
  const nomePaciente = paciente?.nome ?? 'paciente'

  // Data do atendimento: prioriza `finalizado_em`; se não houver (ficha
  // criada e link gerado antes de finalizar — caso raro), usa `created_at`.
  const dataAtendimentoIso = record.finalizado_em ?? record.created_at
  const dataAtendimentoTxt = formatarDataExtensa(dataAtendimentoIso)

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
          <h1 className="text-page-title">Ficha clínica</h1>
        </header>

        {/* Bloco de identificação do destinatário e data do atendimento */}
        <div className="space-y-1 text-center">
          <p className="text-meta">
            Para: <strong className="text-foreground">{nomePaciente}</strong>
          </p>
          <p className="text-meta">
            Atendimento de <span className="tabular-nums">{dataAtendimentoTxt}</span>
          </p>
        </div>

        {/* Botões de ação — grid mantém 2 colunas inclusive em mobile */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`/api/ficha/publico/${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <Eye className="h-4 w-4" />
            Visualizar PDF
          </a>
          <a
            href={`/api/ficha/publico/${token}?download=1`}
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
