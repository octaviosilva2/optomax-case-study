// Utilitários de CPF — validação, formatação e limpeza

export function limparCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export function formatarCPF(cpf: string): string {
  const limpo = limparCPF(cpf)
  if (limpo.length !== 11) return cpf
  return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function validarCPF(cpf: string): boolean {
  const limpo = limparCPF(cpf)
  if (limpo.length !== 11) return false
  // Rejeita CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(limpo)) return false

  // Primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(limpo[i]) * (10 - i)
  let digito1 = 11 - (soma % 11)
  if (digito1 >= 10) digito1 = 0
  if (digito1 !== parseInt(limpo[9])) return false

  // Segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(limpo[i]) * (11 - i)
  let digito2 = 11 - (soma % 11)
  if (digito2 >= 10) digito2 = 0
  return digito2 === parseInt(limpo[10])
}
