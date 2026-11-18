import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type FuentesOficialesConfigDto } from '@avalasoft/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { problema, renderizar, simularApi, type LlamadaApi } from '../../cumplimiento/pruebasApi';
import { configDeFuentes } from '../../fuentesOficiales/datosPrueba';
import { PaginaFuentesOficiales } from './PaginaFuentesOficiales';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

vi.setConfig({ testTimeout: 60_000 });

const RUTA = '/api/v1/configuracion/fuentes-oficiales';
const ADMIN = new Set<string>([SCOPES.configuracionLeer, SCOPES.configuracionEscribir]);

function montar(scopes: Set<string> = ADMIN, inicial: FuentesOficialesConfigDto = configDeFuentes(), manejadores: Record<string, (llamada: LlamadaApi) => unknown> = {}): LlamadaApi[] {
  permisos.scopes = scopes;
  const llamadas = simularApi({ [`GET ${RUTA}`]: () => inicial, ...manejadores });
  renderizar(<PaginaFuentesOficiales />, '/e/emp/fuentes-oficiales');
  return llamadas;
}

const guardados = (llamadas: LlamadaApi[]) => llamadas.filter((l) => l.metodo === 'PUT');

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
});

describe('Configuración › Fuentes oficiales (FO-5, FO-7)', () => {
  it('sin configuracion:leer dice que no hay acceso y no pide nada', () => {
    const llamadas = montar(new Set());

    expect(screen.getByRole('alert')).toHaveTextContent('Fuentes oficiales');
    expect(llamadas).toHaveLength(0);
  });

  it('muestra cada fuente con el proveedor que se usará, cuáles hay y si están disponibles', async () => {
    montar();

    const rues = within(await screen.findByRole('region', { name: 'RUES' }));
    expect(rues.getByText('Se consulta con Simulado (pruebas).')).toBeInTheDocument();
    expect(rues.getByRole('region', { name: 'Datos abiertos de Confecámaras' })).toBeInTheDocument();
    expect(rues.getByRole('region', { name: 'API contratada' })).toBeInTheDocument();
    expect(within(rues.getByRole('region', { name: 'Simulado (pruebas)' })).getByText('Disponible')).toBeInTheDocument();
    expect(within(rues.getByRole('region', { name: 'API contratada' })).getByText('No disponible')).toBeInTheDocument();
    const dian = within(screen.getByRole('region', { name: 'DIAN' }));
    expect(dian.queryByRole('region', { name: 'Datos abiertos de Confecámaras' })).not.toBeInTheDocument();
    expect(screen.getByText(/Nada se consulta por scraping/)).toBeInTheDocument();
  });

  it('elegir proveedor envía la elección de esa fuente; uno que la instalación no habilitó no se puede elegir', async () => {
    const llamadas = montar(ADMIN, configDeFuentes(), { [`PUT ${RUTA}`]: () => configDeFuentes() });

    const rues = within(await screen.findByRole('region', { name: 'RUES' }));
    await userEvent.click(rues.getByRole('combobox', { name: 'Proveedor' }));
    expect(screen.getByRole('option', { name: /Datos abiertos de Confecámaras · no habilitado/ })).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('option', { name: 'Simulado (pruebas)' }));

    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(1));
    expect(guardados(llamadas)[0]?.cuerpo).toEqual({ elecciones: [{ fuente: 'Rues', proveedor: 'Simulado' }] });
  });

  it('las credenciales propias van con la clave solo si se escribió, nunca se muestran y se pueden quitar', async () => {
    const conCuenta = configDeFuentes();
    const contrato = conCuenta.fuentes[1]!.proveedores[0]!;
    conCuenta.fuentes[1]!.proveedores[0] = { ...contrato, credencialesPropias: true, usuario: 'convenio-dian', ultimosCuatroClave: '7788', urlBase: 'https://api.proveedor.example/', notas: 'Contrato 2026' };
    const llamadas = montar(ADMIN, conCuenta, { [`PUT ${RUTA}`]: () => conCuenta });

    const cuenta = within(within(await screen.findByRole('region', { name: 'DIAN' })).getByRole('region', { name: 'API contratada' }));
    expect(cuenta.getByText('Clave configurada · …7788')).toBeInTheDocument();
    expect(cuenta.getByLabelText('Usuario')).toHaveValue('convenio-dian');
    expect(cuenta.getByLabelText(/Clave o token/)).toHaveValue('');
    expect(screen.queryByDisplayValue('7788')).not.toBeInTheDocument();

    // Sin escribir la clave se conserva la actual (null); con una nueva, se envía.
    await userEvent.click(cuenta.getByRole('button', { name: 'Guardar credenciales' }));
    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(1));
    expect(guardados(llamadas)[0]?.cuerpo).toEqual({
      credenciales: { fuente: 'Dian', proveedor: 'Contrato', usuario: 'convenio-dian', clave: null, urlBase: 'https://api.proveedor.example/', notas: 'Contrato 2026' },
    });
    await userEvent.type(cuenta.getByLabelText(/Clave o token/), 'token-nuevo-9999');
    await userEvent.click(cuenta.getByRole('button', { name: 'Guardar credenciales' }));
    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(2));
    expect((guardados(llamadas)[1]?.cuerpo as { credenciales: { clave: string } }).credenciales.clave).toBe('token-nuevo-9999');

    await userEvent.click(cuenta.getByRole('button', { name: 'Quitar credenciales' }));
    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(3));
    expect(guardados(llamadas)[2]?.cuerpo).toEqual({ credenciales: { fuente: 'Dian', proveedor: 'Contrato', clave: '' } });
  });

  it('un error de validación de la API se muestra en español junto al formulario', async () => {
    montar(ADMIN, configDeFuentes(), { [`PUT ${RUTA}`]: () => problema(422, 'url-invalida') });

    const cuenta = within(within(await screen.findByRole('region', { name: 'DIAN' })).getByRole('region', { name: 'API contratada' }));
    await userEvent.type(cuenta.getByLabelText(/URL del contrato/), 'http://inseguro.example');
    await userEvent.click(cuenta.getByRole('button', { name: 'Guardar credenciales' }));

    expect(await cuenta.findByText('La dirección debe empezar por https://.')).toBeInTheDocument();
  });

  it('la reconsulta periódica es opcional: vacía la apaga y un valor la enciende', async () => {
    const llamadas = montar(ADMIN, configDeFuentes({ diasMonitoreo: 45 }), { [`PUT ${RUTA}`]: () => configDeFuentes({ diasMonitoreo: 90 }) });

    const tarjeta = within(await screen.findByRole('region', { name: 'Reconsulta periódica de los vínculos activos' }));
    const campo = tarjeta.getByLabelText('Reconsultar cada (días)');
    expect(campo).toHaveValue('45');
    await userEvent.clear(campo);
    await userEvent.type(campo, '90');
    await userEvent.click(tarjeta.getByRole('button', { name: 'Guardar reconsulta' }));
    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(1));
    expect(guardados(llamadas)[0]?.cuerpo).toEqual({ diasMonitoreo: 90 });

    await userEvent.clear(campo);
    await userEvent.click(tarjeta.getByRole('button', { name: 'Guardar reconsulta' }));
    await vi.waitFor(() => expect(guardados(llamadas)).toHaveLength(2));
    expect(guardados(llamadas)[1]?.cuerpo).toEqual({ diasMonitoreo: 0 });
  });

  it('sin configuracion:escribir se ve todo pero no se cambia nada', async () => {
    montar(new Set([SCOPES.configuracionLeer]));

    const rues = within(await screen.findByRole('region', { name: 'RUES' }));
    expect(rues.getByRole('combobox', { name: 'Proveedor' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Guardar credenciales' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar reconsulta' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Reconsultar cada (días)')).toBeDisabled();
  });
});
