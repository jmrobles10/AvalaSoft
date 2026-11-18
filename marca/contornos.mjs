// Contornos de la palabra «avalasoft» del logotipo (MA-1, docs/marca.md). Lee la fuente Quicksand Bold (SIL OFL 1.1, paquete
// `@fontsource/quicksand`, solo dependencia de desarrollo de la marca), compone la palabra glifo a glifo con un seguimiento negativo y un
// ajuste óptico por pares (mide el espacio real entre cada par de letras y lo parejo), la inclina y escribe los trazados en
// `packages/ui/src/marca/palabra.ts`. A partir de ahí el logotipo es geometría: `Logo`, los SVG, los PNG y el PDF dibujan esos trazados y
// no dependen de ninguna fuente instalada ni cargada.
//
//   pnpm --filter @avalasoft/marca contornos
//
// Solo hace falta correrlo para cambiar la fuente, el peso, el seguimiento o la inclinación; el resultado se versiona.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import opentype from 'opentype.js';

const aqui = import.meta.dirname;
const repo = resolve(aqui, '..');

/** Fuente y ajustes de la palabra. El tamaño de la letra son 100 unidades; la línea base es y = 0 y hacia arriba es negativo. */
const FUENTE = { archivo: 'node_modules/@fontsource/quicksand/files/quicksand-latin-700-normal.woff', nombre: 'Quicksand Bold (SIL OFL 1.1)' };
const TAMANO = 100;
/** Inclinación hacia la derecha, en grados (oblicua: se aplica a los contornos, la fuente no tiene cursiva). */
const INCLINACION = 10;
/** Seguimiento: espacio extra entre letras, en unidades (−0,04 em: la fuente trae las letras algo despegadas para texto corrido). */
const SEGUIMIENTO = -4;
/** Tope del ajuste óptico de un par, en unidades: lo que cambia el ritmo no cambia el dibujo de la fuente. */
const AJUSTE_MAXIMO = 6;
/** Tope de la separación medida en una fila (las aperturas de la «v» o de la «f» no cuentan como un hueco enorme). */
const HUECO_MAXIMO = 24;
/** Decimales de los trazados: a 1 décima de unidad (0,1 % de la letra) no se ve a ningún tamaño del producto. */
const DECIMALES = 1;
/** Letras que forman «avala» (color de marca); el resto es «soft». */
const TEXTO = 'avalasoft';
const CUANTAS_AVALA = 5;

const archivo = readFileSync(join(aqui, FUENTE.archivo));
const fuente = opentype.parse(archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength));
const escala = TAMANO / fuente.unitsPerEm;

const glifos = [...TEXTO].map((c) => fuente.charToGlyph(c));
const caja = (g) => g.getPath(0, 0, TAMANO).getBoundingBox();
const alturaX = -caja(fuente.charToGlyph('x')).y1;
/** Altura de las ascendentes: la más alta entre la «l» y la «f» (la «t» es más baja). */
const altoL = Math.max(-caja(fuente.charToGlyph('l')).y1, -caja(fuente.charToGlyph('f')).y1);

/** Aplana un glifo (a su tamaño, y hacia abajo) en segmentos rectos para medir dónde cruza una línea horizontal. */
function segmentos(camino) {
  const salida = [];
  let actual = [0, 0];
  let inicio = [0, 0];
  const PASOS = 24;
  const punto = (p0, c1, c2, p1, t) => {
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]];
  };
  const unir = (hasta, intermedios) => {
    let previo = actual;
    for (const p of intermedios) {
      salida.push([previo, p]);
      previo = p;
    }
    salida.push([previo, hasta]);
    actual = hasta;
  };
  for (const c of camino.commands) {
    if (c.type === 'M') {
      actual = [c.x, c.y];
      inicio = actual;
    } else if (c.type === 'L') {
      unir([c.x, c.y], []);
    } else if (c.type === 'Q') {
      const p0 = actual;
      const q = [c.x1, c.y1];
      const c1 = [p0[0] + (2 / 3) * (q[0] - p0[0]), p0[1] + (2 / 3) * (q[1] - p0[1])];
      const c2 = [c.x + (2 / 3) * (q[0] - c.x), c.y + (2 / 3) * (q[1] - c.y)];
      unir([c.x, c.y], Array.from({ length: PASOS - 1 }, (_, i) => punto(p0, c1, c2, [c.x, c.y], (i + 1) / PASOS)));
    } else if (c.type === 'C') {
      const p0 = actual;
      unir([c.x, c.y], Array.from({ length: PASOS - 1 }, (_, i) => punto(p0, [c.x1, c.y1], [c.x2, c.y2], [c.x, c.y], (i + 1) / PASOS)));
    } else if (c.type === 'Z') {
      unir(inicio, []);
    }
  }
  return salida;
}

