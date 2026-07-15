/**
 * Traduz erros técnicos (Postgres / Supabase) em mensagens amigáveis para o
 * optometrista. O erro cru NUNCA deve chegar ao usuário final — mensagens como
 * "permission denied" ou "violates foreign key constraint" confundem e expõem
 * detalhes internos. Aqui logamos o original (para diagnóstico/Sentry) e
 * devolvemos um texto seguro e acionável.
 *
 * Uso nas server actions:
 *   if (error) return { error: mensagemErroAmigavel(error, 'salvar paciente') }
 *
 * Mensagens de NEGÓCIO (ex.: "Atendimento não encontrado") continuam sendo
 * strings literais no código — não passam por aqui.
 */

// Formato mínimo de um erro do Supabase/Postgrest (campos opcionais).
type ErroLike = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

// Mapeia códigos de erro do Postgres para mensagens amigáveis específicas.
// Referência: https://www.postgresql.org/docs/current/errcodes-appendix.html
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Não foi possível concluir: este registro está vinculado a outro.',
  '23514': 'Alguns dados não atendem às regras do sistema. Revise e tente novamente.',
  '23502': 'Há campos obrigatórios não preenchidos.',
  '22001': 'Algum campo ultrapassou o tamanho permitido.',
  '42501': 'Você não tem permissão para esta ação.',
}

const MENSAGEM_PADRAO =
  'Não foi possível concluir a operação. Tente novamente em instantes.'

/**
 * @param erro   objeto de erro do Supabase/Postgrest (ou qualquer unknown)
 * @param contexto rótulo curto para o log (ex.: 'finalizar atendimento')
 */
export function mensagemErroAmigavel(erro: unknown, contexto?: string): string {
  // Sempre registra o erro técnico completo para diagnóstico. Em produção o
  // Sentry captura console.error; localmente aparece no terminal do servidor.
  console.error(
    `[erro${contexto ? ` · ${contexto}` : ''}]`,
    erro,
  )

  const e = (erro ?? {}) as ErroLike
  if (e.code && MENSAGENS_POR_CODIGO[e.code]) {
    return MENSAGENS_POR_CODIGO[e.code]
  }
  return MENSAGEM_PADRAO
}
