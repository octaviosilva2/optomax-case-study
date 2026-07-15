export default function LoadingConfiguracoes() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-7 w-48 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse mt-1" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-t bg-muted animate-pulse" />
        ))}
      </div>

      {/* Card skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4 max-w-lg">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>
        ))}
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  )
}
