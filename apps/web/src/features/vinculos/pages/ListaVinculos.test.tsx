import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type VinculoDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ListaVinculos } from './ListaVinculos';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function vinculo(id: string, cambios: Partial<VinculoDto>): VinculoDto {
  return {
    id,
    empresaId: 'emp',
    terceroId: `ter-${id}`,
    tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
    flujoId: null,
    estado: 'Activo',
    atributos: {},
    correoTercero: `${id}@proveedor.co`,
    invitacion: null,
    invitacionAceptadaEn: null,
    requisitosCubribles: null,
    bloqueo: null,
    referencias: [],
    origen: 'Invitacion',
    creadoEn: '2026-11-01T15:00:00Z',
    actualizadoEn: '2026-11-08T15:00:00Z',
    version: 1,
    ...cambios,
  };
}

const VINCULOS = [
  vinculo('a', { estado: 'Activo', enRevision: true, expedienteAbiertoId: 'exp-a' }),
  vinculo('b', { estado: 'Activo' }),
  vinculo('c', { estado: 'PorVencer', enRevision: true, expedienteAbiertoId: 'exp-c' }),
];

function montar(ruta = '/e/emp/vinculos', datos: VinculoDto[] | ((url: string) => VinculoDto[]) = VINCULOS) {
  const urls: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      urls.push(url);
      if (url.startsWith('/api/v1/vinculos')) return Promise.resolve(json({ datos: typeof datos === 'function' ? datos(url) : datos, siguienteCursor: null }));
      if (url.startsWith('/api/v1/terceros/')) {
        const id = url.split('/').pop() ?? '';
        return Promise.resolve(json({ id, identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, nombre: `Tercero ${id}`, tipoPersona: 'Juridica', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T15:00:00Z' }));
      }
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/e/:empresaId/vinculos" element={<ListaVinculos />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return urls;
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('Lista de vínculos: «En revisión» por una actualización (VR-1)', () => {
  it('un vínculo con una actualización abierta se ve «En revisión» aunque su estado siga siendo Activo o Por vencer', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    montar();

    const fila = (id: string) => within(screen.getByRole('row', { name: `Abrir vínculo de ${id}@proveedor.co` }));
    await screen.findByRole('row', { name: 'Abrir vínculo de a@proveedor.co' });
    await waitFor(() => expect(fila('a').getByText('En revisión')).toBeInTheDocument());
    expect(fila('a').queryByText('Activo')).not.toBeInTheDocument();
    expect(fila('b').getByText('Activo')).toBeInTheDocument();
    expect(fila('c').getByText('En revisión')).toBeInTheDocument();
    expect(fila('c').queryByText('Por vencer')).not.toBeInTheDocument();
  });

  it('el filtro «En revisión» pide enRevision=true; «Activo» excluye los que se ven «En revisión» (sin repetirlos)', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    const usuario = userEvent.setup();
    const urls = montar();
    await screen.findByRole('table');

    await usuario.click(screen.getByRole('button', { name: /^Estado/ }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'En revisión' }));
    await waitFor(() => expect(urls.some((u) => u.startsWith('/api/v1/vinculos') && u.includes('enRevision=true') && !u.includes('estado='))).toBe(true));

    await usuario.click(screen.getByRole('button', { name: /^Estado/ }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Activo' }));
    await waitFor(() => expect(urls.some((u) => u.includes('estado=Activo') && u.includes('enRevision=false'))).toBe(true));
  });

  it('llegar desde la cifra «En revisión» del inicio (?estado=EnRevision) filtra con enRevision=true', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    const urls = montar('/e/emp/vinculos?estado=EnRevision');
    await screen.findByRole('table');
    await waitFor(() => expect(urls.some((u) => u.startsWith('/api/v1/vinculos') && u.includes('enRevision=true'))).toBe(true));
    expect(screen.getByRole('button', { name: /^Estado\s*En revisión/ })).toBeInTheDocument();
  });
});

describe('Lista de vínculos: crear un vínculo desde la app', () => {
  it('con vinculos:escribir ofrece «Invitar tercero» junto a «Invitar por lote» y abre el formulario', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer, SCOPES.vinculosEscribir]);
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');

    expect(screen.getByRole('button', { name: 'Invitar por lote' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Invitar tercero' }));
    const dialogo = await screen.findByRole('dialog', { name: /Invitar a un tercero/ });
    expect(within(dialogo).getByText(/se crea su vínculo con Constructora Norte/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sin vinculos:escribir no se ofrece invitar', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    montar();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Invitar tercero' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invitar por lote' })).not.toBeInTheDocument();
  });

  it('la lista vacía dice que se puede invitar a mano o por lote, no que solo llegan del ERP o por plantilla', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer, SCOPES.vinculosEscribir]);
    montar('/e/emp/vinculos', []);

    expect(await screen.findByText('Constructora Norte aún no tiene vínculos.')).toBeInTheDocument();
    expect(screen.getByText(/uno a uno con «Invitar tercero» o varios con un archivo en «Invitar por lote»/)).toBeInTheDocument();
  });
});

describe('Lista de vínculos: el filtro «Activo» no repite los que se ven «En revisión»', () => {
  it('si todos los vínculos activos están en revisión, el filtro «Activo» no deja ninguno y lo dice', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    const usuario = userEvent.setup();
    // El servidor excluye de «Activo» (`enRevision=false`) lo que tiene una actualización abierta: aquí es el único vínculo.
    montar('/e/emp/vinculos', (url) => (url.includes('enRevision=false') ? [] : [VINCULOS[0]!]));

    expect(await screen.findByRole('row', { name: 'Abrir vínculo de a@proveedor.co' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /^Estado/ }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Activo' }));

    expect(await screen.findByText('Ningún vínculo coincide con esos filtros.')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: 'Abrir vínculo de a@proveedor.co' })).not.toBeInTheDocument();
  });
});
