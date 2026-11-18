import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { configurarCliente, reiniciarCliente, SCOPES, type PersonaDelRequisitoDto, type PersonaDelVinculoDto, type RequisitoExpedienteDto } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expediente, requisito } from '../datosPrueba';
import type { ContextoRevisor } from '../reglas';
import { PanelRequisitos } from './PanelRequisitos';

const CONTEXTO: ContextoRevisor = {
  scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.documentosLeer, SCOPES.documentosDescargar]),
  usuarioId: 'u-1',
  esMiembro: true,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const cedulaDe = (persona: PersonaDelRequisitoDto, cambios: Partial<RequisitoExpedienteDto> = {}) =>
  requisito({
    id: 'r-cedula',
    tipoDocumento: { id: 'td-cedula', codigo: 'CEDULA', nombre: 'Cédula de ciudadanía', tipoCanonico: 'CEDULA', ambito: 'Global' },
    versionActual: { documentoId: 'doc-cedula-juan', n: 1, sha256: 'def', cargadaEn: '2026-11-06T14:00:00Z' },
    persona,
    ...cambios,
  });

/** Los documentos de las personas llegan por su propio endpoint y alimentan los hechos de IA de la revisión. */
const PERSONAS: PersonaDelVinculoDto[] = [
  {
    relacionId: 'r1',
    personaId: 'p1',
    identificacion: { pais: 'CO', tipo: 'CC', numero: '1020304050' },
    nombre: 'Juan Pérez',
    tipo: 'RepresentanteLegal',
    principal: true,
    participacion: null,
    cargo: null,
    vigenteDesde: '2026-11-01',
    documentos: [],
  },
];

function montar(requisitos: RequisitoExpedienteDto[]) {
  configurarCliente({
    fetch: vi.fn((entrada: RequisitoInfo) => {
      const url = entrada instanceof Request ? entrada.url : entrada.toString();
      return url.endsWith('/personas-relacionadas') ? Promise.resolve(json(PERSONAS)) : Promise.resolve(json([]));
    }),
  });
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PanelRequisitos expediente={{ ...expediente('EnRevision'), requisitos }} contexto={() => CONTEXTO} nombres={new Map()} onAccion={() => undefined} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

type RequisitoInfo = RequestInfo | URL;

afterEach(() => reiniciarCliente());

describe('el documento de una persona relacionada en la revisión', () => {
  it('dice de quién es la cédula y el rol con el que se relaciona con el tercero', async () => {
    montar([cedulaDe({ rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: false, personaId: 'p1', nombre: 'Juan Pérez', identificacion: 'CO CC 1020304050' })]);

    const tarjeta = (await screen.findByRole('heading', { name: 'Cédula de ciudadanía' })).closest('li') as HTMLElement;
    expect(within(tarjeta).getByText('De Juan Pérez · Representante legal')).toBeInTheDocument();
  });

  it('sin persona dice que el tercero aún no registra a quien cumple el rol, y el requisito pendiente se ve como tal', async () => {
    montar([cedulaDe({ rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: true }, { estado: 'Pendiente', versionActual: null })]);

    const tarjeta = (await screen.findByRole('heading', { name: 'Cédula de ciudadanía' })).closest('li') as HTMLElement;
    expect(within(tarjeta).getByText(/el tercero aún no registra a quién cumple este rol \(representante legal\)/)).toBeInTheDocument();
  });

  it('el documento del propio tercero no dice nada de personas', async () => {
    montar([requisito()]);

    const tarjeta = (await screen.findByRole('heading', { name: 'Registro Único Tributario' })).closest('li') as HTMLElement;
    expect(tarjeta.querySelector('[data-persona-del-requisito]')).toBeNull();
  });
});
