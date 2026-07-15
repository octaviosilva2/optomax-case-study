import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Sentry tunnel (tunnelRoute: '/monitoring' no next.config). Esses POSTs de
  // telemetria NÃO podem passar pela lógica de auth: quando não há sessão, o
  // bloco `!user && !isPublicRoute` redirecionava o POST para /login mantendo a
  // query (?o=…&r=us), e o browser registrava 405 no console. Deixa passar.
  if (request.nextUrl.pathname.startsWith('/monitoring')) {
    return NextResponse.next({ request })
  }

  // Webhooks externos (ASAAS) chegam como POST SEM sessão. Não podem passar pela
  // lógica de auth/redirect abaixo: sem `user`, cairiam no redirect 307 → /login
  // e o provedor nunca veria o 401/200 da própria route handler (que valida o
  // header asaas-access-token). Mesmo molde do bypass do tunnel Sentry acima.
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next({ request })
  }

  // Jobs agendados (Vercel Cron) chamam /api/cron/* como POST SEM sessão. Mesmo
  // motivo do webhook: sem `user` cairiam no redirect /login e a route handler
  // (que valida o header Authorization: Bearer CRON_SECRET) nunca responderia.
  if (request.nextUrl.pathname.startsWith('/api/cron/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Roteamento por host: no subdomínio admin.* a RAIZ "/" serve o back-office
  // sem o usuário precisar digitar "/admin". Usamos REWRITE (a URL na barra
  // continua limpa, "admin.optomax.com.br/") — o conteúdo é o de "/admin".
  // Só ativa no host real admin.*; nos demais hosts (apex/www/app, previews,
  // localhost) nada muda. O "/admin" segue protegido pela lógica de auth abaixo,
  // pois usamos `effectivePath` (já reescrito) nas decisões de rota.
  const host = request.headers.get('host') ?? ''
  const isAdminHost = host.startsWith('admin.')
  const effectivePath = isAdminHost && pathname === '/' ? '/admin' : pathname

  // Entrega final que respeita o rewrite do host admin, preservando os cookies
  // de sessão rotacionados pelo getUser() acima.
  const serve = () => {
    if (effectivePath === pathname) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = effectivePath
    const rewriteResponse = NextResponse.rewrite(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie)
    })
    return rewriteResponse
  }

  // /auth/callback é o route handler que troca o code PKCE (do email de recovery
  // OU de confirmação de cadastro) por sessão. Ele chega SEM sessão e faz a troca
  // ele mesmo, então precisa passar SEMPRE — logado ou não:
  // - Deslogado: NÃO pode cair em /login, senão o code é descartado no redirect e
  //   o fluxo de recuperação/confirmação nunca completa.
  // - Logado (outra aba): NÃO pode cair em /dashboard antes de processar o code.
  // Tratado antes dos blocos de redirect, no mesmo molde do /atualizar-senha abaixo.
  if (pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // /atualizar-senha precisa SEMPRE passar, qualquer que seja o estado de sessão.
  // É o destino final do fluxo de recovery: o link do email vai para /auth/callback
  // (que troca o code por sessão de recovery e grava os cookies) e de lá cai aqui.
  // - Logado (recovery / outra aba): NÃO pode cair em /dashboard antes de trocar a senha.
  // - Sem sessão (link expirado/já usado): a própria página mostra a tela de erro,
  //   então NÃO pode cair em /login. Por isso tratamos antes dos blocos de redirect.
  if (pathname.startsWith('/atualizar-senha')) {
    return supabaseResponse
  }

  // Rotas públicas (acessíveis sem sessão). A LANDING mora na raiz "/" (Fase 3),
  // por isso ela é match EXATO — colocar "/" no startsWith tornaria tudo público.
  // /cadastro é a rota dedicada de cadastro (a landing leva pra lá); /planos antiga
  // virou redirect para "/" mas segue pública para não cair no /login no caminho.
  const publicPrefixes = ['/login', '/cadastro', '/recuperar-senha', '/planos']
  // Usa effectivePath: no host admin a raiz já virou "/admin" (protegida), então
  // não é tratada como pública.
  const isPublicRoute =
    effectivePath === '/' || publicPrefixes.some((route) => effectivePath.startsWith(route))

  // Cria um redirect copiando os cookies que o Supabase setou em supabaseResponse.
  // CRÍTICO: sem copiar os Set-Cookie, o cookie de sessão rotacionado pelo
  // getUser() é descartado — browser e servidor ficam dessincronizados e a
  // navegação entra em loop de redirect (ERR_TOO_MANY_REDIRECTS).
  // `next` (opcional) vira ?next na URL de destino — o deep-link do funil.
  const redirectTo = (toPath: string, next?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = toPath
    url.search = '' // descarta a query atual; só repõe o ?next quando aplicável
    if (next) url.searchParams.set('next', next)
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  if (!user && !isPublicRoute) {
    // Deslogado tentando uma rota protegida: manda pro /login preservando o
    // destino (ex.: link de /assinar enviado no WhatsApp) para voltar pra cá
    // depois de entrar. O /login valida o ?next como rota interna.
    // Usa effectivePath: na raiz do host admin, o destino é "/admin".
    return redirectTo('/login', effectivePath + request.nextUrl.search)
  }

  // IMPORTANTE: só redirecionamos NAVEGAÇÃO de página (GET). Server Actions
  // chegam como POST para a própria rota pública (ex.: recordTermsConsent no
  // /login durante o signup). Se o middleware responder com um redirect 3xx,
  // o client da action recebe "An unexpected response was received" (405) e o
  // fluxo trava. Isso passou a ocorrer quando o signUp começou a devolver
  // sessão imediata (confirmação de email desligada): o usuário já está
  // autenticado quando a action POST chega aqui.
  if (user && isPublicRoute && request.method === 'GET') {
    return redirectTo('/dashboard')
  }

  return serve()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
