import Link from 'next/link'
import { FileText, ShieldCheck, AlertCircle } from 'lucide-react'
import { requireSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TERMS_VERSION, TERMS_PUBLISHED_AT } from '@/lib/legal/version'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata = {
  title: 'Histórico de aceites | OptoMax',
}

// Formata uma data ISO para o padrão brasileiro (DD/MM/AAAA HH:MM).
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HistoricoAceitesPage() {
  const { profile } = await requireSession()
  const supabase = await createClient()

  // Busca os campos de aceite da org do usuário atual.
  // RLS garante isolamento por org_id.
  const { data: org } = await supabase
    .from('organizations')
    .select('accepted_terms_at, accepted_terms_ip, accepted_terms_version')
    .eq('id', profile.org_id)
    .single()

  const temAceiteRegistrado = !!org?.accepted_terms_at

  return (
    <div className="space-y-6">
      {/* Header canonico (DESIGN.md secao 4) */}
      <PageHeader
        breadcrumb={[
          { label: 'Configuracoes', href: '/configuracoes' },
          { label: 'Historico de aceites' },
        ]}
        title="Historico de aceites"
        subtitle="Registro de quando voce aceitou os Termos de Uso e a Politica de Privacidade."
      />

      {/* Card principal: dados do aceite atual */}
      <div className="rounded-2xl bg-card border border-border shadow-sm">
        <div className="px-5 h-12 flex items-center border-b border-border">
          <span className="text-[14px] font-medium inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Aceite vigente
          </span>
        </div>
        <div className="p-5">
          {temAceiteRegistrado ? (
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Data e hora</dt>
                <dd className="text-[14px] text-foreground mt-1 tabular-nums font-mono">{formatDateTime(org!.accepted_terms_at!)}</dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Versão dos documentos</dt>
                <dd className="text-[14px] text-foreground mt-1">{org?.accepted_terms_version ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-wide text-muted-foreground font-medium">Endereço IP</dt>
                <dd className="text-[14px] text-foreground mt-1 font-mono">{org?.accepted_terms_ip ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning-bg p-4 text-[13px] text-status-warning dark:border-status-warning/30 dark:bg-status-warning-bg dark:text-status-warning">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Cadastro anterior à versão {TERMS_VERSION} dos Termos.</p>
                <p className="mt-1">
                  Sua conta foi criada antes do registro eletrônico de aceite ter sido implementado.
                  A versão vigente atualmente é{' '}
                  <strong>{TERMS_VERSION}</strong>, publicada em {TERMS_PUBLISHED_AT}.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Links para os documentos atuais */}
      <div className="rounded-2xl bg-card border border-border shadow-sm">
        <div className="px-5 h-12 flex items-center border-b border-border">
          <span className="text-[14px] font-medium inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documentos vigentes
          </span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Versão {TERMS_VERSION} — publicada em {TERMS_PUBLISHED_AT}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/termos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] text-primary underline hover:no-underline"
            >
              <FileText className="h-4 w-4" />
              Termos de Uso
            </Link>
            <Link
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[13px] text-primary underline hover:no-underline"
            >
              <ShieldCheck className="h-4 w-4" />
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
