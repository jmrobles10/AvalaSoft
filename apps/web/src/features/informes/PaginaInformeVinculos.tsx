import { SCOPES } from '@validalo/api-client';
import { EstadoVacio, FiltroMenu, MiniBarra, SeccionPlana, TablaConCursor, tonoDeAlerta, usePaginacionCursor } from '@validalo/ui';
import { CalendarX, ClipboardList, Clock, ShieldCheck, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { ResumenKpis, type KpiResumen } from '../../shared/ResumenKpis';
import { usePermisos } from '../../shared/usePermisos';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { useTiposVinculo } from '../vinculos/api';
import { AccionesDescarga } from './AccionesDescarga';
import { useInformeVinculos } from './api';
import { BarraFiltrosInforme } from './BarraFiltrosInforme';
import { useColumnasVinculos } from './columnas';
import { MarcoInforme } from './MarcoInforme';
import { ESTADOS_VINCULO, leerFiltrosVinculos, parametrosVinculos, RUTAS } from './modelo';
import { useFiltrosEnUrl } from './useFiltrosEnUrl';

const TAMANO_PAGINA = 50;

/**
 * Informe de terceros y vínculos (IF-1): estado de cada vínculo, certificado, expediente en curso, vencimientos de sus
 * documentos y secciones de la ficha por validar. Se descarga en Excel con los mismos filtros.
 */
export function PaginaInformeVinculos() {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puede = permisos.puede(SCOPES.vinculosLeer);
  const [parametros] = useSearchParams();
  const { cambiar, limpiar } = useFiltrosEnUrl();
  const filtros = leerFiltrosVinculos(parametros);
  const paginacion = usePaginacionCursor();
  const { reiniciar } = paginacion;
  const columnas = useColumnasVinculos();
  const tipos = useTiposVinculo(empresa.id, permisos.puede(SCOPES.configuracionLeer));

  useEffect(() => {
    reiniciar();
  }, [filtros.estado, filtros.tipoVinculoId, empresa.id, reiniciar]);

  const params = parametrosVinculos(filtros);
  const consulta = useInformeVinculos(empresa.id, { ...params, limite: TAMANO_PAGINA, cursor: paginacion.cursor ?? undefined }, puede);

  if (!puede) return <SinPermiso seccion={t('nav.informes')} />;

  const resumen = consulta.data?.resumen;
  const kpis: KpiResumen[] | undefined = resumen && [
    { clave: 'total', icono: Users, tono: 'cian', titulo: t('informes.vinculos.kpi.total'), valor: String(resumen.total), detalle: t('informes.vinculos.kpi.totalDetalle') },
    {
      clave: 'certificado',
      icono: ShieldCheck,
      tono: 'verde',
      titulo: t('informes.vinculos.kpi.certificado'),
      valor: String(resumen.conCertificadoVigente),
      detalle: t('informes.vinculos.kpi.certificadoDetalle'),
      grafica: (
        <MiniBarra
          valor={resumen.conCertificadoVigente}
          total={resumen.total}
          tono="verde"
          etiqueta={t('informes.vinculos.kpi.certificadoBarra', { conCertificado: String(resumen.conCertificadoVigente), total: String(resumen.total) })}
        />
      ),
    },
    { clave: 'porVencer', icono: Clock, tono: 'ambar', titulo: t('informes.vinculos.kpi.porVencer'), valor: String(resumen.conDocumentosPorVencer), detalle: t('informes.vinculos.kpi.porVencerDetalle') },
    {
      clave: 'vencidos',
      icono: CalendarX,
      tono: tonoDeAlerta(resumen.conDocumentosVencidos),
      titulo: t('informes.vinculos.kpi.vencidos'),
      valor: String(resumen.conDocumentosVencidos),
      detalle: t('informes.vinculos.kpi.vencidosDetalle'),
    },
    { clave: 'secciones', icono: ClipboardList, tono: 'violeta', titulo: t('informes.vinculos.kpi.secciones'), valor: String(resumen.conSeccionesPendientes), detalle: t('informes.vinculos.kpi.seccionesDetalle') },
  ];

  return (
    <MarcoInforme
      empresa={empresa}
      actual="vinculos"
      acciones={<AccionesDescarga empresaId={empresa.id} params={params} descargas={[{ formato: 'excel', url: RUTAS.vinculosExcel, nombre: t('informes.vinculos.excelNombre') }]} deshabilitado={resumen?.total === 0} />}
    >
      <BarraFiltrosInforme hayFiltros={Boolean(filtros.estado || filtros.tipoVinculoId)} onLimpiar={limpiar}>
        <FiltroMenu
          fullWidth
          etiqueta={t('informes.vinculos.filtros.estado')}
          textoTodos={t('comun.todos')}
          valor={filtros.estado}
          onCambiar={(v) => cambiar('estado', v)}
          opciones={ESTADOS_VINCULO.map((e) => ({ valor: e, etiqueta: t(`informes.vinculos.estados.${e}`) }))}
        />
        {tipos.data && (
          <FiltroMenu
            fullWidth
            etiqueta={t('informes.vinculos.filtros.tipoVinculo')}
            textoTodos={t('comun.todos')}
            valor={filtros.tipoVinculoId}
            onCambiar={(v) => cambiar('tipoVinculoId', v)}
            opciones={tipos.data.map((tv) => ({ valor: tv.id, etiqueta: tv.nombre }))}
          />
        )}
      </BarraFiltrosInforme>

      {!(consulta.isError && !resumen) && <ResumenKpis etiqueta={t('informes.vinculos.kpi.etiqueta')} kpis={kpis} actualizando={consulta.isPlaceholderData} />}

      <SeccionPlana titulo={t('informes.vinculos.seccion.titulo')} ayuda={t('informes.vinculos.seccion.ayuda')} icono={Users}>
        <TablaConCursor
          etiqueta={t('informes.pestanas.vinculos')}
          columnas={columnas}
          filas={consulta.data?.datos}
          claveFila={(f) => f.vinculoId}
          cargando={consulta.isPending || (consulta.isFetching && consulta.isPlaceholderData)}
          error={consulta.isError ? `${t('informes.vinculos.errorLista')} ${mensajeDeError(consulta.error, t)}` : null}
          onReintentar={() => void consulta.refetch()}
          paginacion={paginacion}
          siguienteCursor={consulta.data?.siguienteCursor}
          onFila={(f) => void navegar(`/e/${empresa.id}/vinculos/${f.vinculoId}`)}
          etiquetaFila={(f) => t('informes.vinculos.abrir', { tercero: f.tercero.nombre })}
          vacio={<EstadoVacio compacto titulo={t('informes.vinculos.vacio')} />}
        />
      </SeccionPlana>
    </MarcoInforme>
  );
}
