import { screen } from '@testing-library/react';
import { SCOPES, type ExpedienteDto } from '@avalasoft/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { AvisoEsperandoEvaluaciones, PanelEvaluaciones } from './PanelEvaluaciones';
import { evaluacionDeExpediente } from './pruebasDeEvaluaciones';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const expediente = (evaluaciones: ExpedienteDto['evaluaciones']) => ({ evaluaciones }) as ExpedienteDto;

afterEach(() => {
  permisos.scopes = new Set();
});

describe('PanelEvaluaciones (CE-8)', () => {
  it('no dibuja nada cuando el flujo no pidió evaluaciones', () => {
    const { container } = montarPantalla(<PanelEvaluaciones expediente={expediente([])} empresaId="emp" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lista cada evaluación con su estado, quién responde, qué pasa si reprueba y su puntaje', () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    montarPantalla(
      <PanelEvaluaciones
        expediente={expediente([
          evaluacionDeExpediente({ evaluacionId: 'ev1', nombre: 'Proveedor nuevo', estado: 'Pendiente', responde: 'Evaluador' }),
          evaluacionDeExpediente({ evaluacionId: 'ev2', nombre: 'Autoevaluación SAGRILAFT', estado: 'Reprobada', responde: 'Tercero', efecto: 'Observar', puntaje: 55 }),
        ])}
        empresaId="emp"
      />,
    );

    expect(screen.getByText('Evaluaciones del expediente')).toBeInTheDocument();
    expect(screen.getByText('Proveedor nuevo')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/Responde la empresa · Bloquea el cierre/)).toBeInTheDocument();
    expect(screen.getByText('Reprobada')).toBeInTheDocument();
    expect(screen.getByText('Puntaje 55')).toBeInTheDocument();
    expect(screen.getByText(/Responde el tercero · Solo observa/)).toBeInTheDocument();
    // La pendiente que responde la empresa invita a responder; la otra, a abrir.
    expect(screen.getByRole('link', { name: 'Responder' })).toHaveAttribute('href', '/e/emp/evaluaciones/ev1');
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/e/emp/evaluaciones/ev2');
  });

  it('sin permiso de leer evaluaciones se ve el estado pero no el enlace', () => {
    montarPantalla(<PanelEvaluaciones expediente={expediente([evaluacionDeExpediente({ nombre: 'Proveedor nuevo' })])} empresaId="emp" />);
    expect(screen.getByText('Proveedor nuevo')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('AvisoEsperandoEvaluaciones', () => {
  it('nombra solo las evaluaciones que impiden cerrar, con su estado', () => {
    montarPantalla(
      <AvisoEsperandoEvaluaciones
        expediente={expediente([
          evaluacionDeExpediente({ evaluacionId: '1', nombre: 'Proveedor nuevo', estado: 'Pendiente' }),
          evaluacionDeExpediente({ evaluacionId: '2', nombre: 'Riesgo', estado: 'Reprobada' }),
          evaluacionDeExpediente({ evaluacionId: '3', nombre: 'Aprobada ya', estado: 'Aprobada' }),
          evaluacionDeExpediente({ evaluacionId: '4', nombre: 'Solo mira', estado: 'Reprobada', efecto: 'Observar' }),
        ])}
      />,
    );
    expect(screen.getByText('El cierre espera una evaluación')).toBeInTheDocument();
    expect(screen.getByText(/Proveedor nuevo \(pendiente\), Riesgo \(reprobada\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Aprobada ya/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Solo mira/)).not.toBeInTheDocument();
  });
});
