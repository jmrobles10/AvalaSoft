using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Validasoft.Aplicacion.Comun;
using Validasoft.Contratos;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Configuracion;
using Validasoft.Dominio.Evaluaciones;
using Validasoft.Dominio.Plataforma;
using Validasoft.Dominio.Terceros;
using Validasoft.Dominio.Vinculos;
using Wolverine;
using Wolverine.Http;

namespace Validasoft.Aplicacion.Evaluaciones;

// Reevaluación periódica (CE-11), con el patrón de las vigencias de vínculos (VV-1…VV-6): el cuestionario puede pedir repetir la evaluación cada tantos meses. Una evaluación
// calificada y aprobada guarda hasta cuándo vale (VigenteHasta) y, indexado, cuándo debe revisarse (ProximaReevaluacion). Un barrido periódico, que corre solo en el nodo líder (OC-4),
// pide por cada evaluación vencida ReevaluarEvaluacion en la cola durable «vigencias»: la marca Vencida y, en la misma transacción, asigna una evaluación nueva con la versión publicada de
// ese momento (Motivo Reevaluacion, sin expediente: su efecto es Observar). Es idempotente: vuelve a mirar el estado al dispararse. No cambia el estado del vínculo ni frena la consulta
// de certificación: la reevaluación queda pendiente a la vista de la empresa (y del tercero si es autoevaluación) hasta que se responda.

/// <summary>Barre las evaluaciones vencidas a la hora <see cref="Ahora"/> (o la actual), de todos los tenants o de uno.</summary>
public sealed record RevisarReevaluaciones(Guid? TenantId = null, DateTimeOffset? Ahora = null);

/// <summary>Vence una evaluación y asigna la que la reemplaza (idempotente: si no está vencida no hace nada).</summary>
public sealed record ReevaluarEvaluacion(Guid TenantId, Guid EvaluacionId, DateTimeOffset? Ahora = null);

/// <summary>Resultado de una evaluación revisada por el barrido.</summary>
public enum ResultadoDeReevaluacion
{
    SinCambios,

    /// <summary>Se marcó vencida y se asignó la nueva evaluación.</summary>
    Reasignada,

    /// <summary>Se marcó vencida, pero no hay a quién reevaluar (vínculo terminado o cuestionario ya sin versión publicada).</summary>
    SoloVencida
}

public static class ReevaluacionesPeriodicas
{
    /// <summary>Cuántas evaluaciones pide un barrido como máximo (lo que sobre lo recoge el siguiente).</summary>
    public const int MaximoPorBarrido = 200;

    /// <summary>
    /// Evaluaciones vencidas a <paramref name="ahora"/>, las más atrasadas primero. El tenant de cada una sale de su empresa (global): la consulta entre tenants no lo devuelve.
    /// </summary>
    public static async Task<IReadOnlyList<ReevaluarEvaluacion>> PendientesAsync(IDocumentStore store, Guid? tenantId, DateTimeOffset ahora, CancellationToken ct)
    {
        IReadOnlyList<EvaluacionDeProveedor> evaluaciones;
        if (tenantId is { } tenant)
        {
            await using var consulta = store.QuerySession(tenant.ToString("N"));
            evaluaciones = await consulta.Query<EvaluacionDeProveedor>()
                .Where(e => e.ProximaReevaluacion != null && e.ProximaReevaluacion <= ahora)
                .OrderBy(e => e.ProximaReevaluacion).Take(MaximoPorBarrido).ToListAsync(ct);
        }
        else
        {
            await using var consulta = store.QuerySession();
            evaluaciones = await consulta.Query<EvaluacionDeProveedor>()
                .Where(e => e.AnyTenant() && e.ProximaReevaluacion != null && e.ProximaReevaluacion <= ahora)
                .OrderBy(e => e.ProximaReevaluacion).Take(MaximoPorBarrido).ToListAsync(ct);
        }

        if (evaluaciones.Count == 0)
            return [];

        await using var global = store.QuerySession();
        var empresas = (await global.LoadManyAsync<Empresa>(ct, evaluaciones.Select(e => e.EmpresaId).Distinct().ToArray())).ToDictionary(e => e.Id);
        return [.. evaluaciones.Where(e => empresas.ContainsKey(e.EmpresaId)).Select(e => new ReevaluarEvaluacion(empresas[e.EmpresaId].TenantId, e.Id))];
    }

