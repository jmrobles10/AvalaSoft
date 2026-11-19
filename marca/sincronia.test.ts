import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ARCO_DE_CARGA,
  ARO_ABIERTO,
  CAJA_LOGOTIPO,
  CHECK_RELLENO,
  coloresDeLogo,
  FAVICON,
  GUIA_CHECK,
  LONGITUD_GUIA,
  MARGEN_LOGOTIPO,
  TIEMPOS_CARGA,
  TRANSFORMACION_CHECK_ICONO,
  TRANSFORMACION_PALABRA,
  TRANSFORMACION_V,
} from '../packages/ui/src/marca/geometria';
import { PALABRA } from '../packages/ui/src/marca/palabra';
import { decodificarPng } from './png.ts';

/**
 * Sincronía de la marca (MA-1): los recursos que el generador deja en `marca/` y las copias que usan las apps, los correos y el PDF no se
 * pueden separar de la geometría de `@validalo/ui` ni entre sí. El generador necesita un navegador; estas pruebas solo leen archivos.
 */
const repo = resolve(import.meta.dirname, '..');
const leer = (...ruta: string[]) => readFileSync(join(repo, ...ruta));
const texto = (...ruta: string[]) => leer(...ruta).toString('utf8');
const dimensionesPng = (png: Buffer) => ({ ancho: png.readUInt32BE(16), alto: png.readUInt32BE(20) });

describe('recursos de marca generados', () => {
  it('los PNG tienen el tamaño de su nombre', () => {
    const esperados: Record<string, number> = { 'favicon-16.png': 16, 'favicon-32.png': 32, 'favicon-48.png': 48, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512, 'avatar-512.png': 512 };
    for (const [nombre, lado] of Object.entries(esperados)) {
      const png = leer('marca', 'png', nombre);
      expect(png.subarray(1, 4).toString('ascii'), nombre).toBe('PNG');
      expect(dimensionesPng(png), nombre).toEqual({ ancho: lado, alto: lado });
    }
  });

  it('los logotipos PNG están al doble de su tamaño (el correo los muestra a la mitad)', () => {
    for (const modo of ['claro', 'oscuro']) {
      const { ancho, alto } = dimensionesPng(leer('marca', 'png', `logotipo-${modo}@2x.png`));
      expect(ancho % 2).toBe(0);
      expect(alto % 2).toBe(0);
      expect(ancho / alto).toBeGreaterThan(3);
    }
  });

  it('los GIF son GIF89a animados, sin fin, de 2× el tamaño de la escena y de peso razonable', () => {
    for (const nombre of ['exito-claro', 'exito-oscuro', 'cargando-claro', 'cargando-oscuro']) {
      const gif = leer('marca', 'gif', `${nombre}.gif`);
      expect(gif.subarray(0, 6).toString('ascii'), nombre).toBe('GIF89a');
      expect(gif.readUInt16LE(6), nombre).toBe(gif.readUInt16LE(8)); // cuadrado
      expect(gif.includes(Buffer.from('NETSCAPE2.0')), nombre).toBe(true);
      expect(gif.length, nombre).toBeLessThan(150_000);
      expect(gif.at(-1)).toBe(0x3b);
    }
  });

  it('los SVG llevan la geometría aprobada y los colores de cada modo', () => {
    for (const [nombre, modo] of [['claro', 'light'], ['oscuro', 'dark']] as const) {
      const c = coloresDeLogo(modo);
      const logotipo = texto('marca', 'svg', `logotipo-${nombre}.svg`);
      expect(logotipo).toContain(`viewBox="0 0 ${String(CAJA_LOGOTIPO.ancho)} ${String(CAJA_LOGOTIPO.alto)}"`);
      expect(logotipo).toContain(`<path d="${PALABRA.v.trazado}" fill="${c.check}" transform="${TRANSFORMACION_V}"/>`);
      expect(logotipo).toContain(`<path d="${PALABRA.letras}" fill="${c.letras}" transform="${TRANSFORMACION_PALABRA}"/>`);
      // La «V» es el check sin círculo: el logotipo no lleva ni círculo ni check blanco.
      expect(logotipo).not.toContain('<circle');
      expect(logotipo).not.toContain(c.blanco);
      // Solo trazados: el logotipo no depende de ninguna fuente.
      expect(logotipo).not.toContain('<text');
      expect(logotipo).not.toContain('font-family');
      const icono = texto('marca', 'svg', `icono-${nombre}.svg`);
      expect(icono).toContain(ARO_ABIERTO);
      expect(icono).toContain(CHECK_RELLENO);
      expect(icono).toContain(TRANSFORMACION_CHECK_ICONO);
      expect(icono).toContain(c.aro);
      expect(icono).toContain(c.check);
    }
  });

  it('el favicon SVG es el círculo verde con el check blanco y cambia de verde con el modo oscuro del sistema', () => {
    const svg = texto('marca', 'svg', 'favicon.svg');
    expect(svg).toContain(CHECK_RELLENO);
    expect(svg).toContain(FAVICON.transformacion);
    expect(svg).toContain(`r="${String(FAVICON.radio)}"`);
    expect(svg).toContain(coloresDeLogo('light').check);
    expect(svg).toMatch(/@media \(prefers-color-scheme: dark\)[^}]*\{[^}]*#2BE29A/);
  });
});

