import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '../i18n';

// `findBy*`/`waitFor` esperan 5 s (1 s por omisión): con los tres proyectos en paralelo el primer render de MUI tarda más.
configure({ asyncUtilTimeout: 5_000 });

// jsdom no trae ResizeObserver y la ficha del vínculo lo usa para medir su encabezado fijo: una versión sin efecto para todas las pruebas
// (las que miden de verdad, como la barra de navegación, lo reemplazan con vi.stubGlobal).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});
