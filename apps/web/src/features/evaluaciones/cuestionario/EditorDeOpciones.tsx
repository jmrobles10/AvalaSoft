import { Box, Button, FormControlLabel, IconButton, Stack, Switch, TextField, Typography } from '@mui/material';
import type { OpcionDePreguntaDto, PreguntaDeCuestionarioDto, RangoDeNumeroDto } from '@validalo/api-client';
import { CampoNumero } from '@validalo/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CampoDecimal } from '../CampoDecimal';
import { numero } from '../modelo';

export interface EditorDeOpcionesProps {
  pregunta: PreguntaDeCuestionarioDto;
  onCambiar: (pregunta: PreguntaDeCuestionarioDto) => void;
  soloLectura: boolean;
}

/** Siguiente código libre de una opción (`op3`): no se reutilizan, las condiciones de otras preguntas los citan. */
function siguienteCodigoDeOpcion(opciones: readonly OpcionDePreguntaDto[]): string {
  const usados = new Set(opciones.map((o) => o.codigo));
  let n = 1;
  while (usados.has(`op${String(n)}`)) n++;
  return `op${String(n)}`;
}

/**
 * Lo que puntúa una pregunta según su tipo (CE-5): para Sí/No y opciones, el puntaje relativo de cada una (la mejor vale el 100 % de la pregunta) y cuál
 * elimina; para la escala, sus extremos y el mínimo aceptable; para el número, sus rangos. Texto y archivo no puntúan.
 */
