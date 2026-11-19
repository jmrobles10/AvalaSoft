import { Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EncabezadoPagina } from '../../shared/componentes';
import { PestanasInformes, type PestanaInforme } from './PestanasInformes';

/**
 * Marco común de las cuatro pestañas de Informes: el encabezado de página (título, empresa y los botones de descarga de la pestaña), las
 * pestañas y el cuerpo con el mismo espaciado, para que se lean como una sola sección.
 */
export function MarcoInforme({ empresa, actual, acciones, children }: { empresa: { id: string; nombre: string }; actual: PestanaInforme; acciones?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      <EncabezadoPagina titulo={t('informes.titulo')} subtitulo={t('informes.subtitulo', { empresa: empresa.nombre })} acciones={acciones} />
      <PestanasInformes empresaId={empresa.id} actual={actual} />
      <Stack spacing={2} useFlexGap>
        {children}
      </Stack>
    </>
  );
}
