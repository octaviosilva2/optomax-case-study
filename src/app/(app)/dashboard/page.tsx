import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Clock,
} from 'lucide-react'
import { AgendaHoje } from './AgendaHoje'
import NovoAtendimentoMenu from '@/components/atendimento/NovoAtendimentoMenu'
import { PainelVazio } from './PainelVazio'
import { BannerOnboarding } from './BannerOnboarding'
import { ModalCompletarPerfil } from './ModalCompletarPerfil'
import { ModalDadosEssenciais } from './ModalDadosEssenciais'
import { HeroPainel, type ProximoPaciente } from './HeroPainel'
import {
  ColunaLateral,
  type Pendencia,
} from './ColunaLateral'
import {
  inicioDoDiaBR,
  fimDoDiaBR,
  formatarDiaSemanaBR,
  formatarDataExtensa,
} from '@/lib/utils/data'
import { montarResumoClinicio } from '@/lib/utils/resumo-clinico'

/**
 * Dashboard V2 — "Cockpit" do optometrista.
 *
 * Plano implementado:
 * - FASE A: PainelVazio para primeiro login (org sem dados)
 * - FASE C: Faixa de resumo, herói adaptativo, atalhos reduzidos
 * - FASE D: HeroPainel com próximo paciente + resumo clínico
 * - FASE E: ColunaLateral com confirmações, retornos, pendências
 */
