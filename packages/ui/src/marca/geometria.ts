import { COLOR, type Modo } from '../tokens';
import { PALABRA } from './palabra';

export { CAJA_CHECK, CHECK_RELLENO } from './check';

/**
 * Geometría y colores de la marca de Valídalo (MA-1, docs/marca.md). Es la única fuente: el componente `Logo`, las
 * animaciones y el generador de recursos (`marca/generar.mjs`) la leen de aquí; el PDF (`LogosDePdf.cs`) la repite con los mismos
 * trazados y números y una prueba los compara.
 *
 * - **Check («V»)**: una forma caligráfica rellena, de brazo derecho más largo: se lee como V y como check.
 * - **Logotipo**: sin aro ni círculo. La «V» es el check verde, del alto de la letra, apoyado en la línea base, inclinado 10° como la palabra
 *   y muy pegado a la «a» (su brazo largo se mete sobre ella); sigue «alídalo», toda en minúsculas, en Quicksand Bold (SIL OFL) convertida a
 *   contornos (`palabra.ts`, generado por `marca/contornos.mjs`), con seguimiento −0,04 em y espaciado parejo, inclinada 10° a la derecha:
 *   todas las letras de un solo color (verde azulado en claro, el blanco de texto de marca en oscuro). Se lee «Valídalo». Es solo geometría: no
 *   depende de ninguna fuente.
 * - **Ícono** (app, web, PWA, avatar): un aro abierto con el check un poco más grande, cuya punta sale por el hueco del aro.
 * - **Favicon**: un círculo verde lleno con el check blanco.
 * - **Cargando** y **éxito**: el aro completo y el check revelado con una máscara (un relleno no se «dibuja» con `stroke-dashoffset`).
 */

/** Caja del ícono (el check escalado sale un poco del lienzo de 100 × 100 y la punta cruza el hueco del aro). */
export const CAJA_ICONO = { x: -3, y: -6, ancho: 110, alto: 110 } as const;

/** Aro completo (carga y éxito): centro, radio y grosor del trazo. */
export const ARO = { cx: 50, cy: 50, r: 45, grosor: 5 } as const;

/** Largo del aro completo (2πr), para dibujarlo con `stroke-dashoffset`. */
export const LONGITUD_ARO = 2 * Math.PI * ARO.r;

/** Aro abierto del ícono: el hueco queda arriba a la derecha, por donde sale la punta del check. */
export const ARO_ABIERTO = 'M71.1 10.3 A45 45 0 1 0 89 27.5';

/** Check del ícono: escalado 1,15 desde su vértice inferior para que la punta salga por el hueco del aro. */
export const TRANSFORMACION_CHECK_ICONO = 'translate(47 70) scale(1.15) translate(-47 -70)';

/** Check del éxito: centrado dentro del círculo lleno, para que su punta blanca no se pierda fuera de él (sobre fondo claro no se vería). */
export const TRANSFORMACION_CHECK_DENTRO = 'translate(50 50) scale(1) translate(-54.5 -46)';

/** Radio del círculo lleno del éxito. */
export const RADIO_RELLENO = 46;

/**
 * Favicon: círculo verde que llena el lienzo y check blanco más grande y con un contorno propio de 2,4 (solo en el favicon): a 16 px el
 * check de la marca queda fino, y así se sigue leyendo.
 */
export const FAVICON = { radio: 48, transformacion: 'translate(50 50) scale(1.12) translate(-54.5 -46)', contorno: 2.4 } as const;

/**
 * Guía del check: el trazo que lo recorre (brazo corto, vértice, brazo largo). Las animaciones revelan el check con una máscara: esta
 * guía, con trazo ancho y blanco, avanza y descubre el check a su paso.
 */
export const GUIA_CHECK = 'M28 37 L46 68 L82 20';

/** Grosor del trazo de la guía de la máscara: cubre el ancho del check (hasta ≈ 14) en todo su recorrido. */
export const GROSOR_GUIA = 18;

/** Largo de la guía (35,85 + 60), redondeado hacia arriba. */
export const LONGITUD_GUIA = 96;

