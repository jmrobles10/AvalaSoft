import type { IndicadoresDto, MisPendientesDto } from '@validalo/api-client';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import { accesosPendientes, aNumero, antiguedadDeArea, estaAlDia, formatearConteo, formatearDias, formatearPorcentaje, leerVentana, repartoVinculos, textoArea, tonoDeAcceso } from './modelo';

const t = i18n.t.bind(i18n);

function pendientes(parcial: Partial<MisPendientesDto> = {}): MisPendientesDto {
  return {
    porArea: [],
    revalidaciones: 0,
    revalidacionesBloqueantes: 0,
    cuentasPorAprobar: 0,
    aperturasPendientes: 0,
    documentosPorVencer: 0,
    documentosVencidos: 0,
    ...parcial,
  };
}

function indicadores(parcial: Partial<IndicadoresDto> = {}): IndicadoresDto {
  return {
    dias: 30,
    vinculosActivos: 0,
    vinculosEnValidacion: 0,
    vinculosInvitados: 0,
    vinculosVencidos: 0,
    vinculosBloqueados: 0,
    expedientesEnCurso: 0,
    expedientesObservados: 0,
    expedientesAprobados: 0,
    expedientesRechazados: 0,
    tiempoPromedioDias: null,
    tiempoMedianaDias: null,
    certificadosVigentes: 0,
    certificadosConPendientes: 0,
    certificadosNoValidos: 0,
    ...parcial,
  };
}

const area = (cantidad: number, masAntiguoDias: number) => ({ areaId: 'a1', codigo: 'COMPRAS', nombre: 'Compras', cantidad, masAntiguoDias });

