// Guardia de la trazabilidad de las pruebas e2e retiradas (docs/pruebas/trazabilidad/*.md, decisión PC-1).
// Una e2e solo se retira si su reemplazo (dominio, API o Vitest) existe y está citado; esta prueba lo comprueba:
//   - cada fila cita al menos un reemplazo con la forma «`ruta/del/archivo` › nombre de la prueba»;
//   - el archivo citado existe y contiene ese nombre (si alguien renombra o borra el reemplazo, la fila se rompe);
//   - la e2e retirada ya no está en su `.spec.ts`;
//   - la fila dice si el reemplazo se «mordió» con una mutación («Sí: …») o por qué no aplica («No aplica: …»).
// Vive en `infra/ci-local` solo porque ese directorio ya es un proyecto de Vitest (así no se toca la configuración): corre con `pnpm test`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raiz = new URL('../../', import.meta.url);
const carpeta = new URL('docs/pruebas/trazabilidad/', raiz);
const normalizar = (texto) => texto.replace(/\s+/g, ' ').trim();

/** Filas de las tablas: la primera celda empieza con «`archivo.spec.ts` ›». */
export function leerFilas(markdown) {
  const filas = [];
  for (const linea of markdown.split(/\r?\n/)) {
    if (!linea.startsWith('|')) continue;
    const celdas = linea.split('|').slice(1, -1).map((c) => c.trim());
    const e2e = /^`([\w.-]+\.spec\.ts)`\s*›\s*(.+)$/.exec(celdas[0] ?? '');
    if (!e2e) continue;
    filas.push({ linea, spec: e2e[1], titulo: e2e[2].trim(), verificaba: celdas[1] ?? '', reemplazos: celdas[2] ?? '', mutacion: celdas[3] ?? '' });
  }
  return filas;
}

/** Citas «`ruta` › nombre» separadas por `<br>` o `;`. */
export function leerCitas(celda) {
  return celda
    .split(/<br\s*\/?>|;/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map((c) => {
      const m = /^`([^`]+)`\s*›\s*(.+)$/.exec(c);
      return m ? { ruta: m[1], nombre: normalizar(m[2]) } : { ruta: '', nombre: c };
    });
}

const archivos = existsSync(carpeta) ? readdirSync(carpeta).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'leeme.md') : [];

describe('trazabilidad de las e2e retiradas', () => {
  it('lee las filas de las tablas con su forma', () => {
    const filas = leerFilas('| `uno.spec.ts` › un título | algo | `a/b.cs` › Nombre_uno<br>`c/d.ts` › otro nombre | Sí: x → y |\n|---|---|---|---|');
    expect(filas).toHaveLength(1);
    expect(leerCitas(filas[0].reemplazos)).toEqual([
      { ruta: 'a/b.cs', nombre: 'Nombre_uno' },
      { ruta: 'c/d.ts', nombre: 'otro nombre' },
    ]);
  });

  for (const archivo of archivos) {
    const filas = leerFilas(readFileSync(new URL(archivo, carpeta), 'utf8'));

    describe(archivo, () => {
      it('tiene filas', () => {
        expect(filas.length).toBeGreaterThan(0);
      });

      for (const fila of filas) {
        it(`${fila.spec} › ${fila.titulo.slice(0, 70)}`, () => {
          const citas = leerCitas(fila.reemplazos);
          expect(citas.length, 'cita al menos un reemplazo').toBeGreaterThan(0);
          for (const cita of citas) {
            expect(cita.ruta, `la cita «${cita.nombre}» debe llevar su archivo entre comillas invertidas`).not.toBe('');
            expect(/…|\.\.\./.test(cita.nombre), `la cita «${cita.nombre}» no usa puntos suspensivos: el nombre es literal`).toBe(false);
            const ruta = new URL(cita.ruta, raiz);
            expect(existsSync(ruta), `no existe ${cita.ruta}`).toBe(true);
            expect(normalizar(readFileSync(ruta, 'utf8')).includes(cita.nombre), `«${cita.nombre}» no está en ${cita.ruta}`).toBe(true);
          }

          const spec = new URL(`e2e/pruebas/${fila.spec}`, raiz);
          if (existsSync(spec)) {
            const recorte = normalizar(fila.titulo.split('${')[0]).slice(0, 40);
            expect(normalizar(readFileSync(spec, 'utf8')).includes(recorte), `la e2e «${recorte}» sigue en ${fila.spec}`).toBe(false);
          }

          expect(/^(Sí|No aplica)(?![\p{L}\p{N}_])/u.test(fila.mutacion), 'la columna de mutación empieza con «Sí:» o «No aplica:»').toBe(true);
        });
      }
    });
  }
});
