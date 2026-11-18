import { ErrorApi, type DefinicionDeCuestionarioDto } from '@avalasoft/api-client';
import i18n from 'i18next';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { evaluacionDeExpediente, DEFINICION } from './pruebasDeEvaluaciones';
import {
  cambiarTipo,
  colorDeEstado,
  condicionDe,
  definicionInicial,
  errorDeCuestionario,
  evaluacionesQueFrenan,
  formatearPuntaje,
  mover,
  numero,
  opcionesParaCondicion,
  preguntaNueva,
  preguntasAnteriores,
  siguienteCodigo,
  textoDeMotivo,
  textoDeOrigen,
  textoDeRespuesta,
  validarDefinicion,
  visibilidadDe,
} from './modelo';

const t = i18n.t.bind(i18n);

describe('números y puntajes', () => {
  it('lee los decimales que llegan como número o como texto (con coma o punto)', () => {
    expect(numero(70)).toBe(70);
    expect(numero('83.33')).toBe(83.33);
    expect(numero('83,33')).toBe(83.33);
    expect(numero(null)).toBe(0);
    expect(numero('abc')).toBe(0);
  });

  it('muestra el puntaje con hasta dos decimales y coma decimal, y un guion si nada puntuó', () => {
    expect(formatearPuntaje('83.333')).toBe('83,33');
    expect(formatearPuntaje(100)).toBe('100');
    expect(formatearPuntaje(null)).toBe('—');
  });
});

describe('preguntas nuevas', () => {
  it('sí o no nace con sus dos opciones y peso 1; texto y adjunto no puntúan', () => {
    const siNo = preguntaNueva('SiNo', 'P1');
    expect(siNo.opciones?.map((o) => [o.codigo, o.puntaje])).toEqual([
      ['si', 10],
      ['no', 0],
    ]);
    expect(siNo.peso).toBe(1);
    expect(preguntaNueva('Texto', 'P2').peso).toBe(0);
    expect(preguntaNueva('Adjunto', 'P3').peso).toBe(0);
  });

  it('escala y número nacen con su configuración; opciones con dos vacías', () => {
    expect(preguntaNueva('Escala', 'P1').escala).toEqual({ minimo: 1, maximo: 5, minimoAceptable: null });
    expect(preguntaNueva('Numero', 'P1').rangos).toHaveLength(1);
    expect(preguntaNueva('OpcionUnica', 'P1').opciones).toHaveLength(2);
  });

  it('cambiar el tipo conserva el texto, la ayuda y lo obligatorio, y repone lo propio del tipo nuevo', () => {
    const original = { ...preguntaNueva('SiNo', 'P1'), texto: '¿Cumple?', ayuda: 'Mira el RUT', obligatoria: false, permiteComentario: true };
    const cambiada = cambiarTipo(original, 'Escala');
    expect(cambiada).toMatchObject({ codigo: 'P1', tipo: 'Escala', texto: '¿Cumple?', ayuda: 'Mira el RUT', obligatoria: false, permiteComentario: true });
    expect(cambiada.opciones).toBeUndefined();
    expect(cambiada.escala).toEqual({ minimo: 1, maximo: 5, minimoAceptable: null });
    expect(cambiarTipo(original, 'SiNo')).toBe(original);
  });

  it('la definición inicial ya es válida: una sección y una pregunta con texto', () => {
    const inicial = definicionInicial('Tercero', { seccion: 'General', pregunta: 'Primera pregunta' });
    expect(inicial.responde).toBe('Tercero');
    expect(inicial.umbralDeAprobacion).toBe(70);
    expect(validarDefinicion(inicial)).toEqual([]);
  });

  it('numera los códigos por orden de creación sin reutilizar los usados', () => {
    expect(siguienteCodigo(DEFINICION, 'P')).toBe('P3');
    expect(siguienteCodigo(DEFINICION, 'S')).toBe('S2');
  });
});

