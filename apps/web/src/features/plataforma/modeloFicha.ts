import type { ConfiguracionDeIngresoDto, CorregirGrupoDto, CorregirUsuarioDto, IdentidadExternaDto, SistemaIntegradoDto, TenantDto, UsuarioDto } from '@validasoft/api-client';
import { correoValido, ZONA_POR_DEFECTO } from './modelo';

/**
 * Ficha del grupo en la consola de Plataforma (decisión FG): lo que se corrige del alta —el grupo y quien lo administra— y la política de ingreso. Mismas
 * reglas que el dominio (`Tenant.CorregirDatos`, `Usuario.CorregirDatos`) para avisar antes de enviar; la API decide.
 */

/** Región con la que nace un grupo (la API la usa también cuando llega vacía). */
export const REGION_POR_DEFECTO = 'co';

// ---------- El grupo ----------

export interface BorradorDeGrupo {
  nombre: string;
  region: string;
  zonaHoraria: string;
}

export type ErrorDeGrupo = 'nombre-requerido' | 'zona-invalida';

export function borradorDeGrupo(grupo: Pick<TenantDto, 'nombre' | 'region' | 'zonaHoraria'>): BorradorDeGrupo {
  return { nombre: grupo.nombre, region: grupo.region, zonaHoraria: grupo.zonaHoraria };
}

/** ¿El navegador conoce esa zona horaria IANA? (Si no lo sabe decir, la API decide.) */
export function zonaHorariaValida(zona: string): boolean {
  const limpia = zona.trim() || ZONA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: limpia });
    return true;
  } catch {
    return false;
  }
}

export function validarGrupoEditable(b: BorradorDeGrupo): ErrorDeGrupo[] {
  const errores: ErrorDeGrupo[] = [];
  if (!b.nombre.trim()) errores.push('nombre-requerido');
  if (!zonaHorariaValida(b.zonaHoraria)) errores.push('zona-invalida');
  return errores;
}

/** Los tres datos completos: lo que no cambia, igual (la región o la zona vacías vuelven a las del alta). */
export function cuerpoCorregirGrupo(b: BorradorDeGrupo): CorregirGrupoDto {
  return { nombre: b.nombre.trim(), region: b.region.trim().toLowerCase() || REGION_POR_DEFECTO, zonaHoraria: b.zonaHoraria.trim() || ZONA_POR_DEFECTO };
}

export function hayCambiosDeGrupo(b: BorradorDeGrupo, grupo: Pick<TenantDto, 'nombre' | 'region' | 'zonaHoraria'>): boolean {
  const cuerpo = cuerpoCorregirGrupo(b);
  return cuerpo.nombre !== grupo.nombre || cuerpo.region !== grupo.region || cuerpo.zonaHoraria !== grupo.zonaHoraria;
}

// ---------- Quien administra ----------

export interface BorradorDeAdministrador {
  nombre: string;
  correo: string;
  /** Su id en cada sistema integrado (`sub`), por id de sistema; vacío = sin enlazar. */
  ids: Readonly<Record<string, string>>;
}

export type ErrorDeAdministrador = 'nombre-requerido' | 'correo-invalido';

export function borradorDeAdministrador(u: Pick<UsuarioDto, 'nombre' | 'correo' | 'identidades'>): BorradorDeAdministrador {
  return { nombre: u.nombre, correo: u.correo, ids: Object.fromEntries(u.identidades.map((i) => [i.sistemaId, i.idExterno])) };
}

export function validarAdministrador(b: BorradorDeAdministrador): ErrorDeAdministrador[] {
  const errores: ErrorDeAdministrador[] = [];
  if (!b.nombre.trim()) errores.push('nombre-requerido');
  if (!correoValido(b.correo)) errores.push('correo-invalido');
  return errores;
}

