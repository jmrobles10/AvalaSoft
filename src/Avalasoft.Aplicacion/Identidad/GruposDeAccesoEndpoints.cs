using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Auditoria;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Identidad;
using Wolverine.Http;

namespace Avalasoft.Aplicacion.Identidad;

/// <summary>
/// Grupos de acceso del grupo empresarial (GA-1…GA-9, docs/07 §3.3): conjuntos de permisos tomados del catálogo de scopes que el backend aplica, acotables por sector de la
/// ficha, que se asignan a las personas (varias por persona; lo que pueden es la unión de sus grupos). Se crean, se editan y se desactivan; no se borran. Los cuatro roles fijos
/// son grupos predefinidos que se listan aquí pero no se tocan. Como roles y llaves, son administración del tenant: <c>usuarios:administrar</c> con un rol de todo el tenant.
/// </summary>
public static class GruposDeAccesoEndpoints
{
    private static readonly IReadOnlySet<string> Catalogo = Permisos.DeGrupo.ToHashSet(StringComparer.Ordinal);

    [WolverineGet("/api/v1/grupos-de-acceso")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<IReadOnlyList<GrupoDeAccesoDto>> Listar(ISesiones sesiones, CancellationToken ct)
    {
        await using var sesion = sesiones.DelTenant();
        var usuarios = await sesion.Query<Usuario>().ToListAsync(ct);
        var propios = await sesion.Query<GrupoDePermisos>().OrderBy(g => g.Nombre).ToListAsync(ct);
        return [.. GruposPredefinidos.Roles.Select(r => Predefinido(r, usuarios)), .. propios.Select(g => g.ADto(Miembros(usuarios, g.Id)))];
    }

    [WolverineGet("/api/v1/grupos-de-acceso/{id}")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<GrupoDeAccesoDto> Obtener(Guid id, ISesiones sesiones, CancellationToken ct)
    {
        await using var sesion = sesiones.DelTenant();
        var usuarios = await sesion.Query<Usuario>().ToListAsync(ct);
        if (GruposPredefinidos.RolDe(id) is { } rol)
            return Predefinido(rol, usuarios);
        return (await CargarAsync(sesion, id, ct)).ADto(Miembros(usuarios, id));
    }

    [WolverinePost("/api/v1/grupos-de-acceso")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<IResult> Crear(CrearGrupoDeAccesoDto dto, ISesiones sesiones, IContextoSolicitud contexto, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var grupo = GrupoDePermisos.Crear(dto.Codigo, dto.Nombre, dto.Descripcion, dto.Permisos ?? [], Sectores(dto.Sectores), Catalogo, ahora);

        await using var sesion = sesiones.DelTenant();
        var codigo = grupo.Codigo;
        if (await sesion.Query<GrupoDePermisos>().AnyAsync(g => g.Codigo == codigo, ct))
            throw ReglaDeNegocioException.Conflicto("grupo-duplicado", $"Ya existe el grupo {codigo}.");

        sesion.Store(grupo);
        Auditoria.Registrar(sesion, contexto, "GrupoDeAcceso", grupo.Id.ToString(), AccionConfiguracion.Creado, null, grupo.ADto(0), ahora);
        await sesion.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/grupos-de-acceso/{grupo.Id}", grupo.ADto(0));
    }

    /// <summary>
    /// Reemplaza nombre, descripción, permisos y sectores. Cambia lo que pueden ya quienes lo tienen, desde su siguiente token (como un cambio de roles), así que a quien entró directo
    /// se le pide confirmar con su passkey. 409 <c>grupo-predefinido</c> con uno de los cuatro roles fijos.
    /// </summary>
    [WolverinePut("/api/v1/grupos-de-acceso/{id}")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<GrupoDeAccesoDto> Actualizar(Guid id, ActualizarGrupoDeAccesoDto dto, HttpContext http, ISesiones sesiones, IContextoSolicitud contexto,
        ServicioDeIngreso servicio, TimeProvider reloj, CancellationToken ct)
    {
        AsegurarNoPredefinido(id);
        await servicio.ExigirReautenticacionAsync(http.User, "editar-grupo-de-acceso", ct);
        await using var sesion = sesiones.DelTenant();
        var grupo = await CargarAsync(sesion, id, ct);
        var antes = grupo.ADto(0);

        var ahora = reloj.GetUtcNow();
        grupo.Actualizar(dto.Nombre, dto.Descripcion, dto.Permisos ?? [], Sectores(dto.Sectores), Catalogo, ahora);
        sesion.Store(grupo);
        Auditoria.Registrar(sesion, contexto, "GrupoDeAcceso", grupo.Id.ToString(), AccionConfiguracion.Modificado, antes, grupo.ADto(0), ahora);
        await sesion.SaveChangesAsync(ct);
        return grupo.ADto(Miembros(await sesion.Query<Usuario>().ToListAsync(ct), id));
    }

    /// <summary>Desactiva el grupo: deja de dar permisos a quien lo tiene (desde su siguiente token) y no se asigna a nadie nuevo. Las asignaciones se conservan por si se reactiva.</summary>
    [WolverinePost("/api/v1/grupos-de-acceso/{id}/desactivar")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<GrupoDeAccesoDto> Desactivar(Guid id, HttpContext http, ISesiones sesiones, IContextoSolicitud contexto, ServicioDeIngreso servicio,
        TimeProvider reloj, CancellationToken ct)
    {
        AsegurarNoPredefinido(id);
        await servicio.ExigirReautenticacionAsync(http.User, "desactivar-grupo-de-acceso", ct);
        return await CambiarEstadoAsync(id, sesiones, contexto, reloj, AccionConfiguracion.Desactivado, (g, ahora) => g.Desactivar(ahora), ct);
    }

    [WolverinePost("/api/v1/grupos-de-acceso/{id}/reactivar")]
    [Authorize(Policy = Permisos.UsuariosAdministrar)]
    public static async Task<GrupoDeAccesoDto> Reactivar(Guid id, HttpContext http, ISesiones sesiones, IContextoSolicitud contexto, ServicioDeIngreso servicio,
        TimeProvider reloj, CancellationToken ct)
    {
        AsegurarNoPredefinido(id);
        await servicio.ExigirReautenticacionAsync(http.User, "reactivar-grupo-de-acceso", ct);
        return await CambiarEstadoAsync(id, sesiones, contexto, reloj, AccionConfiguracion.Reactivado, (g, ahora) => g.Reactivar(ahora), ct);
    }

    private static async Task<GrupoDeAccesoDto> CambiarEstadoAsync(Guid id, ISesiones sesiones, IContextoSolicitud contexto, TimeProvider reloj, AccionConfiguracion accion,
        Action<GrupoDePermisos, DateTimeOffset> cambiar, CancellationToken ct)
    {
        await using var sesion = sesiones.DelTenant();
        var grupo = await CargarAsync(sesion, id, ct);
        var antes = grupo.ADto(0);
        var ahora = reloj.GetUtcNow();
        cambiar(grupo, ahora);
        sesion.Store(grupo);
        Auditoria.Registrar(sesion, contexto, "GrupoDeAcceso", grupo.Id.ToString(), accion, antes, grupo.ADto(0), ahora);
        await sesion.SaveChangesAsync(ct);
        return grupo.ADto(Miembros(await sesion.Query<Usuario>().ToListAsync(ct), id));
    }

    private static void AsegurarNoPredefinido(Guid id)
    {
        if (GruposPredefinidos.RolDe(id) is { } rol)
            throw ReglaDeNegocioException.Conflicto("grupo-predefinido",
                $"{GruposPredefinidos.NombreDe(rol)} es un grupo predefinido (uno de los cuatro roles fijos): no se edita ni se desactiva. Crea un grupo propio.");
    }

    private static async Task<GrupoDePermisos> CargarAsync(IDocumentSession sesion, Guid id, CancellationToken ct) =>
        await sesion.LoadAsync<GrupoDePermisos>(id, ct)
        ?? throw ReglaDeNegocioException.NoEncontrado("grupo-no-encontrado", "No existe ese grupo de acceso.");

    private static IReadOnlyList<SectorDeGrupo> Sectores(IReadOnlyList<SectorDeGrupoDto>? sectores) =>
        [.. (sectores ?? []).Select(s => new SectorDeGrupo(s.Sector, Enum.TryParse<NivelDeSector>(s.Nivel, true, out var nivel) ? nivel : (NivelDeSector)(-1)))];

    private static int Miembros(IEnumerable<Usuario> usuarios, Guid grupoId) => usuarios.Count(u => u.Grupos.Any(g => g.GrupoId == grupoId));

    /// <summary>Uno de los cuatro roles fijos como grupo: sus permisos son los de siempre, sin acotar, y sus miembros las personas que tienen el rol.</summary>
    public static GrupoDeAccesoDto Predefinido(Rol rol, IEnumerable<Usuario> usuarios) =>
        new(GruposPredefinidos.IdDe(rol), GruposPredefinidos.CodigoDe(rol), GruposPredefinidos.NombreDe(rol), null, true, true, rol.ToString(), [.. Permisos.DeRol(rol)], [],
            usuarios.Count(u => u.Roles.Any(r => r.Rol == rol)), null, null);

    public static GrupoDeAccesoDto ADto(this GrupoDePermisos g, int usuarios) =>
        new(g.Id, g.Codigo, g.Nombre, g.Descripcion, g.Activo, false, null, [.. g.Permisos], [.. g.Sectores.Select(s => new SectorDeGrupoDto(s.Sector, s.Nivel.ToString()))], usuarios,
            g.CreadoEn, g.ActualizadoEn);
}

/// <summary>
/// Cómo se reparte una asignación de acceso entre las dos formas de guardarla: los grupos predefinidos son los roles de siempre (<see cref="RolAsignado"/>) y los grupos propios
/// van aparte (<see cref="AsignacionDeGrupo"/>). Valida que los grupos existan y no estén desactivados (salvo los que la persona ya tenía asignados).
/// </summary>
public static class AsignacionDeAcceso
{
    public static async Task<(IReadOnlyList<RolAsignado> Roles, IReadOnlyList<AsignacionDeGrupo> Grupos)> RepartirAsync(IDocumentSession sesion,
        IEnumerable<AsignacionDeGrupoDto> asignaciones, Usuario? actual, CancellationToken ct)
    {
        var roles = new List<RolAsignado>();
        var grupos = new List<AsignacionDeGrupo>();
        var yaTenia = actual?.Grupos.Select(g => g.GrupoId).ToHashSet() ?? [];
        foreach (var asignacion in asignaciones.Distinct())
        {
            if (GruposPredefinidos.RolDe(asignacion.GrupoId) is { } rol)
            {
                roles.Add(new RolAsignado(rol, asignacion.EmpresaId));
                continue;
            }

            var grupo = await sesion.LoadAsync<GrupoDePermisos>(asignacion.GrupoId, ct)
                        ?? throw ReglaDeNegocioException.Validacion("grupo-invalido", $"El grupo {asignacion.GrupoId} no existe en el tenant.");
            if (!grupo.Activo && !yaTenia.Contains(grupo.Id))
                throw ReglaDeNegocioException.Conflicto("grupo-inactivo", $"El grupo {grupo.Nombre} está desactivado: reactívalo para asignarlo.");
            grupos.Add(new AsignacionDeGrupo(grupo.Id, asignacion.EmpresaId));
        }

        return (roles, grupos);
    }
}
