import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ExpedientePublicoDto, RequisitoPublicoDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TarjetaRequisito } from './TarjetaRequisito';
import { enlaceDeSubida } from './requisitos';

const requisito = (cambios: Partial<RequisitoPublicoDto>): RequisitoPublicoDto => ({
  id: 'rq1',
  tipoDocumento: { id: 'td', codigo: 'CEDULA', nombre: 'Cédula de ciudadanía', tipoCanonico: 'CEDULA', ambito: 'Global', modo: 'Archivo' },
  obligatorio: true,
  estado: 'Pendiente',
  versionActual: null,
  observaciones: [],
  ...cambios,
});

const EXPEDIENTE = {
  id: 'e1',
  folio: 'NORTE-E-2026-000001',
  empresa: { id: 'emp', nombre: 'Constructora Norte S.A.S.', logoUrl: null },
  tipoVinculo: { id: 'tv', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'Abierto',
  observaciones: [],
  puedeReenviar: false,
  reenvios: 0,
  actualizadoEn: '2026-11-06T13:00:00Z',
  requisitos: [],
  requisitosFaltantes: 1,
} satisfies ExpedientePublicoDto;

function montar(r: RequisitoPublicoDto) {
  render(
    <ThemeProvider theme={createAvalasoftTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ul>
            <TarjetaRequisito requisito={r} expediente={EXPEDIENTE} enlace={enlaceDeSubida(r, 'v1', 'e1')} />
          </ul>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('el documento de una persona relacionada en la revisión', () => {
  it('dice de quién es y lleva a subirlo a la bóveda de esa persona', () => {
    montar(requisito({ persona: { rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: false, personaId: 'p1', nombre: 'Juan Pérez', identificacion: 'CO CC 1001' } }));

    expect(screen.getByText('De Juan Pérez · Representante legal')).toBeInTheDocument();
    const subir = screen.getByRole('link', { name: /Subir/ });
    expect(subir).toHaveAttribute('href', expect.stringContaining('persona=p1'));
  });

  it('sin persona todavía pide registrarla y no ofrece subir nada', () => {
    montar(requisito({ persona: { rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: true } }));

    expect(screen.getByText(/Aún no registras a quién cumple este rol \(representante legal\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar a la persona' })).toHaveAttribute('href', '/personas');
    expect(screen.queryByRole('link', { name: /Subir/ })).not.toBeInTheDocument();
  });

  it('un documento del propio tercero se ve como siempre', () => {
    montar(requisito({}));

    expect(screen.queryByText(/De .* ·/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Subir/ })).toHaveAttribute('href', expect.not.stringContaining('persona='));
  });
});
