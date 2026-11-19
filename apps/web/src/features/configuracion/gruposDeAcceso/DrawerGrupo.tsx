import { Alert, Box, Button, Drawer, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { GrupoDeAccesoDto } from '@validalo/api-client';
import { X } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { SelectorPermisos } from '../apiKeys/SelectorPermisos';
import { DESCRIPCION_MAXIMA, firmaDeGrupo, grupoDesde, grupoNuevo, NOMBRE_MAXIMO, PERMISOS_QUE_UN_GRUPO_NO_LLEVA, validarGrupo, type GrupoEnEditor } from './modelo';
import { SelectorSectores } from './SelectorSectores';

export interface DrawerGrupoProps {
  /** `null` = grupo nuevo. Un grupo predefinido se abre solo para verlo. */
  grupo: GrupoDeAccesoDto | null;
  guardando: boolean;
  error: unknown;
  onGuardar: (datos: GrupoEnEditor) => void;
  onCerrar: () => void;
}

/** Editor lateral de un grupo de acceso: nombre, permisos del catálogo y sectores de la ficha. Los predefinidos (los cuatro roles) solo se ven. */
export function DrawerGrupo({ grupo, guardando, error, onGuardar, onCerrar }: DrawerGrupoProps) {
  const { t } = useTranslation();
  const soloLectura = grupo?.predefinido === true;
  const nuevo = grupo === null;
  const [datos, setDatos] = useState<GrupoEnEditor>(() => (grupo ? grupoDesde(grupo) : grupoNuevo()));
  const [intentado, setIntentado] = useState(false);
  const errores = validarGrupo(datos, nuevo);
  const sinCambios = grupo !== null && firmaDeGrupo(datos) === firmaDeGrupo(grupoDesde(grupo));
  const mensaje = (codigo: (typeof errores)[number]) => (intentado && errores.includes(codigo) ? t(`gruposDeAcceso.errores.${codigo}`) : undefined);

  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    setIntentado(true);
    if (errores.length === 0) onGuardar(datos);
  };

  const titulo = soloLectura ? t('gruposDeAcceso.drawer.ver') : nuevo ? t('gruposDeAcceso.drawer.nuevo') : t('gruposDeAcceso.drawer.editar');

  return (
    <Drawer anchor="right" open onClose={guardando ? undefined : onCerrar} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 } }, 'aria-labelledby': 'titulo-grupo' } }}>
      <Box component="form" onSubmit={enviar} noValidate sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', px: 3, pt: 2.5, pb: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" id="titulo-grupo">
              {titulo}
            </Typography>
            {grupo && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {grupo.nombre}
              </Typography>
            )}
          </Box>
          <IconButton aria-label={t('comun.cerrar')} onClick={onCerrar} disabled={guardando}>
            <X size={16} />
          </IconButton>
        </Stack>

        <Stack spacing={2.5} sx={{ px: 3, py: 1.5, flex: 1, overflowY: 'auto' }}>
          {soloLectura && <Alert severity="info">{t('gruposDeAcceso.predefinidoAyuda')}</Alert>}
          {error !== null && error !== undefined && <Alert severity="error">{mensajeDeError(error, t)}</Alert>}

          <Stack spacing={2}>
            {nuevo && (
              <TextField
                required
                label={t('gruposDeAcceso.drawer.codigo')}
                value={datos.codigo}
                onChange={(e) => setDatos({ ...datos, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                error={mensaje('codigo-invalido') !== undefined}
                helperText={mensaje('codigo-invalido') ?? t('gruposDeAcceso.drawer.codigoAyuda')}
                slotProps={{ htmlInput: { maxLength: 40, autoComplete: 'off' } }}
              />
            )}
            <TextField
              required
              label={t('gruposDeAcceso.drawer.nombre')}
              value={datos.nombre}
              disabled={soloLectura}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              error={mensaje('nombre-requerido') !== undefined || mensaje('nombre-demasiado-largo') !== undefined}
              helperText={mensaje('nombre-requerido') ?? mensaje('nombre-demasiado-largo')}
              slotProps={{ htmlInput: { maxLength: NOMBRE_MAXIMO } }}
            />
            <TextField
              multiline
              minRows={2}
              label={t('gruposDeAcceso.drawer.descripcion')}
              value={datos.descripcion}
              disabled={soloLectura}
              onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
              error={mensaje('descripcion-demasiado-larga') !== undefined}
              helperText={mensaje('descripcion-demasiado-larga')}
              slotProps={{ htmlInput: { maxLength: DESCRIPCION_MAXIMA } }}
            />
          </Stack>

          <SelectorPermisos
            valor={datos.permisos}
            onCambiar={(permisos) => setDatos({ ...datos, permisos })}
            excluir={PERMISOS_QUE_UN_GRUPO_NO_LLEVA}
            etiqueta={t('gruposDeAcceso.drawer.permisos')}
            ayuda={t('gruposDeAcceso.drawer.permisosAyuda', { n: String(datos.permisos.length) })}
            soloLectura={soloLectura}
          />
          {mensaje('permisos-requeridos') && <Alert severity="error">{mensaje('permisos-requeridos')}</Alert>}

          <SelectorSectores valor={datos.sectores} onCambiar={(sectores) => setDatos({ ...datos, sectores })} soloLectura={soloLectura} />

          {!soloLectura && <Alert severity="info">{t('gruposDeAcceso.drawer.cambiosAplican')}</Alert>}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="text" onClick={onCerrar} disabled={guardando} sx={{ color: 'text.primary' }}>
            {soloLectura ? t('comun.cerrar') : t('comun.cancelar')}
          </Button>
          {!soloLectura && (
            <Button type="submit" variant="contained" disabled={guardando || sinCambios} startIcon={guardando ? <IconoCarga /> : undefined}>
              {nuevo ? t('gruposDeAcceso.drawer.crear') : t('gruposDeAcceso.drawer.guardar')}
            </Button>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
