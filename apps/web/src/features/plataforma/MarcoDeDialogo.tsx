import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { FaltaParaEnviar, FormularioDeDialogo } from '@validasoft/ui';
import { Pencil } from 'lucide-react';
import type { ReactNode, SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../shared/componentes';

/** «Editar» de una sección de la ficha: compacto, con el nombre de la sección en su etiqueta para quien usa lector de pantalla. */
export function BotonEditar({ etiqueta, onClick, texto }: { etiqueta: string; onClick: () => void; texto?: string }) {
  const { t } = useTranslation();
  return (
    <Button size="small" variant="outlined" startIcon={<Pencil size={14} aria-hidden />} onClick={onClick} aria-label={etiqueta}>
      {texto ?? t('comun.editar')}
    </Button>
  );
}

interface MarcoProps {
  /** `id` del título: lo usa `aria-labelledby` del diálogo. */
  idTitulo: string;
  titulo: string;
  /** Para quién es (debajo del título). */
  subtitulo?: string;
  ancho?: number;
  /** Guardando: no se cierra ni se reenvía. */
  ocupado: boolean;
  /** Nada que enviar todavía (sin cambios o con algo por corregir). */
  sinEnviar: boolean;
  /** Lo que falta para poder enviar, junto al botón. */
  falta?: string;
  textoEnviar: string;
  onEnviar: () => void;
  onCerrar: () => void;
  children: ReactNode;
}

/** Diálogo de edición de una sección de la ficha: título con el grupo debajo, campos en pila y «Cancelar» / el botón que guarda. */
export function MarcoDeDialogo({ idTitulo, titulo, subtitulo, ancho = 520, ocupado, sinEnviar, falta, textoEnviar, onEnviar, onCerrar, children }: MarcoProps) {
  const { t } = useTranslation();
  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    if (!sinEnviar && !ocupado) onEnviar();
  };
  return (
    <Dialog open onClose={ocupado ? undefined : onCerrar} maxWidth={false} slotProps={{ paper: { sx: { width: ancho, maxWidth: 'calc(100% - 32px)' } } }} aria-labelledby={idTitulo}>
      <FormularioDeDialogo onSubmit={enviar}>
        <DialogTitle id={idTitulo}>
          {titulo}
          {subtitulo && (
            <Typography variant="body2" component="span" sx={{ color: 'text.secondary', display: 'block', mt: 0.25, fontWeight: 400 }}>
              {subtitulo}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>{children}</Stack>
        </DialogContent>
        <DialogActions>
          {falta && <FaltaParaEnviar>{falta}</FaltaParaEnviar>}
          <Button variant="text" onClick={onCerrar} disabled={ocupado} sx={{ color: 'text.primary' }}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" variant="contained" disabled={ocupado || sinEnviar} startIcon={ocupado ? <IconoCarga /> : undefined}>
            {textoEnviar}
          </Button>
        </DialogActions>
      </FormularioDeDialogo>
    </Dialog>
  );
}
