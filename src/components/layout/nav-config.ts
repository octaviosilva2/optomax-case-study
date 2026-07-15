import {
  LayoutDashboard,
  Calendar,
  Glasses,
  Users,
  FileText,
  Clipboard,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; children?: NavItem[] }

// Destinos definidos uma vez, reordenados por superfície.
const PAINEL: NavItem = { href: '/dashboard', label: 'Painel', icon: LayoutDashboard }
const AGENDA: NavItem = { href: '/agenda', label: 'Agenda', icon: Calendar }
const FICHAS: NavItem = { href: '/ficha', label: 'Fichas', icon: Clipboard }
const RECEITA: NavItem = { href: '/receitas', label: 'Receitas', icon: FileText }
// "Atendimento" agrupa Fichas + Receita (mesmo fluxo clínico). Href aponta para
// Fichas — é o destino do rail recolhido (tablet/desktop) quando não há espaço pro accordion.
const ATENDIMENTO: NavItem = {
  href: '/ficha',
  label: 'Atendimento',
  icon: Glasses,
  children: [FICHAS, RECEITA],
}
const PACIENTES: NavItem = { href: '/pacientes', label: 'Pacientes', icon: Users }

// Bottom bar (mobile): Painel · Pacientes · Agenda · Atendimento (abre sheet com Fichas/Receita).
export const NAV_MAIN: NavItem[] = [PAINEL, PACIENTES, AGENDA, ATENDIMENTO]

// Sidebar (desktop/tablet): ordem por fluxo de trabalho do consultório.
export const NAV_SIDEBAR: NavItem[] = [PAINEL, PACIENTES, AGENDA, ATENDIMENTO]

// Item ativo: match exato ou subrota (ex.: /atendimento/123 ativa "Atendimento").
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
