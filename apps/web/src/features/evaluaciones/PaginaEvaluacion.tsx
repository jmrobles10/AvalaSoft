import { Alert, Box, Button, Chip, Link, Skeleton, Stack, Typography } from '@mui/material';
import { esErrorApi, SCOPES, type EvaluacionDto } from '@avalasoft/api-client';
import { EsqueletoTarjeta, PaginaEstado, formatearFecha } from '@avalasoft/ui';
import { Ban, RotateCcw, SearchX, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router';
import { EncabezadoPagina, EnlaceVolver, ErrorRecuperable, SinPermiso, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { usePermisos } from '../../shared/usePermisos';
import { useNombresUsuarios } from '../configuracion/usuarios/api';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { urlDeEvidencia, useEvaluacion } from './api';
import { DialogoJustificar, DialogoRecalificar } from './DialogosDeEvaluacion';
import { colorDeEstado } from './modelo';
import { ResponderEvaluacion } from './ResponderEvaluacion';
import { ResultadoDeEvaluacion } from './ResultadoDeEvaluacion';

type Dialogo = 'recalificar' | 'reabrir' | 'anular' | null;

/** Datos de la evaluación y de a qué corresponde (tercero, expediente, cuestionario, quién responde y qué pasa si reprueba). */
function Ficha({ evaluacion, empresaId }: { evaluacion: EvaluacionDto; empresaId: string }) {
  const { t } = useTranslation();
  return (
    <Tarjeta titulo={t('evaluaciones.detalle.datos')}>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2, minmax(0,1fr))' } }}>
        {[
          [t('evaluaciones.detalle.tercero'), <Link key="t" component={RouterLink} to={`/e/${empresaId}/vinculos/${evaluacion.vinculoId}`}>{evaluacion.tercero.nombre}</Link>],
          [
            t('evaluaciones.detalle.expediente'),
            evaluacion.expedienteId ? (
              <Link key="e" component={RouterLink} to={`/e/${empresaId}/expedientes/${evaluacion.expedienteId}`}>
                {evaluacion.folio}
              </Link>
            ) : (
              t('evaluaciones.detalle.sinExpediente')
            ),
          ],
          [t('evaluaciones.detalle.cuestionario'), `${evaluacion.cuestionario.nombre} · ${t('evaluaciones.cuestionarios.version', { version: String(evaluacion.cuestionario.version) })}`],
          [t('evaluaciones.detalle.motivo'), t(`evaluaciones.motivo.${evaluacion.motivo}`)],
          [t('evaluaciones.detalle.responde'), t(`evaluaciones.responde.${evaluacion.responde}`)],
          [t('evaluaciones.detalle.efecto'), t(`evaluaciones.efecto.${evaluacion.efecto}`)],
          [t('evaluaciones.detalle.asignada'), formatearFecha(evaluacion.asignadaEn)],
          ...(evaluacion.respondidaEn ? [[t('evaluaciones.detalle.respondida'), formatearFecha(evaluacion.respondidaEn)]] : []),
        ].map(([rotulo, valor], i) => (
          <Box key={i}>
            <Typography component="dt" variant="caption" sx={{ color: 'text.secondary' }}>
              {rotulo}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {valor}
            </Typography>
          </Box>
        ))}
      </Box>
    </Tarjeta>
  );
}

/**
 * Una evaluación (CE-3…CE-10): si está pendiente y la responde una persona de la empresa, el formulario; si ya se calificó, su resultado, las respuestas y el historial, con las
 * acciones de recalificar, reabrir y anular (cada una con justificación). Es privada de la empresa: el tercero no ve nada de esto.
 */
export function PaginaEvaluacion() {
  const { t } = useTranslation();
  const { evaluacionId = '' } = useParams();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const mostrar = useAvisos((s) => s.mostrar);
  const consulta = useEvaluacion(empresa.id, evaluacionId);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const evaluacion = consulta.data;
  const nombres = useNombresUsuarios(empresa.id, evaluacion?.calificaciones.map((c) => c.por.id) ?? []);

  if (!permisos.puede(SCOPES.evaluacionesLeer)) return <SinPermiso seccion={t('nav.evaluaciones')} />;
  const volver = <EnlaceVolver a={`/e/${empresa.id}/evaluaciones`}>{t('nav.evaluaciones')}</EnlaceVolver>;

  if (consulta.isPending) {
    return (
      <Box aria-busy>
        {volver}
        <Skeleton variant="rounded" width={320} height={28} sx={{ mb: 3 }} />
        <EsqueletoTarjeta alto={320} />
      </Box>
    );
  }
  if (consulta.isError || !evaluacion) {
    if (esErrorApi(consulta.error) && consulta.error.esNoEncontrado)
      return <PaginaEstado icono={SearchX} titulo={t('evaluaciones.detalle.noEncontrada')} texto={t('evaluaciones.detalle.noEncontradaAyuda')} acciones={volver} />;
    return (
      <>
        {volver}
        <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />
      </>
    );
  }

  const puedeRecalificar = permisos.puede(SCOPES.evaluacionesRecalificar);
  const puedeResponder = permisos.puede(SCOPES.evaluacionesResponder) && evaluacion.responde === 'Evaluador';
  const calificada = evaluacion.estado === 'Calificada';
  const abrirArchivo = (adjuntoId: string) => {
    urlDeEvidencia(empresa.id, evaluacion.id, adjuntoId)
      .then((descarga) => window.open(descarga.url, '_blank', 'noopener'))
      .catch((error: unknown) => mostrar(mensajeDeError(error, t), 'error'));
  };

  return (
    <>
      <EncabezadoPagina
        antes={volver}
        titulo={evaluacion.cuestionario.nombre}
        tituloCompleto={evaluacion.cuestionario.nombre}
        subtitulo={evaluacion.tercero.nombre}
        acciones={
          puedeRecalificar ? (
            <>
              {calificada && (
                <Button variant="outlined" startIcon={<SlidersHorizontal size={16} aria-hidden />} onClick={() => setDialogo('recalificar')}>
                  {t('evaluaciones.detalle.recalificar')}
                </Button>
              )}
              {calificada && (
                <Button variant="outlined" startIcon={<RotateCcw size={16} aria-hidden />} onClick={() => setDialogo('reabrir')}>
                  {t('evaluaciones.detalle.reabrir')}
                </Button>
              )}
              {(calificada || evaluacion.estado === 'Pendiente') && (
                <Button variant="text" color="error" startIcon={<Ban size={16} aria-hidden />} onClick={() => setDialogo('anular')}>
                  {t('evaluaciones.detalle.anular')}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip color={colorDeEstado(evaluacion.estado, evaluacion.resultado?.aprobada)} label={t(`evaluaciones.estados.${evaluacion.estado}`)} />
        <Chip variant="outlined" label={t(`evaluaciones.responde.${evaluacion.responde}`)} />
        {evaluacion.expedienteId && <Chip variant="outlined" label={t(`evaluaciones.efecto.${evaluacion.efecto}`)} />}
      </Stack>

      <Stack spacing={2}>
        {evaluacion.estado === 'Pendiente' &&
          (puedeResponder ? (
            <ResponderEvaluacion evaluacion={evaluacion} empresaId={empresa.id} />
          ) : (
            <Alert severity="info">{t(evaluacion.responde === 'Tercero' ? 'evaluaciones.detalle.laResponde' : 'evaluaciones.detalle.sinPermisoResponder')}</Alert>
          ))}
        {evaluacion.estado === 'Vencida' && <Alert severity="warning">{t('evaluaciones.detalle.vencidaAyuda')}</Alert>}
        {evaluacion.estado === 'Anulada' && <Alert severity="warning">{t('evaluaciones.detalle.anuladaAyuda', { motivo: evaluacion.justificacion ?? '—' })}</Alert>}
        {evaluacion.resultado && <ResultadoDeEvaluacion evaluacion={evaluacion} onAbrirArchivo={abrirArchivo} nombreDe={(id) => nombres.get(id)} />}
        <Ficha evaluacion={evaluacion} empresaId={empresa.id} />
      </Stack>

      {(dialogo === 'reabrir' || dialogo === 'anular') && <DialogoJustificar evaluacion={evaluacion} empresaId={empresa.id} accion={dialogo} onCerrar={() => setDialogo(null)} />}
      {dialogo === 'recalificar' && <DialogoRecalificar evaluacion={evaluacion} empresaId={empresa.id} onCerrar={() => setDialogo(null)} />}
    </>
  );
}
