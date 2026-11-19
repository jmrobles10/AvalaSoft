import { columnasKpi, EsqueletoKpis, GrillaKpi, TarjetaKpi, type TonoKpi } from '@validalo/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

/**
 * Una tarjeta del resumen de una pantalla: su rótulo corto, la cifra y, debajo, un detalle y una mini barra si hay una proporción. Con `a` la
 * tarjeta entera es un enlace a esa ruta (sin `a`, o `null`, es solo una cifra).
 */
export interface KpiResumen {
  clave: string;
  icono: LucideIcon;
  tono: TonoKpi;
  titulo: string;
  valor: string;
  detalle?: string;
  grafica?: ReactNode;
  a?: string | null;
}

/**
 * Fila de tarjetas con las cifras principales de una pantalla (el mismo lenguaje del tablero de la consola): los informes y el inicio. Las
 * columnas de pantallas anchas salen de cuántas tarjetas hay (`columnasKpi`). Sin `kpis` (la consulta carga) dibuja los esqueletos con la forma
 * de las tarjetas (`cantidadEsqueleto` de ellas); `actualizando` atenúa las cifras anteriores mientras llegan las de los filtros nuevos.
 * Con `etiqueta` la fila es una región con nombre.
 */
export function ResumenKpis({
  etiqueta,
  kpis,
  actualizando = false,
  cantidadEsqueleto = 5,
}: {
  etiqueta?: string;
  kpis: readonly KpiResumen[] | undefined;
  actualizando?: boolean;
  cantidadEsqueleto?: number;
}) {
  if (!kpis) return <EsqueletoKpis etiqueta={etiqueta} cantidad={cantidadEsqueleto} />;
  return (
    <GrillaKpi columnas={columnasKpi(kpis.length)} etiqueta={etiqueta} ocupada={actualizando} sx={{ opacity: actualizando ? 0.6 : 1, transition: 'opacity 120ms' }}>
      {kpis.map((k) => (
        <TarjetaKpi key={k.clave} icono={k.icono} tono={k.tono} titulo={k.titulo} valor={k.valor} detalle={k.detalle} grafica={k.grafica} {...(k.a ? { componente: RouterLink, to: k.a } : {})} />
      ))}
    </GrillaKpi>
  );
}
