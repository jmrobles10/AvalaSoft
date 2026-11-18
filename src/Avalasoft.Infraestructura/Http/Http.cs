using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using JasperFx;
using JasperFx.Events;
using Marten;
using Marten.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Interesado;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Plataforma;
using Avalasoft.Infraestructura.Seguridad;

namespace Avalasoft.Infraestructura.Http;

/// <summary>
/// Llena el <see cref="ContextoSolicitud"/>: tenant, actor, sistema, scopes y empresas desde la credencial (API key o
/// sesión Bearer); empresa activa desde <c>X-Empresa</c> (validada contra el tenant y el alcance de la credencial; si
/// no, 404 — T-4); correlación desde <c>X-Correlation-Id</c> (se devuelve en la respuesta). Los scopes de roles por
/// empresa (<see cref="Reclamos.ScopeEmpresa"/>) solo se suman cuando esa es la empresa activa.
/// </summary>
public sealed class MiddlewareDeContexto(RequestDelegate siguiente)
{
    public const string CabeceraEmpresa = "X-Empresa";
    public const string CabeceraCorrelacion = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext http, IDocumentStore store, IEntornos entornos, CacheDeEmpresas empresas, Aplicacion.Plataforma.ControlDePlan plan)
    {
        var contexto = ContextoDesdeHttp.De(http);
        contexto.CorrelationId = Correlacion(http);
        http.Response.Headers[CabeceraCorrelacion] = contexto.CorrelationId;

        var usuario = http.User;
        if (usuario.Identity?.IsAuthenticated == true)
        {
            contexto.TenantId = Guid.TryParse(usuario.FindFirstValue(Reclamos.Tenant), out var tenant) ? tenant : null;
            contexto.ActorTipo = Enum.TryParse<ActorTipo>(usuario.FindFirstValue(Reclamos.ActorTipo), out var actor) ? actor : ActorTipo.Sistema;
            contexto.ActorId = usuario.FindFirstValue(ClaimTypes.NameIdentifier) ?? usuario.FindFirstValue(Reclamos.Sujeto) ?? "desconocido";
            contexto.Sistema = usuario.FindFirstValue(Reclamos.Sistema);
            contexto.Empresas = usuario.FindAll(Reclamos.Empresa).Select(c => c.Value).ToHashSet();

            // Una credencial de prueba opera en el sandbox del grupo (SB-1): toda respuesta lo dice, para que nadie lo confunda con producción.
            if (contexto.TenantId is { } tenantDeLaCredencial && await entornos.EsSandboxAsync(tenantDeLaCredencial, http.RequestAborted))
            {
                contexto.EsSandbox = true;
                http.Response.Headers[AislamientoDeSandbox.CabeceraEntorno] = AislamientoDeSandbox.Entorno;
            }

            var cabeceraEmpresa = http.Request.Headers[CabeceraEmpresa].ToString();
            if (!string.IsNullOrWhiteSpace(cabeceraEmpresa))
            {
                var empresa = Guid.TryParse(cabeceraEmpresa, out var empresaId) && contexto.TenantId is not null
                    ? await empresas.ObtenerAsync(store, empresaId, http.RequestAborted)
                    : null;

                var permitida = empresa is not null && empresa.Activa && empresa.TenantId == contexto.TenantId &&
                                (contexto.Empresas.Contains("*") || contexto.Empresas.Contains(empresa.Id.ToString()));
                if (!permitida)
                    throw ReglaDeNegocioException.NoEncontrado("empresa-no-encontrada", "No existe esa empresa o la credencial no tiene acceso a ella.");

                contexto.EmpresaId = empresa!.Id;
            }

            var scopes = usuario.FindAll(Reclamos.Scope).Select(c => c.Value).ToHashSet();
            if (contexto.EmpresaId is { } activa)
            {
                var sufijo = "|" + activa;
                scopes.UnionWith(usuario.FindAll(Reclamos.ScopeEmpresa).Where(c => c.Value.EndsWith(sufijo, StringComparison.Ordinal))
                    .Select(c => c.Value[..^sufijo.Length]));
            }

            contexto.Scopes = scopes;
            // Acotaciones por sector de la ficha de los grupos de acceso de la persona (sin el reclamo, los permisos valen para todos los sectores).
            contexto.SectoresRestringidos = [.. usuario.FindAll(Reclamos.Sectores).Select(c => SectorRestringido.Decodificar(c.Value)).OfType<SectorRestringido>()];

            // Plan del grupo (OD-15): cada llamada a /api/v1 con una API key de producción cuenta para el límite mensual de llamadas; no cuentan
            // las pantallas (sesiones), el sandbox ni la Plataforma. Con el bloqueo suave y el tope alcanzado, las escrituras responden 429.
            if (usuario.Identity.AuthenticationType == AutenticacionPorApiKey.Esquema && contexto.TenantId is { } grupo && !contexto.EsSandbox &&
                contexto.ActorTipo != ActorTipo.Plataforma && http.Request.Path.StartsWithSegments("/api/v1", StringComparison.OrdinalIgnoreCase))
                await plan.RegistrarLlamadaAsync(grupo, !HttpMethods.IsGet(http.Request.Method) && !HttpMethods.IsHead(http.Request.Method) && !HttpMethods.IsOptions(http.Request.Method),
                    http.RequestAborted);
        }

        await siguiente(http);
    }

    /// <summary><c>X-Correlation-Id</c> del cliente (hasta 100 caracteres) o el identificador de la petición.</summary>
    public static string Correlacion(HttpContext http)
    {
        var correlacion = http.Request.Headers[CabeceraCorrelacion].ToString();
        return string.IsNullOrWhiteSpace(correlacion) || correlacion.Length > 100 ? http.TraceIdentifier : correlacion;
    }

}

