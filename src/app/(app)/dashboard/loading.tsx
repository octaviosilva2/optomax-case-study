// Skeleton do Painel V2 (cockpit): faixa de progresso + herói + agenda + coluna lateral.
export default function LoadingDashboard() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-44 animate-pulse rounded-lg bg-muted" />
      </div>

      {/* Faixa de progresso */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* 2 colunas */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* Herói */}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-56 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
          </div>

          {/* Agenda de hoje */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex h-12 items-center border-b border-border px-5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna lateral: A confirmar + Pendências */}
        <div className="flex flex-col gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-12 w-full animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
