import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { configurarCliente, reiniciarCliente, type RelacionEntreTercerosDto } from '@validasoft/api-client';
import { createValidasoftTheme } from '@validasoft/ui';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSesionTercero } from '../sesion/sesionTercero';
import { AvisoDePropuestasDePersonas } from './AvisoDePropuestas';

const relacion = (id: string, estado: string): RelacionEntreTercerosDto => ({
  id,
  personaId: `persona-${id}`,
  identificacion: { pais: 'CO', tipo: 'CC', numero: `100${id}` },
  nombre: 'María Gómez',
  tipo: 'RepresentanteLegal',
  principal: true,
  participacion: null,
  cargo: null,
  vigenteDesde: '2026-11-01',
  vigenteHasta: null,
  estado,
  fuente: 'ExtraidaIa',
  deFicha: false,
  confianza: 0.91,
  confirmadaEn: null,
  documentos: [],
});

function montar(relaciones: RelacionEntreTercerosDto[], ruta = '/boveda') {
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(relaciones), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  configurarCliente({ fetch });
  render(
    <ThemeProvider theme={createValidasoftTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <AvisoDePropuestasDePersonas />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return fetch;
}

afterEach(() => {
  reiniciarCliente();
  useSesionTercero.setState({ estado: 'sin-sesion', sesion: null });
});

describe('aviso de personas por confirmar', () => {
  it('avisa cuántas propuestas de la IA esperan y lleva a «Personas relacionadas»', async () => {
    useSesionTercero.setState({ estado: 'activa' });
    montar([relacion('1', 'Propuesta'), relacion('2', 'Confirmada')]);

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Hay un cambio de persona relacionada por confirmar');
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/personas');
  });

  it('no aparece si no hay propuestas', async () => {
    useSesionTercero.setState({ estado: 'activa' });
    const sinPropuestas = montar([relacion('2', 'Confirmada')]);
    await vi.waitFor(() => expect(sinPropuestas).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se oculta en la propia pantalla de personas, donde ya se ven las propuestas', async () => {
    useSesionTercero.setState({ estado: 'activa' });
    const consulta = montar([relacion('1', 'Propuesta')], '/personas');
    await vi.waitFor(() => expect(consulta).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no pregunta a la API sin sesión completa', () => {
    useSesionTercero.setState({ estado: 'sin-sesion' });
    const fetch = montar([relacion('1', 'Propuesta')]);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
