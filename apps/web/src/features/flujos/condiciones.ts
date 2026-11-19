import type { AtributoPermitidoDto, CampoDeFichaDto, CondicionDto } from '@validalo/api-client';
import type { TFunction } from 'i18next';

/**
 * «Se pide a» de un requisito (RQ-12). El editor ofrece los casos de uso diario como atajos (siempre, solo a personas
 * jurídicas, solo a naturales, según lo que el tercero declara en su ficha, según un atributo del vínculo); una condición armada por la
 * API (país, combinaciones) se muestra descrita y se conserva tal cual al guardar el resto del flujo.
 */
export type AtajoCondicion = 'siempre' | 'juridica' | 'natural' | 'ficha' | 'atributo' | 'personalizada';

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
export const modoLlevaValores = (modo: ModoDeAtributo): boolean => modo !== 'declarado' && modo !== 'noDeclarado';

/** Modos que se comparan con un solo valor. */
export const modoUnSoloValor = (modo: ModoDeAtributo): boolean => modo === 'es' || modo === 'noEs' || modo === 'mayor' || modo === 'menor';

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

/** Los atributos del vínculo que puede mirar una condición se escriben `vinculo.atributos.{clave}` (los permitidos del tipo de vínculo del flujo). */
export const PREFIJO_ATRIBUTO = 'vinculo.atributos.';

/**
 * Cómo se cumple una condición sobre un atributo del vínculo: los modos de la ficha y, para números y fechas, mayor, menor y entre. Cada modo es un predicado (o un «No»
 * de uno) del motor de exigencia, con los operadores que ese motor admite para el tipo del atributo.
 */
export type ModoDeAtributo = ModoDeFicha | 'mayor' | 'menor' | 'entre';

const DE_MODO_ATRIBUTO: Record<ModoDeAtributo, { operador: string; negado: boolean }> = {
  ...DE_MODO,
  mayor: { operador: 'Mayor', negado: false },
  menor: { operador: 'Menor', negado: false },
  entre: { operador: 'Entre', negado: false },
};

const MODOS_DE_ATRIBUTO = Object.keys(DE_MODO_ATRIBUTO) as ModoDeAtributo[];

/** Una condición sobre un atributo del vínculo que el editor sabe armar: su clave, cómo se compara y con qué valores (siempre texto invariante, como los guarda la API). */
export interface CondicionDeAtributo {
  clave: string;
  modo: ModoDeAtributo;
  valores: string[];
}

/** Los modos que ofrece un atributo según su tipo: los mismos operadores que admite la API para él (`AtributosDeExigencia.ClaseDeAtributo`). */
export function modosDeAtributo(tipo: AtributoPermitidoDto['tipo'] | undefined): ModoDeAtributo[] {
  switch (tipo) {
    case 'ListaOpciones':
      return ['alguno', 'todos', 'ninguno', 'declarado', 'noDeclarado'];
    case 'Booleano':
      return ['es', 'noEs', 'declarado', 'noDeclarado'];
    case 'Numero':
    case 'Fecha':
      return ['es', 'noEs', 'mayor', 'menor', 'entre', 'declarado', 'noDeclarado'];
    default:
      return ['es', 'noEs', 'esUnoDe', 'noEsNingunoDe', 'declarado', 'noDeclarado'];
  }
}

/** La condición como la recibe la API: el predicado de `vinculo.atributos.{clave}` y, para «ninguno» y «sin valor», su negación. */
export function condicionDesdeAtributo({ clave, modo, valores }: CondicionDeAtributo): CondicionDto {
  const { operador, negado } = DE_MODO_ATRIBUTO[modo];
  const predicado: CondicionDto = { tipo: 'Predicado', nodos: null, atributo: `${PREFIJO_ATRIBUTO}${clave}`, operador, valores: modoLlevaValores(modo) ? valores : [] };
  return negado ? { tipo: 'No', nodos: [predicado], atributo: null, operador: null, valores: null } : predicado;
}

/**
 * La condición como la entiende el editor si es una sola comparación sobre un atributo del vínculo (o su negación); `null` si es otra cosa (un grupo «Y»/«O», un
 * atributo del tercero o de la ficha): esa se describe y se conserva tal cual.
 */
export function condicionDeAtributoSimple(condicion: CondicionDto | null | undefined): CondicionDeAtributo | null {
  if (!condicion) return null;
  const negado = condicion.tipo === 'No';
  const predicado = negado ? (condicion.nodos?.length === 1 ? condicion.nodos[0] : undefined) : condicion;
  if (predicado?.tipo !== 'Predicado' || !predicado.atributo?.startsWith(PREFIJO_ATRIBUTO)) return null;
  const clave = predicado.atributo.slice(PREFIJO_ATRIBUTO.length);
  const modo = MODOS_DE_ATRIBUTO.find((m) => DE_MODO_ATRIBUTO[m].operador === predicado.operador && DE_MODO_ATRIBUTO[m].negado === negado);
  return clave && modo ? { clave, modo, valores: [...(predicado.valores ?? [])] } : null;
}

