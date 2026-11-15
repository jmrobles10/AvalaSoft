import { ROLES, type PersonaRelacionada, type RolPersona } from '../tipos';

export const esRol = (valor: string): valor is RolPersona => ROLES.some((r) => r === valor);

/** «Ana María Gómez» o la razón social de una persona jurídica (NIT: solo `nombres`). */
export const nombrePersona = (p: Pick<PersonaRelacionada, 'nombres' | 'apellidos'>) => [p.nombres, p.apellidos].filter(Boolean).join(' ');

/**
 * ¿El número fiscal es de una sociedad y no de una persona? Un NIT; un RNC de 9 dígitos (el de 11 es la cédula de una persona física) o un RUC
 * de Panamá de 12 dígitos o más (el de una persona natural es su cédula). Es la misma regla que aplica el servidor (RG-4): una sociedad lleva
 * razón social y no apellidos.
 */
export function esSociedad(tipo: string | null | undefined, numero: string | null | undefined): boolean {
  const limpio = (numero ?? '').toUpperCase().replace(/[\s.-]/g, '');
  switch ((tipo ?? '').toUpperCase()) {
    case 'NIT':
      return true;
    case 'RNC':
      return limpio.length === 9;
    case 'RUC':
      return /^[0-9]{12,}$/.test(limpio);
    default:
      return false;
  }
}
