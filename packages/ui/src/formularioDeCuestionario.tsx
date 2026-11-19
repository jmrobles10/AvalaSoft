import { Box, Button, Checkbox, Chip, FormControlLabel, FormGroup, IconButton, Radio, RadioGroup, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Paperclip, X } from 'lucide-react';
import { useRef } from 'react';

/** Tipos de pregunta que sabe dibujar el formulario (los de `TipoDePregunta` de la API). */
export type TipoDePreguntaDeFormulario = 'SiNo' | 'OpcionUnica' | 'OpcionMultiple' | 'Escala' | 'Numero' | 'Texto' | 'Adjunto';

export interface PreguntaDeFormulario {
  codigo: string;
  texto: string;
  tipo: TipoDePreguntaDeFormulario;
  obligatoria: boolean;
  ayuda?: string | null;
  permiteComentario: boolean;
  opciones?: readonly { codigo: string; texto: string }[] | null;
  escala?: { minimo: number; maximo: number } | null;
}

export interface SeccionDeFormulario {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  preguntas: readonly PreguntaDeFormulario[];
}

/** Lo que lleva escrito la persona en una pregunta: el número queda como texto mientras se escribe (`1.`, `-`). */
export interface BorradorDeRespuesta {
  opciones?: readonly string[];
  numero?: string;
  texto?: string;
  adjuntos?: readonly string[];
  comentario?: string;
}

export type BorradorDeRespuestas = Readonly<Record<string, BorradorDeRespuesta>>;

/** Respuesta lista para la API (`RespuestaDto`). */
export interface RespuestaParaEnviar {
  pregunta: string;
  opciones?: string[];
  numero?: number;
  texto?: string;
  adjuntos?: string[];
  comentario?: string;
}

/** Qué preguntas y secciones se muestran (lo calcula la API con las condiciones); `null` = todas. */
export interface VisibilidadDeFormulario {
  preguntas: ReadonlySet<string>;
  secciones: ReadonlySet<string>;
}

export interface TextosDelFormulario {
  comentario: string;
  subirArchivo: string;
  quitarArchivo: (nombre: string) => string;
  subiendo: string;
  numero: string;
  obligatoria: string;
}

export interface AdjuntoSubido {
  id: string;
  nombre: string;
}

export interface FormularioDeCuestionarioProps {
  secciones: readonly SeccionDeFormulario[];
  respuestas: BorradorDeRespuestas;
  onCambiar: (respuestas: BorradorDeRespuestas) => void;
  visibilidad: VisibilidadDeFormulario | null;
  textos: TextosDelFormulario;
  /** Archivos ya subidos a la evaluación (para mostrar su nombre). */
  adjuntos?: readonly AdjuntoSubido[];
  /** Sube el archivo de una pregunta de tipo adjunto; quien lo da cita después su id en `respuestas`. Sin esto, la pregunta de adjunto no ofrece subir. */
  onSubirAdjunto?: (pregunta: string, archivo: File) => void;
  /** Hay una subida en curso. */
  subiendoAdjunto?: boolean;
  soloLectura?: boolean;
  /** Preguntas que la API objetó o que faltan, con su mensaje. */
  errores?: Readonly<Record<string, string>>;
}

const ES_NUMERO = /^-?\d*[.,]?\d*$/;

