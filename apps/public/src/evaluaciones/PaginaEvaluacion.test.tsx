import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, type EvaluacionPublicaDto, type VinculoPublicoDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaEvaluacion } from './PaginaEvaluacion';

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/problem+json' } });

const VINCULO = {
  id: 'v1',
  empresa: { id: 'emp', nombre: 'Aceros del Norte', logoUrl: null },
  tipoVinculo: { id: 'tp', codigo: 'PROVEEDOR', nombre: 'Proveedor' },
  estado: 'EnValidacion',
  invitacionAceptada: true,
  invitacionAceptadaEn: '2026-10-20T15:00:00Z',
  expedienteId: 'exp1',
} as VinculoPublicoDto;

const PENDIENTE: EvaluacionPublicaDto = {
  id: 'ev1',
  vinculoId: 'v1',
  cuestionario: 'Autoevaluación de proveedor',
  descripcion: 'Cuéntanos cómo trabajas.',
  estado: 'Pendiente',
  secciones: [
    {
      codigo: 'S1',
      nombre: 'Cumplimiento',
      descripcion: null,
      preguntas: [
        {
          codigo: 'P1',
          texto: '¿Tiene certificación ISO 9001?',
          tipo: 'SiNo',
          obligatoria: true,
          ayuda: null,
          permiteComentario: false,
          opciones: [
            { codigo: 'si', texto: 'Sí' },
            { codigo: 'no', texto: 'No' },
          ],
          escala: null,
        },
      ],
    },
  ],
  respuestas: [],
  adjuntos: [],
  asignadaEn: '2026-11-10T15:00:00Z',
  respondidaEn: null,
};

const ENVIADA: EvaluacionPublicaDto = { ...PENDIENTE, estado: 'Calificada', respuestas: [{ pregunta: 'P1', opciones: ['si'] }], respondidaEn: '2026-11-11T10:00:00Z' };

function montar(rutas: Record<string, () => Response>) {
  const peticiones: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      const metodo = (init?.method ?? 'GET').toUpperCase();
      const ruta = url.split('?')[0] ?? url;
      peticiones.push({ metodo, ruta, cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
      const respuesta = rutas[`${metodo} ${ruta}`];
      return Promise.resolve(respuesta ? respuesta() : json({ status: 404, codigo: 'no-encontrado', detail: 'Sin simular.' }, 404));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter initialEntries={['/empresas/v1/evaluaciones/ev1']}>
          <Routes>
            <Route path="/empresas/:vinculoId/evaluaciones/:id" element={<PaginaEvaluacion />} />
            <Route path="/expediente/:id" element={<p>Mi revisión</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return peticiones;
}

afterEach(() => reiniciarCliente());

describe('PaginaEvaluacion del tercero (CE-4)', () => {
  it('muestra el cuestionario sin puntajes, deja enviarlo y luego solo confirma el envío sin resultado', async () => {
    const usuario = userEvent.setup();
    let enviada = false;
    const peticiones = montar({
      'GET /public/v1/vinculos': () => json([VINCULO]),
      'GET /public/v1/vinculos/v1/evaluaciones/ev1': () => json(enviada ? ENVIADA : PENDIENTE),
      'POST /public/v1/vinculos/v1/evaluaciones/ev1/visibilidad': () => json({ preguntas: ['P1'], secciones: ['S1'] }),
      'POST /public/v1/vinculos/v1/evaluaciones/ev1/responder': () => {
        enviada = true;
        return json(ENVIADA);
      },
    });

    expect(await screen.findByRole('heading', { name: 'Autoevaluación de proveedor' })).toBeInTheDocument();
    expect(await screen.findByText('Evaluación pedida por Aceros del Norte')).toBeInTheDocument();
    expect(screen.getByText('Cuéntanos cómo trabajas.')).toBeInTheDocument();
    expect(screen.getByText('¿Tiene certificación ISO 9001?')).toBeInTheDocument();
    // El tercero nunca ve el puntaje ni el umbral.
    expect(screen.queryByText(/puntaje|umbral|eliminatori/i)).not.toBeInTheDocument();

    const enviar = screen.getByRole('button', { name: 'Enviar evaluación' });
    expect(enviar).toBeDisabled();
    await usuario.click(screen.getByRole('radio', { name: 'Sí' }));
    await waitFor(() => expect(enviar).toBeEnabled());
    await usuario.click(enviar);

    expect(await screen.findByText('Enviaste tu evaluación')).toBeInTheDocument();
    expect(screen.getByText(/Aceros del Norte recibió tus respuestas el/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar evaluación' })).not.toBeInTheDocument();
    expect(screen.queryByText(/aprobada|reprobada|puntaje/i)).not.toBeInTheDocument();
    expect(peticiones.find((p) => p.ruta.endsWith('/responder'))?.cuerpo).toEqual({ respuestas: [{ pregunta: 'P1', opciones: ['si'] }] });
    expect(screen.getByRole('link', { name: 'Volver a mi revisión' })).toHaveAttribute('href', '/expediente/exp1');
  });

  it('una evaluación ya enviada solo muestra la confirmación', async () => {
    montar({
      'GET /public/v1/vinculos': () => json([VINCULO]),
      'GET /public/v1/vinculos/v1/evaluaciones/ev1': () => json(ENVIADA),
    });

    expect(await screen.findByText('Enviaste tu evaluación')).toBeInTheDocument();
    expect(screen.queryByText('¿Tiene certificación ISO 9001?')).not.toBeInTheDocument();
  });

  it('una evaluación que no es del tercero (404) se muestra como no encontrada', async () => {
    montar({
      'GET /public/v1/vinculos': () => json([VINCULO]),
      'GET /public/v1/vinculos/v1/evaluaciones/ev1': () => json({ status: 404, codigo: 'evaluacion-no-encontrada', detail: 'No encontramos la evaluación.' }, 404),
    });

    expect(await screen.findByText('No encontramos esa evaluación')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a Mis empresas' })).toHaveAttribute('href', '/empresas');
  });
});
