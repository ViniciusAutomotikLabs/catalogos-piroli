"use client";

export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-sm uppercase hover:bg-primary-container transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">print</span>
      Imprimir / PDF
    </button>
  );
}
