/**
 * Script de captura de screenshots de TODAS as telas do OptoMax (prod).
 *
 * Cobre: 8 públicas + 3 estados especiais + 9 internas + 2 dinâmicas
 *        + 2 links públicos por token + 8 admin = ~32 rotas × 4 viewports
 *
 * Como rodar (a partir da raiz do projeto):
 *   npx tsx scripts/screenshot-all.ts
 *
 * Saída: screenshots/<viewport>/<rota>.png (fullpage)
 *
 * Variáveis necessárias em .env.local:
 *   TESTER_EMAIL, TESTER_PASSWORD       — conta normal do app
 *   ADMIN_PASSWORD                      — senha do painel /admin
 *   PRESCRICAO_PUBLIC_SECRET            — segredo HMAC pra gerar tokens /p/[token] e /f/[token]
 *   SCREENSHOT_BASE_URL                 — ex.: https://optomax.com.br
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'

// Carrega .env.local da raiz do projeto.
loadEnv({ path: '.env.local' })

// ---------- Configuração ----------

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'https://optomax.com.br'
const EMAIL = process.env.TESTER_EMAIL ?? ''
const PASSWORD = process.env.TESTER_PASSWORD ?? ''
const ADMIN_EMAIL = EMAIL // mesmo email da conta normal (confirmado pelo Octavio)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const HMAC_SECRET = process.env.PRESCRICAO_PUBLIC_SECRET ?? ''
const OUTPUT_DIR = 'screenshots'

// Viewports a capturar.
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '375x812', width: 375, height: 812 },
] as const

// Telas públicas (sem login).
const PUBLIC_ROUTES = [
  '/login',
  '/recuperar-senha',
  '/termos',
  '/privacidade',
  '/contato',
  '/em-breve',
  '/comece',
  '/conta-excluida',
] as const

// Estados especiais (acesso direto pode ou não funcionar — capturamos o que aparecer).
const SPECIAL_ROUTES = [
  // /login/check-email lê email do query — não precisa de cadastro real
  { label: '/login/check-email', url: '/login/check-email?email=teste@optomax.com.br' },
  // /atualizar-senha — sem token; provavelmente mostra estado vazio ou erro
  { label: '/atualizar-senha', url: '/atualizar-senha' },
  // /onboarding — só funciona se user não onboarded; com user onboarded provavelmente redireciona
  { label: '/onboarding', url: '/onboarding' },
] as const

// Telas internas estáticas (com login).
const PRIVATE_ROUTES = [
  '/dashboard',
  '/agenda',
  '/pacientes',
  '/atendimento',
  '/receitas',
  '/configuracoes',
  '/configuracoes/historico-aceites',
] as const

// Rotas do painel admin (após login admin). [ID] resolvido em runtime.
const ADMIN_ROUTES_ROOT = ['/admin'] as const
const ADMIN_ORG_SUBROUTES = [
  'profile',
  'pacientes',
  'atendimentos',
  'receitas',
  'timeline',
  'notas',
] as const

// ---------- Utilitários ----------

/** Converte rota em nome de arquivo. */
function routeToFilename(label: string): string {
  if (label === '/') return 'root'
  return label
    .replace(/^\//, '')
    .replace(/\//g, '__')
    .replace(/[\[\]]/g, '') // remove brackets de [id], [token]
    .replace(/\?.*$/, '') // remove querystring
}

/** Espera estabilizar (rede ociosa + buffer para animações). */
async function waitForStable(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(800)
}

/** Screenshot fullpage. */
async function snap(page: Page, viewportDir: string, label: string) {
  const file = join(OUTPUT_DIR, viewportDir, `${routeToFilename(label)}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`  ✓ ${file}`)
}

/** Base64URL helper (idêntico ao src/lib/auth/hmac-token.ts). */
function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Gera token HMAC equivalente ao do código de produção (gerarTokenInterno). */
async function gerarTokenPublico(
  tipo: 'prescricao' | 'ficha',
  id: string,
  validadeDias = 7,
): Promise<string> {
  if (!HMAC_SECRET || HMAC_SECRET.length < 32) {
    throw new Error('PRESCRICAO_PUBLIC_SECRET ausente ou curta')
  }
  const exp = Date.now() + validadeDias * 24 * 60 * 60 * 1000
  const enc = new TextEncoder()
  const payload = toBase64Url(enc.encode(JSON.stringify({ tipo, id, exp })))
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return `${payload}.${toBase64Url(sig)}`
}

/** Login do usuário normal. Espera o React hidratar antes do submit pra não cair em GET nativo. */
async function loginNormal(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  // Garante que o form React está montado e o JS reagiu.
  await page.waitForSelector('input#email', { state: 'visible' })
  await page.waitForTimeout(1500)
  await page.fill('input#email', EMAIL)
  await page.fill('input#password', PASSWORD)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login') && !url.pathname.startsWith('/recuperar'), {
      timeout: 45_000,
    }),
    page.click('button[type="submit"]'),
  ])
  await waitForStable(page)
}

/** Login do painel admin. Server action redireciona via 303 — depois validamos navegando direto pra /admin. */
async function loginAdmin(page: Page) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' })
  await page.waitForSelector('input#email', { state: 'visible' })
  await page.waitForTimeout(1500)
  await page.fill('input#email', ADMIN_EMAIL)
  await page.fill('input#password', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  // Aguarda submit do form + redirect server action (300ms-3s). Não usa waitForURL
  // porque server actions do Next disparam transições que o Playwright ocasionalmente perde.
  await page.waitForTimeout(3500)
  // Confirma sessão indo direto em /admin — se cookie foi setado, renderiza; senão, volta pra /admin/login.
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' })
  await waitForStable(page)
  if (page.url().includes('/admin/login')) {
    throw new Error('Login admin falhou — voltou pra /admin/login. Cheque ADMIN_EMAIL/ADMIN_PASSWORD.')
  }
}

// ---------- IDs fixos (obtidos do banco em 2026-05-20) ----------
//
// Em vez de criar paciente/atendimento via UI (frágil — botões mudam, hidratação
// inconsistente), reutilizamos registros reais já existentes em prod.
// IDs obtidos via Supabase MCP. Se algum for deletado, atualizar aqui.

const FIXED_IDS = {
  pacienteId: 'be784d6d-b0d5-4e41-9afc-f0017cf4e99a',
  recordId: 'e06f26a9-4174-4899-82fe-c4005d91a68e',
  prescricaoId: 'fccc4c8b-68f6-4c37-9146-2820c582a4c8',
  orgId: 'a8753624-dde1-4b44-8849-cf891fa9c43c',
} as const

// ---------- Captura por viewport ----------

async function captureForViewport(
  browser: Browser,
  vp: (typeof VIEWPORTS)[number],
  ids: {
    recordId: string
    pacienteId: string
    prescricaoId: string
    orgId: string
  },
) {
  const viewportDir = vp.name
  await mkdir(join(OUTPUT_DIR, viewportDir), { recursive: true })
  console.log(`\n=== Viewport ${vp.name} ===`)

  const context: BrowserContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  })
  const page = await context.newPage()

  // 1) Públicas — sem login.
  for (const route of PUBLIC_ROUTES) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, route)
    } catch (err) {
      console.error(`  ✗ ${route} → ${(err as Error).message}`)
    }
  }

  // 2) Estados especiais — sem login (capturar o que renderizar).
  for (const sp of SPECIAL_ROUTES) {
    try {
      await page.goto(`${BASE_URL}${sp.url}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, sp.label)
    } catch (err) {
      console.error(`  ✗ ${sp.label} → ${(err as Error).message}`)
    }
  }

  // 3) Login normal.
  try {
    await loginNormal(page)
  } catch (err) {
    console.error(`  ✗ Login falhou → ${(err as Error).message}`)
    await context.close()
    return
  }

  // 4) Privadas estáticas.
  for (const route of PRIVATE_ROUTES) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, route)
    } catch (err) {
      console.error(`  ✗ ${route} → ${(err as Error).message}`)
    }
  }

  // 5) Dinâmicas.
  if (ids.pacienteId) {
    try {
      await page.goto(`${BASE_URL}/pacientes/${ids.pacienteId}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, '/pacientes/[id]')
    } catch (err) {
      console.error(`  ✗ /pacientes/[id] → ${(err as Error).message}`)
    }
  }
  if (ids.recordId) {
    try {
      await page.goto(`${BASE_URL}/atendimento/${ids.recordId}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, '/atendimento/[id]')
    } catch (err) {
      console.error(`  ✗ /atendimento/[id] → ${(err as Error).message}`)
    }
  }

  // 6) Links públicos por token — gerados localmente via HMAC com o secret real de prod.
  if (ids.recordId && HMAC_SECRET) {
    try {
      const token = await gerarTokenPublico('ficha', ids.recordId)
      await page.goto(`${BASE_URL}/f/${token}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, '/f/[token]')
    } catch (err) {
      console.error(`  ✗ /f/[token] → ${(err as Error).message}`)
    }
  }
  if (ids.prescricaoId && HMAC_SECRET) {
    try {
      const token = await gerarTokenPublico('prescricao', ids.prescricaoId)
      await page.goto(`${BASE_URL}/p/${token}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(page)
      await snap(page, viewportDir, '/p/[token]')
    } catch (err) {
      console.error(`  ✗ /p/[token] → ${(err as Error).message}`)
    }
  }

  // 7) Admin — context separado pra não conflitar com cookie do user normal.
  const adminContext = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
  })
  const adminPage = await adminContext.newPage()
  try {
    // /admin/login — captura antes de logar.
    await adminPage.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' })
    await waitForStable(adminPage)
    await snap(adminPage, viewportDir, '/admin/login')

    // Logar
    await loginAdmin(adminPage)

    // /admin (lista de orgs)
    for (const route of ADMIN_ROUTES_ROOT) {
      await adminPage.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' })
      await waitForStable(adminPage)
      await snap(adminPage, viewportDir, route)
    }

    // /admin/orgs/[id]/{subroute}
    if (ids.orgId) {
      for (const sub of ADMIN_ORG_SUBROUTES) {
        try {
          await adminPage.goto(`${BASE_URL}/admin/orgs/${ids.orgId}/${sub}`, {
            waitUntil: 'domcontentloaded',
          })
          await waitForStable(adminPage)
          await snap(adminPage, viewportDir, `/admin/orgs/[id]/${sub}`)
        } catch (err) {
          console.error(`  ✗ /admin/orgs/[id]/${sub} → ${(err as Error).message}`)
        }
      }
    } else {
      console.log('  ⚠ Nenhuma org no admin — pulando subrotas /admin/orgs/[id]/*')
    }
  } catch (err) {
    console.error(`  ✗ Admin → ${(err as Error).message}`)
  } finally {
    await adminContext.close()
  }

  await context.close()
}

// ---------- Main ----------

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Faltam TESTER_EMAIL / TESTER_PASSWORD em .env.local')
    process.exit(1)
  }
  if (!ADMIN_PASSWORD) {
    console.error('Falta ADMIN_PASSWORD em .env.local (necessário pro painel admin)')
    process.exit(1)
  }
  if (!HMAC_SECRET) {
    console.warn('⚠ PRESCRICAO_PUBLIC_SECRET ausente — /f/[token] e /p/[token] serão pulados')
  }

  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Usuário:  ${EMAIL}`)

  const browser = await chromium.launch({ headless: true })

  console.log(`\nIDs fixos (do banco, obtidos via Supabase MCP):`)
  console.log(`  paciente:   ${FIXED_IDS.pacienteId}`)
  console.log(`  atendiment: ${FIXED_IDS.recordId}`)
  console.log(`  prescricao: ${FIXED_IDS.prescricaoId}`)
  console.log(`  org:        ${FIXED_IDS.orgId}`)

  try {
    for (const vp of VIEWPORTS) {
      await captureForViewport(browser, vp, FIXED_IDS)
    }
  } finally {
    await browser.close()
  }

  console.log('\n✅ Pronto. Veja a pasta screenshots/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
