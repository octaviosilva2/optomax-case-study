// Helpers compartilhados entre o layout das tabs e as pages individuais.
// Mantém a fonte única de verdade da lista de tabs e do mapa de status.

export type TabKey =
  | 'gestao'
  | 'profile'
  | 'pacientes'
  | 'atendimentos'
  | 'receitas'
  | 'timeline'
  | 'notas'

export const TABS: ReadonlyArray<{ key: TabKey; label: string; href: string }> = [
  { key: 'gestao', label: 'Gestão', href: 'gestao' },
  { key: 'profile', label: 'Profile', href: 'profile' },
  { key: 'pacientes', label: 'Pacientes', href: 'pacientes' },
  { key: 'atendimentos', label: 'Atendimentos', href: 'atendimentos' },
  { key: 'receitas', label: 'Receitas', href: 'receitas' },
  { key: 'timeline', label: 'Timeline', href: 'timeline' },
  { key: 'notas', label: 'Notas', href: 'notas' },
]

// Cores do badge de status da org. Bate com os status do orgPodeAcessar() + extras.
export function statusBadgeClass(planStatus: string, deletionRequested: boolean): string {
  if (deletionRequested) return 'bg-destructive-bg text-destructive border-destructive/40'
  switch (planStatus) {
    case 'active':
    case 'trialing':
      return 'bg-status-ok-bg text-status-ok border-status-ok/40'
    case 'past_due':
      return 'bg-status-warning-bg text-status-warning border-status-warning/40'
    case 'inactive':
    case 'suspended':
      return 'bg-secondary text-muted-foreground border-border'
    default:
      return 'bg-secondary text-muted-foreground border-border'
  }
}

export function statusLabel(planStatus: string, deletionRequested: boolean): string {
  if (deletionRequested) return 'Exclusão solicitada'
  switch (planStatus) {
    case 'active':
      return 'Ativa'
    case 'trialing':
      return 'Trial'
    case 'past_due':
      return 'Em atraso'
    case 'inactive':
      return 'Inativa'
    case 'suspended':
      return 'Suspensa'
    default:
      return planStatus
  }
}