/** Extremos en x del glifo en la fila `y` (nulo si no la toca). */
function extremos(segs, y) {
  let min = Infinity;
  let max = -Infinity;
  for (const [[x0, y0], [x1, y1]] of segs) {
    if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
      const x = x0 + ((y - y0) * (x1 - x0)) / (y1 - y0);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  return min === Infinity ? null : { min, max };
}

const trazos = glifos.map((g) => segmentos(g.getPath(0, 0, TAMANO)));

/** Separación media entre un glifo y el siguiente, en las filas de las minúsculas (de la línea base a la altura x), con el siguiente a `desplazamiento`. */
function huecoMedio(i, desplazamiento) {
  let suma = 0;
  let cuenta = 0;
  for (let y = -alturaX + 0.5; y < 0; y += 1) {
    const a = extremos(trazos[i], y);
    const b = extremos(trazos[i + 1], y);
    if (!a || !b) continue;
    suma += Math.min(HUECO_MAXIMO, b.min + desplazamiento - a.max);
    cuenta += 1;
  }
  return suma / cuenta;
}

/** Distancia nominal del origen de un glifo al del siguiente: avance, kerning de la fuente y seguimiento. */
const nominal = (i) => glifos[i].advanceWidth * escala + (fuente.getKerningValue(glifos[i], glifos[i + 1]) ?? 0) * escala + SEGUIMIENTO;

const huecos = glifos.slice(0, -1).map((_, i) => huecoMedio(i, nominal(i)));
const objetivo = huecos.reduce((a, b) => a + b, 0) / huecos.length;
const ajustes = huecos.map((h) => Math.max(-AJUSTE_MAXIMO, Math.min(AJUSTE_MAXIMO, objetivo - h)));
const despues = huecos.map((_, i) => huecoMedio(i, nominal(i) + ajustes[i]));
console.log('Pares (hueco medio antes → después de parejar; objetivo ' + objetivo.toFixed(1) + '):');
huecos.forEach((h, i) => console.log(`  ${TEXTO[i]}${TEXTO[i + 1]}  ${h.toFixed(1)} → ${despues[i].toFixed(1)}  (ajuste ${ajustes[i].toFixed(1)})`));

const posiciones = [0];
glifos.slice(0, -1).forEach((_, i) => posiciones.push(posiciones[i] + nominal(i) + ajustes[i]));

const tangente = Math.tan((INCLINACION * Math.PI) / 180);
/** Inclina un trazado desde la línea base: lo que está arriba (y negativa) se corre a la derecha. */
function inclinar(camino) {
  const salida = new opentype.Path();
  const sesgar = (x, y) => x - y * tangente;
  for (const c of camino.commands) {
    switch (c.type) {
      case 'M': salida.moveTo(sesgar(c.x, c.y), c.y); break;
      case 'L': salida.lineTo(sesgar(c.x, c.y), c.y); break;
      case 'Q': salida.quadTo(sesgar(c.x1, c.y1), c.y1, sesgar(c.x, c.y), c.y); break;
      case 'C': salida.curveTo(sesgar(c.x1, c.y1), c.y1, sesgar(c.x2, c.y2), c.y2, sesgar(c.x, c.y), c.y); break;
      case 'Z': salida.close(); break;
      default: throw new Error(`Comando inesperado ${c.type}`);
    }
  }
  return salida;
}

/** Trazado de las letras `desde`…`hasta` (exclusivo), colocadas y ya inclinadas. */
function trazado(desde, hasta) {
  const camino = new opentype.Path();
  for (let i = desde; i < hasta; i += 1) camino.extend(glifos[i].getPath(posiciones[i], 0, TAMANO));
  return inclinar(camino);
}

const trazadoAvala = trazado(0, CUANTAS_AVALA);
const trazadoSoft = trazado(CUANTAS_AVALA, glifos.length);
const cajaAvala = trazadoAvala.getBoundingBox();
const cajaSoft = trazadoSoft.getBoundingBox();
const limites = {
  x0: Math.min(cajaAvala.x1, cajaSoft.x1),
  x1: Math.max(cajaAvala.x2, cajaSoft.x2),
  y0: Math.min(cajaAvala.y1, cajaSoft.y1),
  y1: Math.max(cajaAvala.y2, cajaSoft.y2),
};
const redondear = (n) => Math.round(n * 10 ** DECIMALES) / 10 ** DECIMALES;

const salida = `/* Contornos de la palabra «avalasoft» del logotipo. GENERADO por marca/contornos.mjs (pnpm --filter @avalasoft/marca contornos); no editar a mano.
 * Fuente: ${FUENTE.nombre}, convertida a trazados, con seguimiento de ${String(SEGUIMIENTO / 100).replace('.', ',')} em y espaciado parejo por pares, e inclinada ${String(INCLINACION)}°.
 * Tamaño de la letra: ${String(TAMANO)} unidades; línea base en y = 0 y hacia arriba, negativo. */

export const PALABRA = {
  fuente: '${FUENTE.nombre}',
  tamano: ${String(TAMANO)},
  inclinacion: ${String(INCLINACION)},
  seguimiento: ${String(SEGUIMIENTO)},
  /** Altura de las minúsculas sin ascendente (la de la «x»). */
  alturaX: ${String(redondear(alturaX))},
  /** Altura de las ascendentes («l» y «f»: la más alta de la palabra), sobre la línea base. */
  altoAscendente: ${String(redondear(altoL))},
  /** Límites de los contornos ya inclinados (x, y de la esquina superior izquierda y de la inferior derecha). */
  limites: { x0: ${String(redondear(limites.x0))}, y0: ${String(redondear(limites.y0))}, x1: ${String(redondear(limites.x1))}, y1: ${String(redondear(limites.y1))} },
  /** «avala» (color de marca). */
  avala: '${trazadoAvala.toPathData(DECIMALES)}',
  /** «soft» (color oscuro). */
  soft: '${trazadoSoft.toPathData(DECIMALES)}',
} as const;
`;
writeFileSync(join(repo, 'packages', 'ui', 'src', 'marca', 'palabra.ts'), salida);
console.log(`palabra.ts: alturaX ${redondear(alturaX)}, altoAscendente ${redondear(altoL)}, límites`, limites, `${salida.length} caracteres`);
