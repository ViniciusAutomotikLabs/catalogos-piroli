/** Helpers de dia civil America/Sao_Paulo para lista de vendas. */

/** Dia civil em America/Sao_Paulo → [inicio, fim) em ISO UTC. */
export function boundsDiaSp(dia: string): { inicio: string; fim: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) {
    return boundsDiaSp(hojeSp());
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Meia-noite SP = 03:00 UTC (sem horário de verão desde 2019)
  const inicio = new Date(Date.UTC(y, mo - 1, d, 3, 0, 0, 0));
  const fim = new Date(Date.UTC(y, mo - 1, d + 1, 3, 0, 0, 0));
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function hojeSp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function nomeCliente(row: {
  clientes?:
    | { razao_social?: string | null; nome_fantasia?: string | null }
    | { razao_social?: string | null; nome_fantasia?: string | null }[]
    | null;
  pessoas?:
    | { nome?: string | null; nome_fantasia?: string | null }
    | { nome?: string | null; nome_fantasia?: string | null }[]
    | null;
}): string {
  const c = unwrapOne(row.clientes);
  if (c) {
    const n = (c.nome_fantasia || c.razao_social || "").trim();
    if (n) return n;
  }
  const p = unwrapOne(row.pessoas);
  if (p) {
    const n = (p.nome_fantasia || p.nome || "").trim();
    if (n) return n;
  }
  return "—";
}
