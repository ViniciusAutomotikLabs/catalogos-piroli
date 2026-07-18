export default function BuscaLoading() {
  return (
    <div className="space-y-6 -mt-2 animate-pulse">
      <div className="h-14 rounded-xl bg-surface-container-high" />
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-full bg-surface-container-high" />
        <div className="h-8 w-24 rounded-full bg-surface-container-high" />
        <div className="h-8 w-28 rounded-full bg-surface-container-high" />
      </div>
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-body-md text-on-surface-variant">
        Carregando produtos…
      </div>
    </div>
  );
}
