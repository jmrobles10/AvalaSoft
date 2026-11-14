import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { EvaluacionDto } from '@validasoft/api-client';
import { MarcoTabla, formatearFecha } from '@validasoft/ui';
import { Ban, Check, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { formatearPuntaje, numero, textoDeMotivo, textoDeOrigen, textoDeRespuesta } from './modelo';

export interface ResultadoDeEvaluacionProps {
  evaluacion: EvaluacionDto;
  /** Abrir un archivo de evidencia (URL prefirmada); sin esto la evidencia se muestra solo con su nombre. */
  onAbrirArchivo?: (adjuntoId: string) => void;
  /** Nombre de la persona (por id) para el historial; si no se conoce, se muestra lo que trae la evaluación. */
  nombreDe?: (id: string) => string | undefined;
}

/**
 * Resultado de una evaluación (CE-9): el puntaje total contra el umbral, el veredicto y por qué (bajo el umbral o una eliminatoria), el puntaje de cada sección y de cada
 * pregunta con lo que se respondió, y el historial de calificaciones (la primera y cada recalificación con su justificación). Solo lo ve la empresa.
 */
export function ResultadoDeEvaluacion({ evaluacion, onAbrirArchivo, nombreDe }: ResultadoDeEvaluacionProps) {
  const { t } = useTranslation();
  const resultado = evaluacion.resultado;
  if (!resultado) return null;
  const preguntas = evaluacion.definicion.secciones.flatMap((s) => s.preguntas.map((p) => ({ seccion: s.nombre, pregunta: p })));
  const calificadas = new Map(resultado.preguntas.map((p) => [p.codigo, p]));
  const actor = (a: { id: string; nombre?: string | null }) => a.nombre ?? nombreDe?.(a.id) ?? t('evaluaciones.detalle.alguien');

  return (
    <Stack spacing={2}>
      <Tarjeta titulo={t('evaluaciones.detalle.resultado')}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="p" variant="h4" sx={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>
              {formatearPuntaje(resultado.puntaje)}
              <Typography component="span" sx={{ color: 'text.secondary', fontSize: 14, ml: 0.75 }}>
                / 100
              </Typography>
            </Typography>
            <Chip
              color={resultado.aprobada ? 'success' : 'error'}
              icon={resultado.aprobada ? <Check size={14} aria-hidden /> : <Ban size={14} aria-hidden />}
              label={t(resultado.aprobada ? 'evaluaciones.veredicto.aprobada' : 'evaluaciones.veredicto.reprobada')}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('evaluaciones.detalle.umbral', { umbral: formatearPuntaje(resultado.umbral) })}
            </Typography>
          </Stack>
          {resultado.motivos.length > 0 && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {resultado.motivos.map((m) => (
                <Chip key={m} size="small" variant="outlined" color="warning" label={textoDeMotivo(m, t)} />
              ))}
            </Stack>
          )}
          {!resultado.calculada && <Alert severity="warning">{t('evaluaciones.detalle.veredictoManual')}</Alert>}
          {evaluacion.vigenteHasta && evaluacion.estado === 'Calificada' && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('evaluaciones.detalle.vigenteHasta', { fecha: formatearFecha(evaluacion.vigenteHasta) })}
            </Typography>
          )}
        </Stack>
      </Tarjeta>

      <Tarjeta titulo={t('evaluaciones.detalle.porSeccion')}>
        <MarcoTabla>
          <Table size="small" aria-label={t('evaluaciones.detalle.porSeccion')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('evaluaciones.detalle.columnas.seccion')}</TableCell>
                <TableCell sx={{ width: 90 }} align="right">
                  {t('evaluaciones.detalle.columnas.peso')}
                </TableCell>
                <TableCell sx={{ width: 110 }} align="right">
                  {t('evaluaciones.detalle.columnas.puntaje')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resultado.secciones.map((s) => (
                <TableRow key={s.codigo}>
                  <TableCell>{s.nombre}</TableCell>
                  <TableCell align="right">{numero(s.peso)}</TableCell>
                  <TableCell align="right">{s.aplica ? formatearPuntaje(s.puntaje) : t('evaluaciones.detalle.noAplica')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MarcoTabla>
      </Tarjeta>

      <Tarjeta titulo={t('evaluaciones.detalle.porPregunta')}>
        <MarcoTabla>
          <Table size="small" aria-label={t('evaluaciones.detalle.porPregunta')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('evaluaciones.detalle.columnas.pregunta')}</TableCell>
                <TableCell>{t('evaluaciones.detalle.columnas.respuesta')}</TableCell>
                <TableCell sx={{ width: 100 }} align="right">
                  {t('evaluaciones.detalle.columnas.puntaje')}
                </TableCell>
                <TableCell sx={{ width: 150 }}>{t('evaluaciones.detalle.columnas.nota')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preguntas.map(({ seccion, pregunta }) => {
                const calificada = calificadas.get(pregunta.codigo ?? '');
                if (!calificada?.visible) return null;
                const respuesta = evaluacion.respuestas.find((r) => r.pregunta === pregunta.codigo);
                const archivos = respuesta?.adjuntos ?? [];
                return (
                  <TableRow key={pregunta.codigo} sx={calificada.elimina ? { bgcolor: 'action.hover' } : undefined}>
                    <TableCell>
                      <Typography variant="body2">{pregunta.texto}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {pregunta.codigo} · {seccion}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      {textoDeRespuesta(pregunta, respuesta, evaluacion.adjuntos) || <span aria-label={t('evaluaciones.detalle.sinRespuesta')}>—</span>}
                      {respuesta?.comentario && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {t('evaluaciones.detalle.comentario', { texto: respuesta.comentario })}
                        </Typography>
                      )}
                      {onAbrirArchivo && archivos.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          {archivos.map((id) => (
                            <Chip
                              key={id}
                              size="small"
                              clickable
                              icon={<Paperclip size={12} aria-hidden />}
                              label={evaluacion.adjuntos.find((a) => a.id === id)?.nombre ?? id}
                              onClick={() => onAbrirArchivo(id)}
                              sx={{ mr: 0.5 }}
                            />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">{calificada.puntaje === null ? '—' : formatearPuntaje(calificada.puntaje)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {calificada.elimina && <Chip size="small" color="error" label={t('evaluaciones.detalle.elimina')} />}
                        {calificada.ajustada && <Chip size="small" variant="outlined" label={t('evaluaciones.detalle.ajustada')} />}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </MarcoTabla>
      </Tarjeta>

      <Tarjeta titulo={t('evaluaciones.detalle.historial')}>
        <Stack component="ol" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {evaluacion.calificaciones.map((c) => (
            <Box component="li" key={c.numero} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip size="small" variant="outlined" label={textoDeOrigen(c.origen, t)} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatearPuntaje(c.resultado.puntaje)} · {t(c.resultado.aprobada ? 'evaluaciones.veredicto.aprobada' : 'evaluaciones.veredicto.reprobada')}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('evaluaciones.detalle.por', { persona: actor(c.por), fecha: formatearFecha(c.fecha) })}
                </Typography>
              </Stack>
              {c.justificacion && (
                <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                  {c.justificacion}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Tarjeta>
    </Stack>
  );
}
