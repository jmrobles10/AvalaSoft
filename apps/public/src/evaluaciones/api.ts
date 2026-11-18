import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calcularVisibilidadDeEvaluacionDelTercero,
  confirmarAdjuntoDeEvaluacionDelTercero,
  getListarEvaluacionesDelTerceroQueryOptions,
  getObtenerEvaluacionDelTerceroQueryOptions,
  iniciarAdjuntoDeEvaluacionDelTercero,
  responderEvaluacionDelTercero,
  type AdjuntoDeEvaluacionDto,
  type ResponderEvaluacionDto,
} from '@avalasoft/api-client';

/** Las evaluaciones que una empresa le pide al tercero (autoevaluaciones): las pendientes y las que ya envió, nunca las anuladas ni las vencidas. */
export const useEvaluacionesDelVinculo = (vinculoId: string, habilitado = true) => useQuery({ ...getListarEvaluacionesDelTerceroQueryOptions(vinculoId), enabled: habilitado });

/** Una evaluación con sus preguntas (sin pesos, puntajes, eliminatorias ni umbral) y lo que el tercero ya respondió. */
export const useEvaluacionDelTercero = (vinculoId: string, id: string) => useQuery(getObtenerEvaluacionDelTerceroQueryOptions(vinculoId, id));

/** Qué preguntas se muestran con lo respondido hasta ahora (las condiciones las evalúa la API). */
export function useVisibilidadDelTercero(vinculoId: string, id: string) {
  return useMutation({ mutationFn: (dto: ResponderEvaluacionDto) => calcularVisibilidadDeEvaluacionDelTercero(vinculoId, id, dto) });
}

/** Envía la evaluación. La API la califica pero no devuelve el resultado al tercero; al terminar se refresca todo (la evaluación pasa a «enviada»). */
export function useResponderComoTercero(vinculoId: string, id: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dto: ResponderEvaluacionDto) => responderEvaluacionDelTercero(vinculoId, id, dto),
    onSuccess: () => void cliente.invalidateQueries(),
  });
}

/**
 * Sube un archivo de evidencia en sus dos pasos (URL prefirmada y confirmación) y devuelve el adjunto, que la respuesta de una pregunta de tipo adjunto cita por su id.
 * `fetchFn` se inyecta en las pruebas.
 */
export async function subirEvidenciaDelTercero(
  vinculoId: string,
  evaluacionId: string,
  archivo: File,
  fetchFn: typeof fetch = (...a) => globalThis.fetch(...a),
): Promise<AdjuntoDeEvaluacionDto> {
  const inicio = await iniciarAdjuntoDeEvaluacionDelTercero(vinculoId, evaluacionId, { nombreArchivo: archivo.name, tamanoBytes: archivo.size, tipoMime: archivo.type });
  const respuesta = await fetchFn(inicio.carga.url, { method: inicio.carga.metodo, headers: inicio.carga.cabeceras, body: archivo });
  if (!respuesta.ok) throw new Error(`carga-fallida:${String(respuesta.status)}`);
  return confirmarAdjuntoDeEvaluacionDelTercero(vinculoId, evaluacionId, inicio.cargaId, { nombreArchivo: archivo.name });
}
