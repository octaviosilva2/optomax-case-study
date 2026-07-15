/**
 * Teste de acessibilidade (a11y) com axe-core.
 *
 * Fase 8 — Scan inicial (modo descoberta).
 * Itera as rotas ativas de routes.ts e coleta violations WCAG AA.
 * Resultado salvo em tests/a11y/results.json.
 *
 * Execução:
 *   npx playwright test tests/a11y/scan.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, Route } from '../visual/routes';
import * as fs from 'fs';
import * as path from 'path';

// Filtra rotas ativas (sem skip)
const activeRoutes: Route[] = ROUTES.filter((r) => !r.skip);

// Estrutura para armazenar resultados
interface ViolationResult {
  route: string;
  path: string;
  violations: {
    id: string;
    impact: string | undefined;
    description: string;
    help: string;
    helpUrl: string;
    nodes: {
      html: string;
      target: string[];
      failureSummary: string | undefined;
    }[];
  }[];
}

const allResults: ViolationResult[] = [];

test.describe('A11y Scan — V2 Identidade Editorial', () => {
  // Roda sequencialmente para evitar race conditions no append
  test.describe.configure({ mode: 'serial' });

  for (const route of activeRoutes) {
    test(`a11y: ${route.name}`, async ({ page, context }) => {
      // Se requer auth, aplica storageState do global-setup
      if (route.auth) {
        const storagePath = path.join(__dirname, '..', '.auth', 'user.json');
        if (fs.existsSync(storagePath)) {
          const storageState = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
          await context.addCookies(storageState.cookies || []);
          // localStorage não pode ser setado diretamente antes de navegar,
          // então prosseguimos (session via cookies do Supabase)
        }
      }

      // Navega para a rota
      await page.goto(route.path, { waitUntil: 'networkidle' });

      // Aguarda um pouco para React hydration
      await page.waitForTimeout(500);

      // Roda axe-core com regras WCAG AA + best-practices
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .analyze();

      // Filtra apenas critical e serious
      const relevantViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      // Armazena resultado
      allResults.push({
        route: route.name,
        path: route.path,
        violations: relevantViolations.map((v) => ({
          id: v.id,
          // axe tipa impact como ImpactValue | null; normaliza null -> undefined
          // para casar com o tipo do acumulador (string | undefined) e não quebrar o build.
          impact: v.impact ?? undefined,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map((n) => ({
            html: n.html,
            target: n.target as string[],
            failureSummary: n.failureSummary,
          })),
        })),
      });

      // Teste passa sempre (modo descoberta) — apenas coleta violations
      // Comentar esta linha e descomentar a próxima para falhar em violations
      expect(true).toBe(true);
      // expect(relevantViolations.length, `${route.name} tem violations`).toBe(0);
    });
  }

  // Após todos os testes, salva results.json
  test.afterAll(async () => {
    const outputDir = path.join(__dirname);
    const outputPath = path.join(outputDir, 'results.json');

    // Estatísticas
    const totalCritical = allResults.reduce(
      (acc, r) => acc + r.violations.filter((v) => v.impact === 'critical').length,
      0
    );
    const totalSerious = allResults.reduce(
      (acc, r) => acc + r.violations.filter((v) => v.impact === 'serious').length,
      0
    );

    const summary = {
      date: new Date().toISOString(),
      branch: 'feat/identidade-editorial',
      totalRoutes: allResults.length,
      totalCritical,
      totalSerious,
      results: allResults,
    };

    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`\n[a11y] Resultados salvos em: ${outputPath}`);
    console.log(`[a11y] Total rotas: ${allResults.length}`);
    console.log(`[a11y] Violations critical: ${totalCritical}`);
    console.log(`[a11y] Violations serious: ${totalSerious}`);
  });
});
