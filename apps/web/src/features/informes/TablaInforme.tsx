import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import type { ColumnaTabla } from '@validalo/ui';

/**
 * Tabla de datos de un informe, sin paginación, para ir dentro de una tarjeta sin relleno (los cortes por área, los vencidos): encabezados de
 * columna, filas con divisores finos y, si no cabe, desplazamiento dentro de la tarjeta (nunca de la página). Usa las mismas columnas que
 * `TablaConCursor`.
 */
export function TablaInforme<Fila>({
  etiqueta,
  columnas,
  filas,
  claveFila,
  anchoMinimo = 640,
}: {
  etiqueta: string;
  columnas: readonly ColumnaTabla<Fila>[];
  filas: readonly Fila[];
  claveFila: (fila: Fila) => string;
  /** Ancho (px) por debajo del cual la tabla deja de encogerse y se desplaza dentro de su tarjeta, en vez de partir el texto de las celdas. */
  anchoMinimo?: number;
}) {
  return (
    <TableContainer sx={{ '& tbody tr:last-child td': { borderBottom: 0 } }}>
      <Table size="small" aria-label={etiqueta} sx={{ minWidth: anchoMinimo }}>
        <TableHead>
          <TableRow>
            {columnas.map((c) => (
              <TableCell key={c.id} align={c.alinear} sx={{ width: c.ancho, whiteSpace: 'nowrap' }}>
                {c.encabezado}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={claveFila(fila)}>
              {columnas.map((c) => (
                <TableCell key={c.id} align={c.alinear}>
                  {c.celda(fila)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
