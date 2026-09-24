/**
 * Catálogo de módulos do ERP 2.0 (entitlements).
 *
 * As chaves espelham o seed da migration `008_erp_entitlements.sql`. O super admin
 * liga/desliga módulos por loja (`loja_modulos`); a sidebar e os guards de rota
 * respeitam o conjunto de módulos ativos.
 *
 * Fallback: quando o contexto traz `modulos = null` (ex.: banco ainda sem a tabela
 * de entitlements), NÃO há enforcement — tudo é liberado, para não quebrar o app
 * atual antes de a migration ser aplicada e os módulos semeados.
 */

export const MODULO_CHAVES = [
  "pessoas",
  "rh",
  "busca",
  "orcamento",
  "estoque",
  "vendas",
  "catalogos",
  "agregados",
  "historico",
  "financeiro",
  "fiscal",
  "ia",
  "marketing",
] as const;

export type ModuloChave = (typeof MODULO_CHAVES)[number];

/**
 * Mapeia prefixos de rota → módulo exigido. Rotas fora deste mapa são sempre
 * liberadas (ex.: "/inicio" e "/configuracoes"). Ordem importa: prefixos mais
 * específicos primeiro.
 */
const ROTA_MODULO: ReadonlyArray<[string, ModuloChave]> = [
  ["/produtos", "busca"],
  ["/busca", "busca"],
  ["/veiculo", "busca"],
  ["/orcamento", "orcamento"],
  ["/estoque", "estoque"],
  ["/entregas", "vendas"],
  ["/vendas", "vendas"],
  ["/caixa", "financeiro"],
  ["/catalogos", "catalogos"],
  ["/agregados", "agregados"],
  ["/historico", "historico"],
  ["/clientes", "pessoas"],
  ["/pessoas", "pessoas"],
  ["/rh", "rh"],
  ["/financeiro", "financeiro"],
  ["/fiscal", "fiscal"],
  ["/ia", "ia"],
  ["/marketing", "marketing"],
];

/** Retorna o módulo exigido por uma rota, ou null se for sempre liberada. */
export function moduloDaRota(pathname: string): ModuloChave | null {
  for (const [prefixo, modulo] of ROTA_MODULO) {
    if (pathname === prefixo || pathname.startsWith(prefixo + "/")) {
      return modulo;
    }
  }
  return null;
}

/**
 * Decide se um módulo está liberado dado o conjunto ativo.
 * `modulosAtivos = null` → sem enforcement (tudo liberado).
 */
export function moduloLiberado(
  modulo: ModuloChave | null,
  modulosAtivos: ReadonlySet<ModuloChave> | null
): boolean {
  if (modulo === null) return true; // rota sempre liberada
  if (modulosAtivos === null) return true; // enforcement desligado (fallback)
  return modulosAtivos.has(modulo);
}
