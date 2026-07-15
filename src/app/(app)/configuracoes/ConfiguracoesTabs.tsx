'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  salvarClinica,
  salvarProfissional,
  salvarOrigem,
  toggleOrigem,
  removerAssinatura,
} from './actions'
import { SignatureUploadDialog } from '@/components/SignatureUploadDialog'
import { ExclusaoContaDialog } from '@/components/configuracoes/ExclusaoContaDialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { EditorialDivider } from '@/components/ui/EditorialDivider'

// ── Schemas ──────────────────────────────────────────────────────────────────

const clinicaSchema = z.object({
  nome_clinica: z.string().min(2, 'Nome obrigatório'),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
})

// Schema do profissional SEM intervalo_consulta (removido na refatoracao)
const profissionalSchema = z.object({
  nome_completo: z.string().min(2, 'Nome obrigatório'),
  cro_cboo: z.string().optional(),
  formacoes: z.string().optional(),
})

type ClinicaData = z.infer<typeof clinicaSchema>
type ProfissionalData = z.infer<typeof profissionalSchema>

// ── Types ─────────────────────────────────────────────────────────────────────
// REFATORADO: tipos de consulta removidos do produto

type Origem = { id: string; nome: string; ativo: boolean }

type Props = {
  org: {
    nome_clinica: string
    endereco: string | null
    telefone: string | null
  }
  profile: {
    nome_completo: string
    cro_cboo: string | null
    formacoes: string[]
    // intervalo_consulta removido
    hasSignature: boolean
    signaturePreviewUrl: string | null
  }
  origens: Origem[]
}

// ── Componente principal ──────────────────────────────────────────────────────
// REFATORADO: aba 'tipos' removida (tipos de consulta nao existem mais)

type TabValue = 'clinica' | 'profissional' | 'origens'

