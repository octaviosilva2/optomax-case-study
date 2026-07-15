// Skeleton de carregamento da página de perfil do paciente
export default function PacienteProfileLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-6 py-4 border-b bg-card">
        <div className="h-16 w-16 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 bg-background p-6 space-y-6 overflow-auto">
        {/* Seção 1 — Dados Cadastrais skeleton */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-9 w-36 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Seção 2 — Histórico skeleton */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-3">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b last:border-b-0">
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-12 rounded bg-muted animate-pulse ml-auto" />
            </div>
          ))}
        </div>

        {/* Seção 3 e 4 — placeholders skeleton */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-6 space-y-2">
            <div className="h-5 w-36 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full max-w-xs rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
