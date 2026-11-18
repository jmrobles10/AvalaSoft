import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, reiniciarEdiciones, SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@avalasoft/api-client';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSesion } from '../../../sesion/sesionStore';
import { iniciarSesionDePrueba, json, montar, prepararApi } from '../../notificaciones/pruebas/entorno';
import { useStreamNotificaciones } from '../../notificaciones/useStreamNotificaciones';
import { useExpediente } from '../api';
import { documentosPorDecidir } from '../decisionArea';
import { area, expediente, requisito } from '../datosPrueba';
import { dialogoAplica, type ContextoRevisor, type DialogoDeArea } from '../reglas';
import { DialogoDecisionArea } from './DialogoDecisionArea';

/**
 * «Aprobar área» abierto con la pantalla vieja: mientras Olga decide, el tercero sube la versión 2 del RUT y el aviso en tiempo real
 * (NT-12) refresca el expediente. El diálogo debe darse cuenta solo y no dejar confirmar una decisión sobre una versión superada
 * (conversión de la e2e `actualizaciones`, PC-1; que el servidor la rechaza con 409 `version-superada` ya se prueba en integración).
 */
const CONTEXTO: ContextoRevisor = { scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]), usuarioId: 'u-1', esMiembro: true };

const conVersion = (n: number): ExpedienteDto => {
  const porDecidir: AreaExpedienteDto = area({ documentosPorDecidir: [{ requisitoId: 'r-rut', versionVigente: n }] });
  return { ...expediente('EnRevision', [porDecidir]), requisitos: [requisito({ versionActual: { documentoId: 'doc-rut', n, sha256: `huella-${String(n)}`, cargadaEn: '2026-11-06T14:00:00Z' } })] };
};

const evento = (tipo: string, datos: unknown) => `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;

/** El detalle: pide el expediente, escucha el tiempo real y abre «Aprobar área» con lo que ve en ese momento. */
function Detalle() {
  useStreamNotificaciones('emp', { base: 5, maximo: 20 });
  const consulta = useExpediente('emp', 'e1');
  const [dialogo, setDialogo] = useState<DialogoDeArea | null>(null);
  const datos = consulta.data;
  if (!datos) return null;
  const delArea = datos.etapas[0]!.areas[0]!;
  return (
    <>
      <p>{`RUT v${String(datos.requisitos?.[0]?.versionActual?.n ?? 0)}`}</p>
      <button type="button" onClick={() => setDialogo({ tipo: 'aprobarArea', area: delArea, documentos: documentosPorDecidir(delArea) })}>
        Abrir aprobación
      </button>
      {dialogo && (
        <DialogoDecisionArea
          dialogo={dialogo}
          expediente={datos}
          empresaId="emp"
          motivos={[]}
          aplica={dialogoAplica(dialogo, datos, () => CONTEXTO)}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </>
  );
}

beforeEach(() => {
  iniciarSesionDePrueba();
});

afterEach(() => {
  reiniciarCliente();
  reiniciarEdiciones();
  useSesion.setState({ sesion: null, estado: 'sin-sesion' });
});

describe('«Aprobar área» y una versión nueva que llega con el diálogo abierto', () => {
  it('el diálogo avisa solo que ya no aplica y no deja confirmar; al cerrarlo y volver a abrirlo aprueba la versión nueva', async () => {
    const usuario = userEvent.setup();
    let servidor = conVersion(1);
    const { streams, peticiones } = prepararApi(() => json(200, servidor));
    montar(<Detalle />);

    await screen.findByText('RUT v1');
    await waitFor(() => expect(streams).toHaveLength(1));
    await usuario.click(screen.getByRole('button', { name: 'Abrir aprobación' }));
    const aprobar = await screen.findByRole('button', { name: 'Aprobar área (1 documento)' });
    expect(aprobar).toBeEnabled();
    expect(screen.queryByText(/ya no aplica a su estado actual/)).not.toBeInTheDocument();

    // El tercero sube la versión 2 y el servidor avisa que el expediente cambió: sin recargar, el diálogo lo dice y se bloquea.
    servidor = conVersion(2);
    act(() => streams[0]?.enviar(evento('cambio', { recurso: 'expediente', id: 'e1', vinculoId: 'vin' })));
    expect(await screen.findByText('El expediente cambió y esta decisión ya no aplica a su estado actual.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar área (1 documento)' })).toBeDisabled();
    expect(peticiones.some((p) => p.metodo === 'POST')).toBe(false);

    // Cierra, ya ve la versión 2 y aprueba sobre ella.
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(await screen.findByText('RUT v2')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Abrir aprobación' }));
    const nueva = await screen.findByRole('button', { name: 'Aprobar área (1 documento)' });
    expect(nueva).toBeEnabled();
    await usuario.click(nueva);

    await waitFor(() => expect(peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toEqual({ veredicto: 'Aprobado', versiones: { 'r-rut': 2 } }));
  });
});
