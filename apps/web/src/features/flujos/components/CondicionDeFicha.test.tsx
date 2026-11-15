import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CampoDeFichaDto, CondicionDto } from '@validasoft/api-client';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { ProblemaSimulado, simularApi, type PeticionSimulada } from '../../../pruebas/simularApi';
import { condicionDesdeFicha } from '../condiciones';
import { CondicionDeFicha } from './CondicionDeFicha';

const CAMPOS: CampoDeFichaDto[] = [
  { ruta: 'ficha.especialidades.especialidades', seccion: 'especialidades', etiqueta: 'Especialidades', tipo: 'ListaOpciones', operadores: ['ContieneAlguno', 'ContieneTodos', 'Existe'], catalogo: 'especialidades', jerarquica: true },
  { ruta: 'ficha.general.ciiu', seccion: 'general', etiqueta: 'Actividad económica (CIIU)', tipo: 'ListaOpciones', operadores: ['ContieneAlguno', 'ContieneTodos', 'Existe'], catalogo: 'actividades-economicas', jerarquica: true },
  { ruta: 'ficha.general.pais', seccion: 'general', etiqueta: 'País del domicilio', tipo: 'Texto', operadores: ['Igual', 'Distinto', 'En', 'NoEn', 'Existe'], catalogo: null, jerarquica: false },
  { ruta: 'ficha.tributaria.responsable_ica', seccion: 'tributaria', etiqueta: 'Responsable del impuesto de industria y comercio', tipo: 'Booleano', operadores: ['Igual', 'Distinto', 'Existe'], catalogo: null, jerarquica: false },
];

const ESPECIALIDADES = [
  { codigo: 'OG', nombre: 'Obra gris', nivel: 1, activo: true },
  { codigo: 'OG.CON', nombre: 'Concretos', padre: 'OG', nivel: 2, activo: true },
  { codigo: 'AC', nombre: 'Acabados', nivel: 1, activo: true },
];

function Caso({ inicial, soloLectura = false }: { inicial: CondicionDto; soloLectura?: boolean }) {
  const [condicion, setCondicion] = useState(inicial);
  return (
    <>
      <CondicionDeFicha condicion={condicion} onCambiar={setCondicion} deshabilitado={soloLectura} />
      <output data-testid="condicion">{JSON.stringify(condicion)}</output>
    </>
  );
}

const condicion = () => JSON.parse(screen.getByTestId('condicion').textContent) as CondicionDto;

const alguno = (...valores: string[]) => condicionDesdeFicha({ campo: 'ficha.especialidades.especialidades', modo: 'alguno', valores });

let peticiones: PeticionSimulada[];

beforeEach(() => {
  peticiones = simularApi({
    'GET /api/v1/flujos/campos-de-ficha': CAMPOS,
    'GET /api/v1/catalogos/especialidades': (p) => {
      const q = new URL(p.url, 'http://localhost').searchParams.get('q')?.toLowerCase() ?? '';
      return { datos: ESPECIALIDADES.filter((e) => !q || e.codigo.toLowerCase().startsWith(q) || e.nombre.toLowerCase().includes(q)), siguiente: null };
    },
    'GET /api/v1/catalogos/actividades-economicas': { datos: [{ codigo: '4111', nombre: 'Construcción de edificios residenciales', nivel: null, activo: true }], siguiente: null },
  });
});

