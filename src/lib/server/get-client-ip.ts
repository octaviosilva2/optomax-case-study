import { headers } from 'next/headers'

// Captura o IP do cliente a partir dos headers de proxy (Vercel/CloudFlare).
// Usado para registrar o aceite eletrônico dos Termos durante o signup,
// conforme exigência LGPD e §3.2 dos Termos de Uso v1.0.
export async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip')
}