describe('copias que usan el producto', () => {
  const comunes = ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

  it.each(['apps/web/public', 'apps/public/public'])('%s es idéntica a lo generado y trae su manifest', (carpeta) => {
    for (const nombre of comunes) {
      const origen = nombre.endsWith('.svg') ? ['marca', 'svg', nombre] : ['marca', 'png', nombre];
      expect(leer(...carpeta.split('/'), nombre).equals(leer(...origen)), `${carpeta}/${nombre}`).toBe(true);
    }
    const manifest = JSON.parse(texto(...carpeta.split('/'), 'manifest.webmanifest')) as { name: string; icons: { src: string; sizes: string; purpose: string }[]; display: string; lang: string };
    expect(manifest.lang).toBe('es-CO');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((i) => i.purpose)).toContain('maskable');
    for (const icono of manifest.icons) expect(existsSync(join(repo, carpeta, icono.src)), icono.src).toBe(true);
  });

  it.each(['apps/web', 'apps/public'])('el index.html de %s enlaza el favicon, los íconos y el manifest y lleva la carga de marca', (carpeta) => {
    const html = texto(...carpeta.split('/'), 'index.html');
    for (const enlace of ['/favicon.svg', '/favicon-32.png', '/favicon-16.png', '/apple-touch-icon.png', '/manifest.webmanifest']) expect(html, enlace).toContain(`href="${enlace}"`);
    // La carga de marca (entre las marcas del generador) usa la misma geometría y los mismos tiempos que `Cargando`.
    const carga = /<!-- marca:splash:inicio -->([\s\S]*)<!-- marca:splash:fin -->/.exec(html)?.[1] ?? '';
    expect(carga).toContain(CHECK_RELLENO);
    expect(carga).toContain(GUIA_CHECK);
    expect(carga).toContain(TRANSFORMACION_CHECK_ICONO);
    expect(carga).toContain(`stroke-dasharray="${String(ARCO_DE_CARGA.visible)} ${String(ARCO_DE_CARGA.hueco)}"`);
    expect(carga).toContain(`vs-girar ${String(TIEMPOS_CARGA.vuelta)}ms linear infinite`);
    expect(carga).toContain(`vs-trazar ${String(TIEMPOS_CARGA.check)}ms ease-in-out infinite`);
    expect(carga).toContain(`stroke-dasharray: ${String(LONGITUD_GUIA)} ${String(LONGITUD_GUIA)}`);
    expect(carga).toContain('role="status"');
    expect(carga).toContain('prefers-reduced-motion: reduce');
  });

  it('los correos incrustan el logotipo claro y el GIF de éxito claro que genera la marca', () => {
    const recursos = ['src', 'Validalo.Aplicacion', 'Comun', 'RecursosDeMarca'];
    expect(leer(...recursos, 'logotipo.png').equals(leer('marca', 'png', 'logotipo-claro@2x.png'))).toBe(true);
    expect(leer(...recursos, 'exito.gif').equals(leer('marca', 'gif', 'exito-claro.gif'))).toBe(true);
  });

  it('el PDF dibuja el mismo logotipo: los mismos trazados, transformaciones, caja y colores del modo claro', () => {
    const pdf = texto('src', 'Validalo.Infraestructura', 'Ficha', 'LogosDePdf.cs');
    const c = coloresDeLogo('light');
    expect(pdf).toContain(`viewBox="0 0 ${String(CAJA_LOGOTIPO.ancho)} ${String(CAJA_LOGOTIPO.alto)}"`);
    expect(pdf).toContain(`<path d="${PALABRA.v.trazado}" fill="${c.check}" transform="${TRANSFORMACION_V}"/>`);
    expect(pdf).toContain(`<path d="${PALABRA.letras}" fill="${c.letras}" transform="${TRANSFORMACION_PALABRA}"/>`);
    expect(pdf).not.toContain('<circle');
    expect(coloresDeLogo('light')).toMatchObject({ letras: '#0E8C9A' });
    expect(coloresDeLogo('dark')).toMatchObject({ letras: '#F2F5FB' });
  });
});

