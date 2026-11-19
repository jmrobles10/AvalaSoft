import { Box } from '@mui/material';
import { NavegacionLateral, VARIABLE_TOPE, type GrupoNavegacion } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Outlet, useLocation } from 'react-router';
import { useEmpresaActiva, type ContextoEmpresa } from '../features/empresas/useEmpresas';
import { useScrollPropio } from '../sesion/alturaFija';
import { usePermisos } from '../shared/usePermisos';
import { SECCIONES_CONFIGURACION, type SeccionConfiguracion } from './secciones';
import { RELLENO_CONTENIDO } from './rellenoContenido';

/**
 * Configuración: barra de secciones a la izquierda, separada en grupo (tenant) y empresa activa. Es la misma navegación lateral de la ficha
 * del vínculo y de la consola de Plataforma: un panel flotante fijo, siempre del alto disponible y con su propio scroll, así se ven todas las
 * secciones sin depender del largo de la página de la derecha.
 */
export function LayoutConfiguracion() {
  const { t } = useTranslation();
  const contexto = useEmpresaActiva();
  const { empresa } = contexto;
  const permisos = usePermisos(empresa.id);
  const { pathname } = useLocation();
  const actual = pathname.split('/')[3] ?? '';
  const visibles = SECCIONES_CONFIGURACION.filter((s) => permisos.puede(s.scope));
  // Los formularios de configuración crecen (etapas, documentos, miembros): embebida, la sección usa scroll propio.
  useScrollPropio();

  const grupo = (clave: string, titulo: string, secciones: readonly SeccionConfiguracion[]): GrupoNavegacion => ({
    clave,
    titulo,
    items: secciones.map(({ ruta, icono }) => ({ clave: ruta, texto: t(`nav.${ruta}`), icono, a: `/e/${empresa.id}/${ruta}`, activo: actual === ruta })),
  });
  const grupos = [
    grupo('grupo', t('configuracion.grupo'), visibles.filter((s) => s.alcance === 'grupo')),
    grupo('empresa', empresa.nombre, visibles.filter((s) => s.alcance === 'empresa')),
  ].filter((g) => g.items.length > 0);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '272px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
      <NavegacionLateral
        etiqueta={t('nav.configuracion')}
        grupos={grupos}
        enlace={RouterLink}
        densidad="compacta"
        sx={(tema) => {
          // Se pega donde empieza (bajo la barra, más el relleno del contenido) y ocupa hasta el borde inferior: si no caben todas las
          // secciones, la lista desplaza dentro del panel, no con la página.
          const tope = `calc(var(${VARIABLE_TOPE}, 0px) + ${tema.spacing(RELLENO_CONTENIDO.y)})`;
          return {
            width: '100%',
            alignSelf: 'start',
            [tema.breakpoints.up('md')]: {
              position: 'sticky',
              top: tope,
              height: `calc(100dvh - var(${VARIABLE_TOPE}, 0px) - ${tema.spacing(RELLENO_CONTENIDO.y)} - 16px)`,
            },
            // En pantallas muy bajas deja de fijarse: un solo scroll, el de la página.
            '@media (max-height: 640px)': { position: 'static', height: 'auto' },
          };
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Outlet context={contexto satisfies ContextoEmpresa} />
      </Box>
    </Box>
  );
}
