import { Alert, Box, Dialog, IconButton, Stack, Typography } from '@mui/material';
import type { RequisitoExpedienteDto, SeccionDeRequisitoDto } from '@validalo/api-client';
import { formatearFecha } from '@validalo/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentosVinculo } from '../../documentos/api';
import { VisorDocumento, type DocumentoEnVisor } from '../../documentos/VisorDocumento';
import { seccionSinAcceso } from '../secciones';
import { DetalleSeccionRequisito } from './DetalleSeccionRequisito';

export interface VisorSeccionRequisitoProps {
  empresaId: string;
  vinculoId: string;
  terceroId: string;
  requisito: RequisitoExpedienteDto;
  seccion: SeccionDeRequisitoDto;
  /** `documentos:descargar`: sin él un soporte sin formulario no se abre en el visor. */
  puedeVerArchivo: boolean;
  /** `documentos:leer`: con él se piden los documentos del vínculo para abrir los soportes de la sección. */
  puedeLeerDocumentos: boolean;
  onCerrar: () => void;
}

/**
 * «Ver datos» de un requisito de sección de la ficha: una sección no es un archivo ni un formulario de tipo de documento (TD-4),
 * sus datos viven en el requisito (`RequisitoExpedienteDto.Seccion`). El diálogo muestra el mismo detalle que la tarjeta del
 * requisito (`DetalleSeccionRequisito`): completitud, cambios, cruce, datos y soportes. Un grupo de acceso acotado por sector no
 * recibe el contenido de las secciones ajenas: en ese caso se avisa en vez de mostrar un detalle vacío.
 */
export function VisorSeccionRequisito({ empresaId, vinculoId, terceroId, requisito, seccion, puedeVerArchivo, puedeLeerDocumentos, onCerrar }: VisorSeccionRequisitoProps) {
  const { t } = useTranslation();
  const documentos = useDocumentosVinculo(empresaId, vinculoId, puedeLeerDocumentos);
  const [soporte, setSoporte] = useState<DocumentoEnVisor | null>(null);
  const version = requisito.versionActual;
  const titulo = version
    ? `${requisito.tipoDocumento.nombre} · ${t('documentos.version', { n: String(version.n), fecha: formatearFecha(version.cargadaEn) })}`
    : requisito.tipoDocumento.nombre;

  return (
    <>
      <Dialog
        open
        onClose={onCerrar}
        maxWidth={false}
        aria-labelledby="titulo-visor-seccion"
        slotProps={{ paper: { sx: { width: 'min(760px, calc(100% - 16px))', maxHeight: 'min(90vh, 820px)', m: { xs: 1, md: 4 } } } }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography id="titulo-visor-seccion" variant="h6" component="h2" noWrap>
              {titulo}
            </Typography>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }} noWrap>
              {t('expedientes.datosDeclarados.seccionDeLaFicha')}
            </Typography>
          </Box>
          <IconButton aria-label={t('comun.cerrar')} onClick={onCerrar}>
            <X size={18} />
          </IconButton>
        </Stack>
        <Box sx={{ p: 2, overflow: 'auto' }}>
          {seccionSinAcceso(requisito) ? (
            <Alert severity="info">{t('expedientes.datosDeclarados.seccionSinAcceso')}</Alert>
          ) : (
            <DetalleSeccionRequisito
              requisito={requisito}
              seccion={seccion}
              documentos={documentos.data ?? []}
              puedeVer={puedeVerArchivo}
              onVer={setSoporte}
              empresaId={empresaId}
              terceroId={terceroId}
            />
          )}
        </Box>
      </Dialog>
      {soporte && <VisorDocumento empresaId={empresaId} vinculoId={vinculoId} documento={soporte} onCerrar={() => setSoporte(null)} />}
    </>
  );
}
