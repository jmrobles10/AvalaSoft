import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type ExpedienteDto, type VerificacionDto } from '@validalo/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { problema, renderizar, simularApi, type LlamadaApi } from '../../cumplimiento/pruebasApi';
import { accionesDeVerificacion } from '../../cumplimiento/modelo';
import { PanelVerificaciones } from '../../cumplimiento/components/PanelVerificaciones';
import { expediente } from '../../expedientes/datosPrueba';
import { useAvisos } from '../../../shared/useAvisos';
import { campo, dian, rues } from '../datosPrueba';
import { FuenteOficial } from './FuenteOficial';

// Las interacciones con diálogos de MUI en jsdom tardan segundos y, con el equipo cargado, pueden pasar de los 20 s globales.
vi.setConfig({ testTimeout: 60_000 });

const OFICIAL = new Set([SCOPES.expedientesLeer, SCOPES.verificacionesEscribir, SCOPES.cumplimientoDecidir, SCOPES.documentosDescargar]);
const E1 = '/api/v1/expedientes/e1';

function montar(verificacion: VerificacionDto, scopes: ReadonlySet<string> = OFICIAL, manejadores: Record<string, (llamada: LlamadaApi) => unknown> = {}, fuente: 'Rues' | 'Dian' = 'Rues'): LlamadaApi[] {
  const datos: ExpedienteDto = { ...expediente('EnRevision'), verificaciones: [verificacion] };
  const llamadas = simularApi({
    [`POST ${E1}/verificaciones/${fuente}/consultar`]: () => datos,
    [`POST ${E1}/verificaciones/${fuente}/diferencias/k2/resolver`]: () => datos,
    ...manejadores,
  });
  renderizar(<FuenteOficial expediente={datos} empresaId="emp" fuente={fuente} verificacion={verificacion} acciones={accionesDeVerificacion(datos, scopes)} nombres={new Map([['u-ofi', 'Carlos Cumplimiento']])} />);
  return llamadas;
}

afterEach(() => {
  reiniciarCliente();
  vi.unstubAllGlobals();
});

