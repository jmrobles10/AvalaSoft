import { Alert, Checkbox, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import type { TenantDto } from '@avalasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { HORAS_DE_SESION, minutosDeInactividad, sinCambios } from '../configuracion/ingreso/modelo';
import { useCambiarIngresoDelGrupo } from './apiFicha';
import { MarcoDeDialogo } from './MarcoDeDialogo';
import { borradorDeIngreso, cuerpoIngreso, type BorradorDeIngreso } from './modeloFicha';

/**
 * Cómo entran las personas del grupo: la misma política que su administrador ve en Configuración › Ingreso (modos, duración y cierre por inactividad de la
 * sesión directa, passkey para todos), desde la consola. Al apagar el ingreso directo se cierran las sesiones directas abiertas.
 */
export function DialogoIngresoDelGrupo({ tenant, onCerrar }: { tenant: TenantDto; onCerrar: () => void }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const cambiar = useCambiarIngresoDelGrupo(tenant.id);
  const inicial = tenant.ingreso ?? { modos: ['Delegado'], sesionHoras: 8, inactividadMinutos: 30, passkeyParaTodos: false };
  const [b, setB] = useState<BorradorDeIngreso>(() => borradorDeIngreso(inicial));
  const sinModo = !b.delegado && !b.directo;
  const actual = cuerpoIngreso(b);
  const cambio = !sinCambios(inicial, actual);
  const parcial = (cambios: Partial<BorradorDeIngreso>) => setB((previo) => ({ ...previo, ...cambios }));

  const enviar = () =>
    cambiar.mutate(actual, {
      onSuccess: () => {
        mostrar(t('plataforma.ficha.ingreso.guardado', { grupo: tenant.nombre }));
        onCerrar();
      },
    });

  return (
    <MarcoDeDialogo
      idTitulo="titulo-ingreso-del-grupo"
      titulo={t('plataforma.ficha.ingreso.editar')}
      subtitulo={tenant.nombre}
      ocupado={cambiar.isPending}
      sinEnviar={sinModo || !cambio}
      falta={sinModo ? t('errores.modos-de-ingreso-invalidos') : undefined}
      textoEnviar={t('comun.guardar')}
      onEnviar={enviar}
      onCerrar={onCerrar}
    >
      {cambiar.isError && <Alert severity="error">{mensajeDeError(cambiar.error, t)}</Alert>}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {t('plataforma.ficha.ingreso.dialogoAyuda')}
      </Typography>
      <Stack component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
        <Typography component="legend" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {t('plataforma.ficha.ingreso.modos')}
        </Typography>
        <FormControlLabel control={<Checkbox checked={b.delegado} onChange={(e) => parcial({ delegado: e.target.checked })} />} label={t('ingresoPlataforma.Delegado')} />
        <FormControlLabel control={<Checkbox checked={b.directo} onChange={(e) => parcial({ directo: e.target.checked })} />} label={t('ingresoPlataforma.Directo')} />
      </Stack>
      {tenant.ingreso?.modos.includes('Directo') && !b.directo && !sinModo && <Alert severity="warning">{t('ingresoGrupo.advertenciaApagarDirecto')}</Alert>}
      {tenant.ingreso?.modos.includes('Delegado') && !b.delegado && !sinModo && <Alert severity="warning">{t('ingresoGrupo.advertenciaSoloDirecto')}</Alert>}
      <TextField select label={t('ingresoGrupo.sesion.horas')} value={b.sesionHoras} onChange={(e) => parcial({ sesionHoras: Number(e.target.value) })} disabled={!b.directo}>
        {[...new Set([...HORAS_DE_SESION, b.sesionHoras])]
          .sort((x, y) => x - y)
          .map((h) => (
            <MenuItem key={h} value={h}>
              {t('ingresoGrupo.sesion.hora', { count: h })}
            </MenuItem>
          ))}
      </TextField>
      <TextField
        select
        label={t('ingresoGrupo.sesion.inactividad')}
        value={Math.min(b.inactividadMinutos, b.sesionHoras * 60)}
        onChange={(e) => parcial({ inactividadMinutos: Number(e.target.value) })}
        disabled={!b.directo}
      >
        {[...new Set([...minutosDeInactividad(b.sesionHoras), Math.min(b.inactividadMinutos, b.sesionHoras * 60)])]
          .sort((x, y) => x - y)
          .map((m) => (
            <MenuItem key={m} value={m}>
              {m >= 60 && m % 60 === 0 ? t('ingresoGrupo.sesion.hora', { count: m / 60 }) : t('ingresoGrupo.sesion.minutos', { count: m })}
            </MenuItem>
          ))}
      </TextField>
      <FormControlLabel control={<Switch checked={b.passkeyParaTodos} onChange={(e) => parcial({ passkeyParaTodos: e.target.checked })} />} label={t('ingresoGrupo.passkey.todos')} />
    </MarcoDeDialogo>
  );
}
