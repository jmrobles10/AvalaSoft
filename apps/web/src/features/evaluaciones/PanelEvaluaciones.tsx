import { Alert, AlertTitle, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { SCOPES, type ExpedienteDto } from '@validalo/api-client';
import { formatearFecha } from '@validalo/ui';
import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Tarjeta } from '../../shared/componentes';
import { usePermisos } from '../../shared/usePermisos';
import { evaluacionesQueFrenan, formatearPuntaje } from './modelo';

const COLOR = { Pendiente: 'warning', Aprobada: 'success', Reprobada: 'error', Anulada: 'default' } as const;

/**
 * Evaluaciones del expediente (CE-8): cada cuestionario que pidió el flujo, quién lo responde, su estado y su puntaje, con el aviso de que el cierre las espera si bloquean
 * (o de que una reprobada solo se deja a la vista si el flujo pidió observar). El resultado completo es privado de la empresa y se ve al abrir la evaluación.
 */
export function PanelEvaluaciones({ expediente, empresaId }: { expediente: ExpedienteDto; empresaId: string }) {
  const { t } = useTranslation();
  const permisos = usePermisos(empresaId);
  const evaluaciones = expediente.evaluaciones ?? [];
  if (evaluaciones.length === 0) return null;
  const puedeAbrir = permisos.puede(SCOPES.evaluacionesLeer);

  return (
    <Tarjeta titulo={t('evaluaciones.panel.titulo')}>
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {evaluaciones.map((e) => (
          <Box component="li" key={e.evaluacionId} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography component="span" variant="subtitle2">
                    {e.nombre}
                  </Typography>
                  <Chip size="small" color={COLOR[e.estado]} variant={e.estado === 'Anulada' ? 'outlined' : 'filled'} label={t(`evaluaciones.panel.estados.${e.estado}`)} />
                  {e.puntaje !== null && <Chip size="small" variant="outlined" label={t('evaluaciones.panel.puntaje', { puntaje: formatearPuntaje(e.puntaje) })} />}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {t(`evaluaciones.responde.${e.responde}`)} · {t(`evaluaciones.efecto.${e.efecto}`)}
                  {e.actualizadaEn ? ` · ${formatearFecha(e.actualizadaEn)}` : ''}
                </Typography>
              </Box>
              {puedeAbrir && (
                <Button component={RouterLink} to={`/e/${empresaId}/evaluaciones/${e.evaluacionId}`} size="small" variant="text" startIcon={<ClipboardCheck size={14} aria-hidden />} sx={{ flex: 'none' }}>
                  {e.estado === 'Pendiente' && e.responde === 'Evaluador' ? t('evaluaciones.panel.responder') : t('evaluaciones.panel.abrir')}
                </Button>
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Tarjeta>
  );
}

/** Todas las áreas aprobaron y lo que impide cerrar es una evaluación que bloquea: dice cuáles y qué hace falta. */
export function AvisoEsperandoEvaluaciones({ expediente }: { expediente: ExpedienteDto }) {
  const { t } = useTranslation();
  const frenan = evaluacionesQueFrenan(expediente.evaluaciones);
  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <AlertTitle>{t('evaluaciones.panel.esperandoTitulo')}</AlertTitle>
      {t('evaluaciones.panel.esperando', { evaluaciones: frenan.map((e) => `${e.nombre} (${t(`evaluaciones.panel.estados.${e.estado}`).toLowerCase()})`).join(', ') })}
    </Alert>
  );
}
