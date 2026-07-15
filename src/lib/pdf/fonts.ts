// Registro das fontes dos PDFs (server-side, runtime Node).
// Fraunces (serif) nos títulos/monograma; Inter (sans) no corpo — espelha a
// tipografia da identidade V2 do app e do modelo de impressão.
//
// IMPORTANTE (Vercel/serverless): os .ttf são lidos do filesystem via
// process.cwd(). Em produção eles PRECISAM entrar no bundle da função via
// `outputFileTracingIncludes` no next.config.ts — senão Font.register falha em
// runtime ao abrir o arquivo. Em dev (`next dev`) o cwd já é a raiz do projeto.
//
// Instâncias ESTÁTICAS (não variable): o @react-pdf/renderer não resolve eixos
// de variable fonts. Fraunces foi baixada no optical size 144 (display, ideal
// para títulos).

import path from 'node:path'
import { Font } from '@react-pdf/renderer'

// Nomes de família reutilizados nos StyleSheet dos templates.
export const FONTS = {
  sans: 'Inter',
  serif: 'Fraunces',
} as const

const DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts')

// Guard: cada template chama registrarFontesPDF(); registramos só uma vez.
let registrado = false

export function registrarFontesPDF(): void {
  if (registrado) return
  registrado = true

  Font.register({
    family: FONTS.sans,
    fonts: [
      { src: path.join(DIR, 'Inter-Regular.ttf'), fontWeight: 400 },
      { src: path.join(DIR, 'Inter-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(DIR, 'Inter-Bold.ttf'), fontWeight: 700 },
    ],
  })

  Font.register({
    family: FONTS.serif,
    fonts: [
      { src: path.join(DIR, 'Fraunces-SemiBold.ttf'), fontWeight: 600 },
      { src: path.join(DIR, 'Fraunces-Bold.ttf'), fontWeight: 700 },
    ],
  })

  // Documento clínico: nomes próprios e termos técnicos não devem ser
  // hifenizados. O callback identidade desliga a hifenização automática.
  Font.registerHyphenationCallback((word) => [word])
}
