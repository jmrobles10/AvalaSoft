import { SCOPES } from '@validalo/api-client';
import { EstadoVacio, FiltroMenu, MiniBarra, SeccionPlana, TablaConCursor, usePaginacionCursor } from '@validalo/ui';
import { CircleCheck, CircleX, ClipboardCheck, Gauge, Hourglass } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { usePermisos } from '../../shared/usePermisos';
import { useCuestionarios, useInformeEvaluaciones } from '../evaluaciones/api';
import { formatearPuntaje } from '../evaluaciones/modelo';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { AccionesDescarga } from './AccionesDescarga';
import { BarraFiltrosInforme } from './BarraFiltrosInforme';
import { useColumnasEvaluaciones } from './columnas';
import { MarcoInforme } from './MarcoInforme';
import { RUTAS, tonoDeAlerta } from './modelo';
import { ResumenKpis, type KpiInforme } from './ResumenKpis';
import { useFiltrosEnUrl } from './useFiltrosEnUrl';

const TAMANO_PAGINA = 50;
const ESTADOS = ['Pendiente', 'Calificada', 'Vencida', 'Anulada'] as const;

/**
 * Informe de evaluaciones por proveedor (CE-12): el puntaje, el veredicto, quién respondió y cuándo de cada evaluación de la empresa, con su resumen y un Excel (evaluaciones,
 * detalle pregunta por pregunta y resumen) con los mismos filtros. Es privado de la empresa; cada descarga queda en la auditoría de accesos.
 */
export function PaginaInformeEvaluaciones() {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puede = permisos.puede(SCOPES.evaluacionesLeer);
  const [parametros] = useSearchParams();
  const { cambiar, limpiar } = useFiltrosEnUrl();
  const estado = parametros.get('estado') ?? '';
  const cuestionarioId = parametros.get('cuestionarioId') ?? '';
  const paginacion = usePaginacionCursor();
  const { reiniciar } = paginacion;
  const columnas = useColumnasEvaluaciones();
  const cuestionarios = useCuestionarios(empresa.id, permisos.puede(SCOPES.cuestionariosLeer));

  useEffect(() => {
    reiniciar();
  }, [estado, cuestionarioId, empresa.id, reiniciar]);

  const filtros = { ...(estado ? { estado } : {}), ...(cuestionarioId ? { cuestionarioId } : {}) };
  const consulta = useInformeEvaluaciones(empresa.id, { ...filtros, limite: TAMANO_PAGINA, cursor: paginacion.cursor ?? undefined }, puede);

  if (!puede) return <SinPermiso seccion={t('nav.informes')} />;

  const resumen = consulta.data?.resumen;
  const calificadas = resumen ? resumen.aprobadas + resumen.reprobadas : 0;
  const kpis: KpiInforme[] | undefined = resumen && [
    { clave: 'total', icono: ClipboardCheck, tono: 'cian', titulo: t('evaluaciones.informe.resumen.total'), valor: String(resumen.total), detalle: t('informes.evaluaciones.kpi.totalDetalle') },
    { clave: 'pendientes', icono: Hourglass, tono: 'ambar', titulo: t('evaluaciones.informe.resumen.pendientes'), valor: String(resumen.pendientes), detalle: t('informes.evaluaciones.kpi.pendientesDetalle') },
    {
      clave: 'aprobadas',
      icono: CircleCheck,
      tono: 'verde',
      titulo: t('evaluaciones.informe.resumen.aprobadas'),
      valor: String(resumen.aprobadas),
      detalle: t('informes.evaluaciones.kpi.aprobadasDetalle', { calificadas: String(calificadas) }),
      grafica: <MiniBarra valor={resumen.aprobadas} total={calificadas} tono="verde" etiqueta={t('informes.evaluaciones.kpi.aprobadasBarra', { aprobadas: String(resumen.aprobadas), calificadas: String(calificadas) })} />,
    },
    { clave: 'reprobadas', icono: CircleX, tono: tonoDeAlerta(resumen.reprobadas), titulo: t('evaluaciones.informe.resumen.reprobadas'), valor: String(resumen.reprobadas), detalle: t('informes.evaluaciones.kpi.reprobadasDetalle') },
    { clave: 'promedio', icono: Gauge, tono: 'violeta', titulo: t('evaluaciones.informe.resumen.promedio'), valor: formatearPuntaje(resumen.puntajePromedio), detalle: t('informes.evaluaciones.kpi.promedioDetalle') },
  ];

  return (
    <MarcoInforme
      empresa={empresa}
      actual="evaluaciones"
      acciones={<AccionesDescarga empresaId={empresa.id} params={filtros} descargas={[{ formato: 'excel', url: RUTAS.evaluacionesExcel, nombre: t('evaluaciones.informe.excelNombre') }]} deshabilitado={resumen?.total === 0} />}
    >
      <BarraFiltrosInforme hayFiltros={Boolean(estado || cuestionarioId)} onLimpiar={limpiar}>
        <FiltroMenu
          fullWidth
          etiqueta={t('evaluaciones.lista.filtroEstado')}
          textoTodos={t('comun.todos')}
          valor={estado}
          onCambiar={(v) => cambiar('estado', v)}
          opciones={ESTADOS.map((e) => ({ valor: e, etiqueta: t(`evaluaciones.estados.${e}`) }))}
        />
        {cuestionarios.data && cuestionarios.data.length > 0 && (
          <FiltroMenu
            fullWidth
            etiqueta={t('evaluaciones.informe.filtroCuestionario')}
            textoTodos={t('comun.todos')}
            valor={cuestionarioId}
            onCambiar={(v) => cambiar('cuestionarioId', v)}
            opciones={cuestionarios.data.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
        )}
      </BarraFiltrosInforme>

      {!(consulta.isError && !resumen) && <ResumenKpis etiqueta={t('informes.evaluaciones.kpi.etiqueta')} kpis={kpis} actualizando={consulta.isPlaceholderData} />}

      <SeccionPlana titulo={t('informes.evaluaciones.seccion.titulo')} ayuda={t('informes.evaluaciones.seccion.ayuda')} icono={ClipboardCheck}>
        <TablaConCursor
          etiqueta={t('informes.pestanas.evaluaciones')}
          columnas={columnas}
          filas={consulta.data?.filas}
          claveFila={(f) => f.id}
          cargando={consulta.isPending || (consulta.isFetching && consulta.isPlaceholderData)}
          error={consulta.isError ? `${t('evaluaciones.informe.errorLista')} ${mensajeDeError(consulta.error, t)}` : null}
          onReintentar={() => void consulta.refetch()}
          paginacion={paginacion}
          siguienteCursor={consulta.data?.siguienteCursor}
          onFila={(f) => void navegar(`/e/${empresa.id}/evaluaciones/${f.id}`)}
          etiquetaFila={(f) => t('evaluaciones.lista.abrir', { tercero: f.tercero.nombre, cuestionario: f.cuestionario })}
          vacio={<EstadoVacio compacto titulo={t('evaluaciones.informe.vacio')} />}
        />
      </SeccionPlana>
    </MarcoInforme>
  );
}
