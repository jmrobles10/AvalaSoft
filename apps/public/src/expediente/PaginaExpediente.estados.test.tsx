import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, type ExpedientePublicoDto, type RequisitoPublicoDto, type VinculoPublicoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../shared/useAvisos';
import { PaginaExpediente } from './PaginaExpediente';

/**
 * «Tu revisión con {empresa}» de un expediente inicial según lo que decidió la empresa: devuelto con observaciones (el tercero responde
 * con una explicación), aprobado y rechazado (nada que responder). Conversión de las e2e `decisiones`, PC-1.
 */
const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const vinculo = (cambios: Partial<VinculoPublicoDto> = {}): VinculoPublicoDto => ({
  id: 'v1',
  empresa: { id: 'emp', nombre: 'Constructora Norte', logoUrl: null },
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'EnValidacion',
  invitacionAceptada: true,
  invitacionAceptadaEn: '2026-11-08T15:00:00Z',
  expedienteId: 'exp-1',
  ...cambios,
});

const expediente = (cambios: Partial<ExpedientePublicoDto> = {}): ExpedientePublicoDto => ({
  id: 'exp-1',
  folio: 'NORTE-E-2026-000002',
  empresa: { id: 'emp', nombre: 'Constructora Norte', logoUrl: null },
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'EnRevision',
  tipo: 'Inicial',
  observaciones: [],
  puedeReenviar: false,
  reenvios: 0,
  requisitosFaltantes: 0,
  requisitos: [],
  actualizadoEn: '2026-11-09T15:00:00Z',
  ...cambios,
});

/** El servidor responde con `actual`; la prueba lo cambia para simular lo que decide la empresa. */
function montar(vinculos: VinculoPublicoDto[], inicial: ExpedientePublicoDto) {
  const estado = { actual: inicial };
  const reenvios: unknown[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.endsWith('/reenviar')) {
        reenvios.push(JSON.parse(typeof init?.body === 'string' ? init.body : 'null'));
        estado.actual = expediente({ estado: 'EnRevision', reenvios: 1 });
        return Promise.resolve(json(estado.actual));
      }
      return Promise.resolve(json(url.includes('/expedientes/') ? estado.actual : vinculos));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/expediente/exp-1']}>
          <Routes>
            <Route path="/expediente/:id" element={<PaginaExpediente />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return reenvios;
}

afterEach(() => {
  reiniciarCliente();
  useAvisos.getState().cerrar();
});

describe('Tu revisión con una empresa: el expediente inicial', () => {
  it('devuelto con observaciones: pide corregir y responde con una explicación, sin subir una versión nueva', async () => {
    const usuario = userEvent.setup();
    const reenvios = montar(
      [vinculo()],
      expediente({
        estado: 'Observado',
        puedeReenviar: true,
        observaciones: [{ fecha: '2026-11-09T14:00:00Z', motivos: [{ codigo: 'incompleto', texto: 'La información o el documento está incompleto.' }], observacion: 'Falta la firma.' }],
      }),
    );

    expect(await screen.findByText(/Constructora Norte te pide corregir lo siguiente/)).toBeInTheDocument();
    expect(screen.getByText('La información o el documento está incompleto.')).toBeInTheDocument();
    expect(screen.getByText(/Falta la firma./)).toBeInTheDocument();

    await usuario.type(screen.getByRole('textbox', { name: 'Tu respuesta (opcional)' }), 'La Cámara se expide con firma digital; está en la última página.');
    await usuario.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    await waitFor(() => expect(reenvios).toEqual([{ respuesta: 'La Cámara se expide con firma digital; está en la última página.' }]));
    expect(await screen.findByText(/Constructora Norte está revisando tu información/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).not.toBeInTheDocument();
    expect(useAvisos.getState().actual?.mensaje).toBe('Enviaste tu respuesta. Constructora Norte vuelve a revisar.');
  });

  it('cada documento dice su versión: la que ya estaba en la bóveda al volver a postularse y la corregida después', async () => {
    const documento = (id: string, nombre: string, n: number): RequisitoPublicoDto => ({
      id,
      tipoDocumento: { id: `td-${id}`, codigo: id, nombre, tipoCanonico: null, ambito: 'Global' },
      obligatorio: true,
      estado: 'EnRevision',
      versionActual: { documentoId: `doc-${id}`, n, sha256: 'huella', cargadaEn: '2026-11-08T15:00:00Z' },
      observaciones: [],
    });
    montar([vinculo()], expediente({ requisitos: [documento('rut', 'Registro Único Tributario', 2), documento('camara', 'Certificado de existencia y representación legal', 1)] }));

    const rut = (await screen.findByRole('heading', { name: 'Registro Único Tributario' })).closest('li');
    const camara = screen.getByRole('heading', { name: 'Certificado de existencia y representación legal' }).closest('li');
    if (!rut || !camara) throw new Error('sin tarjetas de los documentos');
    expect(within(rut).getByText(/Versión 2 · cargada el/)).toBeInTheDocument();
    expect(within(camara).getByText(/Versión 1 · cargada el/)).toBeInTheDocument();
  });

  it('aprobado: dice que el vínculo está activo', async () => {
    montar([vinculo({ estado: 'Activo' })], expediente({ estado: 'Aprobado' }));

    expect(await screen.findByText('Constructora Norte aprobó tu información. Tu vínculo está activo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).not.toBeInTheDocument();
  });

  it('rechazado: la empresa cerró la revisión y ya no hay respuesta que enviar', async () => {
    montar([vinculo({ estado: 'Invitado' })], expediente({ estado: 'Rechazado' }));

    expect(await screen.findByText('Constructora Norte cerró la revisión sin aprobarla. Si tienes dudas, escríbele.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar respuesta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Tu respuesta (opcional)' })).not.toBeInTheDocument();
  });
});
