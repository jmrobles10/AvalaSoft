/**
 * Botones de texto pequeños de la lista de documentos («Ver versiones», «Descargar», «Retirar»): texto auxiliar (`caption`) y sin relleno de bloque. Van con
 * `&&` (doble clase) porque el tema da a cada tamaño de botón su relleno, alto y tamaño de letra por ancho de pantalla, y un `sx` simple
 * pierde contra esas reglas en escritorio. En el celular el tema sigue poniendo el área táctil de 44 px (`::after`).
 */
export const BOTON_DE_TEXTO_PEQUENO = { '&&': { minWidth: 0, minHeight: 16, p: 0, typography: 'caption', lineHeight: '16px' } } as const;

/** Una acción de texto dentro de una fila de versión: igual de pequeña, con aire a los lados para separar «Descargar» de «Retirar». */
export const ACCION_DE_VERSION = { '&&': { ...BOTON_DE_TEXTO_PEQUENO['&&'], minHeight: 24, px: 0.75, typography: 'subtitle2' } } as const;