describe('condiciones de visibilidad', () => {
  it('sin condición o con una vacía la pregunta se muestra siempre', () => {
    expect(visibilidadDe(null)).toEqual({ tipo: 'siempre' });
    expect(visibilidadDe({ tipo: 'Y', nodos: [] })).toEqual({ tipo: 'siempre' });
  });

  it('la condición simple sobre la respuesta a otra pregunta se arma y se lee de vuelta', () => {
    const condicion = condicionDe({ tipo: 'respuesta', pregunta: 'P1', operador: 'Igual', valor: 'si' });
    expect(condicion).toEqual({ tipo: 'Predicado', nodos: null, atributo: 'respuesta.P1', operador: 'Igual', valores: ['si'] });
    expect(visibilidadDe(condicion)).toEqual({ tipo: 'respuesta', pregunta: 'P1', operador: 'Igual', valor: 'si' });
    expect(condicionDe({ tipo: 'siempre' })).toBeNull();
  });

  it('una condición que armó otro (sobre el tercero, compuesta) se conserva como personalizada', () => {
    expect(visibilidadDe({ tipo: 'Predicado', atributo: 'tercero.esExtranjero', operador: 'Igual', valores: ['true'] })).toEqual({ tipo: 'personalizada' });
    expect(visibilidadDe({ tipo: 'O', nodos: [{ tipo: 'Predicado', atributo: 'respuesta.P1', operador: 'Igual', valores: ['si'] }] })).toEqual({ tipo: 'personalizada' });
  });

  it('solo mira a las preguntas anteriores y no ofrece los adjuntos', () => {
    const definicion: DefinicionDeCuestionarioDto = {
      ...DEFINICION,
      secciones: [
        { ...DEFINICION.secciones[0]!, preguntas: [preguntaNueva('SiNo', 'P1'), preguntaNueva('Adjunto', 'P2'), preguntaNueva('Numero', 'P3')] },
        { ...DEFINICION.secciones[0]!, codigo: 'S2', preguntas: [preguntaNueva('Texto', 'P4')] },
      ],
    };
    expect(preguntasAnteriores(definicion, 0, 2).map((p) => p.codigo)).toEqual(['P1']);
    expect(preguntasAnteriores(definicion, 1, 0).map((p) => p.codigo)).toEqual(['P1', 'P3']);
  });

  it('las opciones comparables son las de sí o no y las de opción; el resto no se ofrece', () => {
    expect(opcionesParaCondicion(preguntaNueva('SiNo', 'P1')).map((o) => o.codigo)).toEqual(['si', 'no']);
    expect(opcionesParaCondicion(preguntaNueva('Escala', 'P1'))).toEqual([]);
    expect(opcionesParaCondicion(undefined)).toEqual([]);
  });
});

describe('validación antes de guardar', () => {
  const con = (cambio: (d: DefinicionDeCuestionarioDto) => DefinicionDeCuestionarioDto) => validarDefinicion(cambio(structuredClone(DEFINICION)));

  it('una definición completa no tiene errores', () => {
    expect(validarDefinicion(DEFINICION)).toEqual([]);
  });

  it('pide secciones, nombre, preguntas, texto y opciones con texto', () => {
    expect(con((d) => ({ ...d, secciones: [] }))).toEqual([{ codigo: 'sin-secciones' }]);
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, nombre: ' ' }] }))).toEqual([{ codigo: 'seccion-sin-nombre', seccion: 0 }]);
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [] }] }))).toEqual([{ codigo: 'seccion-sin-preguntas', seccion: 0 }]);
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [{ ...d.secciones[0]!.preguntas[1]!, texto: '' }] }] }))).toEqual([
      { codigo: 'pregunta-sin-texto', seccion: 0, pregunta: 0 },
    ]);
    const incompleta = { ...preguntaNueva('OpcionUnica', 'P1'), texto: 'Elige' };
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [incompleta] }] }))).toEqual([{ codigo: 'opciones-incompletas', seccion: 0, pregunta: 0 }]);
  });

  it('una pregunta eliminatoria debe decir qué respuesta elimina', () => {
    const sinCriterio = { ...preguntaNueva('SiNo', 'P1'), texto: '¿Cumple?', eliminatoria: true };
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [sinCriterio] }] }))).toEqual([{ codigo: 'eliminatoria-sin-criterio', seccion: 0, pregunta: 0 }]);
    const conCriterio = { ...sinCriterio, opciones: sinCriterio.opciones?.map((o) => ({ ...o, elimina: o.codigo === 'no' })) };
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [conCriterio] }] }))).toEqual([]);
    const escala = { ...preguntaNueva('Escala', 'P1'), texto: 'Califica', eliminatoria: true, escala: { minimo: 1, maximo: 5, minimoAceptable: 3 } };
    expect(con((d) => ({ ...d, secciones: [{ ...d.secciones[0]!, preguntas: [escala] }] }))).toEqual([]);
  });

  it('el umbral va de 0 a 100', () => {
    expect(con((d) => ({ ...d, umbralDeAprobacion: 120 }))).toEqual([{ codigo: 'umbral-invalido' }]);
    expect(con((d) => ({ ...d, umbralDeAprobacion: '85.5' }))).toEqual([]);
  });
});

