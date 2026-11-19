import { Button } from '@mui/material';
import type { AreaExpedienteDto } from '@validalo/api-client';
import { Check, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { documentosPorDecidir } from '../decisionArea';
import type { DialogoExpediente } from '../reglas';

/**
 * Las acciones de un área en un flujo con requisitos, iguales en «Lo que te toca decidir» y en «Etapas y áreas»: «Aprobar área (n
 * documentos)» y «Observar» (decisión del área) y «Rechazar» (rechazo terminal del expediente). Devuelve solo los botones, sin
 * contenedor: cada tarjeta los acomoda a su manera. Quien llama decide cuáles aplican (`bloqueoDecisionArea` y `puedeRechazar`).
 */
export function AccionesDecisionArea({
  area,
  puedeDecidir,
  puedeRechazar,
  onAccion,
}: {
  area: AreaExpedienteDto;
  /** La persona puede aprobar u observar el área ahora. */
  puedeDecidir: boolean;
  /** La persona puede rechazar el expediente desde el área. */
  puedeRechazar: boolean;
  onAccion: (dialogo: DialogoExpediente) => void;
}) {
  const { t } = useTranslation();
  const porDecidir = documentosPorDecidir(area);
  return (
    <>
      {puedeDecidir && (
        <>
          <Button variant="contained" size="small" startIcon={<Check size={14} aria-hidden />} onClick={() => onAccion({ tipo: 'aprobarArea', area, documentos: porDecidir })}>
            {t('expedientes.decisionArea.aprobar', { count: porDecidir.length })}
          </Button>
          <Button variant="outlined" color="warning" size="small" startIcon={<TriangleAlert size={14} aria-hidden />} onClick={() => onAccion({ tipo: 'observarArea', area })}>
            {t('expedientes.decisionArea.observar')}
          </Button>
        </>
      )}
      {puedeRechazar && (
        <Button variant="outlined" color="error" size="small" onClick={() => onAccion({ tipo: 'rechazar', area })}>
          {t('expedientes.acciones.rechazar')}
        </Button>
      )}
    </>
  );
}
