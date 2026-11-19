import { Box, ButtonBase } from '@mui/material';
import { visualmenteOculto } from '@validalo/ui';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChipDeTono } from './ChipDeTono';
import type { ChipDeResumen } from './resumenEmpresas';

/**
 * La columna «Empresas» cuando son muchas: un chip de conteo por estado («3 revalidan», «24 aprobadas», «2 no la exigen»), los que piden
 * algo primero, o un solo «Al día con 25 empresas». Es un botón: al tocarlo se abre (o se cierra) el detalle por estado bajo la fila.
 */
export function BotonResumenEmpresas({ chips, abierto, onAlternar, idDetalle }: { chips: readonly ChipDeResumen[]; abierto: boolean; onAlternar: () => void; idDetalle: string }) {
  const { t } = useTranslation();
  return (
    <ButtonBase
      onClick={onAlternar}
      aria-expanded={abierto}
      aria-controls={abierto ? idDetalle : undefined}
      sx={(th) => ({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-start',
        columnGap: 0.75,
        rowGap: 0.5,
        width: '100%',
        minHeight: { xs: 40, md: 28 },
        textAlign: 'left',
        borderRadius: `${String(th.radio.sm)}px`,
        '&.Mui-focusVisible': { outline: `2px solid ${th.palette.acento.main}`, outlineOffset: 2 },
      })}
    >
      {chips.map((c) => (
        <ChipDeTono key={c.clave} tono={c.tono} label={t(`boveda.resumen.${c.clave}`, { count: c.cantidad })} />
      ))}
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', color: 'text.secondary', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
        <ChevronDown size={16} strokeWidth={1.75} />
      </Box>
      <Box component="span" sx={visualmenteOculto}>
        {t('boveda.resumen.verDetalle')}
      </Box>
    </ButtonBase>
  );
}
