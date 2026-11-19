import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it } from 'vitest';
import { MarcoMinimo } from './MarcoMinimo';

const montar = (modo: 'light' | 'dark') =>
  render(
    <ThemeProvider theme={createValidaloTheme(modo)}>
      <MarcoMinimo>
        <p>contenido</p>
      </MarcoMinimo>
    </ThemeProvider>,
  );

describe('MarcoMinimo (la cabecera del ingreso): la marca', () => {
  it('lleva el logotipo con los colores del modo claro', () => {
    montar('light');
    const logo = within(screen.getByRole('banner')).getByRole('img', { name: 'Valídalo' });
    expect(logo.querySelector('[data-parte="v"]')).toHaveAttribute('fill', '#22D38A');
    expect(logo.querySelector('[data-parte="palabra"]')).toHaveAttribute('fill', '#0E8C9A');
  });

  it('cambia de colores con el tema oscuro', () => {
    montar('dark');
    const logo = within(screen.getByRole('banner')).getByRole('img', { name: 'Valídalo' });
    expect(logo.querySelector('[data-parte="v"]')).toHaveAttribute('fill', '#2BE29A');
    expect(logo.querySelector('[data-parte="palabra"]')).toHaveAttribute('fill', '#F2F5FB');
  });
});
