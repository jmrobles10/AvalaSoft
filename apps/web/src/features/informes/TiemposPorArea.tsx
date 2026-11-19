import { Box } from '@mui/material';
import type { ResumenDeAreaDto } from '@validalo/api-client';
import { BarraMedida, ChipEstado, EstadoVacio, type ColumnaTabla } from '@validalo/ui';
import { Building2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { aNumero, formatearDias, topeDeAreas } from './modelo';
import { TablaInforme } from './TablaInforme';

/**
 * Tiempos de decisión de cada área: la tabla con sus cifras y, en el promedio, una barra contra el máximo de todas las áreas (la raya marca
 * el máximo del área). Las áreas con plazo incumplido llevan un aviso en rojo.
 */
export function TiemposPorArea({ areas }: { areas: readonly ResumenDeAreaDto[] }) {
  const { t } = useTranslation();
  const tope = topeDeAreas(areas);
  const columnas = useMemo<ColumnaTabla<ResumenDeAreaDto>[]>(() => {
    const dias = (v: number | string | null) => formatearDias(v, t('informes.sinDato'));
    return [
      { id: 'area', encabezado: t('informes.estado.areas.area'), ancho: 220, celda: (a) => a.nombre },
      { id: 'expedientes', encabezado: t('informes.estado.areas.expedientes'), alinear: 'right', celda: (a) => a.expedientes },
      { id: 'pendientes', encabezado: t('informes.estado.areas.pendientes'), alinear: 'right', celda: (a) => a.pendientes },
      {
        id: 'promedio',
        encabezado: t('informes.estado.areas.promedio'),
        ancho: 240,
        celda: (a) => {
          const promedio = aNumero(a.promedioDias);
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 90 }}>
                {promedio !== null && (
                  <BarraMedida
                    valor={promedio}
                    maximo={tope}
                    marca={aNumero(a.maximoDias) ?? undefined}
                    etiqueta={t('informes.estado.areas.barra', { area: a.nombre, promedio: dias(a.promedioDias), maximo: dias(a.maximoDias) })}
                  />
                )}
              </Box>
              <Box component="span" sx={{ flex: 'none', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {dias(a.promedioDias)}
              </Box>
            </Box>
          );
        },
      },
      { id: 'mediana', encabezado: t('informes.estado.areas.mediana'), alinear: 'right', celda: (a) => dias(a.medianaDias) },
      { id: 'maximo', encabezado: t('informes.estado.areas.maximo'), alinear: 'right', celda: (a) => dias(a.maximoDias) },
      {
        id: 'sla',
        encabezado: t('informes.estado.areas.sla'),
        alinear: 'right',
        celda: (a) =>
          a.slaIncumplidos > 0 ? (
            <ChipEstado estado="Vencido" etiqueta={t('informes.estado.areas.incumplidos', { count: a.slaIncumplidos })} />
          ) : (
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {a.slaIncumplidos}
            </Box>
          ),
      },
    ];
  }, [t, tope]);

  return (
    <Tarjeta titulo={t('informes.estado.areas.titulo')} etiqueta={t('informes.estado.areas.titulo')} ayuda={t('informes.estado.areas.ayuda')} icono={Building2} sinRelleno={areas.length > 0}>
      {areas.length === 0 ? (
        <EstadoVacio compacto titulo={t('informes.estado.areas.vacio')} />
      ) : (
        <TablaInforme etiqueta={t('informes.estado.areas.titulo')} columnas={columnas} filas={areas} claveFila={(a) => a.areaId} anchoMinimo={840} />
      )}
    </Tarjeta>
  );
}
