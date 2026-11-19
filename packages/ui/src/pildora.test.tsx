import { Tab, Tabs, ThemeProvider, ToggleButton } from '@mui/material';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { sxPildora } from './sx';
import { createValidaloTheme } from './tema';
import { COLOR } from './tokens';

/** `#RRGGBB` → `rgb(r, g, b)` (como lo devuelve `getComputedStyle`). */
function hexARgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

const conTema = (nodo: ReactNode) => render(<ThemeProvider theme={createValidaloTheme('light')}>{nodo}</ThemeProvider>);

describe('sxPildora', () => {
  it('la elegida es una píldora blanca con sombra suave y texto principal; las demás, texto gris sin fondo propio', () => {
    conTema(
      <>
        <ToggleButton value="a" selected sx={(t) => sxPildora(t)}>
          Elegida
        </ToggleButton>
        <ToggleButton value="b" selected={false} sx={(t) => sxPildora(t)}>
          Otra
        </ToggleButton>
      </>,
    );
    const elegida = screen.getByRole('button', { name: 'Elegida' });
    expect(getComputedStyle(elegida).backgroundColor).toBe(hexARgb(COLOR.light.superficieNivel1));
    expect(getComputedStyle(elegida).color).toBe(hexARgb(COLOR.light.textoPrimario));
    expect(getComputedStyle(elegida).borderRadius).toBe('10px');
    expect(getComputedStyle(elegida).minHeight).toBe('36px');
    expect(getComputedStyle(screen.getByRole('button', { name: 'Otra' })).backgroundColor).not.toBe(hexARgb(COLOR.light.superficieNivel1));
  });

  it('con la clase del ícono lo deja sin margen y, en la elegida, lo pinta en el acento', () => {
    conTema(
      <Tabs value="a">
        <Tab value="a" label="Elegida" icon={<svg data-testid="icono-a" />} iconPosition="start" sx={(t) => sxPildora(t, '.MuiTab-icon')} />
        <Tab value="b" label="Otra" icon={<svg data-testid="icono-b" />} iconPosition="start" sx={(t) => sxPildora(t, '.MuiTab-icon')} />
      </Tabs>,
    );
    const iconoElegida = screen.getByTestId('icono-a');
    const iconoOtra = screen.getByTestId('icono-b');
    expect(getComputedStyle(iconoElegida).color).toBe(hexARgb(COLOR.light.acento));
    expect(getComputedStyle(iconoElegida).marginRight).toBe('0px');
    expect(getComputedStyle(iconoOtra).color).not.toBe(hexARgb(COLOR.light.acento));
  });
});
