import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import type { SistemaIntegradoDto, TenantDto, UsuarioDto } from '@validasoft/api-client';
import { formatearFecha, formatearFechaHora } from '@validasoft/ui';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogoConfirmacion, ErrorRecuperable, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { EstadoActivo } from '../configuracion/EstadoActivo';
import { useAdministradoresDeGrupo, useInvitarAdministrador } from './apiFicha';
import { useSistemasDeGrupo } from './apiIdentidad';
import { DialogoCorregirAdministrador } from './DialogoCorregirAdministrador';
import { BotonEditar } from './MarcoDeDialogo';

const MONO = { fontFamily: (th: { typography: { mono: { fontFamily?: string } } }) => th.typography.mono.fontFamily };

function FilaAdministrador({
  usuario,
  sistemas,
  conIngresoDirecto,
  onEditar,
  onInvitar,
}: {
  usuario: UsuarioDto;
  sistemas: readonly SistemaIntegradoDto[];
  conIngresoDirecto: boolean;
  onEditar: () => void;
  onInvitar: () => void;
}) {
  const { t } = useTranslation();
  const nombreDelSistema = (id: string) => {
    const s = sistemas.find((x) => x.id === id);
    return s?.codigo ?? id;
  };
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', py: 1.25 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography component="span" sx={{ fontWeight: 600 }}>
            {usuario.nombre}
          </Typography>
          <EstadoActivo activo={usuario.activo} texto={usuario.activo ? t('comun.activo') : t('comun.inactivo')} />
        </Stack>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {usuario.correo}
        </Typography>
        {usuario.identidades.length > 0
          ? usuario.identidades.map((i) => (
              <Typography key={i.sistemaId} variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                {t('plataforma.ficha.administradores.usuarioEn', { sistema: nombreDelSistema(i.sistemaId) })}: <Box component="span" sx={MONO}>{i.idExterno}</Box>
              </Typography>
            ))
          : sistemas.length > 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('plataforma.ficha.administradores.sinEnlazar')}
              </Typography>
            )}
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5, mb: 0 }}>
          {usuario.ultimoAcceso ? t('plataforma.ficha.administradores.ultimoIngreso', { fecha: formatearFechaHora(usuario.ultimoAcceso) }) : t('plataforma.ficha.administradores.nuncaIngreso')}
          {' · '}
          {(usuario.passkeys ?? 0) > 0 ? t('plataforma.ficha.administradores.passkeys', { count: usuario.passkeys ?? 0 }) : t('plataforma.ficha.administradores.sinPasskey')}
          {usuario.invitadoEn && ` · ${t('plataforma.ficha.administradores.invitadoEl', { fecha: formatearFecha(usuario.invitadoEn) })}`}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {conIngresoDirecto && usuario.activo && (
          <Button size="small" variant="text" startIcon={<Mail size={14} aria-hidden />} onClick={onInvitar} aria-label={t('plataforma.ficha.administradores.reenviarA', { nombre: usuario.nombre })}>
            {t('plataforma.ficha.administradores.reenviar')}
          </Button>
        )}
        <BotonEditar etiqueta={t('plataforma.ficha.administradores.editarA', { nombre: usuario.nombre })} onClick={onEditar} texto={t('plataforma.ficha.administradores.editar')} />
      </Stack>
    </Stack>
  );
}

/**
 * Quienes administran el grupo (el rol Administrador): su nombre, correo, el usuario con el que los reconoce cada sistema integrado, si están activos, su
 * último ingreso y cuántas passkeys tienen. «Editar» corrige el nombre, el correo y esos usuarios; «Reenviar invitación» manda de nuevo el correo para entrar
 * directo (solo si el grupo admite ese modo).
 */
export function SeccionAdministradores({ tenant }: { tenant: TenantDto }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const administradores = useAdministradoresDeGrupo(tenant.id);
  const sistemas = useSistemasDeGrupo(tenant.id, true);
  const invitar = useInvitarAdministrador(tenant.id);
  const [editando, setEditando] = useState<UsuarioDto | null>(null);
  const [invitando, setInvitando] = useState<UsuarioDto | null>(null);
  const conIngresoDirecto = (tenant.ingreso?.modos ?? []).includes('Directo');
  const titulo = t('plataforma.ficha.administradores.titulo');

  const confirmarInvitacion = () => {
    if (!invitando) return;
    const { id, correo } = invitando;
    invitar.mutate(id, {
      onSuccess: () => mostrar(t('plataforma.ficha.administradores.reenviada', { correo })),
      onError: (error) => mostrar(mensajeDeError(error, t), 'error'),
      onSettled: () => setInvitando(null),
    });
  };

  return (
    <Tarjeta titulo={titulo} etiqueta={titulo}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('plataforma.ficha.administradores.ayuda')}
      </Typography>
      {administradores.isError && <ErrorRecuperable mensaje={mensajeDeError(administradores.error, t)} onReintentar={() => void administradores.refetch()} />}
      {administradores.isPending && <Skeleton variant="rounded" height={88} role="status" aria-busy aria-label={t('comun.cargando')} />}
      {administradores.data?.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('plataforma.ficha.administradores.vacio')} {t('plataforma.ficha.administradores.vacioAyuda')}
        </Typography>
      )}
      {administradores.data && administradores.data.length > 0 && (
        <Box role="list" aria-label={t('plataforma.ficha.administradores.lista')}>
          {administradores.data.map((u) => (
            <Box key={u.id} role="listitem" sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
              <FilaAdministrador usuario={u} sistemas={sistemas.data ?? []} conIngresoDirecto={conIngresoDirecto} onEditar={() => setEditando(u)} onInvitar={() => setInvitando(u)} />
            </Box>
          ))}
        </Box>
      )}
      {editando && <DialogoCorregirAdministrador tenant={tenant} usuario={editando} onCerrar={() => setEditando(null)} />}
      {invitando && (
        <DialogoConfirmacion
          titulo={t('plataforma.ficha.administradores.reenviarTitulo')}
          subtitulo={invitando.nombre}
          mensaje={t('plataforma.ficha.administradores.reenviarTexto', { correo: invitando.correo })}
          confirmar={t('plataforma.ficha.administradores.reenviarConfirmar')}
          tono="primary"
          ocupado={invitar.isPending}
          onConfirmar={confirmarInvitacion}
          onCerrar={() => setInvitando(null)}
        />
      )}
    </Tarjeta>
  );
}
