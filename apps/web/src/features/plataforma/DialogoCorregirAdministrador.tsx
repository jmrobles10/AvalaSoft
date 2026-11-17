import { Alert, Checkbox, FormControlLabel, Skeleton, TextField } from '@mui/material';
import type { TenantDto, UsuarioDto } from '@validasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { useCorregirAdministrador } from './apiFicha';
import { MarcoDeDialogo } from './MarcoDeDialogo';
import {
  borradorDeAdministrador,
  cambiaElCorreo,
  codigoDeSistema,
  cuerpoCorregirAdministrador,
  hayCambiosDeAdministrador,
  sistemasDeLaPersona,
  validarAdministrador,
  type BorradorDeAdministrador,
  type ErrorDeAdministrador,
} from './modeloFicha';
import { useSistemasDeGrupo } from './apiIdentidad';

const MONO = { '& input': { fontFamily: (th: { typography: { mono: { fontFamily?: string } } }) => th.typography.mono.fontFamily } };

/**
 * Corregir el nombre, el correo y el usuario con el que cada sistema integrado reconoce a una persona del grupo. Cambiar el correo cierra sus sesiones y revoca
 * sus passkeys (el aviso lo dice antes de guardar); si el grupo admite el ingreso directo, ofrece mandar la invitación al correo nuevo.
 */
export function DialogoCorregirAdministrador({ tenant, usuario, onCerrar }: { tenant: TenantDto; usuario: UsuarioDto; onCerrar: () => void }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const corregir = useCorregirAdministrador(tenant.id, usuario.id);
  const sistemas = useSistemasDeGrupo(tenant.id, true);
  const [b, setB] = useState<BorradorDeAdministrador>(() => borradorDeAdministrador(usuario));
  const [tocados, setTocados] = useState<ReadonlySet<ErrorDeAdministrador>>(new Set());
  const [invitar, setInvitar] = useState(true);
  const errores = validarAdministrador(b);
  const cambios = hayCambiosDeAdministrador(b, usuario);
  const cambioElCorreo = cambiaElCorreo(b, usuario) && errores.every((e) => e !== 'correo-invalido');
  const conIngresoDirecto = (tenant.ingreso?.modos ?? []).includes('Directo');
  const conIngresoDelegado = (tenant.ingreso?.modos ?? []).includes('Delegado');
  const puedeInvitar = cambioElCorreo && conIngresoDirecto && usuario.activo;
  const campos = sistemasDeLaPersona(sistemas.data ?? [], usuario);
  const cambiar = (parcial: Partial<BorradorDeAdministrador>) => setB((previo) => ({ ...previo, ...parcial }));
  const tocar = (e: ErrorDeAdministrador) => setTocados((previos) => new Set([...previos, e]));
  const error = (e: ErrorDeAdministrador) => (errores.includes(e) && tocados.has(e) ? t(`plataforma.ficha.administradores.dialogo.errores.${e}`) : null);

  const enviar = () =>
    corregir.mutate(cuerpoCorregirAdministrador(b, usuario, puedeInvitar && invitar), {
      onSuccess: (guardado) => {
        mostrar(t(cambioElCorreo ? 'plataforma.ficha.administradores.dialogo.guardadoConAviso' : 'plataforma.ficha.administradores.dialogo.guardado', { nombre: guardado.nombre }));
        onCerrar();
      },
    });

  const errorNombre = error('nombre-requerido');
  const errorCorreo = error('correo-invalido');
  return (
    <MarcoDeDialogo
      idTitulo="titulo-corregir-administrador"
      titulo={t('plataforma.ficha.administradores.dialogo.titulo')}
      subtitulo={tenant.nombre}
      ocupado={corregir.isPending}
      sinEnviar={errores.length > 0 || !cambios || sistemas.isPending}
      falta={errores[0] ? t(`plataforma.ficha.administradores.dialogo.errores.${errores[0]}`) : undefined}
      textoEnviar={t('comun.guardar')}
      onEnviar={enviar}
      onCerrar={onCerrar}
    >
      {corregir.isError && <Alert severity="error">{mensajeDeError(corregir.error, t)}</Alert>}
      {sistemas.isError && <Alert severity="error">{mensajeDeError(sistemas.error, t)}</Alert>}
      <TextField
        required
        label={t('plataforma.ficha.administradores.dialogo.nombre')}
        value={b.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        onBlur={() => tocar('nombre-requerido')}
        error={errorNombre !== null}
        helperText={errorNombre}
        slotProps={{ htmlInput: { autoComplete: 'off' } }}
      />
      <TextField
        required
        label={t('plataforma.ficha.administradores.dialogo.correo')}
        type="email"
        value={b.correo}
        onChange={(e) => cambiar({ correo: e.target.value })}
        onBlur={() => tocar('correo-invalido')}
        error={errorCorreo !== null}
        helperText={errorCorreo}
        slotProps={{ htmlInput: { spellCheck: false, autoComplete: 'off' } }}
      />
      {cambioElCorreo && <Alert severity="warning">{t('plataforma.ficha.administradores.dialogo.avisoCorreo')}</Alert>}
      {puedeInvitar && (
        <FormControlLabel
          control={<Checkbox checked={invitar} onChange={(e) => setInvitar(e.target.checked)} />}
          label={t('plataforma.ficha.administradores.dialogo.invitar')}
          sx={{ mt: '-8px !important' }}
        />
      )}
      {sistemas.isPending && <Skeleton variant="rounded" height={56} role="status" aria-busy aria-label={t('plataforma.ficha.administradores.dialogo.cargandoSistemas')} />}
      {campos.map((sistema, i) => (
        <TextField
          key={sistema.id}
          label={t('plataforma.ficha.administradores.dialogo.usuarioEn', { sistema: codigoDeSistema(sistema) })}
          value={b.ids[sistema.id] ?? ''}
          onChange={(e) => cambiar({ ids: { ...b.ids, [sistema.id]: e.target.value } })}
          helperText={i === 0 ? t('plataforma.ficha.administradores.dialogo.usuarioEnAyuda') : undefined}
          slotProps={{ htmlInput: { spellCheck: false, autoComplete: 'off' } }}
          sx={MONO}
        />
      ))}
      {conIngresoDelegado && <Alert severity="info">{t('plataforma.ficha.administradores.dialogo.avisoSistema')}</Alert>}
    </MarcoDeDialogo>
  );
}