describe('Fuente oficial del expediente (FO-4)', () => {
  it('muestra lo que dijo la fuente, deja primero la diferencia por revisar y marca lo crítico', () => {
    montar(rues());

    const seccion = within(screen.getByRole('region', { name: 'Registro mercantil (RUES)' }));
    expect(seccion.getAllByText('Diferencias por revisar').length).toBeGreaterThan(0);
    expect(seccion.getByText('Bloquea la aprobación')).toBeInTheDocument();
    expect(seccion.getByText('Datos abiertos de Confecámaras')).toBeInTheDocument();
    const datos = within(seccion.getByRole('region', { name: 'Lo que dice la fuente' }));
    expect(datos.getByText('CANCELADA')).toBeInTheDocument();
    expect(datos.getByText('No vigente')).toBeInTheDocument();
    expect(datos.getByText('900123456-7')).toBeInTheDocument();
    expect(datos.getByText('2026 · 30/03/2026')).toBeInTheDocument();
    expect(datos.getByText(/ANA MARIA PEREZ \(1020304050\) — Representante legal/)).toBeInTheDocument();
    expect(seccion.getByText('1 coinciden · 1 con diferencia · 1 sin verificar')).toBeInTheDocument();

    const filas = seccion.getAllByRole('listitem');
    expect(filas[0]).toHaveAccessibleName('Estado de la matrícula mercantil · Estado en la fuente');
    expect(within(filas[0]!).getByText('Crítica')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('La matrícula no está activa en el RUES.')).toBeInTheDocument();
    expect(within(filas[0]!).getByText('Diferencia')).toBeInTheDocument();
    expect(within(filas[1]!).getByText('Coincide')).toBeInTheDocument();
    expect(within(filas[2]!).getByText('No verificable')).toBeInTheDocument();
  });

  it('aceptar una diferencia pide justificación y llama al endpoint de diferencias con la decisión', async () => {
    const llamadas = montar(rues());

    const fila = within(screen.getByRole('listitem', { name: 'Estado de la matrícula mercantil · Estado en la fuente' }));
    await userEvent.click(fila.getByRole('button', { name: 'Aceptar diferencia' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText(/Estado de la matrícula mercantil: la fuente dice «CANCELADA»/)).toBeInTheDocument();
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));
    expect(dialogo.getByText('Escribe la justificación.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);

    await userEvent.type(dialogo.getByLabelText(/Justificación/), 'En liquidación voluntaria: la empresa lo aceptó.');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));
    const resolver = llamadas.find((l) => l.ruta === `${E1}/verificaciones/Rues/diferencias/k2/resolver`);
    expect(resolver?.cuerpo).toEqual({ decision: 'Descartada', justificacion: 'En liquidación voluntaria: la empresa lo aceptó.' });
  });

  it('confirmar el hallazgo advierte que nunca rechaza solo y envía Confirmada', async () => {
    const llamadas = montar(rues());

    await userEvent.click(within(screen.getByRole('listitem', { name: 'Estado de la matrícula mercantil · Estado en la fuente' })).getByRole('button', { name: 'Confirmar hallazgo' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(dialogo.getByText(/nunca se rechaza solo/)).toBeInTheDocument();
    await userEvent.type(dialogo.getByLabelText(/Justificación/), 'La matrícula está cancelada.');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));

    expect(llamadas.find((l) => l.ruta.endsWith('/diferencias/k2/resolver'))?.cuerpo).toEqual({ decision: 'Confirmada', justificacion: 'La matrícula está cancelada.' });
  });

  it('un error de la API al decidir se muestra en el diálogo sin cerrarlo', async () => {
    montar(rues(), OFICIAL, { [`POST ${E1}/verificaciones/Rues/diferencias/k2/resolver`]: () => problema(409, 'diferencia-ya-resuelta') });

    await userEvent.click(within(screen.getByRole('listitem', { name: 'Estado de la matrícula mercantil · Estado en la fuente' })).getByRole('button', { name: 'Aceptar diferencia' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.type(dialogo.getByLabelText(/Justificación/), 'Ok.');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));

    expect(await dialogo.findByText('Esa diferencia ya se resolvió; recargamos el expediente.')).toBeInTheDocument();
  });

  it('sin cumplimiento:decidir se ve pero no se decide; una decisión heredada dice hasta cuándo vale y quién decidió se nombra', () => {
    const decidida = rues({
      estado: 'Satisfecha',
      fuenteOficial: {
        datos: rues().fuenteOficial!.datos,
        campos: [
          campo({ id: 'k2', resultado: 'Discrepa', decision: 'Descartada', heredada: true, vigenteHasta: '2027-11-10T14:00:00Z', etiqueta: 'Estado de la matrícula mercantil', contra: 'Fuente', referencia: null }),
          campo({ id: 'k4', campo: 'direccion', etiqueta: 'Dirección', resultado: 'Discrepa', decision: 'Confirmada', justificacion: 'No es la de la ficha.', resueltaPor: 'u-ofi', resueltaEn: '2026-11-11T14:00:00Z' }),
        ],
      },
    });
    montar(decidida, new Set([SCOPES.expedientesLeer]));

    expect(screen.queryByRole('button', { name: 'Aceptar diferencia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar hallazgo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reconsultar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Constancia' })).not.toBeInTheDocument();
    expect(screen.getByText(/Aceptada en una consulta anterior, vigente hasta el 10\/11\/2027/)).toBeInTheDocument();
    expect(screen.getByText(/Hallazgo confirmado por Carlos Cumplimiento el 11\/11\/2026: No es la de la ficha\./)).toBeInTheDocument();
  });

  it('un tercero conforme lo dice y la fuente informativa no bloquea', () => {
    montar(dian({ bloqueante: false }), OFICIAL, {}, 'Dian');

    const seccion = within(screen.getByRole('region', { name: 'Estado del RUT (DIAN)' }));
    expect(seccion.getByText('Conforme')).toBeInTheDocument();
    expect(seccion.getByText('Informativa')).toBeInTheDocument();
    expect(seccion.getByText('Lo que dice la fuente coincide con la ficha y los documentos.')).toBeInTheDocument();
    expect(seccion.getByText('API contratada')).toBeInTheDocument();
    expect(seccion.queryByRole('button', { name: 'Aceptar diferencia' })).not.toBeInTheDocument();
  });

  it('un tercero que la fuente no tiene lo dice', () => {
    montar(rues({ fuenteOficial: { datos: { ...rues().fuenteOficial!.datos, encontrado: false }, campos: [campo({ id: 'k9', campo: 'registro', etiqueta: 'Registro en RUES', contra: 'Fuente', referencia: null, oficial: 'No figura en RUES', comparado: 'Debe figurar', resultado: 'Discrepa' })] } }));

    expect(screen.getByText('La fuente no tiene al tercero.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Registro en RUES · Estado en la fuente' })).toBeInTheDocument();
  });

  it('sin consulta todavía lo explica y ofrece consultar; con un fallo muestra el error y cuándo se reintenta; consultar llama a la API', async () => {
    const pendiente = rues({ estado: 'Pendiente', resultado: null, registradaEn: null, registradaPor: null, vigenteHasta: null, evidencia: null, referenciaExterna: null, fuenteOficial: null, ultimoError: 'RUES simulada: la fuente no responde.', reintentarDesde: '2026-11-10T14:05:00Z' });
    const llamadas = montar(pendiente);

    expect(screen.getByText('Aún no se consulta: se consulta sola al pasar a revisión.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('RUES simulada: la fuente no responde.');
    expect(screen.queryByRole('button', { name: 'Constancia' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(llamadas.some((l) => l.metodo === 'POST' && l.ruta === `${E1}/verificaciones/Rues/consultar`)).toBe(true);
  });

  it('reconsultar y descargar la constancia llaman a la fuente correcta; un 503 se explica sin mostrar códigos', async () => {
    const llamadas = montar(rues(), OFICIAL, {
      [`POST ${E1}/verificaciones/Rues/evidencia/descarga`]: () => ({ url: 'https://almacen.example/constancia.json', expira: '2026-11-10T14:05:00Z', nombreArchivo: 'constancia-rues.json' }),
      [`POST ${E1}/verificaciones/Rues/consultar`]: () => problema(503, 'verificacion-no-disponible'),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Reconsultar' }));
    await vi.waitFor(() => expect(useAvisos.getState().actual?.mensaje).toMatch(/no está disponible ahora/));
    await userEvent.click(screen.getByRole('button', { name: 'Constancia' }));
    await vi.waitFor(() => expect(llamadas.some((l) => l.ruta === `${E1}/verificaciones/Rues/evidencia/descarga`)).toBe(true));
  });

  it('las consultas anteriores se listan con su constancia', async () => {
    const llamadas = montar(rues({ anteriores: [{ proveedor: 'DatosAbiertos', referenciaExterna: 'rues-0', resultado: 'Conforme', fecha: '2026-10-01T14:00:00Z', coincidencias: 2, conEvidencia: true }] }), OFICIAL, {
      [`POST ${E1}/verificaciones/Rues/evidencia/descarga`]: () => ({ url: 'https://almacen.example/anterior.json', expira: '2026-11-10T14:05:00Z', nombreArchivo: 'anterior.json' }),
    });

    const anteriores = screen.getByText('1 consulta anterior').closest('details')!;
    expect(within(anteriores).getByText('2 diferencias')).toBeInTheDocument();
    await userEvent.click(within(anteriores).getByRole('button', { name: 'Constancia' }));
    await vi.waitFor(() => expect(llamadas.find((l) => l.ruta.endsWith('/evidencia/descarga'))?.url.searchParams.get('referencia')).toBe('rues-0'));
  });
});

describe('Panel de verificaciones con fuentes oficiales', () => {
  it('muestra el RUES y la DIAN junto a las demás verificaciones, con su estado en el vocabulario de las fuentes', () => {
    const datos: ExpedienteDto = { ...expediente('EnRevision'), verificaciones: [rues(), dian({ bloqueante: false })], esperandoVerificaciones: true };
    simularApi({});
    renderizar(<PanelVerificaciones expediente={datos} empresaId="emp" scopes={OFICIAL} nombres={new Map()} />);

    expect(screen.getByRole('region', { name: 'Registro mercantil (RUES)' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Estado del RUT (DIAN)' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Listas restrictivas' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Diferencias por revisar').length).toBeGreaterThan(0);
  });

  it('un hallazgo confirmado de una fuente habilita al oficial a rechazar por cumplimiento', () => {
    const fallida = rues({ estado: 'Fallida' });
    simularApi({});
    renderizar(<PanelVerificaciones expediente={{ ...expediente('EnRevision'), verificaciones: [fallida] }} empresaId="emp" scopes={OFICIAL} nombres={new Map()} />);

    expect(screen.getByRole('button', { name: 'Rechazar por cumplimiento' })).toBeInTheDocument();
  });
});
