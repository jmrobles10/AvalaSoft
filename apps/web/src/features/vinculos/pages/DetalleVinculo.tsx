import { Box, Skeleton } from '@mui/material';
import { esErrorApi, SCOPES } from '@avalasoft/api-client';
import { EsqueletoTarjeta, PaginaEstado } from '@avalasoft/ui';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useScrollPropio } from '../../../sesion/alturaFija';
import { EnlaceVolver, ErrorRecuperable, SinPermiso } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { usePermisos } from '../../../shared/usePermisos';
import { useEmpresaActiva } from '../../empresas/useEmpresas';
import { useVinculo } from '../api';
import { FichaVinculo } from '../ficha/FichaVinculo';

/** Esqueleto de la ficha: encabezado, barra de sectores y contenido. */
export function EsqueletoFicha({ volver }: { volver: React.ReactNode }) {
  return (
    <Box aria-busy>
      {volver}
      <Skeleton variant="rounded" width={320} height={28} sx={{ mb: 1 }} />
      <Skeleton variant="rounded" width={220} height={14} sx={{ mb: 3 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: '232px minmax(0,1fr)' }, gap: 3 }}>
        <Skeleton variant="rounded" height={360} sx={{ display: { xs: 'none', lg: 'block' } }} />
        <EsqueletoTarjeta alto={320} />
      </Box>
    </Box>
  );
}

/** Detalle del vínculo: la ficha por sectores, abierta en Información general como la ficha del proveedor del SRM. */
export function DetalleVinculo() {
  const { t } = useTranslation();
  // Encabezado con las acciones siempre a la vista: embebida, la página usa scroll propio.
  useScrollPropio();
  const { vinculoId = '' } = useParams();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const consulta = useVinculo(empresa.id, vinculoId);

  if (!permisos.puede(SCOPES.vinculosLeer)) return <SinPermiso seccion={t('nav.vinculos')} />;

  const volver = <EnlaceVolver a="..">{t('nav.vinculos')}</EnlaceVolver>;

  if (consulta.isPending) return <EsqueletoFicha volver={volver} />;
  if (consulta.isError) {
    if (esErrorApi(consulta.error) && consulta.error.esNoEncontrado) {
      return <PaginaEstado icono={SearchX} titulo={t('vinculos.detalle.noEncontrado')} texto={t('vinculos.detalle.noEncontradoAyuda')} acciones={volver} />;
    }
    return (
      <>
        {volver}
        <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />
      </>
    );
  }

  const vinculo = consulta.data;
  return <FichaVinculo vinculo={vinculo} expedienteId={vinculo.expedienteAbiertoId ?? null} sectorPorDefecto="general" volver={volver} />;
}