/// <summary>Traduce excepciones a ProblemDetails RFC 9457 con <c>codigo</c> estable y <c>traceId</c> (docs/05 §3.3).</summary>
public sealed class ManejadorDeErrores(IProblemDetailsService problemas, ILogger<ManejadorDeErrores> logger, IHostEnvironment entorno)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception excepcion, CancellationToken ct)
    {
        // Una regla de negocio envuelta por una librería (p. ej. Marten al evaluar una expresión LINQ) responde como regla.
        excepcion = ReglaEnvuelta(excepcion) ?? excepcion;
        var ruta = RutaSegura(http.Request.Path);
        if (excepcion is not ReglaDeNegocioException)
            logger.LogError(excepcion, "Error no controlado en {Ruta} (traceId {TraceId})", ruta, http.TraceIdentifier);

        var (estado, codigo, detalle) = excepcion switch
        {
            ReglaDeNegocioException r => (r.Tipo switch
            {
                TipoFalla.Validacion => StatusCodes.Status422UnprocessableEntity,
                TipoFalla.NoEncontrado => StatusCodes.Status404NotFound,
                TipoFalla.Prohibido => StatusCodes.Status403Forbidden,
                TipoFalla.NoAutenticado => StatusCodes.Status401Unauthorized,
                TipoFalla.Expirado => StatusCodes.Status410Gone,
                TipoFalla.DemasiadosIntentos => StatusCodes.Status429TooManyRequests,
                TipoFalla.DemasiadoGrande => StatusCodes.Status413PayloadTooLarge,
                TipoFalla.TipoNoSoportado => StatusCodes.Status415UnsupportedMediaType,
                TipoFalla.NoDisponible => StatusCodes.Status503ServiceUnavailable,
                _ => StatusCodes.Status409Conflict
            }, r.Codigo, r.Message),
            ConcurrencyException or EventStreamUnexpectedMaxEventIdException =>
                (StatusCodes.Status412PreconditionFailed, "version-desactualizada", "El recurso cambió desde que lo leíste; vuelve a cargarlo."),
            DocumentAlreadyExistsException => (StatusCodes.Status409Conflict, "duplicado", "El recurso ya existe."),
            MartenCommandException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } } =>
                (StatusCodes.Status409Conflict, "duplicado", "Ya existe un registro con esos datos únicos."),
            BadHttpRequestException b => (StatusCodes.Status400BadRequest, "peticion-invalida", b.Message),
            _ => (StatusCodes.Status500InternalServerError, "error-interno", "Ocurrió un error inesperado. Usa el traceId para reportarlo.")
        };

        http.Response.StatusCode = estado;
        var problema = new ProblemDetails
        {
            Status = estado,
            Type = $"https://docs.avalasoft.co/errores/{codigo}",
            Title = codigo,
            Detail = detalle,
            Instance = ruta
        };
        problema.Extensions["codigo"] = codigo;
        problema.Extensions["traceId"] = http.TraceIdentifier;
        if (excepcion is ReglaDeNegocioException { Datos: { } datos })
        {
            foreach (var (clave, valor) in datos)
                problema.Extensions[clave] = valor;
        }
        if (estado == StatusCodes.Status500InternalServerError && entorno.IsDevelopment())
            problema.Extensions["excepcion"] = excepcion.ToString();

        return await problemas.TryWriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = problema, Exception = excepcion });
    }

    private static ReglaDeNegocioException? ReglaEnvuelta(Exception excepcion)
    {
        for (var actual = excepcion.InnerException; actual is not null; actual = actual.InnerException)
            if (actual is ReglaDeNegocioException regla)
                return regla;
        return null;
    }

    /// <summary>Ruta sin secretos: el token de <c>/public/v1/enlaces/{token}/…</c> nunca llega a logs ni a respuestas de error.</summary>
    public static string RutaSegura(PathString ruta) =>
        Regex.Replace(ruta.Value ?? string.Empty, "(?<=/enlaces/)[^/]+", "***", RegexOptions.IgnoreCase);
}

