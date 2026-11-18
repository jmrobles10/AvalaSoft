import {
  esErrorApi,
  type AdjuntoDeEvaluacionDto,
  type CondicionDto,
  type DefinicionDeCuestionarioDto,
  type EstadoDeEvaluacion,
  type EvaluacionDeExpedienteDto,
  type PreguntaDeCuestionarioDto,
  type QuienResponde,
  type RespuestaDto,
  type SeccionDeCuestionarioDto,
  type TipoDePregunta,
} from '@avalasoft/api-client';
import type { TFunction } from 'i18next';
import { esCO } from '../../i18n/es-CO';

export const TIPOS_DE_PREGUNTA: readonly TipoDePregunta[] = ['SiNo', 'OpcionUnica', 'OpcionMultiple', 'Escala', 'Numero', 'Texto', 'Adjunto'];

/** Tipos que se puntúan por opción (la mejor vale el 100 %); el resto se puntúa por escala o rangos, o no puntúa. */
export const TIPOS_CON_OPCIONES: readonly TipoDePregunta[] = ['SiNo', 'OpcionUnica', 'OpcionMultiple'];

/** Texto, adjunto: no puntúan (su peso es 0). */
export const TIPOS_SIN_PUNTAJE: readonly TipoDePregunta[] = ['Texto', 'Adjunto'];

