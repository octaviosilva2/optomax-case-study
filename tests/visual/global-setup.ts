import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega variáveis de .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

/**
 * Global setup: autentica no app e salva storageState para os testes.
 *
 * Usa variáveis de ambiente TESTER_EMAIL e TESTER_PASSWORD (definidas em .env.local).
 */
async function globalSetup(config: FullConfig) {
  const email = process.env.TESTER_EMAIL;
  const password = process.env.TESTER_PASSWORD;

  // Valida variáveis de ambiente
  if (!email || !password) {
    throw new Error(
      'Variáveis de ambiente TESTER_EMAIL e TESTER_PASSWORD são obrigatórias.\n' +
        'Defina em .env.local (já está no .gitignore).'
    );
  }

  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  console.log('[global-setup] Iniciando autenticação...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navega para login
    await page.goto(`${baseURL}/login`);

    // Preenche formulário de login
    // (baseado na estrutura padrão do Supabase Auth UI ou form customizado)
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    // Submete o formulário
    await page.click('button[type="submit"]');

    // Espera redirect para rota autenticada (dashboard ou similar)
    // Timeout de 30s para dar tempo do Supabase processar
    await page.waitForURL('**/dashboard', { timeout: 30_000 });

    console.log('[global-setup] Login bem-sucedido. Salvando storageState...');

    // Salva estado de autenticação
    await context.storageState({ path: 'tests/visual/.auth/user.json' });

    console.log('[global-setup] storageState salvo em tests/visual/.auth/user.json');
  } catch (error) {
    console.error('[global-setup] Falha no login:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
