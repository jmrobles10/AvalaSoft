import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it, vi } from 'vitest';
import { area, areaDeRequisito, expediente, requisito } from '../datosPrueba';
import type { ContextoRevisor, DialogoExpediente } from '../reglas';
import { PanelDecisionArea } from './PanelDecisionArea';

/**
 * «Lo que te toca decidir» en un expediente con documentos: Compras revisa el RUT y Cumplimiento el RUT y la Cámara de comercio. Solo
 * pinta las áreas donde la persona puede decidir ahora (el resto, con su motivo, está en «Etapas y áreas») y «Rechazar» solo donde el
 * área puede rechazar (decisiones de la conversión de las e2e, PC-1).
 */
const REVISOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
const ADMINISTRADOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar]);

const AREA_COMPRAS = { areaId: 'a-compras', codigo: 'COMPRAS' };
const AREA_CUMPLIMIENTO = { areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO' };

const RUT = requisito({ areas: [areaDeRequisito(AREA_COMPRAS), areaDeRequisito(AREA_CUMPLIMIENTO)] });
const CAMARA = requisito({
  id: 'r-camara',
  tipoDocumento: { id: 'td-cc', codigo: 'CAMARA_COMERCIO', nombre: 'Certificado de existencia y representación legal', tipoCanonico: 'CAMARA_COMERCIO', ambito: 'Global' },
  areas: [areaDeRequisito(AREA_CUMPLIMIENTO)],
});

const compras = (cambios: Partial<AreaExpedienteDto> = {}) =>
  area({ ...AREA_COMPRAS, nombre: 'Compras', documentosPorDecidir: [{ requisitoId: 'r-rut', versionVigente: 1 }], ...cambios });
const cumplimiento = (cambios: Partial<AreaExpedienteDto> = {}) =>
  area({
    ...AREA_CUMPLIMIENTO,
    nombre: 'Cumplimiento',
    documentosPorDecidir: [
      { requisitoId: 'r-rut', versionVigente: 1 },
      { requisitoId: 'r-camara', versionVigente: 1 },
    ],
    ...cambios,
  });

const conDocumentos = (estado: ExpedienteDto['estado']): ExpedienteDto => ({ ...expediente(estado, [compras(), cumplimiento()]), requisitos: [RUT, CAMARA] });

/** Cada persona es miembro de las áreas de `miembroDe` (por código); `scopes` son sus permisos. */
function montar(datos: ExpedienteDto, miembroDe: readonly string[], scopes: ReadonlySet<string> = REVISOR) {
  const onAccion = vi.fn<(dialogo: DialogoExpediente) => void>();
  const contexto = (a: AreaExpedienteDto | null): ContextoRevisor => ({ scopes, usuarioId: 'u-1', esMiembro: a ? miembroDe.includes(a.codigo) : null });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient()}>
        <PanelDecisionArea expediente={datos} contexto={contexto} onAccion={onAccion} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { onAccion, region: (nombre: string) => within(screen.getByRole('region', { name: nombre })) };
}

const titulo = () => screen.queryByRole('heading', { name: 'Lo que te toca decidir' });

/** El expediente con las áreas dadas en la etapa en curso. */
const conAreas = (datos: ExpedienteDto, areas: AreaExpedienteDto[]): ExpedienteDto => ({ ...datos, etapas: [{ ...datos.etapas[0]!, areas }] });

describe('Lo que te toca decidir', () => {
  it('quien es del área ve «Aprobar área» con cuántos documentos aprueba y «Observar», sin chip de «Tu área»', () => {
    const { region } = montar(conDocumentos('EnRevision'), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(titulo()).toBeInTheDocument();
    expect(region('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Observar' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByText('Certificado de existencia y representación legal')).toBeInTheDocument();
    expect(screen.queryByText('Tu área')).not.toBeInTheDocument();
  });

  it('de cada documento dice la versión que se decide: si el tercero subió otra, es la nueva', () => {
    const rutV2 = { ...RUT, versionActual: { documentoId: 'doc-rut', n: 2, sha256: 'huella-2', cargadaEn: '2026-11-07T14:00:00Z' } };
    const datos = { ...expediente('EnRevision', [compras({ documentosPorDecidir: [{ requisitoId: 'r-rut', versionVigente: 2 }] }), cumplimiento()]), requisitos: [rutV2, CAMARA] };
    const { region } = montar(datos, ['COMPRAS', 'CUMPLIMIENTO']);

    expect(region('Compras').getByText(/Registro Único Tributario/)).toHaveTextContent('Registro Único Tributario · v2');
    expect(region('Cumplimiento').getByText(/Certificado de existencia y representación legal/)).toHaveTextContent('· v1');
  });

  it('solo pinta las áreas donde la persona puede decidir: quien no es de Cumplimiento, aunque administre, no la ve ni su motivo', () => {
    const { region } = montar(conDocumentos('EnRevision'), ['COMPRAS'], ADMINISTRADOR);

    expect(region('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cumplimiento' })).not.toBeInTheDocument();
    expect(screen.queryByText('No eres miembro de esta área.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Aprobar área/ })).toHaveLength(1);
  });

  it('con el expediente devuelto al tercero nadie decide: el panel no se pinta y no explica nada (eso está en «Etapas y áreas»)', () => {
    montar(conDocumentos('Observado'), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(titulo()).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByText('Devuelto al tercero: espera su respuesta.')).not.toBeInTheDocument();
  });

  it('quien no es miembro de ningún área no tiene qué decidir: el panel no se pinta', () => {
    montar(conDocumentos('EnRevision'), [], ADMINISTRADOR);

    expect(titulo()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
  });

  it('un área que ya decidió todo lo suyo sale del panel, y la que sigue pendiente se queda', () => {
    const { region } = montar(conAreas(conDocumentos('EnRevision'), [compras({ estado: 'Aprobada', documentosPorDecidir: [] }), cumplimiento()]), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(screen.queryByRole('region', { name: 'Compras' })).not.toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
  });

  it('si todas las áreas decidieron lo suyo el panel no se pinta', () => {
    montar(conAreas(conDocumentos('EnRevision'), [compras({ estado: 'Aprobada', documentosPorDecidir: [] }), cumplimiento({ estado: 'Aprobada', documentosPorDecidir: [] })]), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(titulo()).not.toBeInTheDocument();
  });

  it('«Rechazar» solo aparece en el área que puede rechazar el expediente', () => {
    const { region } = montar(conAreas(conDocumentos('EnRevision'), [compras(), cumplimiento({ puedeRechazarExpediente: true })]), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(region('Cumplimiento').getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(region('Compras').queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('cada botón abre su diálogo con el área: aprobar con los documentos por decidir, observar y rechazar', async () => {
    const usuario = userEvent.setup();
    const cumple = cumplimiento({ puedeRechazarExpediente: true });
    const { region, onAccion } = montar(conAreas(conDocumentos('EnRevision'), [cumple]), ['CUMPLIMIENTO']);

    await usuario.click(region('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'aprobarArea', area: cumple, documentos: cumple.documentosPorDecidir });
    await usuario.click(region('Cumplimiento').getByRole('button', { name: 'Observar' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'observarArea', area: cumple });
    await usuario.click(region('Cumplimiento').getByRole('button', { name: 'Rechazar' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'rechazar', area: cumple });
  });
});
