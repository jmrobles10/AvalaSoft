import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type EtapaExpedienteDto, type ExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { area, expediente, veredicto } from '../datosPrueba';
import { DetalleExpediente } from './DetalleExpediente';

/**
 * Lo que el administrador y el revisor ven en el detalle de un expediente que se devolvió a revisión (DS-1, DS-2): el estado de
 * cada etapa, el aviso de quién y por qué lo devolvió, el veredicto revertido y las acciones que se ofrecen según el permiso.
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const ADMIN = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar]);
const REVISOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);

/** Quien devuelve el expediente: un GUID, que es lo que la web resume a un nombre. */
const ANA = '0f8c8b6a-5f2a-4c3a-9d6e-1a2b3c4d5e6f';

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const etapa = (orden: number, estado: EtapaExpedienteDto['estado'], areas: EtapaExpedienteDto['areas']): EtapaExpedienteDto => ({ orden, estado, activadaEn: null, aprobadaEn: null, areas });

const compras = (cambios: Parameters<typeof area>[0] = {}) => area({ areaId: 'a-compras', nombre: 'Compras', estado: 'Aprobada', veredictos: [veredicto()], ...cambios });
const cumplimiento = (cambios: Parameters<typeof area>[0] = {}) => area({ areaId: 'a-cumplimiento', nombre: 'Cumplimiento', miembrosPendientes: [], ...cambios });

/** Flujo en dos etapas de Norte: Compras (etapa 1) y Cumplimiento (etapa 2). */
function dosEtapas(estado: ExpedienteDto['estado'], etapas: EtapaExpedienteDto[], cambios: Partial<ExpedienteDto> = {}): ExpedienteDto {
  return { ...expediente(estado), etapaActual: etapas.findIndex((e) => e.estado === 'Activa') + 1 || 2, etapas, ...cambios };
}

