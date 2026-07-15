// Helpers puros de formatação de link/mensagem de WhatsApp usados pelos cards de
// Ficha e Receita (pós-finalização e, futuramente, na tela de receita dedicada).
// Extraídos de CardsPosFinalizacao para não duplicar a lógica entre os dois
// cards agora que eles viraram componentes independentes. Comportamento idêntico
// ao original — só realocação.

// Máscara WhatsApp: (XX) XXXXX-XXXX — limita a 11 dígitos e formata visualmente.
export function mascaraWhatsApp(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

// Normaliza um número (paciente ou ótica) para o formato exigido pelo wa.me:
// se já vier com DDI (12+ dígitos), usa como está; senão prefixa 55.
export function normalizarNumero(input: string): string | null {
  const digitos = input.replace(/\D/g, '')
  if (!digitos) return null
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

// Monta a mensagem do WhatsApp com link público + data de expiração.
// Etapa 13 #39 (13/05/2026): paciente recebe lembrete explícito de que o link
// só funciona por 7 dias — reduz suporte ("o link parou de funcionar") e cria
// pressão para abrir cedo.
export function formatarMensagemComExpiracao(
  intro: string,
  linkPdf: string,
  expiraEm: Date,
): string {
  const dataFmt = expiraEm.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return `${intro}\n${linkPdf}\n\nEste link expira em 7 dias (até ${dataFmt}).`
}