export default async function DashboardPage() {
  const { profile, org } = await requireSession()
  const supabase = await createClient()
  const orgId = profile.org_id

  // Modais de pós-cadastro (substituíram o wizard /onboarding). Mostra UM por vez:
  //  1. Essenciais (obrigatório) — só para contas antigas sem nome OU telefone.
  //     Quem se cadastra agora informa ambos na criação da conta.
  //  2. Perfil clínico (opcional) — quando os essenciais já existem e o perfil
  //     ainda não foi resolvido (onboarded=false). Abre suave ~10s depois.
  // "Minha Clínica" é o default do trigger de signup → tratamos como vazio para
  // o input nascer em branco.
  const faltaEssenciais = !profile.nome_completo || !org?.telefone
  const modalPerfil = faltaEssenciais ? (
    <ModalDadosEssenciais
      nomeInicial={profile.nome_completo ?? ''}
      telefoneInicial={org?.telefone ?? ''}
    />
  ) : !profile.onboarded ? (
    <ModalCompletarPerfil
      nomeClinicaInicial={
        org?.nome_clinica && org.nome_clinica !== 'Minha Clínica' ? org.nome_clinica : ''
      }
      croInicial={profile.cro_cboo ?? ''}
      formacoesIniciais={profile.formacoes ?? []}
    />
  ) : null

  // ── Contagens para detectar empty state (FASE A) ─────────────────────────────
  const [{ count: countPacientes }, { count: countAgendamentos }, { count: countReceitas }] =
    await Promise.all([
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
      supabase
        .from('prescriptions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .is('deleted_at', null),
    ])

  const temPaciente = (countPacientes ?? 0) > 0
  const temAgendamento = (countAgendamentos ?? 0) > 0
  const temReceita = (countReceitas ?? 0) > 0
  const orgVazia = !temPaciente && !temAgendamento
  // Progresso do onboarding — o banner-guia some sozinho ao atingir 3/3.
  const passosCompletos = [temPaciente, temAgendamento, temReceita].filter(Boolean).length

  // ── Se org vazia → exibe painel de onboarding (FASE A) ────────────────────────
  if (orgVazia) {
    const primeiroNome = profile.nome_completo?.split(' ')[0] ?? 'Bem-vindo'
    return (
      <>
        <PainelVazio
          primeiroNome={primeiroNome}
          passos={{
            temPaciente,
            temAgendamento,
            temReceita,
          }}
          config={{
            onboarded: profile.onboarded ?? false,
            temAssinatura: !!profile.signature_url,
          }}
        />
        {modalPerfil}
      </>
    )
  }

  // ── Janela de hoje em horário de Brasília ─────────────────────────────────────
  const hoje = new Date()
  const inicioDia = inicioDoDiaBR(hoje)
  const fimDia = fimDoDiaBR(hoje)

  // ── Dados do dia (FASE C) ─────────────────────────────────────────────────────
  const { data: agendamentosHoje } = await supabase
    .from('appointments')
    .select('id, patient_id, data_hora, status, patients ( nome, whatsapp )')
    .eq('org_id', orgId)
    .gte('data_hora', inicioDia.toISOString())
    .lte('data_hora', fimDia.toISOString())
    .order('data_hora', { ascending: true })
    .limit(100)

  // Receitas avulsas de encaixe (sem agendamento e sem ficha vinculada — ver
  // ModalEncaixeRapido destino="receita") não têm appointment_id, então nunca
  // aparecem em `agendamentosHoje`. Sem essa contagem à parte, um atendimento
  // de encaixe em modo receita nunca contabilizava no "Progresso do dia".
  // Referência de data: `finalizada_em` quando existe (fluxo rascunho→finalizar,
  // que pode atravessar dias), com fallback pra `created_at` na receita atômica
  // do encaixe (via /api/prescriptions/quick, que nunca preenche finalizada_em).
  // Cada chamada abre um query builder novo — reaproveitar a mesma instância
  // entre duas queries acumularia os filtros de uma na outra (mutação in-place).
  function baseReceitasAvulsas() {
    return supabase
      .from('prescriptions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .is('clinical_record_id', null)
      .is('appointment_id', null)
      .eq('status', 'finalizada')
  }

  const [{ count: countComFinalizadaEm }, { count: countSemFinalizadaEm }] = await Promise.all([
    baseReceitasAvulsas()
      .gte('finalizada_em', inicioDia.toISOString())
      .lte('finalizada_em', fimDia.toISOString()),
    baseReceitasAvulsas()
      .is('finalizada_em', null)
      .gte('created_at', inicioDia.toISOString())
      .lte('created_at', fimDia.toISOString()),
  ])

  const agora = new Date()
  const atendidosAgendados = agendamentosHoje?.filter((a) => a.status === 'concluido').length ?? 0
  // Cancelados e faltas saem da conta: são status terminais que nunca viram "concluido".
  const atendiveisAgendados =
    agendamentosHoje?.filter((a) => a.status !== 'cancelado' && a.status !== 'faltou').length ?? 0
  const receitasAvulsasHoje = (countComFinalizadaEm ?? 0) + (countSemFinalizadaEm ?? 0)
  // Encaixe em modo receita é atômico (cria e finaliza na mesma ação) — sempre
  // soma igual em concluídos e atendíveis.
  const atendidosHoje = atendidosAgendados + receitasAvulsasHoje
  const totalAtendiveis = atendiveisAgendados + receitasAvulsasHoje
  const progressoDia =
    totalAtendiveis > 0 ? Math.round((atendidosHoje / totalAtendiveis) * 100) : 0

  // Próximo horário (status agendado ou confirmado, data_hora >= agora)
  const proximoAgendamento = agendamentosHoje?.find(
    (a) =>
      new Date(a.data_hora) >= agora &&
      (a.status === 'agendado' || a.status === 'confirmado')
  )

  // Não confirmados hoje (status = agendado)
  const naoConfirmados = agendamentosHoje?.filter((a) => a.status === 'agendado') ?? []

  // ── Próximo paciente para o herói (FASE D) ─────────────────────────────────────
  let proximoPaciente: ProximoPaciente | null = null

  if (proximoAgendamento) {
    // Busca histórico clínico do paciente para resumo
    // Paraleliza: as duas buscas são independentes (último atendimento +
    // última prescrição do mesmo paciente). Promise.all corta ~metade do tempo
    // de montagem do herói no carregamento do dashboard.
    const [{ data: ultimoRecord }, { data: ultimaPrescricao }] = await Promise.all([
      supabase
        .from('clinical_records')
        .select('finalizado_em, clinical_data')
        .eq('org_id', orgId)
        .eq('patient_id', proximoAgendamento.patient_id)
        .eq('status', 'finalizado')
        .is('deleted_at', null)
        .order('finalizado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('prescriptions')
        .select('dados_prescricao')
        .eq('org_id', orgId)
        .eq('patient_id', proximoAgendamento.patient_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const resumo = montarResumoClinicio({
      ultimaConsultaEm: ultimoRecord?.finalizado_em ?? null,
      clinicalData: ultimoRecord?.clinical_data ?? null,
      dadosPrescricao: ultimaPrescricao?.dados_prescricao ?? null,
    })

    const patient = proximoAgendamento.patients as { nome: string } | null

    proximoPaciente = {
      appointmentId: proximoAgendamento.id,
      patientId: proximoAgendamento.patient_id,
      patientNome: patient?.nome ?? 'Paciente',
      dataHora: proximoAgendamento.data_hora,
      resumoClinicio: resumo,
    }
  }

  // ── Pendências (FASE E) ───────────────────────────────────────────────────────
  const pendencias: Pendencia[] = []

  // 1. Assinatura não cadastrada
  if (!profile.signature_url) {
    pendencias.push({ tipo: 'sem_assinatura' })
  }

  // 2. Fichas em aberto (status = em_andamento).
  //    Ignora fichas arquivadas (deleted_at) e fichas de pacientes arquivados —
  //    senão a pendência persiste mesmo após arquivar o paciente/atendimento.
  const { data: fichasAbertas } = await supabase
    .from('clinical_records')
    .select('id, patients!inner ( nome, deleted_at )')
    .eq('org_id', orgId)
    .eq('status', 'em_andamento')
    .is('deleted_at', null)
    .is('patients.deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  for (const ficha of fichasAbertas ?? []) {
    const patient = ficha.patients as { nome: string } | null
    pendencias.push({
      tipo: 'ficha_aberta',
      clinicalRecordId: ficha.id,
      patientNome: patient?.nome ?? 'Paciente',
    })
  }

  // 3. Receitas sem PDF (pdf_gerado_em IS NULL).
  //    Também ignora receitas de pacientes arquivados (a receita já é filtrada
  //    por deleted_at; arquivar o atendimento também marca a receita).
  const { data: receitasSemPdf } = await supabase
    .from('prescriptions')
    .select('id, patients!inner ( nome, deleted_at )')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .is('pdf_gerado_em', null)
    .is('patients.deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  for (const receita of receitasSemPdf ?? []) {
    const patient = receita.patients as { nome: string } | null
    pendencias.push({
      tipo: 'receita_sem_pdf',
      prescriptionId: receita.id,
      patientNome: patient?.nome ?? 'Paciente',
    })
  }

  // ── Dados para render ─────────────────────────────────────────────────────────
  const primeiroNome = profile.nome_completo?.split(' ')[0] ?? 'Bem-vindo'
  const diaSemana = formatarDiaSemanaBR(hoje)
  const dataFormatada = formatarDataExtensa(hoje)

  return (
    <div className="space-y-6">
      {modalPerfil}
      {/* ── Cabeçalho da página ──────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-page-hero flex items-center gap-3 flex-wrap">
            <span>
              Ola, {primeiroNome} <span className="text-2xl">👋</span>
            </span>
          </h1>
          <p className="text-meta mt-1">
            <span className="capitalize">{diaSemana}</span>, {dataFormatada}
          </p>
        </div>
        <NovoAtendimentoMenu variant="compact" />
      </div>

      {/* ── Banner de onboarding — guia até 3/3, some ao completar ────── */}
      {passosCompletos < 3 && (
        <BannerOnboarding passos={{ temPaciente, temAgendamento, temReceita }} />
      )}

      {/* ── Faixa de resumo do dia (FASE C) ──────────────────────────── */}
      <div className="rounded-xl bg-card border border-border shadow-sm p-4">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          {/* Progresso do dia — ênfase nos atendimentos concluídos */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <span className="text-eyebrow">Progresso do dia</span>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[34px] leading-none font-semibold text-status-ok tabular-nums">
                  {atendidosHoje}
                </span>
                <span className="text-meta text-muted-foreground">/ {totalAtendiveis}</span>
              </div>
              <div className="w-28 h-2.5 bg-status-ok/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-ok transition-all duration-500"
                  style={{ width: `${progressoDia}%` }}
                />
              </div>
            </div>
            <span className="text-meta-xs text-muted-foreground">
              {atendidosHoje === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}
            </span>
          </div>

          {/* Próximo horário */}
          {proximoAgendamento && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-meta">
                Próximo às{' '}
                <span className="font-semibold text-foreground">
                  {new Date(proximoAgendamento.data_hora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </span>
              </span>
            </div>
          )}

          {/* Não confirmados */}
          {naoConfirmados.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-warning-bg text-status-warning">
                {naoConfirmados.length} não confirmado
                {naoConfirmados.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Conteúdo: 2 colunas (wireframe) ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-5">
        {/* Coluna principal: agenda */}
        <div className="flex flex-col gap-5">
          {/* Agenda do dia */}
          <section className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span className="text-eyebrow font-semibold">Agenda de hoje</span>
              </div>
              <Link
                href="/agenda"
                className="group inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Ver agenda completa
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <AgendaHoje orgId={orgId} />
          </section>
        </div>

        {/* Coluna lateral: herói (próximo paciente) → pendências (FASE E) */}
        <div className="flex flex-col gap-5">
          <HeroPainel proximoPaciente={proximoPaciente} />
          <ColunaLateral pendencias={pendencias} />
        </div>
      </div>
    </div>
  )
}
