import type { ComparticionPublicaDto, DocumentoBovedaDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import {
  agruparEmpresas,
  buscarEnGrupos,
  buscarPorNombre,
  comparticionesDeLaEmpresa,
  documentosDeLaEmpresa,
  empresaDelFiltro,
  empresasDeLaBoveda,
  MAXIMO_EMPRESAS_POR_NOMBRE,
  normalizarTexto,
  resumirEmpresas,
} from './resumenEmpresas';

const empresa = (nombre: string, situacion: string, cambios: Partial<ComparticionPublicaDto> = {}): ComparticionPublicaDto => ({
  vinculoId: `v-${nombre}`,
  empresa: { id: `e-${nombre}`, nombre, logoUrl: null },
  compartido: situacion !== 'NoRecibe',
  version: 7,
  versionActualCompartida: true,
  compartidaEn: '2026-10-01T12:00:00Z',
  vigencia: null,
  situacion,
  otraVersion: null,
  ...cambios,
});

/** `cantidad` empresas «<situacion> 01…» en la misma situación. */
const varias = (cantidad: number, situacion: string): ComparticionPublicaDto[] =>
  Array.from({ length: cantidad }, (_, i) => empresa(`${situacion} ${String(i + 1).padStart(2, '0')}`, situacion));

describe('agrupar las empresas de un documento por estado', () => {
  it('pone primero lo que pide algo del tercero y después lo que está bien, con las tres revalidaciones juntas', () => {
    const grupos = agruparEmpresas([
      ...varias(2, 'AproboVigente'),
      empresa('Rev retirada', 'RevalidaRetirada'),
      empresa('Rev', 'Revalida'),
      empresa('Por rev', 'PorRevalidar'),
      ...varias(1, 'Revisando'),
      ...varias(1, 'Observada'),
      ...varias(1, 'SinVigente'),
      ...varias(1, 'TieneVigente'),
      ...varias(1, 'TieneOtra'),
    ]);

    expect(grupos.map((g) => [g.grupo, g.empresas.length])).toEqual([
      ['SinVigente', 1],
      ['Observada', 1],
      ['Revalida', 3],
      ['Revisando', 1],
      ['AproboVigente', 2],
      ['TieneVigente', 1],
      ['TieneOtra', 1],
    ]);
  });

  it('usa los mismos tonos que el chip de cada empresa y marca lo que pide acción', () => {
    const grupos = agruparEmpresas([...varias(1, 'AproboVigente'), ...varias(1, 'Observada'), ...varias(1, 'Revisando'), ...varias(1, 'TieneVigente')]);

    expect(grupos.map((g) => [g.grupo, g.tono, g.pideAccion])).toEqual([
      ['Observada', 'advertencia', true],
      ['Revisando', 'advertencia', false],
      ['AproboVigente', 'exito', false],
      ['TieneVigente', 'neutro', false],
    ]);
  });

  it('ordena las empresas de cada grupo por nombre y no devuelve grupos vacíos', () => {
    const grupos = agruparEmpresas([empresa('Sur', 'AproboVigente'), empresa('Álamos', 'AproboVigente'), empresa('Norte', 'AproboVigente')]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]?.empresas.map((c) => c.empresa.nombre)).toEqual(['Álamos', 'Norte', 'Sur']);
  });

  it('las empresas que no exigen el documento no tienen grupo', () => {
    expect(agruparEmpresas(varias(4, 'NoRecibe'))).toEqual([]);
  });

  it('una situación que la API agregue después se lee por lo que ya se sabe', () => {
    const grupos = agruparEmpresas([empresa('Nueva', 'EstadoDelFuturo'), empresa('Ajena', 'EstadoDelFuturo', { compartido: false })]);

    expect(grupos.map((g) => g.grupo)).toEqual(['TieneVigente']);
    expect(grupos[0]?.empresas.map((c) => c.empresa.nombre)).toEqual(['Nueva']);
  });
});

describe('resumen de la columna «Empresas»', () => {
  it('sin empresas no hay nada que resumir', () => {
    expect(resumirEmpresas([])).toEqual({ modo: 'vacio' });
  });

  it('hasta el máximo se nombran una por una, con una sola empresa como siempre', () => {
    expect(MAXIMO_EMPRESAS_POR_NOMBRE).toBe(2);
    const una = resumirEmpresas(varias(1, 'AproboVigente'));
    const dos = resumirEmpresas(varias(MAXIMO_EMPRESAS_POR_NOMBRE, 'Revalida'));

    expect(una.modo).toBe('nombres');
    expect(dos.modo).toBe('nombres');
  });

  it('con más empresas da un chip de conteo por estado, los que piden acción primero', () => {
    const resumen = resumirEmpresas([...varias(24, 'AproboVigente'), ...varias(3, 'Revalida'), ...varias(1, 'SinVigente'), ...varias(2, 'Revisando')]);

    if (resumen.modo !== 'resumen') throw new Error('Debía resumirse');
    expect(resumen.total).toBe(30);
    expect(resumen.chips).toEqual([
      { clave: 'SinVigente', cantidad: 1, tono: 'advertencia' },
      { clave: 'Revalida', cantidad: 3, tono: 'advertencia' },
      { clave: 'Revisando', cantidad: 2, tono: 'advertencia' },
      { clave: 'AproboVigente', cantidad: 24, tono: 'exito' },
    ]);
    expect(resumen.grupos.map((g) => g.empresas.length)).toEqual([1, 3, 2, 24]);
  });

  it('sin nada pendiente junta todo en un solo chip «Al día»', () => {
    const resumen = resumirEmpresas([...varias(20, 'AproboVigente'), ...varias(4, 'TieneVigente'), ...varias(1, 'TieneOtra')]);

    if (resumen.modo !== 'resumen') throw new Error('Debía resumirse');
    expect(resumen.chips).toEqual([{ clave: 'AlDia', cantidad: 25, tono: 'exito' }]);
  });

  it('las empresas que no exigen el documento no se cuentan ni se nombran', () => {
    const resumen = resumirEmpresas([...varias(5, 'AproboVigente'), ...varias(20, 'NoRecibe')]);

    if (resumen.modo !== 'resumen') throw new Error('Debía resumirse');
    expect(resumen.total).toBe(5);
    expect(resumen.chips).toEqual([{ clave: 'AlDia', cantidad: 5, tono: 'exito' }]);
    expect(JSON.stringify(resumen)).not.toContain('NoRecibe');

    // Con una o dos que sí lo exigen, esas dos se nombran y las demás siguen sin aparecer.
    const dos = resumirEmpresas([...varias(2, 'AproboVigente'), ...varias(20, 'NoRecibe')]);
    if (dos.modo !== 'nombres') throw new Error('Debían nombrarse');
    expect(dos.empresas.map((c) => c.empresa.nombre)).toEqual(['AproboVigente 01', 'AproboVigente 02']);
  });

  it('si ninguna empresa lo exige no hay lista ni chips', () => {
    expect(resumirEmpresas(varias(30, 'NoRecibe'))).toEqual({ modo: 'ninguna' });
    expect(resumirEmpresas(varias(1, 'NoRecibe'))).toEqual({ modo: 'ninguna' });
  });
});

