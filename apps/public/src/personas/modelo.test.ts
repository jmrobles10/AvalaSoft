import type { RelacionEntreTercerosDto, RequisitoPublicoDto } from '@avalasoft/api-client';
import { describe, expect, it } from 'vitest';
import { destinoFijo } from '../boveda/parametrosSubida';
import { enlaceDeSubida } from '../expediente/requisitos';
import {
  comoNumero, confianzaComoPorcentaje, cuerpoDeDeclaracion, DATOS_DE_PERSONA_VACIOS, documentoPorSubir, documentosPorSubir, enlaceDeSubidaDePersona, esRol,
  propuestasDe, validarPersona, vigentesPorRol,
} from './modelo';

const relacion = (id: string, tipo: string, cambios: Partial<RelacionEntreTercerosDto> = {}): RelacionEntreTercerosDto => ({
  id,
  personaId: `p-${id}`,
  identificacion: { pais: 'CO', tipo: 'CC', numero: id },
  nombre: `Persona ${id}`,
  tipo,
  principal: false,
  participacion: null,
  cargo: null,
  vigenteDesde: '2026-11-01',
  vigenteHasta: null,
  estado: 'Confirmada',
  fuente: 'Declarada',
  deFicha: true,
  confianza: null,
  confirmadaEn: '2026-11-01T10:00:00Z',
  documentos: [],
  ...cambios,
});

describe('personas relacionadas del tercero', () => {
  it('agrupa lo vigente por rol, en el orden del catálogo y con la principal primero; lo propuesto y lo terminado no entran', () => {
    const grupos = vigentesPorRol([
      relacion('s2', 'Socio'),
      relacion('r1', 'RepresentanteLegal', { principal: true }),
      relacion('s1', 'Socio', { principal: true }),
      relacion('b1', 'BeneficiarioFinal', { estado: 'Propuesta' }),
      relacion('x1', 'Suplente', { estado: 'Finalizada' }),
    ]);

    expect(grupos.map((g) => g.rol)).toEqual(['RepresentanteLegal', 'Socio']);
    expect(grupos[1]?.personas.map((p) => p.id)).toEqual(['s1', 's2']);
  });

  it('separa las propuestas de la IA, que esperan al tercero', () => {
    expect(propuestasDe([relacion('a', 'Socio'), relacion('b', 'RepresentanteLegal', { estado: 'Propuesta', fuente: 'ExtraidaIa' })]).map((r) => r.id)).toEqual(['b']);
  });

  it('un documento está por subir si una empresa lo pide y no está vigente en la bóveda de la persona', () => {
    const base = { tipoCanonico: 'CEDULA', nombre: 'Cédula', documentoId: null, version: null, estado: null, cargadaEn: null };
    expect(documentoPorSubir({ ...base, pedido: true })).toBe(true);
    expect(documentoPorSubir({ ...base, pedido: true, estado: 'Devuelta' })).toBe(true);
    expect(documentoPorSubir({ ...base, pedido: true, estado: 'Actual' })).toBe(false);
    expect(documentoPorSubir({ ...base, pedido: false })).toBe(false);
    expect(documentosPorSubir({ documentos: [{ ...base, pedido: true }, { ...base, tipoCanonico: 'PASAPORTE', pedido: false }] })).toBe(1);
  });

  it('lee las cifras decimales como número aunque lleguen como texto, y la confianza como porcentaje entero', () => {
    expect(comoNumero('35.5')).toBe(35.5);
    expect(comoNumero(null)).toBeNull();
    expect(comoNumero('')).toBeNull();
    expect(confianzaComoPorcentaje(0.934)).toBe(93);
    expect(confianzaComoPorcentaje('0.98')).toBe(98);
    expect(confianzaComoPorcentaje(null)).toBeNull();
  });

  it('reconoce los roles del catálogo', () => {
    expect(esRol('Socio')).toBe(true);
    expect(esRol('Dueño')).toBe(false);
  });

  it('arma el enlace de subida de la persona con regreso a sus personas', () => {
    expect(enlaceDeSubidaDePersona('p1', 'CEDULA', 'Cédula de ciudadanía')).toBe('/boveda/subir?persona=p1&tipo=CEDULA&nombre=C%C3%A9dula+de+ciudadan%C3%ADa&volver=%2Fpersonas');
  });
});

describe('declarar una persona', () => {
  it('pide nombre y número, y una participación de 0 a 100', () => {
    expect(validarPersona(DATOS_DE_PERSONA_VACIOS)).toEqual({ nombre: true, numero: true });
    expect(validarPersona({ ...DATOS_DE_PERSONA_VACIOS, nombre: 'Ana', numero: '80.123.456', participacion: '120' })).toEqual({ participacion: true });
    expect(validarPersona({ ...DATOS_DE_PERSONA_VACIOS, nombre: 'Ana', numero: '80123456', participacion: '35,5' })).toEqual({});
  });

  it('arma el cuerpo: país CO, participación y cargo solo si se indican', () => {
    expect(cuerpoDeDeclaracion({ ...DATOS_DE_PERSONA_VACIOS, rol: 'Socio', nombre: ' Ana Pérez ', numero: ' 80123456 ', participacion: '35,5', cargo: 'Presidente', principal: true })).toEqual({
      identificacion: { pais: 'CO', tipo: 'CC', numero: '80123456' },
      nombre: 'Ana Pérez',
      tipo: 'Socio',
      principal: true,
      participacion: 35.5,
      cargo: 'Presidente',
    });
    expect(cuerpoDeDeclaracion({ ...DATOS_DE_PERSONA_VACIOS, nombre: 'Luis', numero: '1' })).toEqual({
      identificacion: { pais: 'CO', tipo: 'CC', numero: '1' },
      nombre: 'Luis',
      tipo: 'RepresentanteLegal',
      principal: false,
    });
  });
});

describe('el requisito de persona en el expediente', () => {
  const requisito = (cambios: Partial<RequisitoPublicoDto>): RequisitoPublicoDto => ({
    id: 'rq1',
    tipoDocumento: { id: 'td', codigo: 'CEDULA', nombre: 'Cédula de ciudadanía', tipoCanonico: 'CEDULA', ambito: 'Global' },
    obligatorio: true,
    estado: 'Pendiente',
    versionActual: null,
    observaciones: [],
    ...cambios,
  });

  it('sube a la bóveda de la persona (sin vínculo de contexto) y el destino lo dice', () => {
    const enlace = enlaceDeSubida(requisito({ persona: { rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: false, personaId: 'p1', nombre: 'Juan Pérez' } }), 'v1', 'e1');

    expect(enlace).toContain('persona=p1');
    expect(enlace).toContain('tipo=CEDULA');
    expect(enlace).not.toContain('vinculoId');
    const parametros = new URLSearchParams(enlace?.split('?')[1]);
    expect(destinoFijo(parametros)).toEqual({ destino: { tipoCanonico: 'CEDULA', terceroRelacionadoId: 'p1' }, nombre: 'Cédula de ciudadanía' });
  });

  it('sin persona todavía no hay a quién subírselo: no hay enlace', () => {
    expect(enlaceDeSubida(requisito({ persona: { rol: 'RepresentanteLegal', todasLasRelaciones: false, sinPersona: true } }), 'v1', 'e1')).toBeNull();
  });
});
