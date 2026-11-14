import { Alert, AlertTitle, Button } from '@mui/material';
import { UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router';
import { useSesionTercero } from '../sesion/sesionTercero';
import { useRelaciones } from './api';
import { propuestasDe } from './modelo';

/**
 * Para el contacto del tercero: la IA leyó otros representantes en sus documentos y esperan su confirmación (ADR-0010, regla 5). Nada cambia hasta que
 * decida, así que el aviso lo trae a «Personas relacionadas». Se oculta ahí mismo y para quien no tiene acceso completo.
 */
export function AvisoDePropuestasDePersonas() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const completa = useSesionTercero((s) => s.estado === 'activa' && s.sesion?.aislada !== true);
  const consulta = useRelaciones(completa);
  const pendientes = consulta.data ? propuestasDe(consulta.data).length : 0;
  if (!completa || pendientes === 0 || pathname.startsWith('/personas')) return null;
  return (
    <Alert
      severity="info"
      icon={<UsersRound size={20} aria-hidden />}
      role="status"
      sx={{ mb: 2 }}
      action={
        <Button component={RouterLink} to="/personas" color="inherit" size="small">
          {t('personas.propuesta.revisar')}
        </Button>
      }
    >
      <AlertTitle>{t('personas.propuesta.avisoTitulo', { count: pendientes })}</AlertTitle>
      {t('personas.propuesta.avisoTexto')}
    </Alert>
  );
}
