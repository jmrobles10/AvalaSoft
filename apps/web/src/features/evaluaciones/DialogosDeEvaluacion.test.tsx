import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente } from '@avalasoft/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { ProblemaSimulado, simularApi } from '../../pruebas/simularApi';
import { useAvisos } from '../../shared/useAvisos';
import { DialogoJustificar, DialogoRecalificar } from './DialogosDeEvaluacion';
import { evaluacion, evaluacionCalificada, resultado } from './pruebasDeEvaluaciones';

afterEach(() => {
  reiniciarCliente();
  useAvisos.getState().cerrar();
});

const REPROBADA_POR_ELIMINATORIA = resultado({
  puntaje: 0,
  aprobada: false,
  motivos: ['BajoElUmbral', 'Eliminatoria'],
  eliminatorias: ['P1'],
  secciones: [{ codigo: 'S1', nombre: 'Cumplimiento', peso: 1, puntaje: 0, aplica: true }],
  preguntas: [
    { codigo: 'P1', visible: true, respondida: true, puntaje: 0, elimina: true, ajustada: false },
    { codigo: 'P2', visible: true, respondida: false, puntaje: null, elimina: false, ajustada: false },
  ],
});

describe('DialogoJustificar (CE-10)', () => {
  it('anular pide la justificación y la envía recortada', async () => {
    const usuario = userEvent.setup();
    const peticiones = simularApi({ 'POST /api/v1/evaluaciones/ev1/anular': evaluacion({ estado: 'Anulada' }) });
    const onCerrar = vi.fn();
    montarPantalla(<DialogoJustificar evaluacion={evaluacion()} empresaId="emp" accion="anular" onCerrar={onCerrar} />);

    expect(screen.getByText('Anular la evaluación')).toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Anular' });
    expect(boton).toBeDisabled();
    expect(screen.getAllByText('Escribe la justificación').length).toBeGreaterThan(0);

    await usuario.type(screen.getByLabelText(/Justificación/), '  El proveedor ya no aplica  ');
    expect(boton).toBeEnabled();
    await usuario.click(boton);

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({ justificacion: 'El proveedor ya no aplica' });
    expect(await screen.findByText('Evaluación anulada.')).toBeInTheDocument();
  });

  it('reabrir llama a su propia operación y deja el error de la API a la vista sin cerrar', async () => {
    const usuario = userEvent.setup();
    simularApi({ 'POST /api/v1/evaluaciones/ev1/reabrir': new ProblemaSimulado(409, 'evaluacion-no-calificada', 'Solo se reabre una evaluación calificada; esta está Pendiente.') });
    const onCerrar = vi.fn();
    montarPantalla(<DialogoJustificar evaluacion={evaluacionCalificada()} empresaId="emp" accion="reabrir" onCerrar={onCerrar} />);

    await usuario.type(screen.getByLabelText(/Justificación/), 'Se respondió con el cuestionario equivocado');
    await usuario.click(screen.getByRole('button', { name: 'Reabrir' }));

    expect(await screen.findByText('Esa acción solo se puede hacer con una evaluación ya calificada.')).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });
});

describe('DialogoRecalificar (CE-10)', () => {
  it('levantar la eliminatoria y recalificar manda el ajuste, la justificación y deja el veredicto al cálculo', async () => {
    const usuario = userEvent.setup();
    const evaluacionReprobada = evaluacionCalificada({}, REPROBADA_POR_ELIMINATORIA);
    const peticiones = simularApi({ 'POST /api/v1/evaluaciones/ev1/recalificar': evaluacionCalificada({ recalificaciones: 1 }) });
    const onCerrar = vi.fn();
    montarPantalla(<DialogoRecalificar evaluacion={evaluacionReprobada} empresaId="emp" onCerrar={onCerrar} />);

    // Solo se ofrecen las preguntas que puntuaron o eliminaron: la de texto libre no aparece.
    expect(screen.getByText('¿Tiene certificación ISO 9001?')).toBeInTheDocument();
    expect(screen.queryByText('Cuéntanos tus clientes principales')).not.toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Recalificar' });
    expect(boton).toBeDisabled();

    await usuario.click(screen.getByRole('checkbox', { name: 'Levantar la eliminatoria' }));
    await usuario.type(screen.getByLabelText(/Justificación/), 'Presentó la certificación por otro canal');
    await usuario.click(boton);

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
    expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({
      justificacion: 'Presentó la certificación por otro canal',
      ajustes: [{ pregunta: 'P1', puntaje: null, levantaEliminatoria: true }],
      aprobada: null,
    });
    expect(await screen.findByText('Evaluación recalificada: aprobada.')).toBeInTheDocument();
  });

  it('fijar el veredicto a mano y ajustar un puntaje (tope de 100) viaja con la justificación', async () => {
    const usuario = userEvent.setup();
    const peticiones = simularApi({ 'POST /api/v1/evaluaciones/ev1/recalificar': evaluacionCalificada({}, resultado({ aprobada: false, calculada: false })) });
    montarPantalla(<DialogoRecalificar evaluacion={evaluacionCalificada()} empresaId="emp" onCerrar={vi.fn()} />);

    await usuario.type(screen.getByLabelText('Puntaje de 0 a 100'), '150');
    await usuario.click(screen.getByRole('combobox', { name: 'Veredicto' }));
    await usuario.click(await screen.findByRole('option', { name: 'Reprobada' }));
    await usuario.type(screen.getByLabelText(/Justificación/), 'Decisión del comité');
    await usuario.click(screen.getByRole('button', { name: 'Recalificar' }));

    await waitFor(() => expect(peticiones.some((p) => p.metodo === 'POST')).toBe(true));
    expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({
      justificacion: 'Decisión del comité',
      ajustes: [{ pregunta: 'P1', puntaje: 100, levantaEliminatoria: false }],
      aprobada: false,
    });
    expect(await screen.findByText('Evaluación recalificada: reprobada.')).toBeInTheDocument();
  });
});
