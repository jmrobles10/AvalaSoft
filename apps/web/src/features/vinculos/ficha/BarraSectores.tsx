import { NavegacionLateral } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { gruposDeNavegacion, type IndicadoresSector } from './gruposSectores';
import type { Sector } from './sectores';

/** Ancho de la columna de la barra en la rejilla de la ficha (`FichaVinculo`): cabe «Autorización y declaración» con su contador. */
export const ANCHO_BARRA_SECTORES = 272;

interface Props {
  actual: Sector;
  indicadores: IndicadoresSector;
  onElegir: (sector: Sector) => void;
}

/**
 * Barra lateral de la ficha del vínculo: la misma navegación agrupada de la consola de Plataforma (panel flotante, títulos de grupo en gris
 * y el sector activo como una píldora blanca con sombra suave), fija al desplazar la página y siempre del alto disponible. Cada sector muestra cuántos requisitos del
 * expediente siguen pendientes (en ámbar si alguno está observado o rechazado). Va sin el rótulo ni el control de colapsar: es una lista
 * corta que debe verse entera, así que los ítems son compactos y, si la pantalla es muy baja, la lista desplaza dentro del panel. En
 * pantallas angostas la reemplaza `SelectorSector`.
 */
export function BarraSectores({ actual, indicadores, onElegir }: Props) {
  const { t } = useTranslation();
  return (
    <NavegacionLateral
      etiqueta={t('vinculos.ficha.sectores')}
      grupos={gruposDeNavegacion(t, actual, indicadores, onElegir)}
      densidad="compacta"
      sx={{
        width: '100%',
        position: 'sticky',
        // Pegada a la misma distancia del encabezado fijo que su lugar natural (el margen de 4 px del encabezado): al cambiar de sector no salta,
        // tenga o no scroll el contenido.
        top: 'calc(var(--vs-tope, 0px) + var(--vs-alto-encabezado, 96px) + 4px)',
        alignSelf: 'start',
        // Siempre todo el alto disponible bajo el encabezado, sin importar el sector: solo cambia el contenido de la derecha. Si los
        // sectores no caben, la lista desplaza dentro del panel.
        height: 'calc(100dvh - var(--vs-tope, 0px) - var(--vs-alto-encabezado, 96px) - 4px - 16px)',
        // En pantallas muy bajas deja de fijarse: un solo scroll, el de la página.
        '@media (max-height: 640px)': { position: 'static', height: 'auto' },
      }}
    />
  );
}
