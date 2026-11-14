import type { DestinoCarga } from './subida';

/** Destino fijado por el enlace de un requisito; `null` si el tercero elige el tipo. */
export function destinoFijo(parametros: URLSearchParams): { destino: DestinoCarga; nombre: string } | null {
  const nombre = parametros.get('nombre') ?? '';
  const tipoDocumentoTenantId = parametros.get('tipoDocumentoTenantId');
  const vinculoId = parametros.get('vinculoId');
  if (tipoDocumentoTenantId && vinculoId) return { destino: { tipoDocumentoTenantId, vinculoId }, nombre };
  const tipo = parametros.get('tipo');
  // El documento de una persona relacionada (ADR-0010) va a la bóveda de la persona; sin vínculo de contexto: no es de una empresa.
  const persona = parametros.get('persona');
  if (tipo && persona && nombre) return { destino: { tipoCanonico: tipo, terceroRelacionadoId: persona }, nombre };
  if (tipo && nombre) return { destino: vinculoId ? { tipoCanonico: tipo, vinculoId } : { tipoCanonico: tipo }, nombre };
  return null;
}

/** Solo rutas de esta app (`/…`, nunca `//otro-sitio`): `volver` llega en la URL. */
export function rutaSegura(ruta: string | null): string | null {
  return ruta?.startsWith('/') && !ruta.startsWith('//') ? ruta : null;
}
