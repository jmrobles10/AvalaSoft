/**
 * El check («V») de la marca y las cuentas que no dependen de ninguna otra pieza: el trazado, su caja exacta y cómo se dispone como la «V»
 * del logotipo. Es un módulo sin importaciones a propósito: `marca/contornos.mjs` lo carga directamente con Node (sin compilar) para calcular
 * el logotipo, y `geometria.ts` lo reexporta al resto del producto. Solo sintaxis que Node sabe quitar (tipos, sin enums ni espacios de nombres).
 */

/** La «V» caligráfica: un check relleno con el brazo derecho más largo. */
export const CHECK_RELLENO =
  'M24 38 C26 34 30 34 32 37 L47 61 C56 45 66 32 80 19 C82 17 85 19 83 22 C70 37 60 52 51 71 C49 75 44 75 42 71 Z';

/** Caja de un trazado: esquina superior izquierda (x0, y0) e inferior derecha (x1, y1). */
export interface CajaDeTrazado {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Punto = [number, number];

/**
 * Aplana un trazado (comandos absolutos `M`, `L`, `C`, `Q` y `Z`, los únicos que usa la marca) en polilíneas, una por contorno. Cada curva se
 * parte en `pasos` tramos: suficiente para medir cajas y distancias con una precisión muy por debajo de una décima de unidad.
 */
export function aplanarTrazado(trazado: string, pasos = 48): Punto[][] {
  const fichas = trazado.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const contornos: Punto[][] = [];
  let actual: Punto[] = [];
  let punto: Punto = [0, 0];
  let inicio: Punto = [0, 0];
  let i = 0;
  const numero = () => Number(fichas[i++]);
  const leerPunto = (): Punto => [numero(), numero()];
  let comando = '';
  while (i < fichas.length) {
    const ficha = fichas[i] ?? '';
    if (/[A-Za-z]/.test(ficha)) {
      comando = ficha.toUpperCase();
      i += 1;
      if (comando === 'Z') {
        if (actual.length > 0) actual.push(inicio);
        punto = inicio;
        continue;
      }
    }
    if (comando === 'M') {
      if (actual.length > 0) contornos.push(actual);
      punto = leerPunto();
      inicio = punto;
      actual = [punto];
      comando = 'L'; // los pares siguientes a un M son líneas
    } else if (comando === 'L') {
      punto = leerPunto();
      actual.push(punto);
    } else if (comando === 'C') {
      const c1 = leerPunto();
      const c2 = leerPunto();
      const fin = leerPunto();
      for (let k = 1; k <= pasos; k += 1) {
        const t = k / pasos;
        const u = 1 - t;
        actual.push([
          u * u * u * punto[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * fin[0],
          u * u * u * punto[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * fin[1],
        ]);
      }
      punto = fin;
    } else if (comando === 'Q') {
      const c = leerPunto();
      const fin = leerPunto();
      for (let k = 1; k <= pasos; k += 1) {
        const t = k / pasos;
        const u = 1 - t;
        actual.push([u * u * punto[0] + 2 * u * t * c[0] + t * t * fin[0], u * u * punto[1] + 2 * u * t * c[1] + t * t * fin[1]]);
      }
      punto = fin;
    } else {
      throw new Error(`Comando de trazado no soportado: ${comando}`);
    }
  }
  if (actual.length > 0) contornos.push(actual);
  return contornos;
}

/** Caja exacta (a la precisión del aplanado) de un trazado: lo que ocupa de verdad, no la caja de sus puntos de control. */
export function cajaDeTrazado(trazado: string): CajaDeTrazado {
  const caja = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const contorno of aplanarTrazado(trazado))
    for (const [x, y] of contorno) {
      caja.x0 = Math.min(caja.x0, x);
      caja.y0 = Math.min(caja.y0, y);
      caja.x1 = Math.max(caja.x1, x);
      caja.y1 = Math.max(caja.y1, y);
    }
  return caja;
}

/** Caja exacta del check, en las coordenadas de su lienzo de 100 × 100. */
export const CAJA_CHECK = cajaDeTrazado(CHECK_RELLENO);

/** Redondea a `decimales`. */
const redondear = (n: number, decimales: number) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/** Escribe un número en un trazado: con los decimales pedidos y sin ceros ni signo de «−0» sobrantes. */
const escribir = (n: number, decimales: number) => String(redondear(n, decimales) + 0);

/**
 * La «V» del logotipo: el check escalado a `alto` unidades de logotipo (la letra mide 100), apoyado en la línea base (y = 0, hacia arriba
 * negativo) e inclinado `inclinacion` grados a la derecha desde esa línea, igual que la palabra. Devuelve el trazado ya transformado, con su
 * borde izquierdo en x = 0, y su caja. Es un trazado propio (no una transformación) para que lo dibujen igual el navegador, los SVG, los PNG y el
 * PDF, que no tiene por qué entender `skewX`.
 */
export function disponerLaV(alto: number, inclinacion: number, decimales = 2): { trazado: string; caja: CajaDeTrazado } {
  const escala = alto / (CAJA_CHECK.y1 - CAJA_CHECK.y0);
  const tangente = Math.tan((inclinacion * Math.PI) / 180);
  // Primero sin correr en x, para saber dónde queda el borde izquierdo tras la inclinación.
  const levantar = (x: number, y: number): Punto => {
    const arriba = (y - CAJA_CHECK.y1) * escala; // ≤ 0: sobre la línea base
    return [(x - CAJA_CHECK.x0) * escala - arriba * tangente, arriba];
  };
  const izquierda = Math.min(...aplanarTrazado(CHECK_RELLENO).flatMap((c) => c.map(([x, y]) => levantar(x, y)[0])));
  const mover = (x: number, y: number): string => {
    const [px, py] = levantar(x, y);
    return `${escribir(px - izquierda, decimales)} ${escribir(py, decimales)}`;
  };
  // Se transforma el trazado del check comando a comando (solo lleva M, L, C y Z, todos absolutos).
  const fichas = CHECK_RELLENO.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const partes: string[] = [];
  for (let i = 0; i < fichas.length; ) {
    const comando = fichas[i++] ?? '';
    if (comando === 'Z') {
      partes.push('Z');
      continue;
    }
    const puntos = comando === 'C' ? 3 : 1;
    const pares: string[] = [];
    for (let k = 0; k < puntos; k += 1) {
      pares.push(mover(Number(fichas[i]), Number(fichas[i + 1])));
      i += 2;
    }
    partes.push(`${comando}${pares.join(' ')}`);
  }
  const trazado = partes.join('');
  return { trazado, caja: cajaDeTrazado(trazado) };
}
