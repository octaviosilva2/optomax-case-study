import { z } from 'zod'

// Schema de agendamento SEM tipo de consulta (removido na refatoracao de produto).
// A duracao agora e informada diretamente pelo usuario em minutos.
export const agendamentoSchema = z.object({
  patient_id: z.string().uuid('Selecione um paciente'),
  data_hora: z.string().min(1, 'Data e hora são obrigatórias'),
  duracao: z.number().int('Duração deve ser inteiro').min(5, 'Mínimo 5 minutos').max(480, 'Máximo 8 horas'),
  observacao: z.string().optional(),
})

export type AgendamentoFormData = z.infer<typeof agendamentoSchema>
