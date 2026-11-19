import { Box, LinearProgress, Link, Stack, Typography } from '@mui/material';
import type { InformeSlaDto } from '@validalo/api-client';
import { ChipEstado, EstadoVacio, formatearFechaHora, type ColumnaTabla } from '@validalo/ui';
import { AlarmClock, CircleCheck, Gauge } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Tarjeta } from '../../shared/componentes';
import { formatearDias } from './modelo';
import { cumplimientoParaBarra, desgloseDeRetraso, formatearCumplimiento, tonoDeCumplimiento } from './modeloSla';
import { TablaInforme } from './TablaInforme';

/** Cuántos vencidos se listan en pantalla; el Excel trae todos. */
export const MAXIMO_VENCIDOS_VISIBLES = 100;

type AreaSla = InformeSlaDto['porArea'][number];
type VencidoSla = InformeSlaDto['vencidos'][number];

/** Cumplimiento de cada área: plazo, revisiones a tiempo y fuera de plazo, barra de cumplimiento, promedio y vencidos hoy (con aviso en rojo si hay). */
export function CumplimientoPorArea({ areas }: { areas: InformeSlaDto['porArea'] }) {
  const { t } = useTranslation();
  const columnas = useMemo<ColumnaTabla<AreaSla>[]>(() => {
    const sinDato = t('informes.sinDato');
    return [
      { id: 'area', encabezado: t('informes.sla.areas.area'), ancho: 220, celda: (a) => a.nombre },
      {
        id: 'plazo',
        encabezado: t('informes.sla.areas.plazo'),
        alinear: 'right',
        celda: (a) => (a.slaHoras === null ? t('informes.sla.areas.sinPlazo') : t('informes.sla.areas.plazoHoras', { horas: a.slaHoras })),
      },
      { id: 'rondas', encabezado: t('informes.sla.areas.rondas'), alinear: 'right', celda: (a) => a.rondas },
      { id: 'aTiempo', encabezado: t('informes.sla.areas.aTiempo'), alinear: 'right', celda: (a) => a.aDentroDelPlazo },
      { id: 'fuera', encabezado: t('informes.sla.areas.fuera'), alinear: 'right', celda: (a) => a.fueraDelPlazo },
      {
        id: 'cumplimiento',
        encabezado: t('informes.sla.areas.cumplimiento'),
        ancho: 220,
        celda: (a) => {
          const texto = formatearCumplimiento(a.cumplimiento, sinDato);
          return (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <LinearProgress
                variant="determinate"
                value={cumplimientoParaBarra(a.cumplimiento)}
                color={tonoDeCumplimiento(a.cumplimiento)}
                aria-label={t('informes.sla.areas.cumplimientoDe', { area: a.nombre, valor: texto })}
                sx={{ flex: 1, minWidth: 90, height: 8, borderRadius: '4px' }}
              />
              <Box component="span" sx={{ flex: 'none', minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {texto}
              </Box>
            </Stack>
          );
        },
      },
      { id: 'promedio', encabezado: t('informes.sla.areas.promedio'), alinear: 'right', celda: (a) => formatearDias(a.promedioDias, sinDato) },
      {
        id: 'vencidos',
        encabezado: t('informes.sla.areas.vencidos'),
        alinear: 'right',
        celda: (a) =>
          a.vencidosAhora > 0 ? (
            <ChipEstado estado="Vencido" etiqueta={String(a.vencidosAhora)} />
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {a.vencidosAhora}
            </Box>
          ),
      },
    ];
  }, [t]);

  return (
    <Tarjeta titulo={t('informes.sla.areas.titulo')} etiqueta={t('informes.sla.areas.titulo')} ayuda={t('informes.sla.ayuda')} icono={Gauge} sinRelleno={areas.length > 0}>
      {areas.length === 0 ? (
        <EstadoVacio compacto titulo={t('informes.sla.areas.vacio')} />
      ) : (
        <TablaInforme etiqueta={t('informes.sla.areas.titulo')} columnas={columnas} filas={areas} claveFila={(a) => a.areaId} anchoMinimo={900} />
      )}
    </Tarjeta>
  );
}

/** Revisiones que hoy están vencidas, de la más atrasada a la menos, con enlace al expediente. */
export function VencidosAhora({ empresaId, vencidos }: { empresaId: string; vencidos: InformeSlaDto['vencidos'] }) {
  const { t } = useTranslation();
  const visibles = vencidos.slice(0, MAXIMO_VENCIDOS_VISIBLES);
  const columnas = useMemo<ColumnaTabla<VencidoSla>[]>(
    () => [
      {
        id: 'folio',
        encabezado: t('informes.sla.vencidos.folio'),
        celda: (v) => (
          <Link
            component={RouterLink}
            to={`/e/${empresaId}/expedientes/${v.expedienteId}`}
            aria-label={t('informes.sla.vencidos.abrir', { folio: v.folio, tercero: v.tercero })}
            sx={{ fontFamily: (th) => th.typography.monoTabla.fontFamily }}
          >
            {v.folio}
          </Link>
        ),
      },
      { id: 'tercero', encabezado: t('informes.sla.vencidos.tercero'), celda: (v) => v.tercero },
      { id: 'area', encabezado: t('informes.sla.vencidos.area'), celda: (v) => v.areaNombre },
      { id: 'vence', encabezado: t('informes.sla.vencidos.vencia'), celda: (v) => <Typography variant="monoTabla">{formatearFechaHora(v.vence)}</Typography> },
      {
        id: 'retraso',
        encabezado: t('informes.sla.vencidos.retraso'),
        alinear: 'right',
        celda: (v) => {
          const { dias, horas } = desgloseDeRetraso(v.horasDeRetraso);
          return (
            <Box component="span" sx={{ color: 'estado.error.texto' }}>
              {dias === 0 ? t('informes.sla.vencidos.retrasoHoras', { count: horas }) : t('informes.sla.vencidos.retrasoDias', { dias, horas })}
            </Box>
          );
        },
      },
    ],
    [t, empresaId],
  );

  return (
    <Tarjeta titulo={t('informes.sla.vencidos.titulo')} etiqueta={t('informes.sla.vencidos.titulo')} ayuda={t('informes.sla.vencidos.ayuda')} icono={AlarmClock} sinRelleno={vencidos.length > 0}>
      {vencidos.length === 0 ? (
        <EstadoVacio compacto icono={CircleCheck} titulo={t('informes.sla.vencidos.vacio')} />
      ) : (
        <>
          <TablaInforme etiqueta={t('informes.sla.vencidos.titulo')} columnas={columnas} filas={visibles} claveFila={(v) => `${v.expedienteId}|${v.areaId}`} />
          {vencidos.length > MAXIMO_VENCIDOS_VISIBLES && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', px: 2.5, py: 1.5 }}>
              {t('informes.sla.vencidos.hayMas', { maximo: MAXIMO_VENCIDOS_VISIBLES })}
            </Typography>
          )}
        </>
      )}
    </Tarjeta>
  );
}
