'use client'

// Modal que substituiu o wizard /onboarding. Abre suave ~10s depois que o
// usuário cai no dashboard (só quando o perfil ainda não foi resolvido) e
// coleta os dados que antes ficavam no onboarding: nome da clínica, formação
// e CRB. Tem "Deixar para depois" — qualquer um dos dois caminhos (salvar ou
// dispensar) marca onboarded=true e o modal nunca mais reaparece. Para mexer
// nesses dados depois, o usuário usa Configurações.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarPerfilInicial, dispensarOnboarding } from '@/app/onboarding/actions'

// Atraso até o modal aparecer — dá tempo do usuário ver o dashboard primeiro.
const DELAY_MS = 10_000

type Props = {
  nomeClinicaInicial: string
  croInicial: string
  formacoesIniciais: string[]
}

export function ModalCompletarPerfil({
  nomeClinicaInicial,
  croInicial,
  formacoesIniciais,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // `done` evita reabertura caso o timer dispare depois de já ter resolvido.
  const [done, setDone] = useState(false)

  const [nomeClinica, setNomeClinica] = useState(nomeClinicaInicial)
  const [crb, setCrb] = useState(croInicial)
  const [formacoes, setFormacoes] = useState(formacoesIniciais.join(', '))

  // Abre o modal após o atraso (uma vez só).
  useEffect(() => {
    const id = setTimeout(() => {
      if (!done) setOpen(true)
    }, DELAY_MS)
    return () => clearTimeout(id)
  }, [done])

  async function handleSalvar() {
    setSaving(true)
    try {
      const r = await salvarPerfilInicial({
        nome_clinica: nomeClinica.trim(),
        cro_cboo: crb.trim(),
        formacoes: formacoes
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
      })
      if (r.error) {
        toast.error('Não foi possível salvar. Tente novamente.')
        return
      }
      toast.success('Perfil atualizado.')
      setDone(true)
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDepois() {
    setSaving(true)
    try {
      // Marca como resolvido no servidor — não reaparece em logins futuros.
      await dispensarOnboarding()
      setDone(true)
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        // Fechar de qualquer forma (X, Esc, clique fora) conta como "deixar para
        // depois" → marca onboarded e não reabre. Assim o modal só volta se a
        // pessoa for em Configurações, como combinado.
        if (!next && !done) {
          void handleDepois()
          return
        }
        setOpen(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete seu perfil</DialogTitle>
          <DialogDescription>
            Esses dados aparecem nas suas receitas e fichas. Leva menos de um minuto —
            ou deixe para depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="perfil-clinica">Nome da clínica</Label>
            <Input
              id="perfil-clinica"
              placeholder="Ex: Clínica OptoVision"
              value={nomeClinica}
              onChange={(e) => setNomeClinica(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perfil-formacao">Formação</Label>
            <Input
              id="perfil-formacao"
              placeholder="Ex: Optometria, Contatologia"
              value={formacoes}
              onChange={(e) => setFormacoes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Separe por vírgula</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perfil-crb">CRB</Label>
            <Input
              id="perfil-crb"
              placeholder="Ex: CRB 12345"
              value={crb}
              onChange={(e) => setCrb(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleDepois} disabled={saving}>
            Deixar para depois
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
