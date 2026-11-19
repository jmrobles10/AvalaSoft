import { Alert, AlertTitle, Box, Button, Card, Chip, Stack, Typography } from '@mui/material';
import type { EvaluacionPublicaResumenDto } from '@validalo/api-client';
import { formatearFecha } from '@validalo/ui';
import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { evaluacionesPendientes } from './modelo';

/** Aviso corto de «te pide responder» con el enlace a cada evaluación pendiente: lo que ve el tercero en «Mis empresas» cuando hay una reevaluación o una evaluación del flujo. */
export function AvisoEvaluacionesPendientes({ evaluaciones, vinculoId, empresa }: { evaluaciones: readonly EvaluacionPublicaResumenDto[]; vinculoId: string; empresa: string }) {
  const { t } = useTranslation();
  const pendientes = evaluacionesPendientes(evaluaciones);
  if (pendientes.length === 0) return null;
  return (
    <Alert
      severity="info"
      icon={<ClipboardCheck size={18} aria-hidden />}
      sx={{ mt: 1.5 }}
      action={
        pendientes.length === 1 && pendientes[0] ? (
          <Button component={RouterLink} to={`/empresas/${vinculoId}/evaluaciones/${pendientes[0].id}`} color="inherit" size="small" aria-label={t('evaluaciones.tarjeta.responderA', { cuestionario: pendientes[0].cuestionario })}>
            {t('evaluaciones.tarjeta.responder')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{t('evaluaciones.aviso.titulo', { empresa, count: pendientes.length })}</AlertTitle>
      {t('evaluaciones.aviso.texto', { empresa })}
      {pendientes.length > 1 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
          {pendientes.map((e) => (
            <Button key={e.id} component={RouterLink} to={`/empresas/${vinculoId}/evaluaciones/${e.id}`} size="small" variant="outlined" aria-label={t('evaluaciones.tarjeta.responderA', { cuestionario: e.cuestionario })}>
              {e.cuestionario}
            </Button>
          ))}
        </Stack>
      )}
    </Alert>
  );
}

/** Las evaluaciones de una revisión (`ExpedientePublicoDto.evaluaciones`): cada una con su estado y el paso siguiente, sin puntaje ni resultado. */
export function TarjetaEvaluaciones({ evaluaciones, vinculoId, empresa }: { evaluaciones: readonly EvaluacionPublicaResumenDto[] | null | undefined; vinculoId: string; empresa: string }) {
  const { t } = useTranslation();
  if (!evaluaciones || evaluaciones.length === 0) return null;
  return (
    <Box component="section" aria-labelledby="titulo-evaluaciones" sx={{ mb: 2 }}>
      <Typography variant="overline" id="titulo-evaluaciones" component="h2" sx={{ color: 'text.secondary', mb: 1 }}>
        {t('evaluaciones.tarjeta.titulo', { empresa })}
      </Typography>
      <Stack spacing={1.5}>
        {evaluaciones.map((e) => {
          const pendiente = e.estado === 'Pendiente';
          return (
            <Card key={e.id} sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" component="h3">
                      {e.cuestionario}
                    </Typography>
                    <Chip size="small" color={pendiente ? 'warning' : 'success'} label={pendiente ? t('evaluaciones.tarjeta.pendiente') : t('evaluaciones.tarjeta.enviada')} />
                  </Stack>
                  <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {pendiente ? t('evaluaciones.tarjeta.pedidaEl', { fecha: formatearFecha(e.asignadaEn) }) : t('evaluaciones.tarjeta.enviadaEl', { fecha: formatearFecha(e.respondidaEn ?? e.asignadaEn) })}
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to={`/empresas/${vinculoId}/evaluaciones/${e.id}`}
                  variant={pendiente ? 'contained' : 'outlined'}
                  aria-label={pendiente ? t('evaluaciones.tarjeta.responderA', { cuestionario: e.cuestionario }) : t('evaluaciones.tarjeta.verA', { cuestionario: e.cuestionario })}
                >
                  {pendiente ? t('evaluaciones.tarjeta.responder') : t('evaluaciones.tarjeta.ver')}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
