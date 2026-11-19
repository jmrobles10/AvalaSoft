import { Alert, Button, Stack } from '@mui/material';
import { esErrorApi, type AdjuntoDeEvaluacionDto, type EvaluacionDto } from '@validalo/api-client';
import {
  aSeccionesDeFormulario,
  borradorDesdeRespuestas,
  FaltaParaEnviar,
  FormularioDeCuestionario,
  preguntasQueFaltan,
  respuestasParaEnviar,
  type BorradorDeRespuestas,
  type TextosDelFormulario,
  type VisibilidadDeFormulario,
} from '@validalo/ui';
import { Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { subirEvidencia, useResponderEvaluacion, useVisibilidad } from './api';

/**
 * Responder una evaluación como evaluador interno (CE-4): el formulario del cuestionario con sus condiciones (la API dice qué preguntas se muestran con lo respondido), la
 * evidencia que se sube a la evaluación y el envío, que la califica. El expediente que la esperaba se entera en la misma transacción.
 */
export function ResponderEvaluacion({ evaluacion, empresaId }: { evaluacion: EvaluacionDto; empresaId: string }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const responder = useResponderEvaluacion(empresaId, evaluacion.id);
  const visibilidadApi = useVisibilidad(empresaId, evaluacion.id);
  const [respuestas, setRespuestas] = useState<BorradorDeRespuestas>(() => borradorDesdeRespuestas(evaluacion.respuestas));
  const [visibilidad, setVisibilidad] = useState<VisibilidadDeFormulario | null>(null);
  const [adjuntos, setAdjuntos] = useState<AdjuntoDeEvaluacionDto[]>(evaluacion.adjuntos);
  const [subiendo, setSubiendo] = useState(false);
  const [errorDeSubida, setErrorDeSubida] = useState<string | null>(null);
  const secciones = useMemo(() => aSeccionesDeFormulario(evaluacion.definicion.secciones), [evaluacion]);
  const pedir = visibilidadApi.mutate;
  const ultimas = useRef(respuestas);
  ultimas.current = respuestas;

  // La visibilidad se pide al abrir (hay condiciones sobre el tercero) y, con una pausa corta, cada vez que cambia lo respondido.
  useEffect(() => {
    const espera = setTimeout(
      () =>
        pedir(
          { respuestas: respuestasParaEnviar(ultimas.current, null) },
          { onSuccess: (v) => setVisibilidad({ preguntas: new Set(v.preguntas), secciones: new Set(v.secciones) }) },
        ),
      250,
    );
    return () => clearTimeout(espera);
  }, [respuestas, pedir]);

  const textos: TextosDelFormulario = {
    comentario: t('evaluaciones.responder.comentario'),
    subirArchivo: t('evaluaciones.responder.subirArchivo'),
    quitarArchivo: (nombre) => t('evaluaciones.responder.quitarArchivo', { nombre }),
    subiendo: t('evaluaciones.responder.subiendo'),
    numero: t('evaluaciones.responder.numero'),
    obligatoria: t('evaluaciones.responder.obligatoria'),
  };

  const subir = (pregunta: string, archivo: File) => {
    setSubiendo(true);
    setErrorDeSubida(null);
    subirEvidencia(empresaId, evaluacion.id, archivo)
      .then((adjunto) => {
        setAdjuntos((actuales) => [...actuales, adjunto]);
        setRespuestas((actuales) => ({ ...actuales, [pregunta]: { ...actuales[pregunta], adjuntos: [...(actuales[pregunta]?.adjuntos ?? []), adjunto.id] } }));
      })
      .catch((error: unknown) => setErrorDeSubida(mensajeDeError(error, t)))
      .finally(() => setSubiendo(false));
  };

  const faltan = preguntasQueFaltan(secciones, respuestas, visibilidad);
  const preguntaConError = esErrorApi(responder.error) && typeof responder.error.extensiones.pregunta === 'string' ? responder.error.extensiones.pregunta : null;
  const errores: Record<string, string> = {
    ...(preguntaConError && responder.error ? { [preguntaConError]: mensajeDeError(responder.error, t) } : {}),
  };
  const enviar = () =>
    responder.mutate(
      { respuestas: respuestasParaEnviar(respuestas, visibilidad) },
      { onSuccess: (e) => mostrar(t(e.resultado?.aprobada ? 'evaluaciones.responder.enviadaAprobada' : 'evaluaciones.responder.enviadaReprobada')) },
    );

  return (
    <Stack spacing={2}>
      {evaluacion.definicion.descripcion && <Alert severity="info">{evaluacion.definicion.descripcion}</Alert>}
      {responder.isError && !preguntaConError && <Alert severity="error">{mensajeDeError(responder.error, t)}</Alert>}
      {errorDeSubida && <Alert severity="error">{errorDeSubida}</Alert>}
      <FormularioDeCuestionario
        secciones={secciones}
        respuestas={respuestas}
        onCambiar={setRespuestas}
        visibilidad={visibilidad}
        textos={textos}
        adjuntos={adjuntos}
        onSubirAdjunto={subir}
        subiendoAdjunto={subiendo}
        errores={errores}
      />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
        {faltan.length > 0 && <FaltaParaEnviar>{t('evaluaciones.responder.faltan', { count: faltan.length })}</FaltaParaEnviar>}
        <Button variant="contained" startIcon={responder.isPending ? <IconoCarga /> : <Send size={16} aria-hidden />} disabled={faltan.length > 0 || responder.isPending || visibilidad === null} onClick={enviar}>
          {t('evaluaciones.responder.enviar')}
        </Button>
      </Stack>
    </Stack>
  );
}
