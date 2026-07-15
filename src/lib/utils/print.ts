// Helper de impressão de PDF gerado on-demand.
// Extraído do padrão já usado no menu ⋮ da lista de receitas (ReceitasView):
// abre a URL do PDF em nova aba e dispara a impressão do navegador quando o
// documento termina de carregar. Centralizado aqui para reuso nos cards de
// Ficha/Receita e na própria lista, sem duplicar a sequência window.open + print.
export function imprimirPdf(url: string): void {
  const win = window.open(url, '_blank')
  if (win) {
    win.onload = () => win.print()
  }
}
