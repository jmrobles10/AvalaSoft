import type { SxProps, Theme } from '@mui/material';

/** Un elemento de un `sx` en forma de arreglo (lo que MUI acepta dentro de `sx={[…]}`). */
type ElementoSx = Extract<SxProps<Theme>, readonly unknown[]>[number];

/**
 * El `sx` que recibe un componente, como lista, para añadirlo al final de los estilos propios (`sx={[propios, ...sxComoLista(sx)]}`) sin que
 * los de quien lo usa se pierdan: acepta un objeto, una función o ya un arreglo, y `undefined`.
 */
export function sxComoLista(sx?: SxProps<Theme>): ElementoSx[] {
  if (sx === undefined) return [];
  return Array.isArray(sx) ? [...(sx as ElementoSx[])] : [sx as ElementoSx];
}
