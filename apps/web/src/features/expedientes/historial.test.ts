import type { EventoHistorialDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { eventoExpedienteATimeline } from './historial';

const t = i18n.t.bind(i18n);
const contexto = { usuarioActual: null, areas: new Map([['a1', 'Cumplimiento']]) };

function veredicto(origen: string): EventoHistorialDto {
  return {
    version: 7,
    tipo: 'veredicto_de_area_emitido',
    fecha: '2026-11-09T12:00:00Z',
    actorTipo: 'Tercero',
    actorId: 'tercero',
    sistema: null,
    datos: { areaId: 'a1', veredicto: 'Aprobado', origen, justificacion: 'Esta área no tiene documentos que revisar en este expediente.' },
  };
}

describe('historial del expediente', () => {
  it('un veredicto con origen Sistema se atribuye a Sistema aunque lo disparara el tercero', () => {
    const entrada = eventoExpedienteATimeline(veredicto('Sistema'), contexto, t);
    expect(entrada.titulo).toBe('Cumplimiento aprobó');
    expect(entrada.actor).toEqual({ nombre: 'Sistema', tipo: 'sistema' });
    expect(entrada.motivo).toBe('Esta área no tiene documentos que revisar en este expediente.');
  });

  it('un veredicto humano conserva el actor de la petición', () => {
    expect(eventoExpedienteATimeline(veredicto('Humano'), contexto, t).actor.tipo).toBe('tercero');
  });
});

describe('historial: lo que el tercero declara en su ficha cambia lo que se le pide (EF-5)', () => {
  const evento = (datos: Record<string, unknown>): EventoHistorialDto => ({
    version: 6,
    tipo: 'requisitos_segun_ficha_resueltos',
    fecha: '2026-11-14T12:00:00Z',
    actorTipo: 'Tercero',
    actorId: 'tercero',
    sistema: null,
    datos,
  });
  const requisitos = new Map([['r-camara', 'Cámara de comercio'], ['r-banco', 'Certificación bancaria']]);

  it('dice qué se piden, qué deja de aplicar y qué vuelve a aplicar', () => {
    const entrada = eventoExpedienteATimeline(
      evento({ agregados: [{ requisitoId: 'r-licencia', nombre: 'Licencia de construcción' }], noAplican: ['r-camara'], vuelvenAAplicar: ['r-banco'], motivos: [] }),
      { ...contexto, requisitos },
      t,
    );

    expect(entrada.titulo).toBe('Cambió la ficha del tercero');
    expect(entrada.detalle).toBe('se piden Licencia de construcción · dejan de aplicar Cámara de comercio · vuelven a aplicar Certificación bancaria');
  });

  it('con solo un cambio de porqué no inventa documentos', () => {
    const entrada = eventoExpedienteATimeline(evento({ agregados: [], noAplican: [], vuelvenAAplicar: [], motivos: [{ requisitoId: 'r-camara', motivos: [] }] }), contexto, t);

    expect(entrada.titulo).toBe('Cambió la ficha del tercero');
    expect(entrada.detalle).toBe('');
  });
});

describe('historial: ratificación del tercero en una renovación', () => {
  it('«requisito_ratificado» dice qué ratificó el tercero', () => {
    const evento: EventoHistorialDto = {
      version: 4,
      tipo: 'requisito_ratificado',
      fecha: '2026-11-09T12:00:00Z',
      actorTipo: 'Tercero',
      actorId: 'tercero',
      sistema: null,
      datos: { requisitoId: 'r1', por: 'tercero:ana@aceros.co', fecha: '2026-11-09T12:00:00Z' },
    };
    const entrada = eventoExpedienteATimeline(evento, { ...contexto, requisitos: new Map([['r1', 'Información general']]) }, t);
    expect(entrada.titulo).toBe('El tercero ratificó Información general: sigue igual');
  });
});

describe('historial: ampliación de la actualización abierta', () => {
  it('«requisitos_agregados» dice qué se sumó a la actualización', () => {
    const evento: EventoHistorialDto = {
      version: 9,
      tipo: 'requisitos_agregados',
      fecha: '2026-11-09T12:00:00Z',
      actorTipo: 'Tercero',
      actorId: 'tercero',
      sistema: null,
      datos: { requisitos: [{ requisitoId: 'r1', nombre: 'Información general' }, { requisitoId: 'r2', nombre: 'Cámara de comercio' }], fecha: '2026-11-09T12:00:00Z' },
    };
    const entrada = eventoExpedienteATimeline(evento, contexto, t);
    expect(entrada.titulo).toBe('Se suman a la actualización abierta: Información general, Cámara de comercio');
  });
});

describe('historial: personas relacionadas en los documentos que se piden (ADR-0010)', () => {
  const evento = (tipo: string, datos: Record<string, unknown>): EventoHistorialDto => ({
    version: 12, tipo, fecha: '2026-11-14T12:00:00Z', actorTipo: 'Sistema', actorId: 'sincronizacion-de-personas', sistema: null, datos,
  });

  it('«requisitos_de_persona_agregados» dice de quién es cada documento que se suma', () => {
    const entrada = eventoExpedienteATimeline(
      evento('requisitos_de_persona_agregados', { requisitos: [{ requisitoId: 'r1', nombre: 'Cédula de ciudadanía', persona: { nombre: 'María Gómez' } }, { requisitoId: 'r2', nombre: 'Pasaporte' }] }),
      contexto,
      t,
    );

    expect(entrada.titulo).toBe('Se piden los documentos de más personas relacionadas: Cédula de ciudadanía (María Gómez), Pasaporte');
  });

  it('«persona_de_requisito_resuelta» dice quién entrega ahora el documento', () => {
    const entrada = eventoExpedienteATimeline(evento('persona_de_requisito_resuelta', { requisitoId: 'r1', persona: { nombre: 'Juan Pérez' } }), contexto, t);

    expect(entrada.titulo).toContain('ahora lo entrega Juan Pérez');
  });
});

describe('historial: el tercero retiró una versión (RT-3)', () => {
  const evento = (tipo: string, datos: Record<string, unknown>): EventoHistorialDto => ({
    version: 11,
    tipo,
    fecha: '2026-11-11T12:00:00Z',
    actorTipo: 'Sistema',
    actorId: 'sistema',
    sistema: null,
    datos,
  });
  const conRequisitos = { ...contexto, requisitos: new Map([['r-rut', 'Registro Único Tributario']]) };

  it('un expediente abierto que cambia de versión dice qué se retiró, por qué y cuál vuelve', () => {
    const entrada = eventoExpedienteATimeline(
      evento('version_adjuntada_a_requisito', {
        requisitoId: 'r-rut',
        version: { documentoId: 'd1', numero: 7 },
        numeroAnterior: 8,
        retiro: { numero: 8, motivo: 'Subí el RUT de otra empresa', fecha: '2026-11-11T11:59:00Z' },
      }),
      conRequisitos,
      t,
    );
    expect(entrada.titulo).toBe('El tercero retiró la versión 8 de Registro Único Tributario (motivo: Subí el RUT de otra empresa); vuelve a la versión 7.');
  });

  it('sin retiro sigue diciendo que llegó una versión', () => {
    const entrada = eventoExpedienteATimeline(
      evento('version_adjuntada_a_requisito', { requisitoId: 'r-rut', version: { documentoId: 'd1', numero: 9 }, numeroAnterior: 8, retiro: null }),
      conRequisitos,
      t,
    );
    expect(entrada.titulo).toBe('Registro Único Tributario: llegó la versión 9');
  });

  it('una actualización que se abre por un retiro lo dice con el motivo en vez de listar documentos', () => {
    const entrada = eventoExpedienteATimeline(
      evento('requisitos_calculados', {
        requisitos: [
          { requisitoId: 'r-rut', nombre: 'Registro Único Tributario', version: { documentoId: 'd1', numero: 7 }, retiro: { numero: 8, motivo: 'Archivo equivocado', fecha: '2026-11-11T11:59:00Z' } },
        ],
      }),
      conRequisitos,
      t,
    );
    expect(entrada.titulo).toBe('El tercero retiró la versión 8 de Registro Único Tributario (motivo: Archivo equivocado); vuelve a la versión 7.');

    const normal = eventoExpedienteATimeline(
      evento('requisitos_calculados', { requisitos: [{ requisitoId: 'r-rut', nombre: 'Registro Único Tributario', version: null }] }),
      conRequisitos,
      t,
    );
    expect(normal.titulo).toBe('Documentos que pide el flujo');
    expect(normal.detalle).toBe('Registro Único Tributario');
  });
});

describe('historial: cuenta bancaria designada (CB-4)', () => {
  const evento = (tipo: string, datos: Record<string, unknown>): EventoHistorialDto => ({
    version: 9,
    tipo,
    fecha: '2026-11-13T12:00:00Z',
    actorTipo: 'Usuario',
    actorId: 'u1',
    sistema: null,
    datos,
  });

  it('la exigencia al abrir dice si la cuenta ya estaba aprobada o se espera', () => {
    const pendiente = eventoExpedienteATimeline(evento('cuenta_designada_requerida', { aprobada: false }), contexto, t);
    expect(pendiente.titulo).toBe('Exige cuenta bancaria designada');
    expect(pendiente.detalle).toBe('Se aprueba cuando la empresa apruebe la cuenta que designe el tercero');
    expect(eventoExpedienteATimeline(evento('cuenta_designada_requerida', { aprobada: true }), contexto, t).detalle).toBe('La cuenta designada ya estaba aprobada');
  });

  it('la aprobación de la cuenta tiene su rótulo', () => {
    expect(eventoExpedienteATimeline(evento('cuenta_designada_confirmada', {}), contexto, t).titulo).toBe('Cuenta bancaria designada aprobada');
  });
  it('las evaluaciones que pide el flujo se listan por nombre (CE-4)', () => {
    const entrada = eventoExpedienteATimeline(evento('evaluaciones_requeridas', { evaluaciones: [{ nombre: 'Proveedor nuevo' }, { nombre: 'Riesgo' }] }), contexto, t);
    expect(entrada.titulo).toBe('Evaluaciones que pide el flujo');
    expect(entrada.detalle).toBe('Proveedor nuevo · Riesgo');
  });

  it('la evaluación del proveedor dice cómo quedó y su puntaje, y no inventa un estado que no conoce (CE-8)', () => {
    const aprobada = eventoExpedienteATimeline(evento('evaluacion_del_expediente_actualizada', { estado: 'Aprobada', puntaje: 83.333 }), contexto, t);
    expect(aprobada.titulo).toBe('Evaluación del proveedor');
    expect(aprobada.detalle).toBe('Aprobada · Puntaje 83,33');
    expect(eventoExpedienteATimeline(evento('evaluacion_del_expediente_actualizada', { estado: 'Anulada', puntaje: null }), contexto, t).detalle).toBe('Anulada');
    expect(eventoExpedienteATimeline(evento('evaluacion_del_expediente_actualizada', { estado: 'Rara' }), contexto, t).detalle).toBeNull();
  });
});

describe('historial: decisiones por documento y exención', () => {
  const evento = (tipo: string, datos: Record<string, unknown>): EventoHistorialDto => ({
    version: 14,
    tipo,
    fecha: '2026-11-12T12:00:00Z',
    actorTipo: 'Usuario',
    actorId: 'u-sofia',
    sistema: null,
    datos,
  });
  const conDocumentos = {
    usuarioActual: null,
    areas: new Map([['a-revision', 'Revisión']]),
    requisitos: new Map([
      ['r-rut', 'Registro Único Tributario'],
      ['r-banco', 'Certificación bancaria'],
      ['r-camara', 'Certificado de existencia y representación legal'],
    ]),
  };

  it('aprobar documentos en lote deja una línea por cada documento, con su área y la versión que se aprobó', () => {
    const aprobo = (requisitoId: string) =>
      eventoExpedienteATimeline(evento('veredicto_de_requisito_emitido', { requisitoId, areaId: 'a-revision', veredicto: 'Aprobado', sobreVersion: 2, motivos: [] }), conDocumentos, t);

    expect(aprobo('r-rut').titulo).toBe('Revisión aprobó Registro Único Tributario (v2)');
    expect(aprobo('r-banco').titulo).toBe('Revisión aprobó Certificación bancaria (v2)');
  });

  it('un documento observado se cuenta aparte con sus motivos', () => {
    const observado = eventoExpedienteATimeline(
      evento('veredicto_de_requisito_emitido', { requisitoId: 'r-rut', areaId: 'a-revision', veredicto: 'Observado', sobreVersion: 3, motivos: [], observacion: 'Falta la hoja 2.' }),
      conDocumentos,
      t,
    );
    expect(observado.titulo).toBe('Revisión observó Registro Único Tributario (v3)');
    expect(observado.motivo).toBe('Falta la hoja 2.');
  });

  it('eximir un documento dice cuál y deja la justificación como motivo', () => {
    const entrada = eventoExpedienteATimeline(
      evento('requisito_eximido', { requisitoId: 'r-camara', justificacion: 'Está inscrita en la Cámara de otro país.' }),
      conDocumentos,
      t,
    );
    expect(entrada.titulo).toBe('Certificado de existencia y representación legal eximido');
    expect(entrada.motivo).toBe('Está inscrita en la Cámara de otro país.');
  });
});
