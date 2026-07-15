/**
 * Mapeamento de rotas do OptoClinic para baseline visual.
 *
 * Descoberto via src/app (Next.js App Router, arquivos page.tsx).
 * IDs de teste consultados no banco de producao via Supabase MCP.
 *
 * Categorizacao segue os blocos do design system:
 * - 01-auth: autenticacao e recuperacao de senha
 * - 02-editorial: paginas publicas (termos, privacidade, contato)
 * - 03-onboarding: fluxo de primeiro acesso
 * - 04-app: rotas autenticadas do core (dashboard, pacientes, agenda, etc.)
 * - 05-admin: painel administrativo interno
 * - 06-public: landing pages publicas com token (prescricao, ficha)
 */

// IDs de teste reais (consultados no banco 22/05/2026)
// Definidos como strings literais para evitar problemas de parsing
const TEST_PATIENT_ID: string = '9c39f28f-b22e-495b-afca-70d59bffa5ca';
const TEST_ORG_ID: string = 'a8753624-dde1-4b44-8849-cf891fa9c43c';
const TEST_CLINICAL_RECORD_ID: string = '1b120948-c55c-486d-bbde-63a5887d1df7';

// Paths pré-computados para rotas dinâmicas
const PATH_PACIENTE_DETALHE = '/pacientes/' + TEST_PATIENT_ID;
const PATH_ATENDIMENTO_DETALHE = '/atendimento/' + TEST_CLINICAL_RECORD_ID;
const PATH_ADMIN_ORG = '/admin/orgs/' + TEST_ORG_ID;
const PATH_ADMIN_ORG_PROFILE = '/admin/orgs/' + TEST_ORG_ID + '/profile';
const PATH_ADMIN_ORG_ATENDIMENTOS = '/admin/orgs/' + TEST_ORG_ID + '/atendimentos';
const PATH_ADMIN_ORG_RECEITAS = '/admin/orgs/' + TEST_ORG_ID + '/receitas';
const PATH_ADMIN_ORG_PACIENTES = '/admin/orgs/' + TEST_ORG_ID + '/pacientes';
const PATH_ADMIN_ORG_TIMELINE = '/admin/orgs/' + TEST_ORG_ID + '/timeline';
const PATH_ADMIN_ORG_NOTAS = '/admin/orgs/' + TEST_ORG_ID + '/notas';

export interface Route {
  /** Nome único para o snapshot (ex: '01-auth-login') */
  name: string;
  /** Path da rota (ex: '/login') */
  path: string;
  /** Se requer autenticação (usa storageState) */
  auth: boolean;
  /** Motivo para pular o teste (se definido, rota é skipped) */
  skip?: string;
}

export const ROUTES: Route[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // §01 AUTH — Autenticação e recuperação de senha
  // ─────────────────────────────────────────────────────────────────────────
  { name: '01-auth-login', path: '/login', auth: false },
  { name: '01-auth-check-email', path: '/login/check-email', auth: false },
  { name: '01-auth-recuperar-senha', path: '/recuperar-senha', auth: false },
  { name: '01-auth-atualizar-senha', path: '/atualizar-senha', auth: false },

  // ─────────────────────────────────────────────────────────────────────────
  // §02 EDITORIAL — Páginas públicas institucionais
  // ─────────────────────────────────────────────────────────────────────────
  // Landing removida em 23/05/2026: `/` é apenas redirect para /dashboard.
  // Quando houver landing de marketing real, readicionar com snapshot próprio.
  { name: '02-editorial-comece', path: '/comece', auth: false },
  { name: '02-editorial-em-breve', path: '/em-breve', auth: false },
  { name: '02-editorial-termos', path: '/termos', auth: false },
  { name: '02-editorial-privacidade', path: '/privacidade', auth: false },
  { name: '02-editorial-contato', path: '/contato', auth: false },
  { name: '02-editorial-conta-excluida', path: '/conta-excluida', auth: false },

  // ─────────────────────────────────────────────────────────────────────────
  // §03 ONBOARDING — Primeiro acesso
  // ─────────────────────────────────────────────────────────────────────────
  { name: '03-onboarding', path: '/onboarding', auth: true },

  // ─────────────────────────────────────────────────────────────────────────
  // §04 APP — Rotas autenticadas do core
  // ─────────────────────────────────────────────────────────────────────────
  { name: '04-app-dashboard', path: '/dashboard', auth: true },
  { name: '04-app-pacientes', path: '/pacientes', auth: true },
  {
    name: '04-app-paciente-detalhe',
    path: PATH_PACIENTE_DETALHE,
    auth: true,
  },
  { name: '04-app-agenda', path: '/agenda', auth: true },
  { name: '04-app-atendimento-lista', path: '/atendimento', auth: true },
  {
    name: '04-app-atendimento-detalhe',
    path: PATH_ATENDIMENTO_DETALHE,
    auth: true,
  },
  { name: '04-app-receitas', path: '/receitas', auth: true },
  { name: '04-app-configuracoes', path: '/configuracoes', auth: true },
  {
    name: '04-app-configuracoes-historico-aceites',
    path: '/configuracoes/historico-aceites',
    auth: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // §05 ADMIN — Painel administrativo interno
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: '05-admin-login',
    path: '/admin/login',
    auth: false,
  },
  {
    name: '05-admin-dashboard',
    path: '/admin',
    auth: false,
    skip: 'Requer autenticação admin separada (não cobre no baseline visual)',
  },
  {
    name: '05-admin-org-detalhe',
    path: PATH_ADMIN_ORG,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-profile',
    path: PATH_ADMIN_ORG_PROFILE,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-atendimentos',
    path: PATH_ADMIN_ORG_ATENDIMENTOS,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-receitas',
    path: PATH_ADMIN_ORG_RECEITAS,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-pacientes',
    path: PATH_ADMIN_ORG_PACIENTES,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-timeline',
    path: PATH_ADMIN_ORG_TIMELINE,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },
  {
    name: '05-admin-org-notas',
    path: PATH_ADMIN_ORG_NOTAS,
    auth: false,
    skip: 'Requer autenticação admin separada',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // §06 PUBLIC — Landing pages públicas com token HMAC
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: '06-public-prescricao',
    path: '/p/TOKEN_PLACEHOLDER',
    auth: false,
    skip: 'Token HMAC gerado dinamicamente pelo sistema — sem token de teste válido',
  },
  {
    name: '06-public-ficha',
    path: '/f/TOKEN_PLACEHOLDER',
    auth: false,
    skip: 'Token HMAC gerado dinamicamente pelo sistema — sem token de teste válido',
  },
];

// Contagem por bloco para relatório
export const ROUTE_COUNTS = {
  auth: ROUTES.filter((r) => r.name.startsWith('01-')).length,
  editorial: ROUTES.filter((r) => r.name.startsWith('02-')).length,
  onboarding: ROUTES.filter((r) => r.name.startsWith('03-')).length,
  app: ROUTES.filter((r) => r.name.startsWith('04-')).length,
  admin: ROUTES.filter((r) => r.name.startsWith('05-')).length,
  public: ROUTES.filter((r) => r.name.startsWith('06-')).length,
  total: ROUTES.length,
  skipped: ROUTES.filter((r) => r.skip).length,
  active: ROUTES.filter((r) => !r.skip).length,
};
