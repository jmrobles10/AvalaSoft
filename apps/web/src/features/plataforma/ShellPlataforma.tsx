import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { esSesionDePlataforma } from '@avalasoft/api-client';
import { Logo, VARIABLE_TOPE } from '@avalasoft/ui';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { NavegacionPrincipal, type Pestana } from '../../app/NavegacionPrincipal';
import { RELLENO_CONTENIDO } from '../../app/rellenoContenido';
import { AvisoDePasskey } from '../cuenta/AvisoDePasskey';
import { MenuDeCuenta } from '../cuenta/MenuDeCuenta';
import { useAlturaFija, useScrollPropio } from '../../sesion/alturaFija';
import { useSesion } from '../../sesion/sesionStore';
import { usePreferencias } from '../../shared/preferencias';

/** Secciones de la consola: sus textos están en `plataforma.nav.{clave}` y sus rutas cuelgan de `/plataforma`. */
const PESTANAS = [
  { clave: 'grupos', ruta: 'grupos', prefijos: ['grupos'] },
  { clave: 'habeas', ruta: 'habeas', prefijos: ['habeas'] },
  { clave: 'accesos', ruta: 'accesos-a-terceros', prefijos: ['accesos-a-terceros'] },
  { clave: 'usoIa', ruta: 'uso-ia', prefijos: ['uso-ia'] },
  { clave: 'operadores', ruta: 'operadores', prefijos: ['operadores'] },
  { clave: 'ingresos', ruta: 'ingresos', prefijos: ['ingresos'] },
  { clave: 'secretos', ruta: 'secretos', prefijos: ['secretos'] },
  { clave: 'listas', ruta: 'listas', prefijos: ['listas'] },
  { clave: 'fuentes', ruta: 'fuentes', prefijos: ['fuentes'] },
] as const satisfies readonly Pestana<string>[];

/** `/`: la sesión de un operador de Plataforma va a su consola; la de una persona de un tenant, a su empresa. */
export function SegunSesion({ deTenant }: { deTenant: ReactNode }) {
  const sesion = useSesion((s) => s.sesion);
  return sesion && esSesionDePlataforma(sesion) ? <Navigate to="/plataforma/grupos" replace /> : deTenant;
}

/** Las rutas de un tenant no aplican a la sesión de Plataforma (no tiene tenant ni empresas). */
export function SoloTenant({ children }: { children: ReactNode }) {
  const sesion = useSesion((s) => s.sesion);
  return sesion && esSesionDePlataforma(sesion) ? <Navigate to="/plataforma/grupos" replace /> : children;
}

/**
 * Consola de Plataforma (P-15-2, PT-4): solo con la sesión de un operador (sin tenant, `plataforma:tenants`). Una fila de
 * 48 px como el AppShell de la empresa: logo, «Plataforma», sus secciones (las pestañas que caben y el resto en «Más»,
 * NAV-8: la misma `NavegacionPrincipal`, sin desplazamiento horizontal) y quién opera desde qué sistema, que se acorta con
 * puntos suspensivos si no cabe.
 */
export function ShellPlataforma() {
  const { t } = useTranslation();
  const sesion = useSesion((s) => s.sesion);
  const { modo, temaDelContenedor, fijarModo } = usePreferencias();
  const { pathname } = useLocation();
  // Embebida, toda la consola tiene alto fijo y `main` con scroll propio (ver `sesion/alturaFija.ts`): la lista de grupos es
  // virtual y necesita un área que desplace, y así el iframe no cambia de alto ni de ancho útil al pasar de una pestaña a otra.
  useScrollPropio();
  const alturaFija = useAlturaFija((s) => s.altura);

  if (!sesion || !esSesionDePlataforma(sesion)) return <Navigate to="/" replace />;

  // La ficha de un grupo o de su plan de IA cuelga de su sección: se activa por el primer segmento de la ruta.
  const relativa = pathname.slice('/plataforma/'.length);
  const activa = PESTANAS.find((p) => p.prefijos.some((prefijo) => relativa === prefijo || relativa.startsWith(`${prefijo}/`)));
  const textoSesion = sesion.sistema ? t('plataforma.sesion', { persona: sesion.nombre ?? sesion.usuarioId, sistema: sesion.sistema }) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        ...(alturaFija === null ? { minHeight: '100vh' } : { height: alturaFija, overflow: 'hidden' }),
        // Con scroll de ventana, bajo la barra; con scroll propio de `main`, se resta el relleno de `main` para que el
        // encabezado de la página quede pegado a la barra (igual que en AppShell).
        [VARIABLE_TOPE]: (th) => (alturaFija === null ? `${String(th.densidad.cabeceraEmbebida)}px` : `-${th.spacing(RELLENO_CONTENIDO.y)}`),
      }}
    >
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (th) => th.zIndex.appBar,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: (th) => th.densidad.cabeceraEmbebida,
          pl: 2,
          pr: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minWidth: 0,
        }}
      >
        <Logo tamano={20} titulo={t('app.nombre')} />
        <Box aria-hidden sx={{ flex: 'none', width: '1px', height: 24, bgcolor: 'divider' }} />
        <Typography component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 14, fontWeight: 600, flex: 'none' }}>
          <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
          {t('plataforma.titulo')}
        </Typography>
        <NavegacionPrincipal pestanas={PESTANAS} rutaBase="/plataforma" activa={activa?.clave ?? null} nombreDe={(clave) => t(`plataforma.nav.${clave}`)} />
        {textoSesion && (
          // Mide lo que mide hasta un tope y, si no cabe, se acorta con puntos suspensivos (el tooltip lleva el texto
          // completo); las pestañas toman lo que sobra, así que un nombre largo no las empuja a «Más» sin necesidad.
          <Tooltip title={textoSesion}>
            <Typography
              component="span"
              sx={{ color: 'text.secondary', display: { xs: 'none', md: 'block' }, flex: '0 1 auto', minWidth: 0, maxWidth: 'min(360px, 20vw)', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, lineHeight: '16px', whiteSpace: 'nowrap' }}
            >
              {textoSesion}
            </Typography>
          </Tooltip>
        )}
        <MenuDeCuenta rutaMiCuenta="/plataforma/mi-cuenta" />
        {!temaDelContenedor && (
          <Tooltip title={modo === 'dark' ? t('app.tema.claro') : t('app.tema.oscuro')}>
            <IconButton aria-label={modo === 'dark' ? t('app.tema.claro') : t('app.tema.oscuro')} onClick={() => fijarModo(modo === 'dark' ? 'light' : 'dark')}>
              {modo === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <AvisoDePasskey rutaMiCuenta="/plataforma/mi-cuenta" />
      <Box component="main" sx={{ flex: 1, py: RELLENO_CONTENIDO.y, px: RELLENO_CONTENIDO.x, minWidth: 0, ...(alturaFija !== null && { minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable' }) }}>
        <Outlet />
      </Box>
    </Box>
  );
}
