import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { TipoVinculoDto, VinculoDto } from '@validalo/api-client';
import { FormularioDeDialogo } from '@validalo/ui';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { useAvisos } from '../../../shared/useAvisos';
import { useActualizarAtributos } from '../api';
import { CamposDeAtributos } from './CamposDeAtributos';
import { cuerpoDeAtributos, validarAtributos, valoresIniciales, type ValoresDeAtributos } from './modelo';

interface Props {
  vinculo: VinculoDto;
  /** El tipo de vínculo del vínculo: sus atributos permitidos son los campos del formulario. */
  tipo: TipoVinculoDto;
  empresaId: string;
  onCerrar: () => void;
}

/**
 * «Editar atributos» del detalle del vínculo: un formulario generado desde los atributos permitidos de su tipo (un control por tipo, los obligatorios marcados y validados)
 * que guarda con `PATCH /vinculos/{id}/atributos`. Lo que se deja vacío se quita del vínculo.
 */
export function DialogoEditarAtributos({ vinculo, tipo, empresaId, onCerrar }: Props) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const permitidos = tipo.atributosPermitidos;
  const iniciales = valoresIniciales(permitidos, vinculo.atributos);
  const [valores, setValores] = useState<ValoresDeAtributos>(iniciales);
  const [intentado, setIntentado] = useState(false);
  const guardar = useActualizarAtributos(empresaId);

  const errores = validarAtributos(permitidos, valores);
  const cambiado = JSON.stringify(cuerpoDeAtributos(permitidos, valores)) !== JSON.stringify(cuerpoDeAtributos(permitidos, iniciales));

  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    guardar.mutate(
      { vinculo, atributos: cuerpoDeAtributos(permitidos, valores) },
      {
        onSuccess: () => {
          mostrar(t('atributosVinculo.guardado'), 'success');
          onCerrar();
        },
      },
    );
  };

  return (
    <Dialog open onClose={guardar.isPending ? undefined : onCerrar} fullWidth maxWidth="sm" aria-labelledby="titulo-editar-atributos">
      <FormularioDeDialogo onSubmit={enviar}>
        <DialogTitle id="titulo-editar-atributos">
          {t('atributosVinculo.dialogoTitulo')}
          <Typography variant="body2" component="span" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
            {t('atributosVinculo.dialogoAyuda')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {guardar.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mensajeDeError(guardar.error, t)}
            </Alert>
          )}
          <CamposDeAtributos
            atributos={permitidos}
            valores={valores}
            onCambiar={(clave, valor) => setValores((previos) => ({ ...previos, [clave]: valor }))}
            errores={intentado ? errores : {}}
            deshabilitado={guardar.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onCerrar} disabled={guardar.isPending} sx={{ color: 'text.primary' }}>
            {t('atributosVinculo.cancelar')}
          </Button>
          <Button type="submit" variant="contained" disabled={guardar.isPending || !cambiado} startIcon={guardar.isPending ? <IconoCarga /> : undefined}>
            {t('atributosVinculo.guardar')}
          </Button>
        </DialogActions>
      </FormularioDeDialogo>
    </Dialog>
  );
}
