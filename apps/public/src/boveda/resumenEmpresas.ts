import type { ComparticionPublicaDto, DocumentoBovedaDto } from '@validalo/api-client';
import { clasificarComparticion, type Situacion, type TonoDeComparticion } from './versiones';

/**
 * Hasta cuántas empresas se nombran una por una (chip «Empresa · aprobada v1» y frase completa). Con más, la columna «Empresas» y el
 * aviso «Por renovar» se resumen para que la fila mida lo mismo con 3 que con 30 empresas.
 */
export const MAXIMO_EMPRESAS_POR_NOMBRE = 2;

/** Con más empresas que esto, el detalle desplegable trae un buscador por nombre. */
export const EMPRESAS_PARA_BUSCAR = 8;

/**
 * Los estados en que se agrupan las empresas de un documento, en el orden en que se muestran: primero lo que pide algo del tercero, luego
 * lo que espera a la empresa y al final lo que está bien. Las empresas que no exigen el documento no tienen grupo: no se muestran.
 */
const GRUPOS = ['SinVigente', 'Observada', 'Revalida', 'Revisando', 'AproboVigente', 'TieneVigente', 'TieneOtra'] as const;

export type GrupoDeEmpresas = (typeof GRUPOS)[number];

/** Las tres situaciones de revalidación dicen lo mismo en el chip («revalida v2»): cuentan juntas. */
const GRUPO_DE_SITUACION: Readonly<Record<Situacion, GrupoDeEmpresas | null>> = {
  NoRecibe: null,
  SinVigente: 'SinVigente',
  TieneVigente: 'TieneVigente',
  AproboVigente: 'AproboVigente',
  Revisando: 'Revisando',
  Observada: 'Observada',
  RevalidaRetirada: 'Revalida',
  Revalida: 'Revalida',
  PorRevalidar: 'Revalida',
  TieneOtra: 'TieneOtra',
};

/** Las empresas de un documento que están en el mismo estado, con el tono (el mismo del chip por empresa) y si piden algo del tercero. */
export interface EmpresasDeUnGrupo {
  grupo: GrupoDeEmpresas;
  tono: TonoDeComparticion;
  pideAccion: boolean;
  /** Ordenadas por nombre. */
  empresas: ComparticionPublicaDto[];
}

const porNombre = (a: ComparticionPublicaDto, b: ComparticionPublicaDto) => a.empresa.nombre.localeCompare(b.empresa.nombre, 'es');

/** Agrupa las empresas que exigen el documento por su estado, en el orden de {@link GRUPOS}; no devuelve grupos vacíos ni las que no lo exigen. */
export function agruparEmpresas(porEmpresa: readonly ComparticionPublicaDto[]): EmpresasDeUnGrupo[] {
  const grupos = new Map<GrupoDeEmpresas, EmpresasDeUnGrupo>();
  for (const c of porEmpresa) {
    const { situacion, tono, pideAccion } = clasificarComparticion(c);
    const grupo = GRUPO_DE_SITUACION[situacion];
    if (grupo === null) continue;
    const existente = grupos.get(grupo);
    if (existente) existente.empresas.push(c);
    else grupos.set(grupo, { grupo, tono, pideAccion, empresas: [c] });
  }
  return GRUPOS.flatMap((g) => {
    const encontrado = grupos.get(g);
    return encontrado ? [{ ...encontrado, empresas: [...encontrado.empresas].sort(porNombre) }] : [];
  });
}

/** Un chip del resumen: cuántas empresas están en ese estado. `AlDia` junta a todas cuando no hay nada pendiente. */
export interface ChipDeResumen {
  clave: GrupoDeEmpresas | 'AlDia';
  cantidad: number;
  tono: TonoDeComparticion;
}

/** Qué mostrar en la columna «Empresas» de un documento. */
export type ResumenDeEmpresas =
  /** El documento no tiene ninguna empresa en su lista. */
  | { modo: 'vacio' }
  /** Hay empresas, pero ninguna exige este documento (no se listan: «Ninguna empresa la exige»). */
  | { modo: 'ninguna' }
  /** Pocas empresas: una por una, como siempre. */
  | { modo: 'nombres'; empresas: readonly ComparticionPublicaDto[] }
  /** Muchas: chips de conteo por estado (los que piden algo primero) y, al abrirlos, el detalle por estado. */
  | { modo: 'resumen'; total: number; chips: ChipDeResumen[]; grupos: EmpresasDeUnGrupo[] };

