import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type EventoHistorialDto, type VinculoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DetalleVinculo } from './DetalleVinculo';

/**
 * El detalle del vínculo en la web de la empresa: un solo estado a la vista (VR-1), hasta cuándo vale (VV-1), el bloqueo con su fecha y lo que
 * cuenta el historial. Las tarjetas que traen sus propios datos (certificado, documentos, contactos…) se prueban aparte: aquí no pintan nada.
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));
vi.mock('../../certificados/TarjetaCertificado', () => ({ TarjetaCertificado: () => null }));
vi.mock('../../terceros/fichaAceptada/TarjetaFichaAceptadaEnVinculo', () => ({ TarjetaFichaAceptadaEnVinculo: () => null }));
vi.mock('../../documentos/DocumentosVinculo', () => ({ DocumentosVinculo: () => null }));
vi.mock('../../expedientes/components/TarjetaExpedienteVinculo', () => ({ TarjetaExpedienteVinculo: () => null }));
vi.mock('../../cumplimiento/components/TarjetaMonitoreoListas', () => ({ TarjetaMonitoreoListas: () => null }));
vi.mock('../contactos/TarjetaContactos', () => ({ TarjetaContactos: () => null }));
vi.mock('../cuentaDesignada/TarjetaCuentaDesignada', () => ({ TarjetaCuentaDesignada: () => null }));

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function vinculo(cambios: Partial<VinculoDto>): VinculoDto {
  return {
    id: 'v1',
    empresaId: 'emp',
    terceroId: 'ter',
    tipoVinculo: { id: 'tp', codigo: 'CLIENTE', nombre: 'Cliente' },
    flujoId: null,
    estado: 'Activo',
    atributos: {},
    correoTercero: 'contacto@aceros.co',
    invitacion: null,
    invitacionAceptadaEn: '2026-11-01T15:00:00Z',
    requisitosCubribles: null,
    bloqueo: null,
    referencias: [],
    origen: 'Invitacion',
    creadoEn: '2026-11-01T15:00:00Z',
    actualizadoEn: '2026-11-06T15:00:00Z',
    version: 5,
    ...cambios,
  };
}

function evento(version: number, tipo: string, datos: Record<string, unknown>, actorTipo = 'Sistema'): EventoHistorialDto {
  return { version, tipo, fecha: `2026-11-1${String(version)}T15:00:00Z`, actorTipo, actorId: 'vigencia-vinculo', sistema: null, datos };
}

function montar(base: VinculoDto, historial: EventoHistorialDto[] = [], scopes: ReadonlySet<string> = new Set([SCOPES.vinculosLeer])) {
  permisos.scopes = new Set(scopes);
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.startsWith('/api/v1/vinculos/v1/historial')) return Promise.resolve(json(historial));
      if (url.startsWith('/api/v1/vinculos/v1')) return Promise.resolve(json(base));
      if (url.startsWith('/api/v1/terceros/')) {
        return Promise.resolve(json({ id: 'ter', nombre: 'Aceros del Norte S.A.S.', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456', digitoVerificacion: '8' }, tipoPersona: 'Juridica', contactos: [], esExtranjero: false, creadoEn: '2026-11-01T15:00:00Z' }));
      }
      return Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/emp/vinculos/v1']}>
          <Routes>
            <Route path="/e/:empresaId/vinculos/:vinculoId" element={<DetalleVinculo />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('Detalle del vínculo: el estado a la vista', () => {
  it('con una actualización abierta el encabezado dice «En revisión» con su fecha y no «Activo»: una sola verdad', async () => {
    montar(vinculo({ estado: 'Activo', enRevision: true, expedienteAbiertoId: 'exp-act' }));

    await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ });
    expect(screen.getByText('En revisión').closest('[data-estado]')).toHaveTextContent(/^En revisión\. En revisión desde el /);
    expect(screen.queryByText(/Activo desde el/)).not.toBeInTheDocument();
  });

  it('aprobada la actualización el encabezado vuelve a «Activo» con su fecha', async () => {
    montar(vinculo({ estado: 'Activo', enRevision: false }));

    await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ });
    expect(screen.getByText('Activo').closest('[data-estado]')).toHaveTextContent(/^Activo\. Activo desde el /);
    expect(screen.queryByText(/En revisión desde el/)).not.toBeInTheDocument();
  });

  it('un vínculo con vigencia periódica dice «Vigente hasta» con la fecha de calendario', async () => {
    montar(vinculo({ vigenteHasta: '2027-02-10' }));

    const etiqueta = await screen.findByText('Vigente hasta');
    expect(etiqueta.parentElement).toHaveTextContent('10/02/2027');
  });

  it('en pre-vencimiento muestra el aviso con la fecha y «Por vencer» en el encabezado', async () => {
    montar(vinculo({ estado: 'PorVencer', vigenteHasta: '2027-02-10', expedienteAbiertoId: 'renov' }));

    expect(await screen.findByText('La validación de este tercero está en pre-vencimiento')).toBeInTheDocument();
    expect(screen.getByText(/Vence el 10\/02\/2027\. Su renovación está abierta/)).toBeInTheDocument();
    expect(screen.getByText('Por vencer').closest('[data-estado]')).toBeInTheDocument();
  });

  it('un bloqueo con fecha dice el motivo y hasta cuándo dura', async () => {
    montar(
      vinculo({ estado: 'Bloqueado', bloqueo: { motivo: 'Revisión temporal de sanciones.', desde: '2026-11-12T15:00:00Z', hasta: '2026-11-13T23:59:59Z' } }),
    );

    const aviso = (await screen.findByText('Vínculo bloqueado', { selector: '.MuiAlertTitle-root' })).closest('[role="alert"]')!;
    expect(aviso).toHaveTextContent('Revisión temporal de sanciones.');
    expect(aviso).toHaveTextContent(/Desde el 12\/11\/2026 hasta el 13\/11\/2026/);
  });
});

describe('Detalle del vínculo: el historial y las acciones', () => {
  it('cuenta el bloqueo, su levantamiento automático al terminar la fecha y los avisos de la vigencia, de lo más reciente a lo más antiguo', async () => {
    const usuario = userEvent.setup();
    montar(
      vinculo({ estado: 'Activo' }),
      [
        evento(1, 'vinculo_bloqueado', { EstadoPrevio: 'Activo', Motivo: 'Revisión temporal de sanciones.', Hasta: '2026-11-13T23:59:59Z' }, 'Usuario'),
        evento(2, 'vinculo_desbloqueado', { EstadoRestituido: 'Activo', Justificacion: 'El bloqueo temporal terminó el 13/11/2026.' }),
        evento(3, 'vinculo_por_vencer', { VigenteHasta: '2027-02-10', DiasRestantes: 30, AvisosCumplidos: [30] }),
      ],
    );

    await usuario.click(await screen.findByRole('button', { name: 'Historial' }));
    expect(await screen.findByText('Vínculo desbloqueado')).toBeInTheDocument();
    expect(screen.getByText('Vínculo en pre-vencimiento')).toBeInTheDocument();
    expect(screen.getByText(/El bloqueo temporal terminó el 13\/11\/2026\./)).toBeInTheDocument();
    expect(screen.getByText('Vínculo bloqueado', { selector: ':not(.MuiAlertTitle-root)' })).toBeInTheDocument(); // el evento sigue en el historial
    expect(screen.queryByText('Vínculo vencido')).not.toBeInTheDocument();
  });

  it('quien puede bloquear ve «Bloquear» en «Más acciones»; quien solo lee, nada', async () => {
    const usuario = userEvent.setup();
    montar(vinculo({ estado: 'Activo' }), [], new Set([SCOPES.vinculosLeer, SCOPES.vinculosBloquear]));

    await usuario.click(await screen.findByRole('button', { name: 'Más acciones' }));
    expect(await screen.findByRole('menuitem', { name: /^Bloquear/ })).toBeInTheDocument();
  });

  it('quien solo lee no ve «Más acciones»', async () => {
    montar(vinculo({ estado: 'Activo' }));

    await screen.findByRole('heading', { level: 1, name: /Aceros del Norte S.A.S./ });
    expect(screen.queryByRole('button', { name: 'Más acciones' })).not.toBeInTheDocument();
  });
});
