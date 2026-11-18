import { Stack, Typography } from '@mui/material';
import type { TenantDto } from '@avalasoft/api-client';
import { Dato, RejillaDatos } from '@avalasoft/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { DialogoIngresoDelGrupo } from './DialogoIngresoDelGrupo';
import { BotonEditar } from './MarcoDeDialogo';

/** Cómo entran las personas del grupo, en solo lectura: los modos, la duración y el cierre por inactividad de la sesión directa y si todas necesitan passkey. */
export function SeccionIngreso({ tenant }: { tenant: TenantDto }) {
  const { t } = useTranslation();
  const [editando, setEditando] = useState(false);
  const ingreso = tenant.ingreso;
  const titulo = t('plataforma.ficha.ingreso.titulo');
  const minutos = ingreso?.inactividadMinutos ?? 0;
  return (
    <Tarjeta
      titulo={titulo}
      etiqueta={titulo}
      acciones={ingreso && <BotonEditar etiqueta={t('plataforma.ficha.ingreso.editar')} onClick={() => setEditando(true)} />}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('plataforma.ficha.ingreso.ayuda')}
      </Typography>
      {ingreso && (
        <RejillaDatos columnas={2}>
          <Dato etiqueta={t('plataforma.ficha.ingreso.modos')} ancho>
            <Stack component="span" sx={{ display: 'flex' }}>
              {ingreso.modos.map((m) => (
                <span key={m}>{t(`ingresoPlataforma.${m === 'Directo' ? 'Directo' : 'Delegado'}`)}</span>
              ))}
            </Stack>
          </Dato>
          <Dato etiqueta={t('plataforma.ficha.ingreso.sesion')}>{t('ingresoGrupo.sesion.hora', { count: ingreso.sesionHoras })}</Dato>
          <Dato etiqueta={t('plataforma.ficha.ingreso.inactividad')}>
            {minutos >= 60 && minutos % 60 === 0 ? t('ingresoGrupo.sesion.hora', { count: minutos / 60 }) : t('ingresoGrupo.sesion.minutos', { count: minutos })}
          </Dato>
          <Dato etiqueta={t('plataforma.ficha.ingreso.passkeyParaTodos')}>{ingreso.passkeyParaTodos ? t('comun.si') : t('comun.no')}</Dato>
        </RejillaDatos>
      )}
      {editando && <DialogoIngresoDelGrupo tenant={tenant} onCerrar={() => setEditando(false)} />}
    </Tarjeta>
  );
}
