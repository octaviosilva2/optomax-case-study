// Skeleton de carregamento da página /admin (async server component).
// Evita tela em branco no primeiro acesso enquanto o servidor carrega os dados.
export default function Loading() {
  return (
    <div className="p-8">
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted/50 animate-pulse rounded-xl" />
      </div>
    </div>
  )
}
