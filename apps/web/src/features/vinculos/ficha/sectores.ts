import type { ExpedienteDto, RequisitoExpedienteDto } from '@validasoft/api-client';
import { Award, ClipboardCheck, Contact, CreditCard, FileSignature, FileStack, HardHat, History, Landmark, Receipt, Scale, ShieldCheck, Star, Wallet, type LucideIcon } from 'lucide-react';

/**
 * Sectores de la ficha del vínculo, con los nombres y el orden de la ficha del proveedor del SRM (MenuProveedor): lista plana, todos
 * visibles. Los de información reúnen lo que el expediente pide de ese tema y lo que el tercero declaró en su ficha. Certificado e
 * Historial son propios de Validasoft y van al final; «Aprobación inicial» y «Adjuntos constructora» del SRM no tienen equivalente.
 */
export const SECTORES = [
  'general',
  'sst',
  'cuenta',
  'tributaria',
  'financiera',
  'contactos',
  'documentos',
  'autorizacion',
  'legal',
  'evaluaciones',
  'cumplimiento',
  'aprobaciones',
  'certificado',
  'historial',
] as const;

export type Sector = (typeof SECTORES)[number];

/** Sectores donde van los requisitos del expediente (y las secciones de la ficha). */
export type SectorDeRequisito = 'general' | 'sst' | 'cuenta' | 'tributaria' | 'financiera' | 'documentos' | 'autorizacion' | 'legal' | 'cumplimiento';

export const ICONO_SECTOR: Record<Sector, LucideIcon> = {
  general: Landmark,
  sst: HardHat,
  cuenta: CreditCard,
  tributaria: Receipt,
  financiera: Wallet,
  contactos: Contact,
  documentos: FileStack,
  autorizacion: FileSignature,
  legal: Scale,
  evaluaciones: Star,
  cumplimiento: ShieldCheck,
  aprobaciones: ClipboardCheck,
  certificado: Award,
  historial: History,
};

/** Sección de la ficha (código de la API) → sector. */
const SECTOR_DE_SECCION: Partial<Record<string, SectorDeRequisito>> = {
  FICHA_GENERAL: 'general',
  FICHA_ESPECIALIDADES: 'general',
  FICHA_SST: 'sst',
  CUENTAS_BANCARIAS: 'cuenta',
  FICHA_TRIBUTARIA: 'tributaria',
  FICHA_FINANCIERA: 'financiera',
  FICHA_LEGAL: 'legal',
};

/** Tipo canónico del documento → sector. Lo que no está aquí (un tipo propio de la empresa) va a «Documentos adjuntos requeridos». */
const SECTOR_DE_TIPO: Partial<Record<string, SectorDeRequisito>> = {
  DATOS_MAESTROS: 'general',
  FORMATO_VINCULACION: 'general',
  HOJA_DE_VIDA: 'general',
  TITULO_ACADEMICO: 'general',
  SG_SST: 'sst',
  AFILIACION_SEGURIDAD_SOCIAL: 'sst',
  PAZ_Y_SALVO: 'sst',
  CERTIFICACION_BANCARIA: 'cuenta',
  CUENTA_BANCARIA: 'cuenta',
  RUT: 'tributaria',
  CONSTANCIA_RNC: 'tributaria',
  DECLARACION_RENTA: 'tributaria',
  INFO_TRIBUTARIA: 'tributaria',
  ESTADOS_FINANCIEROS: 'financiera',
  AUTORIZACION_TRATAMIENTO_DATOS: 'autorizacion',
  TERMINOS_Y_CONDICIONES: 'autorizacion',
  CAMARA_COMERCIO: 'legal',
  CERTIFICADO_RUC: 'legal',
  REGISTRO_PUBLICO: 'legal',
  REGISTRO_MERCANTIL: 'legal',
  INFO_LEGAL: 'legal',
  POLIZA: 'legal',
  CEDULA: 'legal',
  PASAPORTE: 'legal',
  BENEFICIARIO_FINAL: 'cumplimiento',
  FORMULARIO_SARLAFT: 'cumplimiento',
  CERTIFICADO_ANTECEDENTES: 'cumplimiento',
};

export function sectorDeSeccion(seccion: string): SectorDeRequisito {
  return SECTOR_DE_SECCION[seccion] ?? (/PEP|SARLAFT/i.test(seccion) ? 'cumplimiento' : 'general');
}

/**
 * Dónde va un requisito: los documentos de las personas relacionadas (socios, representantes), en Información legal como en el SRM;
 * una sección de la ficha, en su sector; un documento, por su tipo canónico; un tipo propio, con la primera sección que respalda y, si no
 * respalda ninguna, en «Documentos adjuntos requeridos».
 */
export function sectorDeRequisito(r: RequisitoExpedienteDto): SectorDeRequisito {
  if (r.persona) return 'legal';
  if (r.seccion) return sectorDeSeccion(r.seccion.seccion);
  const canonico = r.tipoDocumento.tipoCanonico;
  const porTipo = canonico ? SECTOR_DE_TIPO[canonico] : undefined;
  if (porTipo) return porTipo;
  const respaldada = r.soporteDeSecciones?.secciones[0];
  return respaldada ? sectorDeSeccion(respaldada.seccion) : 'documentos';
}

const RESUELTOS = new Set(['Aprobado', 'Eximido', 'NoAplica']);
const CON_PROBLEMA = new Set(['Observado', 'Rechazado']);

export interface IndicadorSector {
  /** Requisitos del sector que aún no están resueltos. */
  pendientes: number;
  /** Alguno observado o rechazado: el indicador se pinta de advertencia. */
  conProblema: boolean;
}

/** Pendientes por sector de los requisitos del expediente; Aprobaciones suma todos. */
export function indicadoresPorSector(expediente: ExpedienteDto | null | undefined): Partial<Record<Sector, IndicadorSector>> {
  const indicadores: Partial<Record<Sector, IndicadorSector>> = {};
  const sumar = (sector: Sector, r: RequisitoExpedienteDto) => {
    const actual = indicadores[sector] ?? { pendientes: 0, conProblema: false };
    indicadores[sector] = {
      pendientes: actual.pendientes + (RESUELTOS.has(r.estado) ? 0 : 1),
      conProblema: actual.conProblema || CON_PROBLEMA.has(r.estado),
    };
  };
  for (const r of expediente?.requisitos ?? []) {
    sumar('aprobaciones', r);
    sumar(sectorDeRequisito(r), r);
  }
  return indicadores;
}

export function esSector(valor: string | null): valor is Sector {
  return valor !== null && (SECTORES as readonly string[]).includes(valor);
}
