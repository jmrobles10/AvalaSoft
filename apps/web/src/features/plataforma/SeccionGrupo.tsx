import { Typography } from '@mui/material';
import type { TenantDto } from '@validasoft/api-client';
import { Dato, formatearFecha, RejillaDatos, ValorLargo } from '@validasoft/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../shared/componentes';
import { EstadoActivo } from '../configuracion/EstadoActivo';
import { DialogoCorregirGrupo } from './DialogoCorregirGrupo';
import { BotonEditar } from './MarcoDeDialogo';

/**
 * El grupo como se dio de alta: nombre, identificador, zona horaria, región, estado y fecha de creación, en solo lectura. «Editar» corrige el nombre, la
 * zona y la región; el identificador queda de solo lectura y la ayuda de abajo dice por qué.
 */
export function SeccionGrupo({ tenant }: { tenant: TenantDto }) {
  const { t } = useTranslation();
  const [editando, setEditando] = useState(false);
  return (
    <Tarjeta
      titulo={t('plataforma.ficha.grupo.titulo')}
      etiqueta={t('plataforma.ficha.grupo.titulo')}
      acciones={<BotonEditar etiqueta={t('plataforma.ficha.editarSeccion', { seccion: t('plataforma.ficha.grupo.titulo').toLowerCase() })} onClick={() => setEditando(true)} />}
    >
      <RejillaDatos columnas={2}>
        <Dato etiqueta={t('plataforma.ficha.grupo.nombre')}>{tenant.nombre}</Dato>
        <Dato etiqueta={t('plataforma.ficha.grupo.identificador')}>
          <ValorLargo valor={tenant.slug} mono />
        </Dato>
        <Dato etiqueta={t('plataforma.ficha.grupo.zona')}>
          <ValorLargo valor={tenant.zonaHoraria} mono />
        </Dato>
        <Dato etiqueta={t('plataforma.ficha.grupo.region')}>
          <ValorLargo valor={tenant.region} mono />
        </Dato>
        <Dato etiqueta={t('plataforma.ficha.grupo.estado')}>
          <EstadoActivo activo={tenant.activo} texto={tenant.activo ? t('comun.activo') : t('comun.inactivo')} />
        </Dato>
        <Dato etiqueta={t('plataforma.ficha.grupo.creado')}>{formatearFecha(tenant.creadoEn)}</Dato>
      </RejillaDatos>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1.5, mb: 0 }}>
        {t('plataforma.ficha.grupo.identificadorAyuda')}
      </Typography>
      {editando && <DialogoCorregirGrupo grupo={tenant} onCerrar={() => setEditando(false)} />}
    </Tarjeta>
  );
}
