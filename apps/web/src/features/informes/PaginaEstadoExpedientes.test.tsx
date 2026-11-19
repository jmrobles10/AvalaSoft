import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type FilaEstadoExpedienteDto, type InformeEstadoExpedientesDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaEstadoExpedientes } from './PaginaEstadoExpedientes';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const FILA: FilaEstadoExpedienteDto = {
  id: 'x1',
  folio: 'NORTE-E-2026-000007',
  tipo: 'Inicial',
  estado: 'Aprobado',
  vinculoId: 'v1',
  tercero: { id: 't1', nombre: 'Ferretería El Tornillo', identificacion: 'CO|NIT|900123456' },
  tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  flujo: null,
  abiertoEn: '2026-11-02T13:00:00Z',
  cerradoEn: '2026-11-05T13:00:00Z',
  requisitos: 2,
  requisitosAprobados: 2,
  devoluciones: 1,
  diasTotales: 3,
  diasEnCarga: 0.5,
  diasConTercero: 1,
  diasEnRevision: 1.5,
  diasHastaAprobacion: 3,
  slaIncumplido: true,
  areas: [{ areaId: 'a1', codigo: 'COMPRAS', nombre: 'Compras', etapa: 1, estado: 'Aprobada', dias: 1.5, rondas: 2, slaHoras: 24, slaIncumplido: true }],
};

