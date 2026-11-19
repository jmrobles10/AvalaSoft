import { Alert, Box, Button, Stack, Tooltip } from '@mui/material';
import type { VersionDocumentoDto } from '@validalo/api-client';
import { EsqueletoTarjetas, formatearFecha, visualmenteOculto } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { useDocumentoBoveda } from '../shared/api';
import { ErrorRecuperable } from '../shared/componentes';
import { ChipDeVersion } from './ChipDeVersion';
import { ACCION_DE_VERSION } from './estilos';
import { formatearTamano } from './subida';
import { useDescargar } from './useDescargar';
import { mensajeDevolucion, sePuedeDescargar, sePuedeRetirar } from './versiones';

/**
 * Todas las versiones del documento, de la más reciente a la más antigua, como una lista compacta anidada bajo el documento: una fila por
 * versión («v2 · estado · archivo · 279 KB · 17/11/2026 · Descargar · Retirar») con divisores finos. En escritorio cada fila es una sola
 * línea, con las columnas alineadas y el nombre del archivo truncado (el nombre completo, en su tooltip); en el celular la fila se parte
 * en tres líneas. Las devueltas explican su motivo debajo.
 */
export function VersionesDocumento({ documentoId, onRetirar }: { documentoId: string; onRetirar: (version: VersionDocumentoDto) => void }) {
  const { t } = useTranslation();
  const consulta = useDocumentoBoveda(documentoId, true);
  const descargar = useDescargar();

  if (consulta.isPending) return <EsqueletoTarjetas cantidad={2} lineas={1} sx={{ mt: 1 }} />;
  if (consulta.isError) return <ErrorRecuperable error={consulta.error} onReintentar={() => void consulta.refetch()} />;

  const versiones = [...consulta.data.versiones].sort((a, b) => b.n - a.n);
  return (
    <Box component="ol" aria-label={t('boveda.versionesDelDocumento')} sx={{ p: 0, m: 0, mt: 0.5, listStyle: 'none' }}>
      {versiones.map((v) => (
        <Box
          component="li"
          key={v.n}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'auto auto minmax(0, 1fr)', md: '36px 104px minmax(0, 1fr) 64px 84px auto' },
            gridTemplateAreas: { xs: '"ver est est" "arch arch arch" "meta meta acc"', md: '"ver est arch tam fec acc"' },
            columnGap: 1.5,
            alignItems: 'center',
            py: 0.5,
            '&:not(:first-of-type)': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          <Box component="span" sx={{ typography: 'subtitle2', gridArea: 'ver' }}>
            <span aria-hidden>{t('boveda.versionCorta', { n: String(v.n) })}</span>
            <Box component="span" sx={visualmenteOculto}>
              {t('comun.version', { n: String(v.n) })}
            </Box>
          </Box>
          <Box sx={{ gridArea: 'est', justifySelf: 'start' }}>
            <ChipDeVersion version={v} />
          </Box>
          <Tooltip title={v.nombreOriginal} placement="top-start" enterDelay={300}>
            <Box component="span" sx={{ typography: 'body2', gridArea: 'arch', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.nombreOriginal}
            </Box>
          </Tooltip>
          <Box component="span" sx={{ typography: 'caption', gridArea: 'meta', display: { xs: 'flex', md: 'contents' }, columnGap: 0.75, color: 'text.secondary' }}>
            <Box component="span" sx={{ gridArea: 'tam', textAlign: { md: 'right' }, whiteSpace: 'nowrap' }}>
              {formatearTamano(v.tamanoBytes)}
            </Box>
            <Box component="span" aria-hidden sx={{ display: { md: 'none' } }}>
              ·
            </Box>
            <Box component="span" sx={{ gridArea: 'fec', whiteSpace: 'nowrap' }}>
              {formatearFecha(v.cargadaEn)}
            </Box>
          </Box>
          <Stack direction="row" sx={{ gridArea: 'acc', justifySelf: 'end', alignItems: 'center' }}>
            {sePuedeDescargar(v) && (
              <Button size="small" variant="text" sx={ACCION_DE_VERSION} aria-label={t('boveda.descargarVersion', { n: String(v.n) })} onClick={() => descargar(documentoId, v.n)}>
                {t('boveda.descargar')}
              </Button>
            )}
            {sePuedeRetirar(v) && (
              <Button size="small" variant="text" color="error" sx={ACCION_DE_VERSION} aria-label={t('boveda.retirarVersion', { n: String(v.n) })} onClick={() => onRetirar(v)}>
                {t('boveda.retirarCorto')}
              </Button>
            )}
          </Stack>
          {v.estado === 'Devuelta' && (
            <Alert severity="error" sx={{ typography: 'body2', gridColumn: '1 / -1', mt: 0.5, py: 0 }}>
              {mensajeDevolucion(v, t)}
            </Alert>
          )}
        </Box>
      ))}
    </Box>
  );
}
