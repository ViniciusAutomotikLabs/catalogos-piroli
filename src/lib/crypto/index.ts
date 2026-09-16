/**
 * Criptografia de dados em nível de coluna (ERP 2.0).
 *
 * Estratégia (ver docs/erp-2.0/MODELO_PESSOAS.md §5):
 *  - Campos sensíveis são cifrados AQUI, na aplicação, com AES-256-GCM. O Postgres
 *    só guarda bytes opacos (colunas bytea) — um dump vazado é inútil sem a chave.
 *  - Para busca por igualdade (CNPJ, telefone), geramos um "blind index": um HMAC
 *    determinístico do valor normalizado, guardado ao lado. Permite achar sem revelar.
 *  - As chaves vivem em variáveis de ambiente (secret do Coolify), NUNCA no banco.
 *
 * SERVER-ONLY: nunca importar no browser.
 *
 * Formato de saída pronto para colunas `bytea` via PostgREST/supabase-js: string no
 * formato hex do Postgres (`\x...`). `cifrar` retorna essa string; `decifrar` a lê.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const VERSION = 0x01;
const IV_LEN = 12; // GCM padrão
const TAG_LEN = 16;
const KEY_LEN = 32; // AES-256

const ENV_ENCRYPTION_KEY = "ERP_ENCRYPTION_KEY";
const ENV_BLIND_INDEX_KEY = "ERP_BLIND_INDEX_KEY";

function carregarChave(nome: string): Buffer {
  const bruto = process.env[nome];
  if (!bruto || !bruto.trim()) {
    throw new Error(
      `${nome} não configurada. Gere com \`openssl rand -base64 32\` e defina no ambiente (secret do Coolify).`
    );
  }
  const chave = Buffer.from(bruto.trim(), "base64");
  if (chave.length !== KEY_LEN) {
    throw new Error(`${nome} deve ter ${KEY_LEN} bytes em base64 (256 bits).`);
  }
  return chave;
}

/** True se ambas as chaves estão configuradas (para telas degradarem com aviso claro). */
export function criptografiaConfigurada(): boolean {
  try {
    carregarChave(ENV_ENCRYPTION_KEY);
    carregarChave(ENV_BLIND_INDEX_KEY);
    return true;
  } catch {
    return false;
  }
}

function paraPgBytea(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

function dePgBytea(valor: string): Buffer {
  // Aceita tanto "\x..." (formato Postgres) quanto hex puro.
  const hex = valor.startsWith("\\x") ? valor.slice(2) : valor;
  return Buffer.from(hex, "hex");
}

/**
 * Cifra um texto. Retorna string `\x...` para gravar em coluna bytea, ou null.
 * Payload: [versão(1)][iv(12)][tag(16)][ciphertext(n)].
 */
export function cifrar(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const chave = carregarChave(ENV_ENCRYPTION_KEY);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", chave, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]);
  return paraPgBytea(payload);
}

/**
 * Decifra o valor de uma coluna bytea (`\x...`). Lança se o dado foi adulterado
 * (a tag GCM não confere). Retorna null para entrada nula.
 */
export function decifrar(valor: string | null | undefined): string | null {
  if (valor == null || valor === "") return null;
  const chave = carregarChave(ENV_ENCRYPTION_KEY);
  const buf = dePgBytea(valor);
  if (buf.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error("Dado cifrado inválido: tamanho insuficiente.");
  }
  const versao = buf[0];
  if (versao !== VERSION) {
    throw new Error(`Versão de criptografia não suportada: ${versao}.`);
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", chave, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Blind index (HMAC-SHA256) determinístico do valor normalizado. Retorna `\x...`
 * para coluna bytea, ou null. Mesmo valor → mesmo índice (permite WHERE por igualdade).
 */
function blindIndex(valorNormalizado: string | null): string | null {
  if (!valorNormalizado) return null;
  const chave = carregarChave(ENV_BLIND_INDEX_KEY);
  const mac = createHmac("sha256", chave).update(valorNormalizado, "utf8").digest();
  return paraPgBytea(mac);
}

/** Normaliza documento (CPF/CNPJ): só dígitos. */
export function normalizarDocumento(doc: string | null | undefined): string {
  return (doc ?? "").replace(/\D+/g, "");
}

/** Normaliza contato (telefone/email): trim + lowercase; telefone vira só dígitos. */
export function normalizarContato(valor: string | null | undefined, canal: string): string {
  const v = (valor ?? "").trim();
  if (canal === "email") return v.toLowerCase();
  return v.replace(/\D+/g, ""); // whatsapp/sms
}

/** Blind index de documento (CPF/CNPJ). */
export function blindIndexDocumento(doc: string | null | undefined): string | null {
  const n = normalizarDocumento(doc);
  return n ? blindIndex(`doc:${n}`) : null;
}

/** Blind index de contato. Prefixado por canal para não colidir email x telefone. */
export function blindIndexContato(
  valor: string | null | undefined,
  canal: string
): string | null {
  const n = normalizarContato(valor, canal);
  return n ? blindIndex(`${canal}:${n}`) : null;
}

/**
 * Máscara de documento para exibição sem descriptografar.
 * CPF (11 dígitos): revela só os 5 últimos. CNPJ (14): revela só o final
 * "0001-90". Outros tamanhos: revela os últimos 4 dígitos.
 */
export function mascararDocumento(doc: string | null | undefined): string | null {
  const n = normalizarDocumento(doc);
  if (!n) return null;
  if (n.length === 11) {
    return `***.***.${n.slice(6, 9)}-${n.slice(9)}`;
  }
  if (n.length === 14) {
    return `**.***.***/${n.slice(8, 12)}-${n.slice(12)}`;
  }
  return `***${n.slice(-4)}`;
}
