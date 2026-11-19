import { Box, Typography } from '@mui/material';
import type { IndicadoresDto } from '@validalo/api-client';
import { BarraSegmentada, coloresDeKpi } from '@validalo/ui';
import { ChartPie } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { formatearConteo, formatearPorcentaje, repartoVinculos } from './modelo';

/**
 * Cómo se reparten los vínculos de la empresa en cuatro grupos (al día, por vencer, en proceso y con problema), con lo que la API ya entrega:
 * una barra apilada da la proporción y la leyenda dice cada grupo con su cifra y su peso (el color no lleva el dato solo). Un grupo en cero no se
 * dibuja ni se lista (las tarjetas de arriba ya dicen sus ceros); sin vínculos no hay nada que repartir y no se dibuja nada.
 */
export function RepartoVinculos({ indicadores }: { indicadores: IndicadoresDto }) {
  const { t } = useTranslation();
  const { total, segmentos } = repartoVinculos(indicadores);
  if (total === 0) return null;
  const presentes = segmentos.filter((s) => s.valor > 0);
  const detalle = presentes.map((s) => t('inicio.indicadores.reparto.segmento', { grupo: t(`inicio.indicadores.reparto.${s.clave}`), cantidad: formatearConteo(s.valor) })).join(', ');

  return (
    <Tarjeta titulo={t('inicio.indicadores.reparto.titulo')} etiqueta={t('inicio.indicadores.reparto.titulo')} ayuda={t('inicio.indicadores.reparto.ayuda', { total: formatearConteo(total) })} icono={ChartPie} nivel="h3">
      <BarraSegmentada etiqueta={t('inicio.indicadores.reparto.barra', { detalle })} segmentos={presentes.map((s) => ({ clave: s.clave, valor: s.valor, tono: s.tono }))} />
      <Box component="dl" sx={{ m: 0, mt: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
        {presentes.map((s) => (
          <Box key={s.clave} sx={{ minWidth: 0 }}>
            <Box component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box aria-hidden sx={(th) => ({ flex: 'none', width: 10, height: 10, borderRadius: '3px', bgcolor: coloresDeKpi(th, s.tono).solido })} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t(`inicio.indicadores.reparto.${s.clave}`)}
              </Typography>
            </Box>
            <Typography variant="h2" component="dd" sx={{ m: 0, mt: 0.25 }}>
              {formatearConteo(s.valor)}
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                {t('inicio.indicadores.reparto.porcentaje', { valor: formatearPorcentaje(s.porcentaje) })}
              </Typography>
            </Typography>
            {s.clave === 'enProceso' && (
              <Typography component="dd" variant="caption" sx={{ m: 0, display: 'block', color: 'text.secondary', fontWeight: 400 }}>
                {t('inicio.indicadores.reparto.enProcesoDetalle')}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Tarjeta>
  );
}
