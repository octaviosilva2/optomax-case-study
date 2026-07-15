import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AppShell } from '@/components/app-shell'
import { AcessoBloqueado } from '@/components/AcessoBloqueado'
import { SignatureMissingBanner } from '@/components/SignatureMissingBanner'
import { BannerTrialExpirado } from '@/components/BannerTrialExpirado'
import { BannerPagamento } from '@/components/BannerPagamento'
import { ModalPagamento } from '@/components/ModalPagamento'
import { SessionTracker } from '@/components/SessionTracker'
import { HeartbeatOnHide } from '@/components/HeartbeatOnHide'
import { orgPodeLer, orgEhReadOnly } from '@/lib/utils/status'
import {
  modoManutencaoLigado,
  usuarioPassaManutencao,
  mensagemManutencao,
} from '@/lib/maintenance'
import { ManutencaoBloqueio } from '@/components/ManutencaoBloqueio'
import { getSessionData, touchLastSeen } from '@/lib/auth/session'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sessão é cacheada (React.cache) — pages filhas reutilizam o resultado
  // dentro da mesma request, eliminando round-trips duplicados.
  const session = await getSessionData()

  if (!session) redirect('/login')

  // Modo manutenção ("loja fechada"): bloqueia o uso do app para os usuários
  // enquanto configuramos produção. Bypass: org admin OU e-mail em
  // MAINTENANCE_BYPASS_EMAILS (ver lib/maintenance.ts) — você continua usando.
  // ANTES de touchLastSeen pra não inflar a métrica de "Última atividade" com
  // quem só viu a tela de manutenção (mesmo motivo do AcessoBloqueado abaixo).
  if (
    modoManutencaoLigado() &&
    !usuarioPassaManutencao({
      plan: session.org?.plan,
      email: session.user.email,
    })
  ) {
    return <ManutencaoBloqueio mensagem={mensagemManutencao()} />
  }

  // Onboarding deixou de ser uma tela bloqueante (wizard /onboarding aposentado).
  // O usuário cai direto no dashboard; a coleta dos dados da clínica/profissional
  // virou o ModalCompletarPerfil, que abre suave 10s após entrar no dashboard.

  // F3-A04: bloqueio de org desativada/em exclusao ANTES de touchLastSeen.
  // Senao a metrica "Ultima atividade" inflaria mesmo pra org bloqueada que
  // so abre o app pra ver a tela de bloqueio.
  //
  // Paywall Fase 2: o bloqueio TOTAL agora cobre só quem NÃO pode nem ler
  // (cancelled/suspended/inactive — há intenção de apagar dados). O estado
  // 'expired' (trial cortado) passa a renderizar o app em modo READ-ONLY:
  // lê/exporta os próprios dados (LGPD), mas as mutações são barradas pelos
  // server actions (assertActiveOrg → 403). O empurrão para assinar vem do
  // BannerPagamento (fixo) + ModalPagamento (recorrente a cada 20s) abaixo.
  if (session.org && !orgPodeLer(session.org.plan_status)) {
    return (
      <AcessoBloqueado
        nomeClinica={session.org.nome_clinica ?? 'Sua clínica'}
        deletionScheduledFor={session.org.deletion_scheduled_for}
      />
    )
  }

  // True quando a org está em read-only (hoje: 'expired'). Dispara o paywall.
  const readOnly = orgEhReadOnly(session.org?.plan_status)

  // Marca presença do usuário (throttle interno de 60s no WHERE — não fritamos
  // o banco). Fire-and-forget: erro não bloqueia render. Usado pelo /admin
  // como "Última atividade" + badge "Online agora".
  await touchLastSeen(session.user.id)

  // signature_url null/vazio → exibe banner pedindo cadastro, MAS só depois de
  // 1 dia de conta criada. Nas primeiras 24h o usuário ainda está conhecendo o
  // app — empurrar a assinatura logo de cara compete com o onboarding e atrapalha.
  // Passado 1 dia, o lembrete passa a aparecer.
  const UM_DIA_MS = 24 * 60 * 60 * 1000
  const contaTemMaisDe1Dia = session.profile.created_at
    ? Date.now() - new Date(session.profile.created_at).getTime() >= UM_DIA_MS
    : false
  const signatureMissing = !session.profile.signature_url && contaTemMaisDe1Dia

  // Estado do colapso da sidebar persistido em cookie — lido aqui pra o SSR
  // renderizar já na largura certa (sem salto no primeiro paint).
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get('sidebar_collapsed')?.value === '1'

  return (
    <AppShell
      nomeProfissional={session.profile.nome_completo ?? ''}
      email={session.user.email ?? ''}
      defaultCollapsed={defaultCollapsed}
    >
      {/* Tracking retroativo de session_ended (Fase 5). */}
      <SessionTracker userId={session.user.id} />
      {/* Heartbeat de saída (Fase 6.5): atualiza last_seen_at em ~1s quando
          o tester fecha/esconde a aba, sem depender do throttle do SSR. */}
      <HeartbeatOnHide />
      {/* Paywall (Fase 2): banner fixo + modal recorrente quando em read-only. */}
      <BannerPagamento />
      <BannerTrialExpirado />
      <SignatureMissingBanner missing={signatureMissing} />
      {children}
      {readOnly && <ModalPagamento />}
    </AppShell>
  )
}
