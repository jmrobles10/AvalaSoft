import { Alert, AlertTitle, Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { formatearFecha } from '@validalo/ui';
import { Ban, ChevronDown, Lock, RotateCcw, Send, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermisos } from '../../../shared/usePermisos';
import { AvisoEsperandoEvaluaciones } from '../../evaluaciones/PanelEvaluaciones';
import { BotonExportarExpediente } from '../../informes/BotonExportarExpediente';
import { AvisoObservado } from '../../recordatorios/AvisoObservado';
import { accionesDeExpediente, areasFrenadas, areasQueVuelvenARevisar, dialogoAplica, esDialogoDeArea, ESTADOS_ABIERTOS, type DialogoExpediente } from '../reglas';
import type { ControlExpediente } from '../useControlExpediente';
import { AvisoEsperandoCuenta } from './AvisoEsperandoCuenta';
import { DialogoDecision } from './DialogoDecision';
import { DialogoDecisionArea } from './DialogoDecisionArea';
import { AvisoPlazoCargue } from './PlazoCargue';

/** Hasta dónde devolvió a revisión el administrador (DS-1, DS-2): cada uno tiene su texto. */
const ALCANCES_DE_DEVOLUCION = ['Etapa', 'FaseInicial', 'ExpedienteAprobado'] as const;

/** Acciones del expediente (exportar, reenviar y el menú «Más»): van en la barra del sector Validación. */
export function AccionesExpediente({ control }: { control: ControlExpediente }) {
  const { t } = useTranslation();
  const { expediente } = control;
  const permisos = usePermisos(expediente.empresaId);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const acciones = accionesDeExpediente(expediente, permisos.scopes, control.vinculoBloqueado);
  const masAcciones = acciones.includes('anular') || acciones.includes('faseInicial') || acciones.includes('desaprobar');
  const elegir = (dialogo: DialogoExpediente) => {
    setAncla(null);
    control.abrirDialogo(dialogo);
  };
  const peligro = { color: 'estado.error.texto', '& .MuiListItemIcon-root': { color: 'estado.error.texto' } } as const;

  return (
    <>
      <BotonExportarExpediente empresaId={expediente.empresaId} expedienteId={expediente.id} />
      {acciones.includes('reenviar') && (
        <Button variant="contained" size="small" startIcon={<Send size={16} aria-hidden />} onClick={() => control.abrirDialogo({ tipo: 'reenviar' })}>
          {t('expedientes.acciones.reenviar')}
        </Button>
      )}
      {masAcciones && (
        <>
          <Button variant="outlined" size="small" endIcon={<ChevronDown size={16} aria-hidden />} aria-haspopup="menu" onClick={(e) => setAncla(e.currentTarget)}>
            {t('expedientes.acciones.mas')}
          </Button>
          <Menu anchorEl={ancla} open={Boolean(ancla)} onClose={() => setAncla(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {acciones.includes('faseInicial') && (
              <MenuItem onClick={() => elegir({ tipo: 'faseInicial' })}>
                <ListItemIcon>
                  <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                </ListItemIcon>
                <ListItemText primary={t('expedientes.acciones.faseInicial')} />
              </MenuItem>
            )}
            {acciones.includes('desaprobar') && (
              <MenuItem onClick={() => elegir({ tipo: 'desaprobar' })} sx={peligro}>
                <ListItemIcon>
                  <Undo2 size={16} strokeWidth={1.75} aria-hidden />
                </ListItemIcon>
                <ListItemText primary={t('expedientes.acciones.desaprobar')} />
              </MenuItem>
            )}
            {acciones.includes('anular') && (
              <MenuItem onClick={() => elegir({ tipo: 'anular' })} sx={peligro}>
                <ListItemIcon>
                  <Ban size={16} strokeWidth={1.75} aria-hidden />
                </ListItemIcon>
                <ListItemText primary={t('expedientes.acciones.anular')} />
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </>
  );
}

/** Los avisos del estado del expediente (bloqueo, observado, esperas, devolución, cierre y plazo de cargue). */
export function AvisosExpediente({ control }: { control: ControlExpediente }) {
  const { t } = useTranslation();
  const { expediente, nombres } = control;
  const permisos = usePermisos(expediente.empresaId);
  const observadas = areasQueVuelvenARevisar(expediente);
  const frenadas = areasFrenadas(expediente);
  const nombreDeArea = (id: string) => expediente.etapas.flatMap((e) => e.areas).find((a) => a.areaId === id)?.nombre ?? '—';

  return (
    <>
      {control.vinculoBloqueado && expediente.estado !== 'Aprobado' && (
        <Alert severity="error" icon={<Lock size={18} strokeWidth={1.75} />}>
          <AlertTitle>{t('expedientes.avisos.bloqueadoTitulo')}</AlertTitle>
          {t('expedientes.avisos.bloqueado')}
        </Alert>
      )}
      {expediente.estado === 'Observado' && (
        <AvisoObservado
          expediente={expediente}
          empresaId={expediente.empresaId}
          scopes={permisos.scopes}
          texto={
            t('expedientes.avisos.observado', { count: observadas.length, areas: observadas.map((a) => a.nombre).join(', ') }) +
            (frenadas.length > 0 ? ` ${t('expedientes.avisos.frenadas', { areas: frenadas.map((a) => a.nombre).join(', ') })}` : '')
          }
        />
      )}
      {expediente.esperandoVerificaciones && (
        <Alert severity="info">
          <AlertTitle>{t('expedientes.avisos.esperandoVerificacionesTitulo')}</AlertTitle>
          {t('expedientes.avisos.esperandoVerificaciones', {
            verificaciones: (expediente.verificaciones ?? [])
              .filter((v) => v.bloqueante && v.estado !== 'Satisfecha')
              .map((v) => `${t(`cumplimiento.tipos.${v.tipo}`)} (${t(`cumplimiento.estados.${v.estado}`).toLowerCase()})`)
              .join(', '),
          })}
        </Alert>
      )}
      {expediente.esperandoCuentaDesignada && <AvisoEsperandoCuenta empresaId={expediente.empresaId} vinculoId={expediente.vinculoId} />}
      {expediente.esperandoEvaluaciones && <AvisoEsperandoEvaluaciones expediente={expediente} />}
      {expediente.ultimaDesaprobacion && ESTADOS_ABIERTOS.includes(expediente.estado) && (
        <Alert severity="info" icon={<Undo2 size={18} strokeWidth={1.75} />}>
          <AlertTitle>{t('expedientes.avisos.devueltoTitulo')}</AlertTitle>
          {t(`expedientes.avisos.devuelto.${ALCANCES_DE_DEVOLUCION.find((a) => a === expediente.ultimaDesaprobacion?.alcance) ?? 'Etapa'}`, {
            fecha: formatearFecha(expediente.ultimaDesaprobacion.fecha),
            etapa: String(expediente.ultimaDesaprobacion.etapa),
            persona: nombres.get(expediente.ultimaDesaprobacion.usuario) ?? t('expedientes.veredictos.administrador'),
          })}{' '}
          “{expediente.ultimaDesaprobacion.justificacion}”
        </Alert>
      )}
      {expediente.estado === 'Aprobado' && (
        <Alert severity="success">
          <AlertTitle>{t('expedientes.avisos.aprobadoTitulo')}</AlertTitle>
          {t('expedientes.avisos.aprobado', { fecha: formatearFecha(expediente.cerradoEn ?? expediente.actualizadoEn) })}
        </Alert>
      )}
      {expediente.estado === 'Rechazado' && expediente.rechazo && (
        <Alert severity="error">
          <AlertTitle>{expediente.rechazo.origen === 'Cumplimiento' ? t('cumplimiento.rechazo.avisoTitulo') : t('expedientes.avisos.rechazadoTitulo')}</AlertTitle>
          {expediente.tipo === 'Actualizacion'
            ? t('expedientes.avisos.rechazadoActualizacion', { area: nombreDeArea(expediente.rechazo.areaId), fecha: formatearFecha(expediente.rechazo.fecha) })
            : expediente.rechazo.origen === 'Cumplimiento'
              ? t('cumplimiento.rechazo.aviso', { fecha: formatearFecha(expediente.rechazo.fecha) })
              : t('expedientes.avisos.rechazado', { area: nombreDeArea(expediente.rechazo.areaId), fecha: formatearFecha(expediente.rechazo.fecha) })}{' '}
          “{expediente.rechazo.justificacion}”
        </Alert>
      )}
      {expediente.estado === 'Anulado' && (
        <Alert severity="info">
          <AlertTitle>{t('expedientes.avisos.anuladoTitulo')}</AlertTitle>
          {t(expediente.tipo === 'Actualizacion' ? 'expedientes.avisos.anuladoActualizacion' : 'expedientes.avisos.anulado', { fecha: formatearFecha(expediente.cerradoEn ?? expediente.actualizadoEn) })}
          {expediente.motivoAnulacion ? ` “${expediente.motivoAnulacion}”` : ''}
        </Alert>
      )}
      <AvisoPlazoCargue expediente={expediente} empresaId={expediente.empresaId} scopes={permisos.scopes} />
    </>
  );
}

/** Los diálogos de decisión (por área o del expediente) que abre cualquier sector. */
export function DialogosExpediente({ control }: { control: ControlExpediente }) {
  const { dialogo, expediente, motivos, contexto } = control;
  if (!dialogo) return null;
  const cerrar = () => control.abrirDialogo(null);
  return esDialogoDeArea(dialogo) ? (
    <DialogoDecisionArea dialogo={dialogo} expediente={expediente} empresaId={expediente.empresaId} motivos={motivos} aplica={dialogoAplica(dialogo, expediente, contexto)} onCerrar={cerrar} />
  ) : (
    <DialogoDecision dialogo={dialogo} expediente={expediente} empresaId={expediente.empresaId} motivos={motivos} aplica={dialogoAplica(dialogo, expediente, contexto)} onCerrar={cerrar} />
  );
}