const INFORME: InformeEstadoExpedientesDto = {
  resumen: {
    total: 1,
    porEstado: [{ clave: 'Aprobado', cantidad: 1 }],
    porTipo: [{ clave: 'Inicial', cantidad: 1 }],
    aprobados: 1,
    tiempoPromedioDias: 3,
    tiempoMedianaDias: 3,
    promedioEnCargaDias: 0.5,
    promedioConTerceroDias: 1,
    promedioEnRevisionDias: 1.5,
    devoluciones: 1,
    conSlaIncumplido: 1,
    porArea: [{ areaId: 'a1', codigo: 'COMPRAS', nombre: 'Compras', expedientes: 1, pendientes: 0, promedioDias: 1.5, medianaDias: 1.5, maximoDias: 1.5, slaIncumplidos: 1 }],
  },
  datos: [FILA],
  siguienteCursor: null,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function UbicacionActual() {
  return <p>{`Ubicación: ${useLocation().pathname}`}</p>;
}

function montar(ruta = '/e/emp/informes/estado-expedientes', informe: InformeEstadoExpedientesDto = INFORME) {
  const peticiones: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      peticiones.push(url);
      if (url.startsWith('/api/v1/informes/estado-expedientes/')) {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Disposition': 'attachment; filename=estado.xlsx' } }));
      }
      if (url.startsWith('/api/v1/informes/estado-expedientes')) return Promise.resolve(json(informe));
      if (url.startsWith('/api/v1/areas')) return Promise.resolve(json([{ id: 'a1', codigo: 'COMPRAS', nombre: 'Compras', activa: true, miembros: [] }]));
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/e/:empresaId/informes/estado-expedientes" element={<PaginaEstadoExpedientes />} />
            <Route path="/e/:empresaId/expedientes/:expedienteId" element={<UbicacionActual />} />
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

describe('PaginaEstadoExpedientes', () => {
  it('sin expedientes:leer no muestra el informe', () => {
    montar();
    expect(screen.queryByRole('heading', { level: 1, name: 'Informes' })).not.toBeInTheDocument();
  });

  it('muestra el resumen en tarjetas, el tiempo por fase, los tiempos por área y cada expediente con su reparto de días; la fila abre el expediente', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.configuracionLeer]);
    montar();
    expect(await screen.findByRole('heading', { level: 1, name: 'Informes' })).toBeInTheDocument();
    // Mientras carga, el resumen son esqueletos con la forma de las tarjetas.
    expect(screen.getByRole('status', { name: 'Resumen del informe de estado' })).toHaveAttribute('aria-busy', 'true');
    const fila = await screen.findByRole('row', { name: /NORTE-E-2026-000007/ });
    expect(fila).toHaveTextContent('Ferretería El Tornillo');
    expect(fila).toHaveTextContent('0,5 · 1,0 · 1,5');
    expect(fila).toHaveTextContent('2 de 2');
    expect(fila).toHaveTextContent('Incumplido');

    // Cada cifra va en su tarjeta, con su rótulo.
    const resumen = screen.getByRole('region', { name: 'Resumen del informe de estado' });
    const tarjeta = (nombre: string) => within(resumen).getByRole('group', { name: nombre });
    expect(tarjeta('Expedientes')).toHaveTextContent('1');
    expect(tarjeta('Aprobados')).toHaveTextContent('de 1 en total');
    expect(within(tarjeta('Aprobados')).getByRole('img', { name: '1 de 1 expedientes aprobados' })).toBeInTheDocument();
    expect(tarjeta('Días hasta aprobar')).toHaveTextContent('3,0');
    expect(tarjeta('Días hasta aprobar')).toHaveTextContent('Promedio · mediana 3,0');
    expect(tarjeta('Devoluciones')).toHaveTextContent('1');
    expect(tarjeta('Plazo incumplido')).toHaveTextContent('1');

    // El tiempo por fase: la barra dice el reparto y la leyenda trae los días y el peso de cada fase.
    const fases = screen.getByRole('region', { name: 'Tiempo por fase' });
    expect(within(fases).getByRole('img', { name: 'Reparto del tiempo hasta aprobar: En carga 0,5 d, Con el tercero 1,0 d, En revisión 1,5 d' })).toBeInTheDocument();
    expect(within(fases).getByText('En carga').closest('dt')?.nextElementSibling).toHaveTextContent('0,5 d17 % del total');
    expect(within(fases).getByText('En revisión').closest('dt')?.nextElementSibling).toHaveTextContent('1,5 d50 % del total');

    // Los tiempos por área: la tabla sigue con todas sus cifras; el promedio lleva barra y el plazo incumplido, aviso.
    const areas = screen.getByRole('table', { name: 'Tiempos por área' });
    const compras = within(areas).getByRole('row', { name: /Compras/ });
    expect(compras).toHaveTextContent('1,5');
    expect(compras).toHaveTextContent('1 incumplido');
    expect(within(compras).getByRole('img', { name: 'Promedio de Compras: 1,5 días; máximo 1,5 días' })).toBeInTheDocument();
    expect(within(areas).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Área', 'Expedientes', 'Pendientes', 'Promedio', 'Mediana', 'Máximo', 'Plazo incumplido']);

    await userEvent.click(fila);
    expect(await screen.findByText('Ubicación: /e/emp/expedientes/x1')).toBeInTheDocument();
  });

  it('«Limpiar filtros» solo aparece con algún filtro y los quita todos de la consulta', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar();
    await screen.findByRole('row', { name: /NORTE-E-2026-000007/ });
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    cleanup();

    const peticiones = montar('/e/emp/informes/estado-expedientes?estado=Aprobado&tipo=Inicial');
    await screen.findByRole('row', { name: /NORTE-E-2026-000007/ });
    expect(peticiones.find((p) => p.startsWith('/api/v1/informes/estado-expedientes?'))).toContain('estado=Aprobado');
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(peticiones.filter((p) => p.startsWith('/api/v1/informes/estado-expedientes?')).some((p) => !p.includes('estado=') && !p.includes('tipo='))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('sin expedientes aprobados el tiempo por fase lo dice y no deja descargar; el plazo incumplido en cero no es una alerta', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar('/e/emp/informes/estado-expedientes', {
      ...INFORME,
      resumen: {
        ...INFORME.resumen,
        total: 0,
        aprobados: 0,
        tiempoPromedioDias: null,
        tiempoMedianaDias: null,
        promedioEnCargaDias: null,
        promedioConTerceroDias: null,
        promedioEnRevisionDias: null,
        conSlaIncumplido: 0,
        porArea: [],
      },
      datos: [],
    });
    expect(await screen.findByText('Aún no hay expedientes aprobados con estos filtros')).toBeInTheDocument();
    expect(screen.getByText('Ningún área ha revisado estos expedientes.')).toBeInTheDocument();
    const resumen = screen.getByRole('region', { name: 'Resumen del informe de estado' });
    expect(within(resumen).getByRole('group', { name: 'Días hasta aprobar' })).toHaveTextContent('Aún no hay aprobados');
    expect(within(resumen).getByRole('group', { name: 'Plazo incumplido' })).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
  });

  it('los filtros de la URL van a la consulta y a las descargas de Excel y PDF, sin la paginación', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    const peticiones = montar('/e/emp/informes/estado-expedientes?estado=Aprobado&fecha=Cierre&desde=2026-11-01');
    await screen.findByRole('row', { name: /NORTE-E-2026-000007/ });
    expect(peticiones.find((p) => p.startsWith('/api/v1/informes/estado-expedientes?'))).toMatch(/estado=Aprobado.*desde=2026-11-01.*fecha=Cierre.*limite=50/);

    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }));
    await waitFor(() => expect(peticiones.some((p) => p.startsWith('/api/v1/informes/estado-expedientes/excel?'))).toBe(true));
    const excel = peticiones.find((p) => p.startsWith('/api/v1/informes/estado-expedientes/excel?')) ?? '';
    expect(excel).toContain('estado=Aprobado');
    expect(excel).toContain('fecha=Cierre');
    expect(excel).not.toContain('limite');

    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(peticiones.some((p) => p.startsWith('/api/v1/informes/estado-expedientes/pdf?estado=Aprobado'))).toBe(true));
  });

  it('un rango al revés no consulta y lo avisa', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    const peticiones = montar('/e/emp/informes/estado-expedientes?desde=2026-11-05&hasta=2026-11-01');
    expect((await screen.findAllByText('La fecha inicial es posterior a la final.')).length).toBeGreaterThan(0);
    expect(peticiones.some((p) => p.startsWith('/api/v1/informes/estado-expedientes'))).toBe(false);
  });
});
