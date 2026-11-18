using System.Text.RegularExpressions;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Ficha;

namespace Avalasoft.Dominio.Identidad;

/// <summary>Lo que un grupo puede hacer con un sector de la ficha (una sección): verlo, o verlo y actuar sobre él (veredicto, observación, exención).</summary>
public enum NivelDeSector
{
    Ver,
    Editar
}

/// <summary>Un sector de la ficha (código de sección, <c>FICHA_*</c>) con el nivel que el grupo tiene sobre él.</summary>
public sealed record SectorDeGrupo(string Sector, NivelDeSector Nivel);

/// <summary>
/// Un grupo asignado a una persona, para todo el tenant (<see cref="EmpresaId"/> nulo) o solo en una empresa. Los grupos predefinidos (los cuatro roles fijos) no
/// viven aquí: se asignan como <see cref="RolAsignado"/> y por eso no se rompe a nadie que ya los tenga.
/// </summary>
public sealed record AsignacionDeGrupo(Guid GrupoId, Guid? EmpresaId);

/// <summary>
/// Conjunto de sectores de la ficha al que alcanza un permiso. <see cref="Todos"/> = sin acotar (todas las secciones). Con una lista, solo esas. La unión de dos
/// alcances es el alcance de quien tiene los dos grupos.
/// </summary>
public sealed record AlcanceDeSectores(bool Todos, IReadOnlySet<string> Sectores)
{
    /// <summary>Sin acotar: todas las secciones de la ficha.</summary>
    public static readonly AlcanceDeSectores Todo = new(true, new HashSet<string>());

    /// <summary>Solo los sectores indicados (una lista vacía = ninguno).</summary>
    public static AlcanceDeSectores De(IEnumerable<string> sectores) => new(false, sectores.ToHashSet(StringComparer.Ordinal));

    public bool Permite(string? sector) => Todos || (sector is not null && Sectores.Contains(sector));

    public AlcanceDeSectores Union(AlcanceDeSectores otro) => Todos || otro.Todos ? Todo : De(Sectores.Union(otro.Sectores));

    public bool Igual(AlcanceDeSectores otro) => Todos == otro.Todos && (Todos || Sectores.SetEquals(otro.Sectores));

    /// <summary>Texto estable (para el token): <c>*</c> = todos; si no, los códigos separados por coma y ordenados (vacío = ninguno).</summary>
    public string Codificar() => Todos ? "*" : string.Join(',', Sectores.Order(StringComparer.Ordinal));

    public static AlcanceDeSectores Decodificar(string texto) =>
        texto == "*" ? Todo : De(texto.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}

/// <summary>Los cuatro roles fijos como grupos predefinidos: no se editan, no se desactivan y no se borran. Su identificador es el mismo en todos los grupos empresariales.</summary>
public static class GruposPredefinidos
{
    public static readonly IReadOnlyList<Rol> Roles = [Rol.Administrador, Rol.Revisor, Rol.OficialCumplimiento, Rol.Auditor];

    public static Guid IdDe(Rol rol) => rol switch
    {
        Rol.Administrador => Guid.Parse("0f3c6a10-0000-7000-8000-000000000001"),
        Rol.Revisor => Guid.Parse("0f3c6a10-0000-7000-8000-000000000002"),
        Rol.OficialCumplimiento => Guid.Parse("0f3c6a10-0000-7000-8000-000000000003"),
        Rol.Auditor => Guid.Parse("0f3c6a10-0000-7000-8000-000000000004"),
        _ => throw new ArgumentOutOfRangeException(nameof(rol), rol, "Rol sin grupo predefinido.")
    };

    /// <summary>El rol de un grupo predefinido; nulo si el id no es de uno (es un grupo propio del tenant).</summary>
    public static Rol? RolDe(Guid grupoId) => Roles.Cast<Rol?>().FirstOrDefault(r => IdDe(r!.Value) == grupoId);

    public static string CodigoDe(Rol rol) => rol switch
    {
        Rol.Administrador => "ADMINISTRADOR",
        Rol.Revisor => "REVISOR",
        Rol.OficialCumplimiento => "OFICIAL_CUMPLIMIENTO",
        Rol.Auditor => "AUDITOR",
        _ => throw new ArgumentOutOfRangeException(nameof(rol), rol, "Rol sin grupo predefinido.")
    };

