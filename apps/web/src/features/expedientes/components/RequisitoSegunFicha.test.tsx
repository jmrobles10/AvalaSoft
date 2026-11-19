import { screen, within } from '@testing-library/react';
import { SCOPES, type RequisitoExpedienteDto } from '@validalo/api-client';
import { beforeEach, describe, expect, it } from 'vitest';
import { montarPantalla } from '../../../pruebas/montar';
import { simularApi } from '../../../pruebas/simularApi';
import { expediente, requisito } from '../datosPrueba';
import type { ContextoRevisor } from '../reglas';
import { PanelRequisitos } from './PanelRequisitos';

const CONTEXTO: ContextoRevisor = {
  scopes: new Set([SCOPES.expedientesLeer, SCOPES.expedientesRevisar, SCOPES.expedientesAdministrar, SCOPES.documentosLeer, SCOPES.documentosDescargar]),
  usuarioId: 'u-1',
  esMiembro: true,
};

const camara = (cambios: Partial<RequisitoExpedienteDto>) =>
  requisito({
    id: 'r-camara',
    tipoDocumento: { id: 'td-camara', codigo: 'CAMARA_COMERCIO', nombre: 'Cámara de comercio', tipoCanonico: 'CAMARA_COMERCIO', ambito: 'Global' },
    ...cambios,
  });

function montar(requisitos: RequisitoExpedienteDto[]) {
  montarPantalla(<PanelRequisitos expediente={{ ...expediente('EnRevision'), requisitos }} contexto={() => CONTEXTO} nombres={new Map()} onAccion={() => undefined} />);
}

const tarjeta = async (nombre: string) => (await screen.findByRole('heading', { name: nombre })).closest('li') as HTMLElement;

describe('documentos según la ficha del tercero en la revisión (EF-5, EF-6)', () => {
  beforeEach(() => {
    simularApi({});
  });

  it('el revisor ve por qué se pide un documento: lo que el tercero declaró en su ficha', async () => {
    montar([camara({ porQue: [{ campo: 'ficha.especialidades.especialidades', etiqueta: 'Especialidades', valores: ['Obra gris'] }] })]);

    expect(within(await tarjeta('Cámara de comercio')).getByText('Se pide porque el tercero declaró en su ficha: Especialidades: Obra gris.')).toBeInTheDocument();
  });

  it('un documento que se pide siempre no trae explicación', async () => {
    montar([camara({})]);

    expect((await tarjeta('Cámara de comercio')).querySelector('[data-por-que]')).toBeNull();
  });

  it('uno que ya no aplica lo dice, se ve «No aplica» y no ofrece eximirlo ni decidirlo', async () => {
    montar([camara({ estado: 'NoAplica', porQue: [{ campo: 'ficha.especialidades.especialidades', etiqueta: 'Especialidades', valores: ['Obra gris'] }] })]);

    const fila = within(await tarjeta('Cámara de comercio'));
    expect(fila.getByText(/Ya no aplica: lo que el tercero declaró en su ficha dejó de cumplir la condición/)).toBeInTheDocument();
    expect(fila.getAllByText('No aplica').length).toBeGreaterThan(0);
    expect(fila.queryByRole('button', { name: 'Eximir' })).not.toBeInTheDocument();
    expect(fila.queryByText(/Se pide porque el tercero declaró/)).not.toBeInTheDocument(); // ya no se pide: el porqué viejo no se muestra
  });
});
