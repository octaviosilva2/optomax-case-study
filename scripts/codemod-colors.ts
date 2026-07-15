#!/usr/bin/env npx tsx
/**
 * codemod-colors.ts — Substituicao massiva de cores hardcoded por tokens semanticos
 *
 * Fase 4 do PLANO-IMPLEMENTACAO-OPTOMAX.md
 *
 * Uso:
 *   npx tsx scripts/codemod-colors.ts --dry-run    # mostra diff sem aplicar
 *   npx tsx scripts/codemod-colors.ts --write      # aplica mudancas
 *
 * Exclui:
 *   - .next/, node_modules/, tests/, screenshots/, scripts/
 *   - globals.css, tokens.css (definicoes centrais)
 *   - avatar.ts (definicao de paleta, nao uso)
 *   - pdf-colors.ts (allowlist de hex)
 */

import { Project, SyntaxKind, Node, StringLiteral, NoSubstitutionTemplateLiteral, TemplateHead, TemplateMiddle, TemplateTail } from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'

// ============================================================================
// MAPEAMENTO DE CLASSES TAILWIND
// ============================================================================

// Cores destrutivas (vermelho)
// CORRECAO: bg-*-50/100 mapeiam para bg-destructive-bg (cor clara fixa), NAO para bg-destructive/10 (cor escura com opacidade)
const DESTRUCTIVE_MAPPINGS: Record<string, string> = {
  'text-red-500': 'text-destructive',
  'text-red-600': 'text-destructive',
  'text-red-700': 'text-destructive',
  'text-red-800': 'text-destructive',
  'text-rose-600': 'text-destructive',
  // Backgrounds claros -> token de background claro (cor fixa)
  'bg-red-50': 'bg-destructive-bg',
  'bg-red-100': 'bg-destructive-bg',
  'bg-rose-50': 'bg-destructive-bg',
  // Backgrounds escuros (cor base)
  'bg-red-600': 'bg-destructive',
  'bg-red-700': 'bg-destructive',
  'border-red-200': 'border-destructive/30',
  'border-red-300': 'border-destructive/40',
  'border-red-400': 'border-destructive',
  'border-red-500': 'border-destructive',
  'ring-red-400': 'ring-destructive',
  'ring-red-500': 'ring-destructive',
  // Modifiers
  'hover:bg-red-50': 'hover:bg-destructive-bg',
  'hover:bg-red-700': 'hover:bg-destructive/90',
  'hover:bg-rose-50': 'hover:bg-destructive-bg',
  'hover:text-red-600': 'hover:text-destructive',
  'hover:text-red-700': 'hover:text-destructive',
  'focus:text-red-600': 'focus:text-destructive',
  'focus-visible:ring-red-500': 'focus-visible:ring-destructive',
  // Dark mode variants
  'dark:hover:bg-rose-950/50': 'dark:hover:bg-destructive-bg',
}

// Status OK (verde/emerald)
// CORRECAO: bg-*-50/100 mapeiam para bg-status-ok-bg (cor clara fixa), NAO para bg-status-ok/10
const STATUS_OK_MAPPINGS: Record<string, string> = {
  'text-emerald-500': 'text-status-ok',
  'text-emerald-600': 'text-status-ok',
  'text-emerald-700': 'text-status-ok',
  'text-green-600': 'text-status-ok',
  'text-green-700': 'text-status-ok',
  // Backgrounds claros -> token de background claro (cor fixa)
  'bg-emerald-50': 'bg-status-ok-bg',
  'bg-emerald-100': 'bg-status-ok-bg',
  'bg-green-50': 'bg-status-ok-bg',
  'bg-green-50/10': 'bg-status-ok-bg',
  // Backgrounds com opacidade aplicada na cor ja escura (mantem opacidade)
  'bg-emerald-500': 'bg-status-ok',
  'bg-emerald-500/10': 'bg-status-ok/10',
  'bg-emerald-500/20': 'bg-status-ok/20',
  'border-emerald-200': 'border-status-ok/30',
  'border-emerald-300': 'border-status-ok/40',
  'border-green-200': 'border-status-ok/30',
  'border-green-300': 'border-status-ok/40',
  // Modifiers
  'hover:bg-green-50': 'hover:bg-status-ok-bg',
  'hover:text-green-700': 'hover:text-status-ok',
  'hover:border-green-300': 'hover:border-status-ok',
  // Dark mode variants
  'dark:bg-emerald-950': 'dark:bg-status-ok-bg',
  'dark:text-emerald-400': 'dark:text-status-ok',
}

