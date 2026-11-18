/**
 * Contrato postMessage entre las pantallas embebidas de AvalaSoft y el sistema que las aloja (ID-3, docs/06 §3.2).
 *
 * AvalaSoft → contenedor:
 *   { tipo: 'avalasoft:ready', version: 1 }
 *   { tipo: 'avalasoft:sesion-requerida', motivo: 'inicial' | 'por-vencer' | 'vencida' | 'rechazada' }
 *   { tipo: 'avalasoft:resize', height }
 *   { tipo: 'avalasoft:visible', top, height }   región del iframe (px) que debe verse: un diálogo o panel recién abierto
 *
 * Contenedor → AvalaSoft:
 *   { tipo: 'avalasoft:sesion', token, empresaId? }   token = `POST /api/v1/sesiones-usuario` (lo pide el backend del sistema)
 *   { tipo: 'avalasoft:tema', mode: 'light' | 'dark' }
 *   { tipo: 'avalasoft:cerrar-sesion' }
 *
 * Solo se aceptan mensajes de orígenes permitidos y solo se envían al origen del contenedor si está permitido. Los
 * orígenes permitidos se leen **en tiempo de ejecución** de `GET /public/v1/embed/origenes-permitidos` (los que cada
 * sistema integrado registró en AvalaSoft; los mismos de `frame-ancestors`, SE-2). `VITE_ORIGENES_CONTENEDOR` queda
 * como respaldo: se suma en desarrollo o si la consulta falla.
 */

import { VERSION_PROTOCOLO as VERSION_DEL_SDK } from '@avalasoft/sdk';

export const VERSION_PROTOCOLO = VERSION_DEL_SDK;

export type MotivoSesionRequerida = 'inicial' | 'por-vencer' | 'vencida' | 'rechazada';

export type MensajeSaliente =
  | { tipo: 'avalasoft:ready'; version: number }
  | { tipo: 'avalasoft:sesion-requerida'; motivo: MotivoSesionRequerida }
  | { tipo: 'avalasoft:resize'; height: number }
  | { tipo: 'avalasoft:visible'; top: number; height: number };

export type MensajeEntrante =
  | { tipo: 'avalasoft:sesion'; token: string; empresaId: string | null }
  | { tipo: 'avalasoft:tema'; mode: 'light' | 'dark' }
  | { tipo: 'avalasoft:cerrar-sesion' };

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Valida la forma del mensaje recibido; cualquier otra cosa se ignora. */
export function interpretarMensaje(datos: unknown): MensajeEntrante | null {
  if (!esRegistro(datos) || typeof datos.tipo !== 'string') return null;

  switch (datos.tipo) {
    case 'avalasoft:sesion': {
      if (typeof datos.token !== 'string' || datos.token.split('.').length !== 3) return null;
      const empresaId = typeof datos.empresaId === 'string' && datos.empresaId ? datos.empresaId : null;
      return { tipo: 'avalasoft:sesion', token: datos.token, empresaId };
    }
    case 'avalasoft:tema':
      return datos.mode === 'light' || datos.mode === 'dark' ? { tipo: 'avalasoft:tema', mode: datos.mode } : null;
    case 'avalasoft:cerrar-sesion':
      return { tipo: 'avalasoft:cerrar-sesion' };
    default:
      return null;
  }
}

// Lo que no depende del tipo de mensaje (orígenes permitidos, contenedor, ¿embebida?) es del SDK, que lo comparten las dos apps embebibles.
export {
  cargarOrigenesPermitidos,
  estaEmbebida,
  origenDelContenedor,
  origenesPermitidos,
  origenPermitido,
  RECARGA_ORIGENES_MS,
  RUTA_ORIGENES_PERMITIDOS,
  siguienteListaDeOrigenes,
} from '@avalasoft/sdk';