/// <summary>
/// Cupos del límite de peticiones (<c>Avalasoft:LimitePublico</c> y <c>Avalasoft:LimiteIngreso</c>): por IP y por sesión del tercero en
/// <c>/public/v1</c>, y el del ingreso directo.
/// </summary>
public sealed record CuposDeLimitePublico(int PorIp, int PorSesion, TimeSpan Ventana, int Ingreso, TimeSpan VentanaIngreso)
{
    /// <summary>Por omisión, por minuto: 60 por IP, 300 por sesión del tercero y 30 por IP en el ingreso.</summary>
    public static CuposDeLimitePublico De(IConfiguration configuracion) => new(
        Math.Max(1, configuracion.GetValue("Avalasoft:LimitePublico:Peticiones", 60)),
        Math.Max(1, configuracion.GetValue("Avalasoft:LimitePublico:PeticionesPorSesion", 300)),
        TimeSpan.FromSeconds(Math.Max(1, configuracion.GetValue("Avalasoft:LimitePublico:VentanaSegundos", 60))),
        // El ingreso directo (/api/v1/ingreso, ING-1) tiene su propio cupo por IP: 30 peticiones por minuto por omisión.
        Math.Max(1, configuracion.GetValue("Avalasoft:LimiteIngreso:Peticiones", 30)),
        TimeSpan.FromSeconds(Math.Max(1, configuracion.GetValue("Avalasoft:LimiteIngreso:VentanaSegundos", 60))));
}

/// <summary>
/// Límite de peticiones de <c>/public/v1</c> (ventana fija; <c>Avalasoft:LimitePublico:{Peticiones, PeticionesPorSesion, VentanaSegundos}</c>).
/// Con la sesión de un tercero —ya autenticada: el límite corre después de <c>UseAuthentication</c>, así que el reclamo <c>terceroId</c> es el de un
/// token válido y nadie inventa particiones— el cupo es por tercero (300 por minuto por omisión): su portal pide varias consultas seguidas y la IP de
/// salida de una oficina no debe agotar el cupo de todos. Lo anónimo (abrir el enlace, el verificador de certificados) y un token vencido o inválido
/// siguen por IP (60 por minuto). La evaluación de la ficha (<c>…/evaluacion</c>, FM-46) va en otro cupo, cuatro veces mayor al que le toque: el
/// wizard la pide mientras el tercero escribe y no debe agotar el de las demás. <c>/api/v1</c> aún no tiene límite (llegará por credencial), salvo el
/// ingreso directo, por IP. Excedido ⇒ 429 ProblemDetails <c>demasiadas-peticiones</c> con <c>Retry-After</c>.
/// </summary>
public static class LimiteDePeticionesPublicas
{
    /// <summary>Rutas del ingreso directo: anónimas, con su propio límite por IP.</summary>
    public const string RutaIngreso = "/api/v1/ingreso";

