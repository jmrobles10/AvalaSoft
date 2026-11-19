import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, type EmpresaDeGrupoDto, type GrupoDto, type SistemaIntegradoDto, type TenantDto, type UsuarioDto } from '@validalo/api-client';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { ProblemaSimulado, simularApi, type PeticionSimulada } from '../../pruebas/simularApi';
import { PaginaFichaGrupo } from './PaginaFichaGrupo';
import { TarjetaGrupo } from './TarjetaGrupo';

afterEach(() => reiniciarCliente());

const TENANT: TenantDto = {
  id: 't1',
  slug: 'grupo-andino',
  nombre: 'Grupo Andino',
  region: 'co',
  plan: 'Inicial',
  zonaHoraria: 'America/Bogota',
  idioma: 'es-CO',
  activo: true,
  creadoEn: '2026-11-09T15:00:00Z',
  ingreso: { modos: ['Delegado', 'Directo'], sesionHoras: 8, inactividadMinutos: 30, passkeyParaTodos: false },
};

const NORTE: EmpresaDeGrupoDto = {
  id: 'e1',
  nombre: 'Constructora Norte S.A.S.',
  identificacion: { pais: 'CO', tipo: 'NIT', numero: '800197268', digitoVerificacion: '4' },
  prefijoFolio: 'NORTE',
  activa: true,
  planIaConfigurado: false,
  planIaActivo: false,
  llaveConfigurada: false,
  ultimosCuatro: null,
};

const GRUPO: GrupoDto = { tenant: TENANT, empresas: [NORTE] };

const SISTEMAS: SistemaIntegradoDto[] = [
  { id: 's1', codigo: 'ERP', nombre: 'ERP de Andina', clavePublicaPem: 'x', activo: true, creadoEn: '2026-11-01T10:00:00Z', origenesPermitidos: ['https://erp.andina.co'] },
];

const CAMILA: UsuarioDto = {
  id: 'u1',
  nombre: 'Camila Admin',
  correo: 'camila@andina.co',
  identificacion: null,
  activo: true,
  identidades: [{ sistemaId: 's1', idExterno: 'camila' }],
  roles: [{ rol: 'Administrador', empresaId: null }],
  creadoEn: '2026-11-09T15:00:00Z',
  ultimoAcceso: '2026-11-10T15:00:00Z',
  exigePasskey: true,
  passkeys: 2,
  invitadoEn: null,
  grupos: [],
};

const DIEGO: UsuarioDto = { ...CAMILA, id: 'u2', nombre: 'Diego Soporte', correo: 'diego@andina.co', activo: false, identidades: [], ultimoAcceso: null, passkeys: 0 };

const NIT = { pais: 'CO', codigo: 'NIT', nombre: 'Número de Identificación Tributaria', aplicaA: 'Ambas', patron: '^[0-9]{6,15}$', tieneDv: true };

function montarFicha(rutas: Parameters<typeof simularApi>[0] = {}, administradores: UsuarioDto[] = [CAMILA, DIEGO], grupo: GrupoDto = GRUPO) {
  const peticiones = simularApi({
    'GET /api/v1/plataforma/grupos/t1': () => grupo,
    'GET /api/v1/plataforma/tenants/t1/administradores': administradores,
    'GET /api/v1/plataforma/tenants/t1/sistemas': SISTEMAS,
    'GET /api/v1/catalogos/paises': [{ codigo: 'CO', nombre: 'Colombia', tiposIdentificacion: [NIT] }],
    ...rutas,
  });
  montarPantalla(
    <Routes>
      <Route path="/plataforma/grupos/:tenantId" element={<PaginaFichaGrupo />} />
    </Routes>,
    '/plataforma/grupos/t1',
  );
  return { peticiones, usuario: userEvent.setup() };
}

const puts = (peticiones: PeticionSimulada[]) => peticiones.filter((p) => p.metodo === 'PUT');
const seccion = (nombre: string) => screen.getByRole('region', { name: nombre });

