import type { FlujoVersionDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import { credencialesADto, borradorCredenciales } from '../configuracion/listasRestrictivas/modelo';
import { borradorDesdeVersion, firmaBorrador, validarVerificaciones, verificacionesADto, verificacionNueva } from './editor';

describe('Verificaciones del flujo (VE-6)', () => {
  it('valida vigencia y reconsulta como el dominio (vacías = las de la configuración)', () => {
    expect(validarVerificaciones([verificacionNueva('EstudioDeCumplimiento'), verificacionNueva('ListasRestrictivas')])).toEqual([]);
    expect(validarVerificaciones([{ ...verificacionNueva('EstudioDeCumplimiento'), vigenciaDias: 0 }])).toEqual([
      { codigo: 'vigencia-invalida', campo: 'verificacion.EstudioDeCumplimiento' },
    ]);
    expect(validarVerificaciones([{ ...verificacionNueva('ListasRestrictivas'), frecuenciaReconsultaMeses: 61 }])).toEqual([
      { codigo: 'reconsulta-invalida', campo: 'verificacion.ListasRestrictivas' },
    ]);
  });

  it('va a la API en orden fijo, sin reconsulta en el estudio, y vuelve igual al editor', () => {
    const dto = verificacionesADto([
      { tipo: 'EstudioDeCumplimiento', bloqueante: true, vigenciaDias: 45, frecuenciaReconsultaMeses: 6 },
      { tipo: 'ListasRestrictivas', bloqueante: false, vigenciaDias: null, frecuenciaReconsultaMeses: 6 },
    ]);
    expect(dto).toEqual([
      { tipo: 'ListasRestrictivas', bloqueante: false, vigenciaDias: null, frecuenciaReconsultaMeses: 6 },
      { tipo: 'EstudioDeCumplimiento', bloqueante: true, vigenciaDias: 45, frecuenciaReconsultaMeses: null },
    ]);

    const version = { politicaDevolucion: 'Inmediata', separacionDeFunciones: false, etapas: [], requisitos: [], verificaciones: dto } as unknown as FlujoVersionDto;
    const borrador = borradorDesdeVersion({ codigo: 'HAB', nombre: 'Habilitación', tipoVinculo: 'PROVEEDOR' }, version);
    expect(borrador.verificaciones.map((v) => v.tipo)).toEqual(['ListasRestrictivas', 'EstudioDeCumplimiento']);
    expect(firmaBorrador(borrador)).toContain('"verificaciones"');
  });
});

describe('Fuentes oficiales en el flujo (FO-1)', () => {
  it('el RUES y la DIAN se piden por tipo de vínculo: bloqueantes o informativas, con su vigencia y sin reconsulta de listas', () => {
    const dto = verificacionesADto([
      { tipo: 'Dian', bloqueante: false, vigenciaDias: 90, frecuenciaReconsultaMeses: 6 },
      { tipo: 'Rues', bloqueante: true, vigenciaDias: null, frecuenciaReconsultaMeses: 6 },
      { tipo: 'EstudioDeCumplimiento', bloqueante: true, vigenciaDias: null, frecuenciaReconsultaMeses: null },
    ]);

    expect(dto).toEqual([
      { tipo: 'EstudioDeCumplimiento', bloqueante: true, vigenciaDias: null, frecuenciaReconsultaMeses: null },
      { tipo: 'Rues', bloqueante: true, vigenciaDias: null, frecuenciaReconsultaMeses: null },
      { tipo: 'Dian', bloqueante: false, vigenciaDias: 90, frecuenciaReconsultaMeses: null },
    ]);
    expect(verificacionNueva('Rues')).toEqual({ tipo: 'Rues', bloqueante: true, vigenciaDias: null, frecuenciaReconsultaMeses: null });
  });

  it('valida la vigencia de una fuente como la de las demás y la lleva al editor', () => {
    expect(validarVerificaciones([{ ...verificacionNueva('Dian'), vigenciaDias: 3651 }])).toEqual([{ codigo: 'vigencia-invalida', campo: 'verificacion.Dian' }]);
    expect(validarVerificaciones([{ ...verificacionNueva('Rues'), vigenciaDias: 30 }])).toEqual([]);

    const version = {
      politicaDevolucion: 'Inmediata',
      separacionDeFunciones: false,
      etapas: [],
      requisitos: [],
      verificaciones: [{ tipo: 'Rues', bloqueante: false, vigenciaDias: 15, frecuenciaReconsultaMeses: null }],
    } as unknown as FlujoVersionDto;
    expect(borradorDesdeVersion({ codigo: 'HAB', nombre: 'Habilitación', tipoVinculo: 'PROVEEDOR' }, version).verificaciones).toEqual([
      { tipo: 'Rues', bloqueante: false, vigenciaDias: 15, frecuenciaReconsultaMeses: null },
    ]);
  });
});

describe('Credenciales de listas de la empresa (VE-7)', () => {
  const proveedor = {
    nombre: 'Infolaft', real: true, principal: true, habilitadoEnInstalacion: false, configurado: true, usuario: 'sinco', ultimosCuatroClave: '9876',
    urlBase: null, plan: 'Empresarial', cuotaMensual: 500, modoBusqueda: 'PorNombre',
  } as const;

  it('la clave nunca vuelve: vacía conserva la actual y quitar envía cadena vacía', () => {
    const borrador = borradorCredenciales(proveedor);
    expect(borrador.clave).toBe('');
    expect(credencialesADto('Infolaft', borrador)).toEqual({
      proveedor: 'Infolaft', usuario: 'sinco', clave: null, urlBase: null, plan: 'Empresarial', cuotaMensual: 500, modoBusqueda: 'PorNombre',
    });
    expect(credencialesADto('Infolaft', { ...borrador, clave: 'nueva-clave', cuotaMensual: '' })).toMatchObject({ clave: 'nueva-clave', cuotaMensual: null });
    expect(credencialesADto('Infolaft', borrador, true)).toEqual({ proveedor: 'Infolaft', clave: '' });
  });
});
