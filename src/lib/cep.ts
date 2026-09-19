/** ViaCEP via proxy same-origin (/api/cep) — CSP não permite fetch direto ao domínio externo. */

export type EnderecoViaCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function formatarCep(cep: string): string {
  const d = normalizarCep(cep);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const digits = normalizarCep(cep);
  if (digits.length !== 8) return null;

  const res = await fetch(`/api/cep/${digits}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as EnderecoViaCep & { erro?: boolean };
  if (data.erro || !data.cidade) return null;

  return {
    cep: data.cep || formatarCep(digits),
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    cidade: data.cidade ?? "",
    uf: (data.uf ?? "").toUpperCase(),
  };
}
