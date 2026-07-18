/**
 * Glossário PT → EN e heurísticas de filtro PostgREST para a API TecDoc.
 * As descriptions no catálogo TecDoc estão em inglês; model_name aceita nomes universais.
 */

export type TecDocFiltro =
  | { campo: "model_name"; valor: string }
  | { campo: "description"; valor: string };

/** Termos comuns de autopeças (PT / variantes → inglês TecDoc). */
const GLOSSARIO_PT_EN: Record<string, string> = {
  filtro: "Oil Filter",
  "filtro de oleo": "Oil Filter",
  "filtro de óleo": "Oil Filter",
  "filtro de ar": "Air Filter",
  "filtro de combustivel": "Fuel Filter",
  "filtro de combustível": "Fuel Filter",
  "filtro de cabine": "Cabin Filter",
  amortecedor: "Shock Absorber",
  pastilha: "Brake Pad",
  "pastilha de freio": "Brake Pad",
  disco: "Brake Disc",
  "disco de freio": "Brake Disc",
  "fluido de freio": "Brake Fluid",
  "kit embreagem": "Clutch Kit",
  embreagem: "Clutch",
  correia: "Belt",
  "correia dentada": "Timing Belt",
  rolamento: "Bearing",
  junta: "Gasket",
  retentor: "Seal",
  bomba: "Pump",
  "bomba dagua": "Water Pump",
  "bomba d'agua": "Water Pump",
  "bomba d'água": "Water Pump",
  "bomba de agua": "Water Pump",
  "bomba de água": "Water Pump",
  radiador: "Radiator",
  sensor: "Sensor",
  vela: "Spark Plug",
  "vela de ignicao": "Spark Plug",
  "vela de ignição": "Spark Plug",
  "kit de embreagem": "Clutch Kit",
  coifa: "Boot",
  batente: "Bump Stop",
  coxim: "Mount",
  "braco": "Control Arm",
  braço: "Control Arm",
  terminal: "Tie Rod",
  "barra estabilizadora": "Stabilizer",
  óleo: "Oil",
  oleo: "Oil",
};

/** Modelos/veículos frequentes no mercado BR — priorizam model_name. */
const MODELOS_CONHECIDOS = [
  "gol",
  "golf",
  "uno",
  "palio",
  "siena",
  "strada",
  "toro",
  "argo",
  "mobi",
  "onix",
  "prisma",
  "cobalt",
  "tracker",
  "s10",
  "montana",
  "spin",
  "hb20",
  "creta",
  "tucson",
  "corolla",
  "hilux",
  "sw4",
  "civic",
  "fit",
  "hrv",
  "hr-v",
  "city",
  "ranger",
  "ecosport",
  "ka",
  "fiesta",
  "focus",
  "colorado",
  "marrua",
  "marruá",
  "randon",
  "furgovan",
  "sprinter",
  "ducato",
  "boxer",
  "master",
  "daily",
  "saveiro",
  "voyage",
  "fox",
  "polo",
  "virtus",
  "tcross",
  "t-cross",
  "nivus",
  "jetta",
  "amarok",
];

function normalizarTermo(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pareceCodigo(termo: string): boolean {
  const t = termo.trim();
  if (t.length < 3) return false;
  // Só dígitos, ou alfanumérico curto com dígitos (ex: PH2870A, 201.0813)
  if (/^\d[\d.\-/]*$/.test(t)) return true;
  if (/^[A-Za-z0-9.\-/]{3,20}$/.test(t) && /\d/.test(t) && !/\s/.test(t)) return true;
  return false;
}

function pareceModelo(termo: string): boolean {
  const n = normalizarTermo(termo);
  return MODELOS_CONHECIDOS.some((m) => n === m || n.startsWith(m + " ") || m.startsWith(n));
}

function traduzirPeca(termo: string): string | null {
  const n = normalizarTermo(termo);
  if (GLOSSARIO_PT_EN[n]) return GLOSSARIO_PT_EN[n];
  // Match parcial: "filtro oleo motor" → Oil Filter
  for (const [pt, en] of Object.entries(GLOSSARIO_PT_EN)) {
    if (n.includes(pt) || pt.includes(n)) return en;
  }
  return null;
}

/**
 * Infere 1–2 filtros PostgREST a partir do termo digitado pelo vendedor.
 * Sempre retorna ao menos um filtro quando o termo tem ≥ 2 caracteres.
 */
export function inferirFiltrosPostgREST(termo: string): TecDocFiltro[] {
  const limpo = termo.replace(/[,()%]/g, " ").trim();
  if (limpo.length < 2) return [];

  if (pareceCodigo(limpo)) {
    return [{ campo: "description", valor: limpo }];
  }

  const traduzido = traduzirPeca(limpo);
  if (traduzido) {
    return [{ campo: "description", valor: traduzido }];
  }

  if (pareceModelo(limpo)) {
    return [{ campo: "model_name", valor: limpo }];
  }

  // Fallback: tenta description e model_name em paralelo
  return [
    { campo: "description", valor: limpo },
    { campo: "model_name", valor: limpo },
  ];
}

/** Exportado para testes. */
export const _test = {
  normalizarTermo,
  pareceCodigo,
  pareceModelo,
  traduzirPeca,
  GLOSSARIO_PT_EN,
};
