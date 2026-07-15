'use client'

/**
 * PainelVazio — empty state para primeiro login (org sem pacientes/atendimentos).
 *
 * Substitui o dashboard padrão quando a clínica ainda não tem dados.
 * Exibe onboarding guiado com checklist de 3 passos + card de configuração.
 *
 * Plano Dashboard V2 — Fase A (empty state)
 */

import Link from 'next/link'
import {
  CheckCircle2,
  Circle,
  UserPlus,
  CalendarPlus,
  FileText,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** Nome do usuário para saudação */
  primeiroNome: string
  /** Passos já completados (derivados dos dados) */
  passos: {
    temPaciente: boolean
    temAgendamento: boolean
    temReceita: boolean
  }
  /** Configuração do perfil */
  config: {
    /** Perfil onboarded (nome, CRO, etc) */
    onboarded: boolean
    /** Assinatura cadastrada */
    temAssinatura: boolean
  }
}

/**
 * Renderiza o painel de onboarding para orgs vazias.
 */
export function PainelVazio({ primeiroNome, passos, config }: Props) {
  // Conta quantas configurações estão completas (0-2)
  const configCompletas = [config.onboarded, config.temAssinatura].filter(Boolean).length
  const totalConfig = 2

  // Determina próximo passo do checklist
  const proximoPasso = !passos.temPaciente
    ? 'paciente'
    : !passos.temAgendamento
      ? 'agendamento'
      : !passos.temReceita
        ? 'receita'
        : null

  return (
    <div className="space-y-8">
      {/* ── Hero de boas-vindas ──────────────────────────────────────── */}
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-page-hero">
          Bem-vindo, {primeiroNome}!
        </h1>
        <p className="text-meta mt-2 max-w-md mx-auto">
          Vamos configurar sua clínica em poucos passos. Siga o checklist abaixo para começar a atender.
        </p>
      </div>

      {/* ── Checklist de 3 passos ────────────────────────────────────── */}
      <section className="rounded-2xl bg-card border border-border shadow-sm p-6 max-w-xl mx-auto">
        <h2 className="text-section-title font-semibold mb-4">
          Primeiros passos
        </h2>
        <ol className="space-y-3">
          <PassoChecklist
            numero={1}
            titulo="Cadastrar seu primeiro paciente"
            descricao="Crie a ficha de um paciente para começar"
            concluido={passos.temPaciente}
            href="/pacientes?novo=1"
            ativo={proximoPasso === 'paciente'}
            icone={UserPlus}
          />
          <PassoChecklist
            numero={2}
            titulo="Marcar um atendimento"
            descricao="Agende ou faça um encaixe rápido"
            concluido={passos.temAgendamento}
            href="/agenda?novo=1"
            ativo={proximoPasso === 'agendamento'}
            icone={CalendarPlus}
          />
          <PassoChecklist
            numero={3}
            titulo="Gerar uma receita"
            descricao="Crie sua primeira prescrição"
            concluido={passos.temReceita}
            href="/receitas?nova=1"
            ativo={proximoPasso === 'receita'}
            icone={FileText}
          />
        </ol>
      </section>

      {/* ── Card de configuração ─────────────────────────────────────── */}
      <section className="rounded-2xl bg-card border border-border shadow-sm p-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-section-title font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Configuração
          </h2>
          <span className="text-meta-xs text-muted-foreground">
            {configCompletas}/{totalConfig} completo
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(configCompletas / totalConfig) * 100}%` }}
          />
        </div>

        <ul className="space-y-2.5">
          <ItemConfig
            label="Dados profissionais"
            descricao="Nome, CRO/CBOO, formações"
            concluido={config.onboarded}
            href="/configuracoes"
          />
          <ItemConfig
            label="Assinatura digital"
            descricao="Imagem para receitas em PDF"
            concluido={config.temAssinatura}
            href="/configuracoes"
          />
        </ul>
      </section>
    </div>
  )
}

/* ── Componentes internos ──────────────────────────────────────────────── */

type PassoChecklistProps = {
  numero: number
  titulo: string
  descricao: string
  concluido: boolean
  href: string
  ativo: boolean
  icone: React.ElementType
}

function PassoChecklist({
  numero,
  titulo,
  descricao,
  concluido,
  href,
  ativo,
  icone: Icone,
}: PassoChecklistProps) {
  const content = (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-colors',
        concluido && 'bg-status-ok-bg border-status-ok/20',
        ativo && !concluido && 'bg-primary-subtle border-primary/20 hover:bg-primary-subtle/80',
        !concluido && !ativo && 'bg-muted/50 border-border opacity-60',
      )}
    >
      {/* Indicador de status */}
      <div className="shrink-0 mt-0.5">
        {concluido ? (
          <CheckCircle2 className="w-5 h-5 text-status-ok" />
        ) : (
          <div className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold',
            ativo ? 'border-primary text-primary' : 'border-muted-foreground/40 text-muted-foreground/40',
          )}>
            {numero}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-[14px] font-medium',
          concluido && 'text-status-ok line-through',
          ativo && !concluido && 'text-foreground',
          !concluido && !ativo && 'text-muted-foreground',
        )}>
          {titulo}
        </div>
        <div className="text-meta-xs mt-0.5">
          {descricao}
        </div>
      </div>

      {/* Ícone da ação */}
      {ativo && !concluido && (
        <div className="shrink-0 w-9 h-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Icone className="w-4 h-4" />
        </div>
      )}
    </div>
  )

  // Se ativo e não concluído, é um link
  if (ativo && !concluido) {
    return <li><Link href={href}>{content}</Link></li>
  }

  return <li>{content}</li>
}

type ItemConfigProps = {
  label: string
  descricao: string
  concluido: boolean
  href: string
}

function ItemConfig({ label, descricao, concluido, href }: ItemConfigProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
      >
        {concluido ? (
          <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-[13px] font-medium',
            concluido ? 'text-muted-foreground' : 'text-foreground',
          )}>
            {label}
          </div>
          <div className="text-meta-xs">{descricao}</div>
        </div>
      </Link>
    </li>
  )
}
