import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AtributoPermitidoDto, CondicionDto } from '@validasoft/api-client';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { montarPantalla } from '../../../pruebas/montar';
import { atajoDe, condicionDesdeAtributo } from '../condiciones';
import { CondicionDeAtributo } from './CondicionDeAtributo';
import { SelectorDeCondicion } from './SelectorDeCondicion';

const ATRIBUTOS: AtributoPermitidoDto[] = [
  { clave: 'nivelRiesgo', tipo: 'Opcion', obligatorio: false, opciones: ['Bajo', 'Medio', 'Alto'] },
  { clave: 'categorias', tipo: 'ListaOpciones', obligatorio: false, opciones: ['Materiales', 'Servicios'] },
  { clave: 'montoEstimado', tipo: 'Numero', obligatorio: false, opciones: null },
  { clave: 'critico', tipo: 'Booleano', obligatorio: false, opciones: null },
];

const predicado = (atributo: string, operador: string, ...valores: string[]): CondicionDto => ({ tipo: 'Predicado', nodos: null, atributo, operador, valores });

/** El selector de «Se pide a» con su editor de atributo debajo, como los arma `EditorRequisitos`. */
function Caso({ inicial = null, atributos = ATRIBUTOS }: { inicial?: CondicionDto | null; atributos?: readonly AtributoPermitidoDto[] }) {
  const [condicion, setCondicion] = useState<CondicionDto | null>(inicial);
  return (
    <>
      <SelectorDeCondicion
        etiqueta="Se pide a"
        condicion={condicion}
        onCambiar={setCondicion}
        deshabilitado={false}
        textoDe={(a) => i18n.t(`flujos.editor.requisitos.atajos.${a}`)}
        atributos={atributos}
      />
      {condicion && atajoDe(condicion) === 'atributo' && (
        <CondicionDeAtributo condicion={condicion} atributos={atributos} onCambiar={setCondicion} deshabilitado={false} resumen={(c) => `Se pide cuando ${c}.`} />
      )}
      <output data-testid="condicion">{JSON.stringify(condicion)}</output>
    </>
  );
}

const condicion = () => JSON.parse(screen.getByTestId('condicion').textContent) as CondicionDto | null;

async function elegir(usuario: ReturnType<typeof userEvent.setup>, campo: string, opcion: string) {
  await usuario.click(screen.getByRole('combobox', { name: campo }));
  await usuario.click(await screen.findByRole('option', { name: opcion }));
}

