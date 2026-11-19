import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, type ExpedientePublicoDto, type TipoDocumentoRequisitoDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaSubir } from './PaginaSubir';

/**
 * Cargas que no se admiten al subir el documento que pide una revisión (conversión de la e2e `actualizaciones`, PC-1): un formato distinto
 * al que exige el tipo (el navegador lo dice sin subir nada) y el mismo archivo que ya es la versión 1 (el servidor responde «duplicado»
 * sin crear versión y se le dice al tercero).
 */
const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

const RUT: TipoDocumentoRequisitoDto = {
  id: 't1',
  codigo: 'RUT',
  nombre: 'Registro Único Tributario',
  tipoCanonico: 'RUT',
  ambito: 'Global',
  modo: 'Archivo',
  campos: [],
  archivo: { formatos: ['application/pdf'], tamanoMaximoBytes: 5 * 1024 * 1024, paginasMaximas: 10, descripcion: 'Solo PDF de hasta 5 MB' },
  tienePlantilla: false,
};

const expediente = (): ExpedientePublicoDto => ({
  id: 'e1',
  folio: 'F-1',
  empresa: { id: 'emp', nombre: 'Constructora Norte', logoUrl: null },
  tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'EnRevision',
  observaciones: [],
  puedeReenviar: false,
  reenvios: 0,
  actualizadoEn: '2026-11-08T15:00:00Z',
  requisitos: [{ id: 'r1', tipoDocumento: RUT, obligatorio: true, estado: 'EnRevision', versionActual: null, observaciones: [] }],
});

function montar() {
  const peticiones: { metodo: string; url: string }[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      peticiones.push({ metodo: init?.method ?? 'GET', url });
      // Paso 1 de la carga: el mismo contenido ya es la versión 1, así que no hay URL de carga.
      if (init?.method === 'POST' && url.endsWith('/boveda/documentos')) return Promise.resolve(json({ documentoId: 'd1', version: 1, duplicado: true, carga: null }, 200));
      return Promise.resolve(json(url.includes('/expedientes/') ? expediente() : { documentos: [] }));
    }),
  });
  const ruta = `/boveda/subir?nombre=${encodeURIComponent(RUT.nombre)}&volver=%2Fexpediente%2Fe1&expediente=e1&requisito=r1&tipoDocumentoTenantId=t1&vinculoId=v1`;
  render(
    <ThemeProvider theme={createValidaloTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <PaginaSubir />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return peticiones;
}

afterEach(() => reiniciarCliente());

describe('cargas que no se admiten', () => {
  it('una imagen donde solo se admite PDF se rechaza en el navegador, con el formato que sí sirve, y no sube nada', async () => {
    const usuario = userEvent.setup({ applyAccept: false });
    const peticiones = montar();

    await screen.findByText('Solo PDF de hasta 5 MB y 10 páginas');
    await usuario.upload(screen.getByTestId('entrada-archivo'), new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'rut.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este formato no se acepta para este documento. Sube un archivo PDF.');
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false);
  });

  it('el mismo archivo que ya es la versión 1 se dice sin subirlo de nuevo', async () => {
    const usuario = userEvent.setup({ applyAccept: false });
    const peticiones = montar();

    await screen.findByText('Solo PDF de hasta 5 MB y 10 páginas');
    await usuario.upload(screen.getByTestId('entrada-archivo'), new File(['%PDF-1.4 el mismo RUT'], 'rut.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Es el mismo archivo que ya tienes')).toBeInTheDocument();
    expect(screen.getByText('Es idéntico a tu versión 1: no hace falta subirlo de nuevo.')).toBeInTheDocument();
    expect(peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(1); // solo el paso 1: no se sube nada ni se confirma
  });
});
