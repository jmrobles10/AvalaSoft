import type {
  EstadoExpediente,
  EstadoVinculo,
  ObtenerInformeEstadoExpedientesParams,
  ObtenerInformeVinculosParams,
  ResumenEstadoExpedientesDto,
  TipoExpediente,
} from '@validalo/api-client';
import { LOCALE } from '@validalo/ui';

export const ESTADOS_EXPEDIENTE: readonly EstadoExpediente[] = ['Abierto', 'EnRevision', 'Observado', 'Aprobado', 'Rechazado', 'Anulado', 'Caducado'];
export const TIPOS_EXPEDIENTE: readonly TipoExpediente[] = ['Inicial', 'Renovacion', 'Actualizacion'];
/** Lo que el informe cuenta como «estado» de un vínculo: los del dominio y «En revisión» (VR-1: una actualización abierta; el estado no cambia). */
export const ESTADOS_VINCULO: readonly (EstadoVinculo | 'EnRevision')[] = [
  'Invitado', 'EnValidacion', 'EnRevision', 'Activo', 'PorVencer', 'Vencido', 'Bloqueado', 'Desvinculado', 'Anulado',
];
export const CAMPOS_FECHA = ['Apertura', 'Cierre'] as const;
export type CampoFecha = (typeof CAMPOS_FECHA)[number];

/** Rutas de descarga (la consulta JSON va por el cliente generado). */
export const RUTAS = {
  estadoExcel: '/api/v1/informes/estado-expedientes/excel',
  estadoPdf: '/api/v1/informes/estado-expedientes/pdf',
  vinculosExcel: '/api/v1/informes/vinculos/excel',
  slaExcel: '/api/v1/informes/sla/excel',
  evaluacionesExcel: '/api/v1/informes/evaluaciones/excel',
  auditoriaExcel: '/api/v1/auditoria/excel',
  expedienteZip: (id: string) => `/api/v1/expedientes/${id}/exportar`,
} as const;

/** Filtros del informe de estado en la URL (vacío = sin filtro). */
export interface FiltrosEstado {
  estado: string;
  tipo: string;
  areaId: string;
  flujoId: string;
  tipoVinculoId: string;
  terceroId: string;
  fecha: CampoFecha;
  desde: string;
  hasta: string;
}

const CLAVES_ESTADO = ['estado', 'tipo', 'areaId', 'flujoId', 'tipoVinculoId', 'terceroId', 'desde', 'hasta'] as const;

export function leerFiltrosEstado(p: URLSearchParams): FiltrosEstado {
  const leer = (clave: string) => p.get(clave) ?? '';
  return {
    estado: leer('estado'),
    tipo: leer('tipo'),
    areaId: leer('areaId'),
    flujoId: leer('flujoId'),
    tipoVinculoId: leer('tipoVinculoId'),
    terceroId: leer('terceroId'),
    fecha: p.get('fecha') === 'Cierre' ? 'Cierre' : 'Apertura',
    desde: leer('desde'),
    hasta: leer('hasta'),
  };
}

export function hayFiltrosEstado(f: FiltrosEstado): boolean {
  return CLAVES_ESTADO.some((c) => f[c] !== '') || f.fecha !== 'Apertura';
}

export function rangoInvalido(f: Pick<FiltrosEstado, 'desde' | 'hasta'>): boolean {
  return f.desde !== '' && f.hasta !== '' && f.desde > f.hasta;
}

/** Parámetros de la API: lo vacío no viaja; la fecha de cierre solo si hay rango. */
export function parametrosEstado(f: FiltrosEstado): ObtenerInformeEstadoExpedientesParams {
  const p: ObtenerInformeEstadoExpedientesParams = {};
  for (const clave of CLAVES_ESTADO) if (f[clave]) p[clave] = f[clave];
  if (f.fecha === 'Cierre') p.fecha = 'Cierre';
  return p;
}

export interface FiltrosVinculos {
  estado: string;
  tipoVinculoId: string;
}

export function leerFiltrosVinculos(p: URLSearchParams): FiltrosVinculos {
  return { estado: p.get('estado') ?? '', tipoVinculoId: p.get('tipoVinculoId') ?? '' };
}

export function parametrosVinculos(f: FiltrosVinculos): ObtenerInformeVinculosParams {
  return { estado: f.estado || undefined, tipoVinculoId: f.tipoVinculoId || undefined };
}

/** Quita lo que la consulta pagina (`limite`, `cursor`): la descarga lleva todas las filas con los mismos filtros. */
export function sinPaginacion<T extends { limite?: number; cursor?: string }>(params: T): Omit<T, 'limite' | 'cursor'> {
  const { limite: _limite, cursor: _cursor, ...resto } = params;
  return resto;
}

/** El contrato admite los días como número o texto (decimal de .NET); `null` si no hay dato. */
export function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

const UN_DECIMAL = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** «4,5» o `sinDato`. */
export function formatearDias(valor: number | string | null | undefined, sinDato: string): string {
  const numero = aNumero(valor);
  return numero === null ? sinDato : UN_DECIMAL.format(numero);
}

/** `YYYY-MM-DD` de hoy en la zona del negocio, menos `dias`. */
export function fechaNegocio(dias = 0, ahora = new Date()): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(ahora);
  const [a, m, d] = hoy.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
}

/**
 * Enlace de Inicio al informe con la misma ventana de los indicadores (IF-7): aprobados cerrados hoy y los `dias - 1`
 * anteriores.
 */
export function rutaInformeDeVentana(empresaId: string, dias: number, ahora = new Date()): string {
  const desde = fechaNegocio(dias - 1, ahora);
  return `/e/${empresaId}/informes/estado-expedientes?fecha=Cierre&estado=Aprobado&desde=${desde}`;
}

export type FaseTiempo = 'carga' | 'tercero' | 'revision';

export interface TiempoDeFase {
  fase: FaseTiempo;
  /** Promedio de días en la fase; `null` si no hay dato. */
  dias: number | null;
  /** Peso de la fase sobre la suma de las tres, de 0 a 100 (0 si no hay nada que repartir). */
  porcentaje: number;
}

/** El tiempo de apertura a aprobación repartido en carga, con el tercero y en revisión, con el peso de cada fase. */
export function tiemposPorFase(r: Pick<ResumenEstadoExpedientesDto, 'promedioEnCargaDias' | 'promedioConTerceroDias' | 'promedioEnRevisionDias'>): TiempoDeFase[] {
  const fases: { fase: FaseTiempo; dias: number | null }[] = [
    { fase: 'carga', dias: aNumero(r.promedioEnCargaDias) },
    { fase: 'tercero', dias: aNumero(r.promedioConTerceroDias) },
    { fase: 'revision', dias: aNumero(r.promedioEnRevisionDias) },
  ];
  const suma = fases.reduce((total, f) => total + Math.max(0, f.dias ?? 0), 0);
  return fases.map((f) => ({ ...f, porcentaje: suma > 0 ? (Math.max(0, f.dias ?? 0) / suma) * 100 : 0 }));
}

/** El máximo de días de las áreas: el tope común de las barras, para que se comparen entre sí. */
export function topeDeAreas(areas: readonly Pick<ResumenEstadoExpedientesDto['porArea'][number], 'promedioDias' | 'maximoDias'>[]): number {
  return areas.reduce((tope, a) => Math.max(tope, aNumero(a.maximoDias) ?? 0, aNumero(a.promedioDias) ?? 0), 0);
}
