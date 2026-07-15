// Utilitários de agenda: geração de slots e detecção de conflito

export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

export type HorarioDia = {
  ativo: boolean
  inicio: string // "HH:mm"
  fim: string    // "HH:mm"
}

export type HorarioFuncionamento = Record<DiaSemana, HorarioDia>

export type AgendamentoSimples = {
  data_hora: string // ISO string
  duracao: number   // minutos
  status: string
}

// Mapeia getDay() (0=dom) para chave do JSONB
const DIA_MAP: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/**
 * Gera array de horários disponíveis para um dia específico.
 * Ex: ["08:00", "08:15", "08:30", ...]
 */
export function gerarSlots(
  horario: HorarioFuncionamento,
  intervaloMinutos: number,
  data: Date
): string[] {
  const diaSemana = DIA_MAP[data.getDay()]
  const config = horario[diaSemana]

  if (!config?.ativo) return []

  const [inicioH, inicioM] = config.inicio.split(':').map(Number)
  const [fimH, fimM] = config.fim.split(':').map(Number)

  const slots: string[] = []
  let atual = inicioH * 60 + inicioM
  const fim = fimH * 60 + fimM

  while (atual < fim) {
    const h = Math.floor(atual / 60).toString().padStart(2, '0')
    const m = (atual % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    atual += intervaloMinutos
  }

  return slots
}

/**
 * Detecta conflito de horário considerando duração dos agendamentos.
 * Ignora agendamentos cancelados e com falta.
 */
export function detectarConflito(
  agendamentos: AgendamentoSimples[],
  novaDataHora: Date,
  duracaoMinutos: number
): { conflito: boolean; mensagem: string | null } {
  const novoInicio = novaDataHora.getTime()
  const novoFim = novoInicio + duracaoMinutos * 60 * 1000

  for (const ag of agendamentos) {
    if (ag.status === 'cancelado' || ag.status === 'faltou') continue

    const existInicio = new Date(ag.data_hora).getTime()
    const existFim = existInicio + ag.duracao * 60 * 1000

    // Sobreposição: novo começa antes do existente terminar E novo termina depois do existente começar
    if (novoInicio < existFim && novoFim > existInicio) {
      const hora = new Date(ag.data_hora).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      return {
        conflito: true,
        mensagem: `Conflito com agendamento das ${hora}`,
      }
    }
  }

  return { conflito: false, mensagem: null }
}

/**
 * Formata Date para "YYYY-MM-DD" (chave de query)
 */
export function formatarDataKey(data: Date): string {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retorna início e fim do dia em ISO string
 */
export function rangeDia(data: Date): { inicio: string; fim: string } {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(data)
  fim.setHours(23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

/**
 * Retorna início (segunda) e fim (domingo) da semana em ISO string
 */
export function rangeSemana(data: Date): { inicio: string; fim: string } {
  const dia = data.getDay() // 0=dom
  const diffParaSegunda = dia === 0 ? -6 : 1 - dia
  const segunda = new Date(data)
  segunda.setDate(data.getDate() + diffParaSegunda)
  segunda.setHours(0, 0, 0, 0)
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  domingo.setHours(23, 59, 59, 999)
  return { inicio: segunda.toISOString(), fim: domingo.toISOString() }
}

/**
 * Retorna label do dia da semana em português
 */
export function labelDiaSemana(data: Date): string {
  return data.toLocaleDateString('pt-BR', { weekday: 'long' })
}

/**
 * Formata data para exibição: "Seg, 14 abr"
 */
export function formatarDataCurta(data: Date): string {
  return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}
