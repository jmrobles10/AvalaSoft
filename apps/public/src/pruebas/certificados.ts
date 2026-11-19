import type { CertificadoPublicoDto, ClavesDeCertificadosDto, JsonElement } from '@avalasoft/api-client';
import { aHex, sha256 } from '../verificacion/cripto';
import { bytesCanonicos } from '../verificacion/jcs';
import certificadoReal from './vector-dorado/certificado.json';
import clavesReales from './vector-dorado/claves.json';

/**
 * Certificados de prueba para la verificación pública. `CERTIFICADO_REAL` y `CLAVES_REAL` son el vector dorado: una emisión tal como
 * la devolvió la API (sellada por el backend en C# con la clave de desarrollo `vs-desarrollo-solo-local`), en `vector-dorado/*.json`.
 * Los lee también la prueba de dominio `VectorDoradoDelCertificadoTests`, así que el navegador y la API validan los mismos bytes: si
 * cambia cómo se canonicaliza, se calcula el hash o se sella, una de las dos falla y el vector se vuelve a emitir.
 */
export const CERTIFICADO_REAL: CertificadoPublicoDto = certificadoReal;

export const CLAVES_REAL: ClavesDeCertificadosDto = clavesReales;

const aBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

/**
 * Sella `contenidoCanonico` con un par Ed25519 generado aquí (WebCrypto de Node) y arma el certificado y el documento
 * de claves coherentes con él. `cambios` se aplica antes de sellar (estado, reemplazo…).
 */
export async function certificadoSellado(
  cambios: Partial<CertificadoPublicoDto> = {},
  kid = 'vs-prueba',
): Promise<{ certificado: CertificadoPublicoDto; claves: ClavesDeCertificadosDto }> {
  const par = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  const base = { ...CERTIFICADO_REAL, ...cambios };
  const contenido: JsonElement = base.contenidoCanonico;
  const hash = await sha256(bytesCanonicos(contenido));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, par.privateKey, hash));
  const hex = aHex(hash);
  const certificado: CertificadoPublicoDto = {
    ...base,
    hashContenido: hex,
    huella: `${hex.slice(0, 4)}·${hex.slice(4, 8)}·${hex.slice(8, 12)}`,
    firma: { ...base.firma, kid, valor: aBase64(firma) },
  };
  const x = jwk.x ?? '';
  return {
    certificado,
    claves: { ...CLAVES_REAL, claves: [{ kid, algoritmo: 'Ed25519', clavePublica: '', jwk: { kty: 'OKP', crv: 'Ed25519', x, kid, alg: 'EdDSA', use: 'sig' }, vigente: true }] },
  };
}
