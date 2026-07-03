import { buildContatoLojaUrl } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="bg-surface w-full py-4 mt-auto border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-2 px-4 md:px-8 lg:ml-64">
      <div className="text-label-sm font-normal text-on-surface-variant mb-2 md:mb-0">
        © 2026 Logística Automotiva S.A. — Todos os direitos reservados.
      </div>
      <ul className="flex items-center gap-4">
        <li>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-label-sm font-medium text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={buildContatoLojaUrl(
              null,
              "Olá, preciso de suporte técnico no Catálogo Industrial."
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            Suporte Técnico
          </a>
        </li>
      </ul>
    </footer>
  );
}
