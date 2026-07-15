// Skeleton da tab Profile (Dados clínica + Profissionais + Status legal).
// 6 placeholders imitam os 3 cards verticais.
export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-muted rounded" />
      <div className="h-4 w-3/4 bg-muted rounded" />
      <div className="grid gap-3 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}