/** Los sistemas en los que la persona puede tener un id: los del grupo y, si hace falta, otros en los que ya está enlazada (no se pierden al guardar). */
export function sistemasDeLaPersona(
  sistemas: readonly SistemaIntegradoDto[],
  u: Pick<UsuarioDto, 'identidades'>,
): { id: string; nombre: string; codigo: string | null }[] {
  const delGrupo = sistemas.map((s) => ({ id: s.id, nombre: s.nombre, codigo: s.codigo }));
  const ajenos = u.identidades.filter((i) => !sistemas.some((s) => s.id === i.sistemaId)).map((i) => ({ id: i.sistemaId, nombre: i.sistemaId, codigo: null }));
  return [...delGrupo, ...ajenos];
}

function identidadesDe(ids: Readonly<Record<string, string>>): IdentidadExternaDto[] {
  return Object.entries(ids)
    .map(([sistemaId, idExterno]) => ({ sistemaId, idExterno: idExterno.trim() }))
    .filter((i) => i.idExterno !== '')
    .sort((a, b) => a.sistemaId.localeCompare(b.sistemaId));
}

function mismasIdentidades(a: readonly IdentidadExternaDto[], b: readonly IdentidadExternaDto[]): boolean {
  const clave = (i: IdentidadExternaDto) => `${i.sistemaId}:${i.idExterno}`;
  return [...a.map(clave)].sort().join('|') === [...b.map(clave)].sort().join('|');
}

/** ¿Cambia el correo? (la API lo normaliza a minúsculas y sin espacios). */
export function cambiaElCorreo(b: BorradorDeAdministrador, u: Pick<UsuarioDto, 'correo'>): boolean {
  return b.correo.trim().toLowerCase() !== u.correo;
}

export function hayCambiosDeAdministrador(b: BorradorDeAdministrador, u: Pick<UsuarioDto, 'nombre' | 'correo' | 'identidades'>): boolean {
  return b.nombre.trim() !== u.nombre || cambiaElCorreo(b, u) || !mismasIdentidades(identidadesDe(b.ids), u.identidades);
}

/**
 * Nombre y correo completos; las identidades solo si cambiaron (la lista reemplaza a todas, y omitirla las conserva); `invitar` solo si cambia el correo y
 * se pidió.
 */
export function cuerpoCorregirAdministrador(b: BorradorDeAdministrador, u: Pick<UsuarioDto, 'correo' | 'identidades'>, invitar: boolean): CorregirUsuarioDto {
  const identidades = identidadesDe(b.ids);
  return {
    nombre: b.nombre.trim(),
    correo: b.correo.trim(),
    ...(!mismasIdentidades(identidades, u.identidades) && { identidades }),
    ...(invitar && cambiaElCorreo(b, u) && { invitar: true }),
  };
}

// ---------- Cómo entran ----------

export interface BorradorDeIngreso {
  delegado: boolean;
  directo: boolean;
  sesionHoras: number;
  inactividadMinutos: number;
  passkeyParaTodos: boolean;
}

export function borradorDeIngreso(i: ConfiguracionDeIngresoDto): BorradorDeIngreso {
  return {
    delegado: i.modos.includes('Delegado'),
    directo: i.modos.includes('Directo'),
    sesionHoras: i.sesionHoras,
    inactividadMinutos: i.inactividadMinutos,
    passkeyParaTodos: i.passkeyParaTodos,
  };
}

/** La política completa; el cierre por inactividad nunca supera la duración de la sesión. */
export function cuerpoIngreso(b: BorradorDeIngreso): ConfiguracionDeIngresoDto {
  return {
    modos: [...(b.delegado ? ['Delegado'] : []), ...(b.directo ? ['Directo'] : [])],
    sesionHoras: b.sesionHoras,
    inactividadMinutos: Math.min(b.inactividadMinutos, b.sesionHoras * 60),
    passkeyParaTodos: b.passkeyParaTodos,
  };
}

/** El id de un sistema para rotular su campo: «Usuario en ERP». */
export function codigoDeSistema(sistema: { codigo: string | null; nombre: string }): string {
  return sistema.codigo ?? sistema.nombre;
}