export function ConfiguracoesTabs({ org, profile, origens: origensIniciais }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Tabs controlada — preserva a aba ativa apos salvar (sem `router.refresh()`)
  const [activeTab, setActiveTab] = useState<TabValue>('clinica')

  // Dialog de cadastro/troca de assinatura
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)

  // Dialog de exclusao de conta (Fase 8 — LGPD)
  const [exclusaoDialogOpen, setExclusaoDialogOpen] = useState(false)

  // ── Estado local para CRUD ────────────────────────────────────────────────

  const [origens, setOrigens] = useState<Origem[]>(origensIniciais)

  const [editandoOrigem, setEditandoOrigem] = useState<string | null>(null)
  const [novaOrigemNome, setNovaOrigemNome] = useState('')

  // ── Forms ─────────────────────────────────────────────────────────────────

  const clinicaForm = useForm<ClinicaData>({
    resolver: zodResolver(clinicaSchema),
    defaultValues: {
      nome_clinica: org.nome_clinica,
      endereco: org.endereco ?? '',
      telefone: org.telefone ?? '',
    },
  })

  // Form do profissional SEM intervalo_consulta (removido)
  const profissionalForm = useForm<z.input<typeof profissionalSchema>>({
    resolver: zodResolver(profissionalSchema),
    defaultValues: {
      nome_completo: profile.nome_completo,
      cro_cboo: profile.cro_cboo ?? '',
      formacoes: profile.formacoes.join(', '),
    },
  })

  // ── Handlers: Clínica e Profissional ─────────────────────────────────────

  async function handleSalvarClinica(data: ClinicaData) {
    setLoading(true)
    const result = await salvarClinica({
      nome_clinica: data.nome_clinica,
      endereco: data.endereco || null,
      telefone: data.telefone || null,
    })
    setLoading(false)
    if (result.error) {
      toast.error('Erro ao salvar. Tente novamente.')
      return
    }
    toast.success('Dados da clínica salvos!')
    // O form já reflete o que o usuário acabou de salvar — sem refresh
  }

  // Handler do profissional SEM intervalo_consulta (removido)
  async function handleSalvarProfissional(data: ProfissionalData) {
    setLoading(true)
    const result = await salvarProfissional({
      nome_completo: data.nome_completo,
      cro_cboo: data.cro_cboo || null,
      formacoes: data.formacoes
        ? data.formacoes.split(',').map(f => f.trim()).filter(Boolean)
        : [],
    })
    setLoading(false)
    if (result.error) {
      toast.error('Erro ao salvar. Tente novamente.')
      return
    }
    toast.success('Dados do profissional salvos!')
    // O form ja reflete o que o usuario acabou de salvar — sem refresh
  }

  // ── Handlers: Assinatura digital ─────────────────────────────────────────

  async function handleRemoverAssinatura() {
    if (!confirm('Remover a assinatura cadastrada? Você poderá cadastrar outra a qualquer momento.')) return
    setLoading(true)
    const result = await removerAssinatura()
    setLoading(false)
    if (result.error) {
      toast.error('Erro ao remover assinatura.')
      return
    }
    toast.success('Assinatura removida.')
    router.refresh() // recarrega o page server-side para refletir o estado novo
  }

  // ── Handlers: Origens de Paciente ────────────────────────────────────────

  async function handleAdicionarOrigem() {
    const nome = novaOrigemNome.trim()
    if (!nome) return
    setLoading(true)
    const result = await salvarOrigem({ nome })
    setLoading(false)
    if (result.error || !result.id) {
      toast.error('Erro ao adicionar origem.')
      return
    }
    // Optimistic update — adiciona a nova origem direto na lista local com o id retornado
    setOrigens(prev => [...prev, { id: result.id!, nome, ativo: true }])
    setNovaOrigemNome('')
    toast.success('Origem adicionada!')
  }

  async function handleSalvarOrigem(origem: Origem) {
    setLoading(true)
    const result = await salvarOrigem({ id: origem.id, nome: origem.nome })
    setLoading(false)
    if (result.error) {
      toast.error('Erro ao salvar origem.')
      return
    }
    // `origens` já reflete a edição inline feita pelos onChange do input — só sai do modo edit
    setEditandoOrigem(null)
    toast.success('Origem salva!')
  }

  async function handleToggleOrigem(id: string, ativo: boolean) {
    const novoAtivo = !ativo
    // Optimistic — atualiza UI imediatamente; rollback se a action falhar
    setOrigens(prev => prev.map(o => o.id === id ? { ...o, ativo: novoAtivo } : o))
    const result = await toggleOrigem(id, novoAtivo)
    if (result.error) {
      setOrigens(prev => prev.map(o => o.id === id ? { ...o, ativo } : o))
      toast.error('Erro ao atualizar origem.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
      {/* Segmented control padrao da identidade editorial (DESIGN.md §4).
          REFATORADO: aba 'tipos' removida (tipos de consulta nao existem mais). */}
      <TabsList className="mb-8">
        {([
          { value: 'clinica', label: 'Dados da Clínica', labelMobile: 'Clínica' },
          { value: 'profissional', label: 'Profissional', labelMobile: 'Profis.' },
          { value: 'origens', label: 'Origens de Paciente', labelMobile: 'Origens' },
        ] as const).map(({ value, label, labelMobile }) => (
          <TabsTrigger key={value} value={value}>
            <span className="md:hidden">{labelMobile}</span>
            <span className="hidden md:inline">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ── Aba 1: Dados da Clínica ── */}
      <TabsContent value="clinica">
        <div className="rounded-2xl bg-card border border-border shadow-sm">
          <div className="px-5 h-12 flex items-center border-b border-border">
            <span className="text-[14px] font-medium">Dados da Clínica</span>
          </div>
          <div className="p-5">
            <form onSubmit={clinicaForm.handleSubmit(handleSalvarClinica)} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="nome_clinica">Nome da clínica *</Label>
                <Input id="nome_clinica" {...clinicaForm.register('nome_clinica')} />
                {clinicaForm.formState.errors.nome_clinica && (
                  <p className="text-xs text-destructive">{clinicaForm.formState.errors.nome_clinica.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input placeholder="Rua, número, bairro..." {...clinicaForm.register('endereco')} />
              </div>

              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" {...clinicaForm.register('telefone')} />
              </div>

              <Button type="submit" className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </form>
          </div>

          {/* Rodapé do card: link para histórico de aceites (LGPD) */}
          <div className="px-5 py-3 border-t border-border bg-muted/30">
            <Link
              href="/configuracoes/historico-aceites"
              className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Ver histórico de aceites dos Termos e Privacidade
            </Link>
          </div>
        </div>

        {/* Zona de perigo — exclusão de conta (Fase 8 / LGPD art. 18).
            Separada do card principal para não normalizar a ação destrutiva.
            Editorial: divisor + titulo em serifa com icone de alerta. */}
        <EditorialDivider className="my-12" />

        <div className="space-y-4">
          {/* Titulo editorial em serifa com icone */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="font-serif text-xl tracking-tight text-destructive">
              Zona de perigo
            </h2>
          </div>

          <p className="text-sm text-muted-foreground max-w-prose">
            A exclusão da sua conta é irreversível após o período de carência de 30 dias.
            Todos os dados clínicos, pacientes e configurações serão permanentemente removidos.
          </p>

          <Button
            variant="destructive"
            onClick={() => setExclusaoDialogOpen(true)}
          >
            Excluir minha conta e dados
          </Button>
        </div>
      </TabsContent>

      {/* ── Aba 2: Dados do Profissional ── */}
      <TabsContent value="profissional">
        <div className="rounded-2xl bg-card border border-border shadow-sm">
          <div className="px-5 h-12 flex items-center border-b border-border">
            <span className="text-[14px] font-medium">Dados do Profissional</span>
          </div>
          <div className="p-5">
            <form
              onSubmit={profissionalForm.handleSubmit(data => handleSalvarProfissional(data as ProfissionalData))}
              className="space-y-4 max-w-lg"
            >
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input placeholder="Dr. João Silva" {...profissionalForm.register('nome_completo')} />
                {profissionalForm.formState.errors.nome_completo && (
                  <p className="text-xs text-destructive">{profissionalForm.formState.errors.nome_completo.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>CRO / CBOO</Label>
                <Input placeholder="CRO-SP 12345" {...profissionalForm.register('cro_cboo')} />
              </div>

              <div className="space-y-1.5">
                <Label>Formações / Especialidades</Label>
                <Input
                  placeholder="Ex: Optometria, Contatologia"
                  {...profissionalForm.register('formacoes')}
                />
                <p className="text-xs text-muted-foreground">Separe por vírgula</p>
              </div>

              <Button type="submit" className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </form>
          </div>
        </div>

        {/* ── Card: Assinatura digital ── */}
        <div className="rounded-2xl bg-card border border-border shadow-sm mt-6">
          <div className="px-5 h-12 flex items-center border-b border-border">
            <span className="text-[14px] font-medium">Assinatura digital</span>
          </div>
          <div className="p-5 max-w-lg space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Sua assinatura aparece no carimbo das fichas e receitas em PDF. Sem ela,
              o PDF sai com a linha vazia.
            </p>

            {profile.hasSignature && profile.signaturePreviewUrl ? (
              <div className="rounded-md border border-input bg-white p-4 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.signaturePreviewUrl}
                  alt="Sua assinatura"
                  className="max-h-[120px] object-contain"
                />
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-input bg-muted/30 p-6 text-center text-[13px] text-muted-foreground">
                Nenhuma assinatura cadastrada ainda.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md"
                onClick={() => setSignatureDialogOpen(true)}
              >
                {profile.hasSignature ? 'Trocar assinatura' : 'Cadastrar assinatura'}
              </Button>
              {profile.hasSignature && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={loading}
                  onClick={handleRemoverAssinatura}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ── Aba 3: Origens de Paciente (era aba 4, tipos foi removida) ── */}
      <TabsContent value="origens">
        <div className="rounded-2xl bg-card border border-border shadow-sm">
          <div className="px-5 h-12 flex items-center border-b border-border">
            <span className="text-[14px] font-medium">Origens de Paciente</span>
          </div>
          <div className="p-5 space-y-3">
            {origens.map(origem => (
              <div key={origem.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                {editandoOrigem === origem.id ? (
                  <>
                    <Input
                      value={origem.nome}
                      onChange={e => setOrigens(prev => prev.map(o => o.id === origem.id ? { ...o, nome: e.target.value } : o))}
                      className="flex-1"
                    />
                    <Button size="sm" className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md" disabled={loading} onClick={() => handleSalvarOrigem(origem)}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditandoOrigem(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{origem.nome}</span>
                    <Badge variant={origem.ativo ? 'default' : 'secondary'} className={origem.ativo ? 'bg-primary-subtle text-primary-subtle-foreground border-0' : ''}>
                      {origem.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => setEditandoOrigem(origem.id)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleOrigem(origem.id, origem.ativo)}
                      className={origem.ativo ? 'text-destructive hover:text-destructive' : 'text-status-ok hover:text-status-ok'}
                    >
                      {origem.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </>
                )}
              </div>
            ))}

            {/* Adicionar nova origem */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3 mt-4">
              <Input
                placeholder="Nome da nova origem..."
                value={novaOrigemNome}
                onChange={e => setNovaOrigemNome(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-md shrink-0"
                disabled={loading || !novaOrigemNome.trim()}
                onClick={handleAdicionarOrigem}
              >
                + Adicionar
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <SignatureUploadDialog
        open={signatureDialogOpen}
        onOpenChange={setSignatureDialogOpen}
        onSaved={() => router.refresh()}
      />

      <ExclusaoContaDialog
        open={exclusaoDialogOpen}
        onOpenChange={setExclusaoDialogOpen}
      />
    </Tabs>
  )
}