describe('CondicionDeFicha (EF-1)', () => {
  it('ofrece los campos que da la API y los modos del campo elegido; sin valores avisa que falta elegirlos', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={alguno()} />);

    expect(await screen.findByRole('combobox', { name: 'Campo de la ficha' })).toHaveTextContent('Especialidades');
    expect(screen.getByRole('combobox', { name: 'Se cumple cuando' })).toHaveTextContent('incluye alguno de');
    expect(screen.getByText(/Elige al menos un valor/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('combobox', { name: 'Campo de la ficha' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(CAMPOS.map((c) => c.etiqueta));
    await usuario.keyboard('{Escape}');

    await usuario.click(screen.getByRole('combobox', { name: 'Se cumple cuando' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'incluye alguno de',
      'incluye todos',
      'no incluye ninguno de',
      'está declarado',
      'no está declarado',
    ]);
  });

  it('busca en el catálogo por nombre y arma la condición con el código elegido', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={alguno()} />);

    await usuario.type(await screen.findByRole('combobox', { name: 'Valores' }), 'obra');
    await usuario.click(await screen.findByRole('option', { name: 'OG · Obra gris' }));

    expect(condicion()).toEqual(alguno('OG'));
    expect(peticiones.some((p) => p.url.includes('/api/v1/catalogos/especialidades') && p.url.includes('q=obra'))).toBe(true);
    // El valor elegido se ve con su nombre y la ayuda de la jerarquía explica que un grupo cubre lo de abajo.
    expect(await screen.findByText('OG · Obra gris')).toBeInTheDocument();
    expect(screen.getByText(/Un valor de nivel superior cubre los de abajo/)).toBeInTheDocument();
    expect(screen.queryByText(/Elige al menos un valor/)).not.toBeInTheDocument();
  });

  it('muestra con su nombre los valores que ya traía la condición y deja quitar uno', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={alguno('OG', 'AC')} />);

    expect(await screen.findByText('OG · Obra gris')).toBeInTheDocument();
    expect(await screen.findByText('AC · Acabados')).toBeInTheDocument();
    // Quitar un valor es quitar su chip.
    await usuario.click(within(screen.getByText('AC · Acabados').closest<HTMLElement>('.MuiChip-root')!).getByTestId('CancelIcon'));
    expect(condicion()).toEqual(alguno('OG'));
  });

  it('cambiar de campo borra los valores (no valen en otro catálogo) y ajusta el modo a uno que el campo admita', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={alguno('OG')} />);

    await usuario.click(await screen.findByRole('combobox', { name: 'Campo de la ficha' }));
    await usuario.click(await screen.findByRole('option', { name: 'Responsable del impuesto de industria y comercio' }));

    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.tributaria.responsable_ica', modo: 'es', valores: [] }));
    // Un booleano se elige con sí o no, sin buscar nada.
    await usuario.click(screen.getByRole('combobox', { name: 'Valor' }));
    await usuario.click(await screen.findByRole('option', { name: 'Sí' }));
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.tributaria.responsable_ica', modo: 'es', valores: ['true'] }));
  });

  it('«no incluye ninguno de» se guarda como la negación de «incluye alguno» y «está declarado» no pide valores', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={alguno('OG')} />);

    await usuario.click(await screen.findByRole('combobox', { name: 'Se cumple cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'no incluye ninguno de' }));
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.especialidades.especialidades', modo: 'ninguno', valores: ['OG'] }));

    await usuario.click(screen.getByRole('combobox', { name: 'Se cumple cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'está declarado' }));
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.especialidades.especialidades', modo: 'declarado', valores: [] }));
    expect(screen.queryByRole('combobox', { name: 'Valores' })).not.toBeInTheDocument();
  });

  it('con «es» solo deja un valor y al pasar de «es uno de» a «es» conserva el primero', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeFicha({ campo: 'ficha.general.pais', modo: 'esUnoDe', valores: ['CO', 'PE'] })} />);

    await usuario.click(await screen.findByRole('combobox', { name: 'Se cumple cuando' }));
    await usuario.click(await screen.findByRole('option', { name: 'es' }));
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.general.pais', modo: 'es', valores: ['CO'] }));
  });

  it('un campo sin catálogo (el país) se escribe: en mayúsculas y sin espacios', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeFicha({ campo: 'ficha.general.pais', modo: 'esUnoDe', valores: [] })} />);

    await usuario.type(await screen.findByRole('combobox', { name: 'Valores' }), ' pe {Enter}');
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.general.pais', modo: 'esUnoDe', valores: ['PE'] }));
  });

  it('en la actividad económica se puede escribir una división o un grupo que el catálogo no trae', async () => {
    const usuario = userEvent.setup();
    montarPantalla(<Caso inicial={condicionDesdeFicha({ campo: 'ficha.general.ciiu', modo: 'alguno', valores: [] })} />);

    expect(await screen.findByText(/puedes escribir también una división \(2 dígitos\) o un grupo \(3\)/)).toBeInTheDocument();
    await usuario.type(screen.getByRole('combobox', { name: 'Valores' }), '41{Enter}');
    expect(condicion()).toEqual(condicionDesdeFicha({ campo: 'ficha.general.ciiu', modo: 'alguno', valores: ['41'] }));
  });

  it('en solo lectura no deja cambiar nada', async () => {
    montarPantalla(<Caso inicial={alguno('OG')} soloLectura />);

    expect(await screen.findByRole('combobox', { name: 'Campo de la ficha' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('combobox', { name: 'Se cumple cuando' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('combobox', { name: 'Valores' })).toBeDisabled();
  });

  it('si no se pueden cargar los campos lo dice en vez de quedarse vacío', async () => {
    simularApi({ 'GET /api/v1/flujos/campos-de-ficha': new ProblemaSimulado(500, 'error', 'Falló') });
    montarPantalla(<Caso inicial={alguno()} />);

    await waitFor(() => expect(screen.getByText(/No se pudieron cargar los campos de la ficha/)).toBeInTheDocument());
  });

  it('no dibuja nada si la condición no es una comparación simple sobre la ficha', () => {
    const grupo: CondicionDto = { tipo: 'Y', nodos: [alguno('OG'), alguno('AC')] };
    montarPantalla(<Caso inicial={grupo} />);

    expect(screen.queryByRole('combobox', { name: 'Campo de la ficha' })).not.toBeInTheDocument();
  });
});
