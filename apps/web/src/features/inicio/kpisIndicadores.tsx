import type { IndicadoresDto } from '@validalo/api-client';
import { MiniBarra, tonoDeAlerta } from '@validalo/ui';
import type { TFunction } from 'i18next';
import { CalendarX, CircleAlert, CircleCheck, CircleX, Clock, Eye, FolderOpen, Hourglass, Lock, Mail, ShieldCheck, ShieldEllipsis, ShieldX, Timer, TriangleAlert } from 'lucide-react';
import type { KpiResumen } from '../../shared/ResumenKpis';
import { aNumero, formatearConteo, formatearDias } from './modelo';

/** A dónde lleva una cifra: la ruta o `null` si quien mira no puede ver esa lista. */
export type Destino = (estado: string) => string | null;

/** Quita las tarjetas que no aplican (las que la API entrega en cero y no se muestran). */
const conTarjeta = (kpis: readonly (KpiResumen | null)[]): KpiResumen[] => kpis.filter((k): k is KpiResumen => k !== null);

/**
 * Las cifras de vínculos al momento. «Por vencer» y «En revisión» solo salen si hay alguno; «Vencidos» y «Bloqueados» son alertas (rojo si hay
 * alguno). Cada estado con lista propia enlaza a su lista filtrada si quien mira puede verla; «Activos» suma los por vencer y no tiene un estado único.
 */
export function kpisVinculos(d: IndicadoresDto, t: TFunction, aVinculos: Destino): KpiResumen[] {
  return conTarjeta([
    { clave: 'activos', icono: CircleCheck, tono: 'verde', titulo: t('inicio.indicadores.activos'), valor: formatearConteo(d.vinculosActivos), detalle: t('inicio.indicadores.activosDetalle') },
    d.vinculosPorVencer
      ? { clave: 'porVencer', icono: Clock, tono: 'ambar', titulo: t('inicio.indicadores.porVencer'), valor: formatearConteo(d.vinculosPorVencer), a: aVinculos('PorVencer') }
      : null,
    { clave: 'enValidacion', icono: Hourglass, tono: 'cian', titulo: t('inicio.indicadores.enValidacion'), valor: formatearConteo(d.vinculosEnValidacion), a: aVinculos('EnValidacion') },
    d.vinculosEnRevision
      ? {
          clave: 'enRevision',
          icono: Eye,
          tono: 'violeta',
          titulo: t('inicio.indicadores.enRevision'),
          valor: formatearConteo(d.vinculosEnRevision),
          detalle: t('inicio.indicadores.enRevisionDetalle'),
          a: aVinculos('EnRevision'),
        }
      : null,
    {
      clave: 'invitados',
      icono: Mail,
      tono: 'cian',
      titulo: t('inicio.indicadores.invitados'),
      valor: formatearConteo(d.vinculosInvitados),
      detalle: t('inicio.indicadores.invitadosDetalle'),
      a: aVinculos('Invitado'),
    },
    { clave: 'vencidos', icono: CalendarX, tono: tonoDeAlerta(d.vinculosVencidos), titulo: t('inicio.indicadores.vencidos'), valor: formatearConteo(d.vinculosVencidos), a: aVinculos('Vencido') },
    { clave: 'bloqueados', icono: Lock, tono: tonoDeAlerta(d.vinculosBloqueados), titulo: t('inicio.indicadores.bloqueados'), valor: formatearConteo(d.vinculosBloqueados), a: aVinculos('Bloqueado') },
  ]);
}

/**
 * Las cifras de expedientes: en curso y observados al momento; aprobados, rechazados y tiempos en la ventana elegida. Los observados (esperando
 * al tercero) y los rechazados son alertas. Los aprobados y su tiempo llevan al informe de estado con la misma ventana (`aInforme`); los aprobados
 * llevan además una barra de cuántos de los expedientes cerrados quedaron aprobados.
 */
