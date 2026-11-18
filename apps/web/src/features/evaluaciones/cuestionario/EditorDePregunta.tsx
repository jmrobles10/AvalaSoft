import { Box, Chip, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import type { PreguntaDeCuestionarioDto, TipoDePregunta } from '@avalasoft/api-client';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CampoDecimal } from '../CampoDecimal';
import { cambiarTipo, condicionDe, numero, opcionesParaCondicion, TIPOS_DE_PREGUNTA, TIPOS_SIN_PUNTAJE, visibilidadDe } from '../modelo';
import { EditorDeOpciones } from './EditorDeOpciones';

export interface EditorDePreguntaProps {
  pregunta: PreguntaDeCuestionarioDto;
  /** Posición en la sección y cuántas hay (para ofrecer subir o bajar). */
  indice: number;
  total: number;
  /** Preguntas anteriores a esta (de su sección y de las anteriores): a las que puede mirar su condición. */
  anteriores: readonly PreguntaDeCuestionarioDto[];
  onCambiar: (pregunta: PreguntaDeCuestionarioDto) => void;
  onQuitar: () => void;
  onMover: (direccion: -1 | 1) => void;
  soloLectura: boolean;
  /** Texto del error que la API o la validación dicen de esta pregunta. */
  error?: string;
}

/**
 * Una pregunta del cuestionario (CE-2): su texto, tipo, peso, si es obligatoria o eliminatoria, lo que puntúa según el tipo y cuándo se muestra (siempre o según la
 * respuesta a una pregunta anterior, con el mismo motor de condiciones de los requisitos del flujo).
 */
