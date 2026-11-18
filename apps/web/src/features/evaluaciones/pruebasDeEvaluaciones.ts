import type { CuestionarioDto, DefinicionDeCuestionarioDto, EvaluacionDto, EvaluacionDeExpedienteDto, ResultadoDeEvaluacionDto } from '@avalasoft/api-client';

/** Datos de prueba de cuestionarios y evaluaciones (solo para las pruebas de esta carpeta). */
export const DEFINICION: DefinicionDeCuestionarioDto = {
  secciones: [
    {
      codigo: 'S1',
      nombre: 'Cumplimiento',
      peso: 1,
      preguntas: [
        {
          codigo: 'P1',
          texto: '¿Tiene certificación ISO 9001?',
          tipo: 'SiNo',
          obligatoria: true,
          peso: 3,
          eliminatoria: true,
          permiteComentario: false,
          opciones: [
            { codigo: 'si', texto: 'Sí', puntaje: 10, elimina: false },
            { codigo: 'no', texto: 'No', puntaje: 0, elimina: true },
          ],
        },
        { codigo: 'P2', texto: 'Cuéntanos tus clientes principales', tipo: 'Texto', obligatoria: false, peso: 0, eliminatoria: false, permiteComentario: false },
      ],
    },
  ],
  umbralDeAprobacion: 70,
  responde: 'Evaluador',
  reevaluarCadaMeses: null,
  descripcion: null,
};

export function cuestionario(cambios: Partial<CuestionarioDto> = {}): CuestionarioDto {
  return {
    id: 'q1',
    empresaId: 'emp',
    codigo: 'PROVEEDOR-NUEVO',
    nombre: 'Evaluación de proveedor nuevo',
    publicada: { id: 'v1', version: 2, estado: 'Publicada', definicion: DEFINICION, creadaEn: '2026-11-01T00:00:00Z', publicadaEn: '2026-11-02T00:00:00Z', retiradaEn: null },
    borrador: null,
    creadoEn: '2026-11-01T00:00:00Z',
    actualizadoEn: '2026-11-02T00:00:00Z',
    ...cambios,
  };
}

export function resultado(cambios: Partial<ResultadoDeEvaluacionDto> = {}): ResultadoDeEvaluacionDto {
  return {
    puntaje: 100,
    umbral: 70,
    aprobada: true,
    calculada: true,
    motivos: [],
    eliminatorias: [],
    secciones: [{ codigo: 'S1', nombre: 'Cumplimiento', peso: 1, puntaje: 100, aplica: true }],
    preguntas: [
      { codigo: 'P1', visible: true, respondida: true, puntaje: 100, elimina: false, ajustada: false },
      { codigo: 'P2', visible: true, respondida: true, puntaje: null, elimina: false, ajustada: false },
    ],
    ...cambios,
  };
}

export function evaluacion(cambios: Partial<EvaluacionDto> = {}): EvaluacionDto {
  return {
    id: 'ev1',
    empresaId: 'emp',
    vinculoId: 'v1',
    expedienteId: 'exp1',
    folio: 'EXP-0001',
    tercero: { id: 't1', nombre: 'Ferretería El Tornillo', identificacion: 'NIT 900123456-8' },
    motivo: 'Expediente',
    cuestionario: { id: 'q1', versionId: 'v1', version: 2, codigo: 'PROVEEDOR-NUEVO', nombre: 'Evaluación de proveedor nuevo' },
    responde: 'Evaluador',
    efecto: 'Bloquear',
    estado: 'Pendiente',
    definicion: DEFINICION,
    respuestas: [],
    resultado: null,
    calificaciones: [],
    ajustes: [],
    respondidaPor: null,
    respondidaEn: null,
    vigenteHasta: null,
    intentos: 0,
    recalificaciones: 0,
    justificacion: null,
    adjuntos: [],
    anterior: null,
    asignadaEn: '2026-11-10T15:00:00Z',
    actualizadaEn: '2026-11-10T15:00:00Z',
    version: 1,
    ...cambios,
  };
}

/** Una evaluación ya calificada con el resultado dado (aprobada por defecto) y su primera calificación en el historial. */
export function evaluacionCalificada(cambios: Partial<EvaluacionDto> = {}, res: ResultadoDeEvaluacionDto = resultado()): EvaluacionDto {
  return evaluacion({
    estado: 'Calificada',
    respuestas: [{ pregunta: 'P1', opciones: ['si'] }],
    resultado: res,
    calificaciones: [{ numero: 1, origen: 'Respuesta', resultado: res, justificacion: null, por: { tipo: 'Usuario', id: 'u1', nombre: 'Ana Revisora' }, fecha: '2026-11-11T10:00:00Z' }],
    respondidaPor: { tipo: 'Usuario', id: 'u1', nombre: 'Ana Revisora' },
    respondidaEn: '2026-11-11T10:00:00Z',
    ...cambios,
  });
}

export function evaluacionDeExpediente(cambios: Partial<EvaluacionDeExpedienteDto> = {}): EvaluacionDeExpedienteDto {
  return {
    evaluacionId: 'ev1',
    codigo: 'PROVEEDOR-NUEVO',
    nombre: 'Evaluación de proveedor nuevo',
    responde: 'Evaluador',
    efecto: 'Bloquear',
    estado: 'Pendiente',
    puntaje: null,
    actualizadaEn: '2026-11-10T15:00:00Z',
    ...cambios,
  };
}
