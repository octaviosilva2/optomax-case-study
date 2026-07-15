'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dados ficam "frescos" por 5min — ao revisitar uma tela já aberta,
            // o react-query serve do cache na hora (sem spinner/piscar).
            staleTime: 5 * 60 * 1000,
            // Mantém o cache por 10min após a tela sair de tela.
            gcTime: 10 * 60 * 1000,
            // Evita refetch automático ao voltar o foco pra aba.
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  // Dark mode via class (.dark) — funciona com @custom-variant dark no globals.css
  // Identidade editorial consolidada em :root (Fase 10 cleanup)
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={true}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
