/** Dados bancários do contrato RH — serializados como JSON cifrado em dados_bancarios_cifrado. */

export type DadosBancarios = {
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: "corrente" | "poupanca" | "pagamento" | null;
  pix: string | null;
};

const TIPOS = ["corrente", "poupanca", "pagamento"] as const;

export function parseDadosBancarios(raw: string | null | undefined): DadosBancarios {
  const empty: DadosBancarios = {
    banco: null,
    agencia: null,
    conta: null,
    tipo_conta: null,
    pix: null,
  };
  if (!raw?.trim()) return empty;

  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const tipo = typeof o.tipo_conta === "string" ? o.tipo_conta : null;
      return {
        banco: str(o.banco),
        agencia: str(o.agencia),
        conta: str(o.conta),
        tipo_conta: TIPOS.includes(tipo as (typeof TIPOS)[number])
          ? (tipo as DadosBancarios["tipo_conta"])
          : null,
        pix: str(o.pix),
      };
    }
  } catch {
    // Legado: texto livre → vai para PIX até re-salvar.
  }

  return { ...empty, pix: raw.trim() };
}

export function serializarDadosBancarios(d: DadosBancarios): string | null {
  const banco = d.banco?.trim() || null;
  const agencia = d.agencia?.trim() || null;
  const conta = d.conta?.trim() || null;
  const pix = d.pix?.trim() || null;
  const tipo_conta = d.tipo_conta;

  if (!banco && !agencia && !conta && !pix && !tipo_conta) return null;

  return JSON.stringify({
    banco,
    agencia,
    conta,
    tipo_conta: tipo_conta || "corrente",
    pix,
  });
}

/** Se algum de banco/agência/conta veio, os três são obrigatórios. */
export function validarDadosBancarios(d: DadosBancarios): string | null {
  const temAlgum = Boolean(d.banco?.trim() || d.agencia?.trim() || d.conta?.trim());
  if (!temAlgum) return null;
  if (!d.banco?.trim() || !d.agencia?.trim() || !d.conta?.trim()) {
    return "Informe banco, agência e conta juntos.";
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
