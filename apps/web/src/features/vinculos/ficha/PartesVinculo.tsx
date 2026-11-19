import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, Skeleton, Stack, Typography } from '@mui/material';
import type { DefinicionAccion, VinculoDto } from '@validalo/api-client';
import { AvatarActor, ChipEstado, Dato, EstadoVacio, formatearFecha, LineaDeTiempo, MarcoTabla, RejillaDatos, ValorLargo } from '@validalo/ui';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSesion } from '../../../sesion/sesionStore';
import { EncabezadoPagina, ErrorRecuperable, EsqueletoHistorial, Tarjeta } from '../../../shared/componentes';
import { EnlaceFichaTercero } from '../../terceros/EnlaceFichaTercero';
import { formatearFechaDeclarada } from '../../documentos/formatoDatos';
import { actoresDeHistorial, useNombresUsuarios } from '../../configuracion/usuarios/api';
import { ICONO_ACCION } from '../acciones';
import { useHistorialVinculo, useTercero } from '../api';
import { AtributosDelVinculo } from '../atributos/AtributosDelVinculo';
import { ChipVerificacionDelCorreo } from '../components/ChipVerificacionDelCorreo';
import { estadoVisibleDelVinculo } from '../estadoVisible';
import { ChipExento } from '../exenciones/ChipExento';
import { identificacionDe } from '../tercero';
import { eventoATimeline } from '../historial';

/** Partes de la ficha del vínculo que no dependen del sector: el encabezado, los datos, las referencias y el historial. */

const Mono = ({ children }: { children: string }) => (
  <Typography component="span" variant="mono">
    {children}
  </Typography>
);

/** Título con NIT, tipo y estado; las acciones seguras van como botones y las destructivas en "Más acciones". */
export function Encabezado({
  vinculo,
  acciones,
  onAccion,
  antes,
  extra,
}: {
  vinculo: VinculoDto;
  acciones: DefinicionAccion[];
  onAccion: (d: DefinicionAccion) => void;
  antes: ReactNode;
  /** Botones de la ficha que van antes de las acciones del vínculo (p. ej. «Historial»). */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const tercero = useTercero(vinculo.terceroId);
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const seguras = acciones.filter((d) => !d.destructiva);
  const destructivas = acciones.filter((d) => d.destructiva);

  return (
    <EncabezadoPagina
      titulo={
        // «‹ Vínculos / Nombre» en una sola línea (miga de pan): el enlace de volver no gasta una línea propia.
        <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
          <Box component="span" sx={{ flex: 'none', fontSize: 14, fontWeight: 400, '& a': { mb: 0 } }}>
            {antes}
          </Box>
          <Box component="span" aria-hidden sx={{ flex: 'none', color: 'text.disabled', fontWeight: 400 }}>
            /
          </Box>
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tercero.data?.nombre ?? (tercero.isPending ? <Skeleton width={280} sx={{ display: 'inline-block' }} /> : t('vinculos.terceroDesconocido'))}
          </Box>
        </Box>
      }
      tituloCompleto={tercero.data?.nombre}
      etiquetaAcciones={t('vinculos.detalle.acciones')}
      subtitulo={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.25, fontSize: 13, flexWrap: 'wrap' }} useFlexGap>
          {tercero.data && <Mono>{identificacionDe(tercero.data)}</Mono>}
          {tercero.data && <span aria-hidden>·</span>}
          <span>{vinculo.tipoVinculo.nombre}</span>
          <span aria-hidden>·</span>
          <ChipEstado estado={estadoVisibleDelVinculo(vinculo)} fecha={vinculo.bloqueo?.desde ?? vinculo.actualizadoEn} />
          <ChipExento exenciones={vinculo.exenciones} />
        </Stack>
      }
      acciones={
        acciones.length > 0 || extra ? (
          <>
            {extra}
            {seguras.map((d) => {
              const Icono = ICONO_ACCION[d.accion];
              return (
                <Button key={d.accion} variant="outlined" startIcon={<Icono size={16} aria-hidden />} onClick={() => onAccion(d)}>
                  {t(`acciones.${d.accion}.boton`)}
                </Button>
              );
            })}
            {destructivas.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  endIcon={<ChevronDown size={16} aria-hidden />}
                  aria-haspopup="menu"
                  aria-expanded={ancla ? 'true' : undefined}
                  onClick={(e) => setAncla(e.currentTarget)}
                >
                  {t('vinculos.detalle.masAcciones')}
                </Button>
                <Menu
                  anchorEl={ancla}
                  open={Boolean(ancla)}
                  onClose={() => setAncla(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { width: 280, mt: 0.5 } } }}
                >
                  {destructivas.map((d) => {
                    const Icono = ICONO_ACCION[d.accion];
                    return (
                      <MenuItem
                        key={d.accion}
                        onClick={() => {
                          setAncla(null);
                          onAccion(d);
                        }}
                        sx={{ alignItems: 'flex-start', py: 0.75, color: 'estado.error.texto', '& .MuiListItemIcon-root': { color: 'estado.error.texto', mt: '2px' } }}
                      >
                        <ListItemIcon>
                          <Icono size={16} strokeWidth={1.75} aria-hidden />
                        </ListItemIcon>
                        <ListItemText
                          primary={t(`acciones.${d.accion}.boton`)}
                          secondary={t(`acciones.${d.accion}.resumen`)}
                          slotProps={{ primary: { sx: { fontSize: 14 } }, secondary: { sx: { fontSize: 12, lineHeight: '16px', whiteSpace: 'normal' } } }}
                          sx={{ my: 0 }}
                        />
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            )}
          </>
        ) : undefined
      }
    />
  );
}

