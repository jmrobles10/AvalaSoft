import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PanelDeEmpresas } from './PanelDeEmpresas';
import type { DetalleDeVencimiento } from './porRenovar';
import { buscarPorNombre } from './resumenEmpresas';

/**
 * Lo que se abre con «Ver empresas» en una línea resumida de «Por renovar»: la fecha de cada empresa (primero la más próxima) y, al final,
 * antes de cuándo renovar para quedar al día con todas. Con muchas, un buscador por nombre.
 */
export function DetalleVencimientos({ id, empresas, cierre }: { id: string; empresas: readonly DetalleDeVencimiento[]; cierre: string | null }) {
  const { t } = useTranslation();
  return (
    <PanelDeEmpresas
      id={id}
      total={empresas.length}
      etiqueta={t('boveda.empresas')}
      pie={
        cierre && (
          <Typography variant="caption" component="p" sx={{ m: 0, mt: 1 }}>
            {cierre}
          </Typography>
        )
      }
    >
      {(busqueda) => {
        const visibles = buscarPorNombre(empresas, busqueda, (e) => e.empresa);
        if (visibles.length === 0) {
          return (
            <Typography variant="caption" component="p" sx={{ m: 0, color: 'text.secondary' }}>
              {t('boveda.detalle.sinCoincidencias', { texto: busqueda.trim() })}
            </Typography>
          );
        }
        return (
          <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {visibles.map((e) => (
              <Box key={e.empresa} component="li" sx={{ typography: 'body2', py: 0.25, overflowWrap: 'anywhere' }}>
                <Box component="span" sx={{ typography: 'subtitle2' }}>
                  {e.empresa}
                </Box>
                <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${e.texto}`}</Box>
              </Box>
            ))}
          </Box>
        );
      }}
    </PanelDeEmpresas>
  );
}
