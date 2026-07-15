export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="h-6 w-40 bg-muted rounded" />
      <div className="h-24 bg-muted rounded-xl" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-40 bg-muted rounded-xl" />
      ))}
    </div>
  )
}
