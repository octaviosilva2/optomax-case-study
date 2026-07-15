import { cookies } from 'next/headers'
import AgendaView from './AgendaView'
import { requireSession } from '@/lib/auth/session'

export default async function AgendaPage() {
  const { profile } = await requireSession()

  // Visão (dia/semana) persistida em cookie — lida no server pra renderizar já
  // na visão certa, sem salto no primeiro paint. Default: semana.
  const cookieStore = await cookies()
  const visaoInicial = cookieStore.get('agenda_view')?.value === 'dia' ? 'dia' : 'semana'

  return <AgendaView orgId={profile.org_id} visaoInicial={visaoInicial} />
}
