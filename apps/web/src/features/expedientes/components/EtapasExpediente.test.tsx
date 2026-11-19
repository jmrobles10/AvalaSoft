import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it, vi } from 'vitest';
import { area, areaDeRequisito, expediente, requisito, veredicto } from '../datosPrueba';
import type { ContextoRevisor, DialogoExpediente } from '../reglas';
import { EtapasExpediente } from './EtapasExpediente';

/**
 * «Etapas y áreas» de un expediente de un flujo sin documentos (y, al final, con ellos): cada área decide sobre el expediente completo. Lo que ve cada persona de
 * la secuencia de etapas, de los aprobadores que faltan, de «Rechazar» y de las acciones de administrador (decisiones, secuencia y ciclo
 * del vínculo en la conversión de las e2e, PC-1).
 */
const REVISOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
const ADMINISTRADOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar]);

const etapa = (orden: number, estado: 'Esperando' | 'Activa' | 'Aprobada', areas: AreaExpedienteDto[]) => ({ orden, estado, activadaEn: null, aprobadaEn: null, areas });

/** `miembroDe` (códigos de área) vuelve a la persona miembro solo de esas áreas; sin él, `miembro` vale para todas. */
function montar(
  datos: ExpedienteDto,
  {
    scopes = REVISOR,
    usuarioId = 'u-1',
    miembro = true,
    miembroDe,
  }: { scopes?: ReadonlySet<string>; usuarioId?: string; miembro?: boolean; miembroDe?: readonly string[] } = {},
) {
  const onAccion = vi.fn<(dialogo: DialogoExpediente) => void>();
  const contexto = (a: AreaExpedienteDto | null): ContextoRevisor => ({ scopes, usuarioId, esMiembro: miembroDe && a ? miembroDe.includes(a.codigo) : miembro });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient()}>
        <EtapasExpediente expediente={datos} contexto={contexto} nombres={new Map()} motivos={new Map()} onAccion={onAccion} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { onAccion, etapa: (orden: number) => within(screen.getByRole('region', { name: `Etapa ${String(orden)}` })) };
}

