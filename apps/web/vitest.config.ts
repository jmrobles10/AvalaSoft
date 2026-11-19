import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

// Pantallas y componentes (`*.test.tsx`): jsdom + React. La lógica pura (`*.test.ts`) corre aparte, en Node, en `vitest.logica.config.ts`.
export default defineProject({
  plugins: [react()],
  test: {
    name: 'web',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/pruebas/preparar.ts'],
    include: ['src/**/*.test.tsx'],
    // Las pruebas de interacción (user-event sobre MUI en jsdom) tardan 2–3 s solas; con los proyectos en paralelo pasaban de 5 s y, con la máquina
    // o el runner cargados, de 20 s: el tope solo protege de cuelgues, no mide velocidad.
    testTimeout: 60_000,
  },
});
