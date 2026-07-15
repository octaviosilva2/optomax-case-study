import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { MaintenanceBanner } from '@/components/MaintenanceBanner'
import { CookieBanner } from '@/components/CookieBanner'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
})

// JetBrains Mono para números clínicos (dioptria, AV, PIO) — V2 Editorial
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

// URL base do site — usada para resolver imagens absolutas em previews (OG, Twitter)
export const metadata: Metadata = {
  metadataBase: new URL('https://optomax.com.br'),
  title: {
    default: 'OptoMax',
    template: '%s | OptoMax',
  },
  description: 'Sistema de gestão para optometristas',
  applicationName: 'OptoMax',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://optomax.com.br',
    siteName: 'OptoMax',
    title: 'OptoMax',
    description: 'Sistema de gestão para optometristas',
    // Imagem em src/app/opengraph-image.png é detectada automaticamente pelo Next.js
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OptoMax',
    description: 'Sistema de gestão para optometristas',
    // Imagem em src/app/twitter-image.png é detectada automaticamente pelo Next.js
  },
}

// Cor da barra de status em mobile/PWA — charcoal quente da identidade editorial V2
// Derivado de oklch(0.16 0.008 80) — bate com --background dark V2.
export const viewport: Viewport = {
  themeColor: '#1A1813',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <MaintenanceBanner />
          {children}
          <CookieBanner />
        </Providers>
      </body>
    </html>
  )
}