    public static string NombreDe(Rol rol) => rol switch
    {
        Rol.Administrador => "Administrador",
        Rol.Revisor => "Revisor",
        Rol.OficialCumplimiento => "Oficial de cumplimiento",
        Rol.Auditor => "Auditor",
        _ => throw new ArgumentOutOfRangeException(nameof(rol), rol, "Rol sin grupo predefinido.")
    };

    public static bool EsCodigoReservado(string codigo) => Roles.Any(r => CodigoDe(r) == codigo);
}

/// <summary>
/// Grupo de acceso de un grupo empresarial (tenant): un conjunto de permisos tomado del catálogo de scopes que el backend aplica, acotable por sector de la ficha, que
/// se asigna a las personas (varios por persona; lo que pueden es la <b>unión</b> de sus grupos). Esquema <c>identidad</c>, multi-tenant. Se crean, se editan y se desactivan;
/// no se borran. Los cuatro roles fijos son grupos predefinidos que no viven aquí (<see cref="GruposPredefinidos"/>).
/// </summary>
public sealed class GrupoDePermisos
{
    private static readonly Regex FormaDelCodigo = new("^[A-Z][A-Z0-9_]{1,39}$", RegexOptions.Compiled);

    public Guid Id { get; set; }

    /// <summary>Mayúsculas, único en el tenant e inmutable; no puede ser el de un grupo predefinido.</summary>
    public string Codigo { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public string? Descripcion { get; set; }

    /// <summary>Desactivado, el grupo deja de dar permisos a quien lo tiene (en su siguiente sesión) y no se asigna a nadie nuevo.</summary>
    public bool Activo { get; set; } = true;

    /// <summary>Scopes del catálogo (<c>Permisos.DeGrupo</c>); el backend los aplica por el mismo camino de autorización de siempre.</summary>
    public List<string> Permisos { get; set; } = [];

    /// <summary>
    /// Sectores de la ficha a los que se acota el grupo. Vacío = todos (sin acotar). Con sectores, los permisos que miran la ficha (<c>terceros:leer</c>,
    /// <c>expedientes:leer</c>, <c>expedientes:revisar</c>, <c>expedientes:administrar</c>) solo valen para ellos: ver con <see cref="NivelDeSector.Ver"/> o
    /// <see cref="NivelDeSector.Editar"/>; actuar solo con <see cref="NivelDeSector.Editar"/>.
    /// </summary>
    public List<SectorDeGrupo> Sectores { get; set; } = [];

    public DateTimeOffset CreadoEn { get; set; }

    public DateTimeOffset? ActualizadoEn { get; set; }

    public static GrupoDePermisos Crear(string codigo, string nombre, string? descripcion, IEnumerable<string> permisos, IEnumerable<SectorDeGrupo>? sectores,
        IReadOnlySet<string> permisosDelCatalogo, DateTimeOffset ahora)
    {
        var codigoNormalizado = (codigo ?? string.Empty).Trim().ToUpperInvariant();
        if (!FormaDelCodigo.IsMatch(codigoNormalizado))
            throw ReglaDeNegocioException.Validacion("codigo-invalido",
                "El código del grupo debe empezar con letra y usar solo mayúsculas, números y guion bajo (máx. 40).");
        if (GruposPredefinidos.EsCodigoReservado(codigoNormalizado))
            throw ReglaDeNegocioException.Conflicto("codigo-reservado", $"{codigoNormalizado} es el de un grupo predefinido: elige otro código.");

        var grupo = new GrupoDePermisos { Id = Guid.CreateVersion7(), Codigo = codigoNormalizado, CreadoEn = ahora };
        grupo.Definir(nombre, descripcion, permisos, sectores, permisosDelCatalogo);
        return grupo;
    }

    public void Actualizar(string nombre, string? descripcion, IEnumerable<string> permisos, IEnumerable<SectorDeGrupo>? sectores,
        IReadOnlySet<string> permisosDelCatalogo, DateTimeOffset ahora)
    {
        Definir(nombre, descripcion, permisos, sectores, permisosDelCatalogo);
        ActualizadoEn = ahora;
    }

    public void Desactivar(DateTimeOffset ahora)
    {
        if (!Activo)
            throw ReglaDeNegocioException.Conflicto("grupo-inactivo", "El grupo ya está desactivado.");
        Activo = false;
        ActualizadoEn = ahora;
    }

    public void Reactivar(DateTimeOffset ahora)
    {
        if (Activo)
            throw ReglaDeNegocioException.Conflicto("grupo-activo", "El grupo ya está activo.");
        Activo = true;
        ActualizadoEn = ahora;
    }

    /// <summary>Qué sectores puede <b>ver</b> quien tiene este grupo: todos si no se acotó; si no, los de la lista (en cualquier nivel).</summary>
    public AlcanceDeSectores AlcanceParaVer() => Sectores.Count == 0 ? AlcanceDeSectores.Todo : AlcanceDeSectores.De(Sectores.Select(s => s.Sector));

    /// <summary>Sobre qué sectores puede <b>actuar</b>: todos si no se acotó; si no, solo los de nivel <see cref="NivelDeSector.Editar"/>.</summary>
    public AlcanceDeSectores AlcanceParaEditar() =>
        Sectores.Count == 0 ? AlcanceDeSectores.Todo : AlcanceDeSectores.De(Sectores.Where(s => s.Nivel == NivelDeSector.Editar).Select(s => s.Sector));

    private void Definir(string nombre, string? descripcion, IEnumerable<string> permisos, IEnumerable<SectorDeGrupo>? sectores, IReadOnlySet<string> permisosDelCatalogo)
    {
        if (string.IsNullOrWhiteSpace(nombre))
            throw ReglaDeNegocioException.Validacion("nombre-requerido", "El nombre del grupo es obligatorio.");
        if (nombre.Trim().Length > 80)
            throw ReglaDeNegocioException.Validacion("nombre-demasiado-largo", "El nombre del grupo admite hasta 80 caracteres.");
        if (descripcion is { Length: > 300 })
            throw ReglaDeNegocioException.Validacion("descripcion-demasiado-larga", "La descripción del grupo admite hasta 300 caracteres.");

        var scopes = (permisos ?? []).Select(p => (p ?? string.Empty).Trim()).Where(p => p.Length > 0).Distinct(StringComparer.Ordinal).ToList();
        if (scopes.Count == 0)
            throw ReglaDeNegocioException.Validacion("permisos-requeridos", "Elige al menos un permiso para el grupo.");
        var desconocidos = scopes.Where(s => !permisosDelCatalogo.Contains(s)).ToList();
        if (desconocidos.Count > 0)
            throw new ReglaDeNegocioException(TipoFalla.Validacion, "permisos-invalidos", $"Permisos que un grupo no puede tener: {string.Join(", ", desconocidos)}.")
            {
                Datos = new Dictionary<string, object?> { ["permisos"] = desconocidos }
            };

        var lista = new List<SectorDeGrupo>();
        foreach (var sector in sectores ?? [])
        {
            var definicion = CatalogoDeSecciones.Buscar(sector.Sector)
                             ?? throw ReglaDeNegocioException.Validacion("sector-invalido",
                                 $"El sector «{sector.Sector}» no existe. Sectores: {string.Join(", ", CatalogoDeSecciones.Todas.Select(s => s.Codigo))}.");
            if (!Enum.IsDefined(sector.Nivel))
                throw ReglaDeNegocioException.Validacion("nivel-invalido", "El nivel de un sector es Ver o Editar.");
            if (lista.Any(s => s.Sector == definicion.Codigo))
                throw ReglaDeNegocioException.Validacion("sector-duplicado", $"El sector {definicion.Codigo} está repetido.");
            lista.Add(new SectorDeGrupo(definicion.Codigo, sector.Nivel));
        }

        Nombre = nombre.Trim();
        Descripcion = string.IsNullOrWhiteSpace(descripcion) ? null : descripcion.Trim();
        Permisos = scopes;
        Sectores = lista;
    }
}
