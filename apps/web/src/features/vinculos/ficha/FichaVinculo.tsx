import { Alert, AlertTitle, Box, Button, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { accionesDisponibles, SCOPES, type DefinicionAccion, type VinculoDto } from '@validasoft/api-client';
import { formatearFecha } from '@validasoft/ui';
import { History, Lock, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { usePermisos } from '../../../shared/usePermisos';
import { useExpediente } from '../../expedientes/api';
import { DialogosExpediente } from '../../expedientes/components/ControlExpediente';
import { useControlExpediente } from '../../expedientes/useControlExpediente';
import { AvisoInvitacionPorAprobar } from '../../invitaciones/AvisoInvitacionPorAprobar';
import { useFichaTercero } from '../../terceros/api';
import { AvisoAccesoDelCorreo } from '../components/AvisoAccesoDelCorreo';
import { AvisoActualizacionNoAprobada } from '../components/AvisoActualizacionNoAprobada';
import { AvisoDeVigencia } from '../components/AvisoDeVigencia';
import { DialogoAccion } from '../components/DialogoAccion';
import { BarraSectores } from './BarraSectores';
import { ContenidoSector } from './ContenidoSector';
import { HistorialFicha } from './HistorialFicha';
import { Encabezado } from './PartesVinculo';
import { esSector, indicadoresPorSector, type Sector } from './sectores';

interface Props {
  vinculo: VinculoDto;
  /** El expediente que se revisa: el abierto del vínculo o el que pidió la ruta del expediente. */
  expedienteId: string | null;
  /** Sector cuando la URL no trae `?sector=`. */
  sectorPorDefecto: Sector;
  volver: ReactNode;
}

/**
 * Ficha del vínculo: una sola pantalla para el vínculo y su expediente, con la información repartida en sectores (barra lateral, como la
 * ficha del tercero del SRM) en lugar de una columna de tarjetas. El sector va en la URL (`?sector=`) para compartirlo y volver a él. El
 * historial es un sector y, desde cualquier otro, un panel lateral que se abre con «Historial».
 */
export function FichaVinculo({ vinculo, expedienteId, sectorPorDefecto, volver }: Props) {
  const { t } = useTranslation();
  const permisos = usePermisos(vinculo.empresaId);
  const [parametros, setParametros] = useSearchParams();
  const [accion, setAccion] = useState<DefinicionAccion | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  const puedeExpediente = permisos.puede(SCOPES.expedientesLeer);
  const consultaExpediente = useExpediente(vinculo.empresaId, puedeExpediente && expedienteId ? expedienteId : '');
  const expediente = consultaExpediente.data;
  const control = useControlExpediente(expediente, vinculo.estado === 'Bloqueado');
  const ficha = useFichaTercero(vinculo.empresaId, vinculo.terceroId, permisos.puede(SCOPES.tercerosLeer));

  const pedido = parametros.get('sector');
  const actual: Sector = esSector(pedido) ? pedido : sectorPorDefecto;
  const rejilla = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLElement>(null);
  useAltoDelEncabezado(rejilla);
  const elegir = (sector: Sector) => {
    setParametros(
      (previos) => {
        const siguientes = new URLSearchParams(previos);
        siguientes.set('sector', sector);
        return siguientes;
      },
      { replace: true },
    );
    // Si ya se bajó, el sector nuevo empieza arriba (bajo el encabezado): un sector más corto no deja la página a medio camino.
    requestAnimationFrame(() => {
      const seccion = contenido.current;
      const encabezado = document.querySelector('[data-encabezado-fijo]');
      if (seccion && encabezado && seccion.getBoundingClientRect().top < encabezado.getBoundingClientRect().bottom) {
        seccion.scrollIntoView({ block: 'start' });
      }
    });
  };

  const botonHistorial =
    actual !== 'historial' ? (
      <Button variant="outlined" startIcon={<History size={16} aria-hidden />} onClick={() => setVerHistorial(true)} aria-haspopup="dialog">
        {t('vinculos.ficha.verHistorial')}
      </Button>
    ) : undefined;

  return (
    <>
      <Encabezado vinculo={vinculo} acciones={accionesDisponibles(vinculo, permisos.scopes)} onAccion={setAccion} antes={volver} extra={botonHistorial} />
      <Stack spacing={1.5} sx={{ mb: 2, '&:empty': { display: 'none' } }}>
        {vinculo.bloqueo && (
          <Alert severity="error" icon={<Lock size={18} strokeWidth={1.75} />}>
            <AlertTitle>{t('vinculos.detalle.bloqueo')}</AlertTitle>
            {vinculo.bloqueo.motivo}{' '}
            {t('vinculos.detalle.bloqueoDetalle', {
              desde: formatearFecha(vinculo.bloqueo.desde),
              hasta: vinculo.bloqueo.hasta ? t('vinculos.detalle.bloqueoHasta', { hasta: formatearFecha(vinculo.bloqueo.hasta) }) : '',
            })}
          </Alert>
        )}
        <AvisoDeVigencia vinculo={vinculo} />
        <AvisoInvitacionPorAprobar vinculo={vinculo} empresaId={vinculo.empresaId} />
        <AvisoAccesoDelCorreo vinculo={vinculo} />
        <AvisoActualizacionNoAprobada vinculo={vinculo} empresaId={vinculo.empresaId} />
      </Stack>

      <Box ref={rejilla} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: '248px minmax(0,1fr)' }, gap: { xs: 1.5, lg: 3 }, alignItems: 'start' }}>
        <BarraSectores actual={actual} indicadores={indicadoresPorSector(expediente)} onElegir={elegir} />
        <Box ref={contenido} component="section" aria-label={t(`vinculos.ficha.sector.${actual}`)} sx={{ minWidth: 0, scrollMarginTop: 'calc(var(--vs-tope, 0px) + var(--vs-alto-encabezado, 96px) + 12px)' }}>
          <ContenidoSector sector={actual} vinculo={vinculo} control={control} cargandoExpediente={Boolean(expedienteId) && puedeExpediente && consultaExpediente.isPending} ficha={ficha.data} />
        </Box>
      </Box>

      <Drawer anchor="right" open={verHistorial} onClose={() => setVerHistorial(false)} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 } } } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h4" component="h2">
            {t('vinculos.ficha.historial')}
          </Typography>
          <IconButton aria-label={t('comun.cerrar')} onClick={() => setVerHistorial(false)}>
            <X size={18} />
          </IconButton>
        </Stack>
        <Box sx={{ px: 2, pb: 2, overflow: 'auto' }}>
          <HistorialFicha empresaId={vinculo.empresaId} vinculoId={vinculo.id} expediente={expediente ?? null} />
        </Box>
      </Drawer>

      {accion && <DialogoAccion definicion={accion} vinculo={vinculo} empresaId={vinculo.empresaId} onCerrar={() => setAccion(null)} />}
      {control && <DialogosExpediente control={control} />}
    </>
  );
}

/**
 * Publica en `--vs-alto-encabezado` (sobre la rejilla) el alto real del encabezado fijo de la página, que cambia con el ancho y las
 * acciones: la barra de sectores se pega justo debajo de él en lugar de meterse por debajo.
 */
function useAltoDelEncabezado(rejilla: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const encabezado = document.querySelector<HTMLElement>('[data-encabezado-fijo]');
    const destino = rejilla.current;
    if (!encabezado || !destino) return;
    const fijar = () => destino.style.setProperty('--vs-alto-encabezado', `${String(encabezado.offsetHeight)}px`);
    fijar();
    const observador = new ResizeObserver(fijar);
    observador.observe(encabezado);
    return () => observador.disconnect();
  }, [rejilla]);
}
