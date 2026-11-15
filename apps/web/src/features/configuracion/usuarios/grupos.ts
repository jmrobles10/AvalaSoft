import type { AsignacionDeGrupoDto, GrupoDeAccesoDto, RolAsignadoDto } from '@validasoft/api-client';
import { ALCANCE_TENANT } from './roles';

/** Una fila del formulario de grupos propios: el grupo y dónde vale (id de empresa o `TENANT`). */
export interface FilaGrupo {
  grupoId: string;
  alcance: string;
}

export function aFilasDeGrupos(asignaciones: readonly AsignacionDeGrupoDto[]): FilaGrupo[] {
  return asignaciones.map((g) => ({ grupoId: g.grupoId, alcance: g.empresaId ?? ALCANCE_TENANT }));
}

/** Filas del formulario → asignaciones para la API, sin duplicados y sin filas sin grupo. */
export function aAsignaciones(filas: readonly FilaGrupo[]): AsignacionDeGrupoDto[] {
  const vistas = new Set<string>();
  const asignaciones: AsignacionDeGrupoDto[] = [];
  for (const fila of filas) {
    const clave = `${fila.grupoId}|${fila.alcance}`;
    if (!fila.grupoId || vistas.has(clave)) continue;
    vistas.add(clave);
    asignaciones.push({ grupoId: fila.grupoId, empresaId: fila.alcance === ALCANCE_TENANT ? null : fila.alcance });
  }
  return asignaciones;
}

/**
 * Los roles de la persona como sus grupos predefinidos: `PUT /usuarios/{id}/grupos` reemplaza todo (roles y grupos propios) de una vez. Un rol cuyo grupo
 * predefinido no está en la lista (la lista no cargó) se descarta aquí: quien llama debe esperar a tenerla.
 */
export function rolesComoGrupos(roles: readonly RolAsignadoDto[], grupos: readonly GrupoDeAccesoDto[]): AsignacionDeGrupoDto[] {
  return roles.flatMap((r) => {
    const predefinido = grupos.find((g) => g.predefinido && g.rol === r.rol);
    return predefinido ? [{ grupoId: predefinido.id, empresaId: r.empresaId }] : [];
  });
}

/** Grupos que se pueden elegir en una fila: los propios activos y el que la fila ya tiene (aunque se haya desactivado, para no perderlo sin querer). */
export function gruposElegibles(grupos: readonly GrupoDeAccesoDto[], actual: string): GrupoDeAccesoDto[] {
  return grupos.filter((g) => !g.predefinido && (g.activo || g.id === actual));
}
