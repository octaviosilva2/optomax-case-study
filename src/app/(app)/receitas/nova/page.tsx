import { NovaReceitaView } from './NovaReceitaView'

export const metadata = {
  title: 'Nova receita | OptoMax',
}

/**
 * Página de entrada da receita avulsa (CA19): substitui o modal de criação —
 * escolhe/cria o paciente e cria o rascunho, sem expor o formulário de grau
 * ainda (isso é `/receitas/[id]/editar`). Vinculada a agendamento (Adiantar/
 * Agendar) continua pelo fluxo existente (nasce finalizada, fora deste bloco).
 */
export default function NovaReceitaPage() {
  return <NovaReceitaView />
}
