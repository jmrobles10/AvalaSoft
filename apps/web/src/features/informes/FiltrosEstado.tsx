import { Button } from '@mui/material';
import { SCOPES } from '@validalo/api-client';
import { CampoFecha, FiltroMenu } from '@validalo/ui';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermisos } from '../../shared/usePermisos';
import { useAreas } from '../configuracion/areas/api';
import { useFlujos } from '../flujos/api';
import { useTiposVinculo } from '../vinculos/api';
import { BarraFiltrosInforme, GrupoFechas } from './BarraFiltrosInforme';
import { CAMPOS_FECHA, ESTADOS_EXPEDIENTE, hayFiltrosEstado, rangoInvalido, TIPOS_EXPEDIENTE, type FiltrosEstado } from './modelo';
import { useFiltrosEnUrl } from './useFiltrosEnUrl';

/** Filtros del informe de estado: todo vive en la URL (se comparte el enlace y la descarga usa los mismos). */
export function FiltrosEstadoExpedientes({ empresaId, filtros }: { empresaId: string; filtros: FiltrosEstado }) {
  const { t } = useTranslation();
  const { cambiar, limpiar } = useFiltrosEnUrl();
  const permisos = usePermisos(empresaId);
  const areas = useAreas(empresaId, permisos.puede(SCOPES.configuracionLeer));
  const flujos = useFlujos(empresaId, undefined, permisos.puede(SCOPES.flujosLeer));
  const tipos = useTiposVinculo(empresaId, permisos.puede(SCOPES.configuracionLeer));
  const errorRango = rangoInvalido(filtros);

  const campoFecha = (clave: 'desde' | 'hasta') => (
    <CampoFecha
      etiqueta={t(`informes.estado.filtros.${clave}`)}
      valor={filtros[clave]}
      onCambiar={(iso) => cambiar(clave, iso)}
      error={errorRango}
      ayuda={errorRango && clave === 'hasta' ? t('informes.estado.filtros.rangoInvalido') : undefined}
      fullWidth
    />
  );

  return (
    <BarraFiltrosInforme hayFiltros={hayFiltrosEstado(filtros)} onLimpiar={limpiar}>
      <FiltroMenu
        fullWidth
        etiqueta={t('informes.estado.filtros.estado')}
        textoTodos={t('comun.todos')}
        valor={filtros.estado}
        onCambiar={(v) => cambiar('estado', v)}
        opciones={ESTADOS_EXPEDIENTE.map((e) => ({ valor: e, etiqueta: t(`informes.estado.estados.${e}`) }))}
      />
      <FiltroMenu
        fullWidth
        etiqueta={t('informes.estado.filtros.tipo')}
        textoTodos={t('comun.todos')}
        valor={filtros.tipo}
        onCambiar={(v) => cambiar('tipo', v)}
        opciones={TIPOS_EXPEDIENTE.map((e) => ({ valor: e, etiqueta: t(`informes.estado.tipos.${e}`) }))}
      />
      {areas.data && (
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.estado.filtros.area')}
          textoTodos={t('comun.todas')}
          valor={filtros.areaId}
          onCambiar={(v) => cambiar('areaId', v)}
          opciones={areas.data.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
        />
      )}
      {tipos.data && (
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.estado.filtros.tipoVinculo')}
          textoTodos={t('comun.todos')}
          valor={filtros.tipoVinculoId}
          onCambiar={(v) => cambiar('tipoVinculoId', v)}
          opciones={tipos.data.map((tv) => ({ valor: tv.id, etiqueta: tv.nombre }))}
        />
      )}
      {flujos.data && (
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.estado.filtros.flujo')}
          textoTodos={t('comun.todos')}
          valor={filtros.flujoId}
          onCambiar={(v) => cambiar('flujoId', v)}
          opciones={flujos.data.map((f) => ({ valor: f.id, etiqueta: f.nombre }))}
        />
      )}
      <FiltroMenu
        fullWidth
        etiqueta={t('informes.estado.filtros.fecha')}
        textoTodos={t('informes.estado.filtros.fechas.Apertura')}
        valor={filtros.fecha === 'Cierre' ? 'Cierre' : ''}
        onCambiar={(v) => cambiar('fecha', v)}
        opciones={CAMPOS_FECHA.filter((c) => c !== 'Apertura').map((c) => ({ valor: c, etiqueta: t(`informes.estado.filtros.fechas.${c}`) }))}
      />
      <GrupoFechas>
        {campoFecha('desde')}
        {campoFecha('hasta')}
      </GrupoFechas>
      {filtros.terceroId && (
        <Button variant="outlined" endIcon={<X size={14} aria-hidden />} onClick={() => cambiar('terceroId', '')} sx={{ justifyContent: 'space-between' }}>
          {t('informes.estado.filtros.tercero')}
        </Button>
      )}
    </BarraFiltrosInforme>
  );
}
