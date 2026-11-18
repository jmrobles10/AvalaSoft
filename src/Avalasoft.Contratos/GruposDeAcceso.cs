namespace Avalasoft.Contratos;

// Grupos de acceso de la empresa (docs/07 §3.3): conjuntos de permisos, acotables por sector de la ficha, que se asignan a las personas.

/// <summary>
/// Un sector de la ficha (código de sección: <c>FICHA_GENERAL</c>, <c>FICHA_TRIBUTARIA</c>, <c>FICHA_LEGAL</c>, <c>FICHA_FINANCIERA</c>, <c>FICHA_SST</c> o <c>FICHA_ESPECIALIDADES</c>)
/// y lo que el grupo puede hacer con él: <see cref="Nivel"/> <c>Ver</c> o <c>Editar</c> (actuar: veredicto, observación o exención sobre esa sección; incluye ver).
/// </summary>
public sealed record SectorDeGrupoDto(string Sector, string Nivel);

/// <summary>
/// Grupo de acceso. Los cuatro roles fijos aparecen como grupos <see cref="Predefinido"/>s (su <see cref="Rol"/> es el nombre del rol): no se editan, no se desactivan y no se
/// borran, y se asignan igual que antes. <see cref="Permisos"/> son scopes del catálogo; <see cref="Sectores"/> vacío = todos los sectores de la ficha, con sectores los permisos que
/// miran la ficha (<c>terceros:leer</c>, <c>expedientes:leer</c>, <c>expedientes:revisar</c>, <c>expedientes:administrar</c>) solo valen para ellos.
/// <see cref="Usuarios"/> es cuántas personas lo tienen asignado.
/// </summary>
public sealed record GrupoDeAccesoDto(
    Guid Id, string Codigo, string Nombre, string? Descripcion, bool Activo, bool Predefinido, string? Rol, IReadOnlyList<string> Permisos,
    IReadOnlyList<SectorDeGrupoDto> Sectores, int Usuarios, DateTimeOffset? CreadoEn, DateTimeOffset? ActualizadoEn);

/// <summary>
/// Crea un grupo propio: <see cref="Codigo"/> en mayúsculas (único en el grupo empresarial; no puede ser el de un grupo predefinido), al menos un permiso del catálogo (422
/// <c>permisos-invalidos</c> si alguno no puede llevarlo un grupo) y sectores opcionales (422 <c>sector-invalido</c>, <c>sector-duplicado</c>, <c>nivel-invalido</c>).
/// </summary>
public sealed record CrearGrupoDeAccesoDto(string Codigo, string Nombre, string? Descripcion, IReadOnlyList<string> Permisos, IReadOnlyList<SectorDeGrupoDto>? Sectores = null);

/// <summary>Reemplaza el nombre, la descripción, los permisos y los sectores de un grupo propio (409 <c>grupo-predefinido</c> con uno de los cuatro roles fijos).</summary>
public sealed record ActualizarGrupoDeAccesoDto(string Nombre, string? Descripcion, IReadOnlyList<string> Permisos, IReadOnlyList<SectorDeGrupoDto>? Sectores = null);

/// <summary><see cref="EmpresaId"/> nulo = el grupo vale en todo el grupo empresarial.</summary>
public sealed record AsignacionDeGrupoDto(Guid GrupoId, Guid? EmpresaId);

/// <summary>
/// Reemplaza **todos** los grupos de la persona (los predefinidos y los propios): los predefinidos se guardan como sus roles de siempre y los propios como grupos de acceso, de forma que
/// <c>PUT /usuarios/{id}/roles</c> sigue funcionando igual. Lo que puede la persona es la unión de lo que dan; un grupo desactivado no da nada.
/// </summary>
public sealed record AsignarGruposDto(IReadOnlyList<AsignacionDeGrupoDto> Grupos);
