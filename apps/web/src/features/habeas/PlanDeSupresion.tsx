import { Alert, Box, Stack, Typography } from '@mui/material';
import type { PlanDeSupresionDto } from '@validalo/api-client';
import { EsqueletoTarjetas, formatearDiaCivil } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { usePlanDeSupresion } from './api';
import { comoAccion } from './modelo';

/** Cuántos elementos se listan antes de «y N más». */
const MAXIMO_VISIBLES = 8;

function Cuenta({ cantidad, etiqueta, ayuda }: { cantidad: number; etiqueta: string; ayuda: string }) {
  return (
    <Box sx={(th) => ({ minWidth: 0, p: 1.25, border: 1, borderColor: 'divider', borderRadius: `${String(th.radio.sm)}px` })}>
      <Typography variant="h4" component="p">{cantidad.toLocaleString('es-CO')}</Typography>
      <Typography variant="subtitle2" component="p">{etiqueta}</Typography>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>{ayuda}</Typography>
    </Box>
  );
}

function Detalle({ plan }: { plan: PlanDeSupresionDto }) {
  const { t } = useTranslation();
  const visibles = plan.elementos.slice(0, MAXIMO_VISIBLES);
  const restantes = plan.elementos.length - visibles.length;
  return (
    <Stack spacing={1.25}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
        <Cuenta cantidad={plan.suprimir} etiqueta={t('habeas.plan.suprimir')} ayuda={t('habeas.plan.suprimirAyuda')} />
        <Cuenta cantidad={plan.retener} etiqueta={t('habeas.plan.retener')} ayuda={t('habeas.plan.retenerAyuda')} />
        <Cuenta cantidad={plan.anonimizar} etiqueta={t('habeas.plan.anonimizar')} ayuda={t('habeas.plan.anonimizarAyuda')} />
      </Box>
      {visibles.length > 0 && (
        <Box component="ul" aria-label={t('habeas.plan.elementos')} sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {visibles.map((e) => {
            const accion = comoAccion(e.accion);
            return (
              <Box component="li" key={`${e.tipo}-${e.referencia}`} sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
                <Typography variant="subtitle2" component="span">
                  {accion ? t(`habeas.plan.acciones.${accion}`) : e.accion}
                </Typography>
                {' · '}
                {e.descripcion}
                {accion === 'Retener' && e.baseLegal && (
                  <Typography variant="caption" component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                    {e.baseLegal}
                    {e.retenidaHasta ? ` · ${t('habeas.plan.hasta', { fecha: formatearDiaCivil(e.retenidaHasta) })}` : ''}
                  </Typography>
                )}
              </Box>
            );
          })}
          {restantes > 0 && (
            <Box component="li" sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('habeas.plan.yMas', { count: restantes })}
            </Box>
          )}
        </Box>
      )}
    </Stack>
  );
}

/**
 * Lo que haría la supresión si se atiende (OD-5, OD-6): lo que ninguna aceptación ni certificado referencia se elimina; lo referenciado
 * se conserva íntegro con su base legal y su fecha. Se calcula en el momento, sin cambiar nada, y se muestra antes de confirmar.
 */
export function PlanDeSupresion({ solicitudId }: { solicitudId: string }) {
  const { t } = useTranslation();
  const plan = usePlanDeSupresion(solicitudId, true);
  if (plan.isPending) return <EsqueletoTarjetas cantidad={1} lineas={3} etiqueta={t('habeas.plan.calculando')} />;
  if (plan.isError) return <Alert severity="error">{mensajeDeError(plan.error, t)}</Alert>;
  return (
    <Box>
      <Typography variant="subtitle1" component="h3" sx={{ mb: 0.75 }}>
        {t('habeas.plan.titulo')}
      </Typography>
      <Detalle plan={plan.data} />
    </Box>
  );
}