const VINCULO = {
  id: 'vin',
  empresaId: 'emp',
  terceroId: 't',
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'Activo',
  atributos: {},
  correoTercero: 'contacto@aceros.co',
  referencias: [],
  origen: 'Invitacion',
  creadoEn: '2026-11-01T15:00:00Z',
  actualizadoEn: '2026-11-08T15:00:00Z',
  version: 1,
};
const TERCERO = { id: 't', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, tipoPersona: 'Juridica', nombre: 'Aceros del Norte S.A.S.', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T15:00:00Z' };

function montar(cuerpo: ExpedienteDto, scopes: ReadonlySet<string>) {
  permisos.scopes = new Set(scopes);
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.startsWith('/api/v1/expedientes/e1/historial')) return Promise.resolve(json([]));
      if (url.startsWith('/api/v1/expedientes/e1')) return Promise.resolve(json(cuerpo));
      if (url.startsWith('/api/v1/vinculos/vin')) return Promise.resolve(json(VINCULO));
      if (url.startsWith('/api/v1/terceros/')) return Promise.resolve(json(TERCERO));
      if (url.startsWith('/api/v1/usuarios')) return Promise.resolve(json([{ id: ANA, nombre: 'Ana Administradora' }]));
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/emp/expedientes/e1']}>
          <Routes>
            <Route path="/e/:empresaId/expedientes/:expedienteId" element={<DetalleExpediente />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const seccionDeEtapa = (orden: number) => screen.getByRole('region', { name: `Etapa ${String(orden)}` });

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('Detalle del expediente: devuelto a revisión por un administrador (DS-1, DS-2)', () => {
  it('con la etapa 1 aprobada el administrador puede reabrirla; el revisor solo ve el estado de las etapas, sin acciones de desaprobar', async () => {
    const cuerpo = dosEtapas('EnRevision', [etapa(1, 'Aprobada', [compras()]), etapa(2, 'Activa', [cumplimiento()])]);

    montar(cuerpo, ADMIN);
    await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ });
    expect(seccionDeEtapa(1)).toHaveTextContent('Aprobada');
    expect(seccionDeEtapa(2)).toHaveTextContent('En curso');
    expect(screen.getByRole('button', { name: 'Reabrir la etapa 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir la etapa 2' })).not.toBeInTheDocument();
  });

  it('el revisor no ve «Reabrir la etapa» ni «Más acciones» aunque la etapa esté aprobada', async () => {
    const cuerpo = dosEtapas('EnRevision', [etapa(1, 'Aprobada', [compras()]), etapa(2, 'Activa', [cumplimiento()])]);

    montar(cuerpo, REVISOR);
    await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ });
    expect(seccionDeEtapa(1)).toHaveTextContent('Aprobada');
    expect(screen.queryByRole('button', { name: 'Reabrir la etapa 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument();
  });

  it('reabierta la etapa 1: la 1 vuelve a «En curso», la 2 «En espera», el veredicto anterior se ve «Revertido por un administrador» y el aviso dice quién la reabrió', async () => {
    const cuerpo = dosEtapas(
      'EnRevision',
      [
        etapa(1, 'Activa', [compras({ estado: 'Pendiente', veredictos: [veredicto({ vigente: false, revertido: true })] })]),
        etapa(2, 'Esperando', [cumplimiento({ estado: 'Esperando' })]),
      ],
      { etapaActual: 1, desaprobaciones: 1, ultimaDesaprobacion: { etapa: 1, alcance: 'Etapa', usuario: ANA, justificacion: 'Compras aprobó sin ver el certificado.', fecha: '2026-11-10T15:00:00Z' } },
    );

    montar(cuerpo, ADMIN);
    expect(await screen.findByText('Devuelto a revisión por un administrador')).toBeInTheDocument();
    expect(await screen.findByText(/Ana Administradora reabrió la etapa 1 el .*: esa etapa y las siguientes vuelven a revisarse\./)).toBeInTheDocument();
    expect(screen.getByText(/Compras aprobó sin ver el certificado\./)).toBeInTheDocument();
    expect(seccionDeEtapa(1)).toHaveTextContent('En curso');
    expect(seccionDeEtapa(2)).toHaveTextContent('En espera');
    const tarjetaCompras = within(screen.getByRole('heading', { level: 4, name: 'Compras' }).parentElement!.parentElement!.parentElement!);
    expect(tarjetaCompras.getByText(/Revertido por un administrador/)).toBeInTheDocument();
  });

  it('aprobado: el aviso «Expediente aprobado» dice que el vínculo quedó activo y el administrador ve «Volver a la fase inicial» y «Desaprobar expediente»; el revisor, ninguna', async () => {
    const aprobado = dosEtapas('Aprobado', [etapa(1, 'Aprobada', [compras()]), etapa(2, 'Aprobada', [cumplimiento({ estado: 'Aprobada', veredictos: [veredicto({ id: 'v2' })] })])], {
      cerradoEn: '2026-11-10T15:00:00Z',
    });
    const usuario = userEvent.setup();

    montar(aprobado, ADMIN);
    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Expediente aprobado')).toBeInTheDocument();
    expect(within(alerta).getByText(/Todas las áreas aprobaron el .* y el vínculo quedó activo\./)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(await screen.findByRole('menuitem', { name: 'Volver a la fase inicial' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Desaprobar expediente' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Anular expediente' })).not.toBeInTheDocument();
  });

  it('el revisor ve el expediente aprobado sin «Más acciones»', async () => {
    const aprobado = dosEtapas('Aprobado', [etapa(1, 'Aprobada', [compras()]), etapa(2, 'Aprobada', [cumplimiento({ estado: 'Aprobada', veredictos: [veredicto({ id: 'v2' })] })])], {
      cerradoEn: '2026-11-10T15:00:00Z',
    });

    montar(aprobado, REVISOR);
    expect(await screen.findByText('Expediente aprobado')).toBeInTheDocument();
    expect(seccionDeEtapa(1)).toHaveTextContent('Aprobada');
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir la etapa 1' })).not.toBeInTheDocument();
  });

  it('desaprobado desde la etapa 2: sale el aviso de la devolución, la etapa 1 conserva su aprobación, la 2 vuelve a «En curso» y ya no dice «Expediente aprobado»', async () => {
    const cuerpo = dosEtapas(
      'EnRevision',
      [etapa(1, 'Aprobada', [compras()]), etapa(2, 'Activa', [cumplimiento({ estado: 'Pendiente', veredictos: [veredicto({ id: 'v2', vigente: false, revertido: true })] })])],
      { desaprobaciones: 1, ultimaDesaprobacion: { etapa: 2, alcance: 'ExpedienteAprobado', usuario: ANA, justificacion: 'Apareció una inhabilidad.', fecha: '2026-11-10T15:00:00Z' } },
    );

    montar(cuerpo, ADMIN);
    expect(await screen.findByText('Devuelto a revisión por un administrador')).toBeInTheDocument();
    expect(await screen.findByText(/Ana Administradora desaprobó el expediente el .* y se revisa de nuevo desde la etapa 2\./)).toBeInTheDocument();
    expect(seccionDeEtapa(1)).toHaveTextContent('Aprobada');
    expect(seccionDeEtapa(2)).toHaveTextContent('En curso');
    expect(screen.queryByText('Expediente aprobado')).not.toBeInTheDocument();
  });

  it('desaprobado desde la primera etapa: el aviso dice que se revisa de nuevo desde la etapa 1, la 1 vuelve a «En curso» y la 2 queda «En espera»', async () => {
    const cuerpo = dosEtapas(
      'EnRevision',
      [
        etapa(1, 'Activa', [compras({ estado: 'Pendiente', veredictos: [veredicto({ vigente: false, revertido: true })] })]),
        etapa(2, 'Esperando', [cumplimiento({ estado: 'Esperando', veredictos: [veredicto({ id: 'v2', vigente: false, revertido: true })] })]),
      ],
      { etapaActual: 1, desaprobaciones: 1, ultimaDesaprobacion: { etapa: 1, alcance: 'ExpedienteAprobado', usuario: ANA, justificacion: 'Cambió la política.', fecha: '2026-11-10T15:00:00Z' } },
    );

    montar(cuerpo, ADMIN);
    expect(await screen.findByText(/Ana Administradora desaprobó el expediente el .* y se revisa de nuevo desde la etapa 1\./)).toBeInTheDocument();
    expect(seccionDeEtapa(1)).toHaveTextContent('En curso');
    expect(seccionDeEtapa(2)).toHaveTextContent('En espera');
  });

  it('devuelto a la fase inicial: el aviso dice que el flujo se repite desde la primera etapa y «Más acciones» ya no ofrece volver a la fase inicial, solo anular', async () => {
    const cuerpo = dosEtapas(
      'EnRevision',
      [
        etapa(1, 'Activa', [compras({ estado: 'Pendiente', veredictos: [veredicto({ vigente: false, revertido: true })] })]),
        etapa(2, 'Esperando', [cumplimiento({ estado: 'Esperando' })]),
      ],
      { etapaActual: 1, desaprobaciones: 1, ultimaDesaprobacion: { etapa: 1, alcance: 'FaseInicial', usuario: ANA, justificacion: 'Cambió la política de contratación.', fecha: '2026-11-10T15:00:00Z' } },
    );
    const usuario = userEvent.setup();

    montar(cuerpo, ADMIN);
    expect(await screen.findByText(/Ana Administradora lo devolvió a su fase inicial el .*: el flujo se repite desde la primera etapa\./)).toBeInTheDocument();
    expect(seccionDeEtapa(1)).toHaveTextContent('En curso');
    expect(seccionDeEtapa(2)).toHaveTextContent('En espera');
    const tarjetaCompras = within(screen.getByRole('heading', { level: 4, name: 'Compras' }).parentElement!.parentElement!.parentElement!);
    expect(tarjetaCompras.getByText(/Revertido por un administrador/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(await screen.findByRole('menuitem', { name: 'Anular expediente' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Volver a la fase inicial' })).not.toBeInTheDocument();
  });
});