    /// <summary>
    /// Partición y cupo de una petición de <c>/public/v1</c>: por tercero si trae una sesión de tercero ya autenticada, si no por IP; la evaluación de la
    /// ficha va en su propia partición y con cuatro veces el cupo. No consulta nada: lee el reclamo del token que la autenticación ya validó.
    /// </summary>
    public static (string Clave, int Cupo) ParticionPublica(HttpContext http, CuposDeLimitePublico cupos)
    {
        var usuario = http.User;
        Guid? tercero = usuario.Identity?.IsAuthenticated == true && usuario.FindFirstValue(ReclamosTercero.Tipo) == ReclamosTercero.ValorTipo &&
                        Guid.TryParse(usuario.FindFirstValue(ReclamosTercero.TerceroId), out var terceroId)
            ? terceroId
            : null;
        var sujeto = tercero is { } id ? "tercero:" + id.ToString("N") : "ip:" + (http.Connection.RemoteIpAddress?.ToString() ?? "desconocida");
        var cupo = tercero is null ? cupos.PorIp : cupos.PorSesion;
        var evaluacion = http.Request.Path.Value?.EndsWith("/evaluacion", StringComparison.OrdinalIgnoreCase) == true;
        return evaluacion ? ("evaluacion:" + sujeto, cupo * 4) : (sujeto, cupo);
    }

    /// <summary>El limitador global: el ingreso por su cupo, <c>/public/v1</c> según <see cref="ParticionPublica"/> y todo lo demás sin límite.</summary>
    public static PartitionedRateLimiter<HttpContext> CrearLimitador(CuposDeLimitePublico cupos) =>
        PartitionedRateLimiter.Create<HttpContext, string>(http =>
        {
            if (http.Request.Path.StartsWithSegments(RutaIngreso, StringComparison.OrdinalIgnoreCase))
                return RateLimitPartition.GetFixedWindowLimiter("ingreso:" + (http.Connection.RemoteIpAddress?.ToString() ?? "desconocida"),
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = cupos.Ingreso, Window = cupos.VentanaIngreso, QueueLimit = 0 });
            if (!http.Request.Path.StartsWithSegments(ServiciosInfraestructura.RutaPublica, StringComparison.OrdinalIgnoreCase))
                return RateLimitPartition.GetNoLimiter("sin-limite");
            var (clave, cupo) = ParticionPublica(http, cupos);
            return RateLimitPartition.GetFixedWindowLimiter(clave, _ => new FixedWindowRateLimiterOptions { PermitLimit = cupo, Window = cupos.Ventana, QueueLimit = 0 });
        });

    public static IServiceCollection AgregarLimiteDePeticionesPublicas(this IServiceCollection servicios, IConfiguration configuracion)
    {
        var cupos = CuposDeLimitePublico.De(configuracion);
        var ventana = cupos.Ventana;

        return servicios.AddRateLimiter(opciones =>
        {
            opciones.GlobalLimiter = CrearLimitador(cupos);

            opciones.OnRejected = async (contexto, ct) =>
            {
                var http = contexto.HttpContext;
                http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                http.Response.Headers.RetryAfter = ((int)ventana.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
                var problema = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Type = "https://docs.avalasoft.co/errores/demasiadas-peticiones",
                    Title = "demasiadas-peticiones",
                    Detail = "Hiciste demasiadas peticiones; espera un momento e inténtalo de nuevo.",
                    Instance = ManejadorDeErrores.RutaSegura(http.Request.Path)
                };
                problema.Extensions["codigo"] = "demasiadas-peticiones";
                problema.Extensions["traceId"] = http.TraceIdentifier;
                await http.RequestServices.GetRequiredService<IProblemDetailsService>()
                    .WriteAsync(new ProblemDetailsContext { HttpContext = http, ProblemDetails = problema });
            };
        });
    }
}
