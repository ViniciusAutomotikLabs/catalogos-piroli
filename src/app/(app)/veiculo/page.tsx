import Link from "next/link";

export default function VeiculoPage() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg py-20 flex flex-col items-center gap-3 text-center">
      <span className="material-symbols-outlined text-outline text-6xl">directions_car</span>
      <h1 className="text-headline-md text-primary font-bold">Busca por Veículo</h1>
      <p className="text-body-md text-on-surface-variant max-w-md">
        Montadora → Modelo → Ano. Em breve — depende dos dados de aplicação por
        veículo no catálogo central.
      </p>
      <Link
        href="/busca"
        className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">search</span>
        Usar busca por código
      </Link>
    </div>
  );
}
