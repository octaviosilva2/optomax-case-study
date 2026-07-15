'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  salvarClinica,
  salvarProfissional,
  removerAssinatura,
  getAssinaturaSignedUrl,
} from '@/app/(app)/configuracoes/actions'
import { SignatureUploadDialog } from '@/components/SignatureUploadDialog'

// ── Schemas (mesmos do ConfiguracoesTabs) ────────────────────────────────────

const clinicaSchema = z.object({
  nome_clinica: z.string().min(2, 'Nome obrigatório'),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
})

const profissionalSchema = z.object({
  nome_completo: z.string().min(2, 'Nome obrigatório'),
  cro_cboo: z.string().optional(),
  formacoes: z.string().optional(),
})

type ClinicaData = z.infer<typeof clinicaSchema>
type ProfissionalData = z.infer<typeof profissionalSchema>

type OrgData = { nome_clinica: string; endereco: string | null; telefone: string | null }
type ProfileData = {
  nome_completo: string
  cro_cboo: string | null
  formacoes: string[]
  signature_url: string | null
}

type Props = {
  open: boolean
  onClose: () => void
}

// ── Sub-componente: aba Clínica ───────────────────────────────────────────────

function ClinicaForm({
  orgData,
  saving,
  onSave,
}: {
  orgData: OrgData
  saving: boolean
  onSave: (data: ClinicaData) => Promise<void>
}) {
  const form = useForm<ClinicaData>({
    resolver: zodResolver(clinicaSchema),
    defaultValues: {
      nome_clinica: orgData.nome_clinica,
      endereco: orgData.endereco ?? '',
      telefone: orgData.telefone ?? '',
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nome_clinica">Nome da clínica *</Label>
        <Input id="nome_clinica" {...form.register('nome_clinica')} />
        {form.formState.errors.nome_clinica && (
          <p className="text-xs text-destructive">{form.formState.errors.nome_clinica.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Endereço</Label>
        <Input placeholder="Rua, número, bairro..." {...form.register('endereco')} />
      </div>
      <div className="space-y-1.5">
        <Label>Telefone</Label>
        <Input placeholder="(11) 99999-9999" {...form.register('telefone')} />
      </div>
      <Button
        type="submit"
        className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md"
        disabled={saving}
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ModalConfiguracoes({ open, onClose }: Props) {
  const router = useRouter()
  const [orgData, setOrgData] = useState<OrgData | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)

  // Carrega dados ao abrir (lazy, uma só vez por sessão)
  useEffect(() => {
    if (!open || orgData) return

    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select(
            'nome_completo, cro_cboo, formacoes, signature_url, organizations!inner(nome_clinica, endereco, telefone)',
          )
          .eq('id', user.id)
          .single()

        if (data) {
          const org = data.organizations as unknown as OrgData
          setOrgData({ nome_clinica: org.nome_clinica, endereco: org.endereco, telefone: org.telefone })
          setProfileData({
            nome_completo: data.nome_completo ?? '',
            cro_cboo: data.cro_cboo,
            formacoes: (data.formacoes as string[]) ?? [],
            signature_url: data.signature_url,
          })
          // Assinatura carrega em paralelo — não bloqueia a abertura do modal
          if (data.signature_url) {
            getAssinaturaSignedUrl()
              .then(({ url }) => setSignatureUrl(url))
              .catch(() => {})
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, orgData])


  async function handleSalvarClinica(data: ClinicaData) {
    setSaving(true)
    const result = await salvarClinica({
      nome_clinica: data.nome_clinica,
      endereco: data.endereco || null,
      telefone: data.telefone || null,
    })
    setSaving(false)
    if (result.error) {
      toast.error('Erro ao salvar. Tente novamente.')
      return
    }
    toast.success('Dados da clínica salvos!')
    setOrgData((prev) =>
      prev ? { ...prev, nome_clinica: data.nome_clinica, endereco: data.endereco ?? null, telefone: data.telefone ?? null } : prev,
    )
  }

  async function handleSalvarProfissional(data: ProfissionalData) {
    setSaving(true)
    const result = await salvarProfissional({
      nome_completo: data.nome_completo,
      cro_cboo: data.cro_cboo || null,
      formacoes: data.formacoes
        ? data.formacoes
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean)
        : [],
    })
    setSaving(false)
    if (result.error) {
      toast.error('Erro ao salvar. Tente novamente.')
      return
    }
    toast.success('Dados do profissional salvos!')
  }

  async function handleRemoverAssinatura() {
    if (!confirm('Remover a assinatura cadastrada?')) return
    setSaving(true)
    const result = await removerAssinatura()
    setSaving(false)
    if (result.error) {
      toast.error('Erro ao remover assinatura.')
      return
    }
    toast.success('Assinatura removida.')
    setProfileData((prev) => (prev ? { ...prev, signature_url: null } : prev))
    setSignatureUrl(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="sm:max-w-[520px] w-full p-0 overflow-hidden max-h-[90dvh]"
          showCloseButton={false}
        >
          {/* Header fixo */}
          <DialogHeader className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <DialogTitle className="font-sans font-semibold text-[15px]">Configurações</DialogTitle>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="clinica" className="flex flex-col max-h-[calc(90dvh-65px)] sm:max-h-[75vh]">
              <TabsList className="mx-5 mt-4 mb-1 shrink-0">
                <TabsTrigger value="clinica">Clínica</TabsTrigger>
                <TabsTrigger value="profissional">Profissional</TabsTrigger>
              </TabsList>

              {/* Aba Clínica */}
              <TabsContent value="clinica" className="flex-1 overflow-y-auto px-5 pb-5 mt-4">
                {orgData && (
                  <ClinicaForm orgData={orgData} saving={saving} onSave={handleSalvarClinica} />
                )}
              </TabsContent>

              {/* Aba Profissional */}
              <TabsContent value="profissional" className="flex-1 overflow-y-auto px-5 pb-5 mt-4">
                {profileData && (
                  <>
                    {/* Form principal */}
                    <ProfissionalForm
                      profileData={profileData}
                      saving={saving}
                      onSave={handleSalvarProfissional}
                    />

                    {/* Assinatura digital */}
                    <div className="mt-6 space-y-3 pt-5 border-t border-border">
                      <p className="text-sm font-medium">Assinatura digital</p>
                      <p className="text-xs text-muted-foreground">
                        Sua assinatura aparece no carimbo das fichas e receitas em PDF.
                      </p>
                      {profileData.signature_url && signatureUrl ? (
                        <div className="rounded-md border border-input bg-white p-4 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={signatureUrl} alt="Sua assinatura" className="max-h-[80px] object-contain" />
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-input bg-muted/30 p-5 text-center text-xs text-muted-foreground">
                          Nenhuma assinatura cadastrada.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md"
                          onClick={() => setSignatureDialogOpen(true)}
                        >
                          {profileData.signature_url ? 'Trocar assinatura' : 'Cadastrar assinatura'}
                        </Button>
                        {profileData.signature_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={saving}
                            onClick={handleRemoverAssinatura}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>

                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <SignatureUploadDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSaved={() => {
          router.refresh()
          // Força recarregamento da signed URL na próxima abertura
          setProfileData(null)
        }}
      />
    </>
  )
}

// ── Form do profissional (sub-componente) ─────────────────────────────────────

function ProfissionalForm({
  profileData,
  saving,
  onSave,
}: {
  profileData: ProfileData
  saving: boolean
  onSave: (data: ProfissionalData) => Promise<void>
}) {
  const form = useForm<ProfissionalData>({
    resolver: zodResolver(profissionalSchema),
    defaultValues: {
      nome_completo: profileData.nome_completo,
      cro_cboo: profileData.cro_cboo ?? '',
      formacoes: profileData.formacoes.join(', '),
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nome completo *</Label>
        <Input placeholder="Dr. João Silva" {...form.register('nome_completo')} />
        {form.formState.errors.nome_completo && (
          <p className="text-xs text-destructive">{form.formState.errors.nome_completo.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>CRO / CBOO</Label>
        <Input placeholder="CRO-SP 12345" {...form.register('cro_cboo')} />
      </div>
      <div className="space-y-1.5">
        <Label>Formações / Especialidades</Label>
        <Input placeholder="Ex: Optometria, Contatologia" {...form.register('formacoes')} />
        <p className="text-xs text-muted-foreground">Separe por vírgula</p>
      </div>
      <Button
        type="submit"
        size="sm"
        className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md"
        disabled={saving}
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}
