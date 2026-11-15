import type { CampoDeFichaDto, CondicionDto } from '@validasoft/api-client';
import type { TFunction } from 'i18next';

/**
 * «Se pide a» de un requisito (RQ-12). El editor ofrece los casos de uso diario como atajos (siempre, solo a personas
 * jurídicas, solo a naturales, según lo que el tercero declara en su ficha); una condición armada por la API (país, atributos
 * del vínculo, combinaciones) se muestra descrita y se conserva tal cual al guardar el resto del flujo.
 */
export type AtajoCondicion = 'siempre' | 'juridica' | 'natural' | 'ficha' | 'personalizada';

const TIPO_PERSONA = 'tercero.tipoPersona';

/** Los campos de la ficha del tercero que puede mirar una condición se escriben `ficha.{seccion}.{campo}` (EF-1). */
export const PREFIJO_FICHA = 'ficha.';

/** Campo con el que arranca una condición sobre la ficha: lo más pedido (los documentos según la especialidad). */
export const CAMPO_DE_FICHA_POR_DEFECTO = 'ficha.especialidades.especialidades';

function soloTipoPersona(valor: 'Juridica' | 'Natural'): CondicionDto {
  return { tipo: 'Predicado', nodos: null, atributo: TIPO_PERSONA, operador: 'Igual', valores: [valor] };
}

/**
 * Cómo se cumple una condición sobre un campo de la ficha (EF-1): las listas se comparan con «alguno» o «todos», lo escalar con «es»; negarlo o
 * preguntar si el tercero declaró el campo cubre el resto. Cada modo es un predicado (o un «No» de uno) del motor de exigencia.
 */
export type ModoDeFicha = 'alguno' | 'todos' | 'ninguno' | 'es' | 'noEs' | 'esUnoDe' | 'noEsNingunoDe' | 'declarado' | 'noDeclarado';

/** Una condición sobre la ficha que el editor sabe armar: un campo, cómo se compara y con qué valores. */
export interface CondicionDeFicha {
  campo: string;
  modo: ModoDeFicha;
  valores: string[];
}

const DE_MODO: Record<ModoDeFicha, { operador: string; negado: boolean }> = {
  alguno: { operador: 'ContieneAlguno', negado: false },
  todos: { operador: 'ContieneTodos', negado: false },
  ninguno: { operador: 'ContieneAlguno', negado: true },
  es: { operador: 'Igual', negado: false },
  noEs: { operador: 'Distinto', negado: false },
  esUnoDe: { operador: 'En', negado: false },
  noEsNingunoDe: { operador: 'NoEn', negado: false },
  declarado: { operador: 'Existe', negado: false },
  noDeclarado: { operador: 'Existe', negado: true },
};

const MODOS = Object.keys(DE_MODO) as ModoDeFicha[];

/** Modos que se comparan con valores (los de «declarado» no llevan ninguno). */
export const modoLlevaValores = (modo: ModoDeFicha): boolean => modo !== 'declarado' && modo !== 'noDeclarado';

/** Modos que se comparan con un solo valor. */
export const modoUnSoloValor = (modo: ModoDeFicha): boolean => modo === 'es' || modo === 'noEs';

/** Los modos que ofrece un campo según su tipo (los mismos operadores que admite la API para él). */
export function modosDeCampo(campo: Pick<CampoDeFichaDto, 'tipo'>): ModoDeFicha[] {
  switch (campo.tipo) {
    case 'ListaOpciones':
      return ['alguno', 'todos', 'ninguno', 'declarado', 'noDeclarado'];
    case 'Booleano':
      return ['es', 'declarado', 'noDeclarado'];
    default:
      return ['es', 'noEs', 'esUnoDe', 'noEsNingunoDe', 'declarado', 'noDeclarado'];
  }
}

/** La condición como la recibe la API: el predicado del campo y, para «ninguno» y «no declarado», su negación. */
export function condicionDesdeFicha({ campo, modo, valores }: CondicionDeFicha): CondicionDto {
  const { operador, negado } = DE_MODO[modo];
  const predicado: CondicionDto = { tipo: 'Predicado', nodos: null, atributo: campo, operador, valores: modoLlevaValores(modo) ? valores : [] };
  return negado ? { tipo: 'No', nodos: [predicado], atributo: null, operador: null, valores: null } : predicado;
}