/** Redondea a `decimales` (los números que se repiten en SVG, PNG y PDF no arrastran ruido de coma flotante). */
const redondear = (n: number, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Margen de seguridad alrededor del logotipo, en unidades de logotipo (la letra mide 100): el borde exacto de un trazado se pierde en el antialias del navegador. */
export const MARGEN_LOGOTIPO = 2;

const ARRIBA = Math.min(PALABRA.v.caja.y0, PALABRA.limites.y0);
const ABAJO = Math.max(PALABRA.v.caja.y1, PALABRA.limites.y1);
const DERECHA = Math.max(PALABRA.v.caja.x1, PALABRA.inicio + PALABRA.limites.x1);

/**
 * Caja del logotipo (`viewBox="0 0 ancho alto"`) y su línea base. Incluye TODO el dibujo —la «V» inclinada con la cola de su brazo largo, el
 * acento de la «í» y el sobrepaso de las curvas bajo la línea base— más `MARGEN_LOGOTIPO` por cada lado: nada debe quedar contra el borde.
 */
export const CAJA_LOGOTIPO = {
  ancho: redondear(DERECHA + 2 * MARGEN_LOGOTIPO),
  alto: redondear(ABAJO - ARRIBA + 2 * MARGEN_LOGOTIPO),
  /** La línea base está a esta distancia del borde superior de la caja. */
  base: redondear(MARGEN_LOGOTIPO - ARRIBA),
} as const;

/** La «V» (el check): su trazado (`PALABRA.v.trazado`) ya viene a su tamaño e inclinado, así que solo se corre a su sitio sobre la línea base. */
export const TRANSFORMACION_V = `translate(${String(MARGEN_LOGOTIPO)} ${String(CAJA_LOGOTIPO.base)})`;

/** La palabra: su origen (inicio de «alídalo» sobre la línea base), con el aire que deja la «V» a la «a». */
export const TRANSFORMACION_PALABRA = `translate(${String(redondear(MARGEN_LOGOTIPO + PALABRA.inicio))} ${String(CAJA_LOGOTIPO.base)})`;

/**
 * Color de las letras del logotipo en cada modo: un solo color para toda la palabra. En claro, el verde azulado de marca `#0E8C9A` (4,0:1
 * sobre #FFFFFF y 3,9:1 sobre #FAFBFD: no llega a 4,5:1 de AA para texto normal, pero la palabra es un dibujo grueso de 14 px o más y cumple el 3:1
 * de texto grande y de logotipos). En oscuro, el blanco de texto de marca del token (`marcaTexto`, #F2F5FB: 17,5:1 sobre #0B1120).
 */
const COLORES_DE_LA_PALABRA = {
  light: { letras: '#0E8C9A' },
  dark: { letras: COLOR.dark.marcaTexto },
} as const;

/** Colores del logo en un modo (de `tokens.ts` el aro y el check; la palabra lleva los suyos; no cambian con la paleta de una empresa). */
export interface ColoresDeLogo {
  /** Aro (ícono y carga). */
  aro: string;
  /** Check (la «V» del logotipo, el círculo del favicon y el ícono) y color del éxito. */
  check: string;
  /** Las letras «alídalo» del logotipo (un solo color). */
  letras: string;
  /** Check sobre el círculo lleno (éxito y favicon). */
  blanco: string;
}

export function coloresDeLogo(modo: Modo): ColoresDeLogo {
  const c = COLOR[modo];
  return { aro: c.marcaAzul, check: c.marcaVerde, ...COLORES_DE_LA_PALABRA[modo], blanco: '#FFFFFF' };
}

/** Tiempos de la animación de éxito, en milisegundos: el aro se dibuja, el círculo se llena, el check se revela y todo hace «pop». */
export const TIEMPOS_EXITO = { aro: 450, relleno: 300, check: 400, pop: 300 } as const;

/** Duración total de la animación de éxito. */
export const DURACION_EXITO = TIEMPOS_EXITO.aro + TIEMPOS_EXITO.relleno + TIEMPOS_EXITO.check + TIEMPOS_EXITO.pop;

/** Tiempos de la animación de carga: una vuelta del arco y un ciclo del check (se revela y se oculta), en milisegundos. */
export const TIEMPOS_CARGA = { vuelta: 1000, check: 1400 } as const;

/** Arco que gira en la carga: largo visible y hueco (el aro mide ≈ 283). */
export const ARCO_DE_CARGA = { visible: 80, hueco: 210 } as const;
