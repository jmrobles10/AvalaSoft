import { describe, expect, it } from 'vitest';
import { aNumero, fechaNegocio, formatearDias, hayFiltrosEstado, leerFiltrosEstado, parametrosEstado, rangoInvalido, rutaInformeDeVentana, sinPaginacion, tiemposPorFase, tonoDeAlerta, topeDeAreas } from './modelo';

describe('filtros del informe de estado', () => {
  it('lee la URL y solo envía lo que tiene valor; la fecha de cierre viaja, la de apertura es la de siempre', () => {
    const filtros = leerFiltrosEstado(new URLSearchParams('estado=Aprobado&fecha=Cierre&desde=2026-11-01&areaId=a1'));
    expect(filtros.fecha).toBe('Cierre');
    expect(hayFiltrosEstado(filtros)).toBe(true);
    expect(parametrosEstado(filtros)).toEqual({ estado: 'Aprobado', areaId: 'a1', desde: '2026-11-01', fecha: 'Cierre' });

    const vacios = leerFiltrosEstado(new URLSearchParams('fecha=Otra'));
    expect(vacios.fecha).toBe('Apertura');
    expect(hayFiltrosEstado(vacios)).toBe(false);
    expect(parametrosEstado(vacios)).toEqual({});
  });

  it('marca el rango al revés y la descarga quita la paginación', () => {
    expect(rangoInvalido({ desde: '2026-11-05', hasta: '2026-11-01' })).toBe(true);
    expect(rangoInvalido({ desde: '2026-11-01', hasta: '' })).toBe(false);
    expect(sinPaginacion({ estado: 'Aprobado', limite: 50, cursor: 'abc' })).toEqual({ estado: 'Aprobado' });
  });
});

describe('días e Inicio', () => {
  it('formatea días con coma decimal y tolera el decimal como texto', () => {
    expect(formatearDias(4.25, '—')).toBe('4,3');
    expect(formatearDias('2', '—')).toBe('2,0');
    expect(formatearDias(null, '—')).toBe('—');
    expect(aNumero('x')).toBeNull();
  });

  it('el enlace de Inicio usa la misma ventana de los indicadores: hoy y los días anteriores en Bogotá', () => {
    // 10/11/2026 a las 2 a. m. UTC: en Bogotá aún es el 9 de noviembre.
    const ahora = new Date(Date.UTC(2026, 10, 10, 2, 0));
    expect(fechaNegocio(0, ahora)).toBe('2026-11-09');
    expect(rutaInformeDeVentana('emp', 7, ahora)).toBe('/e/emp/informes/estado-expedientes?fecha=Cierre&estado=Aprobado&desde=2026-11-03');
  });
});

describe('tiempo por fase y escala de las áreas', () => {
  it('reparte el tiempo en carga, con el tercero y en revisión con el peso de cada fase', () => {
    const fases = tiemposPorFase({ promedioEnCargaDias: 1, promedioConTerceroDias: '1', promedioEnRevisionDias: 2 });
    expect(fases.map((f) => f.fase)).toEqual(['carga', 'tercero', 'revision']);
    expect(fases.map((f) => f.dias)).toEqual([1, 1, 2]);
    expect(fases.map((f) => f.porcentaje)).toEqual([25, 25, 50]);
  });

  it('una fase sin dato no pesa y, sin nada que repartir, todo queda en cero', () => {
    const parcial = tiemposPorFase({ promedioEnCargaDias: 3, promedioConTerceroDias: null, promedioEnRevisionDias: 1 });
    expect(parcial.map((f) => f.dias)).toEqual([3, null, 1]);
    expect(parcial.map((f) => f.porcentaje)).toEqual([75, 0, 25]);
    const vacias = tiemposPorFase({ promedioEnCargaDias: null, promedioConTerceroDias: null, promedioEnRevisionDias: null });
    expect(vacias.every((f) => f.dias === null && f.porcentaje === 0)).toBe(true);
  });

  it('el tope de las barras es el mayor de los máximos (y promedios) de todas las áreas', () => {
    expect(topeDeAreas([{ promedioDias: 1.5, maximoDias: '6.5' }, { promedioDias: 3, maximoDias: 9.1 }])).toBe(9.1);
    expect(topeDeAreas([{ promedioDias: 4, maximoDias: null }])).toBe(4);
    expect(topeDeAreas([])).toBe(0);
  });

  it('una cifra de alerta es roja si hay algo y verde si no', () => {
    expect(tonoDeAlerta(3)).toBe('rojo');
    expect(tonoDeAlerta(0)).toBe('verde');
  });
});
