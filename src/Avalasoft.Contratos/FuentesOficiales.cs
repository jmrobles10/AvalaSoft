namespace Avalasoft.Contratos;

// DTOs de las fuentes oficiales, RUES y DIAN (FO-1…FO-8, docs/05 §4). Enums como texto. Las fuentes son dos tipos de verificación
// (<c>Rues</c>, <c>Dian</c>) que el flujo pide por tipo de vínculo (VerificacionRequeridaDto) y que viajan en VerificacionDto.FuenteOficial.

/// <summary>Representante legal tal como lo reporta la fuente.</summary>
public sealed record RepresentanteOficialDto(string? Nombre, string? Identificacion, string? Cargo);

/// <summary>
/// Lo que dice la fuente del tercero, normalizado: lo que cada fuente no da va nulo. <see cref="EstadoNormalizado"/>:
/// <c>Desconocido|Vigente|NoVigente</c>. <see cref="ActualizadoEnLaFuente"/>: cuándo actualizó la fuente su dato (los datos abiertos del RUES, cada mes).
/// </summary>
public sealed record DatosOficialesDto(
    bool Encontrado, string? Nit, string? Dv, string? RazonSocial, string? Estado, string EstadoNormalizado, string? Matricula, string? Camara, string? TipoOrganizacion,
    int? UltimoAnoRenovado, DateOnly? FechaMatricula, DateOnly? FechaRenovacion, DateOnly? FechaCancelacion, IReadOnlyList<RepresentanteOficialDto> Representantes,
    string? Direccion, string? Municipio, string? ActividadPrincipal, IReadOnlyList<string> Responsabilidades, DateOnly? ActualizadoEnLaFuente);

/// <summary>
/// Un campo cotejado: lo que dice la fuente (<see cref="Oficial"/>) frente a la ficha maestra, un documento o la propia fuente
/// (<see cref="Contra"/>: <c>Fuente|Ficha|Documento</c>; <see cref="Referencia"/>: «FICHA_GENERAL», «CAMARA_COMERCIO v2»…). <see cref="Resultado"/>:
/// <c>Coincide|Discrepa|NoVerificable</c>; solo lo que discrepa (una diferencia) se decide: <see cref="Decision"/> <c>Descartada|Confirmada</c> o nula
/// (por revisar). <see cref="Heredada"/>: la decisión viene de una consulta anterior y sigue vigente hasta <see cref="VigenteHasta"/>.
/// </summary>
public sealed record CampoCotejadoDto(
    Guid Id, string Campo, string Etiqueta, string Contra, string? Referencia, string? Oficial, string? Comparado, string Resultado, bool Critico, string? Detalle,
    string? Decision, string? Justificacion, string? ResueltaPor, DateTimeOffset? ResueltaEn, DateTimeOffset? VigenteHasta, bool Heredada);

/// <summary>Lo último que dijo la fuente y su cotejo (en <see cref="VerificacionDto.FuenteOficial"/>).</summary>
public sealed record FuenteOficialDto(DatosOficialesDto Datos, IReadOnlyList<CampoCotejadoDto> Campos);

// ---------- Configuración por empresa (FO-5, FO-7) ----------

/// <summary>
/// Un proveedor de una fuente tal como lo ve el administrador de la empresa: si es real, si la instalación lo habilitó, si hay credenciales de la
/// empresa o de la plataforma (la clave nunca vuelve: solo los últimos 4) y si se puede usar hoy (<see cref="Disponible"/>).
/// </summary>
public sealed record ProveedorDeFuenteDto(
    string Nombre, bool Real, bool HabilitadoEnInstalacion, bool CredencialesPropias, bool CredencialesDeLaPlataforma, string? Usuario, string? UltimosCuatroClave,
    string? UrlBase, string? Notas, bool Disponible);

/// <summary>
/// Una fuente en la configuración de la empresa: el proveedor elegido (nulo = el de la plataforma o la instalación), el que se usará
/// (<see cref="ProveedorEfectivo"/>, nulo si no hay ninguno disponible) y los proveedores posibles.
/// </summary>
public sealed record FuenteOficialConfigDto(string Fuente, string Nombre, string Descripcion, string? Proveedor, string? ProveedorEfectivo,
    IReadOnlyList<ProveedorDeFuenteDto> Proveedores);

/// <summary>Fuentes oficiales de la empresa: cada fuente, cada cuántos días se reconsultan los vínculos activos (0 = apagado) y la vigencia por omisión de una consulta.</summary>
public sealed record FuentesOficialesConfigDto(IReadOnlyList<FuenteOficialConfigDto> Fuentes, int DiasMonitoreo, int VigenciaDias);

/// <summary>Elige el proveedor de una fuente (<see cref="Proveedor"/> nulo o vacío = el predeterminado).</summary>
public sealed record EleccionDeProveedorDto(string Fuente, string? Proveedor);

/// <summary>Credenciales de un proveedor real. <see cref="Clave"/>: nula conserva la actual, vacía quita las credenciales (la clave solo se escribe, nunca vuelve).</summary>
public sealed record CredencialesFuenteDto(string Fuente, string Proveedor, string? Usuario = null, string? Clave = null, string? UrlBase = null, string? Notas = null);

/// <summary>Cambia el proveedor de una o más fuentes, las credenciales propias de uno real y/o cada cuántos días se reconsultan los vínculos activos (0 la apaga).</summary>
public sealed record ActualizarFuentesOficialesDto(IReadOnlyList<EleccionDeProveedorDto>? Elecciones = null, CredencialesFuenteDto? Credenciales = null, int? DiasMonitoreo = null);

// ---------- Cuenta de la plataforma (FO-5) ----------

/// <summary>Un proveedor real en la consola de Plataforma: si la instalación lo habilitó, si la cuenta de la plataforma está configurada y sus datos sin la clave.</summary>
public sealed record ProveedorDePlataformaFuenteDto(
    string Nombre, bool HabilitadoEnInstalacion, bool Configurado, string? Usuario, string? UltimosCuatroClave, string? UrlBase, string? Notas, DateTimeOffset? ActualizadasEn);

/// <summary>Una fuente en la consola de Plataforma: el proveedor predeterminado cuando la empresa no escoge y las cuentas de los proveedores reales.</summary>
public sealed record FuentePlataformaDto(string Fuente, string Nombre, string Descripcion, string? Predeterminado, IReadOnlyList<ProveedorDePlataformaFuenteDto> Proveedores);

public sealed record FuentesDePlataformaDto(IReadOnlyList<FuentePlataformaDto> Fuentes, DateTimeOffset? ActualizadaEn, string? ActualizadaPor);

/// <summary>Crea, cambia o quita (<c>Clave</c> vacía) la cuenta de un proveedor de la plataforma y/o fija el proveedor predeterminado de una fuente.</summary>
public sealed record ActualizarFuentesDePlataformaDto(CredencialesFuenteDto? Credenciales = null, IReadOnlyList<EleccionDeProveedorDto>? Predeterminados = null);

// ---------- Monitoreo de vínculos activos (FO-7) ----------

/// <summary>Reconsulta periódica de las fuentes oficiales de un vínculo activo: la última consulta de cada fuente y la próxima.</summary>
public sealed record MonitoreoFuentesOficialesDto(
    Guid VinculoId, Guid ExpedienteId, string Folio, int FrecuenciaDias, DateTimeOffset? ProximaConsulta, IReadOnlyList<VerificacionDto> Fuentes);
