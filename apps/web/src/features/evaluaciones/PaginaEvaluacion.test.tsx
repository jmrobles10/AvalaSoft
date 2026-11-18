import { screen, within } from '@testing-library/react';
import { reiniciarCliente, SCOPES } from '@avalasoft/api-client';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { ProblemaSimulado, simularApi } from '../../pruebas/simularApi';
import { PaginaEvaluacion } from './PaginaEvaluacion';
import { evaluacion, evaluacionCalificada, resultado } from './pruebasDeEvaluaciones';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));

function abrir() {
  return montarPantalla(
    <Routes>
      <Route path="/e/emp/evaluaciones/:evaluacionId" element={<PaginaEvaluacion />} />
    </Routes>,
    '/e/emp/evaluaciones/ev1',
  );
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('PaginaEvaluacion (CE-9, CE-10)', () => {
  it('sin permiso de leer evaluaciones no muestra nada de la evaluación', () => {
    simularApi({});
    abrir();
    expect(screen.queryByText('Resultado')).not.toBeInTheDocument();
  });

  it('una calificada muestra el puntaje contra el umbral, las secciones, las preguntas con lo respondido y el historial', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    simularApi({
      'GET /api/v1/evaluaciones/ev1': evaluacionCalificada(
        {},
        resultado({ puntaje: '83.33', aprobada: true, secciones: [{ codigo: 'S1', nombre: 'Cumplimiento', peso: 1, puntaje: '83.33', aplica: true }] }),
      ),
    });
    abrir();

    expect(await screen.findByRole('heading', { name: 'Evaluación de proveedor nuevo' })).toBeInTheDocument();
    expect(screen.getByText('Umbral de aprobación: 70')).toBeInTheDocument();
    expect(screen.getAllByText('83,33').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aprobada').length).toBeGreaterThan(0);
    const preguntas = screen.getByRole('table', { name: 'Respuestas y puntaje por pregunta' });
    expect(within(preguntas).getByText('¿Tiene certificación ISO 9001?')).toBeInTheDocument();
    expect(within(preguntas).getByText('Sí')).toBeInTheDocument();
    expect(screen.getByText('Historial de calificaciones')).toBeInTheDocument();
    expect(screen.getByText(/Ana Revisora|una persona/)).toBeInTheDocument();
    // Sin permiso de recalificar no hay acciones.
    expect(screen.queryByRole('button', { name: 'Recalificar' })).not.toBeInTheDocument();
  });

  it('quien puede recalificar ve recalificar, reabrir y anular; una reprobada por eliminatoria dice por qué', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer, SCOPES.evaluacionesRecalificar]);
    simularApi({
      'GET /api/v1/evaluaciones/ev1': evaluacionCalificada(
        {},
        resultado({
          puntaje: 0,
          aprobada: false,
          motivos: ['BajoElUmbral', 'Eliminatoria'],
          preguntas: [
            { codigo: 'P1', visible: true, respondida: true, puntaje: 0, elimina: true, ajustada: false },
            { codigo: 'P2', visible: true, respondida: false, puntaje: null, elimina: false, ajustada: false },
          ],
        }),
      ),
    });
    abrir();

    expect(await screen.findByRole('button', { name: 'Recalificar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument();
    expect(screen.getAllByText('Reprobada').length).toBeGreaterThan(0);
    expect(screen.getByText('Bajo el umbral')).toBeInTheDocument();
    expect(screen.getByText('Pregunta eliminatoria')).toBeInTheDocument();
  });

  it('una pendiente que responde el tercero avisa que verá el resultado cuando la envíe', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer, SCOPES.evaluacionesResponder]);
    simularApi({ 'GET /api/v1/evaluaciones/ev1': evaluacion({ responde: 'Tercero' }) });
    abrir();

    expect(await screen.findByText(/La responde el tercero|responde el tercero desde su portal/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar evaluación' })).not.toBeInTheDocument();
  });

  it('una evaluación de otra empresa (404) se muestra como no encontrada', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    simularApi({ 'GET /api/v1/evaluaciones/ev1': new ProblemaSimulado(404, 'evaluacion-no-encontrada', 'No encontramos la evaluación.') });
    abrir();

    expect(await screen.findByText('No encontramos esa evaluación')).toBeInTheDocument();
  });
});
