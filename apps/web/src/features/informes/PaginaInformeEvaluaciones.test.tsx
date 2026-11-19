import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type InformeEvaluacionesDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaInformeEvaluaciones } from './PaginaInformeEvaluaciones';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const INFORME: InformeEvaluacionesDto = {
  resumen: { total: 20, pendientes: 4, aprobadas: 9, reprobadas: 3, vencidas: 2, anuladas: 2, puntajePromedio: 78.5 },
  filas: [
    {
      id: 'e1',
      vinculoId: 'v1',
      expedienteId: null,
      folio: 'NORTE-E-2026-000007',
      tercero: { id: 't1', nombre: 'Aceros del Norte', identificacion: 'CO|NIT|900123456' },
      cuestionario: 'Evaluación de proveedores',
      versionCuestionario: 2,
      estado: 'Calificada',
      responde: 'Tercero',
      efecto: 'Observar',
      motivo: 'Expediente',
      puntaje: 82,
      aprobada: true,
      motivos: [],
      eliminatorias: [],
      respondidaPor: null,
      asignadaEn: '2026-10-01T00:00:00Z',
      respondidaEn: '2026-10-12T00:00:00Z',
      vigenteHasta: null,
      recalificaciones: 0,
    },
  ],
  siguienteCursor: null,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function montar(ruta = '/e/emp/informes/evaluaciones', informe: InformeEvaluacionesDto = INFORME) {
  const peticiones: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      peticiones.push(url);
      if (url.startsWith('/api/v1/informes/evaluaciones/excel')) {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Disposition': 'attachment; filename=evaluaciones.xlsx' } }));
      }
      if (url.startsWith('/api/v1/informes/evaluaciones')) return Promise.resolve(json(informe));
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/e/:empresaId/informes/evaluaciones" element={<PaginaInformeEvaluaciones />} />
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

describe('Informe de evaluaciones', () => {
  it('sin evaluaciones:leer no muestra el informe ni consulta', () => {
    const peticiones = montar();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(peticiones).toHaveLength(0);
  });

  it('muestra el resumen en tarjetas (las reprobadas en alerta) y cada evaluación con su puntaje', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    montar();
    expect(await screen.findByRole('tab', { name: 'Evaluaciones', selected: true })).toHaveAttribute('href', '/e/emp/informes/evaluaciones');
    expect(screen.getByRole('status', { name: 'Resumen del informe de evaluaciones' })).toHaveAttribute('aria-busy', 'true');

    const fila = await screen.findByRole('row', { name: /Abrir la evaluación|Aceros del Norte/ });
    expect(fila).toHaveTextContent('82');
    expect(fila).toHaveTextContent('NORTE-E-2026-000007');

    const resumen = screen.getByRole('region', { name: 'Resumen del informe de evaluaciones' });
    const tarjeta = (nombre: string) => within(resumen).getByRole('group', { name: nombre });
    expect(tarjeta('Evaluaciones')).toHaveTextContent('20');
    expect(tarjeta('Pendientes')).toHaveTextContent('4');
    expect(tarjeta('Aprobadas')).toHaveTextContent('9');
    expect(tarjeta('Aprobadas')).toHaveTextContent('de 12 calificadas');
    expect(within(tarjeta('Aprobadas')).getByRole('img', { name: '9 de 12 evaluaciones calificadas aprobadas' })).toBeInTheDocument();
    expect(tarjeta('Reprobadas')).toHaveTextContent('3');
    expect(tarjeta('Puntaje promedio')).toHaveTextContent('78,5');
  });

  it('los filtros de la URL van a la consulta y a la descarga de Excel, sin la paginación; «Limpiar filtros» los quita', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    const peticiones = montar('/e/emp/informes/evaluaciones?estado=Calificada');
    await screen.findByRole('row', { name: /Aceros del Norte/ });
    expect(peticiones.find((p) => p.startsWith('/api/v1/informes/evaluaciones?'))).toMatch(/estado=Calificada.*limite=50/);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(peticiones.some((p) => p.startsWith('/api/v1/informes/evaluaciones/excel?'))).toBe(true));
    const excel = peticiones.find((p) => p.startsWith('/api/v1/informes/evaluaciones/excel?')) ?? '';
    expect(excel).toContain('estado=Calificada');
    expect(excel).not.toContain('limite');

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(peticiones.filter((p) => p.startsWith('/api/v1/informes/evaluaciones?')).some((p) => !p.includes('estado='))).toBe(true));
  });

  it('sin evaluaciones lo dice y no deja descargar un Excel vacío', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    montar('/e/emp/informes/evaluaciones', {
      resumen: { total: 0, pendientes: 0, aprobadas: 0, reprobadas: 0, vencidas: 0, anuladas: 0, puntajePromedio: null },
      filas: [],
      siguienteCursor: null,
    });
    expect(await screen.findByText('No hay evaluaciones con estos filtros')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled();
    const resumen = screen.getByRole('region', { name: 'Resumen del informe de evaluaciones' });
    expect(within(resumen).getByRole('group', { name: 'Puntaje promedio' })).toHaveTextContent('—');
  });
});
