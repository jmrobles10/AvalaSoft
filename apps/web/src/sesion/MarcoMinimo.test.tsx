import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import { createValidasoftTheme } from '@validasoft/ui';
import { describe, expect, it } from 'vitest';
import { MarcoMinimo } from './MarcoMinimo';

const montar = (modo: 'light' | 'dark') =>
  render(
    <ThemeProvider theme={createValidasoftTheme(modo)}>
      <MarcoMinimo>
        <p>contenido</p>
      </MarcoMinimo>
    </ThemeProvider>,
  );

describe('MarcoMinimo (la cabecera del ingreso): la marca', () => {
  it('lleva el logotipo con los colores del modo claro', () => {
    montar('light');
    const logo = within(screen.getByRole('banner')).getByRole('img', { name: 'AvalaSoft' });
    expect(logo.querySelector('[data-parte="simbolo"] circle')).toHaveAttribute('fill', '#22D38A');
    expect(logo.querySelector('[data-parte="avala"]')).toHaveAttribute('fill', '#0E8C9A');
    expect(logo.querySelector('[data-parte="soft"]')).toHaveAttribute('fill', '#0B1F3A');
  });

  it('cambia de colores con el tema oscuro', () => {
    montar('dark');
    const logo = within(screen.getByRole('banner')).getByRole('img', { name: 'AvalaSoft' });
    expect(logo.querySelector('[data-parte="simbolo"] circle')).toHaveAttribute('fill', '#2BE29A');
    expect(logo.querySelector('[data-parte="avala"]')).toHaveAttribute('fill', '#3FC1CE');
    expect(logo.querySelector('[data-parte="soft"]')).toHaveAttribute('fill', '#EEF3FA');
  });
});
