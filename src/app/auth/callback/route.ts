import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handler do PKCE para links de confirmação de email enviados pelo Supabase.
// O Supabase envia `?code=pkce_...&next=/destino` — aqui trocamos o code por uma
// sessão (set-cookie) e redirecionamos para `next` (default `/`).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextRaw = searchParams.get('next') ?? '/'

  // F3-A02: valida `next` contra open redirect. So aceita paths internos:
  // - precisa comecar com '/'
  // - nao pode comecar com '//' (protocol-relative — browser segue pra outro host)
  // - nao pode comecar com '/\' (variantes de bypass em alguns parsers)
  const next = (
    nextRaw.startsWith('/') &&
    !nextRaw.startsWith('//') &&
    !nextRaw.startsWith('/\\')
  ) ? nextRaw : '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[/auth/callback] exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // Sucesso: sessão criada via cookies. Redireciona para o destino.
  // Sem `next` → vai para `/` → o layout (app)/onboarding decide o redirecionamento final.
  return NextResponse.redirect(`${origin}${next}`)
}
