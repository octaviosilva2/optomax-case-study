import { redirect } from 'next/navigation'

// O wizard de onboarding foi aposentado: a coleta de dados virou o
// ModalCompletarPerfil, que abre no dashboard. Esta rota só existe para não
// quebrar links antigos (ex.: emails de confirmação) — redireciona ao painel.
export default function OnboardingPage() {
  redirect('/dashboard')
}