describe('Ficha del grupo: los datos del alta en solo lectura', () => {
  it('muestra el grupo, sus empresas, sus administradores, cómo entran y sus sistemas, sin ningún campo editable', async () => {
    montarFicha();

    const grupo = await screen.findByRole('region', { name: 'Grupo' });
    expect(within(grupo).getByText('Grupo Andino')).toBeInTheDocument();
    expect(within(grupo).getByText('grupo-andino')).toBeInTheDocument();
    expect(within(grupo).getByText('America/Bogota')).toBeInTheDocument();
    expect(within(grupo).getByText('co')).toBeInTheDocument();
    expect(within(grupo).getByText('Activo')).toBeInTheDocument();

    const empresas = seccion('Empresas');
    expect(within(empresas).getByText('Constructora Norte S.A.S.')).toBeInTheDocument();
    expect(within(empresas).getByText('NORTE')).toBeInTheDocument();

    const administradores = await screen.findByRole('region', { name: 'Administradores' });
    expect(await within(administradores).findByText('Camila Admin')).toBeInTheDocument();
    expect(within(administradores).getByText('camila@andina.co')).toBeInTheDocument();
    expect(within(administradores).getByText('camila')).toBeInTheDocument();
    expect(within(administradores).getByText(/Usuario en ERP/)).toBeInTheDocument();
    expect(within(administradores).getByText(/2 passkeys/)).toBeInTheDocument();
    expect(within(administradores).getByText('Diego Soporte')).toBeInTheDocument();
    expect(within(administradores).getByText('Inactivo')).toBeInTheDocument();
    expect(within(administradores).getByText(/Aún no ha ingresado/)).toBeInTheDocument();

    const ingreso = seccion('Cómo entran sus personas');
    expect(within(ingreso).getByText('Desde el sistema integrado')).toBeInTheDocument();
    expect(within(ingreso).getByText('Directo a Valídalo')).toBeInTheDocument();
    expect(within(ingreso).getByText('8 horas')).toBeInTheDocument();
    expect(within(ingreso).getByText('30 minutos')).toBeInTheDocument();

    const sistemas = seccion('Sistemas integrados');
    expect(await within(sistemas).findByText('ERP de Andina')).toBeInTheDocument();

    // Solo lectura: ningún campo hasta que se pide «Editar».
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cada sección trae su «Editar» y la ficha enlaza de vuelta a la lista y al plan', async () => {
    montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });

    expect(screen.getByRole('button', { name: 'Editar grupo' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Editar a Camila Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar cómo entran' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar la empresa Constructora Norte S.A.S.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Grupos y empresas/ })).toHaveAttribute('href', '/plataforma/grupos');
    expect(screen.getByRole('link', { name: 'Plan y límites' })).toHaveAttribute('href', '/plataforma/grupos/t1/plan');
  });

  it('un error al cargar el grupo ofrece reintentar', async () => {
    const { usuario, peticiones } = montarFicha({ 'GET /api/v1/plataforma/grupos/t1': new ProblemaSimulado(500, 'error-interno', 'Falló') });

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(peticiones.filter((p) => p.ruta === '/api/v1/plataforma/grupos/t1').length).toBeGreaterThan(1));
  });

  it('la tarjeta de la lista de grupos enlaza a la ficha desde el nombre y desde «Ver ficha»', () => {
    simularApi({});
    montarPantalla(<TarjetaGrupo grupo={GRUPO} expandido={false} onAlternar={() => undefined} />);

    expect(screen.getByRole('link', { name: 'Grupo Andino' })).toHaveAttribute('href', '/plataforma/grupos/t1');
    expect(screen.getByRole('link', { name: 'Ver la ficha de Grupo Andino' })).toHaveAttribute('href', '/plataforma/grupos/t1');
  });
});

