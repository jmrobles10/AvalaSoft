import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it, vi } from 'vitest';
import { BarraSectores } from './BarraSectores';
import type { IndicadoresSector } from './gruposSectores';
import type { Sector } from './sectores';

const INDICADORES: IndicadoresSector = {
  aprobaciones: { pendientes: 1, conProblema: false },
  legal: { pendientes: 2, conProblema: true },
};

function montar(actual: Sector = 'aprobaciones') {
  const alElegir = vi.fn();
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <BarraSectores actual={actual} indicadores={INDICADORES} onElegir={alElegir} />
    </ThemeProvider>,
  );
  return alElegir;
}

describe('barra lateral de sectores de la ficha (pantallas anchas)', () => {
  it('es la navegación agrupada de la Plataforma: títulos de grupo, un botón por sector y el activo marcado', () => {
    montar();
    const nav = screen.getByRole('navigation', { name: 'Sectores de la ficha' });
    for (const grupo of ['Proceso', 'Información', 'Registro']) expect(within(nav).getByText(grupo)).toBeInTheDocument();
    const botones = within(nav).getAllByRole('button');
    expect(botones).toHaveLength(14);
    // Navegación por estado (el sector va en la URL): no son enlaces ni hay control de colapsar.
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Navegación')).not.toBeInTheDocument();
    expect(botones.filter((b) => b.getAttribute('aria-current') === 'page').map((b) => b.getAttribute('aria-label'))).toEqual(['Aprobaciones: 1 pendiente']);
  });

  it('conserva los contadores de pendientes y su nombre accesible, en ámbar si el sector tiene algo observado o rechazado', () => {
    montar();
    const nav = screen.getByRole('navigation', { name: 'Sectores de la ficha' });
    const aprobaciones = within(nav).getByRole('button', { name: 'Aprobaciones: 1 pendiente' });
    const legal = within(nav).getByRole('button', { name: 'Información legal: 2 pendientes' });
    expect(within(aprobaciones).getByTestId('contador')).toHaveTextContent('1');
    expect(within(legal).getByTestId('contador')).toHaveTextContent('2');
    // Sin pendientes no hay contador y el nombre accesible es el del sector.
    expect(within(within(nav).getByRole('button', { name: 'Historial' })).queryByTestId('contador')).not.toBeInTheDocument();
    // El tono de advertencia se nota en el color del contador (distinto del neutro).
    expect(getComputedStyle(within(legal).getByTestId('contador')).color).not.toBe(getComputedStyle(within(aprobaciones).getByTestId('contador')).color);
  });

  it('elegir un sector avisa cuál es', async () => {
    const usuario = userEvent.setup();
    const alElegir = montar();
    await usuario.click(screen.getByRole('button', { name: 'Información legal: 2 pendientes' }));
    expect(alElegir).toHaveBeenCalledExactlyOnceWith('legal');
  });

  it('los ítems son compactos (34 px) para que los 14 sectores quepan sin desplazar la página', () => {
    montar();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Historial' })).height).toBe('34px');
  });
});
