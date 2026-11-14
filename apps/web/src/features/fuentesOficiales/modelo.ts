import type { CampoCotejadoDto, CredencialesFuenteDto, TipoVerificacion } from '@validasoft/api-client';

/**
 * Reglas de la pantalla de fuentes oficiales (FO-1…FO-8), las mismas que valida la API: cuáles son, cómo se resume y se ordena
 * el cotejo para el revisor y cómo se arma el cuerpo de las credenciales (la clave solo se escribe y nunca vuelve).
 */

export type FuenteDeVerificacion = Extract<TipoVerificacion, 'Rues' | 'Dian'>;

/** Las fuentes oficiales, en el orden en que se muestran. */
export const FUENTES: readonly FuenteDeVerificacion[] = ['Rues', 'Dian'];

export function esFuenteOficial(tipo: string): tipo is FuenteDeVerificacion {
  return (FUENTES as readonly string[]).includes(tipo);
}

export interface ResumenDeCotejo {
  coinciden: number;
  /** Los campos que discrepan: con o sin decisión. */
  diferencias: number;
  sinVerificar: number;
  /** Las diferencias que aún esperan la decisión de un revisor. */
  porRevisar: number;
}

export function resumenDeCotejo(campos: readonly CampoCotejadoDto[]): ResumenDeCotejo {
  return {
    coinciden: campos.filter((c) => c.resultado === 'Coincide').length,
    diferencias: campos.filter((c) => c.resultado === 'Discrepa').length,
    sinVerificar: campos.filter((c) => c.resultado === 'NoVerificable').length,
    porRevisar: campos.filter(puedeDecidirCampo).length,
  };
}

/** Una diferencia espera decisión: discrepa y nadie la resolvió (lo que coincide o no se puede verificar no se decide). */
export function puedeDecidirCampo(campo: Pick<CampoCotejadoDto, 'resultado' | 'decision'>): boolean {
  return campo.resultado === 'Discrepa' && !campo.decision;
}

const ORDEN_RESULTADO = { Discrepa: 0, Coincide: 1, NoVerificable: 2 } as const;
const ORDEN_CONTRA = { Fuente: 0, Ficha: 1, Documento: 2 } as const;

/**
 * Primero lo que pide decisión, luego las diferencias ya decididas, lo que coincide y lo que no se pudo verificar; dentro de cada grupo, el estado en
 * la fuente, la ficha y los documentos. Estable: conserva el orden de la API entre iguales.
 */
export function ordenarCotejo(campos: readonly CampoCotejadoDto[]): CampoCotejadoDto[] {
  const rango = (c: CampoCotejadoDto) => (puedeDecidirCampo(c) ? 0 : ORDEN_RESULTADO[c.resultado] + 1);
  return campos
    .map((campo, indice) => ({ campo, indice }))
    .sort((a, b) => rango(a.campo) - rango(b.campo) || ORDEN_CONTRA[a.campo.contra] - ORDEN_CONTRA[b.campo.contra] || a.indice - b.indice)
    .map((x) => x.campo);
}

/** Formulario de credenciales de un proveedor real: la clave nunca llega del servidor (vacío = conservar la actual). */
export interface BorradorDeCredenciales {
  usuario: string;
  clave: string;
  urlBase: string;
  notas: string;
}

export function borradorDeCredenciales(p: { usuario?: string | null; urlBase?: string | null; notas?: string | null }): BorradorDeCredenciales {
  return { usuario: p.usuario ?? '', clave: '', urlBase: p.urlBase ?? '', notas: p.notas ?? '' };
}

/**
 * Cuerpo de las credenciales: la clave vacía no se envía (`null` conserva la actual) salvo para quitar las credenciales (`""`); lo demás vacío va
 * `null`. La API valida el largo de la clave, la URL https y que haya algo que guardar (422).
 */
export function credencialesADto(fuente: FuenteDeVerificacion, proveedor: string, b: BorradorDeCredenciales, quitar = false): CredencialesFuenteDto {
  if (quitar) return { fuente, proveedor, clave: '' };
  return {
    fuente,
    proveedor,
    usuario: b.usuario.trim() || null,
    clave: b.clave.trim() ? b.clave : null,
    urlBase: b.urlBase.trim() || null,
    notas: b.notas.trim() || null,
  };
}

/** Días de la reconsulta periódica: vacío = 0 (apagada); lo que no es número se envía tal cual para que la API responda 422. */
export function diasDeMonitoreo(texto: string): number {
  const limpio = texto.trim();
  return limpio === '' ? 0 : Number(limpio);
}
