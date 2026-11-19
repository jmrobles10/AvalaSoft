import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { CuestionarioDto } from '@validalo/api-client';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { numero } from '../../evaluaciones/modelo';
import type { EvaluacionEnEditor } from '../editor';

export interface EditorEvaluacionesDelFlujoProps {
  evaluaciones: EvaluacionEnEditor[];
  /** Cuestionarios de la empresa; solo los que tienen una versión publicada se pueden pedir. */
  cuestionarios: readonly CuestionarioDto[];
  onCambiar: (evaluaciones: EvaluacionEnEditor[]) => void;
  soloLectura: boolean;
}

const EFECTOS = ['Bloquear', 'Observar'] as const;

/**
 * Cuestionarios de evaluación que pide el flujo al abrir el expediente inicial (CE-7): para cada uno, qué pasa si la evaluación sale reprobada (por puntaje bajo
 * el umbral o por una pregunta eliminatoria): bloquear el cierre del expediente o solo dejarlo a la vista. Quién responde y el umbral son del cuestionario.
 */
export function EditorEvaluacionesDelFlujo({ evaluaciones, cuestionarios, onCambiar, soloLectura }: EditorEvaluacionesDelFlujoProps) {
  const { t } = useTranslation();
  const usados = new Set(evaluaciones.map((e) => e.cuestionarioId));
  const disponibles = cuestionarios.filter((c) => c.publicada && !usados.has(c.id));
  const cambiar = (indice: number, cambio: Partial<EvaluacionEnEditor>) => onCambiar(evaluaciones.map((e, i) => (i === indice ? { ...e, ...cambio } : e)));

  return (
    <Stack spacing={1.5}>
      <Typography sx={{ color: 'text.secondary' }}>{t('evaluaciones.flujo.ayuda')}</Typography>
      {evaluaciones.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('evaluaciones.flujo.ninguna')}
        </Typography>
      )}
      {evaluaciones.map((evaluacion, indice) => {
        const cuestionario = cuestionarios.find((c) => c.id === evaluacion.cuestionarioId);
        const definicion = cuestionario?.publicada?.definicion;
        const opciones = cuestionarios.filter((c) => c.id === evaluacion.cuestionarioId || disponibles.includes(c));
        return (
          <Box key={evaluacion.cuestionarioId} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1fr) 220px auto' }, alignItems: 'start' }}>
              <TextField
                select
                size="small"
                label={t('evaluaciones.flujo.cuestionario')}
                value={evaluacion.cuestionarioId}
                onChange={(e) => cambiar(indice, { cuestionarioId: e.target.value })}
                disabled={soloLectura}
              >
                {cuestionario === undefined && <MenuItem value={evaluacion.cuestionarioId}>{t('evaluaciones.flujo.desconocido')}</MenuItem>}
                {opciones.map((c) => (
                  <MenuItem key={c.id} value={c.id} disabled={!c.publicada}>
                    {c.codigo} · {c.nombre}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t('evaluaciones.flujo.siReprueba')}
                value={evaluacion.efecto}
                onChange={(e) => cambiar(indice, { efecto: e.target.value as EvaluacionEnEditor['efecto'] })}
                disabled={soloLectura}
              >
                {EFECTOS.map((efecto) => (
                  <MenuItem key={efecto} value={efecto}>
                    {t(`evaluaciones.flujo.efectos.${efecto}`)}
                  </MenuItem>
                ))}
              </TextField>
              {!soloLectura && (
                <Tooltip title={t('evaluaciones.flujo.quitar')}>
                  <IconButton size="small" aria-label={t('evaluaciones.flujo.quitarA', { nombre: cuestionario?.nombre ?? evaluacion.cuestionarioId })} onClick={() => onCambiar(evaluaciones.filter((_, i) => i !== indice))}>
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {definicion && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                {t('evaluaciones.flujo.resumen', { responde: t(`evaluaciones.responde.${definicion.responde}`), umbral: numero(definicion.umbralDeAprobacion), version: cuestionario.publicada?.version })}
              </Typography>
            )}
          </Box>
        );
      })}
      {!soloLectura && (
        <Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Plus size={14} aria-hidden />}
            disabled={disponibles.length === 0}
            onClick={() => disponibles[0] && onCambiar([...evaluaciones, { cuestionarioId: disponibles[0].id, efecto: 'Bloquear' }])}
          >
            {t('evaluaciones.flujo.pedir')}
          </Button>
          {disponibles.length === 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              {t('evaluaciones.flujo.sinDisponibles')}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );
}
