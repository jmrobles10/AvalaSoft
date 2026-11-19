import type { GrupoNavegacion } from '@avalasoft/ui';
import type { TFunction } from 'i18next';
import { ICONO_SECTOR, type IndicadorSector, type Sector } from './sectores';

export type IndicadoresSector = Partial<Record<Sector, IndicadorSector>>;

/**
 * Grupos de la navegación por sectores: el proceso en curso, la información del tercero (con los sectores y el orden de la ficha del
 * proveedor del SRM) y el registro de lo que ya pasó. La barra lateral y el selector de pantallas angostas los muestran igual.
 */
export const GRUPOS_SECTORES: readonly { clave: 'proceso' | 'informacion' | 'registro'; sectores: readonly Sector[] }[] = [
  { clave: 'proceso', sectores: ['aprobaciones'] },
  { clave: 'informacion', sectores: ['general', 'sst', 'cuenta', 'tributaria', 'financiera', 'contactos', 'autorizacion', 'legal', 'cumplimiento'] },
  { clave: 'registro', sectores: ['documentos', 'evaluaciones', 'certificado', 'historial'] },
];

/** Nombre accesible de un sector: el nombre y, si el expediente aún le pide algo, cuántos requisitos siguen pendientes. */
export function nombreAccesibleDeSector(t: TFunction, sector: Sector, indicador: IndicadorSector | undefined): string {
  const nombre = t(`vinculos.ficha.sector.${sector}`);
  const pendientes = indicador?.pendientes ?? 0;
  return pendientes > 0 ? t('vinculos.ficha.conPendientes', { sector: nombre, count: pendientes }) : nombre;
}

/** Los grupos como los espera `NavegacionLateral`: cada sector es un botón (el sector va en la URL, no es una ruta) con su contador de pendientes. */
export function gruposDeNavegacion(t: TFunction, actual: Sector, indicadores: IndicadoresSector, onElegir: (sector: Sector) => void): GrupoNavegacion[] {
  return GRUPOS_SECTORES.map((grupo) => ({
    clave: grupo.clave,
    titulo: t(`vinculos.ficha.grupos.${grupo.clave}`),
    items: grupo.sectores.map((sector) => {
      const indicador = indicadores[sector];
      return {
        clave: sector,
        texto: t(`vinculos.ficha.sector.${sector}`),
        icono: ICONO_SECTOR[sector],
        onSeleccionar: () => onElegir(sector),
        activo: sector === actual,
        contador: indicador?.pendientes ?? 0,
        tonoContador: indicador?.conProblema ? ('advertencia' as const) : ('neutro' as const),
        etiquetaAccesible: nombreAccesibleDeSector(t, sector, indicador),
      };
    }),
  }));
}
