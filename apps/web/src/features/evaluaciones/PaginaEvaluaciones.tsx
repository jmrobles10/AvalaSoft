import { Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SCOPES, type EvaluacionResumenDto } from '@validalo/api-client';
import { EstadoVacio, formatearFecha, TablaConCursor, usePaginacionCursor, type ColumnaTabla } from '@validalo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { EncabezadoPagina, SinPermiso } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { usePermisos } from '../../shared/usePermisos';
import { useEmpresaActiva } from '../empresas/useEmpresas';
import { useEvaluaciones } from './api';
import { colorDeEstado, formatearPuntaje } from './modelo';

const TAMANO_PAGINA = 25;
const ESTADOS = ['Pendiente', 'Calificada', 'Vencida', 'Anulada'] as const;
const RESPONDEN = ['Tercero', 'Evaluador'] as const;

/** Chip de estado de una evaluación: sin responder, calificada (aprobada o reprobada), vencida o anulada. */
export function ChipEvaluacion({ estado, aprobada }: { estado: EvaluacionResumenDto['estado']; aprobada: boolean | null | undefined }) {
  const { t } = useTranslation();
  const etiqueta = estado === 'Calificada' ? t(aprobada ? 'evaluaciones.veredicto.aprobada' : 'evaluaciones.veredicto.reprobada') : t(`evaluaciones.estados.${estado}`);
  return <Chip size="small" color={colorDeEstado(estado, aprobada)} variant={estado === 'Calificada' || estado === 'Pendiente' ? 'filled' : 'outlined'} label={etiqueta} />;
}

/** Evaluaciones de proveedores de la empresa (CE-3): las que pidió el flujo, las de la reevaluación periódica y las asignadas a mano; con sus filtros por estado y por quién responde. */
export function PaginaEvaluaciones() {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puede = permisos.puede(SCOPES.evaluacionesLeer);
  const paginacion = usePaginacionCursor();
  const [estado, setEstado] = useState('Pendiente');
  const [responde, setResponde] = useState('');
  const consulta = useEvaluaciones(empresa.id, { estado: estado || undefined, responde: responde || undefined, limite: TAMANO_PAGINA, cursor: paginacion.cursor ?? undefined }, puede);

  const columnas = useMemo<ColumnaTabla<EvaluacionResumenDto>[]>(
    () => [
      {
        id: 'tercero',
        encabezado: t('evaluaciones.lista.columnas.tercero'),
        celda: (e) => (
          <>
            <Typography component="span" sx={{ display: 'block', fontWeight: 500 }}>
              {e.tercero.nombre}
            </Typography>
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
              {e.folio ?? t(`evaluaciones.motivo.${e.motivo}`)}
            </Typography>
          </>
        ),
      },
      {
        id: 'cuestionario',
        encabezado: t('evaluaciones.lista.columnas.cuestionario'),
        celda: (e) => (
          <>
            <Typography component="span" sx={{ display: 'block' }}>
              {e.cuestionario}
            </Typography>
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
              {t('evaluaciones.cuestionarios.version', { version: String(e.versionCuestionario) })} · {t(`evaluaciones.responde.${e.responde}`)}
            </Typography>
          </>
        ),
      },
      { id: 'estado', encabezado: t('evaluaciones.lista.columnas.estado'), ancho: 150, celda: (e) => <ChipEvaluacion estado={e.estado} aprobada={e.aprobada} /> },
      {
        id: 'puntaje',
        encabezado: t('evaluaciones.lista.columnas.puntaje'),
        ancho: 100,
        alinear: 'right',
        celda: (e) => <Typography variant="monoTabla">{formatearPuntaje(e.puntaje)}</Typography>,
      },
      { id: 'asignada', encabezado: t('evaluaciones.lista.columnas.asignada'), ancho: 110, celda: (e) => <Typography variant="monoTabla">{formatearFecha(e.asignadaEn)}</Typography> },
    ],
    [t],
  );

  if (!puede) return <SinPermiso seccion={t('nav.evaluaciones')} />;

  return (
    <>
      <EncabezadoPagina titulo={t('evaluaciones.lista.titulo')} subtitulo={t('evaluaciones.lista.subtitulo', { empresa: empresa.nombre })} />
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label={t('evaluaciones.lista.filtroEstado')}
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            paginacion.reiniciar();
          }}
          sx={{ width: 200 }}
        >
          <MenuItem value="">{t('evaluaciones.lista.todos')}</MenuItem>
          {ESTADOS.map((x) => (
            <MenuItem key={x} value={x}>
              {t(`evaluaciones.estados.${x}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('evaluaciones.lista.filtroResponde')}
          value={responde}
          onChange={(e) => {
            setResponde(e.target.value);
            paginacion.reiniciar();
          }}
          sx={{ width: 280 }}
        >
          <MenuItem value="">{t('evaluaciones.lista.todos')}</MenuItem>
          {RESPONDEN.map((x) => (
            <MenuItem key={x} value={x}>
              {t(`evaluaciones.responde.${x}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <TablaConCursor
        etiqueta={t('evaluaciones.lista.titulo')}
        columnas={columnas}
        filas={consulta.data?.datos}
        claveFila={(e) => e.id}
        filasAltas
        cargando={consulta.isPending}
        error={consulta.isError ? mensajeDeError(consulta.error, t) : null}
        onReintentar={() => void consulta.refetch()}
        paginacion={paginacion}
        siguienteCursor={consulta.data?.siguienteCursor}
        onFila={(e) => void navegar(`/e/${empresa.id}/evaluaciones/${e.id}`)}
        etiquetaFila={(e) => t('evaluaciones.lista.abrir', { tercero: e.tercero.nombre, cuestionario: e.cuestionario })}
        vacio={<EstadoVacio compacto titulo={t('evaluaciones.lista.vacio')} texto={t('evaluaciones.lista.vacioAyuda')} />}
      />
    </>
  );
}
