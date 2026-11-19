import type { GrupoDeAccesoDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import { alternarSector, cambiarNivel, enOrdenDeLaFicha, firmaDeGrupo, grupoDesde, grupoNuevo, normalizarCodigoDeGrupo, sectoresADto, validarGrupo } from './modelo';

const dto = (cambios: Partial<GrupoDeAccesoDto> = {}): GrupoDeAccesoDto => ({
  id: 'g1',
  codigo: 'TESORERIA',
  nombre: 'Tesorería',
  descripcion: null,
  activo: true,
  predefinido: false,
  rol: null,
  permisos: ['expedientes:leer', 'expedientes:revisar'],
  sectores: [],
  usuarios: 2,
  creadoEn: '2026-11-14T10:00:00Z',
  actualizadoEn: null,
  ...cambios,
});

describe('Grupos de acceso: modelo del editor', () => {
  it('un grupo nuevo pide código, nombre y al menos un permiso', () => {
    expect(validarGrupo(grupoNuevo(), true)).toEqual(['codigo-invalido', 'nombre-requerido', 'permisos-requeridos']);
    expect(validarGrupo({ ...grupoNuevo(), codigo: ' tesoreria ', nombre: 'Tesorería', permisos: ['expedientes:leer'] }, true)).toEqual([]);
  });

  it('el código es mayúsculas con letra al inicio; al editar ya no se valida porque no cambia', () => {
    const base = { ...grupoNuevo(), nombre: 'Tesorería', permisos: ['expedientes:leer'] };
    expect(validarGrupo({ ...base, codigo: '1TESORERIA' }, true)).toEqual(['codigo-invalido']);
    expect(validarGrupo({ ...base, codigo: 'A' }, true)).toEqual(['codigo-invalido']);
    expect(validarGrupo({ ...base, codigo: 'con espacios' }, true)).toEqual(['codigo-invalido']);
    expect(validarGrupo({ ...base, codigo: '' }, false)).toEqual([]);
    expect(normalizarCodigoDeGrupo(' tesoreria_pagos ')).toBe('TESORERIA_PAGOS');
  });

  it('limita el nombre a 80 caracteres y la descripción a 300', () => {
    const base = { ...grupoNuevo(), codigo: 'OK', permisos: ['expedientes:leer'] };
    expect(validarGrupo({ ...base, nombre: 'x'.repeat(81) }, true)).toEqual(['nombre-demasiado-largo']);
    expect(validarGrupo({ ...base, nombre: 'Nombre', descripcion: 'x'.repeat(301) }, true)).toEqual(['descripcion-demasiado-larga']);
  });

  it('lleva un grupo de la API al editor, sin perder permisos ni sectores, y descarta un sector que la web no conoce', () => {
    const editor = grupoDesde(
      dto({
        descripcion: 'Aprueba cuentas',
        sectores: [
          { sector: 'FICHA_TRIBUTARIA', nivel: 'Ver' },
          { sector: 'FICHA_GENERAL', nivel: 'Editar' },
          { sector: 'FICHA_NUEVA', nivel: 'Ver' },
        ],
      }),
    );
    expect(editor).toEqual({
      codigo: 'TESORERIA',
      nombre: 'Tesorería',
      descripcion: 'Aprueba cuentas',
      permisos: ['expedientes:leer', 'expedientes:revisar'],
      sectores: [
        { sector: 'FICHA_TRIBUTARIA', nivel: 'Ver' },
        { sector: 'FICHA_GENERAL', nivel: 'Editar' },
      ],
    });
  });

  it('marcar un sector lo agrega con el nivel mínimo (Ver) y desmarcarlo lo quita; el nivel se cambia por sector', () => {
    let sectores = alternarSector([], 'FICHA_LEGAL');
    expect(sectores).toEqual([{ sector: 'FICHA_LEGAL', nivel: 'Ver' }]);
    sectores = alternarSector(sectores, 'FICHA_GENERAL');
    sectores = cambiarNivel(sectores, 'FICHA_GENERAL', 'Editar');
    expect(sectores).toEqual([
      { sector: 'FICHA_LEGAL', nivel: 'Ver' },
      { sector: 'FICHA_GENERAL', nivel: 'Editar' },
    ]);
    expect(alternarSector(sectores, 'FICHA_LEGAL')).toEqual([{ sector: 'FICHA_GENERAL', nivel: 'Editar' }]);
    expect(sectoresADto(sectores)).toEqual([
      { sector: 'FICHA_GENERAL', nivel: 'Editar' },
      { sector: 'FICHA_LEGAL', nivel: 'Ver' },
    ]);
  });

  it('muestra los sectores en el orden de la ficha y la firma no depende del orden en que se marcaron', () => {
    const a = { ...grupoNuevo(), nombre: 'G', permisos: ['b', 'a'], sectores: [{ sector: 'FICHA_LEGAL' as const, nivel: 'Ver' as const }, { sector: 'FICHA_GENERAL' as const, nivel: 'Ver' as const }] };
    const b = { ...a, permisos: ['a', 'b'], sectores: [...a.sectores].reverse() };
    expect(enOrdenDeLaFicha(a.sectores).map((s) => s.sector)).toEqual(['FICHA_GENERAL', 'FICHA_LEGAL']);
    expect(firmaDeGrupo(a)).toBe(firmaDeGrupo(b));
    expect(firmaDeGrupo({ ...a, nombre: 'Otro' })).not.toBe(firmaDeGrupo(a));
  });
});
