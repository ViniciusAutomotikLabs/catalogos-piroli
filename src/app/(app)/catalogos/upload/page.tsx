import { notFound } from "next/navigation";
import { getContextoLoja } from "@/lib/loja";
import { UploadCatalogoForm } from "@/components/catalogos/upload-form";

export default async function UploadCatalogoPage() {
  // Upload de catálogo é ação exclusiva do dono da loja.
  // O RLS também bloqueia no banco, mas barramos no servidor para não
  // exibir o formulário a quem não pode usá-lo.
  const contexto = await getContextoLoja();
  if (contexto?.papel !== "dono") notFound();

  return <UploadCatalogoForm />;
}
