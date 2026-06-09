export function Footer() {
  return (
    <footer className="bg-surface-container-low w-full py-4 mt-auto border-t border-outline-variant flex flex-col md:flex-row justify-between items-center px-8 ml-64">
      <div className="text-label-sm text-primary mb-2 md:mb-0">
        © 2026 Logística Automotiva S.A. — Todos os direitos reservados.
      </div>
      <ul className="flex items-center gap-4">
        {["Termos de Uso", "Privacidade", "Suporte Técnico"].map((label) => (
          <li key={label}>
            <a
              className="text-label-sm font-normal text-on-surface-variant hover:text-primary underline opacity-80 hover:opacity-100 transition-opacity"
              href="#"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
