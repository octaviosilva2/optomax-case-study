import { createClient } from '@/lib/supabase/server'
import { assertReadableOrg } from '@/lib/auth-guards'

// Escapa um valor para CSV:
// - Neutraliza CSV injection (fórmulas que começam com =, +, -, @, \t, \r)
// - Envolve em aspas se contiver vírgula, aspas ou quebra de linha
function escaparCSV(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return ''
  let str = String(valor)

  // Neutraliza CSV injection — prefixa com ' se começar com caractere perigoso
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str
  }

  // Escapa aspas e envolve em aspas se necessário
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// Formata data de nascimento (YYYY-MM-DD sem timezone) para dd/MM/yyyy.
// Usa UTC para preservar o dia "calendário" armazenado no banco.
function formatarDataNasc(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const ano = d.getUTCFullYear()
  return `${dia}/${mes}/${ano}`
}

// Formata timestamp para dd/MM/yyyy em horário de Brasília.
function formatarDataBR(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export async function GET() {
  const supabase = await createClient()

  // Auth + profile + org com permissão de LEITURA. Usa o guard de leitura
  // (não o de mutação): no paywall, uma org 'expired' (read-only) continua
  // podendo exportar os próprios dados — direito de portabilidade (LGPD).
  const ctx = await assertReadableOrg(supabase)
  if (!ctx.ok) {
    return new Response(ctx.message, { status: ctx.status })
  }

  // RLS já filtra por org, mas eq explícito é defesa em profundidade
  const { data: pacientes, error } = await supabase
    .from('patients')
    .select(`
      nome, cpf, data_nascimento, whatsapp, email, endereco, sexo_biologico,
      observacoes, origem_id, created_at,
      origens_paciente ( nome )
    `)
    .eq('org_id', ctx.orgId)
    .is('deleted_at', null)
    .order('nome', { ascending: true })

  if (error) {
    console.error('[exportar CSV] Erro na query:', error.message)
    return new Response('Erro ao gerar exportação', { status: 500 })
  }

  // Cabeçalho na ordem: Nome Completo, CPF, Data Nascimento, WhatsApp, Email, Endereço, Sexo biológico, Origem, Observações, Criado em
  const cabecalho = [
    'Nome Completo',
    'CPF',
    'Data Nascimento',
    'WhatsApp',
    'Email',
    'Endereço',
    'Sexo biológico',
    'Origem',
    'Observações',
    'Criado em',
  ].join(',')

  // Gera as linhas na mesma ordem do cabeçalho
  const linhas = (pacientes ?? []).map((p) => {
    const origem = (p.origens_paciente as unknown as { nome: string } | null)?.nome ?? ''
    const sexo = p.sexo_biologico === 'M' ? 'Masculino' : p.sexo_biologico === 'F' ? 'Feminino' : ''
    return [
      escaparCSV(p.nome),
      escaparCSV(p.cpf),
      escaparCSV(formatarDataNasc(p.data_nascimento)),
      escaparCSV(p.whatsapp),
      escaparCSV(p.email),
      escaparCSV(p.endereco),
      escaparCSV(sexo),
      escaparCSV(origem),
      escaparCSV(p.observacoes),
      escaparCSV(formatarDataBR(p.created_at)),
    ].join(',')
  })

  // BOM UTF-8 para compatibilidade com Excel (acentos corretos)
  const bom = '\uFEFF'
  const csv = bom + cabecalho + '\n' + linhas.join('\n')

  // Nome do arquivo com data de hoje em horário Brasília (não UTC)
  const dataHoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pacientes_${dataHoje}.csv"`,
    },
  })
}
