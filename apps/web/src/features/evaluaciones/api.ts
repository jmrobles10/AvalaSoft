import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  anularEvaluacion,
  asignarEvaluacion,
  calcularVisibilidadDeEvaluacion,
  confirmarAdjuntoDeEvaluacion,
  crearCuestionario,
  descargarAdjuntoDeEvaluacion,
  editarCuestionario,
  getListarCuestionariosQueryOptions,
  getListarEvaluacionesQueryOptions,
  getObtenerCuestionarioQueryOptions,
  getObtenerEvaluacionQueryOptions,
  getObtenerInformeEvaluacionesQueryOptions,
  iniciarAdjuntoDeEvaluacion,
  publicarCuestionario,
  reabrirEvaluacion,
  recalificarEvaluacion,
  responderEvaluacion,
  simularCuestionario,
  type AdjuntoDeEvaluacionDto,
  type CrearCuestionarioDto,
  type EditarCuestionarioDto,
  type ListarEvaluacionesParams,
  type ObtenerInformeEvaluacionesParams,
  type RecalificarEvaluacionDto,
  type ResponderEvaluacionDto,
  type SimularCuestionarioDto,
} from '@validalo/api-client';
import { conEmpresa, invalidarRuta } from '../../shared/consultas';

/** Cuestionarios de la empresa (`cuestionarios:leer`). */
export function useCuestionarios(empresaId: string, habilitado = true) {
  const opciones = getListarCuestionariosQueryOptions({ request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado });
}

export function useCuestionario(empresaId: string, id: string) {
  const opciones = getObtenerCuestionarioQueryOptions(id, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: Boolean(id) });
}

function useInvalidarCuestionarios() {
  const cliente = useQueryClient();
  return () => invalidarRuta(cliente, '/api/v1/cuestionarios');
}

export function useCrearCuestionario(empresaId: string) {
  const invalidar = useInvalidarCuestionarios();
  return useMutation({ mutationFn: (dto: CrearCuestionarioDto) => crearCuestionario(dto, { empresa: empresaId }), onSuccess: invalidar });
}

export function useEditarCuestionario(empresaId: string, id: string) {
  const invalidar = useInvalidarCuestionarios();
  return useMutation({ mutationFn: (dto: EditarCuestionarioDto) => editarCuestionario(id, dto, { empresa: empresaId }), onSuccess: invalidar });
}

export function usePublicarCuestionario(empresaId: string, id: string) {
  const invalidar = useInvalidarCuestionarios();
  return useMutation({ mutationFn: () => publicarCuestionario(id, { empresa: empresaId }), onSettled: invalidar });
}

/** Prueba el cuestionario con respuestas inventadas, sin guardar nada. */
export function useSimularCuestionario(empresaId: string, id: string) {
  return useMutation({ mutationFn: (dto: SimularCuestionarioDto) => simularCuestionario(id, dto, { empresa: empresaId }) });
}

/** Evaluaciones de la empresa (`evaluaciones:leer`), las más recientes primero. */
export function useEvaluaciones(empresaId: string, filtros: ListarEvaluacionesParams, habilitado = true) {
  const opciones = getListarEvaluacionesQueryOptions(filtros, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado });
}

export function useEvaluacion(empresaId: string, id: string) {
  const opciones = getObtenerEvaluacionQueryOptions(id, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: Boolean(id) });
}

export function useInformeEvaluaciones(empresaId: string, filtros: ObtenerInformeEvaluacionesParams, habilitado = true) {
  const opciones = getObtenerInformeEvaluacionesQueryOptions(filtros, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado });
}

/** Lo que cambia con una evaluación: ella, sus listas, los expedientes que la esperan (se cierran en el acto) y los certificados. */
function useInvalidarEvaluaciones() {
  const cliente = useQueryClient();
  return async () => {
    await Promise.all(['/api/v1/evaluaciones', '/api/v1/expedientes', '/api/v1/informes', '/api/v1/vinculos', '/api/v1/certificados', '/api/v1/bandeja'].map((ruta) => invalidarRuta(cliente, ruta)));
  };
}

export function useAsignarEvaluacion(empresaId: string, vinculoId: string) {
  const invalidar = useInvalidarEvaluaciones();
  return useMutation({
    mutationFn: (cuestionarioId: string) => asignarEvaluacion(vinculoId, { cuestionarioId }, { empresa: empresaId }),
    onSuccess: invalidar,
  });
}

/** Qué preguntas se muestran con las respuestas que lleva la persona (las condiciones las evalúa la API). */
export function useVisibilidad(empresaId: string, id: string) {
  return useMutation({ mutationFn: (dto: ResponderEvaluacionDto) => calcularVisibilidadDeEvaluacion(id, dto, { empresa: empresaId }) });
}

export function useResponderEvaluacion(empresaId: string, id: string) {
  const invalidar = useInvalidarEvaluaciones();
  return useMutation({ mutationFn: (dto: ResponderEvaluacionDto) => responderEvaluacion(id, dto, { empresa: empresaId }), onSuccess: invalidar });
}

export function useRecalificarEvaluacion(empresaId: string, id: string) {
  const invalidar = useInvalidarEvaluaciones();
  return useMutation({ mutationFn: (dto: RecalificarEvaluacionDto) => recalificarEvaluacion(id, dto, { empresa: empresaId }), onSuccess: invalidar });
}

export function useReabrirEvaluacion(empresaId: string, id: string) {
  const invalidar = useInvalidarEvaluaciones();
  return useMutation({ mutationFn: (justificacion: string) => reabrirEvaluacion(id, { justificacion }, { empresa: empresaId }), onSuccess: invalidar });
}

export function useAnularEvaluacion(empresaId: string, id: string) {
  const invalidar = useInvalidarEvaluaciones();
  return useMutation({ mutationFn: (justificacion: string) => anularEvaluacion(id, { justificacion }, { empresa: empresaId }), onSuccess: invalidar });
}

/**
 * Sube un archivo de evidencia en sus dos pasos (URL prefirmada y confirmación) y devuelve el adjunto, que la respuesta de una pregunta de tipo adjunto cita por su id.
 * `fetchFn` se inyecta en las pruebas.
 */
export async function subirEvidencia(
  empresaId: string,
  evaluacionId: string,
  archivo: File,
  fetchFn: typeof fetch = (...a) => globalThis.fetch(...a),
): Promise<AdjuntoDeEvaluacionDto> {
  const opciones = { empresa: empresaId };
  const inicio = await iniciarAdjuntoDeEvaluacion(evaluacionId, { nombreArchivo: archivo.name, tamanoBytes: archivo.size, tipoMime: archivo.type }, opciones);
  const respuesta = await fetchFn(inicio.carga.url, { method: inicio.carga.metodo, headers: inicio.carga.cabeceras, body: archivo });
  if (!respuesta.ok) throw new Error(`carga-fallida:${String(respuesta.status)}`);
  return confirmarAdjuntoDeEvaluacion(evaluacionId, inicio.cargaId, { nombreArchivo: archivo.name }, opciones);
}

/** URL prefirmada (5 min) de un archivo de evidencia; la descarga queda en la auditoría. */
export function urlDeEvidencia(empresaId: string, evaluacionId: string, adjuntoId: string) {
  return descargarAdjuntoDeEvaluacion(evaluacionId, adjuntoId, { empresa: empresaId });
}
