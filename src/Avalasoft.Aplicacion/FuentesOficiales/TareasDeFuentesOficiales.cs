using System.Globalization;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Avalasoft.Aplicacion.Certificados;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Expedientes;
using Avalasoft.Aplicacion.Notificaciones;
using Avalasoft.Aplicacion.Verificaciones;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.FuentesOficiales;
using Avalasoft.Dominio.Identidad;
using Avalasoft.Dominio.Plataforma;
using Avalasoft.Dominio.Vinculos;

namespace Avalasoft.Aplicacion.FuentesOficiales;

/// <summary>Cuántas consultas de fuentes oficiales y monitoreos atendió un procesamiento.</summary>
public sealed record ResultadoDeProcesamientoDeFuentes(int Consultas, int Monitoreos);

/// <summary>
/// Trabajo en segundo plano de las fuentes oficiales (FO-1, FO-7), con el mismo procesador periódico de las verificaciones: la consulta automática del RUES
/// y la DIAN cuando el expediente pasa a revisión o su resultado vence, y la reconsulta periódica de los vínculos activos si la empresa la encendió. Cada paso
/// es idempotente y toma el stream con bloqueo de fila antes de escribir; la llamada a la fuente se hace antes, sin bloquear el expediente. Un fallo del proveedor
/// deja la verificación pendiente y se reintenta con espera exponencial (5 min × 2ⁿ, hasta 64×): nunca se da por satisfecha. Con varias réplicas solo una pide
/// cada consulta (OC-4).
/// </summary>
public sealed class TareasDeFuentesOficiales(IDocumentStore store, ConsultaDeFuentesOficiales consulta, EmisorDeCertificados certificados, TimeProvider reloj,
    IProtectorDeSecretos protector, IServiceScopeFactory alcances, ReclamosDeTrabajo reclamos, ILogger<TareasDeFuentesOficiales> registro)
{
    public const string ConsultadoPorElSistema = "Sistema (consulta automática)";

    /// <summary>Cuánto vale el reclamo de una consulta: más que lo que tarda la fuente en responder (con reintentos) y en guardar la evidencia.</summary>
    public static readonly TimeSpan ArrendamientoDeConsulta = TimeSpan.FromMinutes(10);

    /// <summary>Procesa lo pendiente a la hora del reloj: de todos los tenants o de uno solo (<paramref name="tenantId"/>, el barrido inmediato de Plataforma).</summary>
    public async Task<ResultadoDeProcesamientoDeFuentes> ProcesarPendientesAsync(CancellationToken ct, Guid? tenantId = null)
    {
        var ahora = reloj.GetUtcNow();
        List<Expediente> porConsultar;
        List<MonitoreoDeFuentesOficiales> monitoreos;
        Dictionary<Guid, Guid> tenants;
        await using (var global = store.QuerySession())
        await using (var delTenant = tenantId is { } unico ? store.QuerySession(unico.ToString("N")) : null)
        {
            var expedientes = delTenant is null ? global.Query<Expediente>().Where(e => e.AnyTenant()) : delTenant.Query<Expediente>();
            var seguimientos = delTenant is null ? global.Query<MonitoreoDeFuentesOficiales>().Where(m => m.AnyTenant()) : delTenant.Query<MonitoreoDeFuentesOficiales>();
            porConsultar = [.. await expedientes.Where(e => e.ProximaConsultaOficial != null && e.ProximaConsultaOficial <= ahora)
                .OrderBy(e => e.ProximaConsultaOficial).Take(20).ToListAsync(ct)];
            monitoreos = [.. await seguimientos.Where(m => m.ProximaConsulta != null && m.ProximaConsulta <= ahora).OrderBy(m => m.ProximaConsulta).Take(20).ToListAsync(ct)];
            var empresas = porConsultar.Select(e => e.EmpresaId).Concat(monitoreos.Select(m => m.EmpresaId)).Distinct().ToArray();
            tenants = empresas.Length == 0 ? [] : (await global.LoadManyAsync<Empresa>(ct, empresas)).ToDictionary(e => e.Id, e => e.TenantId);
        }

        foreach (var expediente in porConsultar.Where(e => tenants.ContainsKey(e.EmpresaId)))
            await IntentarAsync(() => ConsultarExpedienteAsync(tenants[expediente.EmpresaId], expediente.Id, ct), expediente.Folio, "consultar las fuentes oficiales");
        foreach (var monitoreo in monitoreos.Where(m => tenants.ContainsKey(m.EmpresaId)))
            await IntentarAsync(() => MonitorearAsync(tenants[monitoreo.EmpresaId], monitoreo.Id, ct), monitoreo.Folio, "monitorear las fuentes oficiales");
        return new ResultadoDeProcesamientoDeFuentes(porConsultar.Count, monitoreos.Count);
    }

    /// <summary>Las mismas tareas con otro reloj (el barrido inmediato de Plataforma simula «ahora» solo en Development).</summary>
    public TareasDeFuentesOficiales ConReloj(TimeProvider otro) => new(store, consulta, certificados, otro, protector, alcances, reclamos, registro);

    /// <summary>
    /// Consulta automática de las fuentes pendientes o vencidas de un expediente, una por una; si el proveedor falla, se anota y se reintenta luego. Si lo
    /// consultado era lo último que faltaba y el expediente se aprueba solo, el tercero también recibe su correo de resultado (CU-9).
    /// </summary>
    public async Task ConsultarExpedienteAsync(Guid tenantId, Guid expedienteId, CancellationToken ct)
    {
        await using var sesion = SesionDeSistema(tenantId);
        var ahora = reloj.GetUtcNow();
        var expediente = await sesion.LoadAsync<Expediente>(expedienteId, ct);
        if (expediente?.ProximaConsultaOficial is not { } cuando || cuando > ahora)
            return;

        var pendientes = expediente.Verificaciones.Where(v => CatalogoDeFuentes.EsFuente(v.Tipo) && v.Estado is EstadoVerificacion.Pendiente or EstadoVerificacion.Expirada).ToList();
        foreach (var verificacion in pendientes)
        {
            var tipo = verificacion.Tipo;
            var vence = verificacion.ReintentarDesde ?? verificacion.ExpiroEn ?? expediente.ActualizadoEn;
            if (vence > ahora)
                continue;
            // Cada consulta puede costar: con varias réplicas (o dos pasadas a la vez) solo una la pide por cada ocurrencia programada (OC-4).
            if (!await reclamos.TomarAsync(tenantId, $"consulta-oficial:{expedienteId:N}:{tipo}", vence.UtcTicks.ToString(CultureInfo.InvariantCulture), ahora, ArrendamientoDeConsulta, ct))
                continue;

            ConsultaOficialRealizada resultado;
            try
            {
                resultado = await consulta.ConsultarAsync(sesion, tenantId, expediente.EmpresaId, expediente.TerceroId, tipo, expediente.Folio, ConsultadoPorElSistema,
                    verificacion.VigenciaDias ?? consulta.Opciones.VigenciaDias, ct);
            }
            catch (ReglaDeNegocioException e)
            {
                var espera = TimeSpan.FromMinutes(consulta.Opciones.MinutosReintento * Math.Pow(2, Math.Min(verificacion.Fallos, 6)));
                var fallo = await sesion.Events.FetchForExclusiveWriting<Expediente>(expedienteId, ct);
                var eventos = fallo.Aggregate!.RegistrarFalloDeConsulta(tipo, verificacion.Proveedor ?? CatalogoDeFuentes.Nombre(tipo), e.Message, ahora + espera, ahora);
                await ProcesoDeValidacion.AnexarAsync(sesion, fallo, eventos, null, certificados, ahora, ct);
                await sesion.SaveChangesAsync(ct);
                continue;
            }

            var stream = await sesion.Events.FetchForExclusiveWriting<Expediente>(expedienteId, ct);
            // Mientras se consultaba alguien pudo consultar a mano: esa consulta manda. Solo se registra si la automática sigue pendiente.
            if (stream.Aggregate is not { EstaAbierto: true } actual || actual.BuscarVerificacion(tipo) is not { Estado: EstadoVerificacion.Pendiente or EstadoVerificacion.Expirada } actualizada ||
                (actualizada.ReintentarDesde ?? actualizada.ExpiroEn ?? actual.ActualizadoEn) > reloj.GetUtcNow())
                continue;
            var correos = new CorreosPendientesDeCierre(protector);
            await ProcesoDeValidacion.AnexarAsync(sesion, stream, actual.RegistrarConsultaOficial(tipo, resultado, "sistema", reloj.GetUtcNow()), correos.Correo, certificados,
                reloj.GetUtcNow(), ct);
            await sesion.SaveChangesAsync(ct);
            await correos.PublicarAsync(alcances);
        }
    }

    /// <summary>
    /// Reconsulta periódica de un vínculo activo (FO-7), fuente por fuente. Si el vínculo ya no está activo, el monitoreo se detiene; las diferencias nuevas avisan
    /// a Cumplimiento por la campana (y quedan en su bandeja). Un fallo de una fuente se anota y se reintenta sin perder el último resultado.
    /// </summary>
    public async Task MonitorearAsync(Guid tenantId, Guid vinculoId, CancellationToken ct)
    {
        await using var sesion = SesionDeSistema(tenantId);
        var ahora = reloj.GetUtcNow();
        var monitoreo = await sesion.LoadAsync<MonitoreoDeFuentesOficiales>(vinculoId, ct);
        if (monitoreo?.ProximaConsulta is not { } cuando || cuando > ahora)
            return;

        var vinculo = await sesion.LoadAsync<Vinculo>(vinculoId, ct);
        if (vinculo is not { Estado: EstadoVinculo.Activo or EstadoVinculo.PorVencer })
        {
            monitoreo.Detener(ahora);
            sesion.Store(monitoreo);
            await sesion.SaveChangesAsync(ct);
            return;
        }

        var nuevas = new List<(TipoVerificacion Fuente, int Diferencias, string Referencia)>();
        foreach (var fuente in monitoreo.Fuentes.Where(f => monitoreo.Vence(f, ahora)).ToList())
        {
            var instancia = (fuente.ReintentarDesde ?? fuente.RegistradaEn ?? monitoreo.CreadoEn).UtcTicks.ToString(CultureInfo.InvariantCulture);
            if (!await reclamos.TomarAsync(tenantId, $"monitoreo-oficial:{vinculoId:N}:{fuente.Tipo}", instancia, ahora, ArrendamientoDeConsulta, ct))
                continue;
            try
            {
                var resultado = await consulta.ConsultarAsync(sesion, tenantId, monitoreo.EmpresaId, monitoreo.TerceroId, fuente.Tipo, $"{monitoreo.Folio}-monitoreo",
                    "Sistema (monitoreo periódico)", consulta.Opciones.VigenciaDias, ct);
                var diferencias = monitoreo.RegistrarConsulta(fuente.Tipo, resultado, "sistema", ahora);
                if (diferencias.Count > 0)
                    nuevas.Add((fuente.Tipo, diferencias.Count, resultado.ReferenciaExterna));
            }
            catch (ReglaDeNegocioException e)
            {
                monitoreo.RegistrarFallo(fuente.Tipo, e.Message, ahora + TimeSpan.FromMinutes(consulta.Opciones.MinutosReintento * Math.Pow(2, Math.Min(fuente.Fallos, 6))), ahora);
            }
        }

        sesion.Store(monitoreo);
        if (nuevas.Count > 0)
        {
            var usuarios = await sesion.Query<Usuario>().Where(u => u.Activo).ToListAsync(ct);
            var empresa = await sesion.LoadAsync<Empresa>(monitoreo.EmpresaId, ct);
            foreach (var (fuente, diferencias, referencia) in nuevas)
            {
                var plan = NotificacionesDeCumplimiento.Plan(tenantId, monitoreo.EmpresaId, TiposNotificacion.CoincidenciaListas, $"Diferencias en el monitoreo de {CatalogoDeFuentes.Nombre(fuente)}",
                    $"La reconsulta periódica de {monitoreo.TerceroNombre} a {CatalogoDeFuentes.Nombre(fuente)} encontró {diferencias} diferencia(s) nueva(s) por revisar.",
                    $"monitoreo-oficial:{vinculoId:N}:{referencia}", null, vinculoId, monitoreo.Folio, $"/e/{monitoreo.EmpresaId}/cumplimiento", empresa?.Nombre, usuarios, _ => null, ahora,
                    ahora.UtcTicks);
                foreach (var (_, notificacion) in plan.Campana)
                    sesion.Store(notificacion);
            }
        }

        await sesion.SaveChangesAsync(ct);
    }

    private async Task IntentarAsync(Func<Task> accion, string folio, string que)
    {
        try
        {
            await accion();
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            registro.LogWarning(e, "No se pudo {Que} de {Folio}; se reintentará.", que, folio);
        }
    }

    private IDocumentSession SesionDeSistema(Guid tenantId)
    {
        var sesion = store.LightweightSession(tenantId.ToString("N"));
        sesion.SetHeader("actorTipo", nameof(ActorTipo.Sistema));
        sesion.SetHeader("actorId", "fuentes-oficiales");
        return sesion;
    }
}