describe('buscar empresas por nombre', () => {
  it('no distingue mayúsculas ni tildes y sin texto devuelve todo', () => {
    expect(normalizarTexto('  Cimentación del PÁRAMO ')).toBe('cimentacion del paramo');
    const nombres = ['Cimentación del Páramo', 'Constructora Norte', 'Ñandú S.A.S.'];

    expect(buscarPorNombre(nombres, 'paramo', (n) => n)).toEqual(['Cimentación del Páramo']);
    expect(buscarPorNombre(nombres, 'NANDU', (n) => n)).toEqual(['Ñandú S.A.S.']);
    expect(buscarPorNombre(nombres, 'cons', (n) => n)).toEqual(['Constructora Norte']);
    expect(buscarPorNombre(nombres, '  ', (n) => n)).toEqual(nombres);
    expect(buscarPorNombre(nombres, 'zzz', (n) => n)).toEqual([]);
  });

  it('en los grupos deja solo las coincidencias y quita los grupos que se quedan sin empresas', () => {
    const grupos = agruparEmpresas([empresa('Norte', 'Revalida'), empresa('Sur', 'Revalida'), empresa('Norte Verde', 'AproboVigente'), empresa('Oriente', 'AproboVigente')]);

    const encontradas = buscarEnGrupos(grupos, 'norte');
    expect(encontradas.map((g) => [g.grupo, g.empresas.map((c) => c.empresa.nombre)])).toEqual([
      ['Revalida', ['Norte']],
      ['AproboVigente', ['Norte Verde']],
    ]);
    expect(buscarEnGrupos(grupos, 'sur').map((g) => g.grupo)).toEqual(['Revalida']);
    expect(buscarEnGrupos(grupos, 'zzz')).toEqual([]);
  });
});

describe('filtro de la bóveda por empresa', () => {
  const documento = (id: string, porEmpresa: ComparticionPublicaDto[]): DocumentoBovedaDto => ({
    id,
    tipo: { codigo: id.toUpperCase(), nombre: id, tipoDocumentoTenantId: null },
    ambito: 'Global',
    clase: 'Archivo',
    vinculoId: null,
    versionActual: null,
    versiones: 1,
    porEmpresa,
  });
  const documentos = [
    documento('rut', [empresa('Sur', 'AproboVigente'), empresa('Norte', 'Revalida')]),
    documento('camara', [empresa('Norte', 'AproboVigente'), empresa('Ñandú', 'NoRecibe')]),
  ];

  it('ofrece cada empresa una sola vez, por nombre', () => {
    expect(empresasDeLaBoveda(documentos)).toEqual([
      { id: 'e-Norte', nombre: 'Norte' },
      { id: 'e-Ñandú', nombre: 'Ñandú' },
      { id: 'e-Sur', nombre: 'Sur' },
    ]);
    expect(empresasDeLaBoveda([])).toEqual([]);
  });

  it('un id que no es de ninguna empresa se lee como «Todas»', () => {
    const opciones = empresasDeLaBoveda(documentos);

    expect(empresaDelFiltro(opciones, 'e-Sur')).toEqual({ id: 'e-Sur', nombre: 'Sur' });
    expect(empresaDelFiltro(opciones, 'e-Fantasma')).toBeNull();
    expect(empresaDelFiltro(opciones, null)).toBeNull();
  });

  it('con una empresa elegida deja solo lo suyo y sin filtro devuelve todo', () => {
    const porEmpresa = documentos[0]?.porEmpresa ?? [];

    expect(comparticionesDeLaEmpresa(porEmpresa, 'e-Norte').map((c) => c.situacion)).toEqual(['Revalida']);
    expect(comparticionesDeLaEmpresa(porEmpresa, null)).toHaveLength(2);
    expect(comparticionesDeLaEmpresa(porEmpresa, 'e-Fantasma')).toEqual([]);

    expect(documentosDeLaEmpresa(documentos, null)).toBe(documentos);
    expect(documentosDeLaEmpresa(documentos, 'e-Norte').map((d) => d.porEmpresa.map((c) => c.empresa.nombre))).toEqual([['Norte'], ['Norte']]);
  });
});
