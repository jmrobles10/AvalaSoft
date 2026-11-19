import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import type { RelacionEntreTercerosDto } from '@validalo/api-client';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../shared/errores';
import { useAvisos } from '../shared/useAvisos';
import { useConfirmarRelacion, useDescartarRelacion } from './api';
import { confianzaComoPorcentaje, esRol } from './modelo';

/**
 * Lo que la IA leyó en la Cámara de comercio y que difiere de lo que el tercero tiene vigente (ADR-0010, regla 5): no cambia nada hasta que el
 * tercero lo confirme o lo descarte. Dice a quién reemplazaría para que la decisión sea informada.
 */
export function TarjetaPropuesta({ relacion }: { relacion: RelacionEntreTercerosDto }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const confirmar = useConfirmarRelacion();
  const descartar = useDescartarRelacion();
  const ocupado = confirmar.isPending || descartar.isPending;
  const rol = esRol(relacion.tipo) ? t(`personas.roles.${relacion.tipo}`) : relacion.tipo;
  const confianza = confianzaComoPorcentaje(relacion.confianza);
  const error = confirmar.isError ? confirmar.error : descartar.isError ? descartar.error : null;

  return (
    <Alert severity="info" component="li" sx={{ listStyle: 'none' }} role="group" aria-label={relacion.nombre}>
      <AlertTitle>{t('personas.propuesta.titulo')}</AlertTitle>
      <Typography sx={{ fontSize: 14 }}>
        {t('personas.propuesta.texto', { nombre: relacion.nombre, rol: rol.toLowerCase(), confianza: String(confianza ?? '—') })}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 0.25 }}>
        {relacion.identificacion.tipo} {relacion.identificacion.numero}
        {relacion.reemplaza && ` · ${t('personas.propuesta.reemplaza', { nombre: relacion.reemplaza.nombre })}`}
      </Typography>
      {error !== null && (
        <Typography role="alert" sx={{ color: 'error.main', fontSize: 13, mt: 0.5 }}>
          {mensajeDeError(error, t)}
        </Typography>
      )}
      <Box sx={{ mt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            size="small"
            disabled={ocupado}
            startIcon={<Check size={16} aria-hidden />}
            onClick={() => confirmar.mutate(relacion.id, { onSuccess: () => mostrar(t('personas.propuesta.confirmada', { nombre: relacion.nombre, rol: rol.toLowerCase() })) })}
          >
            {t('personas.propuesta.confirmar')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={ocupado}
            startIcon={<X size={16} aria-hidden />}
            onClick={() => descartar.mutate(relacion.id, { onSuccess: () => mostrar(t('personas.propuesta.descartada')) })}
          >
            {t('personas.propuesta.descartar')}
          </Button>
        </Stack>
      </Box>
    </Alert>
  );
}
