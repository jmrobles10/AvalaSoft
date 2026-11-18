import { Box, ButtonBase, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { iniciales } from './datos';
import { sxComoLista } from './sx';

/**
 * Tarjeta por bloque del rework visual: encabezado con ícono en el acento, título (16 px, peso medio) y ayuda corta en gris **en la misma
 * línea**, un divisor fino y el cuerpo con relleno generoso. Va sobre el panel (superficie nivel 1, borde sutil y sombra mínima). Con
 * `filete` lleva arriba un filete de 3 px del acento (tarjeta de resumen).
 */
export interface TarjetaBloqueProps {
  titulo?: ReactNode;
  /** Frase corta que acompaña al título, en gris y en su misma línea. */
  ayuda?: ReactNode;
  icono?: LucideIcon;
  /** A la derecha del encabezado (botones, contadores…). */
  acciones?: ReactNode;
  /** Nivel del encabezado del título (`h3` si la tarjeta va dentro de otra sección). */
  nivel?: 'h2' | 'h3';
  /** Nombre accesible de la región. */
  etiqueta?: string;
  /** Filete superior de 3 px del acento. */
  filete?: boolean;
  /** Cuerpo sin relleno (una tabla que llega a los bordes de la tarjeta). */
  sinRelleno?: boolean;
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

export function TarjetaBloque({ titulo, ayuda, icono: Icono, acciones, nivel = 'h2', etiqueta, filete = false, sinRelleno = false, children, sx }: TarjetaBloqueProps) {
  const conEncabezado = Boolean(titulo ?? acciones);
  const conCuerpo = children !== undefined && children !== null && children !== false;
  return (
    <Box
      component="section"
      aria-label={etiqueta}
      sx={[
        (t: Theme) => ({
          position: 'relative',
          minWidth: 0,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(t.radio.md)}px`,
          bgcolor: 'background.paper',
          boxShadow: t.sombra.suave,
        }),
        ...sxComoLista(sx),
      ]}
    >
      {filete && <Box aria-hidden sx={{ position: 'absolute', insetInline: 0, top: 0, height: 3, bgcolor: (t) => t.palette.acento.main }} />}
      {conEncabezado && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 1,
            minHeight: 54,
            px: { xs: 2, sm: 2.5 },
            py: 1.25,
            borderBottom: conCuerpo ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'baseline', flex: '1 1 auto', minWidth: 0, columnGap: 1.25, rowGap: 0.25, flexWrap: 'wrap' }}>
            {Icono && (
              <Box aria-hidden sx={{ display: 'inline-flex', alignSelf: 'center', flex: 'none', color: (t) => t.palette.acento.main }}>
                <Icono size={20} strokeWidth={1.75} />
              </Box>
            )}
            {titulo && (
              <Typography variant="h3" component={nivel} sx={{ minWidth: 0 }}>
                {titulo}
              </Typography>
            )}
            {ayuda && (
              <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, minWidth: 0 }}>
                {ayuda}
              </Typography>
            )}
          </Stack>
          {acciones && <Box sx={{ display: 'flex', alignItems: 'center', flex: 'none', maxWidth: '100%' }}>{acciones}</Box>}
        </Box>
      )}
      {conCuerpo && <Box sx={sinRelleno ? undefined : { px: { xs: 2, sm: 2.5 }, py: { xs: 2, sm: 2.25 } }}>{children}</Box>}
    </Box>
  );
}

/** Rótulo pequeño en versalitas grises (el «RESUMEN» de la tarjeta de resumen, el «NAVEGACIÓN» de la barra lateral). */
export function Sobretitulo({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Typography variant="overline" component="p" sx={[{ color: 'text.secondary', m: 0 }, ...sxComoLista(sx)]}>
      {children}
    </Typography>
  );
}

/** Un total destacado: recuadro con el tinte del acento y la cifra grande a la derecha. */
export function TotalDestacado({ etiqueta, valor }: { etiqueta: ReactNode; valor: ReactNode }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 1.5, py: 1.25, borderRadius: (t) => `${String(t.radio.sm + 2)}px`, bgcolor: (t) => t.palette.acento.tinte }}
    >
      <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
        {etiqueta}
      </Typography>
      <Typography component="span" sx={{ fontSize: 22, lineHeight: '28px', fontWeight: 500, color: (t) => t.palette.acento.main }}>
        {valor}
      </Typography>
    </Stack>
  );
}

/** Avatar de iniciales en círculo: `solido` (verde azulado con la inicial en blanco, el del usuario en la barra) o con el tinte del acento (listas). */
export function AvatarIniciales({ nombre, tamano = 32, solido = false }: { nombre: string; tamano?: number; solido?: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
        width: tamano,
        height: tamano,
        borderRadius: '50%',
        fontSize: Math.round(tamano * 0.4),
        lineHeight: 1,
        fontWeight: 500,
        bgcolor: (t) => (solido ? t.palette.primary.main : t.palette.acento.tinte),
        color: (t) => (solido ? t.palette.primary.contrastText : t.palette.acento.main),
      }}
    >
      {iniciales(nombre)}
    </Box>
  );
}

export type TonoKpi = 'cian' | 'violeta' | 'verde' | 'ambar';

const PALETA_KPI = { cian: 'encurso', verde: 'exito', ambar: 'advertencia' } as const;

function coloresDeKpi(t: Theme, tono: TonoKpi) {
  return tono === 'violeta' ? t.palette.violeta : t.palette.estado[PALETA_KPI[tono]];
}

/**
 * Tarjeta del tablero: ícono dentro de un cuadrado redondeado de color suave (cian, violeta, verde o ámbar), el rótulo, la cifra grande, un
 * detalle opcional y, si hay datos que dibujar, una mini gráfica (`grafica`).
 */
export function TarjetaKpi({ icono: Icono, tono, titulo, valor, detalle, grafica }: { icono: LucideIcon; tono: TonoKpi; titulo: ReactNode; valor: ReactNode; detalle?: ReactNode; grafica?: ReactNode }) {
  return (
    <Box
      sx={(t) => ({
        minWidth: 0,
        p: 2.25,
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(t.radio.md)}px`,
        bgcolor: 'background.paper',
        boxShadow: t.sombra.suave,
      })}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box
          aria-hidden
          sx={(t) => ({ display: 'grid', placeItems: 'center', flex: 'none', width: 36, height: 36, borderRadius: '10px', bgcolor: coloresDeKpi(t, tono).fondo, color: coloresDeKpi(t, tono).texto })}
        >
          <Icono size={18} strokeWidth={1.75} />
        </Box>
        <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          {titulo}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="p" sx={{ m: 0, fontSize: 30, lineHeight: '36px', fontWeight: 500, letterSpacing: '-0.02em' }}>
            {valor}
          </Typography>
          {detalle && (
            <Typography component="p" variant="caption" sx={{ m: 0, color: 'text.secondary', fontWeight: 400 }}>
              {detalle}
            </Typography>
          )}
        </Box>
        {grafica && <Box sx={{ flex: 'none' }}>{grafica}</Box>}
      </Stack>
    </Box>
  );
}

/** Mini gráfica de proporción (`valor` de `total`) para una tarjeta del tablero: una barra de 6 px, no un dato inventado. */
export function MiniBarra({ valor, total, tono = 'cian', etiqueta }: { valor: number; total: number; tono?: TonoKpi; etiqueta: string }) {
  const porcentaje = total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0;
  return (
    <Box
      role="img"
      aria-label={etiqueta}
      sx={(t) => ({ width: 72, height: 6, borderRadius: 3, bgcolor: coloresDeKpi(t, tono).fondo, overflow: 'hidden', mb: 0.75 })}
    >
      <Box sx={(t) => ({ width: `${String(porcentaje)}%`, height: '100%', borderRadius: 3, bgcolor: coloresDeKpi(t, tono).solido })} />
    </Box>
  );
}

/**
 * Fila de la lista «Necesita atención»: ícono en círculo suave, título y subtítulo, un chip (el estado o el conteo) y un chevron. Es un
 * enlace (`componente` + `to`, p. ej. el `Link` del enrutador) o un botón.
 */
export function FilaAtencion({
  icono: Icono,
  titulo,
  subtitulo,
  chip,
  tono = 'cian',
  componente,
  ...resto
}: {
  icono: LucideIcon;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  chip?: ReactNode;
  tono?: TonoKpi;
  componente?: ElementType;
  to?: string;
  onClick?: () => void;
  'aria-label'?: string;
}) {
  return (
    <ButtonBase
      component={componente ?? 'button'}
      {...resto}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        px: 1.5,
        py: 1.25,
        textAlign: 'left',
        borderRadius: (t) => `${String(t.radio.sm + 2)}px`,
        '&:hover': { bgcolor: 'superficie.nivel2' },
      }}
    >
      <Box
        aria-hidden
        sx={(t) => ({ display: 'grid', placeItems: 'center', flex: 'none', width: 36, height: 36, borderRadius: '50%', bgcolor: coloresDeKpi(t, tono).fondo, color: coloresDeKpi(t, tono).texto })}
      >
        <Icono size={17} strokeWidth={1.75} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="span" noWrap sx={{ display: 'block', fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography component="span" noWrap variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {chip}
      <Box aria-hidden sx={{ display: 'inline-flex', flex: 'none', color: 'text.secondary' }}>
        <ChevronRight size={18} strokeWidth={1.75} />
      </Box>
    </ButtonBase>
  );
}

/**
 * Sección plana de un formulario: sin caja ni sombra. Un título pequeño con su ícono en el acento y la ayuda en la misma línea; las
 * secciones consecutivas se separan con espacio y una línea fina. Es lo que va **dentro de un panel** (una tarjeta dentro del panel sería
 * un marco dentro de otro marco).
 */
export function SeccionPlana({
  titulo,
  ayuda,
  icono: Icono,
  nivel = 'h2',
  etiqueta,
  children,
}: {
  titulo: ReactNode;
  ayuda?: ReactNode;
  icono?: LucideIcon;
  nivel?: 'h2' | 'h3';
  etiqueta?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      data-seccion=""
      aria-label={etiqueta ?? (typeof titulo === 'string' ? titulo : undefined)}
      sx={{ minWidth: 0, '[data-seccion] + &': { mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' } }}
    >
      <Stack direction="row" useFlexGap sx={{ alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0.25, mb: 2 }}>
        {Icono && (
          <Box aria-hidden sx={{ display: 'inline-flex', alignSelf: 'center', flex: 'none', color: (t) => t.palette.acento.main }}>
            <Icono size={18} strokeWidth={1.75} />
          </Box>
        )}
        <Typography variant="h4" component={nivel} sx={{ minWidth: 0 }}>
          {titulo}
        </Typography>
        {ayuda && (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: 13, minWidth: 0 }}>
            {ayuda}
          </Typography>
        )}
      </Stack>
      {children}
    </Box>
  );
}
