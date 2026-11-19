import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type ExpedienteDto, type RequisitoExpedienteDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { areaDeRequisito, expediente, requisito } from '../datosPrueba';
import type { ContextoRevisor, DialogoExpediente } from '../reglas';
import { PanelRequisitos } from './PanelRequisitos';

/** Eximir un documento (RQ-6): quién ve la acción y cómo queda el documento eximido en «Documentos que pide el flujo». */
const ANA = '0f8c8b6a-5f2a-4c3a-9d6e-1a2b3c4d5e6f';
const ADMIN: ContextoRevisor = { scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar]), usuarioId: 'u-1', esMiembro: true };
const REVISOR: ContextoRevisor = { scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar]), usuarioId: 'u-1', esMiembro: true };

const camara = (cambios: Partial<RequisitoExpedienteDto> = {}) =>
  requisito({
    id: 'r-camara',
    tipoDocumento: { id: 'td-camara', codigo: 'CAMARA_COMERCIO', nombre: 'Certificado de existencia y representación legal', tipoCanonico: 'CAMARA_COMERCIO', ambito: 'Global' },
    estado: 'Pendiente',
    versionActual: null,
    ...cambios,
  });

const JUSTIFICACION = 'Es una persona jurídica sin Cámara de comercio: está inscrita en la Cámara de otro país.';
const eximida = camara({
  estado: 'Eximido',
  exencion: { por: ANA, fecha: '2026-11-12T15:00:00Z', justificacion: JUSTIFICACION },
  areas: [areaDeRequisito({ estado: 'Eximido' })],
});

function montar(datos: ExpedienteDto, contexto: ContextoRevisor, onAccion: (d: DialogoExpediente) => void = () => undefined) {
  configurarCliente({ fetch: vi.fn(() => new Promise<Response>(() => undefined)) });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient()}>
        <PanelRequisitos expediente={datos} contexto={() => contexto} nombres={new Map([[ANA, 'Ana Administradora']])} onAccion={onAccion} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return within(screen.getByRole('heading', { name: 'Certificado de existencia y representación legal' }).closest('li') as HTMLElement);
}

afterEach(() => reiniciarCliente());

describe('Documentos que pide el flujo: eximir (RQ-6)', () => {
  it('el administrador ve «Eximir» en un documento que falta y lo pide con ese documento', async () => {
    const usuario = userEvent.setup();
    const onAccion = vi.fn();
    const pendiente = camara();
    const tarjeta = montar({ ...expediente('Abierto'), requisitos: [pendiente] }, ADMIN, onAccion);

    await usuario.click(tarjeta.getByRole('button', { name: 'Eximir' }));

    expect(onAccion).toHaveBeenCalledWith({ tipo: 'eximir', requisito: pendiente });
  });

  it('quien solo revisa no ve «Eximir»', () => {
    const tarjeta = montar({ ...expediente('Abierto'), requisitos: [camara()] }, REVISOR);

    expect(tarjeta.queryByRole('button', { name: 'Eximir' })).not.toBeInTheDocument();
  });

  it('un documento eximido dice quién lo eximió, cuándo y por qué, y ya no ofrece eximirlo', () => {
    const tarjeta = montar({ ...expediente('EnRevision'), requisitos: [eximida] }, ADMIN);

    // El documento y cada área que lo revisaba se ven «Eximido».
    expect(tarjeta.getAllByText('Eximido')[0]?.closest('[data-estado]')).toHaveAttribute('data-estado', 'Eximido');
    expect(tarjeta.getByText(new RegExp(`Eximido por Ana Administradora el .*: “${JUSTIFICACION}”`))).toBeInTheDocument();
    expect(tarjeta.queryByRole('button', { name: 'Eximir' })).not.toBeInTheDocument();
  });
});
