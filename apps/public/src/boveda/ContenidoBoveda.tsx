import { Box, Typography } from '@mui/material';
import type { DocumentoBovedaDto } from '@validalo/api-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { AvisoConsolidado } from './AvisoConsolidado';
import { COLUMNAS_DOCUMENTO } from './columnas';
import { FiltroEmpresa } from './FiltroEmpresa';
import { documentosDeLaEmpresa, empresaDelFiltro, empresasDeLaBoveda } from './resumenEmpresas';
import { TarjetaDocumento } from './TarjetaDocumento';

/** El parámetro de la URL con la empresa elegida en el filtro (así sobrevive a recargar y se puede compartir el enlace). */
const PARAMETRO_EMPRESA = 'empresa';

/**
 * La bóveda con documentos: el filtro por empresa (solo con dos o más empresas), lo que hay que renovar (un bloque destacado arriba) y los
 * documentos como filas alineadas en columnas, con un encabezado de rótulos y divisores finos. Con una empresa elegida, el aviso y la
 * columna «Empresas» de cada fila hablan solo de ella.
 */
export function ContenidoBoveda({ documentos }: { documentos: readonly DocumentoBovedaDto[] }) {
  const { t } = useTranslation();
  const [parametros, setParametros] = useSearchParams();
  const opciones = useMemo(() => empresasDeLaBoveda(documentos), [documentos]);
  const hayFiltro = opciones.length >= 2;
  const elegida = hayFiltro ? empresaDelFiltro(opciones, parametros.get(PARAMETRO_EMPRESA)) : null;
  const empresaId = elegida?.id ?? null;
  const paraElAviso = useMemo(() => documentosDeLaEmpresa(documentos, empresaId), [documentos, empresaId]);

  const elegir = (id: string | null) =>
    setParametros(
      (anteriores) => {
        const siguientes = new URLSearchParams(anteriores);
        if (id === null) siguientes.delete(PARAMETRO_EMPRESA);
        else siguientes.set(PARAMETRO_EMPRESA, id);
        return siguientes;
      },
      { replace: true },
    );

  return (
    <>
      {hayFiltro && <FiltroEmpresa opciones={opciones} elegida={elegida} onElegir={elegir} />}
      {/* Lo que hay que renovar, primero lo que vence antes, consolidado entre las empresas (o solo la elegida). */}
      <AvisoConsolidado documentos={paraElAviso} />
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
        {documentos.map((d) => (
          <TarjetaDocumento key={d.id} documento={d} empresaId={empresaId} />
        ))}
      </Box>
    </>
  );
}
