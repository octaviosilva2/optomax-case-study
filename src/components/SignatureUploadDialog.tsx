'use client'

// Dialog para cadastrar/trocar a assinatura digital do profissional.
// Única via de entrada: desenhar com mouse/trackpad/dedo (canvas via
// react-signature-canvas). A imagem final é exportada como PNG (data URL)
// e enviada via server action `salvarAssinatura` para o bucket privado.

import { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Eraser, Smartphone } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { salvarAssinatura } from '@/app/(app)/configuracoes/actions'
import SignatureCanvas from 'react-signature-canvas'

// Altura do canvas — maior no mobile para sobrar área para assinar com o dedo
const CANVAS_HEIGHT_MOBILE = 240
const CANVAS_HEIGHT_DESKTOP = 200

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function SignatureUploadDialog({ open, onOpenChange, onSaved }: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  // Dimensões físicas reais do canvas — medidas uma única vez no mount do dialog
  // para evitar o bug de "dedo desloca do traço" quando width fixo ≠ largura CSS.
  // NÃO reagimos a resize/orientationchange: trocar a largura forçaria remount
  // do <SignatureCanvas> e destruiria o desenho em andamento (regressão reportada
  // no celular ao girar retrato→paisagem→retrato). Aviso UX pede para o usuário
  // manter o aparelho na mesma posição enquanto assina.
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: CANVAS_HEIGHT_DESKTOP })

  // Reseta o canvas ao fechar
  function handleOpenChange(next: boolean) {
    if (!next) {
      sigRef.current?.clear()
    }
    onOpenChange(next)
  }

  // Mede a largura real do container e ajusta o canvas dinamicamente.
  // useLayoutEffect garante que a medição aconteça depois do dialog montar
  // mas antes do paint — assim o canvas já nasce no tamanho certo.
  useLayoutEffect(() => {
    if (!open) return

    function measure() {
      const el = containerRef.current
      if (!el) return
      const width = el.clientWidth
      if (width <= 0) return
      // Mobile (largura < 480) ganha mais altura para conforto do dedo
      const height = width < 480 ? CANVAS_HEIGHT_MOBILE : CANVAS_HEIGHT_DESKTOP
      setCanvasSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      )
    }

    // rAF garante que o dialog já tem layout antes de medir
    const rafId = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafId)
  }, [open])

  // Exporta o PNG do canvas e envia para a server action
  async function handleSave() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error('Desenhe sua assinatura antes de salvar.')
      return
    }
    // getTrimmedCanvas remove o espaço em branco em volta — assinatura
    // já vem "recortada" sem margem inútil
    const trimmed = sigRef.current.getTrimmedCanvas()
    const dataUrl = trimmed.toDataURL('image/png')

    setSaving(true)
    try {
      const res = await salvarAssinatura(dataUrl)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Assinatura cadastrada.')
      onSaved?.()
      handleOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastrar assinatura digital</DialogTitle>
          <DialogDescription>
            Sua assinatura aparecerá nas fichas e receitas em PDF.
          </DialogDescription>
          {/* Aviso de UX: girar o aparelho durante a assinatura zera o desenho */}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Smartphone className="w-3.5 h-3.5" />
            Mantenha o celular nesta posição enquanto assina.
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">
            Use o mouse, trackpad ou (no celular) o dedo para assinar abaixo —
            como você faria em papel.
          </p>

          <div
            ref={containerRef}
            className="rounded-md border border-input bg-white overflow-hidden"
            style={{ height: canvasSize.height }}
          >
            {/*
              Só renderiza o canvas quando temos largura medida — evita pintar
              com width=0 e depois o signature_pad ficar com a escala errada.
              Dimensões fixas após o primeiro paint (sem listener de resize),
              então não precisamos forçar remount via key.
            */}
            {canvasSize.width > 0 ? (
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  width: canvasSize.width,
                  height: canvasSize.height,
                  className: 'touch-none block',
                  style: {
                    width: `${canvasSize.width}px`,
                    height: `${canvasSize.height}px`,
                  },
                }}
                penColor="#0a1e3f"
                minWidth={1.2}
                maxWidth={2.8}
                velocityFilterWeight={0.7}
              />
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => sigRef.current?.clear()}
            >
              <Eraser className="h-4 w-4 mr-1" /> Limpar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Salvar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
