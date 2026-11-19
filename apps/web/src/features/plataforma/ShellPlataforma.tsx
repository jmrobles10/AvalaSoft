import { Box, Drawer, IconButton, Tooltip } from '@mui/material';
import { esSesionDePlataforma } from '@validalo/api-client';
import { BarraSuperior, ChipUsuario, Logo, NavegacionLateral, PanelFlotante, PildoraContexto, VARIABLE_FONDO, VARIABLE_TOPE, type GrupoNavegacion } from '@validalo/ui';
import { Building2, CalendarDays, Database, FileLock2, ListChecks, LogIn, Lock, Menu, Moon, ShieldCheck, Sparkles, Sun, UsersRound, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Navigate, Outlet, useLocation } from 'react-router';
import { ANCHO_LIMITADO, RELLENO_CONTENIDO } from '../../app/rellenoContenido';
import { AvisoDePasskey } from '../cuenta/AvisoDePasskey';
import { MenuDeCuenta } from '../cuenta/MenuDeCuenta';
import { useAlturaFija, useScrollPropio } from '../../sesion/alturaFija';
import { useSesion } from '../../sesion/sesionStore';
import { usePreferencias } from '../../shared/preferencias';

/** Secciones de la consola: sus textos están en `plataforma.nav.{clave}` y sus rutas cuelgan de `/plataforma`. */
interface Seccion {
  clave: string;
  ruta: string;
  /** Primer segmento de la ruta que marca la sección como activa (también sus pantallas hijas). */
  prefijo: string;
  icono: LucideIcon;
}

/** Las secciones agrupadas como en la barra lateral: Inicio, Cumplimiento y Operación (títulos en `plataforma.marco.grupos`). */
const GRUPOS = [
  { clave: 'inicio', secciones: [{ clave: 'grupos', ruta: 'grupos', prefijo: 'grupos', icono: Building2 }] },
  {
    clave: 'cumplimiento',
    secciones: [
      { clave: 'habeas', ruta: 'habeas', prefijo: 'habeas', icono: FileLock2 },
      { clave: 'accesos', ruta: 'accesos-a-terceros', prefijo: 'accesos-a-terceros', icono: ShieldCheck },
      { clave: 'listas', ruta: 'listas', prefijo: 'listas', icono: ListChecks },
      { clave: 'fuentes', ruta: 'fuentes', prefijo: 'fuentes', icono: Database },
    ],
  },
  {
    clave: 'operacion',
    secciones: [
      { clave: 'usoIa', ruta: 'uso-ia', prefijo: 'uso-ia', icono: Sparkles },
      { clave: 'operadores', ruta: 'operadores', prefijo: 'operadores', icono: UsersRound },
      { clave: 'ingresos', ruta: 'ingresos', prefijo: 'ingresos', icono: LogIn },
      { clave: 'secretos', ruta: 'secretos', prefijo: 'secretos', icono: Lock },
    ],
  },
] as const satisfies readonly { clave: string; secciones: readonly Seccion[] }[];

/** Colapsada la barra lateral solo muestra los íconos; la elección se recuerda en el navegador (sin romper si está bloqueado). */
const CLAVE_COLAPSO = 'validalo:plataforma:navegacion-colapsada';
function leerColapso(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_COLAPSO) === '1';
  } catch {
    return false;
  }
}
function guardarColapso(colapsada: boolean): void {
  try {
    window.localStorage.setItem(CLAVE_COLAPSO, colapsada ? '1' : '0');
  } catch {
    // Sin almacenamiento: la elección vale solo para esta visita.
  }
}

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

/** «mié, 18 nov 2026»: la fecha de hoy para la píldora de la barra superior. */
const fechaDeHoy = () => new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()).replace(/\./g, '');

/**
 * Consola de Plataforma (P-15-2, PT-4): solo con la sesión de un operador (sin tenant, `plataforma:tenants`). Sobre el lienzo gris, la barra
 * superior sin fondo (el logotipo, las píldoras «Plataforma» y la fecha, el tema y el chip del operador con su rol) y, debajo, dos paneles
 * blancos flotantes: la navegación agrupada (Inicio, Cumplimiento y Operación; el ítem activo es una píldora blanca) y el contenido, que
 * desplaza por su cuenta. Con menos de 900 px la navegación pasa a un cajón que abre el botón de la barra. La sesión embebida
 * fija el alto de toda la consola (`useScrollPropio`), y el contenido sigue desplazándose dentro de su panel.
 */
