import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type RevalidacionDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../../shared/useAvisos';
import { PaginaRevalidaciones } from './PaginaRevalidaciones';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

function revalidacion(parcial: Partial<RevalidacionDto>): RevalidacionDto {
  return {
    expedienteId: 'e1',
    folio: 'NOR-2026-00001',
    vinculoId: 'v1',
    requisitoId: 'r1',
    tercero: { id: 't1', nombre: 'Aceros del Norte', identificacion: 'NIT 800555111' },
    tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
    tipoDocumentoCodigo: 'RUT',
    tipoDocumento: 'RUT',
    versionAceptada: { numero: 1, fecha: '2026-11-01T00:00:00Z' },
    versionActual: { numero: 2, fecha: '2026-11-08T00:00:00Z' },
    comparacion: 'Distinta',
    aprobableEnLote: false,
    estadoRequisito: 'EnRevision',
    areas: [],
    desde: '2026-11-08T00:00:00Z',
    plazoHasta: '2026-11-23T00:00:00Z',
    diasRestantes: 15,
    bloqueante: false,
    ...parcial,
  };
}

const FILAS: RevalidacionDto[] = [
  revalidacion({ expedienteId: 'e1', requisitoId: 'r1', tipoDocumento: 'RUT', estadoRequisito: 'Observado' }),
  revalidacion({ expedienteId: 'e2', requisitoId: 'r2', tipoDocumento: 'Póliza', tercero: { id: 't2', nombre: 'Ferretería El Tornillo', identificacion: 'NIT 900' }, estadoRequisito: 'EnRevision' }),
  revalidacion({ expedienteId: 'e3', requisitoId: 'r3', tipoDocumento: 'Cámara de comercio', tercero: { id: 't3', nombre: 'Cementos Andes', identificacion: 'NIT 901' }, comparacion: 'SinCambios', aprobableEnLote: true }),
];

