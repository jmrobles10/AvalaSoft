using System.Text.Json;
using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validalo.Aplicacion.Comun;
using Validalo.Contratos;
using Validalo.Dominio.Auditoria;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Evaluaciones;
using Validalo.Dominio.Flujos;
using Validalo.Dominio.Terceros;
using Wolverine.Http;

namespace Validalo.Aplicacion.Evaluaciones;

/// <summary>
/// Cuestionarios de evaluación del proveedor de la empresa activa (<c>X-Empresa</c>, CE-1): versionados como los flujos (el borrador se edita, publicar congela la versión), con
/// secciones, preguntas de siete tipos, pesos, puntajes, eliminatorias, umbral de aprobación, quién responde y la reevaluación periódica. Privados de la empresa, también dentro
/// de un grupo. Todo cambio deja registro de auditoría (R-1).
/// </summary>
public static class CuestionariosEndpoints
{
    public const string Entidad = "Cuestionario";

    /// <summary>Crea el cuestionario con su primera versión en borrador. 422: <c>codigo-invalido</c>, <c>nombre-requerido</c> y los de la definición; 409 <c>cuestionario-duplicado</c>.</summary>
    [WolverinePost("/api/v1/cuestionarios")]
    [Authorize(Policy = Permisos.CuestionariosEscribir)]
    public static async Task<IResult> Crear(CrearCuestionarioDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var cuestionario = Cuestionario.Crear(empresa.EmpresaId, dto.Codigo, dto.Nombre, dto.Definicion.ADominio(), ahora);
        var codigo = cuestionario.Codigo;
        if (await empresa.Cuestionarios().AnyAsync(c => c.Codigo == codigo, ct))
            throw ReglaDeNegocioException.Conflicto("cuestionario-duplicado", $"La empresa ya tiene el cuestionario {codigo}.");

        empresa.Sesion.Store(cuestionario);
        var resultado = cuestionario.ADto();
        Auditoria.Registrar(empresa.Sesion, contexto, Entidad, cuestionario.Id.ToString(), AccionConfiguracion.Creado, null, resultado, ahora, cuestionario.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/cuestionarios/{cuestionario.Id}", resultado);
    }

    [WolverineGet("/api/v1/cuestionarios")]
    [Authorize(Policy = Permisos.CuestionariosLeer)]
    public static async Task<IReadOnlyList<CuestionarioDto>> Listar(SesionDeEmpresa empresa, CancellationToken ct) =>
        [.. (await empresa.Cuestionarios().OrderBy(c => c.Codigo).ToListAsync(ct)).Select(c => c.ADto())];

    [WolverineGet("/api/v1/cuestionarios/{id}")]
    [Authorize(Policy = Permisos.CuestionariosLeer)]
    public static async Task<CuestionarioDto> Obtener(Guid id, SesionDeEmpresa empresa, CancellationToken ct) =>
        (await empresa.CargarCuestionarioAsync(id, ct)).ADto();

    /// <summary>Edita el borrador (o abre uno nuevo con la versión siguiente); la versión publicada no cambia. Lo nulo conserva lo de la última versión.</summary>
    [WolverinePut("/api/v1/cuestionarios/{id}")]
    [Authorize(Policy = Permisos.CuestionariosEscribir)]
    public static async Task<CuestionarioDto> Editar(Guid id, EditarCuestionarioDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, TimeProvider reloj,
        CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var cuestionario = await empresa.CargarCuestionarioAsync(id, ct);
        var antes = cuestionario.ADto();
        var borrador = cuestionario.EditarBorrador(dto.Nombre, dto.Definicion?.ADominio() ?? cuestionario.Ultima.Definicion, ahora);
        return await GuardarAsync(empresa, contexto, cuestionario, $"{cuestionario.Id}/v{borrador.Version}", AccionConfiguracion.Modificado, antes, ahora, ct);
    }

    /// <summary>Publica el borrador y retira la versión anterior (las evaluaciones ya asignadas conservan la que copiaron). 409 <c>sin-borrador</c>.</summary>
    [WolverinePost("/api/v1/cuestionarios/{id}/publicar")]
    [Authorize(Policy = Permisos.CuestionariosEscribir)]
    public static async Task<CuestionarioDto> Publicar(Guid id, SesionDeEmpresa empresa, IContextoSolicitud contexto, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var cuestionario = await empresa.CargarCuestionarioAsync(id, ct);
        var antes = cuestionario.ADto();
        var publicada = cuestionario.Publicar(ahora);
        return await GuardarAsync(empresa, contexto, cuestionario, $"{cuestionario.Id}/v{publicada.Version}", AccionConfiguracion.Publicado, antes, ahora, ct);
    }

    [WolverineGet("/api/v1/cuestionarios/{id}/versiones")]
    [Authorize(Policy = Permisos.CuestionariosLeer)]
    public static async Task<IReadOnlyList<CuestionarioVersionDto>> Versiones(Guid id, SesionDeEmpresa empresa, CancellationToken ct) =>
        [.. (await empresa.CargarCuestionarioAsync(id, ct)).Versiones.OrderBy(v => v.Version).Select(v => v.ADto())];

    [WolverineGet("/api/v1/cuestionarios/{id}/versiones/{n}")]
    [Authorize(Policy = Permisos.CuestionariosLeer)]
    public static async Task<CuestionarioVersionDto> Version(Guid id, int n, SesionDeEmpresa empresa, CancellationToken ct) =>
        (await empresa.CargarCuestionarioAsync(id, ct)).Versiones.FirstOrDefault(v => v.Version == n)?.ADto()
        ?? throw ReglaDeNegocioException.NoEncontrado("version-no-encontrada", $"El cuestionario no tiene la versión {n}.");

    /// <summary>
    /// Prueba la última versión (el borrador, si lo hay) con respuestas inventadas, sin guardar nada: el puntaje de cada sección y el total, las eliminatorias y el veredicto. Sirve
    /// para ajustar pesos y umbral antes de publicar. 422 con los mismos códigos que al responder (<c>pregunta-obligatoria</c>, <c>respuesta-invalida</c>…).
    /// </summary>
    [WolverinePost("/api/v1/cuestionarios/{id}/simular")]
    [Authorize(Policy = Permisos.CuestionariosLeer)]
    public static async Task<SimulacionDeCuestionarioDto> Simular(Guid id, SimularCuestionarioDto dto, SesionDeEmpresa empresa, CancellationToken ct)
    {
        var version = (await empresa.CargarCuestionarioAsync(id, ct)).Ultima;
        var persona = string.IsNullOrWhiteSpace(dto.TipoPersona) ? TipoPersona.Juridica
            : Enum.TryParse<TipoPersona>(dto.TipoPersona, true, out var indicada) && Enum.IsDefined(indicada) ? indicada
            : throw ReglaDeNegocioException.Validacion("tipo-persona-invalido", $"'{dto.TipoPersona}' no es un tipo de persona ({string.Join(", ", Enum.GetNames<TipoPersona>())}).");
        var pais = string.IsNullOrWhiteSpace(dto.Pais) ? "CO" : dto.Pais.Trim().ToUpperInvariant();
        var contexto = new ContextoDeExigencia(persona, pais, "NIT", pais != "CO", (dto.TipoVinculo ?? string.Empty).Trim().ToUpperInvariant(),
            new Dictionary<string, JsonElement>());

        var evaluadas = CalculadoraDePuntaje.Evaluar(version.Definicion, [.. dto.Respuestas.Select(r => r.ADominio())], contexto);
        return new SimulacionDeCuestionarioDto(version.Version, version.Estado.ToString(), CalculadoraDePuntaje.Totalizar(version.Definicion, evaluadas).ADto());
    }

    private static async Task<CuestionarioDto> GuardarAsync(SesionDeEmpresa empresa, IContextoSolicitud contexto, Cuestionario cuestionario, string entidadId,
        AccionConfiguracion accion, CuestionarioDto antes, DateTimeOffset ahora, CancellationToken ct)
    {
        empresa.Sesion.Store(cuestionario);
        var despues = cuestionario.ADto();
        Auditoria.Registrar(empresa.Sesion, contexto, Entidad + "Version", entidadId, accion, antes, despues, ahora, cuestionario.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        return despues;
    }
}
