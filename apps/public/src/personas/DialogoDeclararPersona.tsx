import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../shared/errores';
import { useAvisos } from '../shared/useAvisos';
import { useDeclararRelacion } from './api';
import { cuerpoDeDeclaracion, DATOS_DE_PERSONA_VACIOS, ROLES, TIPOS_DE_DOCUMENTO, validarPersona, esRol, type DatosDePersona, type TipoDeDocumento } from './modelo';

const esTipoDeDocumento = (valor: string): valor is TipoDeDocumento => (TIPOS_DE_DOCUMENTO as readonly string[]).includes(valor);

/**
 * Agregar una persona relacionada (ADR-0010). Los errores aparecen al intentar guardar. Si la persona ya tiene bóveda por otra empresa se reutiliza:
 * el servidor la reconoce por su documento. En el celular ocupa toda la pantalla.
 */
export function DialogoDeclararPersona({ onCerrar }: { onCerrar: () => void }) {
  const { t } = useTranslation();
  const tema = useTheme();
  const pantallaCompleta = useMediaQuery(tema.breakpoints.down('sm'));
  const mostrar = useAvisos((s) => s.mostrar);
  const declarar = useDeclararRelacion();
  const [datos, setDatos] = useState<DatosDePersona>(DATOS_DE_PERSONA_VACIOS);
  const [intentado, setIntentado] = useState(false);
  const errores = validarPersona(datos);
  const cambiar = <K extends keyof DatosDePersona>(campo: K, valor: DatosDePersona[K]) => setDatos((d) => ({ ...d, [campo]: valor }));
  const conParticipacion = datos.rol === 'Socio' || datos.rol === 'BeneficiarioFinal' || datos.rol === 'MiembroDe';

  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    declarar.mutate(cuerpoDeDeclaracion({ ...datos, participacion: conParticipacion ? datos.participacion : '' }), {
      onSuccess: () => {
        mostrar(t('personas.nueva.exito', { nombre: datos.nombre.trim(), rol: t(`personas.roles.${datos.rol}`).toLowerCase() }));
        onCerrar();
      },
    });
  };

  return (
    <Dialog open onClose={declarar.isPending ? undefined : onCerrar} fullWidth maxWidth="sm" fullScreen={pantallaCompleta} aria-labelledby="titulo-nueva-persona">
      <form onSubmit={enviar} noValidate>
        <DialogTitle id="titulo-nueva-persona">{t('personas.nueva.titulo')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography sx={{ color: 'text.secondary' }}>{t('personas.nueva.ayuda')}</Typography>
            {declarar.isError && <Alert severity="error">{mensajeDeError(declarar.error, t)}</Alert>}
            <TextField select label={t('personas.nueva.rol')} value={datos.rol} onChange={(e) => esRol(e.target.value) && cambiar('rol', e.target.value)} required>
              {ROLES.map((rol) => (
                <MenuItem key={rol} value={rol}>
                  {t(`personas.roles.${rol}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('personas.nueva.nombre')}
              value={datos.nombre}
              onChange={(e) => cambiar('nombre', e.target.value)}
              required
              error={intentado && errores.nombre === true}
              helperText={intentado && errores.nombre ? t('personas.nueva.errores.nombre') : undefined}
              slotProps={{ htmlInput: { maxLength: 250, autoComplete: 'off' } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label={t('personas.nueva.tipoIdentificacion')}
                value={datos.tipoDocumento}
                onChange={(e) => esTipoDeDocumento(e.target.value) && cambiar('tipoDocumento', e.target.value)}
                required
                sx={{ minWidth: { sm: 240 } }}
              >
                {TIPOS_DE_DOCUMENTO.map((tipo) => (
                  <MenuItem key={tipo} value={tipo}>
                    {t(`personas.nueva.tipos.${tipo}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('personas.nueva.numero')}
                value={datos.numero}
                onChange={(e) => cambiar('numero', e.target.value)}
                required
                fullWidth
                error={intentado && errores.numero === true}
                helperText={intentado && errores.numero ? t('personas.nueva.errores.numero') : undefined}
                slotProps={{ htmlInput: { inputMode: 'text', autoComplete: 'off', maxLength: 30 } }}
              />
            </Stack>
            {conParticipacion && (
              <TextField
                label={t('personas.nueva.participacion')}
                value={datos.participacion}
                onChange={(e) => cambiar('participacion', e.target.value)}
                error={intentado && errores.participacion === true}
                helperText={intentado && errores.participacion ? t('personas.nueva.errores.participacion') : t('personas.nueva.participacionAyuda')}
                slotProps={{ htmlInput: { inputMode: 'decimal', autoComplete: 'off', maxLength: 8 } }}
              />
            )}
            <TextField
              label={t('personas.nueva.cargo')}
              value={datos.cargo}
              onChange={(e) => cambiar('cargo', e.target.value)}
              slotProps={{ htmlInput: { maxLength: 150, autoComplete: 'off' } }}
            />
            <FormControlLabel
              control={<Checkbox checked={datos.principal} onChange={(e) => cambiar('principal', e.target.checked)} />}
              label={t('personas.nueva.principal')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCerrar} disabled={declarar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" variant="contained" disabled={declarar.isPending}>
            {t('personas.nueva.guardar')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
