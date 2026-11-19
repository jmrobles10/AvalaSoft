import type { GrupoDeAccesoDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import { aAsignaciones, aFilasDeGrupos, gruposElegibles, rolesComoGrupos } from './grupos';
import { ALCANCE_TENANT } from './roles';

const grupo = (id: string, cambios: Partial<GrupoDeAccesoDto> = {}): GrupoDeAccesoDto => ({
  id,
  codigo: id.toUpperCase(),
  nombre: id,
  descripcion: null,
  activo: true,
  predefinido: false,
  rol: null,
  permisos: ['expedientes:leer'],
  sectores: [],
  usuarios: 0,
  creadoEn: null,
  actualizadoEn: null,
  ...cambios,
});

const GRUPOS = [
  grupo('p-admin', { predefinido: true, rol: 'Administrador' }),
  grupo('p-revisor', { predefinido: true, rol: 'Revisor' }),
  grupo('tesoreria'),
  grupo('antiguo', { activo: false }),
];

describe('Asignación de grupos a una persona', () => {
  it('lleva las asignaciones al formulario y de vuelta, sin duplicados ni filas sin grupo', () => {
    expect(aFilasDeGrupos([{ grupoId: 'tesoreria', empresaId: null }, { grupoId: 'tesoreria', empresaId: 'e1' }])).toEqual([
      { grupoId: 'tesoreria', alcance: ALCANCE_TENANT },
      { grupoId: 'tesoreria', alcance: 'e1' },
    ]);
    expect(
      aAsignaciones([
        { grupoId: 'tesoreria', alcance: 'e1' },
        { grupoId: 'tesoreria', alcance: 'e1' },
        { grupoId: '', alcance: 'e1' },
        { grupoId: 'tesoreria', alcance: ALCANCE_TENANT },
      ]),
    ).toEqual([
      { grupoId: 'tesoreria', empresaId: 'e1' },
      { grupoId: 'tesoreria', empresaId: null },
    ]);
  });

  it('los roles viajan como sus grupos predefinidos: así PUT /grupos reemplaza todo de una vez sin perder ninguno', () => {
    expect(
      rolesComoGrupos(
        [
          { rol: 'Revisor', empresaId: 'e1' },
          { rol: 'Administrador', empresaId: null },
        ],
        GRUPOS,
      ),
    ).toEqual([
      { grupoId: 'p-revisor', empresaId: 'e1' },
      { grupoId: 'p-admin', empresaId: null },
    ]);
    // Un rol sin grupo predefinido en la lista (aún no cargó) se descarta: quien llama debe esperar la lista.
    expect(rolesComoGrupos([{ rol: 'Auditor', empresaId: null }], GRUPOS)).toEqual([]);
  });

  it('solo se eligen grupos propios activos, más el que la fila ya tiene aunque se haya desactivado', () => {
    expect(gruposElegibles(GRUPOS, '').map((g) => g.id)).toEqual(['tesoreria']);
    expect(gruposElegibles(GRUPOS, 'antiguo').map((g) => g.id)).toEqual(['tesoreria', 'antiguo']);
  });
});
