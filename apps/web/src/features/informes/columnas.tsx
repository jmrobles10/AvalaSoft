import { Typography } from '@mui/material';
import type { FilaEstadoExpedienteDto, FilaInformeEvaluacionDto, FilaInformeVinculoDto } from '@validalo/api-client';
import { ChipEstado, formatearFecha, type ColumnaTabla } from '@validalo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearFechaDeclarada } from '../documentos/formatoDatos';
import { formatearPuntaje, textoDeMotivo } from '../evaluaciones/modelo';
import { ChipEvaluacion } from '../evaluaciones/PaginaEvaluaciones';
import { TerceroEnLinea } from '../expedientes/componentes';
import { formatearDias } from './modelo';

/** Columnas del informe de estado: folio, tercero, estado, apertura, días (total y reparto), requisitos y SLA. */
export function useColumnasEstado(): ColumnaTabla<FilaEstadoExpedienteDto>[] {
  const { t } = useTranslation();
  return useMemo<ColumnaTabla<FilaEstadoExpedienteDto>[]>(() => {
    const dias = (v: number | string | null) => formatearDias(v, t('informes.sinDato'));
    return [
      { id: 'folio', encabezado: t('informes.estado.columnas.folio'), ancho: 190, celda: (f) => <Typography variant="monoTabla">{f.folio}</Typography> },
      { id: 'tercero', encabezado: t('informes.estado.columnas.tercero'), celda: (f) => <TerceroEnLinea tercero={f.tercero} /> },
      {
        id: 'estado',
        encabezado: t('informes.estado.columnas.estado'),
        ancho: 140,
        celda: (f) => <ChipEstado estado={f.estado} etiqueta={t(`informes.estado.estados.${f.estado}`)} />,
      },
      { id: 'abierto', encabezado: t('informes.estado.columnas.abierto'), ancho: 110, celda: (f) => <Typography variant="monoTabla">{formatearFecha(f.abiertoEn)}</Typography> },
      {
        id: 'total',
        encabezado: t('informes.estado.columnas.total'),
        ancho: 70,
        alinear: 'right',
        celda: (f) => <Typography variant="monoTabla">{dias(f.diasTotales)}</Typography>,
      },
      {
        id: 'reparto',
        encabezado: t('informes.estado.columnas.reparto'),
        ancho: 170,
        celda: (f) => <Typography variant="monoTabla">{`${dias(f.diasEnCarga)} · ${dias(f.diasConTercero)} · ${dias(f.diasEnRevision)}`}</Typography>,
      },
      {
        id: 'requisitos',
        encabezado: t('informes.estado.columnas.requisitos'),
        ancho: 100,
        celda: (f) => t('informes.estado.requisitos', { aprobados: String(f.requisitosAprobados), total: String(f.requisitos) }),
      },
      {
        id: 'sla',
        encabezado: t('informes.estado.columnas.sla'),
        ancho: 110,
        celda: (f) =>
          f.slaIncumplido ? <ChipEstado estado="Vencido" etiqueta={t('informes.estado.slaIncumplido')} /> : <Typography variant="body2">{t('informes.sinDato')}</Typography>,
      },
    ];
  }, [t]);
}

/** Columnas del informe de vínculos: tercero, estado, certificado, expediente en curso, documentos y secciones. */
export function useColumnasVinculos(): ColumnaTabla<FilaInformeVinculoDto>[] {
  const { t } = useTranslation();
  return useMemo<ColumnaTabla<FilaInformeVinculoDto>[]>(
    () => [
      { id: 'tercero', encabezado: t('informes.vinculos.columnas.tercero'), celda: (f) => <TerceroEnLinea tercero={f.tercero} /> },
      {
        id: 'estado',
        encabezado: t('informes.vinculos.columnas.estado'),
        ancho: 140,
        celda: (f) => {
          const visible = f.enRevision ? 'EnRevision' : f.estado;
          return <ChipEstado estado={visible} etiqueta={t(`informes.vinculos.estados.${visible}`)} />;
        },
      },
      {
        id: 'certificado',
        encabezado: t('informes.vinculos.columnas.certificado'),
        ancho: 220,
        celda: (f) =>
          f.certificado ? (
            <Typography variant="body2">
              {`${f.certificado.folio} · ${f.certificado.enVerificacion ? t('certificados.lista.estados.EnVerificacion') : f.certificado.estado}`}
              {f.certificado.vigenteHasta ? ` · ${t('informes.vinculos.hasta', { fecha: formatearFechaDeclarada(f.certificado.vigenteHasta) })}` : ''}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('informes.vinculos.sinCertificado')}
            </Typography>
          ),
      },
      {
        id: 'expediente',
        encabezado: t('informes.vinculos.columnas.expediente'),
        ancho: 200,
        celda: (f) =>
          f.expedienteEnCurso ? <Typography variant="monoTabla">{f.expedienteEnCurso.folio}</Typography> : t('informes.sinDato'),
      },
      {
        id: 'documentos',
        encabezado: t('informes.vinculos.columnas.documentos'),
        ancho: 190,
        celda: (f) =>
          f.documentos ? (
            <Typography variant="body2">
              {t('informes.vinculos.documentos', { porVencer: String(f.documentos.porVencer + f.documentos.enGracia), vencidos: String(f.documentos.vencidos) })}
              {f.documentos.proximoVencimiento ? ` · ${t('informes.vinculos.proximo', { fecha: formatearFechaDeclarada(f.documentos.proximoVencimiento) })}` : ''}
            </Typography>
          ) : (
            t('informes.sinDato')
          ),
      },
      {
        id: 'secciones',
        encabezado: t('informes.vinculos.columnas.secciones'),
        ancho: 200,
        celda: (f) => (f.seccionesPendientes.length > 0 ? f.seccionesPendientes.join(', ') : t('informes.sinDato')),
      },
    ],
    [t],
  );
}

/** Columnas del informe de evaluaciones: tercero (con el folio o el motivo), cuestionario, estado, puntaje, motivos y cuándo se respondió. */
export function useColumnasEvaluaciones(): ColumnaTabla<FilaInformeEvaluacionDto>[] {
  const { t } = useTranslation();
  return useMemo<ColumnaTabla<FilaInformeEvaluacionDto>[]>(
    () => [
      {
        id: 'tercero',
        encabezado: t('evaluaciones.lista.columnas.tercero'),
        celda: (f) => (
          <>
            <Typography variant="subtitle1" component="span" sx={{ display: 'block' }}>
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
        celda: (f) => f.motivos.map((m) => textoDeMotivo(m, t)).join(', ') || t('informes.sinDato'),
      },
      {
        id: 'respondida',
        encabezado: t('evaluaciones.informe.columnas.respondida'),
        ancho: 130,
        celda: (f) => (f.respondidaEn ? <Typography variant="monoTabla">{formatearFecha(f.respondidaEn)}</Typography> : t('informes.sinDato')),
      },
    ],
    [t],
  );
}
