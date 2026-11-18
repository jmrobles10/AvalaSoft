import { Box, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { NivelDeSector } from '@avalasoft/api-client';
import { useTranslation } from 'react-i18next';
import { nombreSeccion, SECCIONES_FICHA } from '../../terceros/ficha/secciones';
import { alternarSector, cambiarNivel, type SectorEnEditor } from './modelo';

export interface SelectorSectoresProps {
  valor: readonly SectorEnEditor[];
  onCambiar: (sectores: SectorEnEditor[]) => void;
  soloLectura?: boolean;
}

/**
 * Sectores de la ficha a los que se acota el grupo: cada sección con su nivel (ver, o ver y decidir). Sin ninguno marcado el grupo vale para todos los sectores.
 */
export function SelectorSectores({ valor, onCambiar, soloLectura = false }: SelectorSectoresProps) {
  const { t } = useTranslation();
  return (
    <Box component="fieldset" disabled={soloLectura} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Typography component="legend" sx={{ fontSize: 14, fontWeight: 600 }}>
        {t('gruposDeAcceso.sectores.titulo')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {valor.length === 0 ? t('gruposDeAcceso.sectores.todos') : t('gruposDeAcceso.sectores.nivelAyuda')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {t('gruposDeAcceso.sectores.ayuda')}
      </Typography>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: (th) => `${String(th.radio.sm)}px` }}>
        {SECCIONES_FICHA.map(({ codigo }, i) => {
          const elegido = valor.find((s) => s.sector === codigo);
          const nombre = nombreSeccion(codigo, t);
          return (
            <Stack key={codigo} direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 1.5, py: 0.5, borderTop: i === 0 ? 0 : 1, borderColor: 'divider', minHeight: 44 }}>
              <FormControlLabel
                sx={{ mx: 0, flex: 1, minWidth: 0 }}
                control={<Checkbox size="small" checked={elegido !== undefined} onChange={() => onCambiar(alternarSector(valor, codigo))} />}
                label={<Typography component="span" variant="body2">{nombre}</Typography>}
              />
              {elegido && (
                <TextField
                  select
                  size="small"
                  value={elegido.nivel}
                  disabled={soloLectura}
                  onChange={(e) => onCambiar(cambiarNivel(valor, codigo, e.target.value as NivelDeSector))}
                  slotProps={{ select: { SelectDisplayProps: { 'aria-label': t('gruposDeAcceso.sectores.nivelDe', { sector: nombre }) } } }}
                  sx={{ width: 160, flex: 'none' }}
                >
                  {Object.values(NivelDeSector).map((nivel) => (
                    <MenuItem key={nivel} value={nivel}>
                      {t(`gruposDeAcceso.sectores.niveles.${nivel}`)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}
