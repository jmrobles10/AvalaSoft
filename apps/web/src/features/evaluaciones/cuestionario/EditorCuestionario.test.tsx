import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type CuestionarioDto } from '@validasoft/api-client';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { ProblemaSimulado, simularApi } from '../../../pruebas/simularApi';
import { useAvisos } from '../../../shared/useAvisos';
import { cuestionario, DEFINICION } from '../pruebasDeEvaluaciones';
import { EditorCuestionario } from './EditorCuestionario';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));

function abrir() {
  return montarPantalla(
    <Routes>
      <Route path="/e/emp/cuestionarios/:cuestionarioId" element={<EditorCuestionario />} />
    </Routes>,
    '/e/emp/cuestionarios/q1',
  );
}

const conBorrador = (c: CuestionarioDto, texto: string): CuestionarioDto => ({
  ...c,
  borrador: {
    id: 'v3',
    version: 3,
    estado: 'Borrador',
    definicion: { ...DEFINICION, secciones: [{ ...DEFINICION.secciones[0]!, preguntas: DEFINICION.secciones[0]!.preguntas.map((p, i) => (i === 0 ? { ...p, texto } : p)) }] },
    creadaEn: '2026-11-12T10:00:00Z',
    publicadaEn: null,
    retiradaEn: null,
  },
});

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  useAvisos.getState().cerrar();
});

describe('EditorCuestionario (CE-1, CE-2)', () => {
  it('con solo lectura muestra el cuestionario publicado sin acciones de edición', async () => {
    permisos.scopes = new Set([SCOPES.cuestionariosLeer]);
    simularApi({ 'GET /api/v1/cuestionarios/q1': cuestionario() });
    abrir();

    expect(await screen.findByRole('heading', { name: 'Evaluación de proveedor nuevo' })).toBeInTheDocument();
    expect(screen.getByText('PROVEEDOR-NUEVO · Publicada: 2 · Borrador: —')).toBeInTheDocument();
    expect(screen.getByDisplayValue('¿Tiene certificación ISO 9001?')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Editar (nueva versión)' })).not.toBeInTheDocument();
  });

  it('editar la publicada, guardar el borrador y publicarlo: la versión sube y queda congelada', async () => {
    permisos.scopes = new Set([SCOPES.cuestionariosLeer, SCOPES.cuestionariosEscribir]);
    const usuario = userEvent.setup();
    let guardado = false;
    const peticiones = simularApi({
      'GET /api/v1/cuestionarios/q1': () => (guardado ? conBorrador(cuestionario(), '¿Cuenta con certificación ISO 9001 vigente?') : cuestionario()),
      'PUT /api/v1/cuestionarios/q1': () => {
        guardado = true;
        return conBorrador(cuestionario(), '¿Cuenta con certificación ISO 9001 vigente?');
      },
      'POST /api/v1/cuestionarios/q1/publicar': () => cuestionario({ publicada: { ...cuestionario().publicada!, version: 3 } }),
    });
    abrir();

    const editar = await screen.findByRole('button', { name: 'Editar (nueva versión)' });
    expect(screen.getByText(/Al editar se crea el borrador de la versión 3/)).toBeInTheDocument();
    await usuario.click(editar);
    const texto = screen.getAllByRole('textbox', { name: 'Texto de la pregunta' })[0]!;
    await usuario.clear(texto);
    await usuario.type(texto, '¿Cuenta con certificación ISO 9001 vigente?');
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText('Borrador guardado.')).toBeInTheDocument();
    const put = peticiones.find((p) => p.metodo === 'PUT');
    expect(put?.cuerpo).toMatchObject({ nombre: 'Evaluación de proveedor nuevo' });
    expect((put?.cuerpo as { definicion: typeof DEFINICION }).definicion.secciones[0]?.preguntas[0]?.texto).toBe('¿Cuenta con certificación ISO 9001 vigente?');

    await usuario.click(await screen.findByRole('button', { name: 'Publicar versión 3' }));
    expect(await screen.findByText('Publicar la versión 3')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Versión 3 publicada.')).toBeInTheDocument();
    expect(peticiones.some((p) => p.metodo === 'POST' && p.ruta.endsWith('/publicar'))).toBe(true);
  });

  it('no guarda un borrador incompleto: marca lo que falta y no llama a la API', async () => {
    permisos.scopes = new Set([SCOPES.cuestionariosLeer, SCOPES.cuestionariosEscribir]);
    const usuario = userEvent.setup();
    const peticiones = simularApi({ 'GET /api/v1/cuestionarios/q1': cuestionario() });
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar (nueva versión)' }));
    await usuario.clear(screen.getAllByRole('textbox', { name: 'Texto de la pregunta' })[0]!);
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText('Revisa los campos marcados antes de guardar.')).toBeInTheDocument();
    expect(screen.getByText('La pregunta necesita un texto')).toBeInTheDocument();
    expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(false);
  });

  it('el error de la API al guardar se muestra con la pregunta que falla', async () => {
    permisos.scopes = new Set([SCOPES.cuestionariosLeer, SCOPES.cuestionariosEscribir]);
    const usuario = userEvent.setup();
    simularApi({
      'GET /api/v1/cuestionarios/q1': cuestionario(),
      'PUT /api/v1/cuestionarios/q1': new ProblemaSimulado(422, 'cuestionario-invalido', 'Las opciones de la pregunta no suman puntaje.', { pregunta: 'P1' }),
    });
    abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar (nueva versión)' }));
    const texto = screen.getAllByRole('textbox', { name: 'Texto de la pregunta' })[0]!;
    await usuario.type(texto, ' (ISO)');
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() => expect(screen.getAllByText('Pregunta P1: Las opciones de la pregunta no suman puntaje.').length).toBeGreaterThan(0));
  });

  it('un cuestionario de otra empresa (404) se muestra como no encontrado', async () => {
    permisos.scopes = new Set([SCOPES.cuestionariosLeer]);
    simularApi({ 'GET /api/v1/cuestionarios/q1': new ProblemaSimulado(404, 'cuestionario-no-encontrado', 'No encontramos el cuestionario.') });
    abrir();

    expect(await screen.findByText('No encontramos ese cuestionario')).toBeInTheDocument();
  });
});
