import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCIONES_VINCULO, configurarCliente, reiniciarCliente, type AccionVinculo, type VinculoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../../../shared/useAvisos';
import { DialogoAccion } from './DialogoAccion';

const vinculo: VinculoDto = {
  id: 'v1',
  empresaId: 'e1',
  terceroId: 't1',
  tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  flujoId: null,
  estado: 'Activo',
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
  version: 7,
};

const tercero = {
  id: 't1',
  identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456', digitoVerificacion: '8' },
  tipoPersona: 'Juridica',
  nombre: 'Aceros del Norte S.A.S.',
  nombreComercial: null,
  contactos: [],
  esExtranjero: false,
  creadoEn: '2026-11-01T00:00:00Z',
};

interface Peticion {
  url: string;
  cabeceras: Headers;
  cuerpo: unknown;
}

function preparar(accion: AccionVinculo, respuesta: () => Response, base: VinculoDto = vinculo, viabilidad?: { puedeSinRevalidar: boolean; motivos: string[] }) {
  const peticiones: Peticion[] = [];
  configurarCliente({
    fetch: vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const direccion = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      // El diálogo consulta el tercero para su subtítulo; esa lectura no cuenta como la acción.
      if (direccion.includes('/terceros/')) return Promise.resolve(json(200, tercero));
      // Al reintegrar pregunta si se puede sin revalidar (DS-3); tampoco cuenta como la acción.
      if (direccion.endsWith('/reintegro')) return Promise.resolve(json(200, viabilidad ?? { puedeSinRevalidar: false, motivos: [] }));
      const cuerpo: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      peticiones.push({ url: direccion, cabeceras: new Headers(init?.headers), cuerpo });
      return Promise.resolve(respuesta());
    }),
  });
  const onCerrar = vi.fn();
  const definicion = ACCIONES_VINCULO.find((a) => a.accion === accion)!;
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient()}>
        <DialogoAccion definicion={definicion} vinculo={base} empresaId="e1" onCerrar={onCerrar} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { peticiones, onCerrar };
}

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  reiniciarCliente();
  useAvisos.getState().cerrar();
});

