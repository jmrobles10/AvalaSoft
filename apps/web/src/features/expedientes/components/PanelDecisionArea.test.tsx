import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { describe, expect, it } from 'vitest';
import { area, areaDeRequisito, expediente, requisito } from '../datosPrueba';
import type { ContextoRevisor } from '../reglas';
import { PanelDecisionArea } from './PanelDecisionArea';

/**
 * «Decisión de cada área» de un expediente con documentos: Compras revisa el RUT y Cumplimiento el RUT y la Cámara de comercio. Lo que
 * ve cada persona según su pertenencia al área y el estado del expediente (decisiones de la conversión de las e2e, PC-1).
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
  const contexto = (a: AreaExpedienteDto | null): ContextoRevisor => ({ scopes, usuarioId: 'u-1', esMiembro: a ? miembroDe.includes(a.codigo) : null });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient()}>
        <PanelDecisionArea expediente={datos} contexto={contexto} onAccion={() => undefined} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return (nombre: string) => within(screen.getByRole('region', { name: nombre }));
}

describe('Decisión de cada área', () => {
  it('quien es del área ve «Aprobar área» con cuántos documentos aprueba y «Observar»', () => {
    const region = montar(conDocumentos('EnRevision'), ['COMPRAS', 'CUMPLIMIENTO']);

    expect(region('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Observar' })).toBeInTheDocument();
    expect(region('Cumplimiento').getByText('Certificado de existencia y representación legal')).toBeInTheDocument();
  });

  it('de cada documento dice la versión que se decide: si el tercero subió otra, es la nueva', () => {
    const rutV2 = { ...RUT, versionActual: { documentoId: 'doc-rut', n: 2, sha256: 'huella-2', cargadaEn: '2026-11-07T14:00:00Z' } };
    const datos = { ...expediente('EnRevision', [compras({ documentosPorDecidir: [{ requisitoId: 'r-rut', versionVigente: 2 }] }), cumplimiento()]), requisitos: [rutV2, CAMARA] };
    const region = montar(datos, ['COMPRAS', 'CUMPLIMIENTO']);

    expect(region('Compras').getByText(/Registro Único Tributario/)).toHaveTextContent('Registro Único Tributario · v2');
    expect(region('Cumplimiento').getByText(/Certificado de existencia y representación legal/)).toHaveTextContent('· v1');
  });

  it('quien no es del área, aunque administre, lee por qué y no puede aprobarla; la suya sí', () => {
    const region = montar(conDocumentos('EnRevision'), ['COMPRAS'], ADMINISTRADOR);

    expect(region('Cumplimiento').getByText('No eres miembro de esta área.')).toBeInTheDocument();
    expect(region('Cumplimiento').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(region('Cumplimiento').queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
    expect(region('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
  });

  it('con el expediente devuelto al tercero nadie aprueba ni observa: dice que espera su respuesta', () => {
    const region = montar(conDocumentos('Observado'), ['COMPRAS', 'CUMPLIMIENTO']);

    for (const nombre of ['Compras', 'Cumplimiento']) {
      expect(region(nombre).getByText('Devuelto al tercero: espera su respuesta.')).toBeInTheDocument();
      expect(region(nombre).queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
      expect(region(nombre).queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
    }
  });

  it('un área que ya decidió todo lo suyo no ofrece aprobar otra vez', () => {
    const region = montar({ ...conDocumentos('EnRevision'), etapas: [{ ...conDocumentos('EnRevision').etapas[0]!, areas: [compras({ estado: 'Aprobada', documentosPorDecidir: [] }), cumplimiento()] }] }, [
      'COMPRAS',
      'CUMPLIMIENTO',
    ]);

    expect(region('Compras').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(region('Compras').getByText('Aprobada')).toBeInTheDocument();
    expect(region('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
  });
});
