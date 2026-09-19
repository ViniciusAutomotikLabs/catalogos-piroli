"use client";

type Props = {
  children: React.ReactNode;
  ajuda: string;
  htmlFor?: string;
  className?: string;
};

/** Rótulo de campo com ícone de ajuda e tooltip no hover/focus. */
export function LabelComAjuda({ children, ajuda, htmlFor, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 text-label-sm text-on-surface-variant ${className}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{children}</label> : <span>{children}</span>}
      <span className="relative group/ajuda inline-flex">
        <button
          type="button"
          tabIndex={0}
          aria-label={`Ajuda: ${typeof children === "string" ? children : "campo"}`}
          className="inline-flex p-0.5 rounded text-outline hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={(e) => e.preventDefault()}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            help
          </span>
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-surface-container-highest px-3 py-2 text-left text-label-sm font-normal leading-snug text-on-surface shadow-lg border border-outline-variant group-hover/ajuda:block group-focus-within/ajuda:block"
        >
          {ajuda}
        </span>
      </span>
    </span>
  );
}
