#!/bin/bash
# audit-colors.sh — Detecta cores hardcoded no codigo fonte
# Uso: bash scripts/audit-colors.sh
# Exit 1 se encontrar qualquer match, exit 0 se limpo
#
# Exclusoes:
# - globals.css e tokens.css (definicoes centrais de tokens)
# - node_modules, .next, tests/, screenshots/ (nao sao codigo de producao)
# - TemplatePDF.tsx e TemplateFichaPDF.tsx (@react-pdf/renderer usa hex direto)

set -e

# Diretorio raiz do projeto (ajusta se executado de outro local)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"

# Cores da paleta default do Tailwind que devem ser bloqueadas
COLOR_NAMES="blue|slate|gray|zinc|red|green|sky|indigo|emerald|amber|rose|cyan|teal|orange|yellow|purple|pink|violet|lime|fuchsia|stone|neutral"

# Arquivos e pastas a ignorar
EXCLUDES=(
  --exclude="globals.css"
  --exclude="tokens.css"
  --exclude-dir="node_modules"
  --exclude-dir=".next"
  --exclude-dir="tests"
  --exclude-dir="screenshots"
  --exclude-dir="scripts"
  # Arquivos de fonte (binarios): seus bytes casam com o regex de hex (#xxxxxx)
  # e geram falso positivo no passo [1/4]. O flag -I nos greps ja pula binarios,
  # mas listamos aqui tambem para deixar a intencao explicita.
  --exclude="*.ttf"
  --exclude="*.otf"
  --exclude="*.woff"
  --exclude="*.woff2"
  --exclude="TemplatePDF.tsx"
  --exclude="TemplateFichaPDF.tsx"
  --exclude="pdf-colors.ts"
  --exclude="avatar.ts"
  --exclude="GraficoEvolucao.tsx"
  # Casos especiais que usam hex fora de className
  --exclude="layout.tsx"               # themeColor viewport meta
  --exclude="IdentityToggle.tsx"       # toggle de dev V1/V2
  --exclude="SignatureUploadDialog.tsx" # penColor do canvas signature
)

FOUND=0

echo "=== Auditoria de cores hardcoded ==="
echo ""

# 0.1 Hex literais
echo "[1/4] Buscando hex literais (#xxx, #xxxxxx)..."
if grep -rEnI "#[0-9a-fA-F]{3,8}\b" "$SRC_DIR" "${EXCLUDES[@]}" 2>/dev/null; then
  FOUND=1
fi
echo ""

# 0.2 Classes Tailwind paleta default
echo "[2/4] Buscando classes Tailwind com cores da paleta default..."
if grep -rEnI "(text|bg|border|ring|fill|stroke)-($COLOR_NAMES)-[0-9]+" "$SRC_DIR" "${EXCLUDES[@]}" 2>/dev/null; then
  FOUND=1
fi
echo ""

# 0.3 Arbitrary brackets de cor
echo "[3/4] Buscando arbitrary brackets de cor ([#xxx])..."
if grep -rEnI "\[#[0-9a-fA-F]{3,8}\]" "$SRC_DIR" "${EXCLUDES[@]}" 2>/dev/null; then
  FOUND=1
fi
echo ""

# 0.4 Classes com modifiers (hover/focus/active/disabled)
echo "[4/4] Buscando classes com modifiers..."
if grep -rEnI "(hover|focus|active|disabled):(text|bg|border)-($COLOR_NAMES)" "$SRC_DIR" "${EXCLUDES[@]}" 2>/dev/null; then
  FOUND=1
fi
echo ""

# Resultado
if [ $FOUND -eq 1 ]; then
  echo "=== FALHA: Cores hardcoded encontradas ==="
  echo "Substitua por tokens semanticos antes de commitar."
  echo "Consulte: projetos/2026-05-identidade-visual/auditoria-cores-hardcoded.md"
  exit 1
else
  echo "=== OK: Nenhuma cor hardcoded encontrada ==="
  exit 0
fi
