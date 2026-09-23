/**
 * Enriquecimento live GPASI para ficha do espelho (/estoque/[codigo]).
 * Uma peça por request — auth OAuth /token (mesmo fluxo n8n).
 * Só importar de Server Components / Route Handlers.
 */

export type GpasiPecaDados = {
  codigo: string;
  codigoFabricante: string | null;
  descricao: string | null;
  marca: string | null;
  aplicacao: string | null;
  similarMestre: string | null;
  secao: string | null;
  grupo: string | null;
  ncm: string | null;
  quantidadeImagem: number;
  agregados: string[];
  caracteristicas: string[];
};

export type GpasiSaldoFilial = {
  empresa: string;
  fantasia: string | null;
  estoque: number;
  reservado: number;
};

export type GpasiSimilar = {
  codigo: string;
  descricao: string;
  similarMestre: string;
  ranking: string | null;
  mestre: boolean;
};

const FILIAIS_FISICAS_DEFAULT = ["0001", "0003", "0004", "0005", "0010"];

function env(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v?.trim()) return v.trim();
  }
  return "";
}

function resolveConfig() {
  const base = (
    env("GPASI_BASE", "ip_gestao") || "http://181.191.194.31:54123"
  ).replace(/\/$/, "");
  const user = env("GPASI_USER", "User_gestao");
  const password = env("GPASI_PASSWORD", "Senha_gestao");
  const empresasRaw = env("GPASI_EMPRESAS_FISICAS");
  const empresas = empresasRaw
    ? empresasRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : FILIAIS_FISICAS_DEFAULT;
  return { base, user, password, empresas };
}

