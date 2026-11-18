import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type VinculoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../../../shared/useAvisos';
import { TarjetaExpedienteVinculo } from './TarjetaExpedienteVinculo';

/**
 * El expediente en el detalle del vínculo: sin uno abierto (porque se anuló) la empresa abre otro desde ahí, sin depender del tercero
 * (conversión de la e2e `ciclo-vinculo`, PC-1).
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const ADMINISTRADOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesAdministrar]);
const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

const vinculo = (cambios: Partial<VinculoDto> = {}): VinculoDto => ({
  id: 'vin',
  empresaId: 'emp',
  terceroId: 't1',
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  flujoId: null,
  estado: 'Invitado',
  atributos: {},
  correoTercero: 'contacto@aceros.co',
  invitacion: null,
  invitacionAceptadaEn: null,
  requisitosCubribles: null,
  bloqueo: null,
  referencias: [],
  origen: 'Api',
  creadoEn: '2026-11-01T00:00:00Z',
  actualizadoEn: '2026-11-01T00:00:00Z',
  version: 4,
  ...cambios,
});

const FLUJOS = [{ id: 'f1', codigo: 'HAB', nombre: 'Habilitación', tipoVinculo: 'PROVEEDOR', esPorDefecto: true, publicada: { id: 'fv1', version: 1 } }];
const TERCERO = { id: 't1', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, tipoPersona: 'Juridica', nombre: 'Aceros del Norte S.A.S.', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T00:00:00Z' };

function Ubicacion() {
  return <p>{`Ahora en ${useLocation().pathname}`}</p>;
}

function montar(datos: VinculoDto, scopes: ReadonlySet<string> = ADMINISTRADOR) {
  permisos.scopes = new Set(scopes);
  const peticiones: { metodo: string; url: string; cuerpo: unknown }[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const metodo = init?.method ?? 'GET';
      peticiones.push({ metodo, url, cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
      if (metodo === 'POST' && url.endsWith('/vinculos/vin/expedientes')) return Promise.resolve(json({ id: 'e2', folio: 'NORTE-E-2026-000002' }, 201));
      if (url.startsWith('/api/v1/flujos')) return Promise.resolve(json(FLUJOS));
      if (url.startsWith('/api/v1/terceros/')) return Promise.resolve(json(TERCERO));
      return Promise.resolve(json({}));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/emp/vinculos/vin']}>
          <Routes>
            <Route path="/e/:empresaId/vinculos/vin" element={<TarjetaExpedienteVinculo vinculo={datos} />} />
            <Route path="/e/:empresaId/expedientes/:expedienteId" element={<Ubicacion />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return peticiones;
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  useAvisos.getState().cerrar();
});

describe('Expediente en el detalle del vínculo', () => {
  it('sin expediente abierto (tras anularlo) lo dice y la empresa abre otro desde ahí, con el flujo por defecto', async () => {
    const usuario = userEvent.setup();
    const peticiones = montar(vinculo({ estado: 'Invitado', ultimoResultado: 'Anulado' }));

    expect(await screen.findByText('Sin expediente abierto.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Abrir expediente' }));
    const dialogo = await screen.findByRole('dialog', { name: /Abrir expediente/ });
    await waitFor(() => expect(within(dialogo).getByRole('button', { name: 'Abrir expediente' })).toBeEnabled());
    await usuario.click(within(dialogo).getByRole('button', { name: 'Abrir expediente' }));

    await waitFor(() => expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({ flujoId: null }));
    expect(useAvisos.getState().actual?.mensaje).toBe('Expediente NORTE-E-2026-000002 abierto.');
    expect(await screen.findByText('Ahora en /e/emp/expedientes/e2')).toBeInTheDocument();
  });

  it('un vínculo terminado ya no ofrece abrir un expediente', () => {
    montar(vinculo({ estado: 'Anulado' }));

    expect(screen.queryByRole('button', { name: 'Abrir expediente' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sin expediente abierto.')).not.toBeInTheDocument();
  });

  it('quien no administra expedientes no puede abrirlo a mano', () => {
    montar(vinculo({ estado: 'Invitado' }), new Set([SCOPES.expedientesLeer]));

    expect(screen.queryByRole('button', { name: 'Abrir expediente' })).not.toBeInTheDocument();
  });
});
