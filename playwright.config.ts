import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para baseline visual do OptoClinic.
 *
 * IMPORTANTE: Não define webServer pois o dev server já roda externamente.
 * Usa storageState para sessão autenticada (gerada pelo global-setup).
 */
export default defineConfig({
  testDir: './tests/visual',

  // Timeout generoso — rotas com Supabase podem demorar
  timeout: 60_000,

  // Configuração de expect para screenshots
  expect: {
    toHaveScreenshot: {
      // 1% conforme plano da Fase 8 — absorve anti-aliasing/font rendering
      // sem perdoar mudanca real de cor.
      maxDiffPixelRatio: 0.01,
    },
  },

  // Execução
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: 'html',

  // Global setup para autenticação
  globalSetup: './tests/visual/global-setup.ts',

  // Configuração base
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  // Projetos: 3 viewports × 2 temas = 6 projetos
  projects: [
    // Desktop 1440×900
    {
      name: 'desktop-1440-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'light',
        storageState: 'tests/visual/.auth/user.json',
      },
    },
    {
      name: 'desktop-1440-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
        storageState: 'tests/visual/.auth/user.json',
      },
    },

    // Tablet 768×1024
    {
      name: 'tablet-768-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        colorScheme: 'light',
        storageState: 'tests/visual/.auth/user.json',
      },
    },
    {
      name: 'tablet-768-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        colorScheme: 'dark',
        storageState: 'tests/visual/.auth/user.json',
      },
    },

    // Mobile 375×812
    {
      name: 'mobile-375-light',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        colorScheme: 'light',
        storageState: 'tests/visual/.auth/user.json',
      },
    },
    {
      name: 'mobile-375-dark',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        colorScheme: 'dark',
        storageState: 'tests/visual/.auth/user.json',
      },
    },
  ],
});
