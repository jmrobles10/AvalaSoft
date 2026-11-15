import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type GrupoDeAccesoDto } from '@validasoft/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { simularApi, type ManejadorSimulado } from '../../../pruebas/simularApi';
import { useAvisos } from '../../../shared/useAvisos';
import { PaginaGruposDeAcceso } from './PaginaGruposDeAcceso';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const RUTA = '/api/v1/grupos-de-acceso';

const predefinido = (rol: string, nombre: string, permisosDelRol: string[], usuarios: number): GrupoDeAccesoDto => ({
  id: `p-${rol}`,
  codigo: rol.toUpperCase(),
  nombre,
  descripcion: null,
  activo: true,
  predefinido: true,
  rol,
  permisos: permisosDelRol,
  sectores: [],
  usuarios,
  creadoEn: null,
  actualizadoEn: null,
});

const TESORERIA: GrupoDeAccesoDto = {
  id: 'g-tesoreria',
  codigo: 'TESORERIA',
  nombre: 'Tesorería',
  descripcion: 'Aprueba cuentas',
  activo: true,
  predefinido: false,
  rol: null,
  permisos: ['expedientes:leer', 'expedientes:revisar', 'cuentas:aprobar'],
  sectores: [
    { sector: 'FICHA_TRIBUTARIA', nivel: 'Ver' },
    { sector: 'FICHA_GENERAL', nivel: 'Editar' },
  ],
  usuarios: 3,
  creadoEn: '2026-11-14T10:00:00Z',
  actualizadoEn: null,
};

const ANTIGUO: GrupoDeAccesoDto = { ...TESORERIA, id: 'g-antiguo', codigo: 'ANTIGUO', nombre: 'Grupo antiguo', activo: false, sectores: [], usuarios: 0 };

const LISTA = [predefinido('Administrador', 'Administrador', Object.values(SCOPES).filter((s) => s !== 'plataforma:tenants'), 1), predefinido('Revisor', 'Revisor', ['expedientes:leer'], 4), TESORERIA, ANTIGUO];

function montar(extra: Record<string, ManejadorSimulado> = {}) {
  const peticiones = simularApi({ [`GET ${RUTA}`]: LISTA, ...extra });
  montarPantalla(<PaginaGruposDeAcceso />);
  return peticiones;
}

const conPermisos = (...scopes: string[]) => (permisos.scopes = new Set(scopes));

async function filaDe(texto: string) {
  const fila = (await screen.findByText(texto)).closest('tr');
  if (!fila) throw new Error(`sin fila para ${texto}`);
  return fila;
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  useAvisos.getState().cerrar();
  vi.restoreAllMocks();
});