/** Una cantidad que la API publica como número o como texto (los decimales): siempre un número. */
export function numero(valor: number | string | null | undefined): number {
  const n = typeof valor === 'number' ? valor : Number((valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Puntaje de 0 a 100 con hasta dos decimales y coma decimal (`83,33`); `—` si nada puntuó. */
export function formatearPuntaje(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return numero(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

const SI_NO = [
  { codigo: 'si', texto: 'Sí', puntaje: 10, elimina: false },
  { codigo: 'no', texto: 'No', puntaje: 0, elimina: false },
];

/** Pregunta nueva de un tipo, con lo mínimo para que sea válida (peso 1 si puntúa). */
export function preguntaNueva(tipo: TipoDePregunta, codigo: string): PreguntaDeCuestionarioDto {
  const base: PreguntaDeCuestionarioDto = { codigo, texto: '', tipo, obligatoria: true, peso: TIPOS_SIN_PUNTAJE.includes(tipo) ? 0 : 1, eliminatoria: false, permiteComentario: false };
  switch (tipo) {
    case 'SiNo':
      return { ...base, opciones: SI_NO.map((o) => ({ ...o })) };
    case 'OpcionUnica':
    case 'OpcionMultiple':
      return {
        ...base,
        opciones: [
          { codigo: 'op1', texto: '', puntaje: 10, elimina: false },
          { codigo: 'op2', texto: '', puntaje: 0, elimina: false },
        ],
      };
    case 'Escala':
      return { ...base, escala: { minimo: 1, maximo: 5, minimoAceptable: null } };
    case 'Numero':
      return { ...base, rangos: [{ desde: null, hasta: null, puntaje: 10, elimina: false }] };
    default:
      return base;
  }
}

/** Cambia el tipo conservando el texto, la ayuda y lo obligatorio; opciones, escala y rangos vuelven a los del tipo nuevo. */
export function cambiarTipo(pregunta: PreguntaDeCuestionarioDto, tipo: TipoDePregunta): PreguntaDeCuestionarioDto {
  if (pregunta.tipo === tipo) return pregunta;
  const nueva = preguntaNueva(tipo, pregunta.codigo ?? '');
  return { ...nueva, texto: pregunta.texto, ayuda: pregunta.ayuda, obligatoria: pregunta.obligatoria, permiteComentario: pregunta.permiteComentario, condicion: pregunta.condicion };
}

export function seccionNueva(codigo: string, primeraPregunta: string): SeccionDeCuestionarioDto {
  return { codigo, nombre: '', peso: 1, preguntas: [preguntaNueva('SiNo', primeraPregunta)], condicion: null, descripcion: null };
}

/** Un cuestionario nuevo que ya es válido (la API pide texto en cada pregunta y nombre en cada sección): una sección y una pregunta de ejemplo para reescribir. */
export function definicionInicial(responde: QuienResponde, textos: { seccion: string; pregunta: string }): DefinicionDeCuestionarioDto {
  const seccion = seccionNueva('S1', 'P1');
  return {
    secciones: [{ ...seccion, nombre: textos.seccion, preguntas: seccion.preguntas.map((p) => ({ ...p, texto: textos.pregunta })) }],
    umbralDeAprobacion: 70,
    responde,
    reevaluarCadaMeses: null,
    descripcion: null,
  };
}

/** Siguiente código libre con ese prefijo (`P3`, `S2`): se numeran por orden de creación y no se reutilizan. */
export function siguienteCodigo(definicion: DefinicionDeCuestionarioDto, prefijo: 'P' | 'S'): string {
  const usados = new Set(definicion.secciones.flatMap((s) => [s.codigo, ...s.preguntas.map((p) => p.codigo)]));
  let n = 1;
  while (usados.has(`${prefijo}${String(n)}`)) n++;
  return `${prefijo}${String(n)}`;
}

/** Códigos de preguntas de una pregunta hacia atrás (en la sección y en las anteriores): a las que puede mirar su condición. */
export function preguntasAnteriores(definicion: DefinicionDeCuestionarioDto, seccion: number, pregunta: number): PreguntaDeCuestionarioDto[] {
  return definicion.secciones.flatMap((s, i) => (i < seccion ? s.preguntas : i === seccion ? s.preguntas.slice(0, pregunta) : [])).filter((p) => p.tipo !== 'Adjunto');
}

/** Cómo se muestra una pregunta: siempre, según la respuesta a una anterior, o una condición que armó otro (se conserva y se describe). */
export type VisibilidadDePregunta = { tipo: 'siempre' } | { tipo: 'respuesta'; pregunta: string; operador: 'Igual' | 'Distinto'; valor: string } | { tipo: 'personalizada' };

const PREFIJO_RESPUESTA = 'respuesta.';

export function visibilidadDe(condicion: CondicionDto | null | undefined): VisibilidadDePregunta {
  if (!condicion || (condicion.tipo === 'Y' && (condicion.nodos?.length ?? 0) === 0)) return { tipo: 'siempre' };
  const { atributo, operador, valores } = condicion;
  if (condicion.tipo === 'Predicado' && atributo?.startsWith(PREFIJO_RESPUESTA) && (operador === 'Igual' || operador === 'Distinto') && valores?.length === 1)
    return { tipo: 'respuesta', pregunta: atributo.slice(PREFIJO_RESPUESTA.length), operador, valor: valores[0] ?? '' };
  return { tipo: 'personalizada' };
}

export function condicionDe(visibilidad: Exclude<VisibilidadDePregunta, { tipo: 'personalizada' }>): CondicionDto | null {
  return visibilidad.tipo === 'siempre'
    ? null
    : { tipo: 'Predicado', nodos: null, atributo: `${PREFIJO_RESPUESTA}${visibilidad.pregunta}`, operador: visibilidad.operador, valores: [visibilidad.valor] };
}

/** Opciones con las que se puede comparar la respuesta a una pregunta (Sí/No y las de opciones); las demás no se ofrecen. */
export function opcionesParaCondicion(pregunta: PreguntaDeCuestionarioDto | undefined): { codigo: string; texto: string }[] {
  return pregunta && TIPOS_CON_OPCIONES.includes(pregunta.tipo) ? (pregunta.opciones ?? []).map((o) => ({ codigo: o.codigo, texto: o.texto || o.codigo })) : [];
}

export type ErrorDeDefinicion =
  | { codigo: 'sin-secciones' }
  | { codigo: 'seccion-sin-nombre'; seccion: number }
  | { codigo: 'seccion-sin-preguntas'; seccion: number }
  | { codigo: 'pregunta-sin-texto'; seccion: number; pregunta: number }
  | { codigo: 'opciones-incompletas'; seccion: number; pregunta: number }
  | { codigo: 'eliminatoria-sin-criterio'; seccion: number; pregunta: number }
  | { codigo: 'umbral-invalido' };

/**
 * Lo evidente antes de guardar (la API vuelve a validar todo y su 422 trae la pregunta que falla): secciones con nombre y preguntas, preguntas con texto, opciones
 * con texto y una pregunta eliminatoria que diga qué respuesta elimina.
 */
export function validarDefinicion(definicion: DefinicionDeCuestionarioDto): ErrorDeDefinicion[] {
  const errores: ErrorDeDefinicion[] = [];
  if (definicion.secciones.length === 0) errores.push({ codigo: 'sin-secciones' });
  const umbral = numero(definicion.umbralDeAprobacion);
  if (umbral < 0 || umbral > 100) errores.push({ codigo: 'umbral-invalido' });
  definicion.secciones.forEach((s, seccion) => {
    if (!s.nombre.trim()) errores.push({ codigo: 'seccion-sin-nombre', seccion });
    if (s.preguntas.length === 0) errores.push({ codigo: 'seccion-sin-preguntas', seccion });
    s.preguntas.forEach((p, pregunta) => {
      if (!p.texto.trim()) errores.push({ codigo: 'pregunta-sin-texto', seccion, pregunta });
      if (TIPOS_CON_OPCIONES.includes(p.tipo) && (p.opciones ?? []).some((o) => !o.texto.trim())) errores.push({ codigo: 'opciones-incompletas', seccion, pregunta });
      const criterio = p.tipo === 'Escala' ? p.escala?.minimoAceptable != null : p.tipo === 'Numero' ? (p.rangos ?? []).some((r) => r.elimina) : (p.opciones ?? []).some((o) => o.elimina);
      if (p.eliminatoria && !criterio) errores.push({ codigo: 'eliminatoria-sin-criterio', seccion, pregunta });
    });
  });
  return errores;
}

type CodigoConTexto = Exclude<keyof typeof esCO.evaluaciones.errores, 'generico' | 'enPregunta'>;

function tieneTexto(codigo: string): codigo is CodigoConTexto {
  return codigo in esCO.evaluaciones.errores && codigo !== 'generico' && codigo !== 'enPregunta';
}

/** Texto del error de la API al guardar o publicar un cuestionario (con la pregunta que falla cuando la API la dice). */
export function errorDeCuestionario(error: unknown, t: TFunction): string {
  if (!esErrorApi(error)) return t('evaluaciones.errores.generico');
  const pregunta = typeof error.extensiones.pregunta === 'string' ? error.extensiones.pregunta : null;
  const texto = tieneTexto(error.codigo) ? t(`evaluaciones.errores.${error.codigo}`) : error.detalle || t('evaluaciones.errores.generico');
  return pregunta ? t('evaluaciones.errores.enPregunta', { pregunta, texto }) : texto;
}

/** Por qué reprobó una evaluación (`BajoElUmbral`, `Eliminatoria`); un motivo que la web aún no conoce se muestra tal cual. */
export function textoDeMotivo(motivo: string, t: TFunction): string {
  return motivo === 'BajoElUmbral' || motivo === 'Eliminatoria' ? t(`evaluaciones.motivos.${motivo}`) : motivo;
}

/** De dónde sale una calificación del historial (`Respuesta`, `Recalificacion`). */
export function textoDeOrigen(origen: string, t: TFunction): string {
  return origen === 'Respuesta' || origen === 'Recalificacion' ? t(`evaluaciones.detalle.origen.${origen}`) : origen;
}

/** Color del chip de una evaluación según su estado y su veredicto. */
export function colorDeEstado(estado: EstadoDeEvaluacion, aprobada: boolean | null | undefined): 'default' | 'success' | 'error' | 'warning' {
  if (estado === 'Calificada') return aprobada ? 'success' : 'error';
  return estado === 'Pendiente' ? 'warning' : 'default';
}

/** Lo respondido en palabras (el texto de las opciones, el número, el texto libre, los nombres de los archivos); vacío si no se respondió. */
export function textoDeRespuesta(pregunta: PreguntaDeCuestionarioDto, respuesta: RespuestaDto | undefined, adjuntos: readonly AdjuntoDeEvaluacionDto[]): string {
  if (!respuesta) return '';
  const partes: string[] = [];
  if (respuesta.opciones?.length) partes.push(respuesta.opciones.map((codigo) => pregunta.opciones?.find((o) => o.codigo === codigo)?.texto ?? codigo).join(', '));
  if (respuesta.numero !== null && respuesta.numero !== undefined) partes.push(String(respuesta.numero));
  if (respuesta.texto) partes.push(respuesta.texto);
  if (respuesta.adjuntos?.length) partes.push(respuesta.adjuntos.map((id) => adjuntos.find((a) => a.id === id)?.nombre ?? id).join(', '));
  return partes.join(' · ');
}

/** Mueve un elemento a otra posición (subir o bajar uno); si el destino queda fuera de la lista, devuelve la misma. */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= copia.length || hasta >= copia.length) return copia;
  const quitados = copia.splice(desde, 1);
  copia.splice(hasta, 0, ...quitados);
  return copia;
}

/** Las evaluaciones del expediente que frenan su cierre: las que bloquean y aún no están aprobadas ni anuladas. */
export function evaluacionesQueFrenan(evaluaciones: readonly EvaluacionDeExpedienteDto[] | null | undefined): EvaluacionDeExpedienteDto[] {
  return (evaluaciones ?? []).filter((e) => e.efecto === 'Bloquear' && (e.estado === 'Pendiente' || e.estado === 'Reprobada'));
}