describe('Ficha del grupo: corregir el grupo', () => {
  it('el identificador se muestra pero no se edita, y la ayuda dice por qué', async () => {
    const { usuario } = montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });
    expect(within(seccion('Grupo')).getByText(/va dentro de cada API key del grupo/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Editar grupo' }));

    const dialogo = await screen.findByRole('dialog', { name: /Editar el grupo/ });
    const identificador = within(dialogo).getByRole('textbox', { name: 'Identificador' });
    expect(identificador).toHaveValue('grupo-andino');
    expect(identificador).toHaveAttribute('readonly');
    await usuario.type(identificador, 'otro');
    expect(identificador).toHaveValue('grupo-andino');
    expect(within(dialogo).getByText(/cambiarlo dejaría sin servir todas las llaves ya emitidas/)).toBeInTheDocument();
  });

  it('guarda nombre, zona y región con un PUT completo, avisa, cierra y vuelve a pedir el grupo', async () => {
    const { peticiones, usuario } = montarFicha({ 'PUT /api/v1/plataforma/tenants/t1': (p) => ({ ...TENANT, ...(p.cuerpo as Record<string, unknown>) }) });
    await screen.findByRole('region', { name: 'Grupo' });
    const cargas = () => peticiones.filter((p) => p.metodo === 'GET' && p.ruta === '/api/v1/plataforma/grupos/t1').length;
    expect(cargas()).toBe(1);

    await usuario.click(screen.getByRole('button', { name: 'Editar grupo' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar el grupo/ });
    const guardar = within(dialogo).getByRole('button', { name: 'Guardar' });
    expect(guardar).toBeDisabled(); // sin cambios no hay nada que guardar
    const nombre = within(dialogo).getByRole('textbox', { name: /Nombre del grupo/ });
    await usuario.clear(nombre);
    await usuario.type(nombre, '  Grupo Andino Constructores ');
    const zona = within(dialogo).getByRole('textbox', { name: 'Zona horaria' });
    await usuario.clear(zona);
    await usuario.type(zona, 'America/Panama');
    const region = within(dialogo).getByRole('textbox', { name: 'Región' });
    await usuario.clear(region);
    await usuario.type(region, 'PA');
    await waitFor(() => expect(guardar).toBeEnabled());
    await usuario.click(guardar);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(puts(peticiones)).toHaveLength(1);
    expect(puts(peticiones)[0]?.ruta).toBe('/api/v1/plataforma/tenants/t1');
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ nombre: 'Grupo Andino Constructores', region: 'pa', zonaHoraria: 'America/Panama' });
    expect(await screen.findByText('Corregiste el grupo Grupo Andino Constructores.')).toBeInTheDocument();
    await waitFor(() => expect(cargas()).toBe(2));
  });

  it('un nombre vacío o una zona que no existe bloquean el guardado y lo dicen', async () => {
    const { peticiones, usuario } = montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });
    await usuario.click(screen.getByRole('button', { name: 'Editar grupo' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar el grupo/ });

    const zona = within(dialogo).getByRole('textbox', { name: 'Zona horaria' });
    await usuario.clear(zona);
    await usuario.type(zona, 'Marte/Olimpo');
    await usuario.tab();
    expect(await within(dialogo).findAllByText('Esa zona horaria no existe. Usa un nombre IANA, como America/Bogota.')).not.toHaveLength(0);
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();

    await usuario.clear(zona);
    await usuario.type(zona, 'America/Bogota');
    const nombre = within(dialogo).getByRole('textbox', { name: /Nombre del grupo/ });
    await usuario.clear(nombre);
    await usuario.tab();
    expect(await within(dialogo).findAllByText('Escribe el nombre del grupo.')).not.toHaveLength(0);
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(puts(peticiones)).toHaveLength(0);
  });

  it('el error de la API se muestra y el diálogo sigue abierto', async () => {
    const { usuario } = montarFicha({ 'PUT /api/v1/plataforma/tenants/t1': new ProblemaSimulado(422, 'zona-horaria-invalida', 'La zona no existe.') });
    await screen.findByRole('region', { name: 'Grupo' });
    await usuario.click(screen.getByRole('button', { name: 'Editar grupo' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar el grupo/ });
    const nombre = within(dialogo).getByRole('textbox', { name: /Nombre del grupo/ });
    await usuario.type(nombre, ' II');

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialogo).findByText('Esa zona horaria no existe. Usa un nombre IANA, como America/Bogota.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Editar el grupo/ })).toBeInTheDocument();
  });
});