/**
 * La condición como la entiende el editor si es una sola comparación sobre la ficha (o su negación); `null` si es otra cosa (un grupo
 * «Y»/«O», otros atributos): esa se describe y se conserva tal cual.
 */
export function condicionDeFichaSimple(condicion: CondicionDto | null | undefined): CondicionDeFicha | null {
  if (!condicion) return null;
  const negado = condicion.tipo === 'No';
  const predicado = negado ? (condicion.nodos?.length === 1 ? condicion.nodos[0] : undefined) : condicion;
  if (predicado?.tipo !== 'Predicado' || !predicado.atributo?.startsWith(PREFIJO_FICHA)) return null;
  const modo = MODOS.find((m) => DE_MODO[m].operador === predicado.operador && DE_MODO[m].negado === negado);
  return modo ? { campo: predicado.atributo, modo, valores: [...(predicado.valores ?? [])] } : null;
}

/** ¿La condición sobre la ficha está completa? Con valores hace falta al menos uno (y exactamente uno con «es» o «no es»). */
export function condicionDeFichaCompleta(condicion: CondicionDeFicha): boolean {
  if (!modoLlevaValores(condicion.modo)) return true;
  return modoUnSoloValor(condicion.modo) ? condicion.valores.length === 1 : condicion.valores.length > 0;
}

/** Atajo que corresponde a la condición (sin distinguir mayúsculas, como la API al normalizar). */
export function atajoDe(condicion: CondicionDto | null | undefined): AtajoCondicion {
  if (!condicion) return 'siempre';
  const { tipo, atributo, operador, valores } = condicion;
  if (tipo === 'Y' && (condicion.nodos?.length ?? 0) === 0) return 'siempre';
  if (condicionDeFichaSimple(condicion)) return 'ficha';
  if (tipo !== 'Predicado' || atributo !== TIPO_PERSONA || operador !== 'Igual' || valores?.length !== 1) return 'personalizada';
  const valor = (valores[0] ?? '').toLowerCase();
  return valor === 'juridica' ? 'juridica' : valor === 'natural' ? 'natural' : 'personalizada';
}

/** Condición de un atajo; `personalizada` conserva la que había y `ficha` arranca con las especialidades (sin valores: falta elegirlos). */
export function condicionDe(atajo: AtajoCondicion, actual: CondicionDto | null): CondicionDto | null {
  switch (atajo) {
    case 'siempre':
      return null;
    case 'juridica':
      return soloTipoPersona('Juridica');
    case 'natural':
      return soloTipoPersona('Natural');
    case 'ficha':
      return condicionDeFichaSimple(actual) ? actual : condicionDesdeFicha({ campo: CAMPO_DE_FICHA_POR_DEFECTO, modo: 'alguno', valores: [] });
    case 'personalizada':
      return actual;
  }
}

/** Texto legible de una condición, p. ej. «tipo de persona es Jurídica y país en CO, PE». */
export function describirCondicion(condicion: CondicionDto, t: TFunction): string {
  const nodos = condicion.nodos ?? [];
  const grupo = (separador: string) => nodos.map((n) => (n.nodos?.length ? `(${describirCondicion(n, t)})` : describirCondicion(n, t))).join(separador);
  switch (condicion.tipo) {
    case 'Y':
      return grupo(` ${t('flujos.condicion.y')} `);
    case 'O':
      return grupo(` ${t('flujos.condicion.o')} `);
    case 'No':
      return `${t('flujos.condicion.no')} (${grupo('')})`;
    default: {
      const atributo = condicion.atributo ?? '';
      const nombre = atributo.startsWith('vinculo.atributos.')
        ? atributo.slice('vinculo.atributos.'.length)
        : t(`flujos.condicion.atributos.${atributo}`, { defaultValue: atributo });
      const valores = (condicion.valores ?? []).map((v) =>
        atributo === TIPO_PERSONA
          ? t(`flujos.condicion.personas.${v}`, { defaultValue: v })
          : atributo.startsWith(PREFIJO_FICHA) && (v === 'true' || v === 'false')
            ? t(`flujos.condicion.${v === 'true' ? 'valorSi' : 'valorNo'}`)
            : v,
      );
      const operador = t(`flujos.condicion.operadores.${condicion.operador ?? 'Igual'}`, { defaultValue: condicion.operador ?? '' });
      return [nombre, operador, valores.join(', ')].filter(Boolean).join(' ');
    }
  }
}
