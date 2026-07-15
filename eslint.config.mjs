import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// eslint-plugin-tailwindcss removido: incompativel com Tailwind v4 (procura
// tailwind.config.js que nao existe em v4). A regra AST nativa abaixo
// (no-restricted-syntax) ja bloqueia cores hardcoded.

// Lista de cores da paleta default do Tailwind que devem ser bloqueadas
// Usar tokens semanticos em vez disso: text-destructive, bg-status-ok, etc.
const BLOCKED_COLOR_NAMES = [
  "blue",
  "slate",
  "gray",
  "zinc",
  "red",
  "green",
  "sky",
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "teal",
  "orange",
  "yellow",
  "purple",
  "pink",
  "violet",
  "lime",
  "fuchsia",
  "stone",
  "neutral",
];

// Regex para detectar classes Tailwind com cores hardcoded
// Formato: (prefixo-)?(text|bg|border|ring|fill|stroke)-(cor)-(intensidade)
const colorClassPattern = `(text|bg|border|ring|fill|stroke)-(${BLOCKED_COLOR_NAMES.join("|")})-[0-9]+`;

// Regex para detectar hex literais em classes Tailwind (arbitrary values)
// Formato: text-[#fff], bg-[#123456], etc.
const hexArbitraryPattern = "\\[#[0-9a-fA-F]{3,8}\\]";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignorar arquivos de design system (tokens sao definidos la)
    "src/app/globals.css",
    "src/app/tokens.css",
    // Ignorar PDFs (usam hex direto por limitacao do @react-pdf/renderer)
    "src/lib/pdf/TemplatePDF.tsx",
    "src/lib/pdf/TemplateFichaPDF.tsx",
    // Allowlist de hex (espelhamento de tokens para PDFs)
    "src/lib/pdf/pdf-colors.ts",
    // Definicao de paleta de avatar (nao e uso, e definicao)
    "src/lib/utils/avatar.ts",
    // Grafico de evolucao (hex em constantes de recharts, nao em className)
    "src/components/evolucao/GraficoEvolucao.tsx",
  ]),
  // Regras customizadas para bloquear cores hardcoded
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // Bloquear strings literais contendo classes de cor hardcoded
      // Detecta: className="text-blue-600", className={`bg-slate-100`}, etc.
      "no-restricted-syntax": [
        "error",
        {
          // Detecta strings literais em atributos JSX (className, class)
          selector: `JSXAttribute[name.name=/className|class/] Literal[value=/${colorClassPattern}/]`,
          message:
            "Cor hardcoded detectada. Use tokens semanticos: text-primary, bg-secondary, text-destructive, bg-status-ok, etc. Veja DESIGN.md para paleta completa.",
        },
        {
          // Detecta template literals em atributos JSX
          selector: `JSXAttribute[name.name=/className|class/] TemplateLiteral`,
          message:
            "Template literal em className pode conter cores hardcoded. Verifique se usa tokens semanticos.",
        },
        {
          // Detecta hex arbitrarios em className
          selector: `JSXAttribute[name.name=/className|class/] Literal[value=/${hexArbitraryPattern}/]`,
          message:
            "Hex literal em className detectado. Use tokens semanticos em vez de cores arbitrarias.",
        },
      ],
    },
  },
]);

export default eslintConfig;
