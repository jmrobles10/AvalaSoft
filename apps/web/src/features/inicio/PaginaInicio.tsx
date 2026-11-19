import { Stack } from '@mui/material';
import { SCOPES } from '@validalo/api-client';
import { useTranslation } from 'react-i18next';
import { EncabezadoPagina, SinPermiso } from '../../shared/componentes';
import { usePermisos } from '../../shared/usePermisos';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { Indicadores } from './Indicadores';
import { LoQueTeToca } from './LoQueTeToca';

/**
 * Inicio de la empresa (INI-1, INI-2): primero lo que le toca a quien entra, con enlace a cada pantalla; debajo, los
 * indicadores de la empresa, con el mismo lenguaje de tablero que Informes (paneles blancos sobre el lienzo, tarjetas de cifras con ícono).
 * Es la primera pantalla para quien lee expedientes.
 */
export function PaginaInicio() {
  const { t } = useTranslation();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);

  if (!permisos.puede(SCOPES.expedientesLeer)) return <SinPermiso seccion={t('nav.inicio')} />;

  return (
    <>
      <EncabezadoPagina titulo={t('inicio.titulo')} subtitulo={t('inicio.subtitulo', { empresa: empresa.nombre })} />
      <Stack spacing={3} useFlexGap>
        <LoQueTeToca empresaId={empresa.id} />
        <Indicadores empresaId={empresa.id} puedeVerVinculos={permisos.puede(SCOPES.vinculosLeer)} puedeVerCertificados={permisos.puede(SCOPES.certificadosLeer)} />
      </Stack>
    </>
  );
}