/** Número que escribió la persona (admite coma o punto decimal); `null` si está vacío o a medias. */
export function leerNumero(texto: string | undefined): number | null {
  const limpio = (texto ?? '').trim().replace(',', '.');
  if (limpio === '' || limpio === '-' || limpio === '.' || limpio === '-.') return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** ¿Hay algo respondido en esta pregunta? (Un comentario suelto no cuenta.) */
export function estaRespondida(borrador: BorradorDeRespuesta | undefined): boolean {
  return Boolean(borrador && ((borrador.opciones?.length ?? 0) > 0 || leerNumero(borrador.numero) !== null || (borrador.texto ?? '').trim() !== '' || (borrador.adjuntos?.length ?? 0) > 0));
}

/** Respuestas para enviar: solo las preguntas visibles que tienen algo escrito, con el número ya convertido. */
export function respuestasParaEnviar(respuestas: BorradorDeRespuestas, visibilidad: VisibilidadDeFormulario | null): RespuestaParaEnviar[] {
  return Object.entries(respuestas)
    .filter(([codigo, b]) => (visibilidad === null || visibilidad.preguntas.has(codigo)) && estaRespondida(b))
    .map(([codigo, b]) => {
      const numero = leerNumero(b.numero);
      const comentario = (b.comentario ?? '').trim();
      return {
        pregunta: codigo,
        ...(b.opciones?.length ? { opciones: [...b.opciones] } : {}),
        ...(numero !== null ? { numero } : {}),
        ...((b.texto ?? '').trim() ? { texto: (b.texto ?? '').trim() } : {}),
        ...(b.adjuntos?.length ? { adjuntos: [...b.adjuntos] } : {}),
        ...(comentario ? { comentario } : {}),
      };
    });
}

/** Códigos de las preguntas obligatorias y visibles que aún no tienen respuesta. */
export function preguntasQueFaltan(secciones: readonly SeccionDeFormulario[], respuestas: BorradorDeRespuestas, visibilidad: VisibilidadDeFormulario | null): string[] {
  return secciones
    .filter((s) => visibilidad === null || visibilidad.secciones.has(s.codigo))
    .flatMap((s) => s.preguntas)
    .filter((p) => p.obligatoria && (visibilidad === null || visibilidad.preguntas.has(p.codigo)) && !estaRespondida(respuestas[p.codigo]))
    .map((p) => p.codigo);
}

/** Pregunta tal como la entrega la API (la completa de la empresa o la pública del tercero): lo que el formulario necesita para dibujarla. */
export interface PreguntaDeOrigen {
  codigo?: string | null;
  texto: string;
  tipo: TipoDePreguntaDeFormulario;
  obligatoria: boolean;
  ayuda?: string | null;
  permiteComentario?: boolean | null;
  opciones?: readonly { codigo: string; texto: string }[] | null;
  escala?: { minimo: number; maximo: number } | null;
}

export interface SeccionDeOrigen {
  codigo?: string | null;
  nombre: string;
  descripcion?: string | null;
  preguntas: readonly PreguntaDeOrigen[];
}

/** Secciones de un cuestionario como las dibuja el formulario: sin pesos, puntajes ni eliminatorias (eso el formulario no lo necesita ni debe mostrarlo). */
export function aSeccionesDeFormulario(secciones: readonly SeccionDeOrigen[]): SeccionDeFormulario[] {
  return secciones.map((s) => ({
    codigo: s.codigo ?? '',
    nombre: s.nombre,
    descripcion: s.descripcion,
    preguntas: s.preguntas.map((p) => ({
      codigo: p.codigo ?? '',
      texto: p.texto,
      tipo: p.tipo,
      obligatoria: p.obligatoria,
      ayuda: p.ayuda,
      permiteComentario: p.permiteComentario ?? false,
      opciones: p.opciones?.map((o) => ({ codigo: o.codigo, texto: o.texto })),
      escala: p.escala ? { minimo: p.escala.minimo, maximo: p.escala.maximo } : null,
    })),
  }));
}

/** Respuesta ya guardada en la evaluación (`RespuestaDto`). */
export interface RespuestaGuardada {
  pregunta: string;
  opciones?: readonly string[] | null;
  numero?: number | string | null;
  texto?: string | null;
  adjuntos?: readonly string[] | null;
  comentario?: string | null;
}

/** El borrador del formulario a partir de lo ya respondido (el número queda como texto, como lo escribe la persona). */
export function borradorDesdeRespuestas(respuestas: readonly RespuestaGuardada[]): BorradorDeRespuestas {
  return Object.fromEntries(
    respuestas.map((r) => [
      r.pregunta,
      {
        ...(r.opciones?.length ? { opciones: [...r.opciones] } : {}),
        ...(r.numero !== null && r.numero !== undefined ? { numero: String(r.numero).replace('.', ',') } : {}),
        ...(r.texto ? { texto: r.texto } : {}),
        ...(r.adjuntos?.length ? { adjuntos: [...r.adjuntos] } : {}),
        ...(r.comentario ? { comentario: r.comentario } : {}),
      },
    ]),
  );
}

/**
 * Formulario de un cuestionario de evaluación (CE-2): las secciones y preguntas visibles, cada una con el campo de su tipo (sí/no, opción única o múltiple, escala,
 * número, texto o archivo de evidencia) y su comentario opcional. No sabe de puntajes ni de la API: lo usan la empresa (evaluador interno) y el tercero (autoevaluación),
 * este último sin ver los pesos ni las eliminatorias. Quien lo usa guarda el borrador, pide la visibilidad y sube los archivos.
 */
export function FormularioDeCuestionario({ secciones, respuestas, onCambiar, visibilidad, textos, adjuntos = [], onSubirAdjunto, subiendoAdjunto, soloLectura = false, errores = {} }: FormularioDeCuestionarioProps) {
  const cambiar = (codigo: string, cambio: Partial<BorradorDeRespuesta>) => onCambiar({ ...respuestas, [codigo]: { ...respuestas[codigo], ...cambio } });
  const visibles = secciones.filter((s) => visibilidad === null || visibilidad.secciones.has(s.codigo));

  return (
    <Stack spacing={2}>
      {visibles.map((seccion) => (
        <Box key={seccion.codigo} component="section" aria-labelledby={`seccion-${seccion.codigo}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: { xs: 1.5, sm: 2 } }}>
          <Typography id={`seccion-${seccion.codigo}`} variant="h6" component="h2">
            {seccion.nombre}
          </Typography>
          {seccion.descripcion && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {seccion.descripcion}
            </Typography>
          )}
          <Stack spacing={2.5} sx={{ mt: 2 }}>
            {seccion.preguntas
              .filter((p) => visibilidad === null || visibilidad.preguntas.has(p.codigo))
              .map((pregunta) => (
                <Pregunta
                  key={pregunta.codigo}
                  pregunta={pregunta}
                  borrador={respuestas[pregunta.codigo]}
                  onCambiar={(cambio) => cambiar(pregunta.codigo, cambio)}
                  textos={textos}
                  adjuntos={adjuntos}
                  onSubirAdjunto={onSubirAdjunto}
                  subiendoAdjunto={subiendoAdjunto}
                  soloLectura={soloLectura}
                  error={errores[pregunta.codigo]}
                />
              ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

interface PreguntaProps {
  pregunta: PreguntaDeFormulario;
  borrador: BorradorDeRespuesta | undefined;
  onCambiar: (cambio: Partial<BorradorDeRespuesta>) => void;
  textos: TextosDelFormulario;
  adjuntos: readonly AdjuntoSubido[];
  onSubirAdjunto: FormularioDeCuestionarioProps['onSubirAdjunto'];
  subiendoAdjunto: boolean | undefined;
  soloLectura: boolean;
  error: string | undefined;
}

function Pregunta({ pregunta, borrador, onCambiar, textos, adjuntos, onSubirAdjunto, subiendoAdjunto, soloLectura, error }: PreguntaProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const elegidas = borrador?.opciones ?? [];
  const escala = pregunta.tipo === 'Escala' ? pregunta.escala : null;
  const idTitulo = `pregunta-${pregunta.codigo}`;

  const alternar = (codigo: string) => onCambiar({ opciones: elegidas.includes(codigo) ? elegidas.filter((o) => o !== codigo) : [...elegidas, codigo] });

  return (
    <Box role="group" aria-labelledby={idTitulo}>
      <Typography id={idTitulo} variant="subtitle2" component="p">
        {pregunta.texto}
        {pregunta.obligatoria && (
          <Box component="span" aria-label={textos.obligatoria} sx={{ color: 'error.main', ml: 0.5 }}>
            *
          </Box>
        )}
      </Typography>
      {pregunta.ayuda && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
          {pregunta.ayuda}
        </Typography>
      )}
      <Box sx={{ mt: 0.75 }}>
        {(pregunta.tipo === 'SiNo' || pregunta.tipo === 'OpcionUnica') && (
          <RadioGroup row={pregunta.tipo === 'SiNo'} value={elegidas[0] ?? ''} onChange={(e) => onCambiar({ opciones: [e.target.value] })} aria-labelledby={idTitulo}>
            {(pregunta.opciones ?? []).map((o) => (
              <FormControlLabel key={o.codigo} value={o.codigo} control={<Radio size="small" />} label={o.texto} disabled={soloLectura} />
            ))}
          </RadioGroup>
        )}
        {pregunta.tipo === 'OpcionMultiple' && (
          <FormGroup aria-labelledby={idTitulo}>
            {(pregunta.opciones ?? []).map((o) => (
              <FormControlLabel key={o.codigo} label={o.texto} disabled={soloLectura} control={<Checkbox size="small" checked={elegidas.includes(o.codigo)} onChange={() => alternar(o.codigo)} />} />
            ))}
          </FormGroup>
        )}
        {escala && (
          <ToggleButtonGroup
            exclusive
            size="small"
            aria-labelledby={idTitulo}
            value={leerNumero(borrador?.numero)}
            onChange={(_, valor: number | null) => onCambiar({ numero: valor === null ? '' : String(valor) })}
            disabled={soloLectura}
          >
            {Array.from({ length: escala.maximo - escala.minimo + 1 }, (_, i) => escala.minimo + i).map((n) => (
              <ToggleButton key={n} value={n} sx={{ minWidth: 40 }}>
                {n}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        {pregunta.tipo === 'Numero' && (
          <TextField
            size="small"
            label={textos.numero}
            value={borrador?.numero ?? ''}
            onChange={(e) => ES_NUMERO.test(e.target.value) && onCambiar({ numero: e.target.value })}
            disabled={soloLectura}
            slotProps={{ htmlInput: { inputMode: 'decimal', autoComplete: 'off', 'aria-labelledby': idTitulo } }}
            sx={{ width: 200 }}
          />
        )}
        {pregunta.tipo === 'Texto' && (
          <TextField
            multiline
            minRows={2}
            fullWidth
            size="small"
            value={borrador?.texto ?? ''}
            onChange={(e) => onCambiar({ texto: e.target.value })}
            disabled={soloLectura}
            slotProps={{ htmlInput: { maxLength: 4000, 'aria-labelledby': idTitulo } }}
          />
        )}
        {pregunta.tipo === 'Adjunto' && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
            {(borrador?.adjuntos ?? []).map((id) => {
              const nombre = adjuntos.find((a) => a.id === id)?.nombre ?? id;
              return (
                <Stack key={id} direction="row" sx={{ alignItems: 'center' }}>
                  <Chip size="small" icon={<Paperclip size={14} aria-hidden />} label={nombre} />
                  {!soloLectura && (
                    <IconButton size="small" aria-label={textos.quitarArchivo(nombre)} onClick={() => onCambiar({ adjuntos: (borrador?.adjuntos ?? []).filter((x) => x !== id) })}>
                      <X size={14} aria-hidden />
                    </IconButton>
                  )}
                </Stack>
              );
            })}
            {!soloLectura && onSubirAdjunto && (
              <>
                <Button size="small" variant="outlined" startIcon={<Paperclip size={14} aria-hidden />} onClick={() => entrada.current?.click()} disabled={subiendoAdjunto}>
                  {subiendoAdjunto ? textos.subiendo : textos.subirArchivo}
                </Button>
                <input
                  ref={entrada}
                  type="file"
                  hidden
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  data-testid={`archivo-${pregunta.codigo}`}
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    e.target.value = '';
                    if (archivo) onSubirAdjunto(pregunta.codigo, archivo);
                  }}
                />
              </>
            )}
          </Stack>
        )}
      </Box>
      {pregunta.permiteComentario && (
        <TextField
          size="small"
          fullWidth
          label={textos.comentario}
          value={borrador?.comentario ?? ''}
          onChange={(e) => onCambiar({ comentario: e.target.value })}
          disabled={soloLectura}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          sx={{ mt: 1 }}
        />
      )}
      {error && (
        <Typography role="alert" variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
