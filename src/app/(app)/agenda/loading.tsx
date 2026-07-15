// Skeleton da Agenda: header + navegação de período + grade (1 col mobile / 7 cols desktop).
export default function LoadingAgenda() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      {/* Navegação de período */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Grade */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-1 border-b border-border md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`grid h-12 place-items-center border-border last:border-r-0 md:border-r ${i > 0 ? 'hidden md:grid' : ''}`}
            >
              <div className="h-4 w-10 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, col) => (
            <div
              key={col}
              className={`space-y-2 border-border p-2 last:border-r-0 md:border-r ${col > 0 ? 'hidden md:block' : ''}`}
            >
              {Array.from({ length: 5 }).map((_, row) => (
                <div key={row} className="h-12 w-full animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
