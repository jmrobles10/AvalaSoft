import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { DefinicionDeCuestionarioDto, PreguntaDeCuestionarioDto, SeccionDeCuestionarioDto } from '@validalo/api-client';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CampoDecimal } from '../CampoDecimal';
import { mover, numero, preguntaNueva, preguntasAnteriores, siguienteCodigo, type ErrorDeDefinicion } from '../modelo';
import { EditorDePregunta } from './EditorDePregunta';

export interface EditorDeSeccionProps {
  definicion: DefinicionDeCuestionarioDto;
  indice: number;
  onCambiar: (seccion: SeccionDeCuestionarioDto) => void;
  onQuitar: () => void;
  onMover: (direccion: -1 | 1) => void;
  /** Aviso de la validación de esta sección o de alguna de sus preguntas. */
  errores: readonly ErrorDeDefinicion[];
  /** Errores que dijo la API por código de pregunta (`P3` → texto). */
  erroresDeApi: Readonly<Record<string, string>>;
  soloLectura: boolean;
}

/** Una sección del cuestionario: nombre, peso dentro del total y sus preguntas (se agregan, se mueven y se quitan). */
export function EditorDeSeccion({ definicion, indice, onCambiar, onQuitar, onMover, errores, erroresDeApi, soloLectura }: EditorDeSeccionProps) {
  const { t } = useTranslation();
  const seccion = definicion.secciones[indice];
  if (!seccion) return null;
  const sinNombre = errores.some((e) => e.codigo === 'seccion-sin-nombre' && e.seccion === indice);
  const cambiarPregunta = (posicion: number, pregunta: PreguntaDeCuestionarioDto) => onCambiar({ ...seccion, preguntas: seccion.preguntas.map((p, i) => (i === posicion ? pregunta : p)) });
  const moverPregunta = (posicion: number, direccion: -1 | 1) => {
    const destino = posicion + direccion;
    if (destino < 0 || destino >= seccion.preguntas.length) return;
    onCambiar({ ...seccion, preguntas: mover(seccion.preguntas, posicion, destino) });
  };
  const textoDeError = (posicion: number, pregunta: PreguntaDeCuestionarioDto): string | undefined => {
    const propio = errores.find((e) => 'pregunta' in e && e.seccion === indice && e.pregunta === posicion);
    return propio ? t(`evaluaciones.editor.errores.${propio.codigo}`) : erroresDeApi[pregunta.codigo ?? ''];
  };

  return (
    <Box component="section" aria-label={t('evaluaciones.editor.seccion', { n: indice + 1 })} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ flex: 1, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'minmax(0,1fr) 150px' }, alignItems: 'start' }}>
          <TextField
            size="small"
            label={t('evaluaciones.editor.nombreSeccion')}
            value={seccion.nombre}
            onChange={(e) => onCambiar({ ...seccion, nombre: e.target.value })}
            disabled={soloLectura}
            error={sinNombre}
            helperText={sinNombre ? t('evaluaciones.editor.errores.seccion-sin-nombre') : undefined}
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
          <CampoDecimal label={t('evaluaciones.editor.pesoSeccion')} valor={numero(seccion.peso)} disabled={soloLectura} onCambiar={(v) => onCambiar({ ...seccion, peso: v ?? 0 })} helperText={t('evaluaciones.editor.pesoSeccionAyuda')} />
        </Box>
        {!soloLectura && (
          <Stack direction="row" sx={{ pt: 0.25 }}>
            <Tooltip title={t('evaluaciones.editor.subir')}>
              <span>
                <IconButton size="small" aria-label={t('evaluaciones.editor.subirSeccion', { n: indice + 1 })} disabled={indice === 0} onClick={() => onMover(-1)}>
                  <ArrowUp size={16} aria-hidden />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('evaluaciones.editor.bajar')}>
              <span>
                <IconButton size="small" aria-label={t('evaluaciones.editor.bajarSeccion', { n: indice + 1 })} disabled={indice === definicion.secciones.length - 1} onClick={() => onMover(1)}>
                  <ArrowDown size={16} aria-hidden />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('evaluaciones.editor.quitar')}>
              <IconButton size="small" aria-label={t('evaluaciones.editor.quitarSeccion', { n: indice + 1 })} onClick={onQuitar}>
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>
      <TextField
        size="small"
        fullWidth
        label={t('evaluaciones.editor.descripcionSeccion')}
        value={seccion.descripcion ?? ''}
        onChange={(e) => onCambiar({ ...seccion, descripcion: e.target.value || null })}
        disabled={soloLectura}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        sx={{ mb: 1.5 }}
      />
      <Stack spacing={1.5}>
        {seccion.preguntas.map((pregunta, posicion) => (
          <EditorDePregunta
            key={pregunta.codigo}
            pregunta={pregunta}
            indice={posicion}
            total={seccion.preguntas.length}
            anteriores={preguntasAnteriores(definicion, indice, posicion)}
            onCambiar={(p) => cambiarPregunta(posicion, p)}
            onQuitar={() => onCambiar({ ...seccion, preguntas: seccion.preguntas.filter((_, i) => i !== posicion) })}
            onMover={(d) => moverPregunta(posicion, d)}
            soloLectura={soloLectura}
            error={textoDeError(posicion, pregunta)}
          />
        ))}
        {seccion.preguntas.length === 0 && (
          <Typography variant="body2" sx={{ color: errores.some((e) => e.codigo === 'seccion-sin-preguntas' && e.seccion === indice) ? 'error.main' : 'text.secondary' }}>
            {t('evaluaciones.editor.errores.seccion-sin-preguntas')}
          </Typography>
        )}
        {!soloLectura && (
          <Box>
            <Button size="small" variant="outlined" startIcon={<Plus size={14} aria-hidden />} onClick={() => onCambiar({ ...seccion, preguntas: [...seccion.preguntas, preguntaNueva('SiNo', siguienteCodigo(definicion, 'P'))] })}>
              {t('evaluaciones.editor.agregarPregunta')}
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
