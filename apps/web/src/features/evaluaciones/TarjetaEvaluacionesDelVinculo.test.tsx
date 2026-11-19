import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type VinculoDto } from '@validalo/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { simularApi } from '../../pruebas/simularApi';
import { useAvisos } from '../../shared/useAvisos';
import { cuestionario, evaluacion } from './pruebasDeEvaluaciones';
import { TarjetaEvaluacionesDelVinculo } from './TarjetaEvaluacionesDelVinculo';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const vinculo = (estado: VinculoDto['estado'] = 'Activo') => ({ id: 'v1', estado }) as VinculoDto;

const resumen = (cambios: Record<string, unknown> = {}) => ({
  id: 'ev1',
  vinculoId: 'v1',
  expedienteId: null,
  folio: null,
  tercero: { id: 't1', nombre: 'Ferretería El Tornillo', identificacion: 'NIT 900123456-8' },
  cuestionario: 'Evaluación de proveedor nuevo',
  versionCuestionario: 2,
  estado: 'Calificada',
  responde: 'Evaluador',
  efecto: 'Observar',
  motivo: 'Reevaluacion',
  puntaje: 86.5,
  aprobada: true,
  asignadaEn: '2026-11-01T10:00:00Z',
  respondidaEn: '2026-11-02T10:00:00Z',
  vigenteHasta: '2027-11-02T10:00:00Z',
  ...cambios,
});

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  useAvisos.getState().cerrar();
});

describe('TarjetaEvaluacionesDelVinculo (CE-11, CE-12)', () => {
  it('sin permiso de leer evaluaciones no aparece', () => {
    simularApi({});
    const { container } = montarPantalla(<TarjetaEvaluacionesDelVinculo vinculo={vinculo()} empresaId="emp" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lista las evaluaciones del vínculo con su puntaje, origen y vigencia', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer]);
    simularApi({ 'GET /api/v1/evaluaciones': { datos: [resumen()], siguienteCursor: null } });
    montarPantalla(<TarjetaEvaluacionesDelVinculo vinculo={vinculo()} empresaId="emp" />);

    expect(await screen.findByText('Evaluación de proveedor nuevo')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByText('86,5')).toBeInTheDocument();
    expect(screen.getByText(/Reevaluación periódica/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/e/emp/evaluaciones/ev1');
    // Sin permiso de escribir vínculos no se ofrece asignar.
    expect(screen.queryByRole('button', { name: 'Asignar evaluación' })).not.toBeInTheDocument();
  });

  it('asigna un cuestionario publicado a un proveedor que ya existe', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer, SCOPES.vinculosEscribir, SCOPES.cuestionariosLeer]);
    const usuario = userEvent.setup();
    const peticiones = simularApi({
      'GET /api/v1/evaluaciones': { datos: [], siguienteCursor: null },
      'GET /api/v1/cuestionarios': [cuestionario(), cuestionario({ id: 'q9', codigo: 'BORRADOR', nombre: 'Sin publicar', publicada: null })],
      'POST /api/v1/vinculos/v1/evaluaciones': evaluacion({ motivo: 'Manual', efecto: 'Observar' }),
    });
    montarPantalla(<TarjetaEvaluacionesDelVinculo vinculo={vinculo()} empresaId="emp" />);

    expect(await screen.findByText('Este proveedor aún no tiene evaluaciones.')).toBeInTheDocument();
    const asignar = await screen.findByRole('button', { name: 'Asignar evaluación' });
    await waitFor(() => expect(asignar).toBeEnabled());
    await usuario.click(asignar);

    expect(await screen.findByText('Evaluación asignada.')).toBeInTheDocument();
    expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({ cuestionarioId: 'q1' });
  });

  it('un vínculo desvinculado no ofrece asignar', async () => {
    permisos.scopes = new Set([SCOPES.evaluacionesLeer, SCOPES.vinculosEscribir, SCOPES.cuestionariosLeer]);
    simularApi({ 'GET /api/v1/evaluaciones': { datos: [], siguienteCursor: null }, 'GET /api/v1/cuestionarios': [cuestionario()] });
    montarPantalla(<TarjetaEvaluacionesDelVinculo vinculo={vinculo('Desvinculado')} empresaId="emp" />);

    expect(await screen.findByText('Este proveedor aún no tiene evaluaciones.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar evaluación' })).not.toBeInTheDocument();
  });
});
