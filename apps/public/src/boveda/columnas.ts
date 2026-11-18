/**
 * Las columnas de la lista de documentos de la bóveda (el encabezado de `PaginaBoveda` y cada `TarjetaDocumento` las comparten):
 * documento · estado · empresas · acciones. Desde `md` el documento manda; desde `lg` (el panel llega a 1440) la columna de empresas gana
 * espacio para que sus chips quepan en una línea y el documento conserva un mínimo para que su nombre y su línea gris no se partan.
 */
export const COLUMNAS_DOCUMENTO = {
  md: 'minmax(0, 2fr) 104px minmax(0, 1.5fr) 164px',
  lg: 'minmax(280px, 1.2fr) 140px minmax(0, 1.8fr) 184px',
} as const;
