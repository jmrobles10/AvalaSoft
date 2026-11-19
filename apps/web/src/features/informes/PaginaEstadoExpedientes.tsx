import { Alert } from '@mui/material';
import { SCOPES } from '@validalo/api-client';
import { EstadoVacio, SeccionPlana, TablaConCursor, usePaginacionCursor } from '@validalo/ui';
import { FolderOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { usePermisos } from '../../shared/usePermisos';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { AccionesDescarga } from './AccionesDescarga';
import { useInformeEstado } from './api';
import { useColumnasEstado } from './columnas';
import { FiltrosEstadoExpedientes } from './FiltrosEstado';
import { MarcoInforme } from './MarcoInforme';
import { leerFiltrosEstado, parametrosEstado, rangoInvalido, RUTAS } from './modelo';
import { ResumenEstado } from './ResumenEstado';

const TAMANO_PAGINA = 50;

/**
 * Informe de estado de expedientes (IF-1, IF-2): totales, tiempo por fase y por área, y cada expediente con sus días en carga, con el
 * tercero y en revisión. Filtros en la URL; Excel y PDF con los mismos filtros.
 */
export function PaginaEstadoExpedientes() {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { empresa } = useEmpresaActiva();
  const puede = usePermisos(empresa.id).puede(SCOPES.expedientesLeer);
  const [parametros] = useSearchParams();
  const filtros = leerFiltrosEstado(parametros);
  const errorRango = rangoInvalido(filtros);
  const paginacion = usePaginacionCursor();
  const { reiniciar } = paginacion;
  const columnas = useColumnasEstado();
  const clave = parametros.toString();

  useEffect(() => {
    reiniciar();
  }, [clave, empresa.id, reiniciar]);

  const params = parametrosEstado(filtros);
  const consulta = useInformeEstado(empresa.id, { ...params, limite: TAMANO_PAGINA, cursor: paginacion.cursor ?? undefined }, puede && !errorRango);

  if (!puede) return <SinPermiso seccion={t('nav.informes')} />;

  const resumen = consulta.data?.resumen;
  const descargas = [
    { formato: 'excel', url: RUTAS.estadoExcel, nombre: t('informes.estado.excelNombre') },
    { formato: 'pdf', url: RUTAS.estadoPdf, nombre: t('informes.estado.pdfNombre') },
  ] as const;

  return (
    <MarcoInforme
      empresa={empresa}
      actual="estado-expedientes"
      acciones={<AccionesDescarga empresaId={empresa.id} params={params} descargas={descargas} deshabilitado={errorRango || resumen?.total === 0} />}
    >
      <FiltrosEstadoExpedientes empresaId={empresa.id} filtros={filtros} />

      {errorRango ? (
        <Alert severity="warning">{t('informes.estado.filtros.rangoInvalido')}</Alert>
      ) : (
        <>
          {/* Con error y sin datos la tabla ya da el aviso con su reintento: no se dibujan tarjetas vacías. */}
          {!(consulta.isError && !resumen) && <ResumenEstado resumen={resumen} actualizando={consulta.isPlaceholderData} />}
          <SeccionPlana titulo={t('informes.estado.seccion.titulo')} ayuda={t('informes.estado.seccion.ayuda')} icono={FolderOpen}>
            <TablaConCursor
              etiqueta={t('informes.pestanas.estado')}
              columnas={columnas}
              filas={consulta.data?.datos}
              claveFila={(f) => f.id}
              cargando={consulta.isPending || (consulta.isFetching && consulta.isPlaceholderData)}
              error={consulta.isError ? `${t('informes.estado.errorLista')} ${mensajeDeError(consulta.error, t)}` : null}
              onReintentar={() => void consulta.refetch()}
              paginacion={paginacion}
              siguienteCursor={consulta.data?.siguienteCursor}
              onFila={(f) => void navegar(`/e/${empresa.id}/expedientes/${f.id}`)}
              etiquetaFila={(f) => t('informes.estado.abrir', { folio: f.folio, tercero: f.tercero.nombre })}
              vacio={<EstadoVacio compacto titulo={t('informes.estado.vacio')} />}
            />
          </SeccionPlana>
        </>
      )}
    </MarcoInforme>
  );
}