    /// <summary>Vence la evaluación y asigna la nueva, todo en una transacción. Con la evaluación bloqueada: dos réplicas pidiéndolo a la vez no duplican la asignación.</summary>
    public static async Task<ResultadoDeReevaluacion> ReevaluarAsync(ISesiones sesiones, ReevaluarEvaluacion mensaje, DateTimeOffset ahora, CancellationToken ct)
    {
        await using var sesion = sesiones.ParaTenant(mensaje.TenantId);
        var stream = await sesion.Events.FetchForExclusiveWriting<EvaluacionDeProveedor>(mensaje.EvaluacionId, ct);
        if (stream.Aggregate is not { } evaluacion)
            return ResultadoDeReevaluacion.SinCambios;
        var eventos = evaluacion.Vencer(ahora);
        if (eventos.Count == 0)
            return ResultadoDeReevaluacion.SinCambios;
        stream.AppendMany(eventos);

        var resultado = ResultadoDeReevaluacion.SoloVencida;
        var vinculo = await sesion.LoadAsync<Vinculo>(evaluacion.VinculoId, ct);
        var cuestionario = await sesion.LoadAsync<Cuestionario>(evaluacion.Cuestionario.Id, ct);
        var tercero = await sesion.LoadAsync<Tercero>(evaluacion.TerceroId, ct);
        if (vinculo is { Estado: not (EstadoVinculo.Anulado or EstadoVinculo.Desvinculado) } && cuestionario?.VersionPublicada is { } publicada && tercero is not null)
        {
            // La versión publicada de ahora: si el cuestionario cambió, la reevaluación usa la nueva.
            var asignada = EvaluacionDeProveedor.Asignar(evaluacion.EmpresaId, vinculo.Id, null, tercero.Id, tercero.Nombre, tercero.Identificacion.Clave,
                MotivoDeEvaluacion.Reevaluacion, new CuestionarioDeLaEvaluacion(cuestionario.Id, publicada.Id, publicada.Version, cuestionario.Codigo, cuestionario.Nombre),
                publicada.Definicion, EfectoDeLaEvaluacion.Observar, evaluacion.Id, ahora);
            sesion.Events.StartStream<EvaluacionDeProveedor>(asignada.EvaluacionId, asignada);
            resultado = ResultadoDeReevaluacion.Reasignada;
        }

        await sesion.SaveChangesAsync(ct);
        return resultado;
    }
}

public static class RevisarReevaluacionesHandler
{
    /// <summary>Pide la revisión de cada evaluación vencida por la cola durable (cada una en su transacción, con sus reintentos).</summary>
    public static async Task Handle(RevisarReevaluaciones mensaje, IDocumentStore store, IMessageContext mensajes, TimeProvider reloj, CancellationToken ct)
    {
        foreach (var pendiente in await ReevaluacionesPeriodicas.PendientesAsync(store, mensaje.TenantId, mensaje.Ahora ?? reloj.GetUtcNow(), ct))
            await mensajes.PublishAsync(pendiente with { Ahora = mensaje.Ahora });
    }
}

public static class ReevaluarEvaluacionHandler
{
    public static async Task Handle(ReevaluarEvaluacion mensaje, ISesiones sesiones, TimeProvider reloj, CancellationToken ct) =>
        await ReevaluacionesPeriodicas.ReevaluarAsync(sesiones, mensaje, mensaje.Ahora ?? reloj.GetUtcNow(), ct);
}

/// <summary>
/// Dispara el barrido de reevaluaciones cada <c>Validasoft:Reevaluaciones:Intervalo</c> (por omisión, una hora; <c>00:00:00</c> lo apaga). Con varias réplicas solo corre en el líder
/// (OC-4) y, aun así, el barrido es idempotente (cada evaluación se revisa con su stream bloqueado).
/// </summary>
public sealed class ProgramadorDeReevaluaciones(IServiceProvider servicios, IConfiguration configuracion, ILogger<ProgramadorDeReevaluaciones> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var intervalo = configuracion.GetValue("Validasoft:Reevaluaciones:Intervalo", TimeSpan.FromHours(1));
        if (intervalo <= TimeSpan.Zero)
            return;

        // El primero al minuto de arrancar (lo que venció mientras la API estaba detenida) y luego cada intervalo.
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1) < intervalo ? TimeSpan.FromMinutes(1) : intervalo, stoppingToken);
            using var temporizador = new PeriodicTimer(intervalo);
            do
            {
                try
                {
                    await using var alcance = servicios.CreateAsyncScope();
                    await alcance.ServiceProvider.GetRequiredService<IMessageBus>().PublishAsync(new RevisarReevaluaciones());
                }
                catch (Exception e) when (e is not OperationCanceledException)
                {
                    logger.LogWarning(e, "No se pudo pedir el barrido de reevaluaciones.");
                }
            } while (await temporizador.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Apagado de la API.
        }
    }
}

/// <summary>Ejecución inmediata del barrido de reevaluaciones (Plataforma).</summary>
public static class ReevaluacionesEndpoints
{
    /// <summary>
    /// Corre ya el barrido de reevaluaciones (Plataforma) y espera su resultado: de un tenant o de todos. <c>fecha</c> simula «ahora» y solo se admite en Development (pruebas de punta a
    /// punta; 422 <c>fecha-simulada-no-permitida</c> en otro entorno). Cada llamada vence y reasigna cada evaluación vencida una sola vez.
    /// </summary>
    [WolverinePost("/api/v1/plataforma/reevaluaciones/revisar")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<ResultadoRevisionReevaluacionesDto> Revisar(RevisarReevaluacionesDto dto, IDocumentStore store, ISesiones sesiones, IHostEnvironment entorno,
        TimeProvider reloj, CancellationToken ct)
    {
        if (dto.Fecha is not null && !entorno.IsDevelopment())
            throw ReglaDeNegocioException.Validacion("fecha-simulada-no-permitida", "La fecha simulada solo se admite en Development.");

        var ahora = dto.Fecha ?? reloj.GetUtcNow();
        var pendientes = await ReevaluacionesPeriodicas.PendientesAsync(store, dto.TenantId, ahora, ct);
        int vencidas = 0, asignadas = 0;
        foreach (var pendiente in pendientes)
            switch (await ReevaluacionesPeriodicas.ReevaluarAsync(sesiones, pendiente, ahora, ct))
            {
                case ResultadoDeReevaluacion.Reasignada:
                    vencidas++;
                    asignadas++;
                    break;
                case ResultadoDeReevaluacion.SoloVencida:
                    vencidas++;
                    break;
            }

        return new ResultadoRevisionReevaluacionesDto(pendientes.Count, vencidas, asignadas);
    }
}
