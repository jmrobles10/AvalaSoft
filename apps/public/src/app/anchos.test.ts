import { describe, expect, it } from 'vitest';
import { ANCHO_PANEL, esSeccionDeFicha } from './anchos';

describe('ancho del marco del tercero', () => {
  it('es uno solo para todas las páginas (1440), para que nada se mueva al navegar', () => {
    expect(ANCHO_PANEL).toBe(1440);
  });

  it.each(['/ficha/general', '/ficha/financiera', '/ficha/tributaria'])('%s es una sección de Mi información', (ruta) => {
    expect(esSeccionDeFicha(ruta)).toBe(true);
  });

  it.each(['/ficha', '/boveda', '/boveda/subir', '/empresas/abc', '/privacidad', '/expediente/e1'])('%s no es una sección de Mi información', (ruta) => {
    expect(esSeccionDeFicha(ruta)).toBe(false);
  });
});
