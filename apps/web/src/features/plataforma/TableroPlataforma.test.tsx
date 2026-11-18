import { screen, within } from '@testing-library/react';
import { reiniciarCliente, type EmpresaDeGrupoDto, type GrupoDto, type SesionAvalasoft, type SolicitudDeAccesoDePlataformaDto } from '@avalasoft/api-client';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { ProblemaSimulado, simularApi } from '../../pruebas/simularApi';
import { useSesion } from '../../sesion/sesionStore';
import { TableroPlataforma } from './TableroPlataforma';

function empresa(id: string, nombre: string, plan: 'activo' | 'sin-plan'): EmpresaDeGrupoDto {
  return {
    id,
    nombre,
    identificacion: { pais: 'CO', tipo: 'NIT', numero: '800123456', digitoVerificacion: '1' },
    prefijoFolio: 'EMP',
    activa: true,
    planIaConfigurado: plan === 'activo',
    planIaActivo: plan === 'activo',
    llaveConfigurada: plan === 'activo',
    ultimosCuatro: plan === 'activo' ? 'WXYZ' : null,
  };
}

const grupo = (id: string, nombre: string, empresas: EmpresaDeGrupoDto[]): GrupoDto => ({
  tenant: { id, slug: id, nombre, region: 'co', plan: 'Inicial', zonaHoraria: 'America/Bogota', idioma: 'es-CO', activo: true, creadoEn: '2026-11-09T15:00:00Z' },
  empresas,
});

const solicitud = (id: string, tercero: string): SolicitudDeAccesoDePlataformaDto => ({
  id,
  terceroId: `t-${id}`,
  tercero,
  identificacion: 'NIT 900123456',
  correo: 'gerente@norte.co',
  estado: 'Pendiente',
  desde: '2026-11-12T15:00:00Z',
  empresas: [],
  contactos: [],
  correosOficiales: [],
  enCola: true,
  contactoDesplazado: false,
  decididoPor: null,
  decididoVia: null,
  decididoEn: null,
  motivo: null,
});

const GRUPOS = [
  grupo('g1', 'Grupo Norte', [empresa('e1', 'Norte S.A.S.', 'activo'), empresa('e2', 'Norte Obras S.A.S.', 'sin-plan')]),
  grupo('g2', 'Grupo Sur', [empresa('e3', 'Sur S.A.S.', 'sin-plan')]),
];

function montar(solicitudes: SolicitudDeAccesoDePlataformaDto[] | ProblemaSimulado, gruposApi: GrupoDto[] | ProblemaSimulado = GRUPOS) {
  simularApi({
    'GET /api/v1/plataforma/grupos': Array.isArray(gruposApi) ? { datos: gruposApi, siguienteCursor: null } : gruposApi,
    'GET /api/v1/plataforma/solicitudes-de-acceso': solicitudes,
  });
  montarPantalla(
    <Routes>
      <Route path="/plataforma/grupos" element={<TableroPlataforma />} />
    </Routes>,
    '/plataforma/grupos',
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-18T09:00:00-05:00') });
  useSesion.setState({ sesion: { nombre: 'Paula Plataforma', usuarioId: 'op-1' } as SesionAvalasoft, estado: 'activa' });
});

afterEach(() => {
  vi.useRealTimers();
  reiniciarCliente();
  useSesion.setState({ sesion: null, estado: 'sin-sesion' });
});

describe('TableroPlataforma (portada de la consola)', () => {
  it('saluda por la hora con el primer nombre y resume lo que hay con las cifras que entrega la API', async () => {
    montar([solicitud('s1', 'Proveedores del Norte S.A.S.')]);

    expect(await screen.findByText('Buenos días, Paula')).toBeInTheDocument();
    expect(await screen.findByText('Administras 2 grupos con 3 empresas. Hay 1 solicitud de acceso esperando una decisión.')).toBeInTheDocument();
    const tablero = screen.getByRole('region', { name: 'Resumen de la plataforma' });
    // Grupos 2, empresas 3, planes de IA activos 1 de 3, solicitudes por decidir 1.
    const kpi = (titulo: string) => {
      const tarjeta = within(tablero).getByText(titulo).parentElement?.parentElement;
      if (!tarjeta) throw new Error(`Sin tarjeta para ${titulo}`);
      return tarjeta;
    };
    expect(within(kpi('Grupos')).getByText('2')).toBeInTheDocument();
    expect(within(kpi('Empresas')).getByText('3')).toBeInTheDocument();
    expect(within(kpi('Con plan de IA activo')).getByText('1')).toBeInTheDocument();
    expect(within(kpi('Con plan de IA activo')).getByText('De 3 empresas')).toBeInTheDocument();
    expect(within(kpi('Con plan de IA activo')).getByRole('img', { name: '1 de 3 empresas con plan de IA activo' })).toBeInTheDocument();
    expect(within(kpi('Solicitudes por decidir')).getByText('1')).toBeInTheDocument();
  });

  it('«Necesita atención» lista las solicitudes en cola y las empresas sin plan de IA, cada una con su enlace', async () => {
    montar([solicitud('s1', 'Proveedores del Norte S.A.S.')]);

    const lista = await screen.findByRole('region', { name: 'Necesita atención' });
    const solicitudes = within(lista).getByRole('link', { name: /Proveedores del Norte S\.A\.S\./ });
    expect(solicitudes).toHaveAttribute('href', '/plataforma/accesos-a-terceros');
    expect(within(solicitudes).getByText('Pide acceso desde el 12/11/2026')).toBeInTheDocument();
    expect(within(solicitudes).getByText('Por decidir')).toBeInTheDocument();
    const sinPlan = within(lista).getByRole('link', { name: /Norte Obras S\.A\.S\./ });
    expect(sinPlan).toHaveAttribute('href', '/plataforma/grupos/g1/empresas/e2/plan-ia');
    expect(within(sinPlan).getByText('Grupo Norte · aún sin plan de IA')).toBeInTheDocument();
    expect(within(lista).getByRole('link', { name: /Sur S\.A\.S\./ })).toHaveAttribute('href', '/plataforma/grupos/g2/empresas/e3/plan-ia');
    // La empresa que ya tiene plan no necesita atención.
    expect(within(lista).queryByRole('link', { name: /^Norte S\.A\.S\./ })).not.toBeInTheDocument();
  });

  it('sin solicitudes en cola dice que está al día, y sin nada que atender no dibuja la lista', async () => {
    montar([], [grupo('g1', 'Grupo Norte', [empresa('e1', 'Norte S.A.S.', 'activo')])]);

    expect(await screen.findByText('Administras 1 grupo con 1 empresa. No hay solicitudes de acceso esperando una decisión.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Necesita atención' })).not.toBeInTheDocument();
  });

  it('si los grupos no cargan no muestra cifras (nada inventado): la lista de abajo da el error', async () => {
    montar([], new ProblemaSimulado(500, 'error', 'Falló'));

    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Resumen de la plataforma' })).not.toBeInTheDocument());
    expect(screen.queryByText(/Administras/)).not.toBeInTheDocument();
  });
});
