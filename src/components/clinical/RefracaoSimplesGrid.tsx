'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Grid OD/OE × ESF/CIL/EIXO — usado APENAS pelo Autorrefrator (Retinoscopia
// estática migrou para texto livre próprio na Etapa 4). Não inclui DNP/ADD.
//
// Etapa 7 (#30): campos viraram texto livre (`string`). Antes eram `number | null`
// com validação de range. Agora aceita qualquer formato clínico — o schema Zod
// usa `dioptriaCampoLivre` para preservar fichas antigas com `number` no JSONB.

type RefracaoSimplesOlho = {
  esf: string
  cil: string
  eixo: string
}

type Props = {
  value: { od?: Partial<RefracaoSimplesOlho>; oe?: Partial<RefracaoSimplesOlho> }
  onChange: (next: { od?: Partial<RefracaoSimplesOlho>; oe?: Partial<RefracaoSimplesOlho> }) => void
  disabled?: boolean
}

const SPEC = {
  esf: { label: 'ESF' },
  cil: { label: 'CIL' },
  eixo: { label: 'EIXO' },
} as const

const CAMPOS = ['esf', 'cil', 'eixo'] as const
const LINHAS = ['od', 'oe'] as const

// Converte valor legado (number/null) em string para exibição sem React warning.
function toInputValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

export function RefracaoSimplesGrid({ value, onChange, disabled }: Props) {
  function atualizar(linha: 'od' | 'oe', campo: 'esf' | 'cil' | 'eixo', raw: string) {
    // Texto livre: passa `raw` direto, sem conversão numérica.
    const linhaAtual = (value[linha] ?? {}) as Partial<RefracaoSimplesOlho>
    onChange({
      ...value,
      [linha]: { ...linhaAtual, [campo]: raw },
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="w-12 pb-2"></th>
            {CAMPOS.map((c) => (
              <th key={c} className="pb-2 px-2 font-medium text-muted-foreground">
                {SPEC[c].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS.map((linha) => (
            <tr key={linha}>
              <td className="py-1">
                <Label className="text-xs uppercase text-muted-foreground">{linha.toUpperCase()}</Label>
              </td>
              {CAMPOS.map((campo) => {
                const olho = value[linha] as Partial<RefracaoSimplesOlho> | undefined
                const v = toInputValue(olho?.[campo])
                const spec = SPEC[campo]
                return (
                  <td key={campo} className="py-1 px-1">
                    <Input
                      disabled={disabled}
                      value={v}
                      onChange={(e) => atualizar(linha, campo, e.target.value)}
                      className="h-9 w-full text-center"
                      aria-label={`${linha.toUpperCase()} ${spec.label}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
