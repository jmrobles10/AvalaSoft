// Contornos del logotipo «Valídalo» (MA-1, docs/marca.md): la palabra «alídalo» y la «V» que la antecede. Lee la fuente Quicksand Bold (SIL OFL 1.1, paquete
// `@fontsource/quicksand`, solo dependencia de desarrollo de la marca), compone la palabra glifo a glifo con un seguimiento negativo y un
// ajuste óptico por pares (mide el espacio real entre cada par de letras y lo parejo), la inclina y escribe los trazados en
// `packages/ui/src/marca/palabra.ts`. A partir de ahí el logotipo es geometría: `Logo`, los SVG, los PNG y el PDF dibujan esos trazados y
// no dependen de ninguna fuente instalada ni cargada.
//
//   pnpm --filter @validalo/marca contornos
//
// Solo hace falta correrlo para cambiar la fuente, el peso, el seguimiento o la inclinación; el resultado se versiona.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import opentype from 'opentype.js';
import { aplanarTrazado, disponerLaV } from '../packages/ui/src/marca/check.ts';

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
/** La palabra que sigue a la «V»: «alída» (azul oscuro) y «lo» (verde azulado). Se lee «Valídalo». */
const TEXTO = 'alídalo';
const CUANTAS_ALIDA = 5;
/** Alto de la «V» (el check) en unidades de logotipo: la letra mide 100 y la «V» mide lo que la letra, apoyada en la línea base. */
const ALTO_V = 100;
/** Separación mínima (distancia real, no solo en horizontal) entre el contorno de la «V» y el de la «a»: la cola del check se mete sobre la «a». */
const HUECO_V = 5;

const archivo = readFileSync(join(aqui, FUENTE.archivo));
const fuente = opentype.parse(archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength));
const escala = TAMANO / fuente.unitsPerEm;

const glifos = [...TEXTO].map((c) => fuente.charToGlyph(c));
const caja = (g) => g.getPath(0, 0, TAMANO).getBoundingBox();
const alturaX = -caja(fuente.charToGlyph('x')).y1;
/** Altura de las ascendentes: la más alta entre la «l» y la «d». */
const altoL = Math.max(-caja(fuente.charToGlyph('l')).y1, -caja(fuente.charToGlyph('d')).y1);

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

const trazadoAlida = trazado(0, CUANTAS_ALIDA);
const trazadoLo = trazado(CUANTAS_ALIDA, glifos.length);
const cajaAlida = trazadoAlida.getBoundingBox();
const cajaLo = trazadoLo.getBoundingBox();
const limites = {
  x0: Math.min(cajaAlida.x1, cajaLo.x1),
  x1: Math.max(cajaAlida.x2, cajaLo.x2),
  y0: Math.min(cajaAlida.y1, cajaLo.y1),
  y1: Math.max(cajaAlida.y2, cajaLo.y2),
};

// La «V»: el check a la altura de la letra, apoyado en la línea base e inclinado como la palabra. Su borde izquierdo es x = 0.
const uve = disponerLaV(ALTO_V, INCLINACION);