// Status Warning (amber/orange)
// CORRECAO: bg-*-50/100 mapeiam para bg-status-warning-bg (cor clara fixa), NAO para bg-status-warning/10
const STATUS_WARNING_MAPPINGS: Record<string, string> = {
  'text-amber-600': 'text-status-warning',
  'text-amber-700': 'text-status-warning',
  'text-amber-800': 'text-status-warning',
  'text-amber-900': 'text-status-warning',
  'text-orange-500': 'text-status-warning',
  'text-orange-600': 'text-status-warning',
  // Backgrounds claros -> token de background claro (cor fixa)
  'bg-amber-50': 'bg-status-warning-bg',
  'bg-amber-100': 'bg-status-warning-bg',
  'bg-orange-50': 'bg-status-warning-bg',
  // Backgrounds com opacidade aplicada na cor ja escura (mantem opacidade)
  'bg-amber-500': 'bg-status-warning',
  'bg-amber-500/10': 'bg-status-warning/10',
  'border-amber-200': 'border-status-warning/30',
  'border-amber-300': 'border-status-warning/40',
  'border-amber-500/15': 'border-status-warning/30',
  'border-orange-200': 'border-status-warning/30',
  // Modifiers
  'hover:bg-amber-100': 'hover:bg-status-warning-bg',
  // Dark mode variants
  'dark:bg-amber-950/30': 'dark:bg-status-warning-bg',
  'dark:bg-amber-950/20': 'dark:bg-status-warning-bg',
  'dark:bg-amber-950/60': 'dark:bg-status-warning-bg',
  'dark:text-amber-200': 'dark:text-status-warning',
  'dark:text-amber-100': 'dark:text-status-warning',
  'dark:text-amber-400': 'dark:text-status-warning',
  'dark:border-amber-900': 'dark:border-status-warning/40',
  'dark:border-amber-900/40': 'dark:border-status-warning/30',
  'dark:border-amber-800/50': 'dark:border-status-warning/30',
  'dark:border-amber-700/50': 'dark:border-status-warning/30',
  'dark:hover:bg-amber-900/40': 'dark:hover:bg-status-warning-bg',
}

// Status Info (sky/blue para info)
const STATUS_INFO_MAPPINGS: Record<string, string> = {
  'text-sky-700': 'text-status-info',
  'text-sky-300': 'text-status-info',
  'bg-sky-500/10': 'bg-status-info/10',
  'bg-sky-500/20': 'bg-status-info/20',
  'text-blue-700': 'text-status-info',
  'text-blue-300': 'text-status-info',
  'bg-blue-500/10': 'bg-status-info/10',
  'bg-blue-500/20': 'bg-status-info/20',
}

// Status Critical (vermelho para indicador de hora, etc.)
// Separado de destructive pra contextos especificos
const STATUS_CRITICAL_MAPPINGS: Record<string, string> = {
  // bg-red-500 usado em IndicadorHoraAtual para linha de hora atual
  'bg-red-500': 'bg-status-critical',
  'bg-red-400': 'bg-status-critical/80',
}

// Neutros (slate -> muted/secondary/border)
// NOTA: bg-slate-500/10 e bg-slate-500/20 sao cinzas COM opacidade — uso decorativo (hover/selecao)
// Esses NAO existem no codebase atual (verificado no dryrun log), entao removidos do mapping.
// Se aparecerem no futuro, criar tokens especificos ou manter hardcoded com excecao ESLint por arquivo.
const NEUTRAL_MAPPINGS: Record<string, string> = {
  // Textos slate -> muted-foreground
  'text-slate-400': 'text-muted-foreground',
  'text-slate-500': 'text-muted-foreground',
  'text-slate-700': 'text-muted-foreground',
  'text-slate-300': 'text-muted-foreground', // dark mode
  // Backgrounds slate -> muted/secondary
  'bg-slate-50': 'bg-muted',
  'bg-slate-100': 'bg-secondary',
  'bg-slate-400': 'bg-muted-foreground',
  // Borders slate -> border
  'border-slate-200': 'border-border',
  'border-slate-300': 'border-border',
}

// Status de agenda (cores decorativas que mapeiam para tokens de agenda)
// Conforme decisao do Octavio: retorno->status-ok, exame->status-warning, padrao->primary
const AGENDA_MAPPINGS: Record<string, string> = {
  // Cores usadas em AgendaHoje.tsx para tipo de consulta
  // 'bg-emerald-500' para retorno -> mapeado em STATUS_OK
  // 'bg-amber-500' para exame -> mapeado em STATUS_WARNING
  // 'bg-blue-500' para padrao permanece como mapeamento especial
  'bg-blue-500': 'bg-primary',
}

// Consolidar todos os mapeamentos
const CLASS_MAPPINGS: Record<string, string> = {
  ...DESTRUCTIVE_MAPPINGS,
  ...STATUS_OK_MAPPINGS,
  ...STATUS_WARNING_MAPPINGS,
  ...STATUS_INFO_MAPPINGS,
  ...STATUS_CRITICAL_MAPPINGS,
  ...NEUTRAL_MAPPINGS,
  ...AGENDA_MAPPINGS,
}

// ============================================================================
// ARQUIVOS EXCLUIDOS
// ============================================================================

const EXCLUDED_FILES = [
  'globals.css',
  'tokens.css',
  'avatar.ts',           // definicao de paleta (nao codemod)
  'pdf-colors.ts',       // allowlist de hex
  'GraficoEvolucao.tsx', // hex em constantes de recharts (nao className)
]

const EXCLUDED_DIRS = [
  '.next',
  'node_modules',
  'tests',
  'screenshots',
  'scripts',
]

// ============================================================================
// LOGICA DE SUBSTITUICAO
// ============================================================================