describe('alineación del logotipo (medida sobre el PNG)', () => {
  /** Mide el PNG claro @2x píxel a píxel: la «V» verde y las letras (verde azulado), sin fiarse de las constantes. */
  function medir() {
    const { ancho, alto, rgba } = decodificarPng(leer('marca', 'png', 'logotipo-claro@2x.png'));
    const cerca = (i: number, [r, g, b]: number[], tolerancia: number) =>
      (rgba[i + 3] ?? 0) > 128 && Math.abs((rgba[i] ?? 0) - (r ?? 0)) < tolerancia && Math.abs((rgba[i + 1] ?? 0) - (g ?? 0)) < tolerancia && Math.abs((rgba[i + 2] ?? 0) - (b ?? 0)) < tolerancia;
    const caja = (esDeLaParte: (i: number) => boolean) => {
      const c = { x0: Infinity, x1: -1, y0: Infinity, y1: -1 };
      for (let y = 0; y < alto; y += 1)
        for (let x = 0; x < ancho; x += 1)
          if (esDeLaParte((y * ancho + x) * 4)) {
            c.x0 = Math.min(c.x0, x);
            c.x1 = Math.max(c.x1, x);
            c.y0 = Math.min(c.y0, y);
            c.y1 = Math.max(c.y1, y);
          }
      return { ...c, ancho: c.x1 - c.x0 + 1, alto: c.y1 - c.y0 + 1 };
    };
    const uve = caja((i) => cerca(i, [0x22, 0xd3, 0x8a], 40));
    const palabra = caja((i) => cerca(i, [0x0e, 0x8c, 0x9a], 30));
    const todo = caja((i) => (rgba[i + 3] ?? 0) > 8);
    return { ancho, alto, uve, palabra, todo };
  }

  it('la «V» mide lo que la letra y se apoya en la línea base (a menos de un par de píxeles del PNG @2x)', () => {
    const { uve, palabra } = medir();
    // El PNG está a 32 px de letra y al doble: 100 unidades de logotipo son 64 px.
    const pixelesPorUnidad = (32 * 2) / PALABRA.tamano;
    expect(Math.abs(uve.alto - PALABRA.tamano * pixelesPorUnidad)).toBeLessThanOrEqual(2);
    // La palabra llega a la línea base más el sobrepaso de sus curvas (1 unidad): la punta de la «V» cae ahí, no por debajo ni muy arriba.
    expect(Math.abs(uve.y1 - palabra.y1)).toBeLessThanOrEqual(2);
    // La «V» sube por encima de las ascendentes (el brazo largo del check).
    expect(uve.y0).toBeLessThan(palabra.y0);
  });

  it('la «V» queda pegada a la «a»: su brazo largo se mete sobre ella (la palabra empieza antes de que termine la «V») y no la toca', () => {
    const { uve, palabra } = medir();
    expect(palabra.x0).toBeLessThan(uve.x1);
    expect(palabra.x0).toBeGreaterThan(uve.x0);
    // La «V» y la palabra son de colores distintos: si se tocaran por completo no habría una «a» legible; la distancia mínima entre sus contornos es fija (HUECO_V de contornos.mjs).
    expect(uve.x1 - palabra.x0).toBeGreaterThan(20);
  });

  it('el PNG deja el margen de seguridad alrededor de todo el dibujo: ni la cola del check ni el acento ni la inclinación tocan el borde', () => {
    const { ancho, alto, todo } = medir();
    const pixelesPorUnidad = (32 * 2) / PALABRA.tamano;
    const margen = Math.floor(MARGEN_LOGOTIPO * pixelesPorUnidad);
    expect(todo.x0).toBeGreaterThanOrEqual(margen);
    expect(todo.y0).toBeGreaterThanOrEqual(margen);
    expect(ancho - 1 - todo.x1).toBeGreaterThanOrEqual(margen);
    expect(alto - 1 - todo.y1).toBeGreaterThanOrEqual(margen);
    expect(margen).toBeGreaterThanOrEqual(1);
    // El tamaño del PNG sale de la caja del logotipo (a 32 px de letra y 2×).
    expect(Math.abs(ancho - CAJA_LOGOTIPO.ancho * pixelesPorUnidad)).toBeLessThanOrEqual(1);
    expect(Math.abs(alto - CAJA_LOGOTIPO.alto * pixelesPorUnidad)).toBeLessThanOrEqual(1);
  });
});
