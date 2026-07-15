// Validações do checkout de cartão (/assinar — Fase 4 ASAAS).
//
// Schema único (zod) compartilhado entre o form (react-hook-form) e a Server
// Action — defesa em profundidade: o cliente valida para UX imediata e o
// servidor revalida antes de tocar no ASAAS. Os dados do cartão NUNCA são
// persistidos no nosso banco; trafegam só para o ASAAS (escopo PCI).
//
// Campos do titular no FORM: nome, cpfCnpj, CEP, número (+ complemento opcional).
// E-mail e telefone NÃO são pedidos na tela — vêm da sessão/cadastro e são
// anexados no servidor (decisão de UX: form enxuto). Rua/cidade são derivadas
// do CEP pelo próprio ASAAS — não pedimos.

import { z } from 'zod'
import { apenasDigitos, validarCpfCnpj } from '@/lib/utils/cpf-cnpj'

/** Algoritmo de Luhn — valida o dígito verificador do número do cartão. */
function luhnValido(numero: string): boolean {
  const d = apenasDigitos(numero)
  if (d.length < 13 || d.length > 19) return false
  let soma = 0
  let dobrar = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i])
    if (dobrar) {
      n *= 2
      if (n > 9) n -= 9
    }
    soma += n
    dobrar = !dobrar
  }
  return soma % 10 === 0
}

// Ano/mês corrente em Brasília — base para rejeitar cartão já vencido.
function anoMesAtualBrasilia(): { ano: number; mes: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  const [ano, mes] = fmt.split('-')
  return { ano: Number(ano), mes: Number(mes) }
}

export const cartaoSchema = z
  .object({
    // ── Dados do cartão (não persistidos) ──
    number: z
      .string()
      .transform(apenasDigitos)
      .refine(luhnValido, 'Número do cartão inválido.'),
    holderName: z.string().trim().min(2, 'Informe o nome impresso no cartão.').max(100),
    expiryMonth: z
      .string()
      .transform(apenasDigitos)
      .refine((m) => /^\d{1,2}$/.test(m) && Number(m) >= 1 && Number(m) <= 12, 'Mês inválido.')
      // Normaliza para 2 dígitos ('1' → '01') como o ASAAS espera.
      .transform((m) => m.padStart(2, '0')),
    expiryYear: z
      .string()
      .transform(apenasDigitos)
      // Aceita 2 ou 4 dígitos; normaliza para 4 ('29' → '2029').
      .refine((y) => /^\d{2}$/.test(y) || /^\d{4}$/.test(y), 'Ano inválido.')
      .transform((y) => (y.length === 2 ? `20${y}` : y)),
    ccv: z
      .string()
      .transform(apenasDigitos)
      .refine((c) => /^\d{3,4}$/.test(c), 'CVV inválido.'),

    // ── Dados do titular (na tela) ──
    holderInfoName: z.string().trim().min(2, 'Informe o nome completo do titular.').max(120),
    cpfCnpj: z.string().refine(validarCpfCnpj, 'CPF/CNPJ inválido.'),
    // Só o CEP é pedido na tela. O número do endereço é enviado como "S/N" no
    // servidor (decisão de UX: form mínimo).
    postalCode: z
      .string()
      .transform(apenasDigitos)
      .refine((c) => /^\d{8}$/.test(c), 'CEP inválido.'),
  })
  // Rejeita cartão já vencido (mês/ano no passado).
  .refine(
    (v) => {
      const { ano, mes } = anoMesAtualBrasilia()
      const cardAno = Number(v.expiryYear)
      const cardMes = Number(v.expiryMonth)
      return cardAno > ano || (cardAno === ano && cardMes >= mes)
    },
    { message: 'Cartão vencido.', path: ['expiryMonth'] },
  )

export type CartaoInput = z.infer<typeof cartaoSchema>
