import { Button } from '@mui/material';
import { EstadoVacio } from '@validalo/ui';
import { FolderOpen, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useBoveda } from '../shared/api';
import { CabeceraPagina, ErrorRecuperable, EsqueletoTarjetas } from '../shared/componentes';
import { ContenidoBoveda } from './ContenidoBoveda';

/**
 * Mi bóveda: cada documento con su versión vigente y con qué empresas está compartido. Jerarquía en un solo nivel (la página ya es el panel,
 * sin otra tarjeta dentro): el filtro por empresa, lo que hay que renovar y los documentos como filas (`ContenidoBoveda`).
 */
export function PaginaBoveda() {
  const { t } = useTranslation();
  const consulta = useBoveda();
  const subir = (
    <Button component={RouterLink} to="/boveda/subir" variant="contained" startIcon={<Upload size={18} aria-hidden />} sx={{ width: { xs: '100%', sm: 'auto' } }}>
      {t('boveda.subir')}
    </Button>
  );

  return (
    <>
      <CabeceraPagina titulo={t('boveda.titulo')} sub={t('boveda.sub')} accion={subir} />
      {consulta.isPending ? (
        <EsqueletoTarjetas />
      ) : consulta.isError ? (
        <ErrorRecuperable error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.data.documentos.length === 0 ? (
        <EstadoVacio icono={FolderOpen} titulo={t('boveda.vacio')} texto={t('boveda.vacioTexto')} />
      ) : (
        <ContenidoBoveda documentos={consulta.data.documentos} />
      )}
    </>
  );
}
