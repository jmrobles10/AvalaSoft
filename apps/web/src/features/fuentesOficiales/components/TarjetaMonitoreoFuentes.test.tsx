import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, SCOPES, type MonitoreoFuentesOficialesDto } from '@avalasoft/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { problema, renderizar, simularApi, type LlamadaApi } from '../../cumplimiento/pruebasApi';
import { monitoreoDeFuentes, rues } from '../datosPrueba';
import { TarjetaMonitoreoFuentes } from './TarjetaMonitoreoFuentes';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

// Las interacciones con diálogos de MUI en jsdom tardan segundos y, con el equipo cargado, pueden pasar de los 20 s globales.
vi.setConfig({ testTimeout: 60_000 });

const OFICIAL = [SCOPES.expedientesLeer, SCOPES.cumplimientoDecidir, SCOPES.documentosDescargar];
const V1 = '/api/v1/vinculos/v1/monitoreo-fuentes-oficiales';

function montar(datos: MonitoreoFuentesOficialesDto | Response, scopes: readonly string[] = OFICIAL, manejadores: Record<string, (llamada: LlamadaApi) => unknown> = {}): LlamadaApi[] {
  permisos.scopes = new Set(scopes);
  const llamadas = simularApi({ [`GET ${V1}`]: () => datos, [`GET /api/v1/usuarios/resumen`]: () => [], ...manejadores });
  renderizar(<TarjetaMonitoreoFuentes vinculoId="v1" empresaId="emp" />);
  return llamadas;
}

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  vi.unstubAllGlobals();
});

describe('Monitoreo de fuentes oficiales del vínculo (FO-7)', () => {
  it('muestra la próxima consulta, la última de cada fuente y la diferencia nueva; aceptarla llama al monitoreo, no al expediente', async () => {
    const llamadas = montar(monitoreoDeFuentes(), OFICIAL, { [`POST ${V1}/Rues/diferencias/k2/resolver`]: () => monitoreoDeFuentes({ fuentes: [rues({ estado: 'Satisfecha' })] }) });

    const tarjeta = within(await screen.findByRole('region', { name: 'Monitoreo de fuentes oficiales' }));
    expect(tarjeta.getByText(/Cada 30 días se vuelve a consultar el RUES o la DIAN/)).toBeInTheDocument();
    expect(tarjeta.getByText('12/12/2026')).toBeInTheDocument();
    expect(tarjeta.getByRole('region', { name: 'Registro mercantil (RUES)' })).toBeInTheDocument();
    expect(tarjeta.getByText(/· Sistema$/)).toBeInTheDocument();

    await userEvent.click(within(tarjeta.getByRole('listitem', { name: 'Estado de la matrícula mercantil · Estado en la fuente' })).getByRole('button', { name: 'Aceptar diferencia' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));
    expect(dialogo.getByText('Escribe la justificación.')).toBeInTheDocument();
    expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);

    await userEvent.type(dialogo.getByLabelText(/Justificación/), 'La empresa lo aceptó.');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));
    const resolver = llamadas.find((l) => l.ruta === `${V1}/Rues/diferencias/k2/resolver`);
    expect(resolver?.cuerpo).toEqual({ decision: 'Descartada', justificacion: 'La empresa lo aceptó.' });
  });

  it('al confirmar un hallazgo avisa que bloquear o desvincular lo decide un administrador', async () => {
    let datos = monitoreoDeFuentes();
    montar(datos, OFICIAL, {
      [`GET ${V1}`]: () => datos,
      [`POST ${V1}/Rues/diferencias/k2/resolver`]: () => {
        datos = monitoreoDeFuentes({ fuentes: [rues({ estado: 'Fallida', fuenteOficial: { datos: rues().fuenteOficial!.datos, campos: [{ ...rues().fuenteOficial!.campos[1]!, decision: 'Confirmada', justificacion: 'Cancelada.', resueltaPor: 'sistema', resueltaEn: '2026-11-12T14:00:00Z' }] } })] });
        return datos;
      },
    });

    const tarjeta = within(await screen.findByRole('region', { name: 'Monitoreo de fuentes oficiales' }));
    expect(tarjeta.queryByText(/lo decide un administrador/)).not.toBeInTheDocument();
    await userEvent.click(tarjeta.getByRole('button', { name: 'Confirmar hallazgo' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await userEvent.type(dialogo.getByLabelText(/Justificación/), 'Cancelada.');
    await userEvent.click(dialogo.getByRole('button', { name: 'Guardar decisión' }));

    expect(await tarjeta.findByText(/lo decide un administrador desde las acciones del vínculo/)).toBeInTheDocument();
    expect(tarjeta.queryByRole('button', { name: 'Confirmar hallazgo' })).not.toBeInTheDocument();
  });

  it('sin cumplimiento:decidir se ve pero no se decide; un monitoreo detenido lo dice y sin documentos:descargar no hay constancia', async () => {
    montar(monitoreoDeFuentes({ proximaConsulta: null }), [SCOPES.expedientesLeer]);

    const tarjeta = within(await screen.findByRole('region', { name: 'Monitoreo de fuentes oficiales' }));
    expect(tarjeta.getByText('Detenido')).toBeInTheDocument();
    expect(tarjeta.queryByRole('button', { name: 'Aceptar diferencia' })).not.toBeInTheDocument();
    expect(tarjeta.queryByRole('button', { name: 'Confirmar hallazgo' })).not.toBeInTheDocument();
    expect(tarjeta.queryByRole('button', { name: 'Constancia' })).not.toBeInTheDocument();
  });

  it('un fallo de la última reconsulta se explica sin perder el resultado anterior y la constancia se descarga con su fuente', async () => {
    const llamadas = montar(monitoreoDeFuentes({ fuentes: [rues({ ultimoError: 'RUES: sin respuesta.', reintentarDesde: '2026-11-12T14:05:00Z' })] }), OFICIAL, {
      [`POST ${V1}/Rues/evidencia/descarga`]: () => ({ url: 'https://almacen.example/c.json', expira: '2026-11-12T14:05:00Z', nombreArchivo: 'constancia-rues-monitoreo.json' }),
    });

    const tarjeta = within(await screen.findByRole('region', { name: 'Monitoreo de fuentes oficiales' }));
    expect(tarjeta.getByRole('alert')).toHaveTextContent('RUES: sin respuesta.');
    expect(tarjeta.getAllByText('CANCELADA').length).toBeGreaterThan(0);
    await userEvent.click(tarjeta.getByRole('button', { name: 'Constancia' }));
    await vi.waitFor(() => expect(llamadas.some((l) => l.ruta === `${V1}/Rues/evidencia/descarga`)).toBe(true));
  });

  it('un vínculo sin monitoreo no muestra la tarjeta ni un error', async () => {
    const llamadas = montar(problema(404, 'monitoreo-no-encontrado'));

    await vi.waitFor(() => expect(llamadas.some((l) => l.ruta === V1)).toBe(true));
    await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Monitoreo de fuentes oficiales' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
