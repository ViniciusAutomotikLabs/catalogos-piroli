/** Papéis de sistema em `membros_loja` (login / acesso ao ERP). */
export const PAPEIS_MEMBRO = ["dono", "vendedor", "caixa", "estoquista"] as const;

export type PapelMembro = (typeof PAPEIS_MEMBRO)[number];

const LABELS: Record<PapelMembro, string> = {
  dono: "Dono",
  vendedor: "Vendedor",
  caixa: "Caixa",
  estoquista: "Estoquista",
};

export function labelPapel(papel: string): string {
  if ((PAPEIS_MEMBRO as readonly string[]).includes(papel)) {
    return LABELS[papel as PapelMembro];
  }
  return papel;
}

export function isPapelMembro(value: string): value is PapelMembro {
  return (PAPEIS_MEMBRO as readonly string[]).includes(value);
}
