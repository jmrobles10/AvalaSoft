import { Box, Button, Stack, Typography } from '@mui/material';
import type { DocumentoBovedaDto } from '@validalo/api-client';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineaDelAviso } from './LineaDelAviso';
import { lineasPorRenovar, MAXIMO_LINEAS_AVISO } from './porRenovar';

/**
 * «Por renovar» (AvisoConsolidado de docs/06): arriba de la bóveda, qué documentos renovar primero y con qué empresas
 * quedas al día, con la acción de subir la versión nueva. Es el bloque que más pesa de la pantalla: un fondo con el tinte del tono
 * (ámbar; rojo si algo ya venció), sin borde, a diferencia de la lista de documentos que va debajo. Una línea por documento, resumida si
 * son muchas empresas; con más de {@link MAXIMO_LINEAS_AVISO} líneas, las primeras y «Ver N más». No se muestra si no hay nada
 * que atender.
 */
export function AvisoConsolidado({ documentos }: { documentos: readonly DocumentoBovedaDto[] }) {
  const { t } = useTranslation();
  const [verTodas, setVerTodas] = useState(false);
  const lineas = lineasPorRenovar(documentos, t);
  if (lineas.length === 0) return null;
  const urgente = lineas.some((l) => l.vigencia.estado === 'Vencida');
  const tono = urgente ? 'error' : 'advertencia';
  const visibles = verTodas ? lineas : lineas.slice(0, MAXIMO_LINEAS_AVISO);
  const ocultas = lineas.length - MAXIMO_LINEAS_AVISO;

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
        {visibles.map((l) => (
          <LineaDelAviso key={l.documentoId} linea={l} />
        ))}
      </Box>
      {ocultas > 0 && (
        <Button variant="text" size="small" onClick={() => setVerTodas((v) => !v)} aria-expanded={verTodas} sx={{ ml: { xs: -1, sm: 3.25 } }}>
          {verTodas ? t('boveda.porRenovar.verMenos') : t('boveda.porRenovar.verMas', { count: ocultas })}
        </Button>
      )}
    </Box>
  );
}
