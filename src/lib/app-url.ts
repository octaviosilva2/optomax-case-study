// URL canônica do app — usar em redirects e emails para evitar capturar www.
// Em produção sempre o env (NEXT_PUBLIC_APP_URL); em dev fallback para window.location.origin
// quando disponível; senão localhost.
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