/** `conFicha`: el nombre del tercero lleva a su ficha (Tercero 360) si la persona puede verla. */
export function DatosVinculo({ vinculo, empresaId, empresaNombre, conFicha }: { vinculo: VinculoDto; empresaId: string; empresaNombre: string; conFicha: boolean }) {
  const { t } = useTranslation();
  const tercero = useTercero(vinculo.terceroId);
  const invitacion = vinculo.invitacionAceptadaEn
    ? t('vinculos.detalle.invitacionAceptada', { fecha: formatearFecha(vinculo.invitacionAceptadaEn) })
    : vinculo.invitacion
      ? t('vinculos.detalle.invitacionDetalle', { envios: String(vinculo.invitacion.envios), expira: formatearFecha(vinculo.invitacion.expira) })
      : vinculo.invitacionPorAprobar?.estado === 'Pendiente'
        ? t('vinculos.detalle.invitacionPorAprobar')
        : t('vinculos.detalle.sinInvitacion');

  return (
    <Tarjeta titulo={t('vinculos.detalle.datos')}>
      <RejillaDatos>
        <Dato etiqueta={t('vinculos.detalle.tercero')}>
          {tercero.data && conFicha ? (
            <EnlaceFichaTercero terceroId={vinculo.terceroId} etiqueta={t('terceros.ficha.abrirFicha', { tercero: tercero.data.nombre })}>
              {tercero.data.nombre}
            </EnlaceFichaTercero>
          ) : (
            (tercero.data?.nombre ?? '—')
          )}
        </Dato>
        <Dato etiqueta={t('vinculos.detalle.identificacion')}>{tercero.data ? <ValorLargo valor={identificacionDe(tercero.data)} mono /> : '—'}</Dato>
        <Dato etiqueta={t('vinculos.detalle.tipo')}>{vinculo.tipoVinculo.nombre}</Dato>
        <Dato etiqueta={t('vinculos.detalle.empresa')}>{empresaNombre}</Dato>
        <Dato etiqueta={t('vinculos.detalle.correo')}>
          <ValorLargo valor={vinculo.invitacion?.correoDestino ?? vinculo.correoTercero} partirEn="@" />
          <ChipVerificacionDelCorreo verificacion={vinculo.verificacionDelCorreo} />
        </Dato>
        <Dato etiqueta={t('vinculos.detalle.invitacion')}>{invitacion}</Dato>
        {vinculo.vigenteHasta && (
          <Dato etiqueta={t('vigenciaVinculo.vigenteHasta')}>
            <Mono>{formatearFechaDeclarada(vinculo.vigenteHasta)}</Mono>
          </Dato>
        )}
        <Dato etiqueta={t('vinculos.detalle.creado')}>
          <Mono>{formatearFecha(vinculo.creadoEn)}</Mono> · {t(`vinculos.origen.${vinculo.origen}`)}
        </Dato>
        <Dato etiqueta={t('vinculos.detalle.actualizado')}>
          <Mono>{formatearFecha(vinculo.actualizadoEn)}</Mono>
        </Dato>
        <AtributosDelVinculo vinculo={vinculo} empresaId={empresaId} />
      </RejillaDatos>
    </Tarjeta>
  );
}

