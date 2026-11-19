import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { esErrorApi, SCOPES, type CampoCotejadoDto, type DecisionCoincidencia } from '@validalo/api-client';
import { ChipEstado, Dato, formatearFecha, formatearFechaHora, RejillaDatos } from '@validalo/ui';
import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorRecuperable, IconoCarga, Tarjeta } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { useAvisos } from '../../../shared/useAvisos';
import { usePermisos } from '../../../shared/usePermisos';
import { useNombresUsuarios } from '../../configuracion/usuarios/api';
import { esSistema } from '../../cumplimiento/modelo';
import { useDescargarConstanciaDeMonitoreo, useMonitoreoFuentes, useResolverDiferenciaDeMonitoreo } from '../api';
import { esFuenteOficial, type FuenteDeVerificacion } from '../modelo';
import { DialogoResolverDiferencia } from './DialogoResolverDiferencia';
import { ResultadoDeFuente } from './ResultadoDeFuente';

/**
 * Reconsulta periódica de las fuentes oficiales de un vínculo activo (FO-7, opcional por empresa): la última consulta de cada fuente, la próxima y las
 * diferencias nuevas que Cumplimiento acepta o confirma. Un vínculo sin monitoreo (la empresa no lo encendió o no consultó fuentes) no muestra nada.
 * Confirmar un hallazgo no bloquea ni desvincula: eso lo decide un administrador con las acciones del vínculo.
 */
export function TarjetaMonitoreoFuentes({ vinculoId, empresaId }: { vinculoId: string; empresaId: string }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const permisos = usePermisos(empresaId);
  const consulta = useMonitoreoFuentes(empresaId, vinculoId, permisos.puede(SCOPES.expedientesLeer));
  const resolver = useResolverDiferenciaDeMonitoreo(empresaId, vinculoId);
  const descarga = useDescargarConstanciaDeMonitoreo(empresaId);
  const [decidiendo, setDecidiendo] = useState<{ fuente: FuenteDeVerificacion; campo: CampoCotejadoDto; decision: DecisionCoincidencia } | null>(null);
  const monitoreo = consulta.data;
  const personas = useMemo(
    () => (monitoreo?.fuentes ?? []).flatMap((f) => [f.registradaPor, ...(f.fuenteOficial?.campos.map((c) => c.resueltaPor) ?? [])]).filter((id): id is string => !esSistema(id)),
    [monitoreo],
  );
  const nombres = useNombresUsuarios(empresaId, personas);

  if (consulta.isError) {
    // Un vínculo que nunca consultó fuentes (o con la reconsulta apagada) no tiene monitoreo: no hay nada que mostrar.
    if (esErrorApi(consulta.error) && consulta.error.esNoEncontrado) return null;
    return <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />;
  }
  if (!monitoreo) return null;

  const quien = (id: string | null | undefined) => (esSistema(id) ? t('cumplimiento.panel.sistema') : (nombres.get(id ?? '') ?? (id ?? '').slice(0, 8)));
  const puedeDecidir = permisos.puede(SCOPES.cumplimientoDecidir);
  const puedeDescargar = permisos.puede(SCOPES.documentosDescargar);
  const hayConfirmada = monitoreo.fuentes.some((f) => f.fuenteOficial?.campos.some((c) => c.decision === 'Confirmada'));

  return (
    <Tarjeta titulo={t('fuentesOficiales.monitoreo.titulo')} etiqueta={t('fuentesOficiales.monitoreo.titulo')}>
      <Stack spacing={2}>
        <Typography sx={{ color: 'text.secondary' }}>{t('fuentesOficiales.monitoreo.ayuda', { dias: String(monitoreo.frecuenciaDias) })}</Typography>
        <Typography>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {t('fuentesOficiales.monitoreo.proxima')}:{' '}
          </Box>
          {monitoreo.proximaConsulta ? formatearFecha(monitoreo.proximaConsulta) : t('fuentesOficiales.monitoreo.detenido')}
        </Typography>
        {monitoreo.fuentes.map((f) => {
          if (!esFuenteOficial(f.tipo)) return null;
          const fuente = f.tipo;
          return (
            <Box key={f.tipo} component="section" aria-label={t(`cumplimiento.tipos.${fuente}`)}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                <Typography variant="subtitle1" component="h3">
                  {t(`cumplimiento.tipos.${fuente}`)}
                </Typography>
                <ChipEstado estado={f.estado} etiqueta={t(`fuentesOficiales.estados.${f.estado}`)} />
                <Box sx={{ flex: 1 }} />
                {puedeDescargar && f.evidencia && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={descarga.isPending ? <IconoCarga /> : <FileDown size={16} aria-hidden />}
                    disabled={descarga.isPending}
                    onClick={() => descarga.mutate({ vinculoId, fuente }, { onError: (e) => mostrar(mensajeDeError(e, t), 'error') })}
                  >
                    {t('fuentesOficiales.panel.evidencia')}
                  </Button>
                )}
              </Stack>
              <RejillaDatos columnas={3}>
                <Dato etiqueta={t('fuentesOficiales.monitoreo.ultima')}>{f.registradaEn ? `${formatearFechaHora(f.registradaEn)} · ${quien(f.registradaPor)}` : '—'}</Dato>
              </RejillaDatos>
              {f.ultimoError && (
                <Alert severity="warning" sx={{ my: 1 }}>
                  {t('cumplimiento.panel.ultimoError', { error: f.ultimoError, cuando: f.reintentarDesde ? formatearFechaHora(f.reintentarDesde) : '' })}
                </Alert>
              )}
              {f.fuenteOficial && (
                <Box sx={{ mt: 1 }}>
                  <ResultadoDeFuente resultado={f.fuenteOficial} puedeDecidir={puedeDecidir} quien={quien} onResolver={(campo, decision) => setDecidiendo({ fuente, campo, decision })} />
                </Box>
              )}
            </Box>
          );
        })}
        {hayConfirmada && <Alert severity="warning">{t('fuentesOficiales.monitoreo.confirmada')}</Alert>}
      </Stack>
      {decidiendo && (
        <DialogoResolverDiferencia
          campo={decidiendo.campo}
          decision={decidiendo.decision}
          ocupado={resolver.isPending}
          error={resolver.error}
          onCerrar={() => {
            resolver.reset();
            setDecidiendo(null);
          }}
          onGuardar={(justificacion) =>
            resolver.mutate(
              { fuente: decidiendo.fuente, campoId: decidiendo.campo.id, decision: decidiendo.decision, justificacion },
              {
                onSuccess: () => {
                  mostrar(t('fuentesOficiales.resolver.guardada'));
                  setDecidiendo(null);
                },
              },
            )
          }
        />
      )}
    </Tarjeta>
  );
}