/** ¿Es un valor válido para el tipo del atributo? Los números con punto decimal y las fechas `AAAA-MM-DD`, como los valida la API. */
export function valorDeAtributoValido(tipo: AtributoPermitidoDto['tipo'] | undefined, valor: string): boolean {
  const limpio = valor.trim();
  if (tipo === 'Numero') return /^-?\d+(\.\d+)?$/.test(limpio);
  if (tipo === 'Fecha') return /^\d{4}-\d{2}-\d{2}$/.test(limpio);
  return limpio !== '';
}

/**
 * ¿La condición sobre el atributo está completa? Con valores hace falta uno (dos con «entre», el primero no mayor que el segundo) o, con varios, al menos uno. Sin el `tipo`
 * del atributo (el validador de un flujo no lo conoce) basta que haya valores, y «entre» compara como números si ambos lo son.
 */
export function condicionDeAtributoCompleta(condicion: CondicionDeAtributo, tipo?: AtributoPermitidoDto['tipo']): boolean {
  if (!modoLlevaValores(condicion.modo)) return true;
  const validos = condicion.valores.every((v) => valorDeAtributoValido(tipo, v));
  if (condicion.modo === 'entre') {
    const [desde, hasta] = condicion.valores;
    if (condicion.valores.length !== 2 || !validos || desde === undefined || hasta === undefined) return false;
    const numeros = tipo === 'Numero' || (tipo === undefined && [desde, hasta].every((v) => Number.isFinite(Number(v))));
    return numeros ? Number(desde) <= Number(hasta) : desde <= hasta;
  }
  return validos && (modoUnSoloValor(condicion.modo) ? condicion.valores.length === 1 : condicion.valores.length > 0);
}

/** Atajo que corresponde a la condición (sin distinguir mayúsculas, como la API al normalizar). */
export function atajoDe(condicion: CondicionDto | null | undefined): AtajoCondicion {
  if (!condicion) return 'siempre';
  const { tipo, atributo, operador, valores } = condicion;
  if (tipo === 'Y' && (condicion.nodos?.length ?? 0) === 0) return 'siempre';
  if (condicionDeFichaSimple(condicion)) return 'ficha';
  if (condicionDeAtributoSimple(condicion)) return 'atributo';
  if (tipo !== 'Predicado' || atributo !== TIPO_PERSONA || operador !== 'Igual' || valores?.length !== 1) return 'personalizada';
  const valor = (valores[0] ?? '').toLowerCase();
  return valor === 'juridica' ? 'juridica' : valor === 'natural' ? 'natural' : 'personalizada';
}

/**
 * Condición de un atajo; `personalizada` conserva la que había, `ficha` arranca con las especialidades y `atributo` con el primer atributo del tipo de vínculo del flujo
 * (`atributos`) y su primer modo (sin valores: falta elegirlos). Sin atributos que ofrecer, `atributo` conserva la que había.
 */
export function condicionDe(atajo: AtajoCondicion, actual: CondicionDto | null, atributos: readonly AtributoPermitidoDto[] = []): CondicionDto | null {
  switch (atajo) {
    case 'siempre':
      return null;
    case 'juridica':
      return soloTipoPersona('Juridica');
    case 'natural':
      return soloTipoPersona('Natural');
    case 'ficha':
      return condicionDeFichaSimple(actual) ? actual : condicionDesdeFicha({ campo: CAMPO_DE_FICHA_POR_DEFECTO, modo: 'alguno', valores: [] });
    case 'atributo': {
      const primero = atributos[0];
      if (condicionDeAtributoSimple(actual) || !primero) return actual;
      return condicionDesdeAtributo({ clave: primero.clave, modo: modosDeAtributo(primero.tipo)[0] ?? 'es', valores: [] });
    }
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
          : (atributo.startsWith(PREFIJO_FICHA) || atributo.startsWith(PREFIJO_ATRIBUTO)) && (v === 'true' || v === 'false')
            ? t(`flujos.condicion.${v === 'true' ? 'valorSi' : 'valorNo'}`)
            : v,
      );
      const operador = t(`flujos.condicion.operadores.${condicion.operador ?? 'Igual'}`, { defaultValue: condicion.operador ?? '' });
      return [nombre, operador, valores.join(', ')].filter(Boolean).join(' ');
    }
  }
}