describe('«Se pide a» según un atributo del vínculo', () => {
  it('ofrece el atajo solo si el tipo de vínculo del flujo tiene atributos', async () => {
    const usuario = userEvent.setup();
    const { unmount } = montarPantalla(<Caso />);
    await usuario.click(screen.getByRole('combobox', { name: 'Se pide a' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todos',
      'Solo personas jurídicas',
      'Solo personas naturales',
      'Según la ficha del tercero',
      'Según un atributo del vínculo',
    ]);
    unmount();

    montarPantalla(<Caso atributos={[]} />);
    await usuario.click(screen.getByRole('combobox', { name: 'Se pide a' }));
    expect(within(screen.getByRole('listbox')).queryByRole('option', { name: 'Según un atributo del vínculo' })).not.toBeInTheDocument();
  });

  it('al elegirlo arranca con el primer atributo y arma la condición con el valor elegido de la lista de opciones', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso />);

    await elegir(usuario, 'Se pide a', 'Según un atributo del vínculo');
    expect(condicion()).toEqual(predicado('vinculo.atributos.nivelRiesgo', 'Igual'));
    expect(screen.getByRole('combobox', { name: 'Atributo del vínculo' })).toHaveTextContent('nivelRiesgo');
    expect(screen.getByRole('combobox', { name: 'Se cumple cuando' })).toHaveTextContent('es');
    expect(screen.getByText(/Completa el valor/)).toBeInTheDocument();

    await elegir(usuario, 'Valor', 'Alto');
    expect(condicion()).toEqual(predicado('vinculo.atributos.nivelRiesgo', 'Igual', 'Alto'));
    // Dicha en una frase: «Se pide cuando nivelRiesgo es Alto».
    expect(screen.getByText('Se pide cuando nivelRiesgo es Alto.')).toBeInTheDocument();
  });

  it('ofrece los operadores del tipo del atributo y al cambiar de atributo borra los valores', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeAtributo({ clave: 'nivelRiesgo', modo: 'esUnoDe', valores: ['Alto', 'Medio'] })} />);

    // Una condición simple sobre un atributo se reconoce como este atajo, no como «personalizada».
    expect(screen.getByRole('combobox', { name: 'Se pide a' })).toHaveTextContent('Según un atributo del vínculo');
    await usuario.click(screen.getByRole('combobox', { name: 'Se cumple cuando' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'es',
      'no es',
      'es uno de',
      'no es ninguno de',
      'tiene valor',
      'no tiene valor',
    ]);
    await usuario.keyboard('{Escape}');

    await elegir(usuario, 'Atributo del vínculo', 'montoEstimado');
    expect(condicion()).toEqual(predicado('vinculo.atributos.montoEstimado', 'Igual'));
    await usuario.click(screen.getByRole('combobox', { name: 'Se cumple cuando' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'es',
      'no es',
      'es mayor que',
      'es menor que',
      'está entre',
      'tiene valor',
      'no tiene valor',
    ]);
  });

  it('un número se escribe con punto decimal (solo dígitos, punto y signo) y «entre» pide dos valores', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeAtributo({ clave: 'montoEstimado', modo: 'mayor', valores: [] })} />);

    await usuario.type(screen.getByRole('textbox', { name: 'Valor' }), '1a5.5');
    expect(condicion()).toEqual(predicado('vinculo.atributos.montoEstimado', 'Mayor', '15.5'));

    await elegir(usuario, 'Se cumple cuando', 'está entre');
    // Al pasar a «entre» se conserva el primer valor y falta el segundo.
    expect(screen.getByRole('textbox', { name: 'Desde' })).toHaveValue('15.5');
    expect(screen.getByText(/Completa el valor/)).toBeInTheDocument();
    await usuario.type(screen.getByRole('textbox', { name: 'Hasta' }), '20');
    expect(condicion()).toEqual(predicado('vinculo.atributos.montoEstimado', 'Entre', '15.5', '20'));
    expect(screen.queryByText(/Completa el valor/)).not.toBeInTheDocument();
  });

  it('un atributo de varias opciones se compara con «incluye alguno de» y la negación se guarda como «No»', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeAtributo({ clave: 'categorias', modo: 'alguno', valores: [] })} />);

    await usuario.click(screen.getByRole('combobox', { name: 'Valores' }));
    await usuario.click(await screen.findByRole('option', { name: 'Servicios' }));
    expect(condicion()).toEqual(predicado('vinculo.atributos.categorias', 'ContieneAlguno', 'Servicios'));

    await elegir(usuario, 'Se cumple cuando', 'no incluye ninguno de');
    expect(condicion()).toEqual({ tipo: 'No', nodos: [predicado('vinculo.atributos.categorias', 'ContieneAlguno', 'Servicios')], atributo: null, operador: null, valores: null });
    expect(atajoDe(condicion())).toBe('atributo');
  });

  it('un sí/no se elige y «tiene valor» no pide valores', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeAtributo({ clave: 'critico', modo: 'es', valores: [] })} />);

    await elegir(usuario, 'Valor', 'Sí');
    expect(condicion()).toEqual(predicado('vinculo.atributos.critico', 'Igual', 'true'));
    await elegir(usuario, 'Se cumple cuando', 'tiene valor');
    expect(condicion()).toEqual(predicado('vinculo.atributos.critico', 'Existe'));
    expect(screen.queryByRole('combobox', { name: 'Valor' })).not.toBeInTheDocument();
  });

  it('una combinación de condiciones sigue siendo «personalizada» y no dibuja el editor del atributo', () => {
    montarPantalla(<Caso inicial={{ tipo: 'Y', nodos: [predicado('vinculo.atributos.nivelRiesgo', 'Igual', 'Alto'), predicado('tercero.pais', 'Igual', 'CO')] }} />);

    expect(screen.getByRole('combobox', { name: 'Se pide a' })).toHaveTextContent('Condición personalizada');
    expect(screen.queryByRole('combobox', { name: 'Atributo del vínculo' })).not.toBeInTheDocument();
  });

  it('un atributo que el tipo de vínculo ya no tiene se ve avisado pero no se pierde la condición', () => {
    montarPantalla(<Caso inicial={condicionDesdeAtributo({ clave: 'viejo', modo: 'es', valores: ['x'] })} />);

    expect(screen.getByRole('combobox', { name: 'Atributo del vínculo' })).toHaveTextContent('viejo (el tipo de vínculo ya no lo tiene)');
    expect(condicion()).toEqual(predicado('vinculo.atributos.viejo', 'Igual', 'x'));
  });
});
