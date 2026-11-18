namespace Avalasoft.Contratos;

// Personas relacionadas con bóveda propia (ADR-0010, decisión PR del registro).

/// <summary>
/// De quién es el documento que pide un requisito <c>DePersonaRelacionada</c>: el <see cref="Rol"/> que exige, si pide el de todas las relaciones vigentes del rol y, si ya hay
/// quien lo cumple, la persona (<see cref="PersonaId"/>, su <see cref="RelacionId"/>, nombre e identificación). <see cref="SinPersona"/>: nadie cumple el rol todavía; el
/// requisito espera a que el tercero declare a la persona (ficha legal o «Personas relacionadas»).
/// </summary>
public sealed record PersonaDelRequisitoDto(
    string Rol, bool TodasLasRelaciones, bool SinPersona, Guid? PersonaId = null, Guid? RelacionId = null, string? Nombre = null, string? Identificacion = null);

/// <summary>
/// Un documento de la bóveda de una persona relacionada como lo ve el tercero al que se relaciona: el estado del documento (<c>Actual</c>, <c>EnAnalisis</c>, <c>Devuelta</c>…)
/// y, si ya hay una versión, cuál y cuándo se cargó. <see cref="DocumentoId"/> y <see cref="Version"/> son nulos mientras nadie lo haya cargado; <see cref="Pedido"/>: alguna
/// empresa del tercero se lo pide hoy en un expediente abierto. No se descarga desde aquí:
/// el archivo es de la persona y solo lo reciben las empresas cuyo flujo lo pide.
/// </summary>
public sealed record DocumentoDePersonaDto(string TipoCanonico, string Nombre, Guid? DocumentoId, int? Version, string? Estado, DateTimeOffset? CargadaEn, bool Pedido = false);

/// <summary>
/// Persona natural relacionada con el tercero de la sesión (representante legal, suplente, socio, beneficiario final o miembro): <see cref="Tipo"/>
/// (<c>RepresentanteLegal|Suplente|Socio|BeneficiarioFinal|MiembroDe</c>), <see cref="Estado"/> (<c>Propuesta|Confirmada|Finalizada|Descartada</c>), <see cref="Fuente"/>
/// (<c>Declarada|ExtraidaIa|Importacion|Plataforma</c>) y <see cref="DeFicha"/> (la mantiene la información legal de la ficha). Una <c>Propuesta</c> es un cambio que detectó la IA
/// en la Cámara de comercio (<see cref="Confianza"/> de 0 a 1): no cambia nada hasta que el tercero la confirme (<see cref="Reemplaza"/> dice a quién sustituiría).
/// <see cref="Documentos"/> trae el estado de los documentos de la bóveda de la persona (cédula, antecedentes).
/// </summary>
public sealed record RelacionEntreTercerosDto(
    Guid Id, Guid PersonaId, IdentificacionDto Identificacion, string Nombre, string Tipo, bool Principal, decimal? Participacion, string? Cargo, DateOnly VigenteDesde,
    DateOnly? VigenteHasta, string Estado, string Fuente, bool DeFicha, decimal? Confianza, DateTimeOffset? ConfirmadaEn, IReadOnlyList<DocumentoDePersonaDto> Documentos,
    ReemplazaRelacionDto? Reemplaza = null);

/// <summary>La relación vigente que una propuesta sustituiría al confirmarse (el representante que saldría).</summary>
public sealed record ReemplazaRelacionDto(Guid RelacionId, string Nombre, IdentificacionDto Identificacion);

/// <summary>
/// El tercero declara una persona relacionada (<c>POST /public/v1/tercero/relaciones</c>): su identificación de persona natural, su nombre y cómo se relaciona. Crea el
/// tercero persona si no existía (por país, tipo y número) y la relación vigente. 422 <c>tipo-relacion-invalido</c>, <c>persona-no-natural</c>, <c>nombre-requerido</c>,
/// <c>participacion-invalida</c>; 409 <c>relacion-duplicada</c> si ya figura con ese tipo.
/// </summary>
public sealed record DeclararRelacionDto(
    IdentificacionDto Identificacion, string Nombre, string Tipo, bool Principal = false, decimal? Participacion = null, string? Cargo = null);

public sealed record TerminarRelacionDto(string? Motivo = null);

/// <summary>
/// Persona relacionada con el tercero de un vínculo, como la ve la empresa (<c>GET /api/v1/vinculos/{id}/personas-relacionadas</c>): solo las relaciones vigentes y, de cada
/// persona, los documentos de su bóveda que <b>se compartieron con este vínculo</b> (lo que el flujo le pide). Nada más de su bóveda.
/// </summary>
public sealed record PersonaDelVinculoDto(
    Guid RelacionId, Guid PersonaId, IdentificacionDto Identificacion, string Nombre, string Tipo, bool Principal, decimal? Participacion, string? Cargo,
    DateOnly VigenteDesde, IReadOnlyList<DocumentoVistaEmpresaDto> Documentos);
