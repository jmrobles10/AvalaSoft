import { Box, Button, Stack, Typography } from '@mui/material';
import type { DocumentoBovedaDto } from '@validalo/api-client';
import { CalendarClock, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { ChipVigencia } from '../vigencia/ChipVigencia';
import { lineasPorRenovar } from './porRenovar';

/**
 * «Por renovar» (AvisoConsolidado de docs/06): arriba de la bóveda, qué documentos renovar primero y con qué empresas
 * quedas al día, con la acción de subir la versión nueva. Es el bloque que más pesa de la pantalla: un fondo con el tinte del tono
 * (ámbar; rojo si algo ya venció), sin borde, a diferencia de la lista de documentos que va debajo. No se muestra si no hay nada
 * que atender.
 */
export function AvisoConsolidado({ documentos }: { documentos: readonly DocumentoBovedaDto[] }) {
  const { t } = useTranslation();
  const lineas = lineasPorRenovar(documentos, t);
  if (lineas.length === 0) return null;
  const urgente = lineas.some((l) => l.vigencia.estado === 'Vencida');
  const tono = urgente ? 'error' : 'advertencia';

  return (
    <Box
      component="section"
      aria-labelledby="por-renovar"
      sx={(th) => ({ mb: 2, px: { xs: 1.5, sm: 2 }, py: 1.25, borderRadius: `${String(th.radio.md)}px`, bgcolor: th.palette.estado[tono].fondo })}
    >
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0.25 }}>
        <Box aria-hidden sx={(th) => ({ display: 'inline-flex', flex: 'none', color: th.palette.estado[tono].texto })}>
          <CalendarClock size={20} strokeWidth={1.75} />
        </Box>
        <Typography id="por-renovar" component="h2" variant="h3" sx={{ fontSize: 15, lineHeight: '22px', whiteSpace: 'nowrap' }}>
          {t('boveda.porRenovar.titulo')}
        </Typography>
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, minWidth: 0, flexBasis: { xs: '100%', sm: 'auto' }, pl: { xs: 4.25, sm: 0 } }}>
          {t('boveda.porRenovar.sub')}
        </Typography>
      </Stack>
      <Box component="ul" sx={{ p: 0, m: 0, mt: 0.25 }}>
        {lineas.map((l) => (
          <Stack
            key={l.documentoId}
            component="li"
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, columnGap: 2, rowGap: 0.25, py: 0.5, pl: { sm: 4.25 }, listStyle: 'none' }}
          >
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.25 }}>
              <ChipVigencia vigencia={l.vigencia} />
              <Typography component="span" sx={{ fontSize: 14, lineHeight: '20px', minWidth: 0 }}>
                <Box component="strong" sx={{ fontWeight: 500 }}>{`${l.documento}:`}</Box> {l.texto}
              </Typography>
            </Box>
            {l.subir && (
              <Button
                component={RouterLink}
                to={l.subir}
                variant="text"
                startIcon={<Upload size={16} aria-hidden />}
                aria-label={`${t('boveda.porRenovar.subir')}: ${l.documento}`}
                size="small"
                sx={{ flex: 'none', ml: { xs: -1, sm: 0 } }}
              >
                {t('boveda.porRenovar.subir')}
              </Button>
            )}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}
