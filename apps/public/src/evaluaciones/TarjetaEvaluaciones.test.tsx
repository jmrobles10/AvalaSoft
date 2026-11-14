import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import type { EvaluacionPublicaResumenDto } from '@validasoft/api-client';
import { createValidasoftTheme } from '@validasoft/ui';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { evaluacionesPendientes } from './modelo';
import { AvisoEvaluacionesPendientes, TarjetaEvaluaciones } from './TarjetaEvaluaciones';

const evaluacion = (cambios: Partial<EvaluacionPublicaResumenDto> = {}): EvaluacionPublicaResumenDto => ({
  id: 'ev1',
  cuestionario: 'Autoevaluación de proveedor',
  estado: 'Pendiente',
  asignadaEn: '2026-11-10T15:00:00Z',
  respondidaEn: null,
  ...cambios,
});

const montar = (pantalla: ReactNode) =>
  render(
    <ThemeProvider theme={createValidasoftTheme('light', { app: 'public' })}>
      <MemoryRouter>{pantalla}</MemoryRouter>
    </ThemeProvider>,
  );

describe('evaluacionesPendientes', () => {
  it('deja solo las que el tercero aún debe responder', () => {
    const lista = [evaluacion({ id: '1' }), evaluacion({ id: '2', estado: 'Calificada', respondidaEn: '2026-11-11T10:00:00Z' })];
    expect(evaluacionesPendientes(lista).map((e) => e.id)).toEqual(['1']);
    expect(evaluacionesPendientes(null)).toEqual([]);
  });
});

describe('TarjetaEvaluaciones (CE-4)', () => {
  it('no dibuja nada sin evaluaciones', () => {
    const { container } = montar(<TarjetaEvaluaciones evaluaciones={[]} vinculoId="v1" empresa="Aceros del Norte" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('la pendiente invita a responder y la enviada solo a verla, sin puntaje', () => {
    montar(
      <TarjetaEvaluaciones
        vinculoId="v1"
        empresa="Aceros del Norte"
        evaluaciones={[evaluacion({ id: 'ev1' }), evaluacion({ id: 'ev2', cuestionario: 'Riesgo', estado: 'Calificada', respondidaEn: '2026-11-11T10:00:00Z' })]}
      />,
    );

    expect(screen.getByText('Evaluaciones que te pide Aceros del Norte')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Enviada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Responder la evaluación Autoevaluación de proveedor' })).toHaveAttribute('href', '/empresas/v1/evaluaciones/ev1');
    expect(screen.getByRole('link', { name: 'Ver la evaluación Riesgo' })).toHaveAttribute('href', '/empresas/v1/evaluaciones/ev2');
    expect(screen.queryByText(/puntaje|aprobada|reprobada/i)).not.toBeInTheDocument();
  });
});

describe('AvisoEvaluacionesPendientes', () => {
  it('con una pendiente lleva directo a responderla', () => {
    montar(<AvisoEvaluacionesPendientes vinculoId="v1" empresa="Aceros del Norte" evaluaciones={[evaluacion()]} />);
    expect(screen.getByText('Aceros del Norte te pide responder una evaluación')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Responder la evaluación Autoevaluación de proveedor' })).toHaveAttribute('href', '/empresas/v1/evaluaciones/ev1');
  });

  it('con varias lista cada una; con ninguna pendiente no aparece', () => {
    const { container, rerender } = montar(
      <AvisoEvaluacionesPendientes vinculoId="v1" empresa="Aceros del Norte" evaluaciones={[evaluacion({ id: 'a', cuestionario: 'Uno' }), evaluacion({ id: 'b', cuestionario: 'Dos' })]} />,
    );
    expect(screen.getByText('Aceros del Norte te pide responder 2 evaluaciones')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Responder la evaluación Dos' })).toHaveAttribute('href', '/empresas/v1/evaluaciones/b');

    rerender(
      <ThemeProvider theme={createValidasoftTheme('light', { app: 'public' })}>
        <MemoryRouter>
          <AvisoEvaluacionesPendientes vinculoId="v1" empresa="Aceros del Norte" evaluaciones={[evaluacion({ estado: 'Calificada' })]} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
