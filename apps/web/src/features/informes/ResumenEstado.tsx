import type { ResumenEstadoExpedientesDto } from '@validalo/api-client';
import { MiniBarra, tonoDeAlerta } from '@validalo/ui';
import { CircleCheck, FolderOpen, Hourglass, TimerOff, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ResumenKpis, type KpiResumen } from '../../shared/ResumenKpis';
import { aNumero, formatearDias } from './modelo';
import { TiempoPorFase } from './TiempoPorFase';
import { TiemposPorArea } from './TiemposPorArea';

/**
 * Resumen del informe de estado (sobre todas las filas, no solo la página): las cifras principales en tarjetas, el tiempo por fase y los
 * tiempos de cada área. Sin `resumen` (carga) dibuja los esqueletos de las tarjetas.
 */
export function ResumenEstado({ resumen, actualizando = false }: { resumen: ResumenEstadoExpedientesDto | undefined; actualizando?: boolean }) {
  const { t } = useTranslation();
  const etiqueta = t('informes.estado.kpi.etiqueta');
  if (!resumen) return <ResumenKpis etiqueta={etiqueta} kpis={undefined} />;

  const dias = (valor: number | string | null) => formatearDias(valor, t('informes.sinDato'));
  const total = String(resumen.total);
  const kpis: KpiResumen[] = [
    { clave: 'total', icono: FolderOpen, tono: 'cian', titulo: t('informes.estado.kpi.total'), valor: total, detalle: t('informes.estado.kpi.totalDetalle') },
    {
      clave: 'aprobados',
      icono: CircleCheck,
      tono: 'verde',
      titulo: t('informes.estado.kpi.aprobados'),
      valor: String(resumen.aprobados),
      detalle: t('informes.estado.kpi.aprobadosDetalle', { total }),
      grafica: <MiniBarra valor={resumen.aprobados} total={resumen.total} tono="verde" etiqueta={t('informes.estado.kpi.aprobadosBarra', { aprobados: String(resumen.aprobados), total })} />,
    },
    {
      clave: 'dias',
      icono: Hourglass,
      tono: 'violeta',
      titulo: t('informes.estado.kpi.dias'),
      valor: dias(resumen.tiempoPromedioDias),
      detalle: aNumero(resumen.tiempoPromedioDias) === null ? t('informes.estado.kpi.diasSinDato') : t('informes.estado.kpi.diasDetalle', { mediana: dias(resumen.tiempoMedianaDias) }),
    },
    { clave: 'devoluciones', icono: Undo2, tono: 'ambar', titulo: t('informes.estado.kpi.devoluciones'), valor: String(resumen.devoluciones), detalle: t('informes.estado.kpi.devolucionesDetalle') },
    {
      clave: 'sla',
      icono: TimerOff,
      tono: tonoDeAlerta(resumen.conSlaIncumplido),
      titulo: t('informes.estado.kpi.sla'),
      valor: String(resumen.conSlaIncumplido),
      detalle: t('informes.estado.kpi.slaDetalle'),
    },
  ];

  return (
    <>
      <ResumenKpis etiqueta={etiqueta} kpis={kpis} actualizando={actualizando} />
      <TiempoPorFase resumen={resumen} />
      <TiemposPorArea areas={resumen.porArea} />
    </>
  );
}
