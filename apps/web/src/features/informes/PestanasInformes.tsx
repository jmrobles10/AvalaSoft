import { Box, Tab, Tabs, type Theme } from '@mui/material';
import { SCOPES } from '@validalo/api-client';
import { sxPildora } from '@validalo/ui';
import { ChartNoAxesColumn, ClipboardCheck, Timer, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { usePermisos } from '../../shared/usePermisos';

export type PestanaInforme = 'estado-expedientes' | 'vinculos' | 'sla' | 'evaluaciones';

const ICONOS: Record<PestanaInforme, LucideIcon> = { 'estado-expedientes': ChartNoAxesColumn, vinculos: Users, sla: Timer, evaluaciones: ClipboardCheck };

/**
 * Pestañas de `/informes`: cada informe es una ruta y solo se muestran los que la persona puede ver. Van como píldoras, igual que la
 * navegación lateral del resto de la app: la activa es una píldora blanca con sombra suave y el ícono en el acento; el resto, texto gris.
 * En pantallas angostas se desplazan dentro de su fila (la página nunca se desplaza de lado).
 */
export function PestanasInformes({ empresaId, actual }: { empresaId: string; actual: PestanaInforme }) {
  const { t } = useTranslation();
  const permisos = usePermisos(empresaId);
  const pestanas: { valor: PestanaInforme; etiqueta: string }[] = [];
  if (permisos.puede(SCOPES.expedientesLeer)) pestanas.push({ valor: 'estado-expedientes', etiqueta: t('informes.pestanas.estado') });
  if (permisos.puede(SCOPES.vinculosLeer)) pestanas.push({ valor: 'vinculos', etiqueta: t('informes.pestanas.vinculos') });
  if (permisos.puede(SCOPES.expedientesLeer)) pestanas.push({ valor: 'sla', etiqueta: t('informes.pestanas.sla') });
  if (permisos.puede(SCOPES.evaluacionesLeer)) pestanas.push({ valor: 'evaluaciones', etiqueta: t('informes.pestanas.evaluaciones') });

  return (
    <Box sx={{ mx: -0.5, mb: 1.5 }}>
      <Tabs
        value={actual}
        aria-label={t('informes.pestanas.etiqueta')}
        variant="scrollable"
        scrollButtons={false}
        slotProps={{ indicator: { sx: { display: 'none' } } }}
        // El relleno de la fila da espacio a la sombra de la píldora activa y al anillo de foco (la fila recorta lo que se sale); el margen
        // negativo de la caja lo compensa para que las pestañas queden alineadas con el resto del contenido.
        sx={{ minHeight: 0, '& .MuiTabs-scroller': { p: 0.5 }, '& .MuiTabs-flexContainer': { gap: 0.5 } }}
      >
        {pestanas.map((p) => {
          const Icono = ICONOS[p.valor];
          return (
            <Tab
              key={p.valor}
              value={p.valor}
              label={p.etiqueta}
              icon={<Icono size={16} strokeWidth={1.75} aria-hidden />}
              iconPosition="start"
              component={RouterLink}
              to={`/e/${empresaId}/informes/${p.valor}`}
              sx={(t2: Theme) => sxPildora(t2, '.MuiTab-icon')}
            />
          );
        })}
      </Tabs>
    </Box>
  );
}
