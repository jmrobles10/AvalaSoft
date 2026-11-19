import { Alert } from '@mui/material';
import { SCOPES, type InformeSlaDto } from '@validalo/api-client';
import { EsqueletoTabla, MiniBarra } from '@validalo/ui';
import { AlarmClock, ClipboardList, CircleCheck, Gauge, TimerOff } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ErrorRecuperable, SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { usePermisos } from '../../shared/usePermisos';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { AccionesDescarga } from './AccionesDescarga';
import { useInformeSla } from './api';
import { FiltrosInformeSla } from './FiltrosInformeSla';
import { MarcoInforme } from './MarcoInforme';
import { aNumero, rangoInvalido, RUTAS, tonoDeAlerta } from './modelo';
import { cumplimientoParaBarra, formatearCumplimiento, leerFiltrosSla, parametrosSla, tonoKpiDeCumplimiento } from './modeloSla';
import { ResumenKpis, type KpiInforme } from './ResumenKpis';
import { CumplimientoPorArea, VencidosAhora } from './TablasInformeSla';

/** Las cifras del informe de plazo de revisión como tarjetas: el cumplimiento primero, con su barra, y lo vencido en rojo si hay. */
function kpisDeSla(resumen: InformeSlaDto['resumen'], t: TFunction): KpiInforme[] {
  const cumplimiento = formatearCumplimiento(resumen.cumplimiento, t('informes.sinDato'));
  const tono = tonoKpiDeCumplimiento(resumen.cumplimiento);
  return [
    {
      clave: 'cumplimiento',
      icono: Gauge,
      tono,
      titulo: t('informes.sla.kpi.cumplimiento'),
      valor: cumplimiento,
      detalle:
        aNumero(resumen.cumplimiento) === null
          ? t('informes.sla.kpi.cumplimientoSinDato')
          : t('informes.sla.kpi.cumplimientoDetalle', { aTiempo: String(resumen.aDentroDelPlazo), rondas: String(resumen.rondas) }),
      grafica: <MiniBarra valor={cumplimientoParaBarra(resumen.cumplimiento)} total={100} tono={tono} etiqueta={t('informes.sla.kpi.cumplimientoBarra', { valor: cumplimiento })} />,
    },
    { clave: 'rondas', icono: ClipboardList, tono: 'cian', titulo: t('informes.sla.kpi.rondas'), valor: String(resumen.rondas), detalle: t('informes.sla.kpi.rondasDetalle', { count: resumen.expedientes }) },
    { clave: 'aTiempo', icono: CircleCheck, tono: 'verde', titulo: t('informes.sla.kpi.aTiempo'), valor: String(resumen.aDentroDelPlazo), detalle: t('informes.sla.kpi.aTiempoDetalle') },
    { clave: 'fuera', icono: TimerOff, tono: resumen.fueraDelPlazo > 0 ? 'ambar' : 'verde', titulo: t('informes.sla.kpi.fuera'), valor: String(resumen.fueraDelPlazo), detalle: t('informes.sla.kpi.fueraDetalle') },
    { clave: 'vencidos', icono: AlarmClock, tono: tonoDeAlerta(resumen.vencidosAhora), titulo: t('informes.sla.kpi.vencidos'), valor: String(resumen.vencidosAhora), detalle: t('informes.sla.kpi.vencidosDetalle') },
  ];
}

/**
 * Cumplimiento del plazo de revisión (OP-14): cuántas revisiones de cada área se resolvieron dentro de su plazo, el promedio de días y las que hoy están vencidas, con enlace al expediente. Filtros en la URL; el Excel lleva los mismos.
 */
export function PaginaInformeSla() {
  const { t } = useTranslation();
  const { empresa } = useEmpresaActiva();
  const puede = usePermisos(empresa.id).puede(SCOPES.expedientesLeer);
  const [parametros] = useSearchParams();
  const filtros = leerFiltrosSla(parametros);
  const errorRango = rangoInvalido(filtros);
  const params = parametrosSla(filtros);
  const consulta = useInformeSla(empresa.id, params, puede && !errorRango);

  if (!puede) return <SinPermiso seccion={t('nav.informes')} />;

  const informe = consulta.data;
  const sinDatos = informe?.porArea.length === 0 && informe.vencidos.length === 0;

  return (
    <MarcoInforme
      empresa={empresa}
      actual="sla"
      acciones={<AccionesDescarga empresaId={empresa.id} params={params} descargas={[{ formato: 'excel', url: RUTAS.slaExcel, nombre: t('informes.sla.excelNombre') }]} deshabilitado={errorRango || sinDatos} />}
    >
      <FiltrosInformeSla empresaId={empresa.id} filtros={filtros} />

      {errorRango && <Alert severity="warning">{t('informes.sla.filtros.rangoInvalido')}</Alert>}
      {!errorRango && consulta.isError && <ErrorRecuperable mensaje={`${t('informes.sla.errorCarga')} ${mensajeDeError(consulta.error, t)}`} onReintentar={() => void consulta.refetch()} />}
      {!errorRango && consulta.isPending && (
        <>
          <ResumenKpis etiqueta={t('informes.sla.titulo')} kpis={undefined} />
          <EsqueletoTabla etiqueta={t('informes.sla.areas.titulo')} columnas={6} filas={3} />
        </>
      )}
      {!errorRango && informe && (
        <>
          <ResumenKpis etiqueta={t('informes.sla.titulo')} kpis={kpisDeSla(informe.resumen, t)} actualizando={consulta.isPlaceholderData} />
          <CumplimientoPorArea areas={informe.porArea} />
          <VencidosAhora empresaId={empresa.id} vencidos={informe.vencidos} />
        </>
      )}
    </MarcoInforme>
  );
}
