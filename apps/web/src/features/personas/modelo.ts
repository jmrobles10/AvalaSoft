import type { PersonaDelRequisitoDto } from '@validalo/api-client';
import type { TFunction } from 'i18next';

const ROLES = ['RepresentanteLegal', 'Suplente', 'Socio', 'BeneficiarioFinal', 'MiembroDe'] as const;
type Rol = (typeof ROLES)[number];

const esRol = (valor: string): valor is Rol => (ROLES as readonly string[]).includes(valor);

/** El rol con el que una persona se relaciona con el tercero, en palabras; un rol que el cliente no conoce se muestra tal cual. */
export function textoDelRol(rol: string, t: TFunction): string {
  return esRol(rol) ? t(`personasRelacionadas.roles.${rol}`) : rol;
}

/** Lo que dice la tarjeta de un requisito de persona (ADR-0010): de quién es el documento, o que nadie cumple el rol todavía; `null` si es el documento del propio tercero. */
export function textoDelRequisito(persona: PersonaDelRequisitoDto | null | undefined, t: TFunction): string | null {
  if (!persona) return null;
  const rol = textoDelRol(persona.rol, t);
  if (persona.sinPersona) return t('personasRelacionadas.requisito.sinPersona', { rol: rol.toLowerCase() });
  return t('personasRelacionadas.requisito.de', { nombre: persona.nombre ?? '', rol });
}
