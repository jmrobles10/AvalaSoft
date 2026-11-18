import { Alert, Box, Button, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { SCOPES, type VinculoDto } from '@avalasoft/api-client';
import { formatearFecha } from '@avalasoft/ui';
import { ClipboardPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { IconoCarga, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { usePermisos } from '../../shared/usePermisos';
import { useAsignarEvaluacion, useCuestionarios, useEvaluaciones } from './api';
import { formatearPuntaje } from './modelo';
import { ChipEvaluacion } from './PaginaEvaluaciones';

/**
 * Evaluaciones del vínculo (CE-3, CE-11, CE-12): las del expediente, las de la reevaluación periódica y las asignadas a mano, con su puntaje y veredicto, y la acción de
 * asignar un cuestionario publicado a un proveedor que ya existe (efecto «observar»: no hay expediente al que frenar). Privadas de la empresa: el tercero no las ve.
 * Sin permiso de leer evaluaciones, la tarjeta no aparece.
 */
export function TarjetaEvaluacionesDelVinculo({ vinculo, empresaId }: { vinculo: VinculoDto; empresaId: string }) {
  const { t } = useTranslation();
  const permisos = usePermisos(empresaId);
  const puedeLeer = permisos.puede(SCOPES.evaluacionesLeer);
  const puedeAsignar = puedeLeer && permisos.puede(SCOPES.vinculosEscribir) && permisos.puede(SCOPES.cuestionariosLeer) && vinculo.estado !== 'Anulado' && vinculo.estado !== 'Desvinculado';
  const consulta = useEvaluaciones(empresaId, { vinculoId: vinculo.id, limite: 50 }, puedeLeer);
  const cuestionarios = useCuestionarios(empresaId, puedeAsignar);
  const asignar = useAsignarEvaluacion(empresaId, vinculo.id);
  const mostrar = useAvisos((s) => s.mostrar);
  const [elegido, setElegido] = useState('');
  if (!puedeLeer) return null;

  const evaluaciones = consulta.data?.datos ?? [];
  const publicados = (cuestionarios.data ?? []).filter((c) => c.publicada);
  const elegidoValido = publicados.some((c) => c.id === elegido) ? elegido : (publicados[0]?.id ?? '');

  return (
    <Tarjeta titulo={t('evaluaciones.vinculo.titulo')}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {t('evaluaciones.vinculo.ayuda')}
      </Typography>
      {consulta.isPending && <Skeleton variant="rounded" height={48} aria-label={t('evaluaciones.vinculo.cargando')} />}
      {consulta.isError && <Alert severity="error">{mensajeDeError(consulta.error, t)}</Alert>}
      {consulta.isSuccess && evaluaciones.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('evaluaciones.vinculo.ninguna')}
        </Typography>
      )}
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {evaluaciones.map((e) => (
          <Box component="li" key={e.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
                    {e.cuestionario}
                  </Typography>
                  <ChipEvaluacion estado={e.estado} aprobada={e.aprobada} />
                  {e.puntaje !== null && (
                    <Typography component="span" variant="monoTabla">
                      {formatearPuntaje(e.puntaje)}
                    </Typography>
                  )}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t(`evaluaciones.motivo.${e.motivo}`)} · {formatearFecha(e.respondidaEn ?? e.asignadaEn)}
                  {e.vigenteHasta ? ` · ${t('evaluaciones.vinculo.vigenteHasta', { fecha: formatearFecha(e.vigenteHasta) })}` : ''}
                </Typography>
              </Box>
              <Button component={RouterLink} to={`/e/${empresaId}/evaluaciones/${e.id}`} size="small" variant="text" sx={{ flex: 'none' }}>
                {t('evaluaciones.vinculo.abrir')}
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
      {puedeAsignar && publicados.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField select size="small" label={t('evaluaciones.vinculo.cuestionario')} value={elegidoValido} onChange={(e) => setElegido(e.target.value)} sx={{ minWidth: 240, flex: '1 1 240px' }}>
            {publicados.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.codigo} · {c.nombre}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant="outlined"
            sx={{ mt: 0.25 }}
            startIcon={asignar.isPending ? <IconoCarga /> : <ClipboardPlus size={14} aria-hidden />}
            disabled={asignar.isPending || !elegidoValido}
            onClick={() => asignar.mutate(elegidoValido, { onSuccess: () => mostrar(t('evaluaciones.vinculo.asignada')), onError: (error) => mostrar(mensajeDeError(error, t), 'error') })}
          >
            {t('evaluaciones.vinculo.asignar')}
          </Button>
        </Stack>
      )}
    </Tarjeta>
  );
}
