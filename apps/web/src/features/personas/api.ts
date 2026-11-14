import { useQuery } from '@tanstack/react-query';
import { getListarPersonasDelVinculoQueryOptions, type DocumentoVistaEmpresaDto, type PersonaDelVinculoDto } from '@validasoft/api-client';
import { conEmpresa } from '../../shared/consultas';

/**
 * Las personas relacionadas del tercero de un vínculo que el flujo de la empresa involucra (ADR-0010), con los documentos de su bóveda compartidos con ese vínculo.
 * Como los documentos del vínculo, solo existe tras la aceptación del tercero y pide `documentos:leer`.
 */
export function usePersonasDelVinculo(empresaId: string, vinculoId: string, habilitado: boolean) {
  const opciones = getListarPersonasDelVinculoQueryOptions(vinculoId, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado && Boolean(vinculoId) });
}

/** Los documentos de todas las personas, en la forma de los documentos del vínculo: así se ven sus hechos de IA al revisar. */
export function documentosDePersonas(personas: readonly PersonaDelVinculoDto[] | undefined): DocumentoVistaEmpresaDto[] {
  return (personas ?? []).flatMap((p) => p.documentos);
}
