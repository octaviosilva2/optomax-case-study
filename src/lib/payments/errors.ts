// Erro da camada de pagamentos.
//
// Encapsula falhas de comunicação com o provedor (ASAAS) sem vazar segredo,
// stack ou corpo cru da resposta para o cliente. O `code`/`detail` ficam só
// para log server-side; a UI recebe uma mensagem genérica e segura.

export class PaymentProviderError extends Error {
  /** Código curto para o log (ex. 'ASAAS_HTTP_400', 'ASAAS_NETWORK'). */
  readonly code: string
  /** Status HTTP do provedor, quando houver. */
  readonly httpStatus?: number
  /** Detalhe técnico (NUNCA exibir ao usuário — só log/Sentry). */
  readonly detail?: unknown

  constructor(
    code: string,
    message: string,
    opts?: { httpStatus?: number; detail?: unknown },
  ) {
    super(message)
    this.name = 'PaymentProviderError'
    this.code = code
    this.httpStatus = opts?.httpStatus
    this.detail = opts?.detail
  }
}

// Mensagem amigável e estável devolvida à UI quando o checkout falha. O motivo
// real fica no log (PaymentProviderError.detail), nunca na tela.
export const MENSAGEM_FALHA_PAGAMENTO =
  'Não foi possível iniciar o pagamento agora. Tente novamente em instantes.'
