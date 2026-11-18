import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type VinculoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../../../shared/useAvisos';
import { expediente } from '../datosPrueba';
import { TarjetaExpedienteVinculo } from './TarjetaExpedienteVinculo';

/**
 * La tarjeta «Expediente» del vínculo: el expediente en curso con su folio y estado (una renovación que abre un reintegro, DS-3) o, tras
 * un rechazo, el aviso de que se abre uno nuevo (DS-4), con la apertura manual para el administrador.
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const ADMIN = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesAdministrar]);
const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

function vinculo(cambios: Partial<VinculoDto>): VinculoDto {
  return {
    id: 'v1',
    empresaId: 'emp',
    terceroId: 'ter',
    tipoVinculo: { id: 'tp', codigo: 'ALIADO', nombre: 'Aliado' },
    flujoId: null,
    estado: 'EnValidacion',
    atributos: {},
    correoTercero: 'contacto@aceros.co',
    invitacion: null,
    invitacionAceptadaEn: null,
    requisitosCubribles: null,
    bloqueo: null,
    referencias: [],
    origen: 'Invitacion',
    creadoEn: '2026-11-01T15:00:00Z',
    actualizadoEn: '2026-11-08T15:00:00Z',
    version: 4,
    ...cambios,
  };
}

function montar(base: VinculoDto, scopes: ReadonlySet<string>) {
  permisos.scopes = new Set(scopes);
  const llamadas: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      llamadas.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.startsWith('/api/v1/terceros/')) return Promise.resolve(json({ id: 'ter', nombre: 'Aceros del Norte S.A.S.', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, tipoPersona: 'Juridica', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T15:00:00Z' }));
      if (url.startsWith('/api/v1/flujos')) return Promise.resolve(json([{ id: 'f1', codigo: 'ALIADOS', nombre: 'Aliados', esPorDefecto: true, publicada: { version: 1 } }]));
      if (url === '/api/v1/vinculos/v1/expedientes') return Promise.resolve(json({ ...expediente('EnRevision'), id: 'nuevo', folio: 'NORTE-E-2026-000002' }, 201));
      if (url.startsWith('/api/v1/expedientes/renov')) return Promise.resolve(json({ ...expediente('EnRevision'), id: 'renov', folio: 'NORTE-E-2026-000003', tipo: 'Renovacion' }));
      return Promise.resolve(json({}));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/emp/vinculos/v1']}>
          <Routes>
            <Route path="/e/:empresaId/vinculos/:vinculoId" element={<TarjetaExpedienteVinculo vinculo={base} />} />
            <Route path="/e/:empresaId/expedientes/:expedienteId" element={<p>Detalle del expediente nuevo</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return llamadas;
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  useAvisos.getState().cerrar();
});

describe('Tarjeta «Expediente» del vínculo', () => {
  it('con una renovación abierta (un reintegro que revalida) muestra «Expediente en curso» con su folio, su estado y el enlace', async () => {
    montar(vinculo({ estado: 'EnValidacion', expedienteAbiertoId: 'renov' }), ADMIN);

    expect(await screen.findByText('Expediente en curso')).toBeInTheDocument();
    expect(await screen.findByText('NORTE-E-2026-000003')).toBeInTheDocument();
    expect(screen.getByText(/^En revisión/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver expediente/ })).toHaveAttribute('href', '/e/emp/expedientes/renov');
    expect(screen.queryByRole('button', { name: 'Abrir expediente' })).not.toBeInTheDocument();
  });

  it('tras un rechazo dice que se abre uno nuevo y el administrador lo abre desde un diálogo: avisa el folio y lleva al expediente nuevo', async () => {
    const usuario = userEvent.setup();
    const llamadas = montar(vinculo({ estado: 'Invitado', expedienteAbiertoId: null, ultimoResultado: 'Rechazado' }), ADMIN);

    expect(await screen.findByText(/El último expediente se rechazó\. Abre uno nuevo/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Abrir expediente' }));
    const dialogo = await screen.findByRole('dialog', { name: /Abrir expediente/ });
    const confirmar = within(dialogo).getByRole('button', { name: 'Abrir expediente' });
    await waitFor(() => expect(confirmar).toBeEnabled()); // espera a que lleguen los flujos publicados
    await usuario.click(confirmar);

    await waitFor(() => expect(llamadas).toContain('POST /api/v1/vinculos/v1/expedientes'));
    expect(await screen.findByText('Detalle del expediente nuevo')).toBeInTheDocument();
    expect(useAvisos.getState().actual?.mensaje).toBe('Expediente NORTE-E-2026-000002 abierto.');
    expect(dialogo).not.toBeInTheDocument();
  });

  it('quien no administra expedientes no ve la tarjeta de un vínculo rechazado sin expediente: ni el aviso ni el botón de abrir uno nuevo', () => {
    montar(vinculo({ estado: 'Invitado', expedienteAbiertoId: null, ultimoResultado: 'Rechazado' }), new Set([SCOPES.expedientesLeer]));

    expect(screen.queryByText(/El último expediente se rechazó/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir expediente' })).not.toBeInTheDocument();
  });
});
