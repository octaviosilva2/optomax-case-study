'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AnamneseFamiliar } from '@/types/clinical'

type Props = {
  value: Partial<AnamneseFamiliar>
  onChange: (parcial: Partial<AnamneseFamiliar>) => void
  disabled?: boolean
}

// Condições familiares mapeadas para exibição
const CONDICOES: Array<{ key: keyof AnamneseFamiliar; label: string }> = [
  { key: 'glaucoma', label: 'Glaucoma' },
  { key: 'catarata', label: 'Catarata' },
  { key: 'dmri', label: 'DMRI (Degeneração Macular Relacionada à Idade)' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'pressao_alta', label: 'Pressão alta' },
  { key: 'ceratocone', label: 'Ceratocone' },
]

export function SecaoAnamneseFamiliar({ value, onChange, disabled }: Props) {
  const update = (p: Partial<AnamneseFamiliar>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">Anamnese familiar</h2>
      <p className="text-xs text-muted-foreground">
        Marque as condições presentes em familiares próximos.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {CONDICOES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={`fam-${key}`}
              disabled={disabled}
              checked={!!value[key]}
              onCheckedChange={(c) => update({ [key]: c === true } as Partial<AnamneseFamiliar>)}
            />
            <Label htmlFor={`fam-${key}`} className="font-normal">
              {label}
            </Label>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="outras-fam">Outras</Label>
        <Textarea
          id="outras-fam"
          rows={2}
          disabled={disabled}
          value={value.outras ?? ''}
          onChange={(e) => update({ outras: e.target.value })}
        />
      </div>
    </section>
  )
}