/** Puntos del contorno de un trazado, densificados a menos de `paso` unidades entre vecinos (para medir distancias entre contornos). */
function densificar(contornos, paso = 0.6) {
  const salida = [];
  for (const c of contornos)
    for (let i = 1; i < c.length; i += 1) {
      const [x0, y0] = c[i - 1];
      const [x1, y1] = c[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / paso));
      for (let k = 0; k < n; k += 1) salida.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
  return salida;
}
const puntosUve = densificar(aplanarTrazado(uve.trazado, 96));
// La primera letra («a») ya inclinada y en su sitio dentro de la palabra (origen 0).
const puntosA = densificar(aplanarTrazado(trazado(0, 1).toPathData(3), 96));
const distanciaMinima = (desplazamiento) => {
  let minimo = Infinity;
  for (const [vx, vy] of puntosUve)
    for (const [ax, ay] of puntosA) {
      const d = Math.hypot(vx - (ax + desplazamiento), vy - ay);
      if (d < minimo) minimo = d;
    }
  return minimo;
};
// Se acerca la palabra a la «V» desde la derecha hasta que el contorno de la «a» queda a HUECO_V del check (el brazo largo sube por encima de la «a»).
let inicioPalabra = uve.caja.x1 + 20;
// De grueso a fino: se avanza de a 4, se retrocede un paso y se vuelve a avanzar de a menos, hasta 0,05 unidades.
for (const paso of [4, 1, 0.25, 0.05]) {
  while (distanciaMinima(inicioPalabra) > HUECO_V && inicioPalabra > 0) inicioPalabra -= paso;
  if (paso > 0.05) inicioPalabra += paso;
}
inicioPalabra = Math.round(inicioPalabra * 10) / 10;
console.log(`«V»: caja ${JSON.stringify(uve.caja)}; la palabra empieza en x = ${inicioPalabra} (solapa ${(uve.caja.x1 - (inicioPalabra + limites.x0)).toFixed(1)} unidades con el borde derecho de la «V»), a ${distanciaMinima(inicioPalabra).toFixed(2)} de la «a».`);
const redondear = (n) => Math.round(n * 10 ** DECIMALES) / 10 ** DECIMALES;
/** Redondeo hacia afuera de una caja (el mínimo hacia abajo, el máximo hacia arriba): la caja publicada nunca es menor que el dibujo. */
const haciaAfuera = (n, esMaximo) => (esMaximo ? Math.ceil(n * 10 ** DECIMALES - 1e-9) : Math.floor(n * 10 ** DECIMALES + 1e-9)) / 10 ** DECIMALES;

const salida = `/* Contornos del logotipo «Valídalo»: la «V» (el check) y la palabra «alídalo». GENERADO por marca/contornos.mjs (pnpm --filter @validalo/marca contornos); no editar a mano.
 * Fuente: ${FUENTE.nombre}, convertida a trazados, con seguimiento de ${String(SEGUIMIENTO / 100).replace('.', ',')} em y espaciado parejo por pares, e inclinada ${String(INCLINACION)}°.
 * Tamaño de la letra: ${String(TAMANO)} unidades; línea base en y = 0 y hacia arriba, negativo. */

export const PALABRA = {
  fuente: '${FUENTE.nombre}',
  tamano: ${String(TAMANO)},
  inclinacion: ${String(INCLINACION)},
  seguimiento: ${String(SEGUIMIENTO)},
  /** Altura de las minúsculas sin ascendente (la de la «x»). */
  alturaX: ${String(redondear(alturaX))},
  /** Altura de las ascendentes («l» y «d»), sobre la línea base. */
  altoAscendente: ${String(redondear(altoL))},
  /** Límites de los contornos ya inclinados (x, y de la esquina superior izquierda y de la inferior derecha). */
  limites: { x0: ${String(haciaAfuera(limites.x0, false))}, y0: ${String(haciaAfuera(limites.y0, false))}, x1: ${String(haciaAfuera(limites.x1, true))}, y1: ${String(haciaAfuera(limites.y1, true))} },
  /** La «V» (el check) a ${String(ALTO_V)} unidades de alto, apoyada en la línea base e inclinada como la palabra: trazado y caja, con su borde izquierdo en x = 0. */
  v: {
    trazado: '${uve.trazado}',
    caja: { x0: ${String(haciaAfuera(uve.caja.x0, false))}, y0: ${String(haciaAfuera(uve.caja.y0, false))}, x1: ${String(haciaAfuera(uve.caja.x1, true))}, y1: ${String(haciaAfuera(uve.caja.y1, true))} },
  },
  /** Dónde va el origen de la palabra, medido desde el borde izquierdo de la «V»: el contorno de la «a» queda a ${String(HUECO_V)} unidades del check (la cola de la «V» se mete sobre la «a»). */
  inicio: ${String(inicioPalabra)},
  /** «alída» (azul oscuro). */
  alida: '${trazadoAlida.toPathData(DECIMALES)}',
  /** «lo» (verde azulado). */
  lo: '${trazadoLo.toPathData(DECIMALES)}',
} as const;
`;
writeFileSync(join(repo, 'packages', 'ui', 'src', 'marca', 'palabra.ts'), salida);
console.log(`palabra.ts: alturaX ${redondear(alturaX)}, altoAscendente ${redondear(altoL)}, límites`, limites, `${salida.length} caracteres`);
