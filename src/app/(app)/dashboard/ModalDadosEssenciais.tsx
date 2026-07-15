'use client'

// Modal OBRIGATÓRIO de dados essenciais (nome completo + telefone). Só é
// renderizado para contas antigas que ficaram sem esses dados — quem se cadastra
// agora já informa ambos na tela de criação de conta. Não pode ser dispensado
// (sem "deixar para depois", sem fechar por fora): só fecha ao salvar válido.
// Não mexe em `onboarded` — depois dele, o ModalCompletarPerfil (opcional) ainda
// pode aparecer.

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
import { salvarDadosEssenciais } from '@/app/onboarding/actions'
import { mensagemErroTelefone, normalizarTelefone, TELEFONE_AJUDA } from '@/lib/validations/onboarding'

// Atraso curto só para não "piscar" o modal no primeiro paint.
const DELAY_MS = 1500

type Props = {
  nomeInicial: string
  telefoneInicial: string
}

export function ModalDadosEssenciais({ nomeInicial, telefoneInicial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [nome, setNome] = useState(nomeInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setOpen(true), DELAY_MS)
    return () => clearTimeout(id)
  }, [])

  async function handleSalvar() {
    const nomeOk = nome.trim().length >= 3
    const msgTel = mensagemErroTelefone(telefone)
    if (!nomeOk || msgTel) {
      setErro(!nomeOk ? 'Informe seu nome completo.' : msgTel!)
      return
    }
    setErro(null)
    setSaving(true)
    try {
      const r = await salvarDadosEssenciais({
        nome_completo: nome.trim(),
        // Já validado acima → normaliza para o formato limpo (DDD + número).
        telefone: normalizarTelefone(telefone) ?? telefone.trim(),
      })
      if (r.error) {
        toast.error('Não foi possível salvar. Tente novamente.')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      // Obrigatório: Esc, clique-fora e o X chamam este onOpenChange — deixá-lo
      // vazio impede o fechamento. Só o setOpen(false) interno (após salvar)
      // fecha de fato. Por isso também escondemos o X (showCloseButton={false}).
      onOpenChange={() => {}}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Confirme seus dados</DialogTitle>
          <DialogDescription>
            Precisamos do seu nome e telefone para concluir seu cadastro e poder
            entrar em contato. Leva alguns segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="ess-nome">Nome completo</Label>
            <Input
              id="ess-nome"
              autoComplete="name"
              placeholder="Dr. João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ess-telefone">Telefone</Label>
            <Input
              id="ess-telefone"
              type="tel"
              autoComplete="tel"
              placeholder="47991960107"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{TELEFONE_AJUDA}</p>
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button onClick={handleSalvar} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Salvar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
