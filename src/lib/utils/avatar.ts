// Paleta de avatar tokenizada (8 cores).
// Classes Tailwind geradas via @theme inline que mapeia --avatar-N para --color-avatar-N.
// Os hex originais (teal-500, violet-500, etc.) agora vivem em globals.css como --avatar-1 a --avatar-8.
const AVATAR_COLORS = [
  'bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4',
  'bg-avatar-5', 'bg-avatar-6', 'bg-avatar-7', 'bg-avatar-8',
]

/** Cor determinística baseada no nome completo (hash djb2 simplificado) */
export function avatarColor(nome: string): string {
  const hash = [...nome].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Iniciais: primeira letra do primeiro + primeiro letra do último nome */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(' ').filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  return nome.substring(0, 2).toUpperCase()
}
