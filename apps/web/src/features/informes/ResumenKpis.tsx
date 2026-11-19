import { EsqueletoKpis, GrillaKpi, TarjetaKpi, type TonoKpi } from '@validalo/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Una tarjeta del resumen de un informe: su rótulo corto, la cifra y, debajo, un detalle y una mini barra si hay una proporción. */
export interface KpiInforme {
  clave: string;
  icono: LucideIcon;
  tono: TonoKpi;
  titulo: string;
  valor: string;
  detalle?: string;
  grafica?: ReactNode;
}

/**
 * Fila de tarjetas con las cifras principales de un informe (el mismo lenguaje del tablero de la consola). Sin `kpis` (la consulta carga)
 * dibuja los esqueletos con la forma de las tarjetas; `actualizando` atenúa las cifras anteriores mientras llegan las de los filtros nuevos.
 */
export function ResumenKpis({ etiqueta, kpis, actualizando = false }: { etiqueta: string; kpis: readonly KpiInforme[] | undefined; actualizando?: boolean }) {
  if (!kpis) return <EsqueletoKpis etiqueta={etiqueta} cantidad={5} />;
  return (
    <GrillaKpi
      columnas={kpis.length === 4 ? 4 : 5}
      etiqueta={etiqueta}
      ocupada={actualizando}
      sx={{ opacity: actualizando ? 0.6 : 1, transition: 'opacity 120ms' }}
    >
      {kpis.map((k) => (
        <TarjetaKpi key={k.clave} icono={k.icono} tono={k.tono} titulo={k.titulo} valor={k.valor} detalle={k.detalle} grafica={k.grafica} />
      ))}
    </GrillaKpi>
  );
}
