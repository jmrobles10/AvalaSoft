import { Alert, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getListarExpedientesQueryOptions, SCOPES, type ExpedienteDto, type VinculoDto } from '@validasoft/api-client';
import { EsqueletoTarjeta, EstadoVacio, formatearFecha } from '@validasoft/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../../shared/componentes';
import { conEmpresa } from '../../../shared/consultas';
import { usePermisos } from '../../../shared/usePermisos';
import { PanelVerificaciones } from '../../cumplimiento/components/PanelVerificaciones';
import { TarjetaMonitoreoListas } from '../../cumplimiento/components/TarjetaMonitoreoListas';
import { TarjetaMonitoreoFuentes } from '../../fuentesOficiales/components/TarjetaMonitoreoFuentes';
import type { ControlExpediente } from '../../expedientes/useControlExpediente';

const conVerificaciones = (e: ExpedienteDto | null | undefined): e is ExpedienteDto => (e?.verificaciones?.length ?? 0) > 0;

/** Expedientes del vínculo (del más reciente al más antiguo según la API): para hallar las últimas verificaciones de cumplimiento. */
function useExpedientesDelVinculo(empresaId: string, vinculoId: string, habilitado: boolean) {
  const opciones = getListarExpedientesQueryOptions({ vinculoId, limite: 20 }, { request: { empresa: empresaId } });
  return useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), enabled: habilitado });
}

/**
 * «Oficial de cumplimiento»: las verificaciones (listas restrictivas, estudio de cumplimiento) del expediente en curso o, si este no las
 * pide (una actualización), las del último expediente que las tuvo; el monitoreo de listas y fuentes oficiales; y lo que el expediente
 * pide de SAGRILAFT (`pedido`). Si no hay nada de eso, lo dice.
 */
export function CumplimientoDelVinculo({ vinculo, control, pedido }: { vinculo: VinculoDto; control: ControlExpediente | null; pedido: ReactNode }) {
  const { t } = useTranslation();
  const permisos = usePermisos(vinculo.empresaId);
  const actual = control?.expediente;
  const buscarAnterior = !conVerificaciones(actual) && permisos.puede(SCOPES.expedientesLeer);
  const lista = useExpedientesDelVinculo(vinculo.empresaId, vinculo.id, buscarAnterior);
  const anterior = buscarAnterior ? [...(lista.data?.datos ?? [])].sort((a, b) => b.abiertoEn.localeCompare(a.abiertoEn)).find(conVerificaciones) : undefined;
  const conCumplimiento = conVerificaciones(actual) ? actual : anterior;

  return (
    <Stack spacing={2}>
      {buscarAnterior && lista.isPending && <EsqueletoTarjeta alto={160} />}
      {conCumplimiento && conCumplimiento !== actual && (
        <Alert severity="info" sx={{ py: 0 }}>
          {t('vinculos.ficha.cumplimiento.deOtro', { folio: conCumplimiento.folio, fecha: formatearFecha(conCumplimiento.cerradoEn ?? conCumplimiento.actualizadoEn) })}
        </Alert>
      )}
      {conCumplimiento && <PanelVerificaciones expediente={conCumplimiento} empresaId={vinculo.empresaId} scopes={permisos.scopes} nombres={control?.nombres ?? new Map()} />}
      {pedido}
      <TarjetaMonitoreoListas vinculoId={vinculo.id} empresaId={vinculo.empresaId} />
      <TarjetaMonitoreoFuentes vinculoId={vinculo.id} empresaId={vinculo.empresaId} />
      {!conCumplimiento && !(buscarAnterior && lista.isPending) && (
        <Tarjeta titulo={t('vinculos.ficha.cumplimiento.titulo')}>
          <EstadoVacio compacto titulo={t('vinculos.ficha.cumplimiento.vacio')} texto={t('vinculos.ficha.cumplimiento.vacioAyuda')} />
        </Tarjeta>
      )}
    </Stack>
  );
}
