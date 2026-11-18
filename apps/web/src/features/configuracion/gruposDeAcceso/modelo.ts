import { NivelDeSector, type GrupoDeAccesoDto, type SectorDeGrupoDto } from '@avalasoft/api-client';
import { SECCIONES_FICHA, type CodigoSeccionFicha } from '../../terceros/ficha/secciones';

/**
 * Grupos de acceso de la empresa (GA-1…GA-9): permisos del catálogo, acotados opcionalmente por sector de la ficha. Replica las reglas de
 * `GrupoDePermisos` del dominio para avisar antes de enviar; la API vuelve a validar.
 */

/** Código del grupo: mayúsculas, empieza con letra y usa números y guion bajo (2 a 40 caracteres). */
export const FORMA_DEL_CODIGO = /^[A-Z][A-Z0-9_]{1,39}$/;

/** Los permisos que un grupo no puede llevar: `sesiones-tercero:crear` solo la usa la API key de un sistema integrador. */
export const PERMISOS_QUE_UN_GRUPO_NO_LLEVA = ['sesionesTerceroCrear'] as const;

export const NOMBRE_MAXIMO = 80;
export const DESCRIPCION_MAXIMA = 300;

export interface SectorEnEditor {
  sector: CodigoSeccionFicha;
  nivel: NivelDeSector;
}

export interface GrupoEnEditor {
  codigo: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
  /** Vacío = todos los sectores de la ficha (sin acotar). */
  sectores: SectorEnEditor[];
}

export type ErrorDeGrupo = 'codigo-invalido' | 'nombre-requerido' | 'nombre-demasiado-largo' | 'descripcion-demasiado-larga' | 'permisos-requeridos';

export function grupoNuevo(): GrupoEnEditor {
  return { codigo: '', nombre: '', descripcion: '', permisos: [], sectores: [] };
}

const esSector = (codigo: string): codigo is CodigoSeccionFicha => SECCIONES_FICHA.some((s) => s.codigo === codigo);

export function grupoDesde(grupo: GrupoDeAccesoDto): GrupoEnEditor {
  return {
    codigo: grupo.codigo,
    nombre: grupo.nombre,
    descripcion: grupo.descripcion ?? '',
    permisos: [...grupo.permisos],
    sectores: grupo.sectores.flatMap((s) => (esSector(s.sector) ? [{ sector: s.sector, nivel: s.nivel }] : [])),
  };
}

/** El código como lo normaliza la API (mayúsculas, sin espacios a los lados). */
export const normalizarCodigoDeGrupo = (codigo: string) => codigo.trim().toUpperCase();

/** Errores que impiden guardar; `nuevo` valida además el código (inmutable después). */
export function validarGrupo(grupo: GrupoEnEditor, nuevo: boolean): ErrorDeGrupo[] {
  const errores: ErrorDeGrupo[] = [];
  if (nuevo && !FORMA_DEL_CODIGO.test(normalizarCodigoDeGrupo(grupo.codigo))) errores.push('codigo-invalido');
  if (grupo.nombre.trim().length === 0) errores.push('nombre-requerido');
  else if (grupo.nombre.trim().length > NOMBRE_MAXIMO) errores.push('nombre-demasiado-largo');
  if (grupo.descripcion.length > DESCRIPCION_MAXIMA) errores.push('descripcion-demasiado-larga');
  if (grupo.permisos.length === 0) errores.push('permisos-requeridos');
  return errores;
}

/** Los sectores como los recibe la API, en el orden de la ficha (así lo guardado no depende del orden en que se marcaron). */
export function sectoresADto(sectores: readonly SectorEnEditor[]): SectorDeGrupoDto[] {
  return enOrdenDeLaFicha(sectores).map((s) => ({ sector: s.sector, nivel: s.nivel }));
}

/** Agrega el sector con el nivel mínimo (Ver) o lo quita si ya estaba. */
export function alternarSector(sectores: readonly SectorEnEditor[], sector: CodigoSeccionFicha): SectorEnEditor[] {
  return sectores.some((s) => s.sector === sector) ? sectores.filter((s) => s.sector !== sector) : [...sectores, { sector, nivel: NivelDeSector.Ver }];
}

export function cambiarNivel(sectores: readonly SectorEnEditor[], sector: CodigoSeccionFicha, nivel: NivelDeSector): SectorEnEditor[] {
  return sectores.map((s) => (s.sector === sector ? { ...s, nivel } : s));
}

/** Los sectores en el orden de la ficha, para mostrarlos igual en la tabla y en el formulario. */
export function enOrdenDeLaFicha<T extends { sector: string }>(sectores: readonly T[]): T[] {
  const orden = SECCIONES_FICHA.map((s) => s.codigo as string);
  return [...sectores].sort((a, b) => orden.indexOf(a.sector) - orden.indexOf(b.sector));
}

/** Firma comparable del contenido editable (para saber si hay cambios sin guardar). */
export function firmaDeGrupo(grupo: GrupoEnEditor): string {
  return JSON.stringify({
    nombre: grupo.nombre.trim(),
    descripcion: grupo.descripcion.trim(),
    permisos: [...grupo.permisos].sort(),
    sectores: enOrdenDeLaFicha(grupo.sectores),
  });
}