async function gpasiToken(cfg: ReturnType<typeof resolveConfig>): Promise<string | null> {
  if (!cfg.user || !cfg.password) return null;
  const body = new URLSearchParams({
    username: cfg.user,
    password: cfg.password,
    grant_type: "password",
  });
  try {
    const res = await fetch(`${cfg.base}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function gpasiJson<T>(
  cfg: ReturnType<typeof resolveConfig>,
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T | null> {
  try {
    // Node/undici forbids GET with body; GPASI exige body em vários GET
    // (ex. /peca/dados, /empresa/status) e aceita o mesmo payload via POST.
    const usePost = method === "GET" && body !== undefined;
    const res = await fetch(`${cfg.base}${path}`, {
      method: usePost ? "POST" : method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function mapDados(row: Record<string, unknown>): GpasiPecaDados {
  const codigo = String(row.codigo ?? "").trim();
  const fab = String(row.codigofabricante ?? "").trim();
  return {
    codigo,
    codigoFabricante: fab && fab !== codigo ? fab : fab || null,
    descricao: String(row.descricao ?? "").trim() || null,
    marca: String(row.marca ?? "").trim() || null,
    aplicacao: String(row.aplicacao ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim() || null,
    similarMestre: String(row.similarmestre ?? "").trim() || null,
    secao: String(row.secao ?? "").trim() || null,
    grupo: String(row.grupo ?? "").trim() || null,
    ncm: String(row.ncm ?? "").trim() || null,
    quantidadeImagem: Number(row.quantidadeimagem) || 0,
    agregados: asStringList(row.agregados),
    caracteristicas: asStringList(row.caracteristicas).length
      ? asStringList(row.caracteristicas)
      : typeof row.caracteristicas === "string" && row.caracteristicas.trim()
        ? [row.caracteristicas.trim()]
        : [],
  };
}

/**
 * /peca/dados.marca é o CÓDIGO da marca (ex. LUBRA).
 * O nome de exibição (ex. LUBRAX) vem de /peca/marca/status — como na SS.
 */
export async function fetchGpasiMarcaNome(
  codigoMarca: string
): Promise<string | null> {
  const codigo = codigoMarca.trim();
  if (!codigo) return null;
  const cfg = resolveConfig();
  const token = await gpasiToken(cfg);
  if (!token) return null;

  const payload = await gpasiJson<unknown>(
    cfg,
    token,
    "GET",
    "/erpssplus/peca/marca/status",
    { codigo }
  );
  if (!Array.isArray(payload) || !payload[0] || typeof payload[0] !== "object") {
    return null;
  }
  const row = payload[0] as Record<string, unknown>;
  const nome = String(row.nome ?? "").trim();
  return nome || null;
}

/** Dados mestres da peça (código fabricante, aplicação, marca…). */
export async function fetchGpasiPecaDados(
  codigo: string
): Promise<GpasiPecaDados | null> {
  const limpo = codigo.trim();
  if (!limpo) return null;
  const cfg = resolveConfig();
  const token = await gpasiToken(cfg);
  if (!token) return null;

  const payload = await gpasiJson<unknown>(cfg, token, "GET", "/erpssplus/peca/dados", {
    bloco: 1,
    codigo: limpo,
  });

  let pecas: Record<string, unknown>[] = [];
  if (Array.isArray(payload) && payload[0] && typeof payload[0] === "object") {
    const first = payload[0] as Record<string, unknown>;
    if (Array.isArray(first.pecas)) {
      pecas = first.pecas as Record<string, unknown>[];
    } else if (first.codigo) {
      pecas = payload as Record<string, unknown>[];
    }
  }

  const row = pecas.find((p) => String(p.codigo ?? "").trim() === limpo) ?? pecas[0];
  if (!row) return null;
  const mapped = mapDados(row);
  // Resolve código marca → nome (LUBRA → LUBRAX)
  if (mapped.marca) {
    const nome = await fetchGpasiMarcaNome(mapped.marca);
    if (nome) mapped.marca = nome;
  }
  return mapped;
}

/** Saldo por filial física (1 chamada por empresa — API soma se mandar lista). */
export async function fetchGpasiSaldoFiliais(
  codigo: string
): Promise<GpasiSaldoFilial[]> {
  const limpo = codigo.trim();
  if (!limpo) return [];
  const cfg = resolveConfig();
  const token = await gpasiToken(cfg);
  if (!token) return [];

  const empresasPayload = await gpasiJson<unknown>(
    cfg,
    token,
    "GET",
    "/erpssplus/empresa/status",
    {}
  );
  const nomes = new Map<string, string>();
  if (Array.isArray(empresasPayload)) {
    for (const e of empresasPayload) {
      if (!e || typeof e !== "object") continue;
      const row = e as Record<string, unknown>;
      const cod = String(row.codigo ?? "").trim();
      if (!cod) continue;
      nomes.set(cod, String(row.fantasia ?? row.razaosocial ?? cod).trim());
    }
  }

  const out: GpasiSaldoFilial[] = [];
  await Promise.all(
    cfg.empresas.map(async (empresa) => {
      const data = await gpasiJson<
        Array<{ estoque?: number; estoquereservado?: number }>
      >(cfg, token, "POST", "/erpssplus/v2/peca/estoque/atual/", {
        codigoerp: [limpo],
        empresa: [empresa],
      });
      const row = Array.isArray(data) ? data[0] : null;
      out.push({
        empresa,
        fantasia: nomes.get(empresa) ?? null,
        estoque: Number(row?.estoque) || 0,
        reservado: Number(row?.estoquereservado) || 0,
      });
    })
  );

  out.sort((a, b) => a.empresa.localeCompare(b.empresa));
  return out;
}

/** Cadeia de similares pelo similarmestre. */
export async function fetchGpasiSimilares(
  similarMestre: string
): Promise<GpasiSimilar[]> {
  const mestre = similarMestre.trim();
  if (!mestre) return [];
  const cfg = resolveConfig();
  const token = await gpasiToken(cfg);
  if (!token) return [];

  const data = await gpasiJson<unknown>(
    cfg,
    token,
    "POST",
    "/erpssplus/peca/similar/status",
    { similarmestre: mestre }
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const codigo = String(r.codigo ?? "").trim();
      if (!codigo) return null;
      return {
        codigo,
        descricao: String(r.descricao ?? "").trim() || codigo,
        similarMestre: String(r.similarmestre ?? mestre).trim(),
        ranking: String(r.ranking ?? "").trim() || null,
        mestre: String(r.mestre ?? "").toLowerCase().startsWith("s"),
      } satisfies GpasiSimilar;
    })
    .filter((x): x is GpasiSimilar => Boolean(x));
}

/** Pacote completo para a ficha — falhas parciais não derrubam a página. */
export async function enrichEspelhoPeca(codigo: string): Promise<{
  dados: GpasiPecaDados | null;
  filiais: GpasiSaldoFilial[];
  similares: GpasiSimilar[];
}> {
  const dados = await fetchGpasiPecaDados(codigo);
  const [filiais, similares] = await Promise.all([
    fetchGpasiSaldoFiliais(codigo),
    dados?.similarMestre
      ? fetchGpasiSimilares(dados.similarMestre)
      : Promise.resolve([] as GpasiSimilar[]),
  ]);
  return { dados, filiais, similares };
}
