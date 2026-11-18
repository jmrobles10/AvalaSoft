using System.Text.Json;

namespace Avalasoft.Contratos;

// ---------- Invitación masiva por lote (H8, LT-5…LT-10) ----------

/// <summary>Archivo de la plantilla (.xlsx o .csv) en base64; <see cref="Nombre"/> decide el formato por su extensión.</summary>
public sealed record ArchivoDeLoteDto(string Nombre, string ContenidoBase64);

/// <summary>
/// Una fila del lote: identificación (<see cref="Pais"/> por omisión <c>CO</c>), tipo de persona (si falta: <c>Juridica</c> con
/// NIT, si no <c>Natural</c>), razón social o nombres, correo, tipo de vínculo y, opcionales, flujo (código), nombre comercial,
/// contacto y teléfono. <see cref="Atributos"/> (opcional): los valores de los atributos del tipo de vínculo (<c>clave</c> → valor); el archivo del lote los trae en
/// las columnas «Atributo: clave» como texto, que se convierte al tipo del atributo al validar la fila.
/// </summary>
public sealed record FilaDeLoteEntradaDto(
    string? Pais = null,
    string? TipoIdentificacion = null,
    string? NumeroIdentificacion = null,
    string? DigitoVerificacion = null,
    string? TipoPersona = null,
    string? Nombre = null,
    string? NombreComercial = null,
    string? Correo = null,
    string? TipoVinculo = null,
    string? Flujo = null,
    string? Contacto = null,
    string? Telefono = null,
    Dictionary<string, JsonElement>? Atributos = null);

/// <summary><see cref="Campo"/>: columna de la plantilla (nulo si el error no es de un campo).</summary>
public sealed record ErrorDeFilaDto(string? Campo, string Codigo, string Mensaje);

/// <summary>
/// Fila validada antes de crear el lote. <see cref="Estado"/>: <c>Valida</c>, <c>Invalida</c> o <c>Duplicada</c> (de
/// <see cref="DuplicadaDe"/>). <see cref="AccionPrevista"/> (válidas): <c>Invitar</c> (vínculo nuevo), <c>Reinvitar</c> (existe y
/// aún no acepta) o <c>SinCambios</c> (el tercero ya aceptó).
/// </summary>
public sealed record FilaVistaPreviaDto(int N, FilaDeLoteEntradaDto Datos, string Estado, IReadOnlyList<ErrorDeFilaDto> Errores, int? DuplicadaDe,
    string? AccionPrevista);

public sealed record VistaPreviaLoteDto(string? Archivo, int Total, int Validas, int Invalidas, int Duplicadas, IReadOnlyList<FilaVistaPreviaDto> Filas);

/// <summary>
/// Crea el lote con un <see cref="Archivo"/> o con <see cref="Filas"/> (una de las dos; hasta <c>Avalasoft:Lotes:MaxFilas</c>,
/// 10 000 por omisión). Las filas inválidas o duplicadas quedan en el informe sin procesarse. <see cref="VigenciaHoras"/>: la del
/// enlace de cada invitación (1 hora a 30 días; 7 días por omisión).
/// </summary>
public sealed record CrearLoteDto(string? Nombre = null, ArchivoDeLoteDto? Archivo = null, IReadOnlyList<FilaDeLoteEntradaDto>? Filas = null,
    int VigenciaHoras = 168);

/// <summary>
/// Invitar a un tercero a mano (formulario de la app): los mismos datos que una fila del lote —identificación (<see cref="Pais"/> por omisión <c>CO</c>), tipo de
/// persona (si falta: <c>Juridica</c> con NIT, si no <c>Natural</c>), razón social o nombres, correo, tipo de vínculo y, opcionales, flujo (código), nombre comercial,
/// contacto y teléfono— y la vigencia del enlace (1 hora a 30 días; 7 días por omisión, como el lote). <see cref="Atributos"/> (opcional): los valores de los atributos
/// permitidos del tipo de vínculo (<c>clave</c> → valor: texto, número, fecha <c>AAAA-MM-DD</c>, sí/no, una opción o una lista de opciones); un atributo obligatorio del tipo
/// debe venir al crear el vínculo y, si el vínculo ya existía y se reinvita, solo se aplican los que vienen (no se borran los que ya tenía).
/// </summary>
public sealed record InvitarTerceroDto(
    string? Pais = null,
    string? TipoIdentificacion = null,
    string? NumeroIdentificacion = null,
    string? DigitoVerificacion = null,
    string? TipoPersona = null,
    string? Nombre = null,
    string? NombreComercial = null,
    string? Correo = null,
    string? TipoVinculo = null,
    string? Flujo = null,
    string? Contacto = null,
    string? Telefono = null,
    int VigenciaHoras = 168,
    Dictionary<string, JsonElement>? Atributos = null);

