import type { CampoCotejadoDto, DatosOficialesDto, FuenteOficialConfigDto, FuentesOficialesConfigDto, MonitoreoFuentesOficialesDto, VerificacionDto } from '@validalo/api-client';

/** Datos de prueba de las fuentes oficiales (FO-1…FO-8). */

export function campo(parcial: Partial<CampoCotejadoDto> = {}): CampoCotejadoDto {
  return {
    id: 'k1',
    campo: 'razon_social',
    etiqueta: 'Razón social',
    contra: 'Ficha',
    referencia: 'FICHA_GENERAL',
    oficial: 'ACEROS DEL NORTE SAS',
    comparado: 'Aceros del Norte S.A.S.',
    resultado: 'Coincide',
    critico: true,
    detalle: null,
    decision: null,
    justificacion: null,
    resueltaPor: null,
    resueltaEn: null,
    vigenteHasta: null,
    heredada: false,
    ...parcial,
  };
}

export function datosOficiales(parcial: Partial<DatosOficialesDto> = {}): DatosOficialesDto {
  return {
    encontrado: true,
    nit: '900123456',
    dv: '7',
    razonSocial: 'ACEROS DEL NORTE SAS',
    estado: 'ACTIVA',
    estadoNormalizado: 'Vigente',
    matricula: '1291197',
    camara: 'BOGOTA',
    tipoOrganizacion: 'SOCIEDAD ANONIMA',
    ultimoAnoRenovado: 2026,
    fechaMatricula: '2003-07-18',
    fechaRenovacion: '2026-03-30',
    fechaCancelacion: null,
    representantes: [{ nombre: 'ANA MARIA PEREZ', identificacion: '1020304050', cargo: 'Representante legal' }],
    direccion: null,
    municipio: null,
    actividadPrincipal: '2410',
    responsabilidades: [],
    actualizadoEnLaFuente: '2026-10-16',
    ...parcial,
  };
}

/** El RUES con una matrícula cancelada: una diferencia crítica del estado y lo demás conforme. */
export function rues(parcial: Partial<VerificacionDto> = {}): VerificacionDto {
  return {
    tipo: 'Rues',
    estado: 'CoincidenciaPorAnalizar',
    bloqueante: true,
    requeridaPorElFlujo: true,
    proveedor: 'DatosAbiertos',
    resultado: 'ConDiferencias',
    referenciaExterna: 'rues-1',
    registradaEn: '2026-11-10T14:00:00Z',
    registradaPor: 'sistema',
    vigenteHasta: '2026-12-10T14:00:00Z',
    evidencia: { nombreArchivo: 'constancia-rues.json', tipoContenido: 'application/json', tamano: 900, sha256: 'a'.repeat(64), delProveedor: false, sha256Respuesta: 'b'.repeat(64) },
    personas: [],
    coincidencias: [],
    estudio: null,
    anteriores: [],
    ultimoError: null,
    reintentarDesde: null,
    vigenciaDias: null,
    frecuenciaReconsultaMeses: null,
    fuenteOficial: {
      datos: datosOficiales({ estado: 'CANCELADA', estadoNormalizado: 'NoVigente' }),
      campos: [
        campo({ id: 'k1', campo: 'razon_social', etiqueta: 'Razón social' }),
        campo({
          id: 'k2',
          campo: 'estado_matricula',
          etiqueta: 'Estado de la matrícula mercantil',
          contra: 'Fuente',
          referencia: null,
          oficial: 'CANCELADA',
          comparado: 'Activa',
          resultado: 'Discrepa',
          detalle: 'La matrícula no está activa en el RUES.',
        }),
        campo({ id: 'k3', campo: 'ciiu_principal', etiqueta: 'Actividad económica principal (CIIU)', oficial: '2410', comparado: null, resultado: 'NoVerificable', critico: false, detalle: 'La ficha no lo tiene diligenciado.' }),
      ],
    },
    ...parcial,
  };
}

/** La DIAN conforme: sin diferencias. */
export function dian(parcial: Partial<VerificacionDto> = {}): VerificacionDto {
  return rues({
    tipo: 'Dian',
    estado: 'Satisfecha',
    resultado: 'Conforme',
    proveedor: 'Contrato',
    referenciaExterna: 'dian-1',
    fuenteOficial: { datos: datosOficiales({ estado: 'REGISTRO ACTIVO', matricula: null, camara: null, direccion: 'KR 10 20 30' }), campos: [campo({ id: 'd1', campo: 'estado_rut', etiqueta: 'Estado del RUT', contra: 'Fuente', referencia: null, oficial: 'REGISTRO ACTIVO', comparado: 'Activo' })] },
    ...parcial,
  });
}

export function monitoreoDeFuentes(parcial: Partial<MonitoreoFuentesOficialesDto> = {}): MonitoreoFuentesOficialesDto {
  return {
    vinculoId: 'v1',
    expedienteId: 'e1',
    folio: 'NORTE-E-2026-000001',
    frecuenciaDias: 30,
    proximaConsulta: '2026-12-12T14:00:00Z',
    fuentes: [rues({ bloqueante: false })],
    ...parcial,
  };
}

export function configDeFuentes(parcial: Partial<FuentesOficialesConfigDto> = {}): FuentesOficialesConfigDto {
  const proveedor = (nombre: string, extra: Partial<FuenteOficialConfigDto['proveedores'][number]> = {}): FuenteOficialConfigDto['proveedores'][number] => ({
    nombre,
    real: nombre !== 'Simulado',
    habilitadoEnInstalacion: nombre === 'Simulado',
    credencialesPropias: false,
    credencialesDeLaPlataforma: false,
    usuario: null,
    ultimosCuatroClave: null,
    urlBase: null,
    notas: null,
    disponible: nombre === 'Simulado',
    ...extra,
  });
  return {
    fuentes: [
      {
        fuente: 'Rues',
        nombre: 'RUES',
        descripcion: 'Registro mercantil: razón social, estado y renovación de la matrícula y representante legal.',
        proveedor: null,
        proveedorEfectivo: 'Simulado',
        proveedores: [proveedor('DatosAbiertos'), proveedor('Contrato'), proveedor('Simulado')],
      },
      {
        fuente: 'Dian',
        nombre: 'DIAN',
        descripcion: 'Estado del RUT: razón social, estado, responsabilidades y dirección.',
        proveedor: null,
        proveedorEfectivo: 'Simulado',
        proveedores: [proveedor('Contrato'), proveedor('Simulado')],
      },
    ],
    diasMonitoreo: 0,
    vigenciaDias: 30,
    ...parcial,
  };
}
