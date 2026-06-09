"use client";

import { useEffect, useRef } from "react";
import { registrarConsulta } from "@/lib/actions/historico";

/** Registra a consulta no histórico uma única vez por montagem. */
export function RegistrarConsulta({
  termo,
  produtoId,
}: {
  termo: string | null;
  produtoId?: number | null;
}) {
  const registrado = useRef(false);

  useEffect(() => {
    if (registrado.current) return;
    registrado.current = true;
    registrarConsulta(termo, produtoId).catch(() => {});
  }, [termo, produtoId]);

  return null;
}