describe('Grupos de acceso', () => {
  it('sin usuarios:administrar dice que no hay acceso y no pide nada', () => {
    const peticiones = montar();
    expect(screen.getByRole('alert')).toHaveTextContent('Grupos de acceso');
    expect(peticiones).toHaveLength(0);
  });

  it('lista los roles fijos como predefinidos y los grupos propios con sus sectores, permisos y personas', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    montar();

    const admin = await filaDe('Administrador');
    expect(within(admin).getByText('Predefinido')).toBeInTheDocument();
    expect(within(admin).getByText('Todos los permisos')).toBeInTheDocument();
    expect(within(admin).getByText('Todos los sectores')).toBeInTheDocument();

    const tesoreria = await filaDe('Tesorería');
    expect(within(tesoreria).queryByText('Predefinido')).not.toBeInTheDocument();
    expect(within(tesoreria).getByText('3 permisos')).toBeInTheDocument();
    expect(within(tesoreria).getByText('Información general (editar), Información tributaria (ver)')).toBeInTheDocument();
    expect(within(tesoreria).getByText('3')).toBeInTheDocument();
    expect(within(await filaDe('Grupo antiguo')).getByText('Desactivado')).toBeInTheDocument();
  });

  it('un predefinido solo se ve: sin editar ni desactivar, y su drawer no deja cambiar nada', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    montar();
    const usuario = userEvent.setup();

    await usuario.click(within(await filaDe('Revisor')).getByRole('button'));
    expect(screen.queryByRole('menuitem', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Desactivar/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('menuitem', { name: 'Ver permisos' }));

    const drawer = await screen.findByRole('dialog', { name: /Permisos del grupo/ });
    expect(within(drawer).getByText(/uno de los cuatro roles fijos/)).toBeInTheDocument();
    expect(within(drawer).getByRole('textbox', { name: /Nombre/ })).toBeDisabled();
    expect(within(drawer).queryByRole('button', { name: 'Guardar grupo' })).not.toBeInTheDocument();
  });

  it('crea un grupo con permisos y sectores y lo envía con POST; el permiso de abrir sesiones del tercero no se ofrece', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    const peticiones = montar({ [`POST ${RUTA}`]: { ...TESORERIA, id: 'nuevo' } });
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo grupo' }));
    const drawer = await screen.findByRole('dialog', { name: /Nuevo grupo de acceso/ });
    expect(within(drawer).queryByText('sesiones-tercero:crear')).not.toBeInTheDocument();
    expect(within(drawer).getByText('expedientes:leer')).toBeInTheDocument();

    // Sin nada: avisa y no envía.
    await usuario.click(within(drawer).getByRole('button', { name: 'Crear grupo' }));
    expect(within(drawer).getByText(/El código empieza con una letra/)).toBeInTheDocument();
    expect(within(drawer).getByText('Escribe el nombre del grupo.')).toBeInTheDocument();
    expect(within(drawer).getByText('Elige al menos un permiso.')).toBeInTheDocument();
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false);

    await usuario.type(within(drawer).getByRole('textbox', { name: /Código/ }), 'tesoreria pagos');
    expect(within(drawer).getByRole('textbox', { name: /Código/ })).toHaveValue('TESORERIA_PAGOS');
    await usuario.type(within(drawer).getByRole('textbox', { name: /Nombre/ }), 'Tesorería y pagos');
    await usuario.click(within(drawer).getByRole('checkbox', { name: /Leer terceros/ }));
    await usuario.click(within(drawer).getByRole('checkbox', { name: /Información tributaria/ }));
    await usuario.click(within(drawer).getByRole('combobox', { name: 'Qué puede hacer en Información tributaria' }));
    await usuario.click(await screen.findByRole('option', { name: 'Ver y decidir' }));
    await usuario.click(within(drawer).getByRole('button', { name: 'Crear grupo' }));

    await waitFor(() => expect(peticiones.some((p) => p.metodo === 'POST')).toBe(true));
    const post = peticiones.find((p) => p.metodo === 'POST');
    expect(post?.ruta).toBe(RUTA);
    expect(post?.cuerpo).toEqual({
      codigo: 'TESORERIA_PAGOS',
      nombre: 'Tesorería y pagos',
      descripcion: null,
      permisos: ['terceros:leer'],
      sectores: [{ sector: 'FICHA_TRIBUTARIA', nivel: 'Editar' }],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Grupo creado.')).toBeInTheDocument();
  });

  it('edita un grupo propio con PUT, con el código fijo y los sectores que ya tenía', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    const peticiones = montar({ [`PUT ${RUTA}/g-tesoreria`]: TESORERIA });
    const usuario = userEvent.setup();

    await usuario.click(within(await filaDe('Tesorería')).getByRole('button'));
    await usuario.click(screen.getByRole('menuitem', { name: 'Editar grupo' }));
    const drawer = await screen.findByRole('dialog', { name: /Editar grupo de acceso/ });
    expect(within(drawer).queryByRole('textbox', { name: /Código/ })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('checkbox', { name: /Información general/ })).toBeChecked();
    expect(within(drawer).getByRole('combobox', { name: 'Qué puede hacer en Información general' })).toHaveTextContent('Ver y decidir');
    expect(within(drawer).getByRole('button', { name: 'Guardar grupo' })).toBeDisabled();

    await usuario.clear(within(drawer).getByRole('textbox', { name: /Nombre/ }));
    await usuario.type(within(drawer).getByRole('textbox', { name: /Nombre/ }), 'Tesorería y cartera');
    await usuario.click(within(drawer).getByRole('button', { name: 'Guardar grupo' }));

    await waitFor(() => expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(true));
    expect(peticiones.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({
      nombre: 'Tesorería y cartera',
      descripcion: 'Aprueba cuentas',
      permisos: ['expedientes:leer', 'expedientes:revisar', 'cuentas:aprobar'],
      sectores: [
        { sector: 'FICHA_GENERAL', nivel: 'Editar' },
        { sector: 'FICHA_TRIBUTARIA', nivel: 'Ver' },
      ],
    });
  });

  it('desactiva con confirmación y reactiva un grupo desactivado', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    const peticiones = montar({ [`POST ${RUTA}/g-tesoreria/desactivar`]: { ...TESORERIA, activo: false }, [`POST ${RUTA}/g-antiguo/reactivar`]: { ...ANTIGUO, activo: true } });
    const usuario = userEvent.setup();

    await usuario.click(within(await filaDe('Tesorería')).getByRole('button'));
    await usuario.click(screen.getByRole('menuitem', { name: 'Desactivar' }));
    const confirmacion = await screen.findByRole('dialog', { name: /Desactivar «Tesorería»/ });
    expect(within(confirmacion).getByText(/dejan de recibir sus permisos/)).toBeInTheDocument();
    await usuario.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/g-tesoreria/desactivar'))).toBe(true));
    expect(await screen.findByText('Grupo desactivado.')).toBeInTheDocument();

    await usuario.click(within(await filaDe('Grupo antiguo')).getByRole('button'));
    await usuario.click(screen.getByRole('menuitem', { name: 'Reactivar' }));
    await usuario.click(within(await screen.findByRole('dialog', { name: /Reactivar «Grupo antiguo»/ })).getByRole('button', { name: 'Reactivar' }));
    await waitFor(() => expect(peticiones.some((p) => p.url.endsWith('/g-antiguo/reactivar'))).toBe(true));
  });

  it('filtra por nombre o código y por estado', async () => {
    conPermisos(SCOPES.usuariosAdministrar);
    montar();
    const usuario = userEvent.setup();

    await filaDe('Tesorería');
    await usuario.type(screen.getByRole('searchbox'), 'antig');
    expect(screen.queryByText('Tesorería')).not.toBeInTheDocument();
    expect(screen.getByText('Grupo antiguo')).toBeInTheDocument();
    await usuario.clear(screen.getByRole('searchbox'));
    await usuario.type(screen.getByRole('searchbox'), 'inexistente');
    expect(await screen.findByText('Ningún grupo coincide con esa búsqueda.')).toBeInTheDocument();
  });
});
