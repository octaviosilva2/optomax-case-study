import { describe, expect, it } from 'vitest'
import { cartaoSchema } from '@/lib/validations/checkout'

// Base válida reutilizável (cartão de teste Visa — Luhn-válido). Cada caso
// sobrescreve só o campo em teste. Ano bem no futuro para nunca vencer.
const baseValida = {
  number: '4111 1111 1111 1111',
  holderName: 'MARIA S OLIVEIRA',
  expiryMonth: '12',
  expiryYear: '2099',
  ccv: '123',
  holderInfoName: 'Maria Silva Oliveira',
  cpfCnpj: '529.982.247-25',
  postalCode: '88330-000',
  addressNumber: '123',
  addressComplement: '',
}

describe('lib/validations/checkout — cartaoSchema', () => {
  it('aceita um cartão válido e normaliza os campos', () => {
    const r = cartaoSchema.parse(baseValida)
    expect(r.number).toBe('4111111111111111') // só dígitos
    expect(r.postalCode).toBe('88330000') // CEP só dígitos
    expect(r.expiryMonth).toBe('12')
    expect(r.expiryYear).toBe('2099')
  })

  it('normaliza mês de 1 dígito e ano de 2 dígitos', () => {
    const r = cartaoSchema.parse({ ...baseValida, expiryMonth: '3', expiryYear: '30' })
    expect(r.expiryMonth).toBe('03')
    expect(r.expiryYear).toBe('2030')
  })

  it('rejeita número que falha no Luhn', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, number: '4111 1111 1111 1112' })).toThrow()
  })

  it('rejeita número curto demais', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, number: '4111' })).toThrow()
  })

  it('rejeita cartão vencido (ano no passado)', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, expiryYear: '2020' })).toThrow()
  })

  it('rejeita mês fora de 1..12', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, expiryMonth: '13' })).toThrow()
  })

  it('rejeita CVV não numérico ou de tamanho errado', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, ccv: '12' })).toThrow()
    expect(() => cartaoSchema.parse({ ...baseValida, ccv: 'abc' })).toThrow()
  })

  it('rejeita CEP com menos de 8 dígitos', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, postalCode: '8833' })).toThrow()
  })

  it('rejeita CPF/CNPJ do titular inválido', () => {
    expect(() => cartaoSchema.parse({ ...baseValida, cpfCnpj: '111.111.111-11' })).toThrow()
  })
})
