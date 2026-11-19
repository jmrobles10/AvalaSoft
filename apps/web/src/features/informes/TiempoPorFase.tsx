import { Box, Typography } from '@mui/material';
import type { ResumenEstadoExpedientesDto } from '@validalo/api-client';
import { BarraSegmentada, coloresDeKpi, EstadoVacio, type TonoKpi } from '@validalo/ui';
import { Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { formatearDias, tiemposPorFase, type FaseTiempo } from './modelo';

const TONO_DE_FASE: Record<FaseTiempo, TonoKpi> = { carga: 'cian', tercero: 'ambar', revision: 'violeta' };

/**
 * Tiempo por fase: de la apertura a la aprobación, cuánto del tiempo promedio se va en la carga, con el tercero y en revisión. Una barra
 * apilada da la proporción y la leyenda dice cada fase con sus días y su peso (el color no lleva el dato solo).
 */
export function TiempoPorFase({ resumen }: { resumen: ResumenEstadoExpedientesDto }) {
  const { t } = useTranslation();
  const sinDato = t('informes.sinDato');
  const fases = tiemposPorFase(resumen);
  const hayDatos = fases.some((f) => f.dias !== null);
  const resumenAccesible = fases.map((f) => `${t(`informes.estado.fases.${f.fase}`)} ${t('informes.dias', { dias: formatearDias(f.dias, sinDato) })}`).join(', ');

  return (
    <Tarjeta titulo={t('informes.estado.fases.titulo')} etiqueta={t('informes.estado.fases.titulo')} ayuda={t('informes.estado.fases.ayuda')} icono={Timer}>
      {!hayDatos ? (
        <EstadoVacio compacto titulo={t('informes.estado.fases.vacio')} texto={t('informes.estado.fases.vacioAyuda')} />
      ) : (
        <>
          <BarraSegmentada
            etiqueta={t('informes.estado.fases.barra', { detalle: resumenAccesible })}
            segmentos={fases.map((f) => ({ clave: f.fase, valor: f.dias ?? 0, tono: TONO_DE_FASE[f.fase] }))}
          />
          <Box component="dl" sx={{ m: 0, mt: 2, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
            {fases.map((f) => (
              <Box key={f.fase} sx={{ minWidth: 0 }}>
                <Box component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box aria-hidden sx={(th) => ({ flex: 'none', width: 10, height: 10, borderRadius: '3px', bgcolor: coloresDeKpi(th, TONO_DE_FASE[f.fase]).solido })} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t(`informes.estado.fases.${f.fase}`)}
                  </Typography>
                </Box>
                <Typography variant="h4" component="dd" sx={{ m: 0, mt: 0.25 }}>
                  {t('informes.dias', { dias: formatearDias(f.dias, sinDato) })}
                  <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    {t('informes.estado.fases.porcentaje', { valor: String(Math.round(f.porcentaje)) })}
                  </Typography>
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Tarjeta>
  );
}
