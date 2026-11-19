import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CondicionDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { simularApi } from '../../../pruebas/simularApi';
import { borradorVacio, type ErrorFlujo } from '../editor';
import { EditorSeleccionFlujo } from './EditorSeleccionFlujo';

const juridica: CondicionDto = { tipo: 'Predicado', nodos: null, atributo: 'tercero.tipoPersona', operador: 'Igual', valores: ['Juridica'] };
const riesgoAlto: CondicionDto = { tipo: 'Predicado', nodos: null, atributo: 'vinculo.atributos.nivelRiesgo', operador: 'En', valores: ['Alto'] };

function montar(cambios: Partial<ReturnType<typeof borradorVacio>> = {}, errores: ErrorFlujo[] = [], soloLectura = false) {
  const onCambiar = vi.fn();
  const borrador = { ...borradorVacio(), ...cambios };
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <EditorSeleccionFlujo borrador={borrador} onCambiar={onCambiar} errores={errores} soloLectura={soloLectura} />
    </ThemeProvider>,
  );
  return { onCambiar, borrador };
}

describe('EditorSeleccionFlujo', () => {
  it('por omisión el flujo no se escoge solo: sin condición ni prioridad, y lo explica', () => {
    montar();
    expect(screen.getByRole('combobox', { name: 'Se escoge cuando' })).toHaveTextContent('Sin condición');
    expect(screen.queryByLabelText('Prioridad')).not.toBeInTheDocument();
    expect(screen.getByText(/solo se usa si lo eligen al abrir el expediente o si es el flujo por defecto/)).toBeInTheDocument();
  });

  it('ofrece los mismos atajos del editor de condiciones de los requisitos', () => {
    montar();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Se escoge cuando' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin condición',
      'El tercero es persona jurídica',
      'El tercero es persona natural',
      'Según la ficha del tercero',
    ]);
  });

  it('elegir «Según la ficha del tercero» arranca con las especialidades, sin valores, y conserva la prioridad', async () => {
    const usuario = userEvent.setup();
    const { onCambiar, borrador } = montar({ seleccionCondicion: juridica, seleccionPrioridad: '3' });

    await usuario.click(screen.getByRole('combobox', { name: 'Se escoge cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'Según la ficha del tercero' }));
    expect(onCambiar).toHaveBeenLastCalledWith({
      ...borrador,
      seleccionCondicion: { tipo: 'Predicado', nodos: null, atributo: 'ficha.especialidades.especialidades', operador: 'ContieneAlguno', valores: [] },
      seleccionPrioridad: '3',
    });
  });

  it('elegir «persona jurídica» arma la condición y pide la prioridad', async () => {
    const usuario = userEvent.setup();
    const { onCambiar, borrador } = montar();

    await usuario.click(screen.getByRole('combobox', { name: 'Se escoge cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'El tercero es persona jurídica' }));
    expect(onCambiar).toHaveBeenLastCalledWith({ ...borrador, seleccionCondicion: juridica, seleccionPrioridad: '' });
  });

  it('con condición muestra la prioridad (solo dígitos) y su ayuda', () => {
    const { onCambiar, borrador } = montar({ seleccionCondicion: juridica, seleccionPrioridad: '2' });
    expect(screen.getByRole('textbox', { name: 'Prioridad' })).toHaveValue('2');
    expect(screen.getByText('1 a 999; la menor se evalúa primero y no se repite en el tipo.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Prioridad'), { target: { value: '1x5' } });
    expect(onCambiar).toHaveBeenLastCalledWith({ ...borrador, seleccionPrioridad: '15' });
  });

  it('volver a «Sin condición» quita también la prioridad', async () => {
    const usuario = userEvent.setup();
    const { onCambiar, borrador } = montar({ seleccionCondicion: juridica, seleccionPrioridad: '2' });

    await usuario.click(screen.getByRole('combobox', { name: 'Se escoge cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'Sin condición' }));
    expect(onCambiar).toHaveBeenLastCalledWith({ ...borrador, seleccionCondicion: null, seleccionPrioridad: '' });
  });

  it('una condición armada por la API se describe, se conserva y no se ofrece como atajo nuevo', () => {
    const { onCambiar } = montar({ seleccionCondicion: { tipo: 'Y', nodos: [riesgoAlto, juridica] }, seleccionPrioridad: '1' });
    expect(screen.getByRole('combobox', { name: 'Se escoge cuando' })).toHaveTextContent('Condición personalizada');
    expect(screen.getByText('Se escoge cuando nivelRiesgo es uno de Alto y tipo de persona es Jurídica.')).toBeInTheDocument();
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('con los atributos del tipo de vínculo ofrece «Según un atributo del vínculo» y arranca con el primero, sin valores', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    const borrador = { ...borradorVacio(), seleccionCondicion: juridica, seleccionPrioridad: '3' };
    montarPantalla(
      <EditorSeleccionFlujo
        borrador={borrador}
        onCambiar={onCambiar}
        errores={[]}
        soloLectura={false}
        atributos={[{ clave: 'nivelRiesgo', tipo: 'Opcion', obligatorio: false, opciones: ['Bajo', 'Alto'] }]}
      />,
    );

    await usuario.click(screen.getByRole('combobox', { name: 'Se escoge cuando' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sin condición',
      'El tercero es persona jurídica',
      'El tercero es persona natural',
      'Según la ficha del tercero',
      'Según un atributo del vínculo',
    ]);
    await usuario.click(screen.getByRole('option', { name: 'Según un atributo del vínculo' }));
    expect(onCambiar).toHaveBeenLastCalledWith({
      ...borrador,
      seleccionCondicion: { tipo: 'Predicado', nodos: null, atributo: 'vinculo.atributos.nivelRiesgo', operador: 'Igual', valores: [] },
      seleccionPrioridad: '3',
    });
  });

  it('una condición simple sobre un atributo del vínculo se reconoce como ese atajo: muestra su constructor y la frase, no «personalizada»', () => {
    montarPantalla(
      <EditorSeleccionFlujo
        borrador={{ ...borradorVacio(), seleccionCondicion: riesgoAlto, seleccionPrioridad: '1' }}
        onCambiar={vi.fn()}
        errores={[]}
        soloLectura={false}
        atributos={[{ clave: 'nivelRiesgo', tipo: 'Opcion', obligatorio: false, opciones: ['Bajo', 'Alto'] }]}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Se escoge cuando' })).toHaveTextContent('Según un atributo del vínculo');
    expect(screen.getByRole('combobox', { name: 'Atributo del vínculo' })).toHaveTextContent('nivelRiesgo');
    expect(screen.getByRole('combobox', { name: 'Se cumple cuando' })).toHaveTextContent('es uno de');
    expect(screen.getByText('Se escoge cuando nivelRiesgo es uno de Alto.')).toBeInTheDocument();
  });

  it('muestra los errores de la prioridad y de la condición en su campo', () => {
    montar({ seleccionCondicion: juridica, seleccionPrioridad: '' }, [
      { codigo: 'prioridad-requerida', campo: 'seleccion.prioridad' },
      { codigo: 'condicion-invalida', campo: 'seleccion.condicion' },
    ]);
    expect(screen.getByText('Escribe la prioridad: sin ella no se sabe en qué orden se evalúa.')).toBeInTheDocument();
    expect(screen.getByText('La condición de selección no es válida para este tipo de vínculo.')).toBeInTheDocument();
  });

  it('la prioridad repetida que responde la API se muestra en el campo', () => {
    montar({ seleccionCondicion: juridica, seleccionPrioridad: '1' }, [{ codigo: 'prioridad-duplicada', campo: 'seleccion.prioridad' }]);
    expect(screen.getByText('Otro flujo de este tipo de vínculo ya usa esa prioridad: elige otra.')).toBeInTheDocument();
  });

  it('en solo lectura (otra versión o sin permiso) no deja cambiar nada', () => {
    montar({ seleccionCondicion: juridica, seleccionPrioridad: '2' }, [], true);
    expect(screen.getByRole('combobox', { name: 'Se escoge cuando' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('textbox', { name: 'Prioridad' })).toBeDisabled();
  });
});

describe('EditorSeleccionFlujo con una condición sobre la ficha del tercero (EF-4)', () => {
  const porEspecialidad: CondicionDto = { tipo: 'Predicado', nodos: null, atributo: 'ficha.especialidades.especialidades', operador: 'ContieneAlguno', valores: ['OG'] };

  beforeEach(() => {
    simularApi({
      'GET /api/v1/flujos/campos-de-ficha': [
        { ruta: 'ficha.especialidades.especialidades', seccion: 'especialidades', etiqueta: 'Especialidades', tipo: 'ListaOpciones', operadores: ['ContieneAlguno', 'ContieneTodos', 'Existe'], catalogo: 'especialidades', jerarquica: true },
      ],
      'GET /api/v1/catalogos/especialidades': { datos: [{ codigo: 'OG', nombre: 'Obra gris', nivel: 1, activo: true }], siguiente: null },
    });
  });

  it('muestra el constructor de la condición, sin la frase de «personalizada», y pide la prioridad', async () => {
    const onCambiar = vi.fn();
    montarPantalla(
      <EditorSeleccionFlujo borrador={{ ...borradorVacio(), seleccionCondicion: porEspecialidad, seleccionPrioridad: '1' }} onCambiar={onCambiar} errores={[]} soloLectura={false} />,
    );

    expect(screen.getByRole('combobox', { name: 'Se escoge cuando' })).toHaveTextContent('Según la ficha del tercero');
    expect(await screen.findByRole('combobox', { name: 'Campo de la ficha' })).toHaveTextContent('Especialidades');
    expect(await screen.findByText('OG · Obra gris')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Prioridad' })).toHaveValue('1');
    expect(screen.queryByText(/Se escoge cuando especialidades/)).not.toBeInTheDocument();
  });

  it('cambiar los valores actualiza la condición del borrador sin tocar la prioridad', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    const borrador = { ...borradorVacio(), seleccionCondicion: porEspecialidad, seleccionPrioridad: '2' };
    montarPantalla(<EditorSeleccionFlujo borrador={borrador} onCambiar={onCambiar} errores={[]} soloLectura={false} />);

    await usuario.click(await screen.findByRole('combobox', { name: 'Se cumple cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'incluye todos' }));
    expect(onCambiar).toHaveBeenLastCalledWith({ ...borrador, seleccionCondicion: { ...porEspecialidad, operador: 'ContieneTodos' } });
  });

  it('el error de la API sobre la condición se muestra en el constructor y no dos veces', async () => {
    montarPantalla(
      <EditorSeleccionFlujo
        borrador={{ ...borradorVacio(), seleccionCondicion: porEspecialidad, seleccionPrioridad: '1' }}
        onCambiar={vi.fn()}
        errores={[{ codigo: 'condicion-invalida', campo: 'seleccion.condicion' }]}
        soloLectura={false}
      />,
    );

    await screen.findByRole('combobox', { name: 'Campo de la ficha' });
    expect(screen.getAllByText('La condición de selección no es válida para este tipo de vínculo.')).toHaveLength(1);
  });
});
