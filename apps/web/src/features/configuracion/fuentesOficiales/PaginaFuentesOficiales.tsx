import { Alert, Box, Button, Chip, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { SCOPES, type FuenteOficialConfigDto, type FuentesOficialesConfigDto, type ProveedorDeFuenteDto } from '@validalo/api-client';
import { CampoNumero } from '@validalo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EncabezadoPagina, ErrorRecuperable, IconoCarga, SinPermiso, Tarjeta } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { useAvisos } from '../../../shared/useAvisos';
import { usePermisos } from '../../../shared/usePermisos';
import { useEmpresaActiva } from '../../empresas/useEmpresas';
import { useActualizarFuentesOficiales, useFuentesOficiales } from '../../fuentesOficiales/api';
import { borradorDeCredenciales, credencialesADto, diasDeMonitoreo, esFuenteOficial, type BorradorDeCredenciales } from '../../fuentesOficiales/modelo';

/**
 * Fuentes oficiales de la empresa activa (FO-5, FO-7): con qué proveedor se consulta el RUES y la DIAN (el de la plataforma, el de la instalación o uno
 * propio), las credenciales propias de solo escritura («Clave configurada · …1234») y cada cuánto se reconsultan los vínculos activos (opcional; apagada
 * por omisión). Los flujos piden cada fuente por tipo de vínculo, como bloqueante o informativa.
 */
export function PaginaFuentesOficiales() {
  const { t } = useTranslation();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puedeLeer = permisos.puede(SCOPES.configuracionLeer);
  const puedeEscribir = permisos.puede(SCOPES.configuracionEscribir);
  const consulta = useFuentesOficiales(empresa.id, puedeLeer);

  if (!puedeLeer) return <SinPermiso seccion={t('nav.fuentes-oficiales')} />;

  return (
    <>
      <EncabezadoPagina titulo={t('fuentesOficiales.configuracion.titulo')} subtitulo={t('fuentesOficiales.configuracion.subtitulo', { empresa: empresa.nombre })} />
      {consulta.isPending && <Skeleton variant="rounded" height={240} role="status" aria-busy aria-label={t('comun.cargando')} />}
      {consulta.isError && <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />}
      {consulta.data && <Contenido empresaId={empresa.id} datos={consulta.data} puedeEscribir={puedeEscribir} />}
    </>
  );
}

function Contenido({ empresaId, datos, puedeEscribir }: { empresaId: string; datos: FuentesOficialesConfigDto; puedeEscribir: boolean }) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('fuentesOficiales.configuracion.vigencia', { dias: String(datos.vigenciaDias) })} {t('fuentesOficiales.configuracion.habeasData')}</Alert>
      {datos.fuentes.map((fuente) => (
        <Fuente key={fuente.fuente} empresaId={empresaId} fuente={fuente} puedeEscribir={puedeEscribir} />
      ))}
      <Monitoreo empresaId={empresaId} dias={datos.diasMonitoreo} puedeEscribir={puedeEscribir} />
    </Stack>
  );
}

function Fuente({ empresaId, fuente, puedeEscribir }: { empresaId: string; fuente: FuenteOficialConfigDto; puedeEscribir: boolean }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const actualizar = useActualizarFuentesOficiales(empresaId);
  const elegir = (proveedor: string) =>
    actualizar.mutate({ elecciones: [{ fuente: fuente.fuente, proveedor }] }, { onSuccess: () => mostrar(t('fuentesOficiales.configuracion.guardado')), onError: (e) => mostrar(mensajeDeError(e, t), 'error') });

  return (
    <Tarjeta
      titulo={fuente.nombre}
      etiqueta={fuente.nombre}
      acciones={
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
          {fuente.proveedorEfectivo ? t('fuentesOficiales.configuracion.efectivo', { proveedor: t(`fuentesOficiales.proveedores.${fuente.proveedorEfectivo as 'Simulado'}`, { defaultValue: fuente.proveedorEfectivo }) }) : t('fuentesOficiales.configuracion.sinEfectivo')}
        </Typography>
      }
    >
      <Stack spacing={2}>
        <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{fuente.descripcion}</Typography>
        <TextField
          select
          size="small"
          label={t('fuentesOficiales.configuracion.proveedor')}
          value={fuente.proveedor ?? ''}
          onChange={(e) => elegir(e.target.value)}
          disabled={!puedeEscribir || actualizar.isPending}
          sx={{ maxWidth: 420 }}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="">{t('fuentesOficiales.configuracion.predeterminado')}</MenuItem>
          {fuente.proveedores.map((p) => (
            <MenuItem key={p.nombre} value={p.nombre} disabled={!p.habilitadoEnInstalacion}>
              {t(`fuentesOficiales.proveedores.${p.nombre as 'Simulado'}`, { defaultValue: p.nombre })}
              {!p.habilitadoEnInstalacion ? ` · ${t('fuentesOficiales.configuracion.noHabilitado')}` : ''}
            </MenuItem>
          ))}
        </TextField>
        {actualizar.isError && <Alert severity="error">{mensajeDeError(actualizar.error, t)}</Alert>}
        {fuente.proveedores.map((p) => (
          <Proveedor key={p.nombre} empresaId={empresaId} fuente={fuente.fuente} proveedor={p} puedeEscribir={puedeEscribir} />
        ))}
      </Stack>
    </Tarjeta>
  );
}