describe('Ficha del grupo: corregir al administrador', () => {
  async function abrirEdicionDeCamila(rutas: Parameters<typeof simularApi>[0] = {}, administradores?: UsuarioDto[]) {
    const montada = montarFicha(rutas, administradores);
    await screen.findByText('Camila Admin');
    await montada.usuario.click(screen.getByRole('button', { name: 'Editar a Camila Admin' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar al administrador/ });
    await waitFor(() => expect(within(dialogo).getByRole('textbox', { name: /Usuario en ERP/ })).toBeInTheDocument());
    return { ...montada, dialogo };
  }

  it('abre precargado con su nombre, su correo y su usuario en el sistema, sin avisos mientras no cambie el correo', async () => {
    const { dialogo } = await abrirEdicionDeCamila();

    expect(within(dialogo).getByRole('textbox', { name: /Nombre/ })).toHaveValue('Camila Admin');
    expect(within(dialogo).getByRole('textbox', { name: /Correo/ })).toHaveValue('camila@andina.co');
    expect(within(dialogo).getByRole('textbox', { name: /Usuario en ERP/ })).toHaveValue('camila');
    expect(within(dialogo).queryByText(/se cierran las sesiones de esta persona/)).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole('checkbox', { name: /Enviar la invitación/ })).not.toBeInTheDocument();
    expect(within(dialogo).getByText(/ese sistema manda su nombre y su correo en cada ingreso/)).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('corregir el correo avisa de las sesiones y passkeys, ofrece la invitación y manda el PUT correcto', async () => {
    const { peticiones, usuario, dialogo } = await abrirEdicionDeCamila({
      'PUT /api/v1/plataforma/tenants/t1/usuarios/u1': (p) => ({ ...CAMILA, ...(p.cuerpo as Record<string, unknown>), passkeys: 0 }),
    });

    const correo = within(dialogo).getByRole('textbox', { name: /Correo/ });
    await usuario.clear(correo);
    await usuario.type(correo, 'camila.rojas@andina.co');

    expect(await within(dialogo).findByText(/Al cambiar el correo se cierran las sesiones de esta persona y se revocan sus passkeys/)).toBeInTheDocument();
    const invitar = within(dialogo).getByRole('checkbox', { name: 'Enviar la invitación al correo nuevo' });
    expect(invitar).toBeChecked();
    const guardar = within(dialogo).getByRole('button', { name: 'Guardar' });
    await waitFor(() => expect(guardar).toBeEnabled());
    await usuario.click(guardar);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(puts(peticiones)).toHaveLength(1);
    expect(puts(peticiones)[0]?.ruta).toBe('/api/v1/plataforma/tenants/t1/usuarios/u1');
    // Sin tocar los usuarios del sistema no se mandan (omitirlos los conserva).
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ nombre: 'Camila Admin', correo: 'camila.rojas@andina.co', invitar: true });
    expect(await screen.findByText('Corregiste a Camila Admin: se cerraron sus sesiones y se revocaron sus passkeys.')).toBeInTheDocument();
    // La lista de administradores se vuelve a pedir.
    await waitFor(() => expect(peticiones.filter((p) => p.metodo === 'GET' && p.ruta.endsWith('/administradores')).length).toBe(2));
  });

  it('sin marcar «Enviar la invitación» no se pide invitar', async () => {
    const { peticiones, usuario, dialogo } = await abrirEdicionDeCamila({ 'PUT /api/v1/plataforma/tenants/t1/usuarios/u1': CAMILA });
    const correo = within(dialogo).getByRole('textbox', { name: /Correo/ });
    await usuario.clear(correo);
    await usuario.type(correo, 'camila.rojas@andina.co');
    await usuario.click(await within(dialogo).findByRole('checkbox', { name: 'Enviar la invitación al correo nuevo' }));

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(puts(peticiones)).toHaveLength(1));
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ nombre: 'Camila Admin', correo: 'camila.rojas@andina.co' });
  });

  it('corregir solo el nombre o el usuario del sistema no habla de sesiones ni de invitación y manda solo lo que cambió', async () => {
    const { peticiones, usuario, dialogo } = await abrirEdicionDeCamila({
      'PUT /api/v1/plataforma/tenants/t1/usuarios/u1': (p) => ({ ...CAMILA, ...(p.cuerpo as Record<string, unknown>) }),
    });
    const nombre = within(dialogo).getByRole('textbox', { name: /Nombre/ });
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Camila Rojas');
    const sub = within(dialogo).getByRole('textbox', { name: /Usuario en ERP/ });
    await usuario.clear(sub);
    await usuario.type(sub, ' camila.rojas ');
    expect(within(dialogo).queryByText(/se cierran las sesiones/)).not.toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(puts(peticiones)).toHaveLength(1));
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ nombre: 'Camila Rojas', correo: 'camila@andina.co', identidades: [{ sistemaId: 's1', idExterno: 'camila.rojas' }] });
    expect(await screen.findByText('Corregiste a Camila Rojas.')).toBeInTheDocument();
  });

  it('dejar vacío el usuario del sistema manda la lista de identidades sin él', async () => {
    const { peticiones, usuario, dialogo } = await abrirEdicionDeCamila({ 'PUT /api/v1/plataforma/tenants/t1/usuarios/u1': CAMILA });
    await usuario.clear(within(dialogo).getByRole('textbox', { name: /Usuario en ERP/ }));

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(puts(peticiones)).toHaveLength(1));
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ nombre: 'Camila Admin', correo: 'camila@andina.co', identidades: [] });
  });

  it('un correo mal escrito o un nombre vacío bloquean el guardado', async () => {
    const { peticiones, usuario, dialogo } = await abrirEdicionDeCamila();
    const correo = within(dialogo).getByRole('textbox', { name: /Correo/ });
    await usuario.clear(correo);
    await usuario.type(correo, 'camila-sin-arroba');
    await usuario.tab();

    expect(await within(dialogo).findAllByText('Escribe un correo válido.')).not.toHaveLength(0);
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(within(dialogo).queryByText(/se cierran las sesiones/)).not.toBeInTheDocument();
    expect(puts(peticiones)).toHaveLength(0);
  });

  it('un correo que ya es de otra persona del grupo se muestra y el diálogo sigue abierto', async () => {
    const { usuario, dialogo } = await abrirEdicionDeCamila({
      'PUT /api/v1/plataforma/tenants/t1/usuarios/u1': new ProblemaSimulado(409, 'usuario-duplicado', 'Ya existe un usuario con el correo diego@andina.co.'),
    });
    const correo = within(dialogo).getByRole('textbox', { name: /Correo/ });
    await usuario.clear(correo);
    await usuario.type(correo, 'diego@andina.co');

    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialogo).findByText('Ya existe una persona con ese correo.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Editar al administrador/ })).toBeInTheDocument();
  });

  it('un grupo que solo entra desde el sistema integrado no ofrece invitar al correo nuevo', async () => {
    const soloDelegado: GrupoDto = { ...GRUPO, tenant: { ...TENANT, ingreso: { modos: ['Delegado'], sesionHoras: 8, inactividadMinutos: 30, passkeyParaTodos: false } } };
    const { usuario } = montarFicha({}, [CAMILA], soloDelegado);
    await screen.findByText('Camila Admin');
    expect(screen.queryByRole('button', { name: /Reenviar la invitación/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Editar a Camila Admin' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar al administrador/ });
    const correo = within(dialogo).getByRole('textbox', { name: /Correo/ });
    await usuario.clear(correo);
    await usuario.type(correo, 'camila.rojas@andina.co');

    expect(await within(dialogo).findByText(/Al cambiar el correo se cierran las sesiones/)).toBeInTheDocument();
    expect(within(dialogo).queryByRole('checkbox', { name: /Enviar la invitación/ })).not.toBeInTheDocument();
  });
});

describe('Ficha del grupo: reenviar la invitación', () => {
  it('solo se ofrece a quien está activo y entra directo; pide confirmar y manda el POST', async () => {
    const { peticiones, usuario } = montarFicha({ 'POST /api/v1/plataforma/tenants/t1/usuarios/u1/invitar': { ...CAMILA, invitadoEn: '2026-11-17T10:00:00Z' } });
    await screen.findByText('Camila Admin');
    expect(screen.queryByRole('button', { name: 'Reenviar la invitación a Diego Soporte' })).not.toBeInTheDocument(); // desactivado

    await usuario.click(screen.getByRole('button', { name: 'Reenviar la invitación a Camila Admin' }));
    const confirmar = await screen.findByRole('dialog', { name: /Reenviar la invitación/ });
    expect(within(confirmar).getByText(/camila@andina.co/)).toBeInTheDocument();
    await usuario.click(within(confirmar).getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByText('Enviamos la invitación a camila@andina.co.')).toBeInTheDocument();
    const posts = peticiones.filter((p) => p.metodo === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.ruta).toBe('/api/v1/plataforma/tenants/t1/usuarios/u1/invitar');
  });

  it('el error de la API al invitar se muestra', async () => {
    const { usuario } = montarFicha({ 'POST /api/v1/plataforma/tenants/t1/usuarios/u1/invitar': new ProblemaSimulado(409, 'ingreso-directo-apagado', 'Apagado.') });
    await screen.findByText('Camila Admin');
    await usuario.click(screen.getByRole('button', { name: 'Reenviar la invitación a Camila Admin' }));
    await usuario.click(within(await screen.findByRole('dialog', { name: /Reenviar la invitación/ })).getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByText('Este grupo no admite el ingreso directo: actívalo en Configuración › Ingreso.')).toBeInTheDocument();
  });
});

describe('Ficha del grupo: ingreso, empresas y sistemas reutilizan lo que ya existe', () => {
  it('cambia los modos de ingreso con el PUT de la consola y avisa de lo que se cierra al apagar el directo', async () => {
    const { peticiones, usuario } = montarFicha({ 'PUT /api/v1/plataforma/tenants/t1/ingreso': (p) => p.cuerpo as Record<string, unknown> });
    await screen.findByRole('region', { name: 'Grupo' });

    await usuario.click(screen.getByRole('button', { name: 'Editar cómo entran' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar cómo entran/ });
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await usuario.click(within(dialogo).getByRole('checkbox', { name: 'Directo a Valídalo' }));
    expect(within(dialogo).getByText(/se cierran las sesiones directas abiertas/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(puts(peticiones)).toHaveLength(1);
    expect(puts(peticiones)[0]?.ruta).toBe('/api/v1/plataforma/tenants/t1/ingreso');
    expect(puts(peticiones)[0]?.cuerpo).toEqual({ modos: ['Delegado'], sesionHoras: 8, inactividadMinutos: 30, passkeyParaTodos: false });
    expect(await screen.findByText('Guardaste cómo entran las personas de Grupo Andino.')).toBeInTheDocument();
  });

  it('sin ningún modo no se puede guardar', async () => {
    const { usuario } = montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });
    await usuario.click(screen.getByRole('button', { name: 'Editar cómo entran' }));
    const dialogo = await screen.findByRole('dialog', { name: /Editar cómo entran/ });

    await usuario.click(within(dialogo).getByRole('checkbox', { name: 'Directo a Valídalo' }));
    await usuario.click(within(dialogo).getByRole('checkbox', { name: 'Desde el sistema integrado' }));

    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(within(dialogo).getAllByText('Elige al menos un modo de ingreso.').length).toBeGreaterThan(0);
  });

  it('la empresa se edita con el mismo diálogo de corrección de la lista de grupos', async () => {
    const { usuario } = montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });

    await usuario.click(screen.getByRole('button', { name: 'Editar la empresa Constructora Norte S.A.S.' }));

    const dialogo = await screen.findByRole('dialog', { name: /^Editar empresa/ });
    expect(within(dialogo).getByText('Para el grupo Grupo Andino')).toBeInTheDocument();
    expect(within(dialogo).getByRole('textbox', { name: /Prefijo/ })).toHaveValue('NORTE');
    expect(within(dialogo).getByText(/Los códigos ya emitidos conservan el prefijo anterior/)).toBeInTheDocument();
  });

  it('«Gestionar» abre el diálogo de sistemas que ya existe', async () => {
    const { usuario } = montarFicha();
    await screen.findByRole('region', { name: 'Grupo' });

    await usuario.click(screen.getByRole('button', { name: 'Gestionar los sistemas de Grupo Andino' }));

    const dialogo = await screen.findByRole('dialog', { name: /Sistemas integrados/ });
    expect(await within(dialogo).findByRole('button', { name: 'Desactivar ERP de Andina' })).toBeInTheDocument();
  });
});
