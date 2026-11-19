import { SCOPES } from '@validalo/api-client';
import { CampoFecha, FiltroMenu } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { usePermisos } from '../../shared/usePermisos';
import { useAreas } from '../configuracion/areas/api';
import { useTiposVinculo } from '../vinculos/api';
import { BarraFiltrosInforme, GrupoFechas } from './BarraFiltrosInforme';
import { rangoInvalido } from './modelo';
import { hayFiltrosSla, type FiltrosSla } from './modeloSla';
import { useFiltrosEnUrl } from './useFiltrosEnUrl';

/** Filtros del informe de cumplimiento del plazo de revisión: todo vive en la URL (el Excel lleva los mismos). */
export function FiltrosInformeSla({ empresaId, filtros }: { empresaId: string; filtros: FiltrosSla }) {
  const { t } = useTranslation();
  const { cambiar, limpiar } = useFiltrosEnUrl();
  const permisos = usePermisos(empresaId);
  const areas = useAreas(empresaId, permisos.puede(SCOPES.configuracionLeer));
  const tipos = useTiposVinculo(empresaId, permisos.puede(SCOPES.configuracionLeer));
  const errorRango = rangoInvalido(filtros);

  const campoFecha = (clave: 'desde' | 'hasta') => (
    <CampoFecha
      etiqueta={t(`informes.sla.filtros.${clave}`)}
      valor={filtros[clave]}
      onCambiar={(iso) => cambiar(clave, iso)}
      error={errorRango}
      ayuda={errorRango && clave === 'hasta' ? t('informes.sla.filtros.rangoInvalido') : undefined}
      fullWidth
    />
  );

  return (
    <BarraFiltrosInforme hayFiltros={hayFiltrosSla(filtros)} onLimpiar={limpiar}>
      {areas.data && (
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.sla.filtros.area')}
          textoTodos={t('comun.todas')}
          valor={filtros.areaId}
          onCambiar={(v) => cambiar('areaId', v)}
          opciones={areas.data.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
        />
      )}
      {tipos.data && (
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.sla.filtros.tipoVinculo')}
          textoTodos={t('comun.todos')}
          valor={filtros.tipoVinculoId}
          onCambiar={(v) => cambiar('tipoVinculoId', v)}
          opciones={tipos.data.map((tv) => ({ valor: tv.id, etiqueta: tv.nombre }))}
        />
      )}
      <GrupoFechas>
        {campoFecha('desde')}
        {campoFecha('hasta')}
      </GrupoFechas>
    </BarraFiltrosInforme>
  );
}
