import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { type VersionDocumentoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EstadoDeSubida } from './EstadoDeSubida';

/**
 * Lo que dice la subida al terminar bien: la versión que quedó en la bóveda y a dónde seguir (conversión de la e2e `actualizaciones`, PC-1: el
 * proveedor actualiza su RUT y ve «Es tu versión 2»).
 */
const version = (n: number): VersionDocumentoDto => ({
  documentoId: 'd-rut',
  n,
  estado: 'Actual',
  cargadaEn: '2026-11-08T15:00:00Z',
  cargadaPor: 'tercero',
  clase: 'Archivo',
  nombreOriginal: 'rut.pdf',
  mime: 'application/pdf',
  tamanoBytes: 2048,
  paginas: 1,
  sha256: 'huella',
  motivoDevolucion: null,
  detalleDevolucion: null,
  hechos: null,
});

function montar(n: number, volver: string | null) {
  render(
    <ThemeProvider theme={createAvalasoftTheme('light', { app: 'public' })}>
      <MemoryRouter>
        <EstadoDeSubida
          estado={{ fase: 'resultado', archivo: new File(['%PDF-1.4'], 'rut.pdf', { type: 'application/pdf' }), resultado: { tipo: 'lista', version: version(n), compartidos: [] } }}
          tipo="Registro Único Tributario"
          onCancelar={() => undefined}
          onOtroArchivo={() => undefined}
          volver={volver}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('una subida que terminó bien', () => {
  it('dice la versión que quedó en la bóveda y que ninguna empresa la exige todavía', () => {
    montar(2, null);

    expect(screen.getByText('Listo. Es tu versión 2 de Registro Único Tributario.')).toBeInTheDocument();
    expect(screen.getByText('Por ahora ninguna empresa la exige; queda en tu bóveda.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Volver a mi revisión' })).not.toBeInTheDocument();
  });

  it('si venía de una revisión ofrece volver a ella', () => {
    montar(1, '/expediente/e1');

    expect(screen.getByText('Listo. Es tu versión 1 de Registro Único Tributario.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mi revisión' })).toHaveAttribute('href', '/expediente/e1');
  });
});
