import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type InformeVinculosDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaInformeVinculos } from './PaginaInformeVinculos';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const INFORME: InformeVinculosDto = {
  resumen: { total: 40, porEstado: [], conCertificadoVigente: 30, conDocumentosPorVencer: 6, conDocumentosVencidos: 2, conSeccionesPendientes: 4 },
  datos: [
    {
      vinculoId: 'v1',
      tercero: { id: 't1', nombre: 'Aceros del Norte', identificacion: 'CO|NIT|900123456' },
      tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
      estado: 'Activo',
      creadoEn: '2026-10-01T00:00:00Z',
      invitacionAceptada: true,
      certificado: null,
      expedienteEnCurso: null,
      documentos: null,
      seccionesPendientes: [],
    },
  ],
  siguienteCursor: null,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function UbicacionActual() {
  return <p>{`Ubicación: ${useLocation().pathname}`}</p>;
}

function montar(ruta = '/e/emp/informes/vinculos', informe: InformeVinculosDto = INFORME) {
  const peticiones: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      peticiones.push(url);
      if (url.startsWith('/api/v1/informes/vinculos/excel')) {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Disposition': 'attachment; filename=vinculos.xlsx' } }));
      }
      if (url.startsWith('/api/v1/informes/vinculos')) return Promise.resolve(json(informe));
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/e/:empresaId/informes/vinculos" element={<PaginaInformeVinculos />} />
            <Route path="/e/:empresaId/vinculos/:vinculoId" element={<UbicacionActual />} />
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
});

describe('Informe de terceros y vínculos', () => {
  it('sin vinculos:leer no muestra el informe ni consulta', () => {
    const peticiones = montar();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(peticiones).toHaveLength(0);
  });

  it('muestra el resumen en tarjetas (los vencidos en alerta) y cada vínculo; la fila abre el vínculo', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    montar();
    expect(await screen.findByRole('tab', { name: 'Terceros y vínculos', selected: true })).toHaveAttribute('href', '/e/emp/informes/vinculos');
    // Mientras carga, esqueletos con la forma de las tarjetas.
    expect(screen.getByRole('status', { name: 'Resumen del informe de terceros y vínculos' })).toHaveAttribute('aria-busy', 'true');

    const fila = await screen.findByRole('row', { name: 'Abrir el vínculo de Aceros del Norte' });
    const resumen = screen.getByRole('region', { name: 'Resumen del informe de terceros y vínculos' });
    const tarjeta = (nombre: string) => within(resumen).getByRole('group', { name: nombre });
    expect(tarjeta('Vínculos')).toHaveTextContent('40');
    expect(tarjeta('Con certificado')).toHaveTextContent('30');
    expect(within(tarjeta('Con certificado')).getByRole('img', { name: '30 de 40 vínculos con certificado vigente' })).toBeInTheDocument();
    expect(tarjeta('Por vencer')).toHaveTextContent('6');
    expect(tarjeta('Vencidos')).toHaveTextContent('2');
    expect(tarjeta('Por validar')).toHaveTextContent('4');

    await userEvent.click(fila);
    expect(await screen.findByText('Ubicación: /e/emp/vinculos/v1')).toBeInTheDocument();
  });

  it('los filtros de la URL van a la consulta y a la descarga de Excel, sin la paginación; «Limpiar filtros» los quita', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    const peticiones = montar('/e/emp/informes/vinculos?estado=Invitado');
    await screen.findByRole('row', { name: 'Abrir el vínculo de Aceros del Norte' });
    expect(peticiones.find((p) => p.startsWith('/api/v1/informes/vinculos?'))).toMatch(/estado=Invitado.*limite=50/);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(peticiones.some((p) => p.startsWith('/api/v1/informes/vinculos/excel?'))).toBe(true));
    const excel = peticiones.find((p) => p.startsWith('/api/v1/informes/vinculos/excel?')) ?? '';
    expect(excel).toContain('estado=Invitado');
    expect(excel).not.toContain('limite');

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(peticiones.filter((p) => p.startsWith('/api/v1/informes/vinculos?')).some((p) => !p.includes('estado='))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('sin vínculos lo dice y no deja descargar un Excel vacío', async () => {
    permisos.scopes = new Set([SCOPES.vinculosLeer]);
    montar('/e/emp/informes/vinculos', {
      resumen: { total: 0, porEstado: [], conCertificadoVigente: 0, conDocumentosPorVencer: 0, conDocumentosVencidos: 0, conSeccionesPendientes: 0 },
      datos: [],
      siguienteCursor: null,
    });
    expect(await screen.findByText('No hay vínculos con estos filtros.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });
});
