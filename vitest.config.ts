// Config do Vitest — runner de testes unitários/integração leve.
// O projeto usa Playwright para E2E; o Vitest cobre lógica de servidor pura
// (route handlers, libs) mockando as bordas externas (Supabase, ASAAS).
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // Espelha o alias do tsconfig (@/* -> ./src/*) para o Vitest resolver imports.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node', // route handlers rodam em Node (sem DOM)
    include: ['tests/**/*.test.ts'],
  },
})