describe('listas y expediente', () => {
  it('mover sube o baja un elemento y no toca la lista cuando el destino queda fuera', () => {
    expect(mover(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(mover(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(mover(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(mover(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
  });

  it('frenan el cierre las que bloquean y están pendientes o reprobadas', () => {
    const lista = [
      evaluacionDeExpediente({ evaluacionId: '1', estado: 'Pendiente' }),
      evaluacionDeExpediente({ evaluacionId: '2', estado: 'Reprobada' }),
      evaluacionDeExpediente({ evaluacionId: '3', estado: 'Aprobada' }),
      evaluacionDeExpediente({ evaluacionId: '4', estado: 'Anulada' }),
      evaluacionDeExpediente({ evaluacionId: '5', estado: 'Reprobada', efecto: 'Observar' }),
    ];
    expect(evaluacionesQueFrenan(lista).map((e) => e.evaluacionId)).toEqual(['1', '2']);
    expect(evaluacionesQueFrenan(null)).toEqual([]);
  });

  it('el color del chip sigue el estado y el veredicto', () => {
    expect(colorDeEstado('Calificada', true)).toBe('success');
    expect(colorDeEstado('Calificada', false)).toBe('error');
    expect(colorDeEstado('Pendiente', null)).toBe('warning');
    expect(colorDeEstado('Anulada', null)).toBe('default');
  });
});

describe('textos', () => {
  it('lo respondido se dice con las palabras de las opciones, el número, el texto y los archivos', () => {
    const [p1, p2] = DEFINICION.secciones[0]!.preguntas;
    expect(textoDeRespuesta(p1!, { pregunta: 'P1', opciones: ['si'] }, [])).toBe('Sí');
    expect(textoDeRespuesta(p2!, { pregunta: 'P2', texto: 'Ferretería Don Luis', adjuntos: ['a1'] }, [{ id: 'a1', nombre: 'rut.pdf', tipoContenido: 'application/pdf', tamano: 10, fecha: '2026-11-01T00:00:00Z' }])).toBe(
      'Ferretería Don Luis · rut.pdf',
    );
    expect(textoDeRespuesta(p1!, undefined, [])).toBe('');
  });

  it('el motivo y el origen que la web conoce se traducen y los demás se muestran tal cual', () => {
    expect(textoDeMotivo('BajoElUmbral', t)).toBe('Bajo el umbral');
    expect(textoDeMotivo('Eliminatoria', t)).toBe('Pregunta eliminatoria');
    expect(textoDeMotivo('Nuevo', t)).toBe('Nuevo');
    expect(textoDeOrigen('Recalificacion', t)).toBe('Recalificación');
    expect(textoDeOrigen('Otro', t)).toBe('Otro');
  });

  it('el error de la API usa el texto propio del código y, si no lo hay, el detalle; con la pregunta que falla la nombra', () => {
    expect(errorDeCuestionario(new ErrorApi(409, 'cuestionario-duplicado', 'Ya existe.', null, null), t)).toBe('Ya hay un cuestionario con ese código. Usa otro.');
    expect(errorDeCuestionario(new ErrorApi(422, 'cuestionario-invalido', 'La pregunta no tiene opciones.', null, null), t)).toBe('La pregunta no tiene opciones.');
    expect(errorDeCuestionario(new ErrorApi(422, 'cuestionario-invalido', 'Faltan opciones.', null, null, {}, { pregunta: 'P3' }), t)).toBe('Pregunta P3: Faltan opciones.');
    expect(errorDeCuestionario(new Error('sin red'), t)).toBe('No se pudo completar la acción. Revisa los datos e inténtalo de nuevo.');
  });
});
