import { Chip } from '@mui/material';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import type { TonoDeComparticion } from './versiones';

type PropsDeChipDeTono = Omit<ComponentPropsWithRef<'span'>, 'children' | 'color'> & {
  tono: TonoDeComparticion;
  label: ReactNode;
  /** Oculto a lectores de pantalla: otra línea invisible dice lo mismo con la frase completa. */
  ocultoAAyuda?: boolean;
};

/**
 * Chip pequeño con el tono de la paleta de estados (verde si está bien, ámbar si falta algo, gris si no aplica). Lo usan el chip de cada
 * empresa («Norte · aprobada v1») y los de conteo del resumen («24 aprobadas»). Es un `span` para poder ir dentro de un botón, y deja
 * pasar las propiedades que le ponga un `Tooltip`.
 */
export function ChipDeTono({ tono, label, ocultoAAyuda = false, ...resto }: PropsDeChipDeTono) {
  return (
    <Chip
      {...resto}
      component="span"
      size="small"
      aria-hidden={ocultoAAyuda || undefined}
      label={label}
      sx={(th) => ({ maxWidth: '100%', bgcolor: th.palette.estado[tono].fondo, color: th.palette.estado[tono].texto, border: `1px solid ${th.palette.estado[tono].borde}`, '& .MuiChip-label': { px: 1.25 } })}
    />
  );
}
