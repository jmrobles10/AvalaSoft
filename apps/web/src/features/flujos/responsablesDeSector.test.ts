import type { FlujoVersionDto } from '@avalasoft/api-client';
import { describe, expect, it } from 'vitest';
import { areaNueva, borradorDesdeVersion, borradorVacio, firmaBorrador, limpiarAreasDeRequisitos, responsablesDeSectorADto, type BorradorFlujo } from './editor';

function borrador(cambios: Partial<BorradorFlujo> = {}): BorradorFlujo {
  return {
    ...borradorVacio(),
    codigo: 'HAB_CLIENTE',
    nombre: 'Habilitación',
    tipoVinculo: 'CLIENTE',
    etapas: [{ clave: 'e1', areas: [areaNueva('compras'), areaNueva('cumplimiento')] }],
    ...cambios,
  };
}

const VERSION: FlujoVersionDto = {
  id: 'v1',
  version: 2,
  estado: 'Borrador',
  etapas: [{ orden: 1, areas: [{ areaId: 'compras', aprobadoresRequeridos: 1, puedeRechazarExpediente: false, automatica: false, slaHoras: null }] }],
  politicaDevolucion: 'Inmediata',
  separacionDeFunciones: false,
  creadaEn: '2026-11-14T10:00:00Z',
  publicadaEn: null,
  retiradaEn: null,
  responsablesDeSector: [{ sector: 'FICHA_TRIBUTARIA', areaId: 'compras' }],
};

describe('Responsable por sector en el editor de flujos', () => {
  it('un borrador nuevo no tiene responsables: todo se revisa como siempre', () => {
    expect(borradorVacio().responsablesDeSector).toEqual([]);
    expect(responsablesDeSectorADto(borradorVacio().responsablesDeSector)).toEqual([]);
  });

  it('lleva los responsables de una versión al editor y de vuelta a la API; una versión anterior sin el campo queda sin responsables', () => {
    const base = { codigo: 'HAB', nombre: 'Habilitación', tipoVinculo: 'CLIENTE' };
    expect(borradorDesdeVersion(base, VERSION).responsablesDeSector).toEqual([{ sector: 'FICHA_TRIBUTARIA', areaId: 'compras' }]);
    expect(responsablesDeSectorADto(borradorDesdeVersion(base, VERSION).responsablesDeSector)).toEqual([{ sector: 'FICHA_TRIBUTARIA', areaId: 'compras' }]);
    expect(borradorDesdeVersion(base, { ...VERSION, responsablesDeSector: undefined }).responsablesDeSector).toEqual([]);
  });

  it('se envían en el orden de la ficha y sin filas a medias', () => {
    expect(
      responsablesDeSectorADto([
        { sector: 'FICHA_LEGAL', areaId: 'cumplimiento' },
        { sector: 'FICHA_GENERAL', areaId: 'compras' },
        { sector: 'FICHA_SST', areaId: '' },
        { sector: '', areaId: 'compras' },
      ]),
    ).toEqual([
      { sector: 'FICHA_GENERAL', areaId: 'compras' },
      { sector: 'FICHA_LEGAL', areaId: 'cumplimiento' },
    ]);
  });

  it('quitar un área del flujo quita sus responsabilidades: el sector vuelve a revisarse como siempre', () => {
    const conResponsables = borrador({
      responsablesDeSector: [
        { sector: 'FICHA_GENERAL', areaId: 'compras' },
        { sector: 'FICHA_TRIBUTARIA', areaId: 'cumplimiento' },
      ],
    });
    const sinCumplimiento = limpiarAreasDeRequisitos({ ...conResponsables, etapas: [{ clave: 'e1', areas: [areaNueva('compras')] }] });
    expect(sinCumplimiento.responsablesDeSector).toEqual([{ sector: 'FICHA_GENERAL', areaId: 'compras' }]);
  });

  it('cambiar un responsable cambia la firma (hay cambios sin guardar)', () => {
    const a = borrador();
    const b = borrador({ responsablesDeSector: [{ sector: 'FICHA_GENERAL', areaId: 'compras' }] });
    expect(firmaBorrador(a)).not.toBe(firmaBorrador(b));
    expect(firmaBorrador(b)).toBe(firmaBorrador(borrador({ responsablesDeSector: [{ sector: 'FICHA_GENERAL', areaId: 'compras' }] })));
  });
});