/// <summary>
/// Lo que hizo la invitación individual, igual que una fila del lote. <see cref="Accion"/>: <c>Invitado</c> (vínculo nuevo), <c>Reinvitado</c> (el vínculo ya existía
/// y aún no aceptaba: se reenvió al correo indicado) o <c>SinCambios</c> (el tercero ya aceptó: no se reenvía; <see cref="Detalle"/> lo dice).
/// <see cref="PorAprobar"/> (decisión AI): el tipo de vínculo exige aprobación antes de invitar y la invitación quedó retenida hasta que otra persona la decida; no ha
/// salido ningún correo. <see cref="TerceroCreado"/>: el tercero no existía en la plataforma y se registró con estos datos.
/// </summary>
public sealed record InvitacionDeTerceroDto(string Accion, Guid TerceroId, Guid VinculoId, bool TerceroCreado, bool PorAprobar, string? Detalle);

public sealed record TotalesLoteDto(int Filas, int Procesadas, int Pendientes, int Exitosas, int Fallidas, int Duplicadas, int Invalidas);

/// <summary>
/// <see cref="Estado"/>: <c>Procesando</c>, <c>Pausado</c>, <c>Completado</c>, <c>CompletadoConErrores</c>, <c>Cancelado</c> o <c>PorAprobar</c>.
/// <see cref="CreadoPor"/>: <c>{tipoDeActor}:{id}</c>.
/// Decisión AI: un lote con filas de un tipo de vínculo que exige aprobación para invitar nace <c>PorAprobar</c> (no se procesa ninguna fila) y lo decide otra persona
/// como lote completo: <c>POST /invitaciones/lotes/{id}/aprobar</c> lo procesa y <c>…/rechazar</c> lo deja <c>Cancelado</c> con su <see cref="MotivoDeRechazo"/>.
/// <see cref="TiposPorAprobar"/>: los tipos del lote que exigen aprobación (códigos). <see cref="PuedesDecidir"/> (solo en el detalle y la lista): quien consulta puede
/// aprobarlo o rechazarlo. <see cref="AprobadoPor"/>: <c>{tipoDeActor}:{id}</c>.
/// </summary>
public sealed record LoteDto(Guid Id, string Nombre, string? Archivo, string Estado, TotalesLoteDto Totales, int VigenciaHoras, string CreadoPor,
    DateTimeOffset CreadoEn, DateTimeOffset ActualizadoEn, DateTimeOffset? TerminadoEn, int Reintentos, long Version,
    IReadOnlyList<string>? TiposPorAprobar = null, string? AprobadoPor = null, DateTimeOffset? AprobadoEn = null, string? MotivoDeRechazo = null,
    bool? PuedesDecidir = null);

/// <summary>
/// Fila del lote. <see cref="Estado"/>: <c>Pendiente</c>, <c>Exitosa</c>, <c>Fallida</c>, <c>Duplicada</c>, <c>Invalida</c> o
/// <c>Cancelada</c> (pendiente de un lote cancelado). <see cref="Accion"/> (exitosas): <c>Invitado</c>, <c>Reinvitado</c> o
/// <c>SinCambios</c> (con <see cref="Detalle"/>).
/// </summary>
public sealed record FilaLoteDto(int N, string Identificacion, string? Nombre, string? Correo, string? TipoVinculo, string Estado, string? Accion,
    string? Detalle, IReadOnlyList<ErrorDeFilaDto> Errores, int? DuplicadaDe, Guid? TerceroId, Guid? VinculoId, bool TerceroCreado, int Intentos,
    DateTimeOffset? ProcesadaEn);

/// <summary>Datos de <c>invitaciones.lote_terminado</c> (docs/05 §7).</summary>
public sealed record DatosLoteTerminadoDto(Guid LoteId, string Nombre, string Estado, TotalesLoteDto Totales);
