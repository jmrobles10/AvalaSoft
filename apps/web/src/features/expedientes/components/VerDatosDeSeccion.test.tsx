import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type RequisitoExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENTO } from '../../terceros/pruebas/datos';
import { expediente, requisitoSeccion } from '../datosPrueba';
import type { ContextoRevisor } from '../reglas';
import { PanelDecisionArea } from './PanelDecisionArea';

const CONTEXTO: ContextoRevisor = {
  scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.documentosLeer, SCOPES.documentosDescargar]),
  usuarioId: 'u-1',
  esMiembro: true,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

/** El panel de decisión por área con un requisito de sección; los documentos del vínculo traen el RUT (doc d1, versión 2) como soporte. */
function montar(requisito: RequisitoExpedienteDto) {
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = entrada instanceof Request ? entrada.url : entrada.toString();
      // La descarga del soporte no responde: basta con que el visor se abra.
      return url.endsWith('/api/v1/vinculos/vin/documentos') ? Promise.resolve(json([DOCUMENTO])) : new Promise<Response>(() => undefined);
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PanelDecisionArea expediente={{ ...expediente('EnRevision'), requisitos: [requisito] }} contexto={() => CONTEXTO} onAccion={() => undefined} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => reiniciarCliente());

describe('Decisión por área: «Ver datos» de un requisito de sección', () => {
  it('muestra los datos que llenó el tercero en la sección, con el título de la versión, y no el aviso de formulario vacío', async () => {
    const usuario = userEvent.setup();
    montar(requisitoSeccion({}, { soportes: [{ documentoId: 'd1', version: 2, tipoDocumento: 'RUT' }] }));

    await usuario.click(screen.getByRole('button', { name: 'Ver los datos de Información general, versión 3' }));
    const visor = within(screen.getByRole('dialog'));
    expect(visor.getByRole('heading', { name: /^Información general · Versión 3 · \d{2}\/\d{2}\/\d{4}$/ })).toBeInTheDocument();
    expect(visor.getByRole('region', { name: 'Datos de la versión 3' })).toHaveTextContent('Razón socialAceros del Norte S.A.S.');
    expect(visor.getByText('Completa para la empresa')).toBeInTheDocument();
    expect(visor.queryByText('El tercero no declaró datos en esta versión.')).not.toBeInTheDocument();
    expect(visor.queryByText('Esta versión es un formulario: no tiene archivo para ver ni descargar.')).not.toBeInTheDocument();
    expect(visor.queryByText(/Formulario, sin archivo/)).not.toBeInTheDocument();

    // Los soportes de la sección abren en el visor, encima del detalle.
    await usuario.click(await visor.findByRole('button', { name: 'Ver el soporte RUT, versión 2' }));
    expect(await screen.findByRole('heading', { name: /^RUT · Versión 2/ })).toBeInTheDocument();
  });

  it('sin acceso a la sección (grupo acotado por sector, `Datos` nulo) avisa que no tiene acceso en vez de decir que no declaró datos', async () => {
    const usuario = userEvent.setup();
    montar(requisitoSeccion({}, { datos: null, soportes: [], cambios: [], cruce: null, sinSoporte: null }));

    await usuario.click(screen.getByRole('button', { name: 'Ver los datos de Información general, versión 3' }));
    const visor = within(screen.getByRole('dialog'));
    expect(visor.getByText('No tienes acceso a los datos de esta sección: tu grupo de acceso solo ve las secciones de sus sectores.')).toBeInTheDocument();
    expect(visor.queryByText('El tercero no declaró datos en esta versión.')).not.toBeInTheDocument();
    expect(visor.queryByRole('region', { name: /^Datos de la versión/ })).not.toBeInTheDocument();
  });
});