function Proveedor({ empresaId, fuente, proveedor: p, puedeEscribir }: { empresaId: string; fuente: string; proveedor: ProveedorDeFuenteDto; puedeEscribir: boolean }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const actualizar = useActualizarFuentesOficiales(empresaId);
  const [borrador, setBorrador] = useState<BorradorDeCredenciales>(() => borradorDeCredenciales(p));
  const cambiar = (cambio: Partial<BorradorDeCredenciales>) => setBorrador((b) => ({ ...b, ...cambio }));
  if (!esFuenteOficial(fuente)) return null;
  const guardar = (quitar = false) =>
    actualizar.mutate(
      { credenciales: credencialesADto(fuente, p.nombre, borrador, quitar) },
      {
        onSuccess: (datos) => {
          mostrar(t('fuentesOficiales.configuracion.guardado'));
          const nuevo = datos.fuentes.find((f) => f.fuente === fuente)?.proveedores.find((x) => x.nombre === p.nombre);
          if (nuevo) setBorrador(borradorDeCredenciales(nuevo));
        },
      },
    );

  return (
    <Box component="section" aria-label={t(`fuentesOficiales.proveedores.${p.nombre as 'Simulado'}`, { defaultValue: p.nombre })} sx={{ border: 1, borderColor: 'divider', borderRadius: (th) => `${String(th.radio.sm)}px`, p: 1.5 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 500 }}>
          {t(`fuentesOficiales.proveedores.${p.nombre as 'Simulado'}`, { defaultValue: p.nombre })}
        </Typography>
        <Chip size="small" variant="outlined" color={p.disponible ? 'success' : 'default'} label={p.disponible ? t('fuentesOficiales.configuracion.disponible') : t('fuentesOficiales.configuracion.noDisponible')} />
        {!p.habilitadoEnInstalacion && <Chip size="small" variant="outlined" label={t('fuentesOficiales.configuracion.noHabilitado')} />}
      </Stack>
      <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>{t(`fuentesOficiales.descripciones.${p.nombre as 'Simulado'}`, { defaultValue: '' })}</Typography>
      {p.real && (
        <>
          {p.credencialesDeLaPlataforma && <Typography sx={{ fontSize: 12, mt: 0.5 }}>{t('fuentesOficiales.configuracion.credencialesDeLaPlataforma')}</Typography>}
          <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>
            {p.credencialesPropias ? t('fuentesOficiales.configuracion.configurada', { ultimos: p.ultimosCuatroClave ?? '' }) : t('fuentesOficiales.configuracion.sinCredenciales')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mt: 1.5 }}>
            <TextField size="small" label={t('fuentesOficiales.configuracion.usuario')} value={borrador.usuario} onChange={(e) => cambiar({ usuario: e.target.value })} disabled={!puedeEscribir} />
            <TextField
              size="small"
              type="password"
              autoComplete="new-password"
              label={t('fuentesOficiales.configuracion.clave')}
              value={borrador.clave}
              onChange={(e) => cambiar({ clave: e.target.value })}
              helperText={t('fuentesOficiales.configuracion.claveAyuda')}
              disabled={!puedeEscribir}
            />
            <TextField size="small" label={t('fuentesOficiales.configuracion.url')} value={borrador.urlBase} onChange={(e) => cambiar({ urlBase: e.target.value })} disabled={!puedeEscribir} />
            <TextField size="small" label={t('fuentesOficiales.configuracion.notas')} value={borrador.notas} onChange={(e) => cambiar({ notas: e.target.value })} disabled={!puedeEscribir} />
          </Box>
          {actualizar.isError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {mensajeDeError(actualizar.error, t)}
            </Alert>
          )}
          {puedeEscribir && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
              {p.credencialesPropias && (
                <Button variant="text" color="error" onClick={() => guardar(true)} disabled={actualizar.isPending}>
                  {t('fuentesOficiales.configuracion.quitar')}
                </Button>
              )}
              <Button variant="contained" onClick={() => guardar()} disabled={actualizar.isPending} startIcon={actualizar.isPending ? <IconoCarga /> : undefined}>
                {t('fuentesOficiales.configuracion.guardar')}
              </Button>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}

function Monitoreo({ empresaId, dias, puedeEscribir }: { empresaId: string; dias: number; puedeEscribir: boolean }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const actualizar = useActualizarFuentesOficiales(empresaId);
  const [texto, setTexto] = useState(dias === 0 ? '' : String(dias));
  const [visto, setVisto] = useState(dias);
  if (visto !== dias) {
    setVisto(dias);
    setTexto(dias === 0 ? '' : String(dias));
  }

  return (
    <Tarjeta titulo={t('fuentesOficiales.configuracion.monitoreo.titulo')} etiqueta={t('fuentesOficiales.configuracion.monitoreo.titulo')}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <CampoNumero
          etiqueta={t('fuentesOficiales.configuracion.monitoreo.dias')}
          valor={texto}
          onCambiar={setTexto}
          ayuda={t('fuentesOficiales.configuracion.monitoreo.ayuda')}
          deshabilitado={!puedeEscribir}
          maxDigitos={3}
          sx={{ width: 280 }}
        />
        {puedeEscribir && (
          <Button
            variant="contained"
            disabled={actualizar.isPending}
            startIcon={actualizar.isPending ? <IconoCarga /> : undefined}
            sx={{ mt: '4px' }}
            onClick={() =>
              actualizar.mutate({ diasMonitoreo: diasDeMonitoreo(texto) }, { onSuccess: () => mostrar(t('fuentesOficiales.configuracion.guardado')), onError: (e) => mostrar(mensajeDeError(e, t), 'error') })
            }
          >
            {t('fuentesOficiales.configuracion.monitoreo.guardar')}
          </Button>
        )}
      </Stack>
    </Tarjeta>
  );
}
