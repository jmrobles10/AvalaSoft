import { Box, MenuItem, TextField, Typography } from '@mui/material';
import type { AreaDto } from '@validalo/api-client';
import { useTranslation } from 'react-i18next';
import { nombreSeccion, SECCIONES_FICHA } from '../../terceros/ficha/secciones';
import type { EtapaEnEditor, ResponsableDeSectorEnEditor } from '../editor';

export interface EditorResponsablesDeSectorProps {
  responsables: ResponsableDeSectorEnEditor[];
  etapas: readonly EtapaEnEditor[];
  areas: readonly AreaDto[];
  onCambiar: (responsables: ResponsableDeSectorEnEditor[]) => void;
  soloLectura: boolean;
}

const SIN_RESPONSABLE = '';

/**
 * Responsable por sector en las actualizaciones (GA-8): para cada sector de la ficha, el área del flujo a la que va la sección cuando el tercero la cambia después de
 * aprobada. Sin responsable, el sector se revisa como siempre (las áreas de su requisito o, si no tiene, todas). La revisión inicial no cambia.
 */
export function EditorResponsablesDeSector({ responsables, etapas, areas, onCambiar, soloLectura }: EditorResponsablesDeSectorProps) {
  const { t } = useTranslation();
  const areasDelFlujo = [...new Set(etapas.flatMap((e) => e.areas.map((a) => a.areaId)).filter(Boolean))];
  const nombreArea = (id: string) => areas.find((a) => a.id === id)?.nombre ?? id;
  const elegir = (sector: string, areaId: string) => {
    const resto = responsables.filter((r) => r.sector !== sector);
    onCambiar(areaId === SIN_RESPONSABLE ? resto : [...resto, { sector, areaId }]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{ color: 'text.secondary' }}>{t('responsablesPorSector.ayuda')}</Typography>
      {areasDelFlujo.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('responsablesPorSector.sinAreas')}
        </Typography>
      )}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2, minmax(0,1fr))' } }}>
        {SECCIONES_FICHA.map(({ codigo }) => {
          const actual = responsables.find((r) => r.sector === codigo)?.areaId ?? SIN_RESPONSABLE;
          const nombre = nombreSeccion(codigo, t);
          return (
            <TextField
              key={codigo}
              select
              size="small"
              label={t('responsablesPorSector.areaDe', { sector: nombre })}
              value={actual}
              disabled={soloLectura || areasDelFlujo.length === 0}
              onChange={(e) => elegir(codigo, e.target.value)}
              // «Sin responsable» es una opción de verdad (valor vacío): se muestra en el campo y la etiqueta no se encima.
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value={SIN_RESPONSABLE}>{t('responsablesPorSector.sinResponsable')}</MenuItem>
              {areasDelFlujo.map((id) => (
                <MenuItem key={id} value={id}>
                  {nombreArea(id)}
                </MenuItem>
              ))}
            </TextField>
          );
        })}
      </Box>
    </Box>
  );
}
