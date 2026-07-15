// Calcula idade em anos inteiros a partir da data de nascimento
export function calcularIdade(dataNascimento: string | Date): number {
  const nasc = typeof dataNascimento === 'string' ? new Date(dataNascimento) : dataNascimento
  const hoje = new Date()
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}
