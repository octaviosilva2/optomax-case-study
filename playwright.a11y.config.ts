import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes de acessibilidade (a11y).
 *
 * Fase 8 — Scan inicial com axe-core.
 * Separado do config visual para não interferir nos snapshots.
 */
export default defineConfig({
  testDir: './tests/a11y',

  // Timeout generoso — axe-core pode demorar em páginas grandes
  timeout: 60_000,

  // Execução serial para evitar race conditions no results.json
  fullyParallel: false,
  workers: 1,

  // Reporter simples para scan
  reporter: 'line',

  // Global setup para autenticação (mesmo do visual)
  globalSetup: './tests/visual/global-setup.ts',

  // Configuração base
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
  },

  // Projeto único: desktop com auth
  projects: [
    {
      name: 'a11y-scan',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        storageState: 'tests/visual/.auth/user.json',
      },
    },
  ],
});
