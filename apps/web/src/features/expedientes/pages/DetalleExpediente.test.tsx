import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type ExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { area, expediente, veredicto } from '../datosPrueba';
import { DetalleExpediente } from './DetalleExpediente';

/**
 * El detalle del expediente según cómo terminó o en qué va (decisiones y ciclo del vínculo en la conversión de las e2e, PC-1): lo que dice
 * el aviso de arriba, el enlace al vínculo y las acciones de administración sobre el expediente.
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const REVISOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
const ADMINISTRADOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar, SCOPES.vinculosLeer]);

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const VINCULO = {
  id: 'vin',
  empresaId: 'emp',
  terceroId: 't',
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'EnValidacion',
  atributos: {},
  correoTercero: 'contacto@aceros.co',
  referencias: [],
  origen: 'Invitacion',
  creadoEn: '2026-11-01T15:00:00Z',
  actualizadoEn: '2026-11-08T15:00:00Z',
  version: 1,
};

const TERCERO = { id: 't', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, tipoPersona: 'Juridica', nombre: 'Aceros del Norte S.A.S.', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T00:00:00Z' };

function montar(datos: ExpedienteDto, scopes: ReadonlySet<string> = REVISOR) {
  permisos.scopes = new Set(scopes);
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const ruta = url.split('?')[0] ?? url;
      if (ruta === '/api/v1/expedientes/e1') return Promise.resolve(json(datos));
      if (ruta === '/api/v1/vinculos/vin') return Promise.resolve(json(VINCULO));
      if (ruta === '/api/v1/terceros/t') return Promise.resolve(json(TERCERO));
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

// La ficha del vínculo mide el encabezado fijo con un ResizeObserver, que jsdom no trae.
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  reiniciarCliente();
  permisos.scopes = new Set();
});

const COMPRAS = { areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras' };
const CUMPLIMIENTO = { areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO', nombre: 'Cumplimiento', puedeRechazarExpediente: true };

describe('Detalle del expediente: cómo terminó', () => {
  it('aprobado: dice que todas las áreas aprobaron y que el vínculo quedó activo', async () => {
    const aprobada = { estado: 'Aprobada' as const, aprobaciones: 1, aprobacionesFaltantes: 0, miembrosPendientes: [], veredictos: [veredicto()] };
    montar({
      ...expediente('Aprobado', [area({ ...COMPRAS, ...aprobada }), area({ ...CUMPLIMIENTO, ...aprobada })]),
      cerradoEn: '2026-11-12T15:00:00Z',
    });

    expect(await screen.findByText('Expediente aprobado')).toBeInTheDocument();
    expect(screen.getByText(/Todas las áreas aprobaron el .* y el vínculo quedó activo\./)).toBeInTheDocument();
  });

  it('rechazado por un área: dice cuál lo rechazó, que el vínculo volvió a Invitado y la justificación interna', async () => {
    montar({
      ...expediente('Rechazado', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO, estado: 'Observada' })]),
      cerradoEn: '2026-11-12T15:00:00Z',
      rechazo: {
        areaId: 'a-cumplimiento',
        usuario: 'u-1',
        motivos: ['no-corresponde-al-tercero'],
        justificacion: 'La Cámara es de otra sociedad con el mismo nombre.',
        fecha: '2026-11-12T15:00:00Z',
      },
    });

    expect(await screen.findByText('Expediente rechazado')).toBeInTheDocument();
    expect(screen.getByText(/Cumplimiento lo rechazó el .*\. El vínculo volvió a Invitado\./)).toBeInTheDocument();
    expect(screen.getByText(/La Cámara es de otra sociedad con el mismo nombre\./)).toBeInTheDocument();
  });

  it('anulado: dice que se anuló con su motivo y que se puede abrir otro expediente', async () => {
    montar({ ...expediente('Anulado', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO })]), cerradoEn: '2026-11-12T15:00:00Z', motivoAnulacion: 'Se abrió con el tipo de vínculo equivocado.' });

    expect(await screen.findByText('Expediente anulado')).toBeInTheDocument();
    expect(screen.getByText(/Se anuló el .*\. El vínculo volvió a Invitado y se puede abrir otro expediente\./)).toBeInTheDocument();
    expect(screen.getByText(/Se abrió con el tipo de vínculo equivocado\./)).toBeInTheDocument();
  });
});

describe('Detalle del expediente: devuelto al tercero y administración', () => {
  const observada = area({ ...CUMPLIMIENTO, estado: 'Observada', veredictos: [veredicto({ veredicto: 'Observado', motivos: ['incompleto'] })] });

  it('devuelto: el aviso dice que nadie decide hasta que el tercero responda', async () => {
    montar(expediente('Observado', [area({ ...COMPRAS }), observada]));

    expect(await screen.findByText('Devuelto al tercero')).toBeInTheDocument();
    expect(screen.getByText(/Una observación lo devolvió al tercero\. Nadie emite veredictos hasta que responda/)).toBeInTheDocument();
  });

  it('muestra la respuesta del tercero a la observación', async () => {
    montar({ ...expediente('EnRevision', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO })]), reenvios: 1, ultimaRespuesta: 'La Cámara se expide con firma digital; está en la última página.' });

    expect(await screen.findByText('La Cámara se expide con firma digital; está en la última página.')).toBeInTheDocument();
  });

  it('en revisión, con la devolución levantada, no hay aviso de devuelto', async () => {
    montar(expediente('EnRevision', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO })]));

    expect(await screen.findByText('Etapas y áreas')).toBeInTheDocument();
    expect(screen.queryByText('Devuelto al tercero')).not.toBeInTheDocument();
  });

  it('el expediente se abre en la ficha del vínculo y quien administra puede anularlo desde «Más acciones»', async () => {
    const usuario = userEvent.setup();
    montar(expediente('EnRevision', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO })]), ADMINISTRADOR);

    expect(await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ })).toBeInTheDocument();
    expect(await screen.findByText('Etapas y áreas')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(await screen.findByRole('menuitem', { name: 'Anular expediente' })).toBeInTheDocument();
  });

  it('quien solo revisa no tiene «Más acciones»', async () => {
    montar(expediente('EnRevision', [area({ ...COMPRAS }), area({ ...CUMPLIMIENTO })]), REVISOR);

    expect(await screen.findByText('Etapas y áreas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument();
  });
});
