using JasperFx;
using Npgsql;
using Avalasoft.Adaptadores.Portal;
using Scalar.AspNetCore;
using Avalasoft.Infraestructura;
using Avalasoft.Infraestructura.Http;
using Wolverine;
using Wolverine.Http;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AgregarAvalasoft(builder.Configuration);
builder.Services.AgregarPlataformaWeb(builder.Configuration);
// Adaptadores de origen del importador genérico: opcionales; sin ellos AvalaSoft funciona igual (el importador responde 404).
builder.Services.AgregarAdaptadorPortal();
builder.Services.AddOpenApi("v1");
builder.Services.AddWolverineHttp();
builder.Host.UseWolverine(opts => opts.ConfigurarMensajeria());

var app = builder.Build();

// La IP real (X-Forwarded-For) solo desde proxies confiables: la usan el límite por IP y la auditoría (SE-6).
app.UsarProxiesConfiables();
app.UseExceptionHandler();
// apps/web en /app/ y apps/public en / con frame-ancestors (SE-3), y CORS opcional con lista explícita (SE-5).
app.UsarAppsYCors();
app.UseAuthentication();
// El límite va después de la autenticación: con la sesión de un tercero cuenta por tercero (no por IP); lo anónimo o con token inválido sigue por IP.
app.UseRateLimiter();
app.UseMiddleware<MiddlewareDeContexto>();
app.UseAuthorization();
app.UseMiddleware<MiddlewareDeIdempotencia>();

app.MapGet("/health/live", () => Results.Ok(new { estado = "vivo" })).AllowAnonymous();
app.MapGet("/health/ready", async (IConfiguration configuracion, CancellationToken ct) =>
{
    try
    {
        await using var conexion = new NpgsqlConnection(configuracion.GetConnectionString("Avalasoft"));
        await conexion.OpenAsync(ct);
        return Results.Ok(new { estado = "listo" });
    }
    catch (Exception)
    {
        return Results.Json(new { estado = "sin-base-de-datos" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.MapOpenApi("/openapi/{documentName}.json").AllowAnonymous();
if (app.Environment.IsDevelopment())
    app.MapScalarApiReference("/docs").AllowAnonymous();

app.MapWolverineEndpoints();

// `dotnet run -- db-apply` aplica el esquema en entornos sin creación automática (docs/04 §11).
return await app.RunJasperFxCommands(args);

public partial class Program;
