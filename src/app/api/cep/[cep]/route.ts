import { NextResponse } from "next/server";

/** Proxy ViaCEP — evita bloqueio de CSP (connect-src) no browser. */
export async function GET(
  _req: Request,
  context: { params: Promise<{ cep: string }> }
) {
  const { cep: raw } = await context.params;
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) {
    return NextResponse.json({ erro: true, mensagem: "CEP inválido." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ erro: true, mensagem: "Falha ao consultar CEP." }, { status: 502 });
    }
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro || !data.localidade) {
      return NextResponse.json({ erro: true, mensagem: "CEP não encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      cep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: (data.uf ?? "").toUpperCase(),
    });
  } catch {
    return NextResponse.json({ erro: true, mensagem: "Timeout ao consultar CEP." }, { status: 504 });
  }
}
