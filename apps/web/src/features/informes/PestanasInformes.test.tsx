import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { SCOPES } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PestanasInformes, type PestanaInforme } from './PestanasInformes';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

function montar(actual: PestanaInforme) {
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <MemoryRouter>
        <PestanasInformes empresaId="emp" actual={actual} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  permisos.scopes = new Set();
});

describe('PestanasInformes', () => {
  it('muestra solo los informes que la persona puede ver, como enlaces, con el activo seleccionado y sus íconos ocultos a los lectores', () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar('vinculos');
    const nombres = screen.getAllByRole('tab').map((p) => p.textContent);
    expect(nombres).toEqual(['Estado de expedientes', 'Terceros y vínculos', 'Plazo de revisión']);
    expect(screen.getByRole('tab', { name: 'Terceros y vínculos', selected: true })).toHaveAttribute('href', '/e/emp/informes/vinculos');
    expect(screen.getByRole('tab', { name: 'Plazo de revisión', selected: false })).toHaveAttribute('href', '/e/emp/informes/sla');
    expect(screen.queryByRole('tab', { name: 'Evaluaciones' })).not.toBeInTheDocument();
    for (const pestana of screen.getAllByRole('tab')) expect(pestana.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('con todos los permisos hay cuatro pestañas', () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer, SCOPES.evaluacionesLeer]);
    montar('evaluaciones');
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tablist', { name: 'Informes' })).toBeInTheDocument();
  });
});
