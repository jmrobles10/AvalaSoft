import { IconButton, Tooltip } from '@mui/material';
import { SCOPES } from '@validalo/api-client';
import { FileArchive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { usePermisos } from '../../shared/usePermisos';
import { guardarArchivo } from '../vencimientos/api';
import { useDescarga } from './api';
import { RUTAS } from './modelo';

/**
 * «Exportar expediente» (IF-5): descarga el ZIP con los documentos aprobados, el resumen en PDF y la línea de tiempo. Solo
 * con `expedientes:exportar` y `documentos:descargar`; cada documento incluido queda en la auditoría de accesos.
 */
export function BotonExportarExpediente({ empresaId, expedienteId }: { empresaId: string; expedienteId: string }) {
  const { t } = useTranslation();
  const permisos = usePermisos(empresaId);
  const mostrar = useAvisos((s) => s.mostrar);
  const descarga = useDescarga(empresaId);
  if (!permisos.puede(SCOPES.expedientesExportar) || !permisos.puede(SCOPES.documentosDescargar)) return null;

  const exportar = () =>
    descarga.mutate(
      { url: RUTAS.expedienteZip(expedienteId) },
      {
        onSuccess: (archivo) => guardarArchivo(archivo, t('informes.expediente.zipNombre')),
        onError: (error) => mostrar(`${t('informes.expediente.exportarError')} ${mensajeDeError(error, t)}`, 'error'),
      },
    );

  return (
    // Botón de ícono: el nombre va en `aria-label` y el tooltip dice qué trae el ZIP.
    <Tooltip
      describeChild
      title={
        <>
          <strong>{t('informes.expediente.exportar')}</strong>
          <br />
          {t('informes.expediente.exportarAyuda')}
        </>
      }
    >
      <span>
        <IconButton
          aria-label={t('informes.expediente.exportar')}
          disabled={descarga.isPending}
          onClick={exportar}
          sx={{ border: 1, borderColor: 'divider', borderRadius: '10px', width: 36, height: 36 }}
        >
          <FileArchive size={18} aria-hidden />
        </IconButton>
      </span>
    </Tooltip>
  );
}
