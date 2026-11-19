import { Button } from '@mui/material';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { guardarArchivo } from '../vencimientos/api';
import { useDescarga } from './api';

export interface DescargaInforme {
  formato: 'excel' | 'pdf';
  /** Ruta de la API que genera el archivo. */
  url: string;
  /** Nombre con el que se guarda. */
  nombre: string;
}

/**
 * Botones «Descargar Excel» / «Descargar PDF» del encabezado de un informe: piden el archivo con los mismos filtros de la consulta (`params`),
 * lo guardan y avisan si falla. Se deshabilitan mientras baja uno o cuando no hay nada que descargar (`deshabilitado`).
 */
export function AccionesDescarga({ empresaId, params, descargas, deshabilitado = false }: { empresaId: string; params?: object; descargas: readonly DescargaInforme[]; deshabilitado?: boolean }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const descarga = useDescarga(empresaId);

  const descargar = (d: DescargaInforme) =>
    descarga.mutate(
      { url: d.url, params },
      {
        onSuccess: (archivo) => guardarArchivo(archivo, d.nombre),
        onError: (error) => mostrar(`${t('informes.descargaError')} ${mensajeDeError(error, t)}`, 'error'),
      },
    );

  return (
    <>
      {descargas.map((d) => (
        <Button
          key={d.formato}
          variant="outlined"
          startIcon={d.formato === 'excel' ? <Download size={16} aria-hidden /> : <FileText size={16} aria-hidden />}
          disabled={descarga.isPending || deshabilitado}
          onClick={() => descargar(d)}
        >
          {d.formato === 'excel' ? t('informes.excel') : t('informes.pdf')}
        </Button>
      ))}
    </>
  );
}
