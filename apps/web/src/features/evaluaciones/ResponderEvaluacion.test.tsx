import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente } from '@validalo/api-client';
import { afterEach, describe, expect, it } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { ProblemaSimulado, simularApi } from '../../pruebas/simularApi';
import { useAvisos } from '../../shared/useAvisos';
import { evaluacion, evaluacionCalificada } from './pruebasDeEvaluaciones';
import { ResponderEvaluacion } from './ResponderEvaluacion';

afterEach(() => {
  reiniciarCliente();
  useAvisos.getState().cerrar();
});

const TODAS = { preguntas: ['P1', 'P2'], secciones: ['S1'] };

describe('ResponderEvaluacion (CE-4)', () => {
  it('no deja enviar hasta responder lo obligatorio y envía solo lo respondido', async () => {
    const usuario = userEvent.setup();
    const peticiones = simularApi({
      'POST /api/v1/evaluaciones/ev1/visibilidad': TODAS,
      'POST /api/v1/evaluaciones/ev1/responder': evaluacionCalificada(),
    });
    montarPantalla(<ResponderEvaluacion evaluacion={evaluacion()} empresaId="emp" />);

    expect(await screen.findByText('¿Tiene certificación ISO 9001?')).toBeInTheDocument();
    expect(await screen.findByText('Falta 1 pregunta obligatoria')).toBeInTheDocument();
    const enviar = screen.getByRole('button', { name: 'Enviar evaluación' });
    expect(enviar).toBeDisabled();

    await usuario.click(screen.getByRole('radio', { name: 'Sí' }));
    // El envío espera a que la API diga qué preguntas se ven con lo respondido (la visibilidad se pide con una pausa corta).
    await waitFor(() => expect(enviar).toBeEnabled());
    expect(screen.queryByText('Falta 1 pregunta obligatoria')).not.toBeInTheDocument();
    await usuario.click(enviar);

    expect(await screen.findByText('Evaluación enviada: aprobada.')).toBeInTheDocument();
    expect(peticiones.find((p) => p.ruta.endsWith('/responder'))?.cuerpo).toEqual({ respuestas: [{ pregunta: 'P1', opciones: ['si'] }] });
  });

  it('muestra solo las preguntas que la API dice que se ven con lo respondido', async () => {
    const usuario = userEvent.setup();
    const peticiones = simularApi({
      'POST /api/v1/evaluaciones/ev1/visibilidad': (p) => {
        const respuestas = (p.cuerpo as { respuestas: { pregunta: string; opciones?: string[] }[] }).respuestas;
        const conCertificacion = respuestas.some((r) => r.pregunta === 'P1' && r.opciones?.[0] === 'si');
        return { preguntas: conCertificacion ? ['P1', 'P2'] : ['P1'], secciones: ['S1'] };
      },
    });
    montarPantalla(<ResponderEvaluacion evaluacion={evaluacion()} empresaId="emp" />);

    expect(await screen.findByText('¿Tiene certificación ISO 9001?')).toBeInTheDocument();
    await waitFor(() => expect(peticiones.length).toBeGreaterThan(0));
    expect(screen.queryByText('Cuéntanos tus clientes principales')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Sí' }));
    expect(await screen.findByText('Cuéntanos tus clientes principales')).toBeInTheDocument();
  });

  it('el error de la API sobre una pregunta se muestra en ella y no se cierra nada', async () => {
    const usuario = userEvent.setup();
    simularApi({
      'POST /api/v1/evaluaciones/ev1/visibilidad': TODAS,
      'POST /api/v1/evaluaciones/ev1/responder': new ProblemaSimulado(422, 'respuesta-invalida', 'La respuesta de P1 no es una opción válida.', { pregunta: 'P1' }),
    });
    montarPantalla(<ResponderEvaluacion evaluacion={evaluacion()} empresaId="emp" />);

    await usuario.click(await screen.findByRole('radio', { name: 'Sí' }));
    const enviar = screen.getByRole('button', { name: 'Enviar evaluación' });
    await waitFor(() => expect(enviar).toBeEnabled());
    await usuario.click(enviar);

    expect(await screen.findByText('La respuesta de P1 no es una opción válida.')).toBeInTheDocument();
  });
});