describe('inicio', () => {
  it('lee la ventana de la URL: 30 por defecto y lo que no sea 7, 30 o 90 vuelve al defecto', () => {
    expect(leerVentana(new URLSearchParams())).toBe(30);
    expect(leerVentana(new URLSearchParams('dias=7'))).toBe(7);
    expect(leerVentana(new URLSearchParams('dias=90'))).toBe(90);
    expect(leerVentana(new URLSearchParams('dias=15'))).toBe(30);
    expect(leerVentana(new URLSearchParams('dias=abc'))).toBe(30);
  });

  it('dice cuántos expedientes tiene el área y hace cuánto llegó el más antiguo, o que está al día', () => {
    expect(textoArea(area(3, 5), t)).toBe('Compras: 3 expedientes por revisar · el más antiguo hace 5 días');
    expect(textoArea(area(1, 1), t)).toBe('Compras: 1 expediente por revisar · el más antiguo hace 1 día');
    expect(textoArea(area(2, 0), t)).toBe('Compras: 2 expedientes por revisar · el más antiguo es de hoy');
    expect(textoArea(area(0, 0), t)).toBe('Compras: Al día');
  });

  it('los accesos solo incluyen lo pendiente, con su destino; las cuentas no tienen pantalla propia', () => {
    expect(accesosPendientes(pendientes())).toEqual([]);
    expect(
      accesosPendientes(pendientes({ revalidaciones: 4, revalidacionesBloqueantes: 1, cuentasPorAprobar: 2, aperturasPendientes: 0, documentosPorVencer: 3, documentosVencidos: 1 })),
    ).toEqual([
      { clave: 'revalidaciones', cantidad: 4, ruta: 'revalidaciones', bloqueantes: 1 },
      { clave: 'cuentas', cantidad: 2, ruta: null },
      { clave: 'porVencer', cantidad: 3, ruta: 'vencimientos' },
      { clave: 'vencidos', cantidad: 1, ruta: 'vencimientos?estado=Vencida' },
    ]);
    expect(accesosPendientes(pendientes({ aperturasPendientes: 2 }))).toEqual([{ clave: 'aperturas', cantidad: 2, ruta: 'bandeja' }]);
  });

  it('está al día si ninguna área tiene expedientes y no hay otros pendientes', () => {
    expect(estaAlDia(pendientes())).toBe(true);
    expect(estaAlDia(pendientes({ porArea: [area(0, 0)] }))).toBe(true);
    expect(estaAlDia(pendientes({ porArea: [area(1, 0)] }))).toBe(false);
    expect(estaAlDia(pendientes({ documentosVencidos: 1 }))).toBe(false);
  });

  it('los tiempos llegan como número o texto: un decimal con coma, o «—» si no hay dato', () => {
    expect(aNumero(null)).toBeNull();
    expect(aNumero('4.25')).toBe(4.25);
    expect(aNumero('x')).toBeNull();
    expect(formatearDias(4.5, '—')).toBe('4,5');
    expect(formatearDias('12', '—')).toBe('12,0');
    expect(formatearDias(null, '—')).toBe('—');
    expect(formatearConteo(1234)).toBe('1.234');
  });

  it('la antigüedad del área dice hace cuánto llegó el más antiguo, o que es de hoy', () => {
    expect(antiguedadDeArea(area(3, 5), t)).toBe('el más antiguo hace 5 días');
    expect(antiguedadDeArea(area(3, 1), t)).toBe('el más antiguo hace 1 día');
    expect(antiguedadDeArea(area(3, 0), t)).toBe('el más antiguo es de hoy');
  });

  it('el tono de un pendiente: rojo lo vencido y las revalidaciones que bloquean, ámbar lo por vencer, y el resto neutro', () => {
    const acceso = (parcial: Partial<Parameters<typeof tonoDeAcceso>[0]>) => ({ clave: 'cuentas' as const, cantidad: 1, ruta: null, ...parcial });
    expect(tonoDeAcceso(acceso({ clave: 'vencidos' }))).toBe('rojo');
    expect(tonoDeAcceso(acceso({ clave: 'porVencer' }))).toBe('ambar');
    expect(tonoDeAcceso(acceso({ clave: 'revalidaciones', bloqueantes: 1 }))).toBe('rojo');
    expect(tonoDeAcceso(acceso({ clave: 'revalidaciones', bloqueantes: 0 }))).toBe('cian');
    expect(tonoDeAcceso(acceso({ clave: 'cuentas' }))).toBe('cian');
    expect(tonoDeAcceso(acceso({ clave: 'aperturas' }))).toBe('cian');
  });

  it('reparte los vínculos en cuatro grupos sin contar dos veces: activos suma los por vencer y en revisión es aparte', () => {
    const { total, segmentos } = repartoVinculos(
      indicadores({ vinculosActivos: 100, vinculosPorVencer: 20, vinculosEnValidacion: 8, vinculosEnRevision: 2, vinculosInvitados: 5, vinculosVencidos: 3, vinculosBloqueados: 2 }),
    );
    expect(total).toBe(120);
    expect(segmentos.map((s) => [s.clave, s.valor, s.tono])).toEqual([
      ['alDia', 80, 'verde'],
      ['porVencer', 20, 'ambar'],
      ['enProceso', 15, 'cian'],
      ['conProblema', 5, 'rojo'],
    ]);
    expect(segmentos.reduce((suma, s) => suma + s.porcentaje, 0)).toBeCloseTo(100);
    expect(segmentos[0]!.porcentaje).toBeCloseTo((80 / 120) * 100);
  });

  it('sin los campos opcionales de la API el reparto sigue cuadrando, y sin vínculos no hay nada que repartir', () => {
    const { total, segmentos } = repartoVinculos(indicadores({ vinculosActivos: 10, vinculosInvitados: 5 }));
    expect(total).toBe(15);
    expect(segmentos.map((s) => s.valor)).toEqual([10, 0, 5, 0]);
    const vacio = repartoVinculos(indicadores());
    expect(vacio.total).toBe(0);
    expect(vacio.segmentos.every((s) => s.porcentaje === 0)).toBe(true);
    // Por robustez: si la API entregara más por vencer que activos, el grupo al día no queda negativo.
    expect(repartoVinculos(indicadores({ vinculosActivos: 2, vinculosPorVencer: 5 })).segmentos[0]!.valor).toBe(0);
  });

  it('el porcentaje es entero y lo que existe pero es menor que uno se ve como «<1», no como cero', () => {
    expect(formatearPorcentaje(82.4)).toBe('82');
    expect(formatearPorcentaje(99.6)).toBe('100');
    expect(formatearPorcentaje(0.24)).toBe('<1');
    expect(formatearPorcentaje(0)).toBe('0');
  });
});
