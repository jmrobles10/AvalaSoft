import type { AtributoPermitidoDto } from '@validasoft/api-client';

/**
 * Los valores de los atributos del vínculo en un formulario (decisión IM): uno por atributo permitido de su tipo de vínculo. Cada control guarda texto (número, fecha, opción, sí/no
 * como `true`/`false`) y la lista de opciones, un arreglo; `cuerpoDeAtributos` los lleva a lo que recibe la API (`ValidadorDeAtributos`: texto, número, `AAAA-MM-DD`, booleano,
 * opción y lista de opciones) y `validarAtributos` avisa antes de enviar de lo mismo que la API rechazaría.
 */
export type ValorDeAtributo = string | string[];
export type ValoresDeAtributos = Readonly<Record<string, ValorDeAtributo>>;

/** Lo que se envía por atributo: lo que `ValidadorDeAtributos` acepta para su tipo. */
export type CuerpoDeAtributos = Record<string, string | number | boolean | string[]>;

export type ErrorDeAtributo = 'requerido' | 'numero-invalido' | 'fecha-invalida' | 'opcion-invalida';

const esLista = (atributo: AtributoPermitidoDto) => atributo.tipo === 'ListaOpciones';

/** El valor vacío del control de un atributo. */
export const valorVacio = (atributo: AtributoPermitidoDto): ValorDeAtributo => (esLista(atributo) ? [] : '');

/** El valor de un atributo en el formulario, a partir del que tiene el vínculo (`undefined` = vacío). */
function aValor(atributo: AtributoPermitidoDto, actual: unknown): ValorDeAtributo {
  if (esLista(atributo)) return Array.isArray(actual) ? actual.filter((v): v is string => typeof v === 'string') : [];
  if (typeof actual === 'string') return actual;
  if (typeof actual === 'number' || typeof actual === 'boolean') return String(actual);
  return '';
}

/** Los valores iniciales del formulario: los que el vínculo ya tiene (los atributos que el tipo ya no admite no se muestran) y vacío en el resto. */
export function valoresIniciales(permitidos: readonly AtributoPermitidoDto[], actuales: Readonly<Record<string, unknown>> = {}): ValoresDeAtributos {
  return Object.fromEntries(permitidos.map((a) => [a.clave, aValor(a, actuales[a.clave])]));
}

const textoDe = (valor: ValorDeAtributo | undefined): string => (typeof valor === 'string' ? valor.trim() : '');
const listaDe = (valor: ValorDeAtributo | undefined): string[] => (Array.isArray(valor) ? valor : []);

function vacio(atributo: AtributoPermitidoDto, valor: ValorDeAtributo | undefined): boolean {
  return esLista(atributo) ? listaDe(valor).length === 0 : textoDe(valor) === '';
}

/** Los errores por atributo (`clave` → código): obligatorio sin valor, número, fecha u opción que la API rechazaría. */
export function validarAtributos(permitidos: readonly AtributoPermitidoDto[], valores: ValoresDeAtributos): Record<string, ErrorDeAtributo> {
  const errores: Record<string, ErrorDeAtributo> = {};
  for (const a of permitidos) {
    const valor = valores[a.clave];
    if (vacio(a, valor)) {
      if (a.obligatorio) errores[a.clave] = 'requerido';
      continue;
    }
    const opciones = a.opciones ?? [];
    if (a.tipo === 'Numero' && !/^-?\d+(\.\d+)?$/.test(textoDe(valor))) errores[a.clave] = 'numero-invalido';
    else if (a.tipo === 'Fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(textoDe(valor))) errores[a.clave] = 'fecha-invalida';
    else if (a.tipo === 'Opcion' && !opciones.includes(textoDe(valor))) errores[a.clave] = 'opcion-invalida';
    else if (a.tipo === 'ListaOpciones' && !listaDe(valor).every((o) => opciones.includes(o))) errores[a.clave] = 'opcion-invalida';
  }
  return errores;
}

/** El cuerpo para la API: solo los atributos con valor (el vacío no se envía: quita el atributo del vínculo o lo deja sin poner). */
export function cuerpoDeAtributos(permitidos: readonly AtributoPermitidoDto[], valores: ValoresDeAtributos): CuerpoDeAtributos {
  const cuerpo: CuerpoDeAtributos = {};
  for (const a of permitidos) {
    const valor = valores[a.clave];
    if (vacio(a, valor)) continue;
    switch (a.tipo) {
      case 'Numero':
        cuerpo[a.clave] = Number(textoDe(valor));
        break;
      case 'Booleano':
        cuerpo[a.clave] = textoDe(valor) === 'true';
        break;
      case 'ListaOpciones':
        cuerpo[a.clave] = listaDe(valor);
        break;
      default:
        cuerpo[a.clave] = textoDe(valor);
    }
  }
  return cuerpo;
}

/** El valor que el formulario muestra de un atributo, aunque aún no se haya tocado (el que haya o el vacío de su tipo). */
export function valorActual(atributo: AtributoPermitidoDto, valores: ValoresDeAtributos): ValorDeAtributo {
  return valores[atributo.clave] ?? valorVacio(atributo);
}
