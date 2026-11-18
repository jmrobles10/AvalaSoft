import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { describe, expect, it, vi } from 'vitest';
import { area, expediente, veredicto } from '../datosPrueba';
import type { ContextoRevisor, DialogoExpediente } from '../reglas';
import { EtapasExpediente } from './EtapasExpediente';

/**
 * «Etapas y áreas» de un expediente de un flujo sin documentos: cada área decide sobre el expediente completo. Lo que ve cada persona de
 * la secuencia de etapas, de los aprobadores que faltan, de «Rechazar» y de las acciones de administrador (decisiones, secuencia y ciclo
 * del vínculo en la conversión de las e2e, PC-1).
 */
const REVISOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]);
const ADMINISTRADOR = new Set<string>([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar]);

const etapa = (orden: number, estado: 'Esperando' | 'Activa' | 'Aprobada', areas: AreaExpedienteDto[]) => ({ orden, estado, activadaEn: null, aprobadaEn: null, areas });

function montar(datos: ExpedienteDto, { scopes = REVISOR, usuarioId = 'u-1', miembro = true }: { scopes?: ReadonlySet<string>; usuarioId?: string; miembro?: boolean } = {}) {
  const onAccion = vi.fn<(dialogo: DialogoExpediente) => void>();
  const contexto = (): ContextoRevisor => ({ scopes, usuarioId, esMiembro: miembro });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
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
