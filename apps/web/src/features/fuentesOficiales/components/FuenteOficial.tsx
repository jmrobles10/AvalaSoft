import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { CampoCotejadoDto, DecisionCoincidencia, ExpedienteDto, VerificacionDto } from '@validasoft/api-client';
import { Dato, formatearFecha, formatearFechaHora, RejillaDatos } from '@validasoft/ui';
import { FileDown, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { useAvisos } from '../../../shared/useAvisos';
import { EncabezadoVerificacion } from '../../cumplimiento/components/EncabezadoVerificacion';
import { esSistema, type AccionesDeVerificacion } from '../../cumplimiento/modelo';
import { useAccionDeFuente, useDescargarConstancia } from '../api';
import type { FuenteDeVerificacion } from '../modelo';
import { DialogoResolverDiferencia } from './DialogoResolverDiferencia';
import { ResultadoDeFuente } from './ResultadoDeFuente';

export interface FuenteOficialProps {
  expediente: ExpedienteDto;
  empresaId: string;
  fuente: FuenteDeVerificacion;
  verificacion: VerificacionDto;
  acciones: AccionesDeVerificacion;
  nombres: ReadonlyMap<string, string>;
}

/**
 * Una fuente oficial del expediente (RUES o DIAN, FO-1…FO-6): estado, lo que dijo la fuente, su cotejo con la ficha y los documentos, la constancia
 * guardada (con el hash de la respuesta), la reconsulta y las decisiones sobre las diferencias. Un fallo del proveedor la deja pendiente con su
 * reintento: nunca se da por satisfecha.
 */
export function FuenteOficial({ expediente, empresaId, fuente, verificacion: v, acciones, nombres }: FuenteOficialProps) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const accion = useAccionDeFuente(empresaId, expediente.id);
  const descarga = useDescargarConstancia(empresaId);
  const [resolver, setResolver] = useState<{ campo: CampoCotejadoDto; decision: DecisionCoincidencia } | null>(null);
  const consultada = Boolean(v.registradaEn);
  const quien = (id: string | null | undefined) => (!id || esSistema(id) ? t('cumplimiento.panel.sistema') : (nombres.get(id) ?? id.slice(0, 8)));
  const nombre = t(`cumplimiento.tipos.${fuente}`);

  const reconsultar = () =>
    accion.mutate({ tipo: 'consultar', fuente }, { onSuccess: () => mostrar(t('fuentesOficiales.panel.consultada')), onError: (e) => mostrar(mensajeDeError(e, t), 'error') });
  const descargar = (referencia?: string) =>
    descarga.mutate({ expedienteId: expediente.id, fuente, referencia }, { onError: (e) => mostrar(mensajeDeError(e, t), 'error') });

  return (
    <Box component="section" aria-label={nombre}>
      <EncabezadoVerificacion
        verificacion={v}
        acciones={
          <>
            {acciones.descargar && v.evidencia && (
              <Button size="small" variant="text" startIcon={descarga.isPending ? <IconoCarga /> : <FileDown size={16} aria-hidden />} onClick={() => descargar()} disabled={descarga.isPending}>
                {t('fuentesOficiales.panel.evidencia')}
              </Button>
            )}
            {acciones.consultar && (
              <Button size="small" variant="outlined" startIcon={accion.isPending ? <IconoCarga /> : <RefreshCw size={16} aria-hidden />} onClick={reconsultar} disabled={accion.isPending}>
                {consultada ? t('fuentesOficiales.panel.reconsultar') : t('fuentesOficiales.panel.consultar')}
              </Button>
            )}
          </>
        }
      />
      {v.ultimoError && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {t('cumplimiento.panel.ultimoError', { error: v.ultimoError, cuando: v.reintentarDesde ? formatearFechaHora(v.reintentarDesde) : '' })}
        </Alert>
      )}
      {!consultada && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{t('fuentesOficiales.panel.pendiente')}</Typography>}
      {v.estado === 'Expirada' && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{t('fuentesOficiales.panel.expirada')}</Typography>}
      {v.registradaEn && v.fuenteOficial && (
        <Stack spacing={1.5}>
          <RejillaDatos columnas={3}>
            <Dato etiqueta={t('fuentesOficiales.panel.proveedor')}>{t(`fuentesOficiales.proveedores.${(v.proveedor ?? 'Simulado') as 'Simulado'}`, { defaultValue: v.proveedor ?? '—' })}</Dato>
            <Dato etiqueta={t('fuentesOficiales.panel.registrada')}>{`${formatearFechaHora(v.registradaEn)} · ${quien(v.registradaPor)}`}</Dato>
            <Dato etiqueta={t('fuentesOficiales.panel.vigenteHasta')}>{v.vigenteHasta ? formatearFecha(v.vigenteHasta) : '—'}</Dato>
          </RejillaDatos>
          <ResultadoDeFuente resultado={v.fuenteOficial} puedeDecidir={acciones.decidir} quien={quien} onResolver={(campo, decision) => setResolver({ campo, decision })} />
          {v.anteriores.length > 0 && (
            <Box component="details" sx={{ '& > summary': { cursor: 'pointer', color: 'text.secondary', fontSize: 12 } }}>
              <summary>{t('fuentesOficiales.panel.anteriores', { count: v.anteriores.length })}</summary>
              <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
                {v.anteriores.map((a) => (
                  <Stack key={`${a.referenciaExterna}-${a.fecha}`} component="li" direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography component="span" sx={{ fontSize: 13 }}>
                      {formatearFecha(a.fecha)}
                    </Typography>
                    <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {t('fuentesOficiales.panel.anteriorDiferencias', { count: a.coincidencias })}
                    </Typography>
                    {acciones.descargar && a.conEvidencia && (
                      <Button size="small" variant="text" startIcon={<FileDown size={16} aria-hidden />} disabled={descarga.isPending} onClick={() => descargar(a.referenciaExterna)}>
                        {t('fuentesOficiales.panel.evidencia')}
                      </Button>
                    )}
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
      {resolver && (
        <DialogoResolverDiferencia
          campo={resolver.campo}
          decision={resolver.decision}
          ocupado={accion.isPending}
          error={accion.error}
          onCerrar={() => {
            accion.reset();
            setResolver(null);
          }}
          onGuardar={(justificacion) =>
            accion.mutate(
              { tipo: 'resolver', fuente, campoId: resolver.campo.id, decision: resolver.decision, justificacion },
              {
                onSuccess: () => {
                  mostrar(t('fuentesOficiales.resolver.guardada'));
                  setResolver(null);
                },
              },
            )
          }
        />
      )}
    </Box>
  );
}
