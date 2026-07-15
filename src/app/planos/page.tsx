// /planos — rota legada (Fase 3 ASAAS).
//
// A página de planos foi absorvida pela LANDING na raiz "/" (seção de planos ao
// rolar). Esta rota vira um redirect permanente para "/" — assim links de /planos
// já compartilhados continuam funcionando, caindo na landing nova.

import { redirect } from 'next/navigation'

export default function PlanosPage() {
  redirect('/')
}