export function ReferenciasVinculo({ vinculo }: { vinculo: VinculoDto }) {
  const { t } = useTranslation();
  return (
    <Tarjeta titulo={t('vinculos.detalle.referencias')}>
      {vinculo.referencias.length === 0 ? (
        <MarcoTabla>
          <EstadoVacio compacto titulo={t('vinculos.detalle.sinReferencias')} texto={t('vinculos.detalle.referenciasAyuda')} />
        </MarcoTabla>
      ) : (
        <MarcoTabla>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { height: 36, px: 1.5, textAlign: 'left', borderBottom: 1, borderColor: 'divider' }, '& tr:last-child td': { borderBottom: 0 } }}>
            <thead>
              <tr>
                <Box component="th" scope="col" sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 500 }}>
                  {t('vinculos.detalle.sistema')}
                </Box>
                <Box component="th" scope="col" sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 500 }}>
                  {t('vinculos.detalle.referencia')}
                </Box>
              </tr>
            </thead>
            <tbody>
              {vinculo.referencias.map((r) => (
                <tr key={`${r.sistema}|${r.id}`}>
                  <td>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <AvatarActor tipo="integracion" tamano={24} />
                      <span>{r.sistema}</span>
                    </Stack>
                  </td>
                  <td>
                    <Box sx={{ maxWidth: 320 }}>
                      <ValorLargo valor={r.id} mono />
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        </MarcoTabla>
      )}
    </Tarjeta>
  );
}

/** Las acciones invalidan `/api/v1/vinculos*`, así que el historial se recarga solo después de cada cambio. */
export function HistorialVinculo({ empresaId, vinculoId, sinTarjeta = false }: { empresaId: string; vinculoId: string; sinTarjeta?: boolean }) {
  const { t } = useTranslation();
  const usuarioActual = useSesion((s) => s.sesion?.usuarioId ?? null);
  const consulta = useHistorialVinculo(empresaId, vinculoId);
  const nombres = useNombresUsuarios(empresaId, useMemo(() => actoresDeHistorial(consulta.data), [consulta.data]));
  const { refetch } = consulta;
  const eventos = useMemo(
    // Del más reciente al más antiguo por versión: varios eventos de una misma transacción comparten la hora.
    () => [...(consulta.data ?? [])].reverse().map((e) => eventoATimeline(e, { usuarioActual, nombres }, t)),
    [consulta.data, usuarioActual, nombres, t],
  );

  const contenido = (
    <>
      {consulta.isPending && <EsqueletoHistorial />}
      {consulta.isError && <ErrorRecuperable mensaje={t('vinculos.detalle.errorHistorial')} onReintentar={() => void refetch()} />}
      {consulta.data && <LineaDeTiempo eventos={eventos} vacio={t('vinculos.detalle.sinHistorial')} />}
    </>
  );
  return sinTarjeta ? contenido : <Tarjeta titulo={t('vinculos.detalle.historial')}>{contenido}</Tarjeta>;
}
