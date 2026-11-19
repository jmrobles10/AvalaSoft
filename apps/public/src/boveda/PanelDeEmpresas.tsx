import { Box, InputAdornment, TextField } from '@mui/material';
import { Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPRESAS_PARA_BUSCAR } from './resumenEmpresas';

/**
 * El panel que se abre bajo una fila o una línea del aviso con la lista de sus empresas. Con más de {@link EMPRESAS_PARA_BUSCAR}
 * empresas trae un buscador por nombre y la lista se desplaza dentro del panel (sin estirar la página). `children` recibe el texto
 * buscado para filtrar su lista. `pie` va debajo de la lista, fuera de su desplazamiento (siempre visible).
 */
export function PanelDeEmpresas({ id, total, etiqueta, pie, children }: { id: string; total: number; etiqueta: string; pie?: ReactNode; children: (busqueda: string) => ReactNode }) {
  const { t } = useTranslation();
  const [busqueda, setBusqueda] = useState('');
  const conBuscador = total > EMPRESAS_PARA_BUSCAR;
  return (
    <Box id={id} sx={(th) => ({ minWidth: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: `${String(th.radio.md)}px`, bgcolor: 'background.paper' })}>
      {conBuscador && (
        <TextField
          type="search"
          size="small"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t('boveda.detalle.buscar')}
          slotProps={{
            htmlInput: { 'aria-label': t('boveda.detalle.buscar') },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} strokeWidth={1.75} aria-hidden />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: { xs: '100%', sm: 280 }, mb: 1.25 }}
        />
      )}
      <Box
        {...(conBuscador && { role: 'region', 'aria-label': etiqueta, tabIndex: 0 })}
        sx={{ minWidth: 0, ...(conBuscador && { maxHeight: 'min(360px, 60vh)', overflowY: 'auto', pr: 0.5 }) }}
      >
        {children(conBuscador ? busqueda : '')}
      </Box>
      {pie}
    </Box>
  );
}
