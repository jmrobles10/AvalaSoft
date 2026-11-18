import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { AjusteDto, EvaluacionDto } from '@avalasoft/api-client';
import { FaltaParaEnviar, FormularioDeDialogo, MarcoTabla } from '@avalasoft/ui';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../shared/componentes';
import { useAvisos } from '../../shared/useAvisos';
import { useAnularEvaluacion, useReabrirEvaluacion, useRecalificarEvaluacion } from './api';
import { CampoDecimal } from './CampoDecimal';
import { errorDeCuestionario, formatearPuntaje, numero } from './modelo';

export const MAXIMO_JUSTIFICACION = 1000;
const ANCHO = { width: 560, maxWidth: 'calc(100% - 32px)' } as const;

function CampoJustificacion({ valor, onCambiar, tocada }: { valor: string; onCambiar: (valor: string) => void; tocada: boolean }) {
  const { t } = useTranslation();
  return (
    <TextField
      size="small"
      multiline
      minRows={3}
      required
      label={t('evaluaciones.dialogos.justificacion')}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      error={tocada && !valor.trim()}
      helperText={tocada && !valor.trim() ? t('evaluaciones.dialogos.justificacionRequerida') : t('evaluaciones.dialogos.justificacionContador', { n: valor.length, max: MAXIMO_JUSTIFICACION })}
      slotProps={{ htmlInput: { maxLength: MAXIMO_JUSTIFICACION } }}
    />
  );
}

interface MarcoProps {
  titulo: string;
  subtitulo?: string;
  confirmar: string;
  icono?: ReactNode;
  ocupado: boolean;
  falta: string | null;
  error: unknown;
  ancho?: boolean;
  onEnviar: () => void;
  onCerrar: () => void;
  children: ReactNode;
}

function Marco({ titulo, subtitulo, confirmar, ocupado, falta, error, onEnviar, onCerrar, children }: MarcoProps) {
  const { t } = useTranslation();
  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    if (!falta) onEnviar();
  };
  return (
    <Dialog open onClose={ocupado ? undefined : onCerrar} maxWidth={false} slotProps={{ paper: { sx: ANCHO } }} aria-labelledby="titulo-dialogo-evaluacion">
      <FormularioDeDialogo onSubmit={enviar}>
        <DialogTitle id="titulo-dialogo-evaluacion">
          {titulo}
          {subtitulo && (
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontWeight: 400 }}>
              {subtitulo}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {error !== null && error !== undefined && <Alert severity="error">{errorDeCuestionario(error, t)}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          {falta && <FaltaParaEnviar>{falta}</FaltaParaEnviar>}
          <Button variant="text" onClick={onCerrar} disabled={ocupado} sx={{ color: 'text.primary' }}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" variant="contained" disabled={Boolean(falta) || ocupado} startIcon={ocupado ? <IconoCarga /> : undefined}>
            {confirmar}
          </Button>
        </DialogActions>
      </FormularioDeDialogo>
    </Dialog>
  );
}

export interface DialogoDeEvaluacionProps {
  evaluacion: EvaluacionDto;
  empresaId: string;
  onCerrar: () => void;
}

/** Reabrir (devuelve a pendiente para responder de nuevo) o anular (el expediente deja de esperarla): ambos piden justificación y quedan en el historial. */
export function DialogoJustificar({ evaluacion, empresaId, onCerrar, accion }: DialogoDeEvaluacionProps & { accion: 'reabrir' | 'anular' }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const reabrir = useReabrirEvaluacion(empresaId, evaluacion.id);
  const anular = useAnularEvaluacion(empresaId, evaluacion.id);
  const mutacion = accion === 'reabrir' ? reabrir : anular;
  const [justificacion, setJustificacion] = useState('');
  const [tocada, setTocada] = useState(false);

  return (
    <Marco
      titulo={t(`evaluaciones.dialogos.${accion}.titulo`)}
      subtitulo={`${evaluacion.tercero.nombre} · ${evaluacion.cuestionario.nombre}`}
      confirmar={t(`evaluaciones.dialogos.${accion}.confirmar`)}
      ocupado={mutacion.isPending}
      falta={justificacion.trim() ? null : t('evaluaciones.dialogos.justificacionRequerida')}
      error={mutacion.error}
      onCerrar={onCerrar}
      onEnviar={() =>
        mutacion.mutate(justificacion.trim(), {
          onSuccess: () => {
            mostrar(t(`evaluaciones.dialogos.${accion}.exito`));
            onCerrar();
          },
        })
      }
    >
      <Alert severity={accion === 'anular' ? 'warning' : 'info'}>{t(`evaluaciones.dialogos.${accion}.ayuda`)}</Alert>
      <div onBlur={() => setTocada(true)}>
        <CampoJustificacion valor={justificacion} onCambiar={setJustificacion} tocada={tocada} />
      </div>
    </Marco>
  );
}

type Veredicto = 'calculado' | 'aprobada' | 'reprobada';

interface AjusteEnDialogo {
  puntaje: number | null;
  levanta: boolean;
}

/**
 * Recalificar con justificación (CE-10): el revisor ajusta el puntaje (0 a 100) de una pregunta, levanta una eliminatoria y/o fija el veredicto a mano. El conjunto reemplaza
 * al anterior; la calificación anterior queda en el historial. Si el veredicto cambia, el expediente que la esperaba se entera en el acto.
 */
