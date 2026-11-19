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

/**
 * Estilo de la píldora de selección del tablero (las pestañas de Informes, la ventana de los indicadores de Inicio): la elegida es una píldora
 * blanca con sombra suave sobre el lienzo y el resto, texto gris que se tiñe al pasar el cursor. Se aplica a un control de MUI cuya
 * seleccionada lleva `Mui-selected` (`Tab`, `ToggleButton`). Con `claseIcono` (el ícono del control) se quita su margen y, elegida, se pinta
 * en el acento.
 */
export function sxPildora(t: Theme, claseIcono?: string) {
  return {
    minHeight: 36,
    px: 1.5,
    gap: 0.75,
    borderRadius: '10px',
    '&:hover': { bgcolor: t.palette.superficie.nivel2, color: t.palette.text.primary },
    '&.Mui-selected, &.Mui-selected:hover': {
      bgcolor: t.palette.background.paper,
      color: t.palette.text.primary,
      boxShadow: t.sombra.pildora,
      ...(claseIcono && { [`& ${claseIcono}`]: { color: t.palette.acento.main } }),
    },
    ...(claseIcono && { [`& ${claseIcono}`]: { m: 0 } }),
  };
}
