import Link from "next/link";

export default function VeiculoPage() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm py-20 px-6 flex flex-col items-center gap-3 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[36px]">directions_car</span>
      </span>
      <h1 className="text-headline-md text-on-surface font-bold tracking-tight">Busca por veículo</h1>
      <p className="text-body-md text-on-surface-variant max-w-md">
        Montadora → Modelo → Ano. Em breve — depende dos dados de aplicação por
        veículo no catálogo central.
      </p>
      <Link
        href="/busca"
        className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span className="material-symbols-outlined text-[18px]">search</span>
        Usar busca por código
      </Link>
    </div>
  );
}
