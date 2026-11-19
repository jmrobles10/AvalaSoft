import { useTheme } from '@mui/material';
import type { Modo } from '../tokens';
import {
  ARO,
  ARO_ABIERTO,
  CAJA_ICONO,
  CAJA_LOGOTIPO,
  CHECK_RELLENO,
  coloresDeLogo,
  FAVICON,
  TRANSFORMACION_CHECK_ICONO,
  TRANSFORMACION_PALABRA,
  TRANSFORMACION_SIMBOLO,
} from './geometria';
import { PALABRA } from './palabra';

export type VarianteLogo = 'logotipo' | 'icono' | 'favicon';

export interface LogoProps {
  /**
   * `logotipo` (por omisión): el círculo con el check y la palabra «validalo» (en minúsculas, redondeada e inclinada), toda en contornos; va en barras, ingreso, correos y documentos.
   * `icono`: el aro abierto con el check; va donde solo cabe un símbolo (app instalada, avatar de la marca, notificaciones).
   * `favicon`: el círculo verde lleno con el check blanco, que se lee bien a 16 px.
   */
  variante?: VarianteLogo;
  /**
   * Logotipo: tamaño de la letra en px (el círculo mide lo que la «l»; por omisión 20). Ícono y favicon: lado del cuadrado en px (por omisión 24).
   */
  tamano?: number;
  /** Fuerza los colores de un modo (sobre un fondo que no sigue al tema). Por omisión, el del tema. */
  modo?: Modo;
  /** Nombre accesible. Por omisión «Valídalo». */
  titulo?: string;
  /** Solo decorativo: lo oculta a los lectores de pantalla (cuando el nombre ya está en texto al lado). */
  decorativo?: boolean;
}

/** Atributos de accesibilidad del logo: con nombre (`role="img"`) o decorativo. */
function accesibilidad(titulo: string, decorativo: boolean) {
  return decorativo ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-label': titulo };
}

/** El ícono de la app: aro abierto y check. */
function Icono({ lado, colores, titulo, decorativo }: { lado: number; colores: ReturnType<typeof coloresDeLogo>; titulo: string; decorativo: boolean }) {
  return (
    <svg
      width={lado}
      height={lado}
      viewBox={`${String(CAJA_ICONO.x)} ${String(CAJA_ICONO.y)} ${String(CAJA_ICONO.ancho)} ${String(CAJA_ICONO.alto)}`}
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
      {...accesibilidad(titulo, decorativo)}
    >
      <path d={ARO_ABIERTO} fill="none" stroke={colores.aro} strokeWidth={ARO.grosor} strokeLinecap="round" />
      <path d={CHECK_RELLENO} fill={colores.check} transform={TRANSFORMACION_CHECK_ICONO} />
    </svg>
  );
}

/** El favicon: círculo verde con el check blanco dentro. */
function Favicon({ lado, colores, titulo, decorativo }: { lado: number; colores: ReturnType<typeof coloresDeLogo>; titulo: string; decorativo: boolean }) {
  return (
    <svg width={lado} height={lado} viewBox="0 0 100 100" focusable="false" style={{ flex: 'none', display: 'block' }} {...accesibilidad(titulo, decorativo)}>
      <circle cx={ARO.cx} cy={ARO.cy} r={FAVICON.radio} fill={colores.check} />
      <path d={CHECK_RELLENO} fill={colores.blanco} stroke={colores.blanco} strokeWidth={FAVICON.contorno} strokeLinejoin="round" transform={FAVICON.transformacion} />
    </svg>
  );
}

/** El logotipo: el círculo verde con el check blanco y la palabra «validalo» en dos tonos. Todo son trazados: no depende de fuentes. */
function Logotipo({ letra, colores, titulo, decorativo }: { letra: number; colores: ReturnType<typeof coloresDeLogo>; titulo: string; decorativo: boolean }) {
  const escala = letra / PALABRA.tamano;
  return (
    <svg
      width={CAJA_LOGOTIPO.ancho * escala}
      height={CAJA_LOGOTIPO.alto * escala}
      viewBox={`0 0 ${String(CAJA_LOGOTIPO.ancho)} ${String(CAJA_LOGOTIPO.alto)}`}
      focusable="false"
      style={{ flex: 'none', display: 'block', userSelect: 'none' }}
      {...accesibilidad(titulo, decorativo)}
    >
      <g data-parte="simbolo" transform={TRANSFORMACION_SIMBOLO}>
        <circle cx={ARO.cx} cy={ARO.cy} r={FAVICON.radio} fill={colores.check} />
        <path d={CHECK_RELLENO} fill={colores.blanco} stroke={colores.blanco} strokeWidth={FAVICON.contorno} strokeLinejoin="round" transform={FAVICON.transformacion} />
      </g>
      <g data-parte="palabra" transform={TRANSFORMACION_PALABRA}>
        <path data-parte="avala" d={PALABRA.avala} fill={colores.avala} />
        <path data-parte="soft" d={PALABRA.soft} fill={colores.soft} />
      </g>
    </svg>
  );
}

/**
 * Logo de Valídalo (MA-1, docs/marca.md). Cambia solo con el modo del tema (o con `modo`) y no toma el color de la empresa.
 * El nombre accesible va en el `svg`; la palabra es un dibujo, no texto, así que un lector de pantalla lee el nombre una sola vez.
 */
export function Logo({ variante = 'logotipo', tamano, modo, titulo = 'Valídalo', decorativo = false }: LogoProps) {
  const tema = useTheme();
  const colores = coloresDeLogo(modo ?? (tema.palette.mode === 'dark' ? 'dark' : 'light'));

  if (variante === 'icono') return <Icono lado={tamano ?? 24} colores={colores} titulo={titulo} decorativo={decorativo} />;
  if (variante === 'favicon') return <Favicon lado={tamano ?? 24} colores={colores} titulo={titulo} decorativo={decorativo} />;
  return <Logotipo letra={tamano ?? 20} colores={colores} titulo={titulo} decorativo={decorativo} />;
}
