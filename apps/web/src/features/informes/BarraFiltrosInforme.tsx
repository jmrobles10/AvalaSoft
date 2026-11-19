import { Box, Button } from '@mui/material';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Barra de filtros de los informes: un panel blanco con los controles en una rejilla de columnas iguales (todos de 36 px, alineados y sin
 * saltos de altura) que se envuelve sola en pantallas angostas. «Limpiar filtros» aparece al final solo si hay alguno activo. Los hijos son
 * `FiltroMenu fullWidth` y `CampoFecha fullWidth`.
 */
export function BarraFiltrosInforme({ children, hayFiltros, onLimpiar }: { children: ReactNode; hayFiltros: boolean; onLimpiar: () => void }) {
  const { t } = useTranslation();
  return (
    <Box
      component="section"
      aria-label={t('informes.filtrosEtiqueta')}
      sx={(tema) => ({
        p: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(tema.radio.md)}px`,
        bgcolor: 'background.paper',
        boxShadow: tema.sombra.suave,
      })}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(168px, 1fr))' }, gap: 1.5, alignItems: 'start' }}>
        {children}
        {hayFiltros && (
          <Button variant="text" startIcon={<X size={14} aria-hidden />} onClick={onLimpiar} sx={{ justifySelf: { xs: 'stretch', sm: 'start' } }}>
            {t('informes.limpiar')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

/** Las dos fechas del rango (`Desde` y `Hasta`): en el celular van lado a lado en una sola fila de la barra; desde `sm` son celdas más de la rejilla. */
export function GrupoFechas({ children }: { children: ReactNode }) {
  return <Box sx={{ display: { xs: 'grid', sm: 'contents' }, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5, alignItems: 'start' }}>{children}</Box>;
}