describe('DialogoAccion', () => {
  it('sin motivo el botón de enviar está deshabilitado y dice qué falta; el error sale al dejar el campo', async () => {
    const usuario = userEvent.setup();
    const { peticiones } = preparar('bloquear', () => json(200, vinculo));

    const boton = screen.getByRole('button', { name: 'Bloquear vínculo' });
    expect(boton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Falta llenar «Motivo».');
    expect(screen.queryByText(/Escribe el motivo/)).not.toBeInTheDocument();

    await usuario.click(screen.getByLabelText(/Motivo/));
    await usuario.tab();
    expect(screen.getByText(/Escribe el motivo/)).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/Motivo/), '   ');
    expect(boton).toBeDisabled();
    await usuario.type(screen.getByLabelText(/Motivo/), 'Lista restrictiva');
    expect(boton).toBeEnabled();
    expect(peticiones).toHaveLength(0);
  });

  it('bloquea con If-Match y la empresa activa, y cierra al terminar', async () => {
    const usuario = userEvent.setup();
    const { peticiones, onCerrar } = preparar('bloquear', () => json(200, { ...vinculo, estado: 'Bloqueado', version: 8 }));

    expect(await screen.findByText('Aceros del Norte S.A.S. · NIT 900123456-8')).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/Motivo/), 'Coincidencia en lista restrictiva');
    await usuario.click(screen.getByRole('button', { name: 'Bloquear vínculo' }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    const [peticion] = peticiones;
    expect(peticion?.url).toBe('/api/v1/vinculos/v1/bloquear');
    expect(peticion?.cabeceras.get('If-Match')).toBe('"7"');
    expect(peticion?.cabeceras.get('X-Empresa')).toBe('e1');
    expect(peticion?.cuerpo).toEqual({ motivo: 'Coincidencia en lista restrictiva', hasta: null });
  });

  it('bloquear con fecha de fin envía hasta cuándo dura el bloqueo (VV-5) y avisa que el vínculo quedó bloqueado', async () => {
    const usuario = userEvent.setup();
    const { peticiones, onCerrar } = preparar('bloquear', () => json(200, { ...vinculo, estado: 'Bloqueado', version: 8 }));

    await usuario.type(screen.getByLabelText(/Motivo/), 'Revisión temporal de sanciones.');
    const fecha = screen.getByRole('group', { name: 'Bloquear hasta (opcional)' });
    await usuario.click(within(fecha).getByRole('spinbutton', { name: 'Día' }));
    await usuario.keyboard('10112027');
    await usuario.click(screen.getByRole('button', { name: 'Bloquear vínculo' }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones[0]?.url).toBe('/api/v1/vinculos/v1/bloquear');
    expect(peticiones[0]?.cuerpo).toEqual({ motivo: 'Revisión temporal de sanciones.', hasta: new Date('2027-11-10T23:59:59').toISOString() });
    expect(useAvisos.getState().actual?.mensaje).toBe('Vínculo bloqueado.');
  });

  it('anular exige escribir la palabra de confirmación', async () => {
    const usuario = userEvent.setup();
    const { peticiones } = preparar('anular', () => json(200, vinculo));

    await usuario.type(screen.getByLabelText(/Motivo/), 'Duplicado');
    expect(screen.getByRole('button', { name: 'Anular vínculo' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/Escribe ANULAR tal cual/);

    await usuario.type(screen.getByLabelText(/Escribe ANULAR/), 'anula');
    expect(screen.getByRole('button', { name: 'Anular vínculo' })).toBeDisabled();
    await usuario.type(screen.getByLabelText(/Escribe ANULAR/), 'r');
    expect(screen.getByRole('button', { name: 'Anular vínculo' })).toBeEnabled();
    expect(peticiones).toHaveLength(0);
  });

  it('anular con la palabra de confirmación envía el motivo, cierra y avisa «Vínculo anulado.»', async () => {
    const usuario = userEvent.setup();
    const { peticiones, onCerrar } = preparar('anular', () => json(200, { ...vinculo, estado: 'Anulado', version: 8 }));

    await usuario.type(screen.getByLabelText(/Motivo/), 'Se creó por error.');
    await usuario.type(screen.getByLabelText(/Escribe ANULAR/), 'ANULAR');
    await usuario.click(screen.getByRole('button', { name: 'Anular vínculo' }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]?.url).toBe('/api/v1/vinculos/v1/anular');
    expect(peticiones[0]?.cuerpo).toEqual({ motivo: 'Se creó por error.' });
    expect(useAvisos.getState().actual?.mensaje).toBe('Vínculo anulado.');
  });

  it('desvincular envía el motivo, cierra y avisa «Tercero desvinculado.»', async () => {
    const usuario = userEvent.setup();
    const { peticiones, onCerrar } = preparar('desvincular', () => json(200, { ...vinculo, estado: 'Desvinculado', version: 8 }));

    await usuario.type(screen.getByLabelText(/Motivo/), 'Terminó la relación comercial.');
    await usuario.click(screen.getByRole('button', { name: 'Desvincular' }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]?.url).toBe('/api/v1/vinculos/v1/desvincular');
    expect(peticiones[0]?.cuerpo).toEqual({ motivo: 'Terminó la relación comercial.' });
    expect(useAvisos.getState().actual?.mensaje).toBe('Tercero desvinculado.');
  });

  it('ante un 412 explica que el vínculo cambió, conserva lo escrito y ofrece recargar', async () => {
    const usuario = userEvent.setup();
    const { onCerrar } = preparar('anular', () => json(412, { codigo: 'version-desactualizada', detail: 'El recurso cambió.' }));

    await usuario.type(screen.getByLabelText(/Motivo/), 'Duplicado');
    await usuario.type(screen.getByLabelText(/Escribe ANULAR/), 'anular');
    await usuario.click(screen.getByRole('button', { name: 'Anular vínculo' }));

    expect(await screen.findByText('Alguien cambió este vínculo')).toBeInTheDocument();
    expect(screen.getByText(/Lo que escribiste sigue aquí/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular vínculo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('reenvía la invitación al correo del tercero por defecto', async () => {
    const usuario = userEvent.setup();
    const invitado: VinculoDto = { ...vinculo, estado: 'Invitado' };
    const { peticiones } = preparar('invitar', () => json(201, { correoDestino: 'contacto@aceros.co', expira: '2026-11-09T00:00:00Z', envios: 2 }), invitado);

    expect(screen.getByLabelText(/Correo destino/)).toHaveValue('contacto@aceros.co');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar invitación' }));

    await waitFor(() => expect(peticiones).toHaveLength(1));
    expect(peticiones[0]?.cuerpo).toEqual({ correoDestino: 'contacto@aceros.co', vigenciaHoras: 72 });
  });

  it('desvincular pide el motivo, lo envía y avisa «Tercero desvinculado.»', async () => {
    const usuario = userEvent.setup();
    const { peticiones, onCerrar } = preparar('desvincular', () => json(200, { ...vinculo, estado: 'Desvinculado', version: 8 }));

    expect(screen.getByRole('button', { name: 'Desvincular' })).toBeDisabled();
    await usuario.type(screen.getByLabelText(/Motivo/), 'Terminó el contrato marco.');
    await usuario.click(screen.getByRole('button', { name: 'Desvincular' }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones[0]?.url).toBe('/api/v1/vinculos/v1/desvincular');
    expect(peticiones[0]?.cuerpo).toEqual({ motivo: 'Terminó el contrato marco.' });
    expect(useAvisos.getState().actual?.mensaje).toBe('Tercero desvinculado.');
  });

  describe('reintegrar (DS-3)', () => {
    const desvinculado: VinculoDto = { ...vinculo, estado: 'Desvinculado' };

    it('por omisión revalida; sin revalidar solo se ofrece si lo aprobado sigue vigente', async () => {
      const usuario = userEvent.setup();
      const { peticiones } = preparar('reintegrar', () => json(200, vinculo), desvinculado, { puedeSinRevalidar: true, motivos: [] });

      const sin = await screen.findByRole('radio', { name: /Reintegrar sin revalidar/ });
      expect(sin).toBeEnabled();
      expect(screen.getByRole('radio', { name: /^Revalidar/ })).toBeChecked();

      await usuario.type(screen.getByLabelText(/Justificación/), 'Se renovó el contrato');
      await usuario.click(sin);
      await usuario.click(screen.getByRole('button', { name: 'Reintegrar vínculo' }));

      await waitFor(() => expect(peticiones).toHaveLength(1));
      expect(peticiones[0]?.url).toBe('/api/v1/vinculos/v1/reintegrar');
      expect(peticiones[0]?.cuerpo).toEqual({ justificacion: 'Se renovó el contrato', revalidar: false });
      await waitFor(() => expect(useAvisos.getState().actual?.mensaje).toBe('Vínculo reintegrado.'));
    });

    it('si no se puede sin revalidar explica por qué, deshabilita esa opción y envía revalidar', async () => {
      const usuario = userEvent.setup();
      const { peticiones } = preparar('reintegrar', () => json(200, vinculo), desvinculado, {
        puedeSinRevalidar: false,
        motivos: ['Su vigencia terminó: Registro Único Tributario.'],
      });

      expect(await screen.findByText('Su vigencia terminó: Registro Único Tributario.')).toBeInTheDocument();
      expect(screen.getByText('No se puede reintegrar sin revalidar:')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Reintegrar sin revalidar/ })).toBeDisabled();
      expect(screen.getByRole('radio', { name: /^Revalidar/ })).toBeChecked();

      await usuario.type(screen.getByLabelText(/Justificación/), 'Retoma la relación');
      await usuario.click(screen.getByRole('button', { name: 'Reintegrar vínculo' }));

      await waitFor(() => expect(peticiones).toHaveLength(1));
      expect(peticiones[0]?.cuerpo).toEqual({ justificacion: 'Retoma la relación', revalidar: true });
    });
  });

  it('si el vínculo ya no admite la acción lo dice y no deja enviarla', () => {
    preparar('invitar', () => json(200, vinculo));
    expect(screen.getByText(/esta acción ya no aplica/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reenviar invitación' })).not.toBeInTheDocument();
  });
});
