import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import type { CampoCotejadoDto, DecisionCoincidencia } from '@avalasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';

export interface DialogoResolverDiferenciaProps {
  campo: CampoCotejadoDto;
  decision: DecisionCoincidencia;
  ocupado: boolean;
  error: unknown;
  onGuardar: (justificacion: string) => void;
  onCerrar: () => void;
}

/** Aceptar (vale 12 meses) o confirmar (la verificación falla; nunca rechaza sola) una diferencia con la fuente, siempre con justificación. */
export function DialogoResolverDiferencia({ campo, decision, ocupado, error, onGuardar, onCerrar }: DialogoResolverDiferenciaProps) {
  const { t } = useTranslation();
  const [justificacion, setJustificacion] = useState('');
  const [intentado, setIntentado] = useState(false);
  const vacia = justificacion.trim() === '';
  const confirmar = decision === 'Confirmada';
  const sinDato = t('fuentesOficiales.cotejo.sinDato');

  return (
    <Dialog open onClose={ocupado ? undefined : onCerrar} maxWidth={false} slotProps={{ paper: { sx: { width: 520, maxWidth: 'calc(100% - 32px)' } } }} aria-labelledby="titulo-resolver-diferencia">
      <DialogTitle id="titulo-resolver-diferencia">{confirmar ? t('fuentesOficiales.resolver.tituloConfirmar') : t('fuentesOficiales.resolver.tituloAceptar')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 500, mb: 1 }}>
          {t('fuentesOficiales.resolver.diferencia', {
            etiqueta: campo.etiqueta,
            oficial: campo.oficial ?? sinDato,
            contra: campo.referencia ?? t(`fuentesOficiales.cotejo.contra.${campo.contra}`),
            comparado: campo.comparado ?? sinDato,
          })}
        </Typography>
        <Alert severity={confirmar ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {confirmar ? t('fuentesOficiales.resolver.ayudaConfirmar') : t('fuentesOficiales.resolver.ayudaAceptar')}
        </Alert>
        <TextField
          label={t('fuentesOficiales.resolver.justificacion')}
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          multiline
          minRows={3}
          fullWidth
          required
          error={intentado && vacia}
          helperText={intentado && vacia ? t('cumplimiento.errores.justificacion-requerida') : t('fuentesOficiales.resolver.justificacionAyuda')}
          slotProps={{ htmlInput: { maxLength: 4000 } }}
        />
        {error !== null && error !== undefined && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mensajeDeError(error, t)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onCerrar} disabled={ocupado} sx={{ color: 'text.primary' }}>
          {t('comun.cancelar')}
        </Button>
        <Button
          variant="contained"
          color={confirmar ? 'error' : 'primary'}
          disabled={ocupado}
          startIcon={ocupado ? <IconoCarga /> : undefined}
          onClick={() => {
            setIntentado(true);
            if (!vacia) onGuardar(justificacion);
          }}
        >
          {t('fuentesOficiales.resolver.guardar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
