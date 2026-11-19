import { describe, expect, it } from 'vitest';
import { createValidaloTheme } from './tema';

describe('createValidaloTheme', () => {
  it.each(['web', 'public'] as const)('reserva el espacio de la barra de desplazamiento en %s (sin salto lateral entre pantallas)', (app) => {
    const base = createValidaloTheme('light', { app }).components?.MuiCssBaseline?.styleOverrides;
    expect(base).toMatchObject({
      '@supports (scrollbar-gutter: stable)': { html: { scrollbarGutter: 'stable' }, body: { paddingRight: '0 !important' } },
    });
  });
});
