import type { IndicadoresDto, MisPendientesDto, PendientesDeAreaDto } from '@validalo/api-client';
import { LOCALE, type TonoKpi } from '@validalo/ui';
import type { TFunction } from 'i18next';

/** Ventanas del selector de indicadores, en días. */
export const VENTANAS = [7, 30, 90] as const;
export type Ventana = (typeof VENTANAS)[number];
export const VENTANA_POR_DEFECTO: Ventana = 30;

function esVentana(valor: number): valor is Ventana {
  return (VENTANAS as readonly number[]).includes(valor);
}

/** Ventana de la URL (`?dias=`); lo que no sea una opción válida vuelve a 30. */
export function leerVentana(params: URLSearchParams): Ventana {
  const dias = Number(params.get('dias') ?? VENTANA_POR_DEFECTO);
  return esVentana(dias) ? dias : VENTANA_POR_DEFECTO;
}

/** Hace cuánto llegó el expediente más antiguo del área: «el más antiguo hace 5 días» o «el más antiguo es de hoy». */
export function antiguedadDeArea(area: PendientesDeAreaDto, t: TFunction): string {
  return area.masAntiguoDias === 0 ? t('inicio.pendientes.antiguoHoy') : t('inicio.pendientes.antiguo', { count: area.masAntiguoDias });
}

/** «Compras: 3 expedientes por revisar · el más antiguo hace 5 días», o «Compras: Al día». */
export function textoArea(area: PendientesDeAreaDto, t: TFunction): string {
  if (area.cantidad === 0) return t('inicio.pendientes.area', { nombre: area.nombre, detalle: t('inicio.pendientes.alDia') });
  return t('inicio.pendientes.area', { nombre: area.nombre, detalle: `${t('inicio.pendientes.porRevisar', { count: area.cantidad })} · ${antiguedadDeArea(area, t)}` });
}

export type ClaveAcceso = 'revalidaciones' | 'cuentas' | 'aperturas' | 'porVencer' | 'vencidos';

/** Un pendiente que no es de un área: cuántos son y a qué pantalla lleva (`null` si aún no tiene una propia). */
export interface Acceso {
  clave: ClaveAcceso;
  cantidad: number;
  ruta: string | null;
  /** Revalidaciones cuyo plazo ya venció y bloquean el certificado. */
  bloqueantes?: number;
}

/** Los accesos con algo pendiente, en el orden en que se muestran. */
export function accesosPendientes(p: MisPendientesDto): Acceso[] {
  const todos: Acceso[] = [
    { clave: 'revalidaciones', cantidad: p.revalidaciones, ruta: 'revalidaciones', bloqueantes: p.revalidacionesBloqueantes },
    // Las cuentas se aprueban en el detalle del vínculo y la lista de vínculos no filtra por cuenta: sin enlace.
    { clave: 'cuentas', cantidad: p.cuentasPorAprobar, ruta: null },
    // La bandeja tiene el botón de aperturas pendientes.
    { clave: 'aperturas', cantidad: p.aperturasPendientes, ruta: 'bandeja' },
    { clave: 'porVencer', cantidad: p.documentosPorVencer, ruta: 'vencimientos' },
    { clave: 'vencidos', cantidad: p.documentosVencidos, ruta: 'vencimientos?estado=Vencida' },
  ];
  return todos.filter((a) => a.cantidad > 0);
}

const TONO_DE_ACCESO: Readonly<Record<ClaveAcceso, TonoKpi>> = { revalidaciones: 'cian', cuentas: 'cian', aperturas: 'cian', porVencer: 'ambar', vencidos: 'rojo' };

/** El tono de la fila de un pendiente: rojo lo ya vencido y las revalidaciones que ya bloquean un certificado; ámbar lo que está por vencer. */
export function tonoDeAcceso(a: Acceso): TonoKpi {
  return a.clave === 'revalidaciones' && (a.bloqueantes ?? 0) > 0 ? 'rojo' : TONO_DE_ACCESO[a.clave];
}

/** Nada por revisar en las áreas ni en los demás pendientes. */
export function estaAlDia(p: MisPendientesDto): boolean {
  return p.porArea.every((a) => a.cantidad === 0) && accesosPendientes(p).length === 0;
}

/** El contrato admite el tiempo como número o texto (decimal de .NET); `null` si no hay dato o no es un número. */
export function aNumero(valor: IndicadoresDto['tiempoPromedioDias']): number | null {
  if (valor === null) return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

const ENTERO = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const UN_DECIMAL = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Conteos con separador de miles de es-CO. */
export function formatearConteo(valor: number): string {
  return ENTERO.format(valor);
}

/** Días con un decimal («4,5»), o `sinDato` («—») si no hay expedientes aprobados en la ventana. */
export function formatearDias(valor: IndicadoresDto['tiempoPromedioDias'], sinDato: string): string {
  const numero = aNumero(valor);
  return numero === null ? sinDato : UN_DECIMAL.format(numero);
}

/** Los grupos en que se reparten los vínculos de la empresa (cada vínculo cuenta en uno solo). */
export type ClaveReparto = 'alDia' | 'porVencer' | 'enProceso' | 'conProblema';

export interface SegmentoReparto {
  clave: ClaveReparto;
  valor: number;
  /** Del total de vínculos contados, de 0 a 100. */
  porcentaje: number;
  tono: TonoKpi;
}

/**
 * Cómo se reparten los vínculos por estado, con lo que la API ya entrega: «Activos» incluye los por vencer (por eso el grupo «al día» los
 * descuenta), y «en revisión» es aparte de activos, por vencer y vencidos. Cuatro grupos: al día, por vencer, en proceso (invitados, en
 * validación y en revisión) y con problema (vencidos y bloqueados). `total` es la suma; con cero no hay nada que repartir.
 */
export function repartoVinculos(d: IndicadoresDto): { total: number; segmentos: SegmentoReparto[] } {
  const porVencer = d.vinculosPorVencer ?? 0;
  const base: Omit<SegmentoReparto, 'porcentaje'>[] = [
    { clave: 'alDia', valor: Math.max(0, d.vinculosActivos - porVencer), tono: 'verde' },
    { clave: 'porVencer', valor: porVencer, tono: 'ambar' },
    { clave: 'enProceso', valor: d.vinculosEnValidacion + (d.vinculosEnRevision ?? 0) + d.vinculosInvitados, tono: 'cian' },
    { clave: 'conProblema', valor: d.vinculosVencidos + d.vinculosBloqueados, tono: 'rojo' },
  ];
  const total = base.reduce((suma, s) => suma + s.valor, 0);
  return { total, segmentos: base.map((s) => ({ ...s, porcentaje: total > 0 ? (s.valor / total) * 100 : 0 })) };
}

/** Un porcentaje entero («82»), o «<1» si hay algo pero menos de uno por ciento (que no se vea como cero). */
export function formatearPorcentaje(porcentaje: number): string {
  return porcentaje > 0 && porcentaje < 1 ? '<1' : String(Math.round(porcentaje));
}
