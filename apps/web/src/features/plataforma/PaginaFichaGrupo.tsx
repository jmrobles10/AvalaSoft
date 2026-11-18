import { Button, Chip, Stack } from '@mui/material';
import type { GrupoDto } from '@avalasoft/api-client';
import { CabeceraEsqueleto, DosColumnas, EsqueletoTarjeta } from '@avalasoft/ui';
import { Gauge } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router';
import { EncabezadoPagina, EnlaceVolver, ErrorRecuperable } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useGrupo } from './api';
import { SeccionAdministradores } from './SeccionAdministradores';
import { SeccionEmpresas } from './SeccionEmpresas';
import { SeccionGrupo } from './SeccionGrupo';
import { SeccionIngreso } from './SeccionIngreso';
import { SeccionSistemas } from './SeccionSistemas';

function Ficha({ grupo }: { grupo: GrupoDto }) {
  const { t } = useTranslation();
  const { tenant } = grupo;
  return (
    <>
      <EncabezadoPagina
        antes={<EnlaceVolver a="/plataforma/grupos">{t('plataforma.ficha.volver')}</EnlaceVolver>}
        titulo={
          <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{tenant.nombre}</span>
            {!tenant.activo && <Chip size="small" label={t('plataforma.grupos.inactivo')} />}
          </Stack>
        }
        tituloCompleto={tenant.nombre}
        subtitulo={t('plataforma.ficha.subtitulo')}
        acciones={
          <Button component={RouterLink} to={`/plataforma/grupos/${tenant.id}/plan`} variant="outlined" startIcon={<Gauge size={16} aria-hidden />}>
            {t('plataforma.ficha.planDelGrupo')}
          </Button>
        }
      />
      <DosColumnas
        izquierda={
          <>
            <SeccionGrupo tenant={tenant} />
            <SeccionEmpresas grupo={grupo} />
            <SeccionSistemas tenant={tenant} />
          </>
        }
        derecha={
          <>
            <SeccionAdministradores tenant={tenant} />
            <SeccionIngreso tenant={tenant} />
          </>
        }
      />
    </>
  );
}

/**
 * La ficha de un grupo en la consola de Plataforma (decisión FG): lo que se dio de alta —el grupo, sus empresas, quien lo administra, cómo entra su gente y sus
 * sistemas— en solo lectura, cada sección con su «Editar». Antes de esto, un error de digitación en el alta (el correo del administrador, el nombre del grupo) no
 * tenía arreglo.
 */
export function PaginaFichaGrupo() {
  const { t } = useTranslation();
  const { tenantId = '' } = useParams();
  const grupo = useGrupo(tenantId);

  if (grupo.isError) return <ErrorRecuperable mensaje={mensajeDeError(grupo.error, t)} onReintentar={() => void grupo.refetch()} />;
  if (!grupo.data) {
    return (
      <div role="status" aria-busy="true" aria-label={t('plataforma.ficha.cargando')}>
        <CabeceraEsqueleto />
        <DosColumnas izquierda={<><EsqueletoTarjeta lineas={5} /><EsqueletoTarjeta lineas={3} /></>} derecha={<><EsqueletoTarjeta lineas={4} /><EsqueletoTarjeta lineas={3} /></>} />
      </div>
    );
  }

  return <Ficha key={tenantId} grupo={grupo.data} />;
}
