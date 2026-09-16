export function AvisoSemOrganizacaoRH() {
  return (
    <div className="max-w-2xl mx-auto mt-10 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-primary text-5xl">database</span>
      <h1 className="text-headline-sm text-on-surface">Módulo RH quase pronto</h1>
      <p className="text-body-md text-on-surface-variant">
        As migrations do ERP 2.0 (007–012) ainda não foram aplicadas, ou sua loja ainda não está
        vinculada a uma organização. Assim que o banco estiver migrado, esta tela ativa
        automaticamente.
      </p>
    </div>
  );
}
