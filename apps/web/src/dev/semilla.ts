/**
 * Solo desarrollo: lo que `pnpm semilla:dev` o `pnpm semilla:plataforma` dejan en apps/web/.semilla.local.json y Vite
 * sirve en `/__dev/semilla.json`. El archivo puede traer solo la parte de Plataforma (`--solo-plataforma`, una base limpia
 * sin tenant ni sistema de demostración), así que cada parte es opcional y se valida por separado.
 */
import type { OperadorDev, PersonaDelegada } from './firmarAsercion';

/** La parte del tenant de demostración: el sistema integrado «DEMO», sus claves y las personas. Solo la escribe `pnpm semilla:dev`. */
export interface SemillaDemo {
  apiKey: string;
  clavePrivadaPem: string;
  sistema: { id: string; codigo: string };
  empresas: { id: string; nombre: string }[];
  usuarios: (PersonaDelegada & { descripcion: string })[];
}

/** Lo que se pudo leer del archivo: al menos una de las dos partes. */
export interface SemillaDev {
  /** Ausente con `pnpm semilla:plataforma` (y en semillas anteriores a que existiera la demostración completa). */
  demo: SemillaDemo | null;
  /** Ausente en semillas anteriores a la consola de Plataforma. */
  plataforma: OperadorDev | null;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

function esPersona(valor: unknown): valor is PersonaDelegada {
  return esRegistro(valor) && esTexto(valor.sub) && esTexto(valor.nombre) && esTexto(valor.correo);
}

function esUsuarioDeDemo(valor: unknown): valor is PersonaDelegada & { descripcion: string } {
  return esPersona(valor) && 'descripcion' in valor && typeof valor.descripcion === 'string';
}

function esEmpresa(valor: unknown): valor is { id: string; nombre: string } {
  return esRegistro(valor) && esTexto(valor.id) && esTexto(valor.nombre);
}

function leerDemo(datos: Record<string, unknown>): SemillaDemo | null {
  const { apiKey, clavePrivadaPem, sistema, empresas, usuarios } = datos;
  if (!esTexto(apiKey) || !esTexto(clavePrivadaPem)) return null;
  if (!esRegistro(sistema) || !esTexto(sistema.id) || !esTexto(sistema.codigo)) return null;
  if (!Array.isArray(usuarios) || !usuarios.every(esUsuarioDeDemo)) return null;
  return {
    apiKey,
    clavePrivadaPem,
    sistema: { id: sistema.id, codigo: sistema.codigo },
    empresas: Array.isArray(empresas) ? empresas.filter(esEmpresa) : [],
    usuarios,
  };
}

function leerPlataforma(datos: Record<string, unknown>): OperadorDev | null {
  const { plataforma } = datos;
  if (!esRegistro(plataforma)) return null;
  const { clavePlataforma, sistema, clavePrivadaPem, persona } = plataforma;
  if (!esTexto(clavePlataforma) || !esTexto(sistema) || !esTexto(clavePrivadaPem) || !esPersona(persona)) return null;
  return { clavePlataforma, sistema, clavePrivadaPem, persona };
}

/** Interpreta el JSON del archivo; `null` si no trae ninguna de las dos partes completas. */
export function interpretarSemilla(datos: unknown): SemillaDev | null {
  if (!esRegistro(datos)) return null;
  const demo = leerDemo(datos);
  const plataforma = leerPlataforma(datos);
  return demo !== null || plataforma !== null ? { demo, plataforma } : null;
}

export async function cargarSemilla(): Promise<SemillaDev | null> {
  try {
    const respuesta = await fetch('/__dev/semilla.json');
    if (!respuesta.ok) return null;
    return interpretarSemilla(await respuesta.json());
  } catch {
    return null;
  }
}
