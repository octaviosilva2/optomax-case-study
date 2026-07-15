'use client'

import { calcularIdade } from '@/lib/utils/idade'

// Props refatoradas: tipo_consulta substituido por duracao
type Props = {
  paciente: {
    nome: string
    data_nascimento: string | null
    cpf: string | null
    sexo_biologico: string | null
  }
  agendamento: {
    data_hora: string | null
    duracao: number | null
  } | null
}

export function SecaoIdentificacao({ paciente, agendamento }: Props) {
  const idade = paciente.data_nascimento
    ? calcularIdade(paciente.data_nascimento)
    : null

  const dataFormatada = agendamento?.data_hora
    ? new Date(agendamento.data_hora).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—'

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
      <h2 className="text-base font-semibold text-foreground">Identificação</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Paciente</dt>
          <dd className="font-medium text-foreground">{paciente.nome}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Idade</dt>
          <dd className="font-medium text-foreground tabular-nums">
            {idade !== null ? `${idade} anos` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duração</dt>
          <dd className="font-medium text-foreground">
            {agendamento?.duracao ? `${agendamento.duracao} min` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Data/Hora</dt>
          <dd className="font-medium text-foreground tabular-nums font-mono">{dataFormatada}</dd>
        </div>
      </dl>
    </section>
  )
}
