import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CuestionarioDto } from '@validalo/api-client';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { cuestionario } from '../../evaluaciones/pruebasDeEvaluaciones';
import type { EvaluacionEnEditor } from '../editor';
import { EditorEvaluacionesDelFlujo } from './EditorEvaluacionesDelFlujo';

function Caso({ inicial = [], cuestionarios, soloLectura = false }: { inicial?: EvaluacionEnEditor[]; cuestionarios: CuestionarioDto[]; soloLectura?: boolean }) {
  const [evaluaciones, setEvaluaciones] = useState(inicial);
  return (
    <>
      <EditorEvaluacionesDelFlujo evaluaciones={evaluaciones} cuestionarios={cuestionarios} onCambiar={setEvaluaciones} soloLectura={soloLectura} />
      <output data-testid="estado">{JSON.stringify(evaluaciones)}</output>
    </>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent) as EvaluacionEnEditor[];

const PROVEEDOR = cuestionario();
const RIESGO = cuestionario({ id: 'q2', codigo: 'RIESGO', nombre: 'Evaluación de riesgo' });
const BORRADOR = cuestionario({ id: 'q3', codigo: 'SIN-PUBLICAR', nombre: 'Sin publicar', publicada: null });

describe('EditorEvaluacionesDelFlujo (CE-7)', () => {
  it('pide un cuestionario publicado y por omisión bloquea el cierre', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso cuestionarios={[PROVEEDOR, RIESGO, BORRADOR]} />);

    expect(screen.getByText('Este flujo no pide evaluaciones.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Pedir un cuestionario' }));
    expect(estado()).toEqual([{ cuestionarioId: 'q1', efecto: 'Bloquear' }]);
    // El resumen sale del cuestionario: quién responde, umbral y versión publicada.
    expect(screen.getByText('Responde la empresa · umbral 70 · versión 2 publicada')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Pedir un cuestionario' }));
    expect(estado().map((e) => e.cuestionarioId)).toEqual(['q1', 'q2']);
    // Ya no quedan publicados por pedir (el borrador sin publicar nunca se ofrece).
    expect(screen.getByRole('button', { name: 'Pedir un cuestionario' })).toBeDisabled();
    expect(screen.getByText('No hay más cuestionarios publicados para pedir.')).toBeInTheDocument();
  });

  it('cambia qué pasa si reprueba y quita el cuestionario', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso cuestionarios={[PROVEEDOR, RIESGO]} inicial={[{ cuestionarioId: 'q1', efecto: 'Bloquear' }]} />);

    await usuario.click(screen.getByRole('combobox', { name: 'Si reprueba' }));
    await usuario.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Solo dejarlo a la vista' }));
    expect(estado()).toEqual([{ cuestionarioId: 'q1', efecto: 'Observar' }]);

    await usuario.click(screen.getByRole('button', { name: 'Quitar el cuestionario Evaluación de proveedor nuevo del flujo' }));
    expect(estado()).toEqual([]);
  });

  it('un cuestionario que ya no existe se avisa en vez de desaparecer', () => {
    montarPantalla(<Caso cuestionarios={[PROVEEDOR]} inicial={[{ cuestionarioId: 'q-borrado', efecto: 'Observar' }]} />);
    expect(screen.getByRole('combobox', { name: 'Cuestionario' })).toHaveTextContent('Cuestionario que ya no existe');
  });

  it('en solo lectura no deja pedir ni quitar', () => {
    montarPantalla(<Caso cuestionarios={[PROVEEDOR]} inicial={[{ cuestionarioId: 'q1', efecto: 'Bloquear' }]} soloLectura />);
    expect(screen.queryByRole('button', { name: 'Pedir un cuestionario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar el cuestionario/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Si reprueba' })).toHaveAttribute('aria-disabled', 'true');
  });
});
