// Redireciona /admin/orgs/[id] → /admin/orgs/[id]/gestao (tab default = controle).
import { redirect } from 'next/navigation'

export default async function AdminOrgIndexPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/orgs/${id}/gestao`)
}
