/**
 * Pagina de demo dos componentes V2 da identidade editorial.
 * Rota: /components-demo
 * Uso: validacao visual em dev antes de implementar em paginas reais.
 *
 * NAO e rota autenticada — acesso direto em dev.
 */

import { Wordmark } from '@/components/brand/Wordmark'
import { EditorialDivider } from '@/components/ui/EditorialDivider'
import { SectionHeader } from '@/components/layout/SectionHeader'
import { PageHeader } from '@/components/layout/PageHeader'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { Button } from '@/components/ui/button'

export default function ComponentsDemoPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Titulo da pagina de demo */}
        <div className="text-center space-y-2">
          <h1 className="text-page-hero">
            Componentes V2 — Identidade Editorial
          </h1>
          <p className="text-meta">
            Demo para validacao visual. Fase 6 do plano de implementacao.
          </p>
        </div>

        <EditorialDivider />

        {/* ====== WORDMARK ====== */}
        <SectionHeader
          number="01"
          title="Wordmark"
          subtitle="Logo textual canonico com ponto dourado"
        />

        <div className="flex flex-wrap items-baseline gap-8 p-6 bg-card rounded-lg border">
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground font-mono">sm</span>
            <Wordmark size="sm" />
          </div>
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground font-mono">md</span>
            <Wordmark size="md" />
          </div>
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground font-mono">lg</span>
            <Wordmark size="lg" />
          </div>
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground font-mono">display</span>
            <Wordmark size="display" />
          </div>
        </div>

        <EditorialDivider />

        {/* ====== PAGE HEADER ====== */}
        <SectionHeader
          number="02"
          title="PageHeader"
          subtitle="Cabecalho padrao de pagina com breadcrumb e acoes"
        />

        <div className="p-6 bg-card rounded-lg border space-y-8">
          {/* Exemplo 1: Padrao */}
          <div className="border-b pb-6">
            <span className="block text-xs text-muted-foreground font-mono mb-4">
              Padrao (listagem)
            </span>
            <PageHeader
              breadcrumb={[
                { label: 'Dashboard', href: '/' },
                { label: 'Pacientes', href: '/pacientes' },
                { label: 'Lista' },
              ]}
              title="Pacientes"
              subtitle="Gerencie o cadastro de pacientes da clinica"
              actions={
                <>
                  <Button variant="outline" size="sm">Exportar</Button>
                  <Button size="sm">Novo Paciente</Button>
                </>
              }
            />
          </div>

          {/* Exemplo 2: Hero */}
          <div>
            <span className="block text-xs text-muted-foreground font-mono mb-4">
              Hero (dashboard)
            </span>
            <PageHeader
              title="Bom dia, Dr. Caio"
              subtitle="Voce tem 8 atendimentos agendados para hoje"
              hero
              actions={<Button>Iniciar Atendimento</Button>}
            />
          </div>
        </div>

        <EditorialDivider />

        {/* ====== SECTION HEADER ====== */}
        <SectionHeader
          number="03"
          title="SectionHeader"
          subtitle="Divisao de secoes em paginas longas"
        />

        <div className="p-6 bg-card rounded-lg border space-y-6">
          <SectionHeader
            number="01"
            title="Dados Pessoais"
            subtitle="Nome, CPF, data de nascimento e contato"
          />
          <SectionHeader
            number="02"
            title="Historico Clinico"
          />
          <SectionHeader
            number="03"
            title="Prescricoes Anteriores"
            subtitle="Ultimas 5 prescricoes do paciente"
          />
        </div>

        <EditorialDivider />

        {/* ====== KPI CARD ====== */}
        <SectionHeader
          number="04"
          title="KpiCard"
          subtitle="Cards de metricas em 2 variantes: editorial e denso"
        />

        <div className="space-y-6">
          {/* Editorial */}
          <div>
            <span className="block text-xs text-muted-foreground font-mono mb-4">
              Variante: editorial (default)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="ATENDIDOS HOJE"
                value={12}
                delta={{ direction: 'up', text: '+3 vs ontem' }}
              />
              <KpiCard
                label="AGENDADOS"
                value={8}
                meta="— proximas 2 horas"
              />
              <KpiCard
                label="FALTARAM"
                value={2}
                delta={{ direction: 'down', text: '-1 vs semana' }}
              />
              <KpiCard
                label="RECEITA DO DIA"
                value="R$ 2.840"
                delta={{ direction: 'up', text: '+18% vs media' }}
              />
            </div>
          </div>

          {/* Denso */}
          <div>
            <span className="block text-xs text-muted-foreground font-mono mb-4">
              Variante: dense (grid com muitos KPIs)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <KpiCard label="TOTAL MES" value="187" variant="dense" />
              <KpiCard label="CONVERSAO" value="73%" variant="dense" />
              <KpiCard label="TICKET MEDIO" value="R$ 412" variant="dense" />
              <KpiCard label="NPS" value="9.2" variant="dense" />
              <KpiCard
                label="CANCELADOS"
                value="14"
                variant="dense"
                delta={{ direction: 'down', text: '-2' }}
              />
              <KpiCard
                label="RETORNOS"
                value="23"
                variant="dense"
                delta={{ direction: 'up', text: '+5' }}
              />
            </div>
          </div>
        </div>

        <EditorialDivider />

        {/* ====== EDITORIAL DIVIDER ====== */}
        <SectionHeader
          number="05"
          title="EditorialDivider"
          subtitle="Separador visual com 3 losangos dourados"
        />

        <div className="p-6 bg-card rounded-lg border text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Primeira secao de conteudo aqui...
          </p>
          <EditorialDivider />
          <p className="text-sm text-muted-foreground mt-4">
            Segunda secao de conteudo aqui...
          </p>
        </div>

        <EditorialDivider />

        {/* ====== TOP BAR (nota) ====== */}
        <SectionHeader
          number="06"
          title="TopBar"
          subtitle="Componente client-side — ver no app real ou em /components-demo com mock"
        />

        <div className="p-6 bg-card rounded-lg border">
          <p className="text-sm text-muted-foreground">
            TopBar e um componente client-side que requer contexto de autenticacao.
            Para visualizar, acesse o app autenticado quando for substituido na Fase 7.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Arquivo: <code className="font-mono">src/components/layout/TopBar.tsx</code>
          </p>
        </div>

        {/* Rodape */}
        <div className="text-center pt-8 border-t">
          <p className="text-xs text-muted-foreground">
            Fase 6 — Componentes compostos V2 criados. Aguardando validacao visual.
          </p>
        </div>
      </div>
    </div>
  )
}
