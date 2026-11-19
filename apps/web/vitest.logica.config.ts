import { defineProject } from 'vitest/config';

// Lógica pura (`*.test.ts`): modelos, formatos, validaciones y clientes sin pantalla. Corre en Node, sin jsdom ni el montaje de MUI, y
// comparte los módulos de su hilo (`isolate: false`). La que sí necesite el DOM lo declara con `// @vitest-environment jsdom` (PV-5).
export default defineProject({
  test: {
    name: 'web-logica',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/pruebas/preparar.logica.ts'],
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    isolate: false,
    testTimeout: 10_000,
  },
});
