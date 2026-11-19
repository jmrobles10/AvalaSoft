import { Alert, Box, Button, Chip, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import type { FuentePlataformaDto, ProveedorDePlataformaFuenteDto } from '@validalo/api-client';
import { formatearFechaHora } from '@validalo/ui';
import { Database, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogoConfirmacion, EncabezadoPagina, ErrorRecuperable, IconoCarga, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { borradorDeCredenciales, credencialesADto, esFuenteOficial, type BorradorDeCredenciales } from '../fuentesOficiales/modelo';
import { useActualizarFuentesDePlataforma, useFuentesDePlataforma } from './apiFuentes';

/**
 * Fuentes oficiales de la plataforma (FO-5): las cuentas con las que todas las empresas consultan el RUES y la DIAN (el token de datos.gov.co, la API
 * contratada con Confecámaras o con quien consulte el RUT) y el proveedor predeterminado de cada fuente. La clave es de solo escritura y se cifra con la clave
 * maestra; una empresa puede traer las suyas. Nada se consulta por scraping: la DIAN no publica una API del estado del RUT, así que su única vía es un contrato.
 */
export function PaginaFuentesPlataforma() {
  const { t } = useTranslation();
  const consulta = useFuentesDePlataforma();

  return (
    <>
      <EncabezadoPagina titulo={t('fuentesOficiales.plataforma.titulo')} subtitulo={t('fuentesOficiales.plataforma.subtitulo')} />
      {consulta.isPending && <Skeleton variant="rounded" height={320} role="status" aria-busy aria-label={t('comun.cargando')} />}
      {consulta.isError && <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />}
      {consulta.data && (
        <Stack spacing={2}>
          {consulta.data.fuentes.map((f) => (
            <Fuente key={f.fuente} fuente={f} actualizada={consulta.data.actualizadaEn} actualizadaPor={consulta.data.actualizadaPor} />
          ))}
        </Stack>
      )}
    </>
  );
}

function Fuente({ fuente, actualizada, actualizadaPor }: { fuente: FuentePlataformaDto; actualizada: string | null; actualizadaPor: string | null }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const actualizar = useActualizarFuentesDePlataforma();
  const elegir = (proveedor: string) =>
    actualizar.mutate({ predeterminados: [{ fuente: fuente.fuente, proveedor }] }, { onSuccess: () => mostrar(t('fuentesOficiales.plataforma.guardada')), onError: (e) => mostrar(mensajeDeError(e, t), 'error') });

  return (
    <Tarjeta titulo={fuente.nombre} etiqueta={fuente.nombre} icono={Database}>
      <Stack spacing={2}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{fuente.descripcion}</Typography>
        <TextField
          select
          size="small"
          label={t('fuentesOficiales.plataforma.predeterminado')}
          value={fuente.predeterminado ?? ''}
          onChange={(e) => elegir(e.target.value)}
          disabled={actualizar.isPending}
          sx={{ maxWidth: 420 }}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="">{t('fuentesOficiales.plataforma.sinPredeterminado')}</MenuItem>
          {fuente.proveedores.map((p) => (
            <MenuItem key={p.nombre} value={p.nombre}>
              {t(`fuentesOficiales.proveedores.${p.nombre as 'Simulado'}`, { defaultValue: p.nombre })}
            </MenuItem>
          ))}
        </TextField>
        {fuente.fuente === 'Dian' && <Alert severity="info">{t('fuentesOficiales.plataforma.sinApi')}</Alert>}
        {fuente.fuente === 'Rues' && <Alert severity="info">{t('fuentesOficiales.plataforma.sinCuentaDatosAbiertos')}</Alert>}
        {fuente.proveedores.map((p) => (
          <Cuenta key={p.nombre} fuente={fuente.fuente} proveedor={p} actualizada={actualizada} actualizadaPor={actualizadaPor} />
        ))}
      </Stack>
    </Tarjeta>
  );
}

function Cuenta({ fuente, proveedor: p, actualizada, actualizadaPor }: { fuente: string; proveedor: ProveedorDePlataformaFuenteDto; actualizada: string | null; actualizadaPor: string | null }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const actualizar = useActualizarFuentesDePlataforma();
  const [borrador, setBorrador] = useState<BorradorDeCredenciales>(() => borradorDeCredenciales(p));
  const [quitando, setQuitando] = useState(false);
  const cambiar = (cambio: Partial<BorradorDeCredenciales>) => setBorrador((b) => ({ ...b, ...cambio }));
  // Si la cuenta cambia en el servidor (se guardó o se quitó), el formulario vuelve a lo guardado: la clave nunca se conserva en pantalla.
  const huella = `${p.configurado ? '1' : '0'}|${p.usuario ?? ''}|${p.ultimosCuatroClave ?? ''}|${p.urlBase ?? ''}|${p.notas ?? ''}`;
  const [vista, setVista] = useState(huella);
  if (vista !== huella) {
    setVista(huella);
    setBorrador(borradorDeCredenciales(p));
  }
  if (!esFuenteOficial(fuente)) return null;

  const nombre = t(`fuentesOficiales.proveedores.${p.nombre as 'Simulado'}`, { defaultValue: p.nombre });
  const guardar = (quitar = false) =>
    actualizar.mutate(
      { credenciales: credencialesADto(fuente, p.nombre, borrador, quitar) },
      {
        onSuccess: () => mostrar(quitar ? t('fuentesOficiales.plataforma.quitada') : t('fuentesOficiales.plataforma.guardada')),
        onError: (e) => mostrar(mensajeDeError(e, t), 'error'),
        onSettled: () => setQuitando(false),
      },
    );

  return (
    <Box component="section" aria-label={t('fuentesOficiales.plataforma.cuenta', { proveedor: nombre })} sx={{ border: 1, borderColor: 'divider', borderRadius: (th) => `${String(th.radio.sm)}px`, p: 1.5 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 500 }}>
          {t('fuentesOficiales.plataforma.cuenta', { proveedor: nombre })}
        </Typography>
        {!p.habilitadoEnInstalacion && <Chip size="small" variant="outlined" label={t('fuentesOficiales.plataforma.noHabilitado')} />}
        <Chip
          size="small"
          variant="outlined"
          color={p.configurado ? 'success' : 'default'}
          label={p.configurado ? t('fuentesOficiales.plataforma.configurada', { ultimos: p.ultimosCuatroClave ?? '' }) : t('fuentesOficiales.plataforma.sinConfigurar')}
        />
      </Stack>
      {!p.habilitadoEnInstalacion && <Typography sx={{ color: 'text.secondary', fontSize: 12, mb: 1 }}>{t('fuentesOficiales.plataforma.ayudaNoHabilitado')}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        <TextField size="small" label={t('fuentesOficiales.plataforma.usuario')} value={borrador.usuario} onChange={(e) => cambiar({ usuario: e.target.value })} />
        <TextField
          size="small"
          type="password"
          autoComplete="new-password"
          label={t('fuentesOficiales.plataforma.clave')}
          value={borrador.clave}
          onChange={(e) => cambiar({ clave: e.target.value })}
          helperText={t('fuentesOficiales.plataforma.claveAyuda')}
        />
        <TextField size="small" label={t('fuentesOficiales.plataforma.url')} value={borrador.urlBase} onChange={(e) => cambiar({ urlBase: e.target.value })} />
        <TextField size="small" label={t('fuentesOficiales.plataforma.notas')} value={borrador.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
      </Box>
      {actualizar.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {mensajeDeError(actualizar.error, t)}
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }} useFlexGap>
        <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
          {actualizada && p.actualizadasEn ? `${t('fuentesOficiales.plataforma.actualizada')}: ${formatearFechaHora(p.actualizadasEn)}${actualizadaPor ? ` · ${actualizadaPor}` : ''}` : ''}
        </Typography>
        <Stack direction="row" spacing={1}>
          {p.configurado && (
            <Button variant="text" color="error" startIcon={<Trash2 size={16} aria-hidden />} onClick={() => setQuitando(true)} disabled={actualizar.isPending}>
              {t('fuentesOficiales.plataforma.quitar')}
            </Button>
          )}
          <Button variant="contained" onClick={() => guardar()} disabled={actualizar.isPending} startIcon={actualizar.isPending ? <IconoCarga /> : undefined}>
            {t('fuentesOficiales.plataforma.guardar')}
          </Button>
        </Stack>
      </Stack>
      {quitando && (
        <DialogoConfirmacion
          titulo={t('fuentesOficiales.plataforma.quitarTitulo')}
          mensaje={t('fuentesOficiales.plataforma.quitarMensaje')}
          confirmar={t('fuentesOficiales.plataforma.quitar')}
          ocupado={actualizar.isPending}
          onConfirmar={() => guardar(true)}
          onCerrar={() => setQuitando(false)}
        />
      )}
    </Box>
  );
}
