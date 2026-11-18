import { Box, Button, Typography } from '@mui/material';
import { SCOPES, type FilaInformeEvaluacionDto } from '@avalasoft/api-client';
import { BarraFiltros, EstadoVacio, FiltroMenu, formatearFecha, TablaConCursor, usePaginacionCursor, type ColumnaTabla } from '@avalasoft/ui';
import { Download } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { EncabezadoPagina, SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { usePermisos } from '../../shared/usePermisos';
import { useCuestionarios, useInformeEvaluaciones } from '../evaluaciones/api';
import { formatearPuntaje, textoDeMotivo } from '../evaluaciones/modelo';
import { ChipEvaluacion } from '../evaluaciones/PaginaEvaluaciones';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { Cifra, GrupoCifras } from '../inicio/Cifras';
import { guardarArchivo } from '../vencimientos/api';
import { useDescarga } from './api';
import { PestanasInformes } from './PestanasInformes';

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
  const mostrar = useAvisos((s) => s.mostrar);
  const [parametros, setParametros] = useSearchParams();
  const estado = parametros.get('estado') ?? '';
  const cuestionarioId = parametros.get('cuestionarioId') ?? '';
  const paginacion = usePaginacionCursor();
  const { reiniciar } = paginacion;
  const descarga = useDescarga(empresa.id);
  const cuestionarios = useCuestionarios(empresa.id, permisos.puede(SCOPES.cuestionariosLeer));

  useEffect(() => {
    reiniciar();
  }, [estado, cuestionarioId, empresa.id, reiniciar]);

  const filtros = { ...(estado ? { estado } : {}), ...(cuestionarioId ? { cuestionarioId } : {}) };
  const consulta = useInformeEvaluaciones(empresa.id, { ...filtros, limite: TAMANO_PAGINA, cursor: paginacion.cursor ?? undefined }, puede);

  const columnas = useMemo<ColumnaTabla<FilaInformeEvaluacionDto>[]>(
    () => [
      {
        id: 'tercero',
        encabezado: t('evaluaciones.lista.columnas.tercero'),
        celda: (f) => (
          <>
            <Typography component="span" sx={{ display: 'block', fontWeight: 500 }}>
              {f.tercero.nombre}
            </Typography>
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
              {f.folio ?? t(`evaluaciones.motivo.${f.motivo}`)}
            </Typography>
          </>
        ),
      },
      {
        id: 'cuestionario',
        encabezado: t('evaluaciones.lista.columnas.cuestionario'),
        celda: (f) => `${f.cuestionario} · ${t('evaluaciones.cuestionarios.version', { version: String(f.versionCuestionario) })}`,
      },
      { id: 'estado', encabezado: t('evaluaciones.lista.columnas.estado'), ancho: 150, celda: (f) => <ChipEvaluacion estado={f.estado} aprobada={f.aprobada} /> },
      { id: 'puntaje', encabezado: t('evaluaciones.lista.columnas.puntaje'), ancho: 90, alinear: 'right', celda: (f) => <Typography variant="monoTabla">{formatearPuntaje(f.puntaje)}</Typography> },
      {
        id: 'motivos',
        encabezado: t('evaluaciones.informe.columnas.motivos'),
        celda: (f) => f.motivos.map((m) => textoDeMotivo(m, t)).join(', ') || '—',
      },
      { id: 'respondida', encabezado: t('evaluaciones.informe.columnas.respondida'), ancho: 130, celda: (f) => (f.respondidaEn ? <Typography variant="monoTabla">{formatearFecha(f.respondidaEn)}</Typography> : '—') },
    ],
    [t],
  );

  if (!puede) return <SinPermiso seccion={t('nav.informes')} />;

  const cambiar = (clave: 'estado' | 'cuestionarioId', valor: string) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
        return nuevos;
      },
      { replace: true },
    );
  const descargar = () =>
    descarga.mutate(
      { url: '/api/v1/informes/evaluaciones/excel', params: filtros },
      {
        onSuccess: (archivo) => guardarArchivo(archivo, t('evaluaciones.informe.excelNombre')),
        onError: (error) => mostrar(`${t('informes.descargaError')} ${mensajeDeError(error, t)}`, 'error'),
      },
    );
  const resumen = consulta.data?.resumen;

  return (
    <>
      <EncabezadoPagina
        titulo={t('informes.titulo')}
        subtitulo={t('informes.subtitulo', { empresa: empresa.nombre })}
        acciones={
          <Button variant="outlined" startIcon={<Download size={16} aria-hidden />} disabled={descarga.isPending || resumen?.total === 0} onClick={descargar}>
            {t('informes.excel')}
          </Button>
        }
      />
      <PestanasInformes empresaId={empresa.id} actual="evaluaciones" />
      <BarraFiltros>
        <FiltroMenu
          etiqueta={t('evaluaciones.lista.filtroEstado')}
          textoTodos={t('comun.todos')}
          valor={estado}
          onCambiar={(v) => cambiar('estado', v)}
          opciones={ESTADOS.map((e) => ({ valor: e, etiqueta: t(`evaluaciones.estados.${e}`) }))}
        />
        {cuestionarios.data && cuestionarios.data.length > 0 && (
          <FiltroMenu
            etiqueta={t('evaluaciones.informe.filtroCuestionario')}
            textoTodos={t('comun.todos')}
            valor={cuestionarioId}
            onCambiar={(v) => cambiar('cuestionarioId', v)}
            opciones={cuestionarios.data.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          />
        )}
      </BarraFiltros>

      {resumen && (
        <Box sx={{ mb: 2 }}>
          <GrupoCifras titulo={t('informes.estado.resumen.titulo')}>
            <Cifra etiqueta={t('evaluaciones.informe.resumen.total')} valor={String(resumen.total)} />
            <Cifra etiqueta={t('evaluaciones.informe.resumen.pendientes')} valor={String(resumen.pendientes)} />
            <Cifra etiqueta={t('evaluaciones.informe.resumen.aprobadas')} valor={String(resumen.aprobadas)} />
            <Cifra etiqueta={t('evaluaciones.informe.resumen.reprobadas')} valor={String(resumen.reprobadas)} />
            <Cifra etiqueta={t('evaluaciones.informe.resumen.promedio')} valor={formatearPuntaje(resumen.puntajePromedio)} />
          </GrupoCifras>
        </Box>
      )}

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
    </>
  );
}
