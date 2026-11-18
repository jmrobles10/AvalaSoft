import type { InvitarTerceroDto, TipoIdentificacionDto } from '@validasoft/api-client';
import { numeroValido, PAIS_POR_DEFECTO, TIPO_POR_DEFECTO } from '../configuracion/empresas/modelo';

/**
 * Invitar a un tercero a mano (decisión IM): los mismos datos que una fila del lote, con la misma validación que `ValidacionDeLote` para avisar antes de enviar; la API decide
 * (422 con sus errores por campo, 409 si el vínculo ya existe y no se puede invitar).
 */

/** `ValidacionDeLote.LongitudMaximaTexto`. */
export const LONGITUD_MAXIMA_TEXTO = 200;

/** Lo que admite el campo «Tipo de persona»; vacío = que la API la deduzca del documento (Jurídica con NIT, Natural con los demás). */
export const TIPOS_DE_PERSONA = ['Natural', 'Juridica', 'Consorcio'] as const;
export type TipoDePersona = (typeof TIPOS_DE_PERSONA)[number];

export interface BorradorInvitacion {
  pais: string;
  tipoIdentificacion: string;
  numero: string;
  /** Solo para los tipos con dígito de verificación; vacío = la API lo calcula. */
  digito: string;
  tipoPersona: TipoDePersona | '';
  nombre: string;
  nombreComercial: string;
  correo: string;
  contacto: string;
  telefono: string;
  tipoVinculo: string;
  /** Código del flujo; vacío = el que corresponda según las reglas de la empresa. */
  flujo: string;
}

export type CampoInvitacion = keyof BorradorInvitacion;

/** Los códigos de error de un campo (`invitaciones.invitarTercero.errores.*`). */
export type ErrorInvitacion =
  | 'tipo-identificacion-requerido'
  | 'numero-requerido'
  | 'numero-invalido'
  | 'nombre-requerido'
  | 'correo-requerido'
  | 'correo-invalido'
  | 'tipo-vinculo-requerido'
  | 'texto-demasiado-largo';

export interface ErrorDeCampo {
  campo: CampoInvitacion;
  codigo: ErrorInvitacion;
}

export function borradorInvitacionNuevo(): BorradorInvitacion {
  return {
    pais: PAIS_POR_DEFECTO,
    tipoIdentificacion: TIPO_POR_DEFECTO,
    numero: '',
    digito: '',
    tipoPersona: '',
    nombre: '',
    nombreComercial: '',
    correo: '',
    contacto: '',
    telefono: '',
    tipoVinculo: '',
    flujo: '',
  };
}

/** Como `ValidacionDeLote`: algo, una arroba, algo, un punto y algo, sin espacios; hasta 254 caracteres. */
export function correoValido(correo: string): boolean {
  return correo.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo);
}

/** Los errores del borrador en el orden del formulario (el primero es el que se dice junto al botón). */
export function validarInvitacion(b: BorradorInvitacion, tipo: TipoIdentificacionDto | undefined): ErrorDeCampo[] {
  const errores: ErrorDeCampo[] = [];
  const largo = (campo: CampoInvitacion) => {
    if (b[campo].trim().length > LONGITUD_MAXIMA_TEXTO) errores.push({ campo, codigo: 'texto-demasiado-largo' });
  };

  if (!b.tipoIdentificacion) errores.push({ campo: 'tipoIdentificacion', codigo: 'tipo-identificacion-requerido' });
  if (!b.numero.trim()) errores.push({ campo: 'numero', codigo: 'numero-requerido' });
  else if (!numeroValido(b.numero, tipo)) errores.push({ campo: 'numero', codigo: 'numero-invalido' });
  if (!b.nombre.trim()) errores.push({ campo: 'nombre', codigo: 'nombre-requerido' });
  largo('nombre');
  largo('nombreComercial');
  const correo = b.correo.trim();
  if (!correo) errores.push({ campo: 'correo', codigo: 'correo-requerido' });
  else if (!correoValido(correo)) errores.push({ campo: 'correo', codigo: 'correo-invalido' });
  largo('contacto');
  largo('telefono');
  if (!b.tipoVinculo) errores.push({ campo: 'tipoVinculo', codigo: 'tipo-vinculo-requerido' });
  return errores;
}

const aNulo = (texto: string): string | null => texto.trim() || null;

/** El cuerpo de `POST /invitaciones`: lo vacío viaja como `null` (la API lo trata como ausente). */
export function cuerpoInvitacion(b: BorradorInvitacion, tipo: TipoIdentificacionDto | undefined): InvitarTerceroDto {
  return {
    pais: b.pais,
    tipoIdentificacion: b.tipoIdentificacion,
    numeroIdentificacion: b.numero.trim(),
    // El dígito solo viaja si el tipo lo tiene (el campo no se ve de otro modo).
    digitoVerificacion: tipo?.tieneDv ? aNulo(b.digito) : null,
    tipoPersona: b.tipoPersona || null,
    nombre: b.nombre.trim(),
    nombreComercial: aNulo(b.nombreComercial),
    correo: b.correo.trim(),
    tipoVinculo: b.tipoVinculo,
    flujo: aNulo(b.flujo),
    contacto: aNulo(b.contacto),
    telefono: aNulo(b.telefono),
  };
}

/** Los campos del formulario a los que apunta un error de la API (los nombres de `ErrorDeFilaDto.campo`). */
export const CAMPO_DE_LA_API: Readonly<Record<string, CampoInvitacion>> = {
  pais: 'pais',
  tipoIdentificacion: 'tipoIdentificacion',
  numeroIdentificacion: 'numero',
  digitoVerificacion: 'digito',
  tipoPersona: 'tipoPersona',
  nombre: 'nombre',
  nombreComercial: 'nombreComercial',
  correo: 'correo',
  contacto: 'contacto',
  telefono: 'telefono',
  tipoVinculo: 'tipoVinculo',
  flujo: 'flujo',
};

/** Los errores por campo de una respuesta 422 de la API, ya en los campos del formulario. */
export function erroresDeLaApi(errores: Readonly<Record<string, readonly string[]>>): Partial<Record<CampoInvitacion, string>> {
  const resultado: Partial<Record<CampoInvitacion, string>> = {};
  for (const [campo, mensajes] of Object.entries(errores)) {
    const propio = CAMPO_DE_LA_API[campo];
    const primero = mensajes[0];
    if (propio && primero) resultado[propio] = primero;
  }
  return resultado;
}
