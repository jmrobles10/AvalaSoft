import { Box, Tab, Tabs } from '@mui/material';
import type { ExpedienteDto } from '@validalo/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HistorialExpediente } from '../../expedientes/components/PanelesExpediente';
import { HistorialVinculo } from './PartesVinculo';

/**
 * El historial de la ficha: un solo bloque con dos pestañas, la del expediente que se revisa (si hay) y la del vínculo. Va en el panel
 * lateral y en el sector Historial; el título lo pone quien lo contiene.
 */
export function HistorialFicha({ empresaId, vinculoId, expediente }: { empresaId: string; vinculoId: string; expediente: ExpedienteDto | null }) {
  const { t } = useTranslation();
  const [pestana, setPestana] = useState<'expediente' | 'vinculo'>(expediente ? 'expediente' : 'vinculo');
  const actual = expediente ? pestana : 'vinculo';

  return (
    <Box>
      {expediente && (
        <Tabs value={actual} onChange={(_e, v: 'expediente' | 'vinculo') => setPestana(v)} aria-label={t('vinculos.ficha.historial')} sx={{ mb: 1.5, minHeight: 36, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="expediente" label={t('vinculos.ficha.historialExpediente', { folio: expediente.folio })} sx={{ minHeight: 36, textTransform: 'none' }} />
          <Tab value="vinculo" label={t('vinculos.ficha.historialVinculo')} sx={{ minHeight: 36, textTransform: 'none' }} />
        </Tabs>
      )}
      {actual === 'expediente' && expediente ? (
        <HistorialExpediente empresaId={empresaId} expediente={expediente} sinTarjeta />
      ) : (
        <HistorialVinculo empresaId={empresaId} vinculoId={vinculoId} sinTarjeta />
      )}
    </Box>
  );
}