interface Replacement {
  file: string
  line: number
  column: number
  before: string
  after: string
}

function shouldSkipFile(filePath: string): boolean {
  const fileName = path.basename(filePath)
  if (EXCLUDED_FILES.includes(fileName)) return true

  const normalizedPath = filePath.replace(/\\/g, '/')
  for (const dir of EXCLUDED_DIRS) {
    if (normalizedPath.includes(`/${dir}/`)) return true
  }

  return false
}

function replaceClasses(text: string): { result: string; replaced: boolean } {
  let result = text
  let replaced = false

  // Substituir cada classe mapeada
  for (const [from, to] of Object.entries(CLASS_MAPPINGS)) {
    // Regex que detecta a classe como palavra completa (nao parte de outra classe)
    // Precisa de boundary: espaco, aspas, backtick, ou inicio/fim de string
    const regex = new RegExp(`(^|\\s|"|'|\`)${escapeRegex(from)}($|\\s|"|'|\`)`, 'g')
    const newResult = result.replace(regex, `$1${to}$2`)
    if (newResult !== result) {
      replaced = true
      result = newResult
    }
  }

  return { result, replaced }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// PROCESSAMENTO DE ARQUIVOS
// ============================================================================

function processProject(write: boolean): Replacement[] {
  const projectPath = path.resolve(__dirname, '..')
  const project = new Project({
    tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
  })

  // Adicionar arquivos src/**/*.{ts,tsx}
  project.addSourceFilesAtPaths(path.join(projectPath, 'src/**/*.{ts,tsx}'))

  const replacements: Replacement[] = []
  const sourceFiles = project.getSourceFiles()

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath()

    if (shouldSkipFile(filePath)) {
      continue
    }

    let fileModified = false

    // Processar todas as string literals
    sourceFile.forEachDescendant((node) => {
      // String literals simples
      if (Node.isStringLiteral(node)) {
        const text = node.getLiteralText()
        const { result, replaced } = replaceClasses(text)

        if (replaced) {
          const lineInfo = sourceFile.getLineAndColumnAtPos(node.getStart())
          replacements.push({
            file: path.relative(projectPath, filePath),
            line: lineInfo.line,
            column: lineInfo.column,
            before: text,
            after: result,
          })

          if (write) {
            node.setLiteralValue(result)
            fileModified = true
          }
        }
      }

      // Template literals (NoSubstitutionTemplateLiteral)
      if (Node.isNoSubstitutionTemplateLiteral(node)) {
        const text = node.getLiteralText()
        const { result, replaced } = replaceClasses(text)

        if (replaced) {
          const lineInfo = sourceFile.getLineAndColumnAtPos(node.getStart())
          replacements.push({
            file: path.relative(projectPath, filePath),
            line: lineInfo.line,
            column: lineInfo.column,
            before: text,
            after: result,
          })

          if (write) {
            node.setLiteralValue(result)
            fileModified = true
          }
        }
      }

      // Template head/middle/tail (partes de template literals com interpolacao)
      if (Node.isTemplateHead(node) || Node.isTemplateMiddle(node) || Node.isTemplateTail(node)) {
        const text = node.getLiteralText()
        const { result, replaced } = replaceClasses(text)

        if (replaced) {
          const lineInfo = sourceFile.getLineAndColumnAtPos(node.getStart())
          replacements.push({
            file: path.relative(projectPath, filePath),
            line: lineInfo.line,
            column: lineInfo.column,
            before: text,
            after: result,
          })

          if (write) {
            node.setLiteralValue(result)
            fileModified = true
          }
        }
      }
    })

    if (fileModified) {
      sourceFile.saveSync()
    }
  }

  return replacements
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  const dryRun = args.includes('--dry-run') || !write

  console.log('=== Codemod: Substituicao de cores hardcoded ===')
  console.log(`Modo: ${write ? 'WRITE (aplicando mudancas)' : 'DRY-RUN (apenas mostrando)'}`)
  console.log('')

  const replacements = processProject(write)

  if (replacements.length === 0) {
    console.log('Nenhuma substituicao necessaria.')
    return
  }

  // Agrupar por arquivo
  const byFile = new Map<string, Replacement[]>()
  for (const r of replacements) {
    if (!byFile.has(r.file)) {
      byFile.set(r.file, [])
    }
    byFile.get(r.file)!.push(r)
  }

  // Imprimir diff
  console.log(`Total de substituicoes: ${replacements.length}`)
  console.log(`Arquivos afetados: ${byFile.size}`)
  console.log('')

  for (const [file, reps] of byFile) {
    console.log(`--- ${file} (${reps.length} mudancas) ---`)
    for (const r of reps) {
      console.log(`  L${r.line}:${r.column}`)
      console.log(`    - ${r.before}`)
      console.log(`    + ${r.after}`)
    }
    console.log('')
  }

  if (dryRun) {
    console.log('=== DRY-RUN: Nenhuma mudanca aplicada ===')
    console.log('Execute com --write para aplicar as substituicoes.')
  } else {
    console.log('=== WRITE: Mudancas aplicadas com sucesso ===')
  }
}

main()
