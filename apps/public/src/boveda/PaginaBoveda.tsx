import { Box, Button, Typography } from '@mui/material';
import { EstadoVacio } from '@validalo/ui';
import { FolderOpen, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useBoveda } from '../shared/api';
import { CabeceraPagina, ErrorRecuperable, EsqueletoTarjetas } from '../shared/componentes';
import { AvisoConsolidado } from './AvisoConsolidado';
import { COLUMNAS_DOCUMENTO } from './columnas';
import { TarjetaDocumento } from './TarjetaDocumento';

/**
 * Mi bóveda: cada documento con su versión vigente y con qué empresas está compartido. Jerarquía en un solo nivel (la página ya es el panel,
 * sin otra tarjeta dentro): lo que hay que renovar es un bloque destacado arriba y los documentos son filas alineadas en columnas, con un
 * encabezado de rótulos y divisores finos.
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
        <>
          {/* Lo que hay que renovar, primero lo que vence antes, consolidado entre todas las empresas. */}
          <AvisoConsolidado documentos={consulta.data.documentos} />
          {/* Rótulos de las columnas (decorativos: la lista ya tiene sus nombres accesibles). */}
          <Box
            aria-hidden
            sx={{
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: COLUMNAS_DOCUMENTO,
              columnGap: 2,
              pb: 0.75,
              borderBottom: 1,
              borderColor: 'divider',
              color: 'text.secondary',
            }}
          >
            <Typography variant="overline">{t('boveda.columnas.documento')}</Typography>
            <Typography variant="overline">{t('boveda.columnas.estado')}</Typography>
            <Typography variant="overline">{t('boveda.columnas.empresas')}</Typography>
            <Box />
          </Box>
          <Box>
            {consulta.data.documentos.map((d) => (
              <TarjetaDocumento key={d.id} documento={d} />
            ))}
          </Box>
        </>
      )}
    </>
  );
}
