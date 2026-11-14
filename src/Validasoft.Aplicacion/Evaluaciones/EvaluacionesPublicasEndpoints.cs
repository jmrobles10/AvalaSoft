using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validasoft.Aplicacion.Certificados;
using Validasoft.Aplicacion.Comun;
using Validasoft.Aplicacion.Interesado;
using Validasoft.Contratos;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Evaluaciones;
using Wolverine;
using Wolverine.Http;

namespace Validasoft.Aplicacion.Evaluaciones;

/// <summary>
/// El tercero responde la autoevaluación (CE-4, <c>QuienResponde.Tercero</c>) dentro de su vínculo con la empresa: solo las evaluaciones de los vínculos de su sesión y cuyo cuestionario
/// lo pide a él. Ve las preguntas con sus opciones, <b>nunca</b> puntajes, pesos, eliminatorias ni el umbral, y tras enviar solo ve sus respuestas y que quedó enviada: el resultado es privado
/// de la empresa. 404 con cualquier evaluación que no sea suya.
/// </summary>
public static class EvaluacionesPublicasEndpoints
{
    /// <summary>Las evaluaciones del vínculo que le tocan responder al tercero (pendientes y enviadas; no las anuladas).</summary>
    [WolverineGet("/public/v1/vinculos/{vinculoId}/evaluaciones")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<IReadOnlyList<EvaluacionPublicaResumenDto>> Listar(Guid vinculoId, HttpContext http, ISesiones sesiones, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        await using var sesion = sesiones.ParaTenant(enSesion.TenantId);
        var empresaId = enSesion.EmpresaId;
        var lista = await sesion.Query<EvaluacionDeProveedor>()
            .Where(e => e.VinculoId == vinculoId && e.EmpresaId == empresaId && e.TerceroId == tercero.TerceroId && e.Estado != EstadoDeEvaluacion.Anulada)
            .OrderByDescending(e => e.AsignadaEn).ToListAsync(ct);
        return [.. lista.Where(e => e.Definicion.Responde == QuienResponde.Tercero && e.Estado != EstadoDeEvaluacion.Vencida).Select(e => e.APublicaResumen())];
    }

    [WolverineGet("/public/v1/vinculos/{vinculoId}/evaluaciones/{id}")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<EvaluacionPublicaDto> Obtener(Guid vinculoId, Guid id, HttpContext http, ISesiones sesiones, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        await using var sesion = sesiones.ParaTenant(enSesion.TenantId);
        return Propia(await sesion.LoadAsync<EvaluacionDeProveedor>(id, ct), tercero, enSesion).APublica();
    }

    /// <summary>Qué preguntas y secciones se muestran con las respuestas que lleva (las condiciones se evalúan en el servidor); no guarda nada.</summary>
    [WolverinePost("/public/v1/vinculos/{vinculoId}/evaluaciones/{id}/visibilidad")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<VisibilidadDto> Visibilidad(Guid vinculoId, Guid id, ResponderEvaluacionDto dto, HttpContext http, ISesiones sesiones, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        await using var sesion = sesiones.ParaTenant(enSesion.TenantId);
        var evaluacion = Propia(await sesion.LoadAsync<EvaluacionDeProveedor>(id, ct), tercero, enSesion);
        return EvaluacionesEndpoints.VisibilidadDe(evaluacion, dto, await ProcesoDeEvaluaciones.ContextoAsync(sesion, evaluacion, ct));
    }

    /// <summary>
    /// Envía la autoevaluación. Se califica en el acto y el expediente que la esperaba se entera en la misma transacción (si era lo último que lo frenaba, se aprueba), pero el tercero no ve
    /// el resultado: responde la evaluación ya <c>Enviada</c>. 409 <c>evaluacion-no-pendiente</c>, <c>vinculo-bloqueado</c>; 422 <c>pregunta-obligatoria</c>, <c>respuesta-invalida</c>,
    /// <c>pregunta-no-visible</c>, <c>adjunto-invalido</c>…
    /// </summary>
    [WolverinePost("/public/v1/vinculos/{vinculoId}/evaluaciones/{id}/responder")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<EvaluacionPublicaDto> Responder(Guid vinculoId, Guid id, ResponderEvaluacionDto dto, HttpContext http, ISesiones sesiones, IMessageBus mensajes,
        EmisorDeCertificados certificados, TimeProvider reloj, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        return await Peticiones.ConReintentosAsync(async () =>
        {
            var ahora = reloj.GetUtcNow();
            await using var sesion = sesiones.ParaTenant(enSesion.TenantId, mensajes);
            var stream = await sesion.Events.FetchForExclusiveWriting<EvaluacionDeProveedor>(id, ct);
            var evaluacion = Propia(stream.Aggregate, tercero, enSesion);
            await AsegurarVinculoNoBloqueadoAsync(sesion, vinculoId, ct);

            var actor = new ActorDeEvaluacion(ActorTipo.Tercero, tercero.TerceroId.ToString(), evaluacion.TerceroNombre);
            var eventos = evaluacion.Responder([.. dto.Respuestas.Select(r => r.ADominio())], await ProcesoDeEvaluaciones.ContextoAsync(sesion, evaluacion, ct), actor, ahora);
            var despues = await ProcesoDeEvaluaciones.GuardarAsync(sesion, stream, eventos, certificados, ahora, ct);
            await sesion.SaveChangesAsync(ct);
            return despues.APublica();
        });
    }

    /// <summary>Paso 1 de la subida de un archivo de evidencia de la autoevaluación (PDF o imagen de hasta 15 MB). 422 <c>adjunto-invalido</c>; 409 <c>evaluacion-no-pendiente</c>.</summary>
    [WolverinePut("/public/v1/vinculos/{vinculoId}/evaluaciones/{id}/adjuntos")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<CargaDeAdjuntoDto> IniciarAdjunto(Guid vinculoId, Guid id, IniciarAdjuntoDeEvaluacionDto dto, HttpContext http, ISesiones sesiones, IAlmacenDeArchivos almacen,
        ReglasDeCarga reglas, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        await using var sesion = sesiones.ParaTenant(enSesion.TenantId);
        var evaluacion = Propia(await sesion.LoadAsync<EvaluacionDeProveedor>(id, ct), tercero, enSesion);
        if (!evaluacion.EstaPendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", "La evaluación ya se envió: no recibe más archivos.");
        return await AdjuntosDeEvaluacion.IniciarAsync(enSesion.TenantId, dto, almacen, reglas, ct);
    }

    /// <summary>Paso 2: verifica el archivo y lo registra en la evaluación; se cita después en la respuesta de la pregunta de adjunto. 409 <c>archivo-no-cargado</c>; 422 <c>adjunto-invalido</c>.</summary>
    [WolverinePost("/public/v1/vinculos/{vinculoId}/evaluaciones/{id}/adjuntos/{cargaId}/confirmar")]
    [Authorize(Policy = ReclamosTercero.Politica)]
    public static async Task<AdjuntoDeEvaluacionDto> ConfirmarAdjunto(Guid vinculoId, Guid id, Guid cargaId, ConfirmarAdjuntoDeEvaluacionDto dto, HttpContext http, ISesiones sesiones,
        IAlmacenDeArchivos almacen, TimeProvider reloj, CancellationToken ct)
    {
        var (tercero, enSesion) = Sesion(http, vinculoId);
        await using var sesion = sesiones.ParaTenant(enSesion.TenantId);
        var stream = await sesion.Events.FetchForExclusiveWriting<EvaluacionDeProveedor>(id, ct);
        var evaluacion = Propia(stream.Aggregate, tercero, enSesion);
        if (!evaluacion.EstaPendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", "La evaluación ya se envió: no recibe más archivos.");

        var actor = new ActorDeEvaluacion(ActorTipo.Tercero, tercero.TerceroId.ToString(), evaluacion.TerceroNombre);
        var adjunto = await AdjuntosDeEvaluacion.ConfirmarAsync(enSesion.TenantId, enSesion.EmpresaId, id, cargaId, dto.NombreArchivo, actor, almacen, reloj.GetUtcNow(), ct);
        stream.AppendOne(evaluacion.RegistrarAdjunto(adjunto));
        await sesion.SaveChangesAsync(ct);
        return adjunto.ADto();
    }

    /// <summary>La sesión del tercero con alcance de relación y el vínculo de la ruta dentro de ella (404 si no es suyo; un token embebido solo trabaja con el vínculo para el que se emitió).</summary>
    private static (SesionDeTercero Tercero, VinculoEnSesion Vinculo) Sesion(HttpContext http, Guid vinculoId)
    {
        var tercero = SesionDeTercero.De(http.User, GrupoDeAcceso.Relacion);
        tercero.ExigirVinculoDelToken(vinculoId);
        return (tercero, tercero.VinculoRequerido(vinculoId));
    }

    /// <summary>La evaluación solo si es de este tercero, de este vínculo y la empresa de la sesión, y la responde el tercero; si no, 404 (no se revela que existe).</summary>
    private static EvaluacionDeProveedor Propia(EvaluacionDeProveedor? evaluacion, SesionDeTercero tercero, VinculoEnSesion enSesion) =>
        evaluacion is { Estado: not (EstadoDeEvaluacion.Anulada or EstadoDeEvaluacion.Vencida) } propia && propia.TerceroId == tercero.TerceroId &&
        propia.VinculoId == enSesion.VinculoId && propia.EmpresaId == enSesion.EmpresaId && propia.Definicion.Responde == QuienResponde.Tercero
            ? propia
            : throw ReglaDeNegocioException.NoEncontrado("evaluacion-no-encontrada", "No existe esa evaluación.");

    private static async Task AsegurarVinculoNoBloqueadoAsync(Marten.IDocumentSession sesion, Guid vinculoId, CancellationToken ct)
    {
        if (await sesion.LoadAsync<Dominio.Vinculos.Vinculo>(vinculoId, ct) is { Estado: Dominio.Vinculos.EstadoVinculo.Bloqueado })
            throw ReglaDeNegocioException.Conflicto("vinculo-bloqueado", "La empresa suspendió temporalmente esta validación.");
    }
}