describe('Etapas y áreas: la secuencia', () => {
  const compras = area({ areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras' });
  const legal = area({ areaId: 'a-legal', codigo: 'LEGAL', nombre: 'Legal', estado: 'Esperando' });
  const cumplimiento = area({ areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO', nombre: 'Cumplimiento', estado: 'Esperando', puedeRechazarExpediente: true });

  it('muestra qué etapa está en curso y cuáles esperan; solo la que está en curso deja emitir veredicto', () => {
    const { etapa: delaEtapa } = montar({
      ...expediente('EnRevision'),
      etapaActual: 1,
      etapas: [etapa(1, 'Activa', [compras]), etapa(2, 'Esperando', [legal]), etapa(3, 'Esperando', [cumplimiento])],
    });

    expect(delaEtapa(1).getByText('· En curso')).toBeInTheDocument();
    expect(delaEtapa(2).getByText('· En espera')).toBeInTheDocument();
    expect(delaEtapa(3).getByText('· En espera')).toBeInTheDocument();
    expect(delaEtapa(1).getByRole('button', { name: 'Emitir veredicto' })).toBeInTheDocument();
    expect(delaEtapa(2).queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
    expect(delaEtapa(2).getByText('Su etapa aún no empieza.')).toBeInTheDocument();
    expect(delaEtapa(3).queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
  });

  it('al aprobarse una etapa la siguiente pasa a estar en curso y la tercera sigue en espera', () => {
    const aprobada = area({ areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras', estado: 'Aprobada', aprobaciones: 1, aprobacionesFaltantes: 0, miembrosPendientes: [], veredictos: [veredicto()] });
    const { etapa: delaEtapa } = montar({
      ...expediente('EnRevision'),
      etapaActual: 2,
      etapas: [etapa(1, 'Aprobada', [aprobada]), etapa(2, 'Activa', [{ ...legal, estado: 'Pendiente' }]), etapa(3, 'Esperando', [cumplimiento])],
    });

    expect(delaEtapa(1).getByText('· Aprobada')).toBeInTheDocument();
    expect(delaEtapa(2).getByText('· En curso')).toBeInTheDocument();
    expect(delaEtapa(2).getByRole('button', { name: 'Emitir veredicto' })).toBeInTheDocument();
    expect(delaEtapa(3).getByText('· En espera')).toBeInTheDocument();
    expect(delaEtapa(3).queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
  });
});

describe('Etapas y áreas: un área con dos aprobadores', () => {
  const comite = area({ areaId: 'a-comite', codigo: 'COMITE', nombre: 'Comité', aprobadoresRequeridos: 2, aprobaciones: 0, aprobacionesFaltantes: 2, miembrosPendientes: ['u-1', 'u-2'] });
  const conUnVoto = area({
    areaId: 'a-comite',
    codigo: 'COMITE',
    nombre: 'Comité',
    aprobadoresRequeridos: 2,
    aprobaciones: 1,
    aprobacionesFaltantes: 1,
    miembrosPendientes: ['u-2'],
    veredictos: [veredicto({ usuario: 'u-1' })],
  });

  it('pide dos aprobaciones y deja emitir el veredicto a quien aún no votó', () => {
    const { etapa: delaEtapa } = montar({ ...expediente('EnRevision', [comite]) });

    expect(delaEtapa(1).getByText('Faltan 2 aprobaciones')).toBeInTheDocument();
    expect(delaEtapa(1).getByRole('button', { name: 'Emitir veredicto' })).toBeInTheDocument();
  });

  it('con la primera aprobación sigue pendiente y quien ya votó no puede votar otra vez, solo otra persona del área', () => {
    const { etapa: yaVoto } = montar({ ...expediente('EnRevision', [conUnVoto]) }, { usuarioId: 'u-1' });

    expect(yaVoto(1).getByText('Falta 1 aprobación')).toBeInTheDocument();
    expect(yaVoto(1).getByText('Ya emitiste tu veredicto; falta otra persona del área.')).toBeInTheDocument();
    expect(yaVoto(1).queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
  });

  it('la otra persona del área sí puede emitir su veredicto', () => {
    const { etapa: otra } = montar({ ...expediente('EnRevision', [conUnVoto]) }, { usuarioId: 'u-2' });

    expect(otra(1).getByText('Falta 1 aprobación')).toBeInTheDocument();
    expect(otra(1).getByRole('button', { name: 'Emitir veredicto' })).toBeInTheDocument();
  });
});

describe('Etapas y áreas: rechazar y acciones de administrador', () => {
  const compras = area({ areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras' });
  const cumplimiento = area({ areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO', nombre: 'Cumplimiento', puedeRechazarExpediente: true });

  it('«Rechazar» solo está en el área que puede rechazar, también con el expediente devuelto al tercero', () => {
    montar(expediente('EnRevision', [compras, cumplimiento]));
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(1);
  });

  it('con el expediente devuelto no se emite veredicto pero Cumplimiento todavía puede rechazar (hallazgo grave)', () => {
    montar(expediente('Observado', [compras, cumplimiento]));

    expect(screen.queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Devuelto al tercero: espera su respuesta.')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(1);
  });

  it('sin ninguna área que pueda rechazar no hay «Rechazar»', () => {
    montar(expediente('EnRevision', [compras, { ...cumplimiento, puedeRechazarExpediente: false }]));
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('quien administra aprueba en nombre del área y anula un veredicto desde su menú; quien solo revisa no lo tiene', async () => {
    const usuario = userEvent.setup();
    const observada = area({
      areaId: 'a-cumplimiento',
      codigo: 'CUMPLIMIENTO',
      nombre: 'Cumplimiento',
      estado: 'Observada',
      veredictos: [veredicto({ veredicto: 'Observado', motivos: ['incompleto'], observacion: 'Falta el certificado de existencia.' })],
    });
    const { onAccion } = montar(expediente('Observado', [compras, observada]), { scopes: ADMINISTRADOR, miembro: false });

    // La observación se puede anular; aprobar en nombre solo mientras el expediente está en revisión.
    await usuario.click(screen.getByRole('button', { name: 'Acciones de administrador en Cumplimiento' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Anular veredicto' }));
    expect(onAccion).toHaveBeenCalledWith({ tipo: 'anularVeredicto', area: observada });
  });

  it('en revisión, el menú de administrador de un área pendiente ofrece aprobar en su nombre', async () => {
    const usuario = userEvent.setup();
    const { onAccion } = montar(expediente('EnRevision', [compras, cumplimiento]), { scopes: ADMINISTRADOR, miembro: false });

    expect(screen.queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Acciones de administrador en Compras' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Aprobar en nombre del área' }));
    expect(onAccion).toHaveBeenCalledWith({ tipo: 'aprobarComoAdministrador', area: compras });
  });

  it('quien solo revisa no ve el menú de administrador', () => {
    montar(expediente('EnRevision', [compras, cumplimiento]));
    expect(screen.queryByRole('button', { name: /Acciones de administrador/ })).not.toBeInTheDocument();
  });

  it('un veredicto anulado queda a la vista y el área vuelve a Pendiente', () => {
    const anulada = area({
      areaId: 'a-cumplimiento',
      codigo: 'CUMPLIMIENTO',
      nombre: 'Cumplimiento',
      estado: 'Pendiente',
      veredictos: [veredicto({ veredicto: 'Observado', vigente: false, anulado: true, anuladoPor: 'u-admin' })],
    });
    montar(expediente('EnRevision', [compras, anulada]));

    const tarjeta = screen.getByRole('heading', { level: 4, name: 'Cumplimiento' }).parentElement?.parentElement?.parentElement;
    if (!tarjeta) throw new Error('sin tarjeta del área');
    expect(within(tarjeta).getByText(/Anulado/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Pendiente/)).toBeInTheDocument();
  });
});

/**
 * En un flujo con documentos el área decide aprobando u observando lo suyo («Lo que te toca decidir» arriba, y aquí el mismo trío de
 * acciones en la tarjeta del área): Compras revisa el RUT y Cumplimiento el RUT y la Cámara de comercio. Donde la persona no puede
 * decidir, la tarjeta dice por qué; «Rechazar» no depende de poder decidir.
 */
describe('Etapas y áreas: un flujo con documentos', () => {
  const RUT = requisito({ areas: [areaDeRequisito({ areaId: 'a-compras', codigo: 'COMPRAS' }), areaDeRequisito({ areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO' })] });
  const CAMARA = requisito({
    id: 'r-camara',
    tipoDocumento: { id: 'td-cc', codigo: 'CAMARA_COMERCIO', nombre: 'Cámara de comercio', tipoCanonico: 'CAMARA_COMERCIO', ambito: 'Global' },
    areas: [areaDeRequisito({ areaId: 'a-cumplimiento', codigo: 'CUMPLIMIENTO' })],
  });
  const compras = (cambios: Partial<AreaExpedienteDto> = {}) =>
    area({ areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras', documentosPorDecidir: [{ requisitoId: 'r-rut', versionVigente: 1 }], ...cambios });
  const cumplimiento = (cambios: Partial<AreaExpedienteDto> = {}) =>
    area({
      areaId: 'a-cumplimiento',
      codigo: 'CUMPLIMIENTO',
      nombre: 'Cumplimiento',
      puedeRechazarExpediente: true,
      documentosPorDecidir: [
        { requisitoId: 'r-rut', versionVigente: 1 },
        { requisitoId: 'r-camara', versionVigente: 1 },
      ],
      ...cambios,
    });
  const conDocumentos = (estado: ExpedienteDto['estado'], areas: AreaExpedienteDto[] = [compras(), cumplimiento()]): ExpedienteDto => ({ ...expediente(estado, areas), requisitos: [RUT, CAMARA] });
  const tarjeta = (nombre: string) => within(screen.getByRole('region', { name: nombre }));

  it('donde puede decidir la tarjeta ofrece «Aprobar área», «Observar» y, si el área puede, «Rechazar»; no «Emitir veredicto»', () => {
    montar(conDocumentos('EnRevision'));

    expect(tarjeta('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
    expect(tarjeta('Compras').getByRole('button', { name: 'Observar' })).toBeInTheDocument();
    expect(tarjeta('Compras').queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    expect(tarjeta('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
    expect(tarjeta('Cumplimiento').getByRole('button', { name: 'Observar' })).toBeInTheDocument();
    expect(tarjeta('Cumplimiento').getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir veredicto' })).not.toBeInTheDocument();
  });

  it('cada botón abre su diálogo con el área', async () => {
    const usuario = userEvent.setup();
    const cumple = cumplimiento();
    const { onAccion } = montar(conDocumentos('EnRevision', [cumple]));

    await usuario.click(tarjeta('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'aprobarArea', area: cumple, documentos: cumple.documentosPorDecidir });
    await usuario.click(tarjeta('Cumplimiento').getByRole('button', { name: 'Observar' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'observarArea', area: cumple });
    await usuario.click(tarjeta('Cumplimiento').getByRole('button', { name: 'Rechazar' }));
    expect(onAccion).toHaveBeenLastCalledWith({ tipo: 'rechazar', area: cumple });
  });

  it('quien no es del área lee que no es miembro y no puede aprobarla ni observarla (ni rechazar), pero la suya sí', () => {
    montar(conDocumentos('EnRevision'), { scopes: ADMINISTRADOR, miembroDe: ['COMPRAS'] });

    expect(tarjeta('Cumplimiento').getByText('No eres miembro de esta área.')).toBeInTheDocument();
    expect(tarjeta('Cumplimiento').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(tarjeta('Cumplimiento').queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
    expect(tarjeta('Cumplimiento').queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    expect(tarjeta('Compras').getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeInTheDocument();
    expect(tarjeta('Compras').queryByText('No eres miembro de esta área.')).not.toBeInTheDocument();
  });

  it('con el expediente devuelto nadie aprueba ni observa y cada tarjeta lo explica, pero Cumplimiento todavía puede rechazar', () => {
    montar(conDocumentos('Observado'));

    for (const nombre of ['Compras', 'Cumplimiento']) {
      expect(tarjeta(nombre).getByText('Devuelto al tercero: espera su respuesta.')).toBeInTheDocument();
      expect(tarjeta(nombre).queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
      expect(tarjeta(nombre).queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
    }
    expect(tarjeta('Cumplimiento').getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(tarjeta('Compras').queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });

  it('un área que ya decidió todo lo suyo dice que falta otra persona o el tercero, sin botones de decisión', () => {
    montar(conDocumentos('EnRevision', [compras({ documentosPorDecidir: [] }), cumplimiento()]));

    expect(tarjeta('Compras').getByText('Ya decidiste todo lo de esta área; falta otra persona o la respuesta del tercero.')).toBeInTheDocument();
    expect(tarjeta('Compras').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(tarjeta('Cumplimiento').getByRole('button', { name: 'Aprobar área (2 documentos)' })).toBeInTheDocument();
  });

  it('un área cuya etapa aún no empieza lo dice, y un área aprobada o sin documentos no explica nada', () => {
    const legal = area({ areaId: 'a-legal', codigo: 'LEGAL', nombre: 'Legal', estado: 'Pendiente' });
    const datos = conDocumentos('EnRevision', [compras({ estado: 'Aprobada', documentosPorDecidir: [] }), legal, cumplimiento({ estado: 'Esperando', documentosPorDecidir: [] })]);
    montar(datos);

    expect(tarjeta('Cumplimiento').getByText('Su etapa aún no empieza.')).toBeInTheDocument();
    expect(tarjeta('Compras').queryByText(/Ya decidiste todo/)).not.toBeInTheDocument();
    expect(tarjeta('Compras').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(tarjeta('Legal').queryByText(/Ya decidiste todo/)).not.toBeInTheDocument();
    expect(tarjeta('Legal').queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
  });

  it('quien solo lee el expediente no ve botones de decisión ni explicaciones', () => {
    montar(conDocumentos('EnRevision'), { scopes: new Set<string>([SCOPES.expedientesLeer]) });

    expect(screen.queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
    expect(screen.queryByText('No eres miembro de esta área.')).not.toBeInTheDocument();
  });

  it('un flujo sin documentos sigue con «Emitir veredicto» y «Rechazar», sin «Aprobar área» ni «Observar»', () => {
    montar(expediente('EnRevision', [area({ areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras', puedeRechazarExpediente: true })]));

    expect(screen.getByRole('button', { name: 'Emitir veredicto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aprobar área/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Observar' })).not.toBeInTheDocument();
  });
});
