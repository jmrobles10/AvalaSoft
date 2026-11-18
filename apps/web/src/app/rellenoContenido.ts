/**
 * Relleno del `main` de la web (unidades del tema). El encabezado fijo de cada página sube y se extiende a los lados
 * exactamente esto: si no coincide, se corre antes de fijarse o desborda la página y aparecen barras de desplazamiento
 * sin sentido. Úsese en los dos lados en vez de repetir los números.
 */
export const RELLENO_CONTENIDO = { x: 2.5, y: 2 } as const;

/**
 * Ancho máximo (px) del marco de la web. En pantallas muy anchas (ultrawide) la barra superior y el contenido no pasan de esto y se
 * centran; por debajo de este ancho no cambia nada. Lo comparten la consola de empresa y la Plataforma.
 */
export const ANCHO_MAXIMO_MARCO = 1600;

/** `sx` para una caja que ocupa todo el ancho disponible hasta `ANCHO_MAXIMO_MARCO`, centrada. */
export const ANCHO_LIMITADO = { width: '100%', maxWidth: ANCHO_MAXIMO_MARCO, mx: 'auto', boxSizing: 'border-box' } as const;

/** Relleno lateral de una barra a todo el ancho cuyo contenido debe alinearse con el marco limitado (mínimo `minimoPx`). */
export const rellenoAlineadoAlMarco = (minimoPx: number) => `max(${String(minimoPx)}px, calc((100% - ${String(ANCHO_MAXIMO_MARCO)}px) / 2 + ${String(minimoPx)}px))`;
