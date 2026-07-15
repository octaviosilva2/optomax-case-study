// Validação e formatação de CPF/CNPJ. Usado no checkout (/assinar): o ASAAS
// exige cpfCnpj do titular para gerar a cobrança Pix. Validamos os dígitos
// verificadores localmente para dar erro imediato (boa UX) — o ASAAS valida de
// novo no servidor. Guardamos só dígitos no banco (organizations.cpf_cnpj).

/** Remove tudo que não for dígito. */
export function apenasDigitos(value: string): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Valida os 2 dígitos verificadores de um CPF (11 dígitos). */
function cpfValido(cpf: string): boolean {
  if (cpf.length !== 11) return false
  // Rejeita sequências repetidas (000..., 111...), que passam no algoritmo.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const calcDigito = (base: string, pesoInicial: number): number => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  const d1 = calcDigito(cpf.slice(0, 9), 10)
  const d2 = calcDigito(cpf.slice(0, 10), 11)
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10])
}

/** Valida os 2 dígitos verificadores de um CNPJ (14 dígitos). */
function cnpjValido(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const calcDigito = (base: string): number => {
    // Pesos do CNPJ: começam em 5 (ou 6) e decrescem até 2, reiniciando em 9.
    let peso = base.length - 7
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const d1 = calcDigito(cnpj.slice(0, 12))
  const d2 = calcDigito(cnpj.slice(0, 13))
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13])
}

/**
 * True se o valor é um CPF (11 dígitos) OU CNPJ (14 dígitos) válido.
 * Aceita o valor com ou sem máscara (ignora pontuação).
 */
export function validarCpfCnpj(value: string): boolean {
  const d = apenasDigitos(value)
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

/**
 * Aplica máscara progressiva enquanto o usuário digita:
 *   CPF  → 000.000.000-00
 *   CNPJ → 00.000.000/0000-00
 * Decide pelo nº de dígitos (≤11 = CPF, senão CNPJ).
 */
export function formatarCpfCnpj(value: string): string {
  const d = apenasDigitos(value).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