export function ShellPlataforma() {
  const { t } = useTranslation();
  const sesion = useSesion((s) => s.sesion);
  const { modo, temaDelContenedor, fijarModo } = usePreferencias();
  const { pathname } = useLocation();
  const [colapsada, setColapsada] = useState(leerColapso);
  const [cajon, setCajon] = useState(false);
  // Embebida, toda la consola tiene alto fijo (ver `sesion/alturaFija.ts`): el iframe no cambia de alto ni de ancho útil al pasar de una
  // pestaña a otra. Fuera del iframe llena la ventana. En los dos casos el contenido desplaza dentro de su panel.
  useScrollPropio();
  const alturaFija = useAlturaFija((s) => s.altura);

  if (!sesion || !esSesionDePlataforma(sesion)) return <Navigate to="/" replace />;

  // La ficha de un grupo o de su plan de IA cuelga de su sección: se activa por el primer segmento de la ruta.
  const relativa = pathname.slice('/plataforma/'.length);
  const activa = (s: Seccion) => relativa === s.prefijo || relativa.startsWith(`${s.prefijo}/`);
  const grupos: GrupoNavegacion[] = GRUPOS.map((g) => ({
    clave: g.clave,
    titulo: t(`plataforma.marco.grupos.${g.clave}`),
    items: g.secciones.map((s) => ({ clave: s.clave, texto: t(`plataforma.nav.${s.clave}`), icono: s.icono, a: `/plataforma/${s.ruta}`, activo: activa(s) })),
  }));
  const nombre = sesion.nombre ?? sesion.usuarioId;
  const textoSesion = sesion.sistema ? t('plataforma.sesion', { persona: nombre, sistema: sesion.sistema }) : null;
  const alternarColapso = () => {
    const nueva = !colapsada;
    setColapsada(nueva);
    guardarColapso(nueva);
  };
  const navegacion = (enCajon: boolean) => (
    <NavegacionLateral
      etiqueta={t('nav.principal')}
      rotulo={t('plataforma.marco.navegacion')}
      grupos={grupos}
      enlace={RouterLink}
      colapsada={!enCajon && colapsada}
      onAlternarColapso={enCajon ? () => setCajon(false) : alternarColapso}
      textoColapsar={enCajon ? t('plataforma.marco.cerrar') : t('plataforma.marco.colapsar')}
      textoExpandir={t('plataforma.marco.expandir')}
      iconoCierre={enCajon ? <X size={16} strokeWidth={1.75} aria-hidden /> : undefined}
      onNavegar={enCajon ? () => setCajon(false) : undefined}
      sx={enCajon ? { width: 260, height: '100%', border: 0, borderRadius: 0, boxShadow: 'none' } : { height: '100%', flex: 'none' }}
    />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        height: alturaFija ?? '100dvh',
        overflow: 'hidden',
        // El encabezado de cada página se pega arriba del panel de contenido (que es quien desplaza), con el fondo del panel. Se resta el relleno
        // del panel: `sticky` mide desde el borde de su contenido, y sin esto el encabezado bajaba ese relleno y tapaba lo que sigue.
        [VARIABLE_TOPE]: (th) => `-${th.spacing(RELLENO_CONTENIDO.y)}`,
        [VARIABLE_FONDO]: (th) => th.palette.superficie.panel,
      }}
    >
      <BarraSuperior sx={ANCHO_LIMITADO}>
        <IconButton aria-label={t('plataforma.marco.abrir')} onClick={() => setCajon(true)} sx={{ display: { md: 'none' }, flex: 'none' }}>
          <Menu size={20} strokeWidth={1.75} aria-hidden />
        </IconButton>
        <Logo tamano={20} titulo={t('app.nombre')} />
        <PildoraContexto icono={ShieldCheck} sx={{ display: { xs: 'none', sm: 'inline-flex' }, ml: { sm: 1.5, md: 3 } }}>
          {t('plataforma.titulo')}
        </PildoraContexto>
        <PildoraContexto icono={CalendarDays} sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>
          {fechaDeHoy()}
        </PildoraContexto>
        <Box sx={{ flex: 1, minWidth: 0 }} />
        {!temaDelContenedor && (
          <Tooltip title={modo === 'dark' ? t('app.tema.claro') : t('app.tema.oscuro')}>
            <IconButton aria-label={modo === 'dark' ? t('app.tema.claro') : t('app.tema.oscuro')} onClick={() => fijarModo(modo === 'dark' ? 'light' : 'dark')} sx={{ flex: 'none' }}>
              {modo === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
            </IconButton>
          </Tooltip>
        )}
        {/* Con sesión directa el chip abre el menú de la cuenta; con la identidad delegada es solo informativo (la persona sale en su sistema). */}
        {sesion.sesionId != null ? (
          <MenuDeCuenta rutaMiCuenta="/plataforma/mi-cuenta" chip={{ rol: t('plataforma.marco.rol') }} />
        ) : (
          <Tooltip title={textoSesion ?? ''}>
            <Box sx={{ minWidth: 0, display: 'flex' }}>
              <ChipUsuario nombre={nombre} rol={sesion.sistema ?? t('plataforma.marco.rol')} />
            </Box>
          </Tooltip>
        )}
      </BarraSuperior>
      <AvisoDePasskey rutaMiCuenta="/plataforma/mi-cuenta" flotante />
      <Box sx={{ ...ANCHO_LIMITADO, display: 'flex', flex: 1, minHeight: 0, gap: 2, px: { xs: 1, md: 2 }, pb: { xs: 1, md: 2 } }}>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 'none', minHeight: 0 }}>{navegacion(false)}</Box>
        <PanelFlotante
          component="main"
          sx={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', py: RELLENO_CONTENIDO.y, px: RELLENO_CONTENIDO.x }}
        >
          <Outlet />
        </PanelFlotante>
      </Box>
      <Drawer
        anchor="left"
        open={cajon}
        onClose={() => setCajon(false)}
        sx={{ display: { md: 'none' } }}
        slotProps={{ paper: { sx: { width: 260, border: 0, bgcolor: 'superficie.panel' } } }}
      >
        {navegacion(true)}
      </Drawer>
    </Box>
  );
}
