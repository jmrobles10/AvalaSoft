import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ChipDeTono } from './ChipDeTono';
import { PanelDeEmpresas } from './PanelDeEmpresas';
import { buscarEnGrupos, type EmpresasDeUnGrupo } from './resumenEmpresas';
import { detalleComparticion } from './versiones';

/**
 * Lo que se abre al tocar el resumen de la columna «Empresas»: las empresas agrupadas por estado (primero las que piden algo), cada una con
 * su frase completa. Con muchas, un buscador por nombre.
 */
export function DetalleEmpresas({ id, grupos, referencia }: { id: string; grupos: readonly EmpresasDeUnGrupo[]; referencia: string | null }) {
  const { t } = useTranslation();
  const total = grupos.reduce((suma, g) => suma + g.empresas.length, 0);
  return (
    <PanelDeEmpresas id={id} total={total} etiqueta={t('boveda.empresas')}>
      {(busqueda) => {
        const visibles = buscarEnGrupos(grupos, busqueda);
        if (visibles.length === 0) {
          return (
            <Typography variant="caption" component="p" sx={{ m: 0, color: 'text.secondary' }}>
              {t('boveda.detalle.sinCoincidencias', { texto: busqueda.trim() })}
            </Typography>
          );
        }
        return visibles.map((g) => (
          <Box key={g.grupo} component="section" aria-labelledby={`${id}-${g.grupo}`} sx={{ '& + &': { mt: 1.5 } }}>
            <Typography id={`${id}-${g.grupo}`} component="h3" sx={{ m: 0, mb: 0.5 }}>
              <ChipDeTono tono={g.tono} label={t(`boveda.resumen.${g.grupo}`, { count: g.empresas.length })} />
            </Typography>
            <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {g.empresas.map((c) => (
                <Box key={c.vinculoId} component="li" sx={{ typography: 'body2', py: 0.25, overflowWrap: 'anywhere' }}>
                  <Box component="span" sx={{ typography: 'subtitle2' }}>
                    {c.empresa.nombre}
                  </Box>
                  <Box component="span" sx={{ color: 'text.secondary' }}>{` · ${detalleComparticion(c, t, referencia)}`}</Box>
                </Box>
              ))}
            </Box>
          </Box>
        ));
      }}
    </PanelDeEmpresas>
  );
}
