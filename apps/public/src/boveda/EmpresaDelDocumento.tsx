import { Box, Tooltip, Typography } from '@mui/material';
import type { ComparticionPublicaDto } from '@validalo/api-client';
import { visualmenteOculto } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { ChipDeTono } from './ChipDeTono';
import { detalleComparticion, resumenCorto } from './versiones';

/**
 * Una empresa del documento, nombrada: chip «Empresa · aprobada v1» (verde si ya aprobó, ámbar si falta algo —revisa, corregir,
 * revalidar—, gris si no la exige) con la frase completa en el tooltip. Si pide algo del tercero, una línea breve la explica debajo.
 * Es lo que se ve con pocas empresas; con muchas, la columna se resume (`ResumenEmpresas`).
 */
export function EmpresaDelDocumento({ comparticion: c, referencia }: { comparticion: ComparticionPublicaDto; referencia: string | null }) {
  const { t } = useTranslation();
  const { texto, tono, pideAccion } = resumenCorto(c, t);
  const largo = detalleComparticion(c, t, referencia);
  return (
    <Box component="li" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '100%', listStyle: 'none' }}>
      <Tooltip title={largo} placement="top-start" enterDelay={300}>
        <ChipDeTono
          tono={tono}
          ocultoAAyuda
          label={
            <>
              <Box component="span" sx={{ typography: 'subtitle2' }}>
                {c.empresa.nombre}
              </Box>
              {` · ${texto}`}
            </>
          }
        />
      </Tooltip>
      {/* Para lectores de pantalla: el nombre de la empresa y la frase completa de lo que tiene. */}
      <Box component="span" sx={visualmenteOculto}>{`${c.empresa.nombre}: ${largo}`}</Box>
      {pideAccion && (
        <Typography variant="caption" component="span" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {largo}
        </Typography>
      )}
    </Box>
  );
}