function montar(filas: readonly RevalidacionDto[] = FILAS) {
  const peticiones: { url: string; metodo: string; cuerpo: unknown }[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const metodo = init?.method ?? 'GET';
      peticiones.push({ url, metodo, cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
      if (metodo === 'POST') {
        return Promise.resolve(json({ enviados: 1, omitidos: 0, detalle: [{ expedienteId: 'e1', folio: 'NOR-2026-00001', resultado: 'Enviado' }] }));
      }
      return Promise.resolve(json({ datos: filas, siguienteCursor: null }));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/emp/revalidaciones']}>
          <Routes>
            <Route path="/e/:empresaId/revalidaciones" element={<PaginaRevalidaciones />} />
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
  vi.restoreAllMocks();
});

describe('Revalidaciones: recordar al tercero lo devuelto', () => {
  it('solo deja marcar lo devuelto o aprobable; confirma antes y recuerda a los expedientes devueltos', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.vinculosEscribir]);
    const usuario = userEvent.setup();
    const peticiones = montar();

    // La devuelta al tercero y la aprobable se pueden marcar; la que sigue en revisión y cambió, no.
    const devuelta = await screen.findByRole('checkbox', { name: 'Seleccionar RUT de Aceros del Norte' });
    expect(devuelta).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Cámara de comercio de Cementos Andes' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar Póliza de Ferretería El Tornillo' })).toBeDisabled();
    expect(screen.getByText('Devuelta al tercero')).toBeInTheDocument();

    // Sin marcar nada solo está «Recordar a los observados»; al marcar la devuelta aparece «Recordar (1)».
    expect(screen.queryByRole('button', { name: 'Recordar (1)' })).not.toBeInTheDocument();
    await usuario.click(devuelta);
    await usuario.click(screen.getByRole('button', { name: 'Recordar (1)' }));

    // Nada se envía hasta confirmar.
    const dialogo = await screen.findByRole('dialog', { name: '¿Recordar las observaciones de 1 expediente?' });
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false);
    expect(within(dialogo).getByText(/A quien ya se le recordó hoy no se le vuelve a enviar/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar recordatorios' }));

    await waitFor(() => expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({ expedientes: ['e1'] }));
    expect(peticiones.find((p) => p.metodo === 'POST')?.url).toBe('/api/v1/expedientes/recordar-observaciones');
    await waitFor(() => expect(useAvisos.getState().actual).toMatchObject({ mensaje: 'Recordamos a 1 tercero.', severidad: 'success' }));
    // Terminado el envío, la selección se limpia.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recordar (1)' })).not.toBeInTheDocument());
  });

  it('marcar una aprobable no ofrece recordar: cada botón cuenta solo lo suyo', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.vinculosEscribir]);
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('checkbox', { name: 'Seleccionar Cámara de comercio de Cementos Andes' }));
    expect(screen.getByRole('button', { name: 'Aprobar 1 sin cambios' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Recordar (1)' })).not.toBeInTheDocument();
  });

  it('sin vinculos:escribir no se ofrece recordar, y la devuelta no se puede marcar', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    montar();

    expect(await screen.findByRole('checkbox', { name: 'Seleccionar RUT de Aceros del Norte' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Recordar a los observados' })).not.toBeInTheDocument();
  });
});

describe('Revalidaciones: lo que ve la empresa de un documento que el tercero actualizó', () => {
  it('lo lista con la versión aceptada, la nueva, que cambió y el plazo, y dice que ninguna se aprueba en lote', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    montar([revalidacion({ estadoRequisito: 'EnRevision', diasRestantes: 15 })]);

    const fila = (await screen.findByText('Aceros del Norte')).closest('tr');
    if (!fila) throw new Error('sin fila de la revalidación');
    expect(within(fila).getByText('RUT')).toBeInTheDocument();
    expect(within(fila).getByText('v1 → v2')).toBeInTheDocument();
    expect(within(fila).getByText('Distinta')).toBeInTheDocument();
    expect(within(fila).getByText('Quedan 15 días')).toBeInTheDocument();
    expect(screen.getByText(/Ninguna se puede aprobar en lote/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aprobar .* sin cambios/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cuando alguna no cambió sí se aprueba en lote y no aparece el aviso de que ninguna se puede', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    montar([revalidacion({ comparacion: 'SinCambios', aprobableEnLote: true, diasRestantes: 1 })]);

    expect(await screen.findByText('Queda 1 día')).toBeInTheDocument();
    expect(screen.queryByText(/Ninguna se puede aprobar en lote/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleccionar RUT de Aceros del Norte' })).toBeEnabled();
  });
});

/**
 * La bandeja con lo que el tercero actualizó: cada revalidación con su comparación y sus versiones, la aprobación en lote de las que no
 * cambiaron (A-18) y lo que vuelve porque el tercero retiró una versión (RT-3), que se revisa a mano.
 */
describe('Revalidaciones: aprobar en lote lo que no cambió (A-18)', () => {
  const SIN_CAMBIOS = { nombre: 'Aceros Sin Cambios S.A.S.', id: 't-a' };
  const CON_CAMBIOS = { nombre: 'Aceros Con Cambios S.A.S.', id: 't-b' };
  const delTercero = (t: { nombre: string; id: string }) => ({ id: t.id, nombre: t.nombre, identificacion: 'NIT 900' });

  const rutA = revalidacion({
    expedienteId: 'eA',
    requisitoId: 'r-rut',
    folio: 'SUR-E-2026-000011',
    tercero: delTercero(SIN_CAMBIOS),
    tipoDocumento: 'Registro Único Tributario',
    comparacion: 'SinCambios',
    aprobableEnLote: true,
  });
  const bancariaA = revalidacion({ ...rutA, requisitoId: 'r-banco', tipoDocumento: 'Certificación bancaria' });
  const rutB = revalidacion({
    expedienteId: 'eB',
    requisitoId: 'r-rut-b',
    folio: 'SUR-E-2026-000012',
    tercero: delTercero(CON_CAMBIOS),
    tipoDocumento: 'Registro Único Tributario',
    comparacion: 'CambiosDetectados',
    aprobableEnLote: false,
  });

  /** La lista de la API sigue la variable `actual`: al aprobar, `alAprobar` la cambia y la recarga trae lo que queda. */
  function montarLote(inicial: RevalidacionDto[], alAprobar: () => RevalidacionDto[] = () => inicial) {
    let actual = inicial;
    const peticiones: { url: string; metodo: string; cuerpo: unknown }[] = [];
    configurarCliente({
      fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
        const metodo = init?.method ?? 'GET';
        peticiones.push({ url, metodo, cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
        if (metodo === 'POST') {
          const enviadas = (peticiones.at(-1)?.cuerpo as { revalidaciones: unknown[] }).revalidaciones.length;
          actual = alAprobar();
          return Promise.resolve(json({ aprobadas: enviadas, fallidas: [] }));
        }
        return Promise.resolve(json({ datos: actual, siguienteCursor: null }));
      }),
    });
    render(
      <ThemeProvider theme={createValidaloTheme('light')}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
          <MemoryRouter initialEntries={['/e/emp/revalidaciones']}>
            <Routes>
              <Route path="/e/:empresaId/revalidaciones" element={<PaginaRevalidaciones />} />
              <Route path="/e/:empresaId/expedientes/:expedienteId" element={<h1>Detalle del expediente</h1>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    return peticiones;
  }

  const fila = (folio: string, documento: string, tercero: string) => screen.getByRole('row', { name: `Abrir ${folio}: ${documento} de ${tercero}` });

  it('rotula cada revalidación, marca solo las sin cambios, pide confirmar y aprueba las dos de un mismo tercero dejando la que cambió', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    const usuario = userEvent.setup();
    const peticiones = montarLote([rutA, bancariaA, rutB], () => [rutB]);

    await screen.findByRole('row', { name: /Abrir SUR-E-2026-000011: Registro Único Tributario/ });
    expect(within(fila('SUR-E-2026-000011', 'Registro Único Tributario', SIN_CAMBIOS.nombre)).getByText('Sin cambios')).toBeInTheDocument();
    expect(within(fila('SUR-E-2026-000011', 'Registro Único Tributario', SIN_CAMBIOS.nombre)).getByText('v1 → v2')).toBeInTheDocument();
    expect(within(fila('SUR-E-2026-000011', 'Certificación bancaria', SIN_CAMBIOS.nombre)).getByText('Sin cambios')).toBeInTheDocument();
    expect(within(fila('SUR-E-2026-000012', 'Registro Único Tributario', CON_CAMBIOS.nombre)).getByText('Con cambios')).toBeInTheDocument();
    expect(within(fila('SUR-E-2026-000012', 'Registro Único Tributario', CON_CAMBIOS.nombre)).getByText('v1 → v2')).toBeInTheDocument();

    // «Seleccionar las sin cambios» toma las dos del tercero A y deja la que cambió: lo que cambió no se aprueba en lote.
    await usuario.click(screen.getByRole('button', { name: 'Seleccionar las sin cambios' }));
    expect(screen.getByRole('checkbox', { name: `Seleccionar Registro Único Tributario de ${SIN_CAMBIOS.nombre}` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `Seleccionar Certificación bancaria de ${SIN_CAMBIOS.nombre}` })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: `Seleccionar Registro Único Tributario de ${CON_CAMBIOS.nombre}` })).toBeDisabled();

    // Nada se aprueba hasta confirmar, y el diálogo dice que cada una queda con su propio registro.
    await usuario.click(screen.getByRole('button', { name: 'Aprobar 2 sin cambios' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Aprobar 2 revalidaciones?' });
    expect(dialogo).toHaveTextContent('cada una con su propio registro en el historial del expediente');
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aprobar 2 sin cambios' }));

    await waitFor(() =>
      expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({
        revalidaciones: [
          { expedienteId: 'eA', requisitoId: 'r-rut', sobreVersion: 2 },
          { expedienteId: 'eA', requisitoId: 'r-banco', sobreVersion: 2 },
        ],
      }),
    );
    expect(peticiones.find((p) => p.metodo === 'POST')?.url).toBe('/api/v1/revalidaciones/aprobar');
    await waitFor(() => expect(useAvisos.getState().actual).toMatchObject({ mensaje: 'Aprobaste 2 revalidaciones.', severidad: 'success' }));
    // Las aprobadas salen de la bandeja; la que cambió se queda.
    await waitFor(() => expect(screen.queryByRole('row', { name: /Aceros Sin Cambios/ })).not.toBeInTheDocument());
    expect(within(fila('SUR-E-2026-000012', 'Registro Único Tributario', CON_CAMBIOS.nombre)).getByText('Con cambios')).toBeInTheDocument();
  });

  it('sin revalidaciones pendientes lo dice', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    montarLote([]);

    expect(await screen.findByText('No tienes revalidaciones pendientes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sin cambios/ })).not.toBeInTheDocument();
  });

  it('lo que vuelve porque el tercero retiró una versión dice el motivo y va de la v2 a la v1, no se aprueba en lote y abre su expediente', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
    const usuario = userEvent.setup();
    const retiro = revalidacion({
      expedienteId: 'eR',
      folio: 'NOR-E-2026-000021',
      tercero: delTercero({ nombre: 'Aceros del Retiro S.A.S.', id: 't-r' }),
      tipoDocumento: 'Registro Único Tributario',
      versionAceptada: { numero: 2, fecha: '2026-11-08T00:00:00Z' },
      versionActual: { numero: 1, fecha: '2026-11-01T00:00:00Z' },
      comparacion: 'Distinta',
      aprobableEnLote: false,
      retiro: { numero: 2, motivo: 'Subí el RUT de otra empresa', fecha: '2026-11-11T11:59:00Z' },
    });
    montarLote([retiro]);

    const filaRetiro = await screen.findByRole('row', { name: 'Abrir NOR-E-2026-000021: Registro Único Tributario de Aceros del Retiro S.A.S.' });
    expect(within(filaRetiro).getByText('El tercero retiró la v2: «Subí el RUT de otra empresa»')).toBeInTheDocument();
    expect(within(filaRetiro).getByText('v2 → v1')).toBeInTheDocument();
    // Una revalidación que va hacia atrás no se aprueba en lote: sin casillas ni botón, y la bandeja lo explica.
    expect(screen.queryByRole('button', { name: /Aprobar .* sin cambios/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Ninguna se puede aprobar en lote/)).toBeInTheDocument();

    await usuario.click(filaRetiro);
    expect(await screen.findByRole('heading', { name: 'Detalle del expediente' })).toBeInTheDocument();
  });
});
