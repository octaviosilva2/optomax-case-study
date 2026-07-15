# audit-colors.ps1 — Detecta cores hardcoded no codigo fonte
# Uso: .\scripts\audit-colors.ps1
# Exit 1 se encontrar qualquer match, exit 0 se limpo
#
# Exclusoes:
# - globals.css e tokens.css (definicoes centrais de tokens)
# - node_modules, .next, tests/, screenshots/ (nao sao codigo de producao)
# - TemplatePDF.tsx e TemplateFichaPDF.tsx (@react-pdf/renderer usa hex direto)

$ErrorActionPreference = "Stop"

# Diretorio raiz do projeto
$RootDir = Split-Path -Parent $PSScriptRoot
$SrcDir = Join-Path $RootDir "src"

# Cores da paleta default do Tailwind que devem ser bloqueadas
$ColorNames = "blue|slate|gray|zinc|red|green|sky|indigo|emerald|amber|rose|cyan|teal|orange|yellow|purple|pink|violet|lime|fuchsia|stone|neutral"

# Arquivos e pastas a ignorar
$ExcludeDirs = @("node_modules", ".next", "tests", "screenshots")
$ExcludeFiles = @("globals.css", "tokens.css", "TemplatePDF.tsx", "TemplateFichaPDF.tsx")

$Found = $false

Write-Host "=== Auditoria de cores hardcoded ===" -ForegroundColor Cyan
Write-Host ""

# Funcao para buscar com exclusoes
function Search-Pattern {
    param(
        [string]$Pattern,
        [string]$Description
    )

    Write-Host "[$Description]" -ForegroundColor Yellow

    $results = Get-ChildItem -Path $SrcDir -Recurse -File -Include "*.ts","*.tsx","*.js","*.jsx","*.css" |
        Where-Object {
            $file = $_
            $excluded = $false

            # Verificar se esta em pasta excluida
            foreach ($dir in $ExcludeDirs) {
                if ($file.FullName -match [regex]::Escape($dir)) {
                    $excluded = $true
                    break
                }
            }

            # Verificar se e arquivo excluido
            if (-not $excluded) {
                foreach ($excFile in $ExcludeFiles) {
                    if ($file.Name -eq $excFile) {
                        $excluded = $true
                        break
                    }
                }
            }

            -not $excluded
        } |
        Select-String -Pattern $Pattern -AllMatches

    if ($results) {
        $results | ForEach-Object {
            Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red
        }
        return $true
    }
    return $false
}

# 0.1 Hex literais
if (Search-Pattern -Pattern "#[0-9a-fA-F]{3,8}\b" -Description "1/4 Buscando hex literais") {
    $Found = $true
}
Write-Host ""

# 0.2 Classes Tailwind paleta default
if (Search-Pattern -Pattern "(text|bg|border|ring|fill|stroke)-($ColorNames)-[0-9]+" -Description "2/4 Buscando classes Tailwind paleta default") {
    $Found = $true
}
Write-Host ""

# 0.3 Arbitrary brackets de cor
if (Search-Pattern -Pattern "\[#[0-9a-fA-F]{3,8}\]" -Description "3/4 Buscando arbitrary brackets") {
    $Found = $true
}
Write-Host ""

# 0.4 Classes com modifiers
if (Search-Pattern -Pattern "(hover|focus|active|disabled):(text|bg|border)-($ColorNames)" -Description "4/4 Buscando classes com modifiers") {
    $Found = $true
}
Write-Host ""

# Resultado
if ($Found) {
    Write-Host "=== FALHA: Cores hardcoded encontradas ===" -ForegroundColor Red
    Write-Host "Substitua por tokens semanticos antes de commitar."
    Write-Host "Consulte: projetos/2026-05-identidade-visual/auditoria-cores-hardcoded.md"
    exit 1
} else {
    Write-Host "=== OK: Nenhuma cor hardcoded encontrada ===" -ForegroundColor Green
    exit 0
}
