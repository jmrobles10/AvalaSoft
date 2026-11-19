import { Box } from '@mui/material';
import { coloresDeKpi, type TonoKpi } from './tarjetas';

export interface SegmentoBarra {
  clave: string;
  valor: number;
  tono: TonoKpi;
}

/**
 * Barra apilada: reparte un total entre varios segmentos del ancho de la barra (el tiempo de un expediente en cada fase). Es una imagen con su
 * descripción en `etiqueta`: el color no es el único dato, así que quien la use debe poner al lado la leyenda con los valores. Un segmento en
 * cero no se dibuja; si no hay nada que repartir queda la pista vacía.
 */
export function BarraSegmentada({ segmentos, etiqueta, alto = 10 }: { segmentos: readonly SegmentoBarra[]; etiqueta: string; alto?: number }) {
  const conValor = segmentos.filter((s) => s.valor > 0);
  return (
    <Box
      role="img"
      aria-label={etiqueta}
      sx={(t) => ({ display: 'flex', gap: '2px', height: alto, borderRadius: `${String(alto / 2)}px`, overflow: 'hidden', bgcolor: t.palette.superficie.nivel2 })}
    >
      {conValor.map((s) => (
        <Box key={s.clave} data-segmento={s.clave} sx={(t) => ({ flex: `${String(s.valor)} 1 0`, minWidth: 4, bgcolor: coloresDeKpi(t, s.tono).solido })} />
      ))}
    </Box>
  );
}

/**
 * Barra horizontal de una medida contra un tope común (`maximo`: la más grande del conjunto, para que las barras se comparen entre sí). El
 * relleno llega hasta `valor`; `marca` dibuja una raya vertical en otro punto del mismo eje (el máximo del propio grupo). Es una imagen con su
 * descripción en `etiqueta`; las cifras van aparte, en texto.
 */
export function BarraMedida({ valor, maximo, marca, tono = 'cian', etiqueta }: { valor: number; maximo: number; marca?: number; tono?: TonoKpi; etiqueta: string }) {
  const porcentaje = (n: number) => (maximo > 0 ? Math.max(0, Math.min(100, (n / maximo) * 100)) : 0);
  return (
    <Box role="img" aria-label={etiqueta} sx={(t) => ({ position: 'relative', height: 8, borderRadius: '4px', bgcolor: coloresDeKpi(t, tono).fondo })}>
      <Box sx={(t) => ({ width: `${String(porcentaje(valor))}%`, height: '100%', borderRadius: '4px', bgcolor: coloresDeKpi(t, tono).solido })} />
      {marca !== undefined && (
        <Box
          data-marca=""
          sx={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${String(porcentaje(marca))}% - 1px)`, width: 2, borderRadius: '1px', bgcolor: 'text.secondary' }}
        />
      )}
    </Box>
  );
}
