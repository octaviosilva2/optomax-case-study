import { describe, expect, it } from 'vitest'
import { validarCpfCnpj, formatarCpfCnpj, apenasDigitos } from '@/lib/utils/cpf-cnpj'

describe('lib/utils/cpf-cnpj', () => {
  describe('validarCpfCnpj', () => {
    it('aceita CPF válido (com e sem máscara)', () => {
      expect(validarCpfCnpj('529.982.247-25')).toBe(true)
      expect(validarCpfCnpj('52998224725')).toBe(true)
    })

    it('aceita CNPJ válido (com e sem máscara)', () => {
      expect(validarCpfCnpj('11.222.333/0001-81')).toBe(true)
      expect(validarCpfCnpj('11222333000181')).toBe(true)
    })

    it('rejeita dígitos verificadores errados', () => {
      expect(validarCpfCnpj('529.982.247-24')).toBe(false)
      expect(validarCpfCnpj('11.222.333/0001-80')).toBe(false)
    })

    it('rejeita sequências repetidas', () => {
      expect(validarCpfCnpj('111.111.111-11')).toBe(false)
      expect(validarCpfCnpj('00000000000000')).toBe(false)
    })

    it('rejeita tamanho inválido / vazio', () => {
      expect(validarCpfCnpj('123')).toBe(false)
      expect(validarCpfCnpj('')).toBe(false)
      expect(validarCpfCnpj('5299822472')).toBe(false) // 10 dígitos
    })
  })

  describe('formatarCpfCnpj', () => {
    it('mascara CPF progressivamente', () => {
      expect(formatarCpfCnpj('52998224725')).toBe('529.982.247-25')
    })
    it('mascara CNPJ progressivamente', () => {
      expect(formatarCpfCnpj('11222333000181')).toBe('11.222.333/0001-81')
    })
    it('ignora não-dígitos e limita a 14 dígitos', () => {
      expect(formatarCpfCnpj('abc11222333000181999')).toBe('11.222.333/0001-81')
    })
  })

  describe('apenasDigitos', () => {
    it('remove máscara', () => {
      expect(apenasDigitos('529.982.247-25')).toBe('52998224725')
    })
  })
})
