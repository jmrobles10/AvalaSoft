import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarFuentesOficiales,
  consultarVerificacion,
  descargarEvidenciaMonitoreoDeFuente,
  descargarEvidenciaVerificacion,
  getObtenerExpedienteQueryKey,
  getObtenerFuentesOficialesQueryOptions,
  getObtenerMonitoreoFuentesOficialesQueryOptions,
  resolverDiferenciaDeFuente,
  resolverDiferenciaMonitoreoDeFuente,
  type ActualizarFuentesOficialesDto,
  type DecisionCoincidencia,
  type DescargaEvidenciaDto,
  type ExpedienteDto,
} from '@avalasoft/api-client';
import { abrirDescarga } from '@avalasoft/ui';
import { conEmpresa, invalidarRuta } from '../../shared/consultas';
import { invalidarExpedientes } from '../expedientes/api';
import type { FuenteDeVerificacion } from './modelo';

/** Configuración de las fuentes oficiales de la empresa (`GET /configuracion/fuentes-oficiales`). */
export function useFuentesOficiales(empresaId: string, habilitado = true) {
  const opciones = getObtenerFuentesOficialesQueryOptions({ request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado });
}

export function useActualizarFuentesOficiales(empresaId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dto: ActualizarFuentesOficialesDto) => actualizarFuentesOficiales(dto, { empresa: empresaId }),
    onSuccess: (configuracion) => cliente.setQueryData(conEmpresa(getObtenerFuentesOficialesQueryOptions().queryKey, empresaId), configuracion),
  });
}

/** Una acción sobre la fuente de un expediente: consultar o reconsultar, o decidir una diferencia con justificación. */
export type AccionDeFuente =
  | { tipo: 'consultar'; fuente: FuenteDeVerificacion }
  | { tipo: 'resolver'; fuente: FuenteDeVerificacion; campoId: string; decision: DecisionCoincidencia; justificacion: string };

export function ejecutarAccionDeFuente(empresaId: string, expedienteId: string, accion: AccionDeFuente): Promise<ExpedienteDto> {
  const opciones = { empresa: empresaId };
  return accion.tipo === 'consultar'
    ? consultarVerificacion(expedienteId, accion.fuente, opciones)
    : resolverDiferenciaDeFuente(expedienteId, accion.fuente, accion.campoId, { decision: accion.decision, justificacion: accion.justificacion.trim() }, opciones);
}

/** Como las decisiones de cumplimiento: la respuesta reemplaza el expediente en caché y el resto (bandejas, vínculo) se refresca. */
export function useAccionDeFuente(empresaId: string, expedienteId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (accion: AccionDeFuente) => ejecutarAccionDeFuente(empresaId, expedienteId, accion),
    onSuccess: (expediente) => cliente.setQueryData(conEmpresa(getObtenerExpedienteQueryKey(expedienteId), empresaId), expediente),
    onSettled: () => {
      void invalidarExpedientes(cliente);
      void invalidarRuta(cliente, '/api/v1/cumplimiento');
    },
  });
}

/** La constancia lleva `nombreArchivo` donde las demás descargas llevan `nombre`. */
function abrirConstancia(descarga: DescargaEvidenciaDto): DescargaEvidenciaDto {
  abrirDescarga({ url: descarga.url, nombre: descarga.nombreArchivo });
  return descarga;
}

/** Descarga auditada de la constancia de una consulta (URL prefirmada de 5 minutos); `referencia` = una consulta anterior. */
export function useDescargarConstancia(empresaId: string) {
  return useMutation({
    mutationFn: async ({ expedienteId, fuente, referencia }: { expedienteId: string; fuente: FuenteDeVerificacion; referencia?: string }) =>
      abrirConstancia(await descargarEvidenciaVerificacion(expedienteId, fuente, referencia ? { referencia } : undefined, { empresa: empresaId })),
  });
}

/** Monitoreo del vínculo (`GET /vinculos/{id}/monitoreo-fuentes-oficiales`); sin monitoreo responde 404 y no se reintenta. */
export function useMonitoreoFuentes(empresaId: string, vinculoId: string, habilitado = true) {
  const opciones = getObtenerMonitoreoFuentesOficialesQueryOptions(vinculoId, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado && Boolean(vinculoId), retry: false });
}

export function useResolverDiferenciaDeMonitoreo(empresaId: string, vinculoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ fuente, campoId, decision, justificacion }: { fuente: FuenteDeVerificacion; campoId: string; decision: DecisionCoincidencia; justificacion: string }) =>
      resolverDiferenciaMonitoreoDeFuente(vinculoId, fuente, campoId, { decision, justificacion: justificacion.trim() }, { empresa: empresaId }),
    onSettled: () => Promise.all([invalidarRuta(cliente, '/api/v1/vinculos'), invalidarRuta(cliente, '/api/v1/cumplimiento')]),
  });
}

export function useDescargarConstanciaDeMonitoreo(empresaId: string) {
  return useMutation({
    mutationFn: async ({ vinculoId, fuente }: { vinculoId: string; fuente: FuenteDeVerificacion }) =>
      abrirConstancia(await descargarEvidenciaMonitoreoDeFuente(vinculoId, fuente, { empresa: empresaId })),
  });
}
