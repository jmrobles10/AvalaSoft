import type { EvaluacionPublicaResumenDto } from '@avalasoft/api-client';

/** Las evaluaciones que el tercero aún debe responder (las ya enviadas no se vuelven a pedir). */
export function evaluacionesPendientes(evaluaciones: readonly EvaluacionPublicaResumenDto[] | null | undefined): EvaluacionPublicaResumenDto[] {
  return (evaluaciones ?? []).filter((e) => e.estado === 'Pendiente');
}