export function DialogoRecalificar({ evaluacion, empresaId, onCerrar }: DialogoDeEvaluacionProps) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const mutacion = useRecalificarEvaluacion(empresaId, evaluacion.id);
  const resultado = evaluacion.resultado;
  const [ajustes, setAjustes] = useState<Record<string, AjusteEnDialogo>>(() =>
    Object.fromEntries(evaluacion.ajustes.map((a) => [a.pregunta, { puntaje: a.puntaje == null ? null : numero(a.puntaje), levanta: a.levantaEliminatoria ?? false }])),
  );
  const [veredicto, setVeredicto] = useState<Veredicto>(resultado && !resultado.calculada ? (resultado.aprobada ? 'aprobada' : 'reprobada') : 'calculado');
  const [justificacion, setJustificacion] = useState('');
  const [tocada, setTocada] = useState(false);
  if (!resultado) return null;

  const filas = evaluacion.definicion.secciones.flatMap((s) =>
    s.preguntas.flatMap((p) => {
      const c = resultado.preguntas.find((x) => x.codigo === p.codigo);
      return c?.visible && (c.puntaje !== null || c.elimina || ajustes[p.codigo ?? '']?.levanta) ? [{ pregunta: p, calificada: c }] : [];
    }),
  );
  const cambiar = (codigo: string, cambio: Partial<AjusteEnDialogo>) => setAjustes((a) => ({ ...a, [codigo]: { puntaje: null, levanta: false, ...a[codigo], ...cambio } }));
  const aPeticion = (): AjusteDto[] =>
    Object.entries(ajustes)
      .filter(([, a]) => a.puntaje !== null || a.levanta)
      .map(([pregunta, a]) => ({ pregunta, puntaje: a.puntaje, levantaEliminatoria: a.levanta }));

  return (
    <Marco
      titulo={t('evaluaciones.dialogos.recalificar.titulo')}
      subtitulo={`${evaluacion.tercero.nombre} · ${evaluacion.cuestionario.nombre}`}
      confirmar={t('evaluaciones.dialogos.recalificar.confirmar')}
      ocupado={mutacion.isPending}
      falta={justificacion.trim() ? null : t('evaluaciones.dialogos.justificacionRequerida')}
      error={mutacion.error}
      onCerrar={onCerrar}
      onEnviar={() =>
        mutacion.mutate(
          { justificacion: justificacion.trim(), ajustes: aPeticion(), aprobada: veredicto === 'calculado' ? null : veredicto === 'aprobada' },
          {
            onSuccess: (e) => {
              mostrar(t(e.resultado?.aprobada ? 'evaluaciones.dialogos.recalificar.exitoAprobada' : 'evaluaciones.dialogos.recalificar.exitoReprobada'));
              onCerrar();
            },
          },
        )
      }
    >
      <Alert severity="info">{t('evaluaciones.dialogos.recalificar.ayuda', { puntaje: formatearPuntaje(resultado.puntaje) })}</Alert>
      <MarcoTabla>
        <Table size="small" aria-label={t('evaluaciones.dialogos.recalificar.preguntas')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('evaluaciones.detalle.columnas.pregunta')}</TableCell>
              <TableCell sx={{ width: 90 }} align="right">
                {t('evaluaciones.dialogos.recalificar.actual')}
              </TableCell>
              <TableCell sx={{ width: 120 }}>{t('evaluaciones.dialogos.recalificar.nuevo')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filas.map(({ pregunta, calificada }) => {
              const codigo = pregunta.codigo ?? '';
              const ajuste = ajustes[codigo];
              return (
                <TableRow key={codigo}>
                  <TableCell>
                    <Typography variant="body2">{pregunta.texto}</Typography>
                    {(calificada.elimina || ajuste?.levanta) && (
                      <FormControlLabel
                        label={t('evaluaciones.dialogos.recalificar.levantar')}
                        control={<Checkbox size="small" checked={ajuste?.levanta ?? false} onChange={(e) => cambiar(codigo, { levanta: e.target.checked })} />}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">{calificada.puntaje == null ? '—' : formatearPuntaje(calificada.puntaje)}</TableCell>
                  <TableCell>
                    {calificada.puntaje !== null && (
                      <CampoDecimal label={t('evaluaciones.dialogos.recalificar.puntaje')} valor={ajuste?.puntaje ?? null} admiteVacio onCambiar={(v) => cambiar(codigo, { puntaje: v === null ? null : Math.min(100, v) })} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </MarcoTabla>
      <TextField select size="small" label={t('evaluaciones.dialogos.recalificar.veredicto')} value={veredicto} onChange={(e) => setVeredicto(e.target.value as Veredicto)} helperText={t('evaluaciones.dialogos.recalificar.veredictoAyuda')}>
        <MenuItem value="calculado">{t('evaluaciones.dialogos.recalificar.veredictos.calculado')}</MenuItem>
        <MenuItem value="aprobada">{t('evaluaciones.dialogos.recalificar.veredictos.aprobada')}</MenuItem>
        <MenuItem value="reprobada">{t('evaluaciones.dialogos.recalificar.veredictos.reprobada')}</MenuItem>
      </TextField>
      <div onBlur={() => setTocada(true)}>
        <CampoJustificacion valor={justificacion} onCambiar={setJustificacion} tocada={tocada} />
      </div>
    </Marco>
  );
}