export function EditorDePregunta({ pregunta, indice, total, anteriores, onCambiar, onQuitar, onMover, soloLectura, error }: EditorDePreguntaProps) {
  const { t } = useTranslation();
  const puntua = !TIPOS_SIN_PUNTAJE.includes(pregunta.tipo);
  const visibilidad = visibilidadDe(pregunta.condicion);
  const referida = visibilidad.tipo === 'respuesta' ? anteriores.find((p) => p.codigo === visibilidad.pregunta) : undefined;
  const opcionesReferida = opcionesParaCondicion(referida);
  const candidatas = anteriores.filter((p) => opcionesParaCondicion(p).length > 0);

  return (
    <Box component="section" aria-label={t('evaluaciones.editor.pregunta', { codigo: pregunta.codigo })} sx={{ border: 1, borderColor: error ? 'error.main' : 'divider', borderRadius: 1, p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Chip size="small" variant="outlined" label={pregunta.codigo} />
        <TextField
          select
          size="small"
          label={t('evaluaciones.editor.tipo')}
          value={pregunta.tipo}
          onChange={(e) => onCambiar(cambiarTipo(pregunta, e.target.value as TipoDePregunta))}
          disabled={soloLectura}
          sx={{ width: 200 }}
        >
          {TIPOS_DE_PREGUNTA.map((tipo) => (
            <MenuItem key={tipo} value={tipo}>
              {t(`evaluaciones.tipos.${tipo}`)}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        {!soloLectura && (
          <>
            <Tooltip title={t('evaluaciones.editor.subir')}>
              <span>
                <IconButton size="small" aria-label={t('evaluaciones.editor.subirPregunta', { codigo: pregunta.codigo })} disabled={indice === 0} onClick={() => onMover(-1)}>
                  <ArrowUp size={16} aria-hidden />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('evaluaciones.editor.bajar')}>
              <span>
                <IconButton size="small" aria-label={t('evaluaciones.editor.bajarPregunta', { codigo: pregunta.codigo })} disabled={indice === total - 1} onClick={() => onMover(1)}>
                  <ArrowDown size={16} aria-hidden />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('evaluaciones.editor.quitar')}>
              <IconButton size="small" aria-label={t('evaluaciones.editor.quitarPregunta', { codigo: pregunta.codigo })} onClick={onQuitar}>
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Stack spacing={1.5}>
        <TextField
          size="small"
          multiline
          minRows={1}
          label={t('evaluaciones.editor.texto')}
          value={pregunta.texto}
          onChange={(e) => onCambiar({ ...pregunta, texto: e.target.value })}
          disabled={soloLectura}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <TextField
          size="small"
          label={t('evaluaciones.editor.ayuda')}
          value={pregunta.ayuda ?? ''}
          onChange={(e) => onCambiar({ ...pregunta, ayuda: e.target.value || null })}
          disabled={soloLectura}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {puntua && (
            <CampoDecimal label={t('evaluaciones.editor.peso')} valor={numero(pregunta.peso)} disabled={soloLectura} onCambiar={(v) => onCambiar({ ...pregunta, peso: v ?? 0 })} helperText={t('evaluaciones.editor.pesoAyuda')} sx={{ width: 150 }} />
          )}
          <FormControlLabel
            label={t('evaluaciones.editor.obligatoria')}
            control={<Switch size="small" checked={pregunta.obligatoria} disabled={soloLectura || pregunta.eliminatoria} onChange={(e) => onCambiar({ ...pregunta, obligatoria: e.target.checked })} />}
          />
          {puntua && (
            <Tooltip title={t('evaluaciones.editor.eliminatoriaAyuda')}>
              <FormControlLabel
                label={t('evaluaciones.editor.eliminatoria')}
                control={
                  <Switch
                    size="small"
                    checked={pregunta.eliminatoria}
                    disabled={soloLectura}
                    onChange={(e) => onCambiar({ ...pregunta, eliminatoria: e.target.checked, obligatoria: e.target.checked ? true : pregunta.obligatoria })}
                  />
                }
              />
            </Tooltip>
          )}
          <FormControlLabel
            label={t('evaluaciones.editor.permiteComentario')}
            control={<Switch size="small" checked={pregunta.permiteComentario ?? false} disabled={soloLectura} onChange={(e) => onCambiar({ ...pregunta, permiteComentario: e.target.checked })} />}
          />
        </Stack>

        <EditorDeOpciones pregunta={pregunta} onCambiar={onCambiar} soloLectura={soloLectura} />

        {(candidatas.length > 0 || visibilidad.tipo !== 'siempre') && (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(4, minmax(0,1fr))' }, alignItems: 'start' }}>
            <TextField
              select
              size="small"
              label={t('evaluaciones.editor.seMuestra')}
              value={visibilidad.tipo}
              onChange={(e) => {
                if (e.target.value === 'siempre') onCambiar({ ...pregunta, condicion: null });
                else if (e.target.value === 'respuesta' && candidatas[0])
                  onCambiar({ ...pregunta, condicion: condicionDe({ tipo: 'respuesta', pregunta: candidatas[0].codigo ?? '', operador: 'Igual', valor: opcionesParaCondicion(candidatas[0])[0]?.codigo ?? '' }) });
              }}
              disabled={soloLectura}
            >
              <MenuItem value="siempre">{t('evaluaciones.editor.visibilidad.siempre')}</MenuItem>
              <MenuItem value="respuesta" disabled={candidatas.length === 0}>
                {t('evaluaciones.editor.visibilidad.respuesta')}
              </MenuItem>
              {visibilidad.tipo === 'personalizada' && <MenuItem value="personalizada">{t('evaluaciones.editor.visibilidad.personalizada')}</MenuItem>}
            </TextField>
            {visibilidad.tipo === 'respuesta' && (
              <>
                <TextField
                  select
                  size="small"
                  label={t('evaluaciones.editor.siLaPregunta')}
                  value={visibilidad.pregunta}
                  onChange={(e) => {
                    const otra = candidatas.find((p) => p.codigo === e.target.value);
                    onCambiar({ ...pregunta, condicion: condicionDe({ ...visibilidad, pregunta: e.target.value, valor: opcionesParaCondicion(otra)[0]?.codigo ?? '' }) });
                  }}
                  disabled={soloLectura}
                >
                  {candidatas.map((p) => (
                    <MenuItem key={p.codigo} value={p.codigo ?? ''}>
                      {p.codigo} · {p.texto.slice(0, 40) || t('evaluaciones.editor.sinTexto')}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label={t('evaluaciones.editor.operador')}
                  value={visibilidad.operador}
                  onChange={(e) => onCambiar({ ...pregunta, condicion: condicionDe({ ...visibilidad, operador: e.target.value as 'Igual' | 'Distinto' }) })}
                  disabled={soloLectura}
                >
                  <MenuItem value="Igual">{t('evaluaciones.editor.visibilidad.igual')}</MenuItem>
                  <MenuItem value="Distinto">{t('evaluaciones.editor.visibilidad.distinto')}</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label={t('evaluaciones.editor.respuesta')}
                  value={visibilidad.valor}
                  onChange={(e) => onCambiar({ ...pregunta, condicion: condicionDe({ ...visibilidad, valor: e.target.value }) })}
                  disabled={soloLectura}
                >
                  {opcionesReferida.map((o) => (
                    <MenuItem key={o.codigo} value={o.codigo}>
                      {o.texto}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Box>
        )}
        {error && (
          <Typography role="alert" variant="caption" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
