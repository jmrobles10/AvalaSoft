import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { configurarCliente, reiniciarCliente, SCOPES, type DocumentoVistaEmpresaDto, type VersionDocumentoDto, type VinculoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentosVinculo } from './DocumentosVinculo';

/**
 * «Documentos compartidos» del vínculo: lo que el tercero compartió con la empresa, cada documento con la versión que vale hoy y su
 * botón para verla (conversión de la e2e `actualizaciones`, PC-1: tras actualizar el RUT desde la bóveda, la empresa ve la versión 2 del RUT
 * y la 1 de la Cámara).
 */
const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const VINCULO = { id: 'vin', empresaId: 'emp', terceroId: 't1', invitacionAceptadaEn: '2026-11-01T15:00:00Z' } as unknown as VinculoDto;

const version = (documentoId: string, n: number): VersionDocumentoDto => ({
  documentoId,
  n,
  estado: 'Actual',
  cargadaEn: '2026-11-08T15:00:00Z',
  cargadaPor: 'tercero',
  clase: 'Archivo',
  nombreOriginal: `${documentoId}.pdf`,
  mime: 'application/pdf',
  tamanoBytes: 1024,
  paginas: 1,
  sha256: `huella-${documentoId}-${String(n)}`,
  motivoDevolucion: null,
  detalleDevolucion: null,
  hechos: null,
});

const RUT: DocumentoVistaEmpresaDto = {
  documentoId: 'd-rut',
  tipo: { codigo: 'RUT', nombre: 'Registro Único Tributario', tipoDocumentoTenantId: null },
  ambito: 'Global',
  versionActual: 2,
  versionesCompartidas: [version('d-rut', 1), version('d-rut', 2)],
};
const CAMARA: DocumentoVistaEmpresaDto = {
  documentoId: 'd-camara',
  tipo: { codigo: 'CAMARA_COMERCIO', nombre: 'Certificado de existencia y representación legal', tipoDocumentoTenantId: null },
  ambito: 'Global',
  versionActual: 1,
  versionesCompartidas: [version('d-camara', 1)],
};

function montar(documentos: DocumentoVistaEmpresaDto[], scopes: readonly string[]) {
  permisos.scopes = new Set(scopes);
  configurarCliente({ fetch: vi.fn(() => Promise.resolve(json(documentos))) });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <DocumentosVinculo vinculo={VINCULO} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('Documentos compartidos del vínculo', () => {
  it('cada documento dice la versión que vale hoy y ofrece verla: la 2 del RUT actualizado y la 1 de la Cámara', async () => {
    montar([RUT, CAMARA], [SCOPES.documentosLeer, SCOPES.documentosDescargar]);

    const rut = (await screen.findByText('Registro Único Tributario')).closest('li');
    const camara = screen.getByText('Certificado de existencia y representación legal').closest('li');
    if (!rut || !camara) throw new Error('sin filas de los documentos');
    expect(within(rut).getByText(/Versión 2 · /)).toBeInTheDocument();
    expect(within(camara).getByText(/Versión 1 · /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver o descargar Registro Único Tributario, versión 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver o descargar Certificado de existencia y representación legal, versión 1' })).toBeInTheDocument();
  });

  it('quien solo lee no puede abrir el archivo', async () => {
    montar([RUT], [SCOPES.documentosLeer]);

    expect(await screen.findByText('Registro Único Tributario')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver o descargar/ })).not.toBeInTheDocument();
  });
});
