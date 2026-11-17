import { Box, Button, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type { TenantDto } from '@validasoft/api-client';
import { formatearFecha } from '@validasoft/ui';
import { Plug } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorRecuperable, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useSistemasDeGrupo } from './apiIdentidad';
import { DialogoSistemasDeGrupo } from './DialogoSistemasDeGrupo';

/** Los sistemas integrados del grupo en solo lectura; «Gestionar» abre el diálogo que ya los desactiva y reactiva (con la passkey de quien opera). */
export function SeccionSistemas({ tenant }: { tenant: TenantDto }) {
  const { t } = useTranslation();
  const sistemas = useSistemasDeGrupo(tenant.id, true);
  const [gestionando, setGestionando] = useState(false);
  const titulo = t('plataforma.ficha.sistemas.titulo');
  return (
    <Tarjeta
      titulo={titulo}
      etiqueta={titulo}
      acciones={
        <Button size="small" variant="outlined" startIcon={<Plug size={14} aria-hidden />} onClick={() => setGestionando(true)} aria-label={t('plataforma.ficha.sistemas.gestionarDe', { grupo: tenant.nombre })}>
          {t('plataforma.ficha.sistemas.gestionar')}
        </Button>
      }
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('plataforma.ficha.sistemas.ayuda')}
      </Typography>
      {sistemas.isError && <ErrorRecuperable mensaje={mensajeDeError(sistemas.error, t)} onReintentar={() => void sistemas.refetch()} />}
      {sistemas.isPending && <Skeleton variant="rounded" height={56} role="status" aria-busy aria-label={t('comun.cargando')} />}
      {sistemas.data?.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('consola.sistemas.vacio')}
        </Typography>
      )}
      {sistemas.data?.map((s) => (
        <Box key={s.id} sx={{ py: 1, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0, pt: 0 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography component="span" sx={{ fontWeight: 600 }}>
              {s.nombre}
            </Typography>
            <Chip size="small" variant="outlined" label={s.codigo} sx={{ fontFamily: (th) => th.typography.mono.fontFamily }} />
            <Chip size="small" variant="outlined" color={s.activo ? 'success' : 'default'} label={s.activo ? t('comun.activo') : t('comun.inactivo')} />
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('consola.sistemas.detalle', { fecha: formatearFecha(s.creadoEn), count: s.origenesPermitidos.length })}
          </Typography>
        </Box>
      ))}
      {gestionando && <DialogoSistemasDeGrupo tenantId={tenant.id} grupo={tenant.nombre} onCerrar={() => setGestionando(false)} />}
    </Tarjeta>
  );
}
