'use client'

type Modelo = 'resumido' | 'completo'

type Props = {
  value: Modelo
  onChange?: (m: Modelo) => void
  disabled?: boolean
}

export function SeletorModelo({ value, onChange, disabled }: Props) {
  const base =
    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  const ativo = 'bg-primary text-white'
  const inativo = 'text-muted-foreground hover:bg-muted'

  return (
    <div
      className="inline-flex gap-1 p-1 bg-muted rounded-lg"
      role="tablist"
      aria-label="Modelo de ficha"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'resumido'}
        disabled={disabled}
        onClick={() => onChange?.('resumido')}
        className={`${base} ${value === 'resumido' ? ativo : inativo}`}
      >
        Resumido
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'completo'}
        disabled={disabled}
        onClick={() => onChange?.('completo')}
        className={`${base} ${value === 'completo' ? ativo : inativo}`}
      >
        Completo
      </button>
    </div>
  )
}
