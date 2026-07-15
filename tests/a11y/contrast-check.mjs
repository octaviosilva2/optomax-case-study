/**
 * Script para calcular ratios de contraste WCAG AA dos tokens V2.
 *
 * Converte oklch para sRGB e calcula luminância relativa.
 * Execução: node tests/a11y/contrast-check.mjs
 */

// Função para converter oklch para sRGB linear
// Baseado em CSS Color Level 4 spec
function oklchToSrgb(l, c, h) {
  // oklch → oklab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // oklab → linear sRGB (via LMS)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lCube = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const sCube = s_ * s_ * s_;

  const rLinear = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const gLinear = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const bLinear = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube;

  // linear sRGB → sRGB (gamma correction)
  const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  return [
    Math.max(0, Math.min(1, toGamma(rLinear))),
    Math.max(0, Math.min(1, toGamma(gLinear))),
    Math.max(0, Math.min(1, toGamma(bLinear))),
  ];
}

// Luminância relativa (WCAG 2.1)
function relativeLuminance([r, g, b]) {
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

// Ratio de contraste (WCAG 2.1)
function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Tokens V2 Light (extraídos de globals.css)
const V2_LIGHT = {
  background: [0.985, 0.005, 80],
  foreground: [0.18, 0.01, 80],
  card: [1, 0, 0],
  primary: [0.32, 0.12, 280],
  'primary-foreground': [0.985, 0.005, 80],
  muted: [0.95, 0.006, 80],
  'muted-foreground': [0.45, 0.01, 80],
  accent: [0.72, 0.11, 80], // dourado
  'accent-foreground': [0.18, 0.01, 80],
  'status-ok': [0.48, 0.14, 160],
  'status-warning': [0.52, 0.16, 75],
  'status-critical': [0.55, 0.20, 25],
  'status-pending': [0.45, 0.02, 270],
  'status-info': [0.48, 0.13, 230],
};

// Tokens V2 Dark (extraídos de globals.css)
const V2_DARK = {
  background: [0.16, 0.008, 80],
  foreground: [0.94, 0.005, 80],
  card: [0.20, 0.008, 80],
  primary: [0.60, 0.15, 280],
  'primary-foreground': [0.14, 0.008, 80],
  muted: [0.24, 0.008, 80],
  'muted-foreground': [0.65, 0.008, 80],
  accent: [0.75, 0.12, 80], // dourado dark
  'accent-foreground': [0.14, 0.008, 80],
  'status-ok': [0.70, 0.15, 160],
  'status-warning': [0.78, 0.15, 75],
  'status-critical': [0.65, 0.20, 25],
  'status-pending': [0.70, 0.02, 270],
  'status-info': [0.70, 0.14, 230],
};

// Pares a verificar
const PAIRS = [
  { fg: 'foreground', bg: 'background', label: 'foreground / background' },
  { fg: 'primary-foreground', bg: 'primary', label: 'primary-foreground / primary' },
  { fg: 'muted-foreground', bg: 'background', label: 'muted-foreground / background' },
  { fg: 'muted-foreground', bg: 'muted', label: 'muted-foreground / muted' },
  { fg: 'accent-foreground', bg: 'accent', label: 'accent-foreground / accent (dourado)' },
  { fg: 'status-ok', bg: 'background', label: 'status-ok / background' },
  { fg: 'status-warning', bg: 'background', label: 'status-warning / background' },
  { fg: 'status-critical', bg: 'background', label: 'status-critical / background' },
  { fg: 'status-info', bg: 'background', label: 'status-info / background' },
  { fg: 'status-pending', bg: 'background', label: 'status-pending / background' },
  { fg: 'foreground', bg: 'card', label: 'foreground / card' },
  { fg: 'primary-foreground', bg: 'card', label: 'primary-foreground / card' },
];

function checkContrast(tokens, mode) {
  console.log(`\n=== ${mode.toUpperCase()} ===\n`);
  console.log('| Par | Ratio | AA texto normal (4.5:1) | AA texto grande (3:1) |');
  console.log('|---|---|---|---|');

  const results = [];

  for (const pair of PAIRS) {
    const fgOklch = tokens[pair.fg];
    const bgOklch = tokens[pair.bg];

    if (!fgOklch || !bgOklch) {
      console.log(`| ${pair.label} | N/A | - | - |`);
      continue;
    }

    const fgRgb = oklchToSrgb(...fgOklch);
    const bgRgb = oklchToSrgb(...bgOklch);

    const fgLum = relativeLuminance(fgRgb);
    const bgLum = relativeLuminance(bgRgb);

    const ratio = contrastRatio(fgLum, bgLum);
    const passNormal = ratio >= 4.5;
    const passLarge = ratio >= 3.0;

    const normalIcon = passNormal ? '✓' : '✗';
    const largeIcon = passLarge ? '✓' : '✗';

    results.push({
      pair: pair.label,
      ratio: ratio.toFixed(2),
      passNormal,
      passLarge,
    });

    console.log(`| ${pair.label} | ${ratio.toFixed(2)}:1 | ${normalIcon} | ${largeIcon} |`);
  }

  return results;
}

console.log('# Análise de Contraste V2 — WCAG AA\n');
console.log('Pares de cor verificados para conformidade WCAG 2.1 AA.\n');

const lightResults = checkContrast(V2_LIGHT, 'Light');
const darkResults = checkContrast(V2_DARK, 'Dark');

// Resumo de falhas
console.log('\n## Resumo de Falhas\n');

const lightFails = lightResults.filter((r) => !r.passNormal);
const darkFails = darkResults.filter((r) => !r.passNormal);

if (lightFails.length === 0 && darkFails.length === 0) {
  console.log('Nenhum par falha AA para texto normal.');
} else {
  console.log('### Light');
  for (const fail of lightFails) {
    console.log(`- ${fail.pair}: ${fail.ratio}:1 (mínimo 4.5:1)`);
  }
  console.log('\n### Dark');
  for (const fail of darkFails) {
    console.log(`- ${fail.pair}: ${fail.ratio}:1 (mínimo 4.5:1)`);
  }
}

// Output JSON para inclusão no REPORT.md
const output = { light: lightResults, dark: darkResults };
console.log('\n## JSON\n');
console.log(JSON.stringify(output, null, 2));