export function EditorDeOpciones({ pregunta, onCambiar, soloLectura }: EditorDeOpcionesProps) {
  const { t } = useTranslation();

  if (pregunta.tipo === 'Texto' || pregunta.tipo === 'Adjunto')
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('evaluaciones.editor.sinPuntaje')}
      </Typography>
    );

  if (pregunta.tipo === 'Escala') {
    const escala = pregunta.escala ?? { minimo: 1, maximo: 5, minimoAceptable: null };
    return (
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <CampoNumero etiqueta={t('evaluaciones.editor.escalaMinimo')} valor={escala.minimo} maxDigitos={2} deshabilitado={soloLectura} onCambiar={(x) => onCambiar({ ...pregunta, escala: { ...escala, minimo: Number(x || 0) } })} sx={{ width: 120 }} />
        <CampoNumero etiqueta={t('evaluaciones.editor.escalaMaximo')} valor={escala.maximo} maxDigitos={2} deshabilitado={soloLectura} onCambiar={(x) => onCambiar({ ...pregunta, escala: { ...escala, maximo: Number(x || 0) } })} sx={{ width: 120 }} />
        {pregunta.eliminatoria && (
          <CampoNumero
            etiqueta={t('evaluaciones.editor.minimoAceptable')}
            valor={escala.minimoAceptable}
            maxDigitos={2}
            deshabilitado={soloLectura}
            ayuda={t('evaluaciones.editor.minimoAceptableAyuda')}
            onCambiar={(x) => onCambiar({ ...pregunta, escala: { ...escala, minimoAceptable: x === '' ? null : Number(x) } })}
            sx={{ width: 220 }}
          />
        )}
      </Stack>
    );
  }

  if (pregunta.tipo === 'Numero') {
    const rangos = pregunta.rangos ?? [];
    const cambiarRango = (indice: number, cambio: Partial<RangoDeNumeroDto>) => onCambiar({ ...pregunta, rangos: rangos.map((r, i) => (i === indice ? { ...r, ...cambio } : r)) });
    return (
      <Stack spacing={1}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('evaluaciones.editor.rangosAyuda')}
        </Typography>
        {rangos.map((rango, indice) => (
          <Stack key={indice} direction="row" spacing={1} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <CampoDecimal label={t('evaluaciones.editor.desde')} valor={rango.desde == null ? null : numero(rango.desde)} admiteVacio disabled={soloLectura} onCambiar={(v) => cambiarRango(indice, { desde: v })} sx={{ width: 110 }} />
            <CampoDecimal label={t('evaluaciones.editor.hasta')} valor={rango.hasta == null ? null : numero(rango.hasta)} admiteVacio disabled={soloLectura} onCambiar={(v) => cambiarRango(indice, { hasta: v })} sx={{ width: 110 }} />
            <CampoDecimal label={t('evaluaciones.editor.puntaje')} valor={numero(rango.puntaje)} disabled={soloLectura} onCambiar={(v) => cambiarRango(indice, { puntaje: v ?? 0 })} sx={{ width: 110 }} />
            {pregunta.eliminatoria && (
              <FormControlLabel sx={{ mt: 0.5 }} label={t('evaluaciones.editor.elimina')} control={<Switch size="small" checked={rango.elimina ?? false} disabled={soloLectura} onChange={(e) => cambiarRango(indice, { elimina: e.target.checked })} />} />
            )}
            {!soloLectura && rangos.length > 1 && (
              <IconButton size="small" aria-label={t('evaluaciones.editor.quitarRango', { n: indice + 1 })} onClick={() => onCambiar({ ...pregunta, rangos: rangos.filter((_, i) => i !== indice) })}>
                <Trash2 size={16} aria-hidden />
              </IconButton>
            )}
          </Stack>
        ))}
        {!soloLectura && (
          <Box>
            <Button size="small" variant="text" startIcon={<Plus size={14} aria-hidden />} onClick={() => onCambiar({ ...pregunta, rangos: [...rangos, { desde: null, hasta: null, puntaje: 0, elimina: false }] })}>
              {t('evaluaciones.editor.agregarRango')}
            </Button>
          </Box>
        )}
      </Stack>
    );
  }

  const opciones = pregunta.opciones ?? [];
  const fijas = pregunta.tipo === 'SiNo';
  const cambiarOpcion = (indice: number, cambio: Partial<OpcionDePreguntaDto>) => onCambiar({ ...pregunta, opciones: opciones.map((o, i) => (i === indice ? { ...o, ...cambio } : o)) });
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('evaluaciones.editor.opcionesAyuda')}
      </Typography>
      {opciones.map((opcion, indice) => (
        <Stack key={opcion.codigo} direction="row" spacing={1} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label={t('evaluaciones.editor.opcion', { n: indice + 1 })}
            value={opcion.texto}
            onChange={(e) => cambiarOpcion(indice, { texto: e.target.value })}
            disabled={soloLectura || fijas}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ flex: '1 1 220px', minWidth: 160 }}
          />
          <CampoDecimal label={t('evaluaciones.editor.puntaje')} valor={numero(opcion.puntaje)} disabled={soloLectura} onCambiar={(v) => cambiarOpcion(indice, { puntaje: v ?? 0 })} sx={{ width: 110 }} />
          {pregunta.eliminatoria && (
            <FormControlLabel sx={{ mt: 0.5 }} label={t('evaluaciones.editor.elimina')} control={<Switch size="small" checked={opcion.elimina ?? false} disabled={soloLectura} onChange={(e) => cambiarOpcion(indice, { elimina: e.target.checked })} />} />
          )}
          {!soloLectura && !fijas && opciones.length > 2 && (
            <IconButton size="small" aria-label={t('evaluaciones.editor.quitarOpcion', { n: indice + 1 })} onClick={() => onCambiar({ ...pregunta, opciones: opciones.filter((_, i) => i !== indice) })}>
              <Trash2 size={16} aria-hidden />
            </IconButton>
          )}
        </Stack>
      ))}
      {!soloLectura && !fijas && (
        <Box>
          <Button size="small" variant="text" startIcon={<Plus size={14} aria-hidden />} disabled={opciones.length >= 20} onClick={() => onCambiar({ ...pregunta, opciones: [...opciones, { codigo: siguienteCodigoDeOpcion(opciones), texto: '', puntaje: 0, elimina: false }] })}>
            {t('evaluaciones.editor.agregarOpcion')}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