/**
 * El resumen de la columna «Empresas». Las empresas que no exigen el documento no cuentan (ni se nombran). Con más de
 * {@link MAXIMO_EMPRESAS_POR_NOMBRE} que sí lo exigen: un chip por estado, con lo que pide algo primero («1 sin versión», «3 revalidan»,
 * «24 aprobadas»). Si no hay nada pendiente, un solo chip («Al día con 25 empresas»).
 */
export function resumirEmpresas(porEmpresa: readonly ComparticionPublicaDto[]): ResumenDeEmpresas {
  if (porEmpresa.length === 0) return { modo: 'vacio' };
  const exigen = porEmpresa.filter((c) => clasificarComparticion(c).situacion !== 'NoRecibe');
  if (exigen.length === 0) return { modo: 'ninguna' };
  if (exigen.length <= MAXIMO_EMPRESAS_POR_NOMBRE) return { modo: 'nombres', empresas: exigen };

  const grupos = agruparEmpresas(exigen);
  const hayPendientes = grupos.some((g) => g.tono === 'advertencia');
  const chips: ChipDeResumen[] = hayPendientes
    ? grupos.map((g) => ({ clave: g.grupo, cantidad: g.empresas.length, tono: g.tono }))
    : [{ clave: 'AlDia', cantidad: exigen.length, tono: 'exito' }];
  return { modo: 'resumen', total: exigen.length, chips, grupos };
}

/** Minúsculas y sin tildes, para buscar «ñ»/«á» escribiendo sin ellas. */
export function normalizarTexto(valor: string): string {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Los elementos cuyo nombre contiene el texto (sin distinguir mayúsculas ni tildes); sin texto, todos. */
export function buscarPorNombre<T>(elementos: readonly T[], texto: string, nombreDe: (elemento: T) => string): T[] {
  const buscado = normalizarTexto(texto);
  return buscado === '' ? [...elementos] : elementos.filter((e) => normalizarTexto(nombreDe(e)).includes(buscado));
}

/** Lo mismo que {@link agruparEmpresas}, pero solo con las empresas cuyo nombre coincide con la búsqueda; sin grupos vacíos. */
export function buscarEnGrupos(grupos: readonly EmpresasDeUnGrupo[], texto: string): EmpresasDeUnGrupo[] {
  return grupos.flatMap((g) => {
    const empresas = buscarPorNombre(g.empresas, texto, (c) => c.empresa.nombre);
    return empresas.length > 0 ? [{ ...g, empresas }] : [];
  });
}

/** Una empresa del tercero para el filtro de la bóveda. */
export interface OpcionDeEmpresa {
  id: string;
  nombre: string;
}

/** Las empresas con las que el tercero comparte algún documento (sin repetirse), por nombre: las opciones del filtro «Empresa». */
export function empresasDeLaBoveda(documentos: readonly Pick<DocumentoBovedaDto, 'porEmpresa'>[]): OpcionDeEmpresa[] {
  const empresas = new Map<string, OpcionDeEmpresa>();
  for (const documento of documentos) {
    for (const c of documento.porEmpresa) if (!empresas.has(c.empresa.id)) empresas.set(c.empresa.id, { id: c.empresa.id, nombre: c.empresa.nombre });
  }
  return [...empresas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** La empresa del filtro si existe entre las opciones; un id desconocido (un enlace viejo) se lee como «Todas». */
export function empresaDelFiltro(opciones: readonly OpcionDeEmpresa[], empresaId: string | null): OpcionDeEmpresa | null {
  return opciones.find((o) => o.id === empresaId) ?? null;
}

/** Lo que tiene de este documento la empresa del filtro; sin filtro (`null`), todas. */
export function comparticionesDeLaEmpresa(porEmpresa: readonly ComparticionPublicaDto[], empresaId: string | null): ComparticionPublicaDto[] {
  return empresaId === null ? [...porEmpresa] : porEmpresa.filter((c) => c.empresa.id === empresaId);
}

/** Los documentos con solo la empresa del filtro (para el aviso «Por renovar»); sin filtro, los mismos. */
export function documentosDeLaEmpresa(documentos: readonly DocumentoBovedaDto[], empresaId: string | null): readonly DocumentoBovedaDto[] {
  return empresaId === null ? documentos : documentos.map((d) => ({ ...d, porEmpresa: comparticionesDeLaEmpresa(d.porEmpresa, empresaId) }));
}