export function kpisExpedientes(d: IndicadoresDto, t: TFunction, aInforme: string): KpiResumen[] {
  const sinDato = t('inicio.indicadores.sinDato');
  const cerrados = d.expedientesAprobados + d.expedientesRechazados;
  const detalleCerrados = t('inicio.indicadores.cerradosDetalle', { total: formatearConteo(cerrados) });
  const detalleTiempo = (valor: IndicadoresDto['tiempoPromedioDias']) => (aNumero(valor) === null ? t('inicio.indicadores.sinDatoAyuda') : t('inicio.indicadores.tiempoDetalle'));
  return [
    { clave: 'enCurso', icono: FolderOpen, tono: 'cian', titulo: t('inicio.indicadores.enCurso'), valor: formatearConteo(d.expedientesEnCurso), detalle: t('inicio.indicadores.enCursoDetalle') },
    {
      clave: 'observados',
      icono: TriangleAlert,
      tono: tonoDeAlerta(d.expedientesObservados),
      titulo: t('inicio.indicadores.observados'),
      valor: formatearConteo(d.expedientesObservados),
      detalle: t('inicio.indicadores.observadosDetalle'),
    },
    {
      clave: 'aprobados',
      icono: CircleCheck,
      tono: 'verde',
      titulo: t('inicio.indicadores.aprobados'),
      valor: formatearConteo(d.expedientesAprobados),
      detalle: detalleCerrados,
      grafica:
        cerrados > 0 ? (
          <MiniBarra
            valor={d.expedientesAprobados}
            total={cerrados}
            tono="verde"
            etiqueta={t('inicio.indicadores.aprobadosBarra', { aprobados: formatearConteo(d.expedientesAprobados), total: formatearConteo(cerrados) })}
          />
        ) : undefined,
      a: aInforme,
    },
    { clave: 'rechazados', icono: CircleX, tono: tonoDeAlerta(d.expedientesRechazados), titulo: t('inicio.indicadores.rechazados'), valor: formatearConteo(d.expedientesRechazados), detalle: detalleCerrados },
    {
      clave: 'tiempoPromedio',
      icono: Hourglass,
      tono: 'violeta',
      titulo: t('inicio.indicadores.tiempoPromedio'),
      valor: formatearDias(d.tiempoPromedioDias, sinDato),
      detalle: detalleTiempo(d.tiempoPromedioDias),
      a: aInforme,
    },
    {
      clave: 'tiempoMediana',
      icono: Timer,
      tono: 'violeta',
      titulo: t('inicio.indicadores.tiempoMediana'),
      valor: formatearDias(d.tiempoMedianaDias, sinDato),
      detalle: detalleTiempo(d.tiempoMedianaDias),
    },
  ];
}

/**
 * Las cifras de certificados al momento. «En verificación» solo sale si hay alguno y enlaza a su lista; «Con pendientes» y «No válidos» son
 * alertas (rojo si hay alguno).
 */
export function kpisCertificados(d: IndicadoresDto, t: TFunction, aCertificados: Destino): KpiResumen[] {
  return conTarjeta([
    { clave: 'vigentes', icono: ShieldCheck, tono: 'verde', titulo: t('inicio.indicadores.vigentes'), valor: formatearConteo(d.certificadosVigentes) },
    d.certificadosEnVerificacion
      ? {
          clave: 'enVerificacion',
          icono: ShieldEllipsis,
          tono: 'cian',
          titulo: t('inicio.indicadores.enVerificacion'),
          valor: formatearConteo(d.certificadosEnVerificacion),
          detalle: t('inicio.indicadores.enVerificacionDetalle'),
          a: aCertificados('EnVerificacion'),
        }
      : null,
    { clave: 'conPendientes', icono: CircleAlert, tono: tonoDeAlerta(d.certificadosConPendientes), titulo: t('inicio.indicadores.conPendientes'), valor: formatearConteo(d.certificadosConPendientes) },
    {
      clave: 'noValidos',
      icono: ShieldX,
      tono: tonoDeAlerta(d.certificadosNoValidos),
      titulo: t('inicio.indicadores.noValidos'),
      valor: formatearConteo(d.certificadosNoValidos),
      detalle: t('inicio.indicadores.noValidosDetalle'),
    },
  ]);
}
