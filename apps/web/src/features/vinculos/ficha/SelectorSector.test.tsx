import { ThemeProvider } from '@mui/material';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it, vi } from 'vitest';
import type { IndicadoresSector } from './gruposSectores';
import { SelectorSector } from './SelectorSector';
import type { Sector } from './sectores';

const INDICADORES: IndicadoresSector = {
  aprobaciones: { pendientes: 3, conProblema: true },
  general: { pendientes: 1, conProblema: false },
};

function montar(actual: Sector = 'aprobaciones', indicadores: IndicadoresSector = INDICADORES) {
  const alElegir = vi.fn();
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <SelectorSector actual={actual} indicadores={indicadores} onElegir={alElegir} />
    </ThemeProvider>,
  );
  return alElegir;
}

describe('selector de sectores de la ficha (pantallas angostas)', () => {
  it('es un solo botón compacto con el sector actual y su contador, sin pestañas ni fila con scroll horizontal', () => {
    montar();
    const nav = screen.getByRole('navigation', { name: 'Sectores de la ficha' });
    const boton = within(nav).getByRole('button', { name: 'Aprobaciones: 3 pendientes' });
    expect(boton).toHaveAttribute('aria-haspopup', 'menu');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveTextContent('Aprobaciones');
    expect(within(boton).getByTestId('contador')).toHaveTextContent('3');
    expect(within(nav).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('un sector sin pendientes no dibuja contador y su nombre accesible es solo el sector', () => {
    montar('historial');
    const boton = screen.getByRole('button', { name: 'Historial' });
    expect(within(boton).queryByTestId('contador')).not.toBeInTheDocument();
  });

  it('al abrirlo lista los 14 sectores agrupados en Proceso, Información y Registro, con el actual marcado y los contadores', async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes' }));

    const menu = await screen.findByRole('menu');
    expect(screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes', hidden: true })).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByText('Proceso')).toBeInTheDocument();
    expect(within(menu).getByText('Información')).toBeInTheDocument();
    expect(within(menu).getByText('Registro')).toBeInTheDocument();

    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Aprobaciones: 3 pendientes',
      'Información general: 1 pendiente',
      'Seguridad industrial y SST',
      'Cuenta bancaria',
      'Información tributaria',
      'Información financiera',
      'Datos de contacto',
      'Autorización y declaración',
      'Información legal',
      'Oficial de cumplimiento',
      'Documentos adjuntos',
      'Evaluación',
      'Certificado',
      'Historial',
    ]);
    expect(items.filter((i) => i.getAttribute('aria-current') === 'page').map((i) => i.getAttribute('aria-label'))).toEqual(['Aprobaciones: 3 pendientes']);
    expect(within(items[0]!).getByTestId('contador')).toHaveTextContent('3');
    expect(within(items[1]!).getByTestId('contador')).toHaveTextContent('1');
    expect(within(items[2]!).queryByTestId('contador')).not.toBeInTheDocument();
  });

  it('elegir un sector avisa cuál es y cierra el menú', async () => {
    const usuario = userEvent.setup();
    const alElegir = montar();
    await usuario.click(screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Cuenta bancaria' }));

    expect(alElegir).toHaveBeenCalledExactlyOnceWith('cuenta');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('Escape cierra el menú sin elegir nada y el foco vuelve al botón', async () => {
    const usuario = userEvent.setup();
    const alElegir = montar();
    const boton = screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes' });
    await usuario.click(boton);
    await screen.findByRole('menu');
    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(alElegir).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes' })).toHaveFocus();
  });
});
