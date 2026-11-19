using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validalo.Aplicacion.Comun;
using Validalo.Contratos;
using Validalo.Dominio.Auditoria;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Evaluaciones;
using Validalo.Dominio.Expedientes;
using Validalo.Dominio.Flujos;
using Validalo.Dominio.Identidad;
using Validalo.Dominio.Terceros;
using Validalo.Dominio.Vinculos;
using Wolverine;
using Wolverine.Http;

namespace Validalo.Aplicacion.Evaluaciones;

/// <summary>
/// Evaluaciones de proveedores de la empresa activa (CE-3…CE-12): las que pidió el flujo al abrir el expediente inicial, las que repite la reevaluación periódica y las que una
/// persona asignó a mano. <b>Son privadas de la empresa</b>: otra empresa, del mismo grupo o de otro, recibe 404, y el tercero nunca ve el resultado. Quien responde es lo que
/// dice el cuestionario (<c>Tercero</c> en <c>/public/v1</c>, <c>Evaluador</c> aquí); cada respuesta, recalificación, reapertura o anulación se guarda como evento con su actor.
/// </summary>
public static class EvaluacionesEndpoints
{
    public const int MaximoPorPagina = 200;

    /// <summary>Lista las evaluaciones de la empresa, las más recientes primero, con los filtros opcionales (<c>estado</c>: Pendiente|Calificada|Vencida|Anulada; <c>responde</c>: Tercero|Evaluador).</summary>
    [WolverineGet("/api/v1/evaluaciones")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<PaginaDto<EvaluacionResumenDto>> Listar(SesionDeEmpresa empresa, Guid? vinculoId, Guid? expedienteId, Guid? cuestionarioId, string? estado,
        string? responde, int? limite, string? cursor, CancellationToken ct)
    {
        var tamano = Math.Clamp(limite ?? 50, 1, MaximoPorPagina);
        var desde = Peticiones.LeerDesplazamiento(cursor);
        var consulta = empresa.Evaluaciones();
        if (vinculoId is { } vinculo)
            consulta = consulta.Where(e => e.VinculoId == vinculo);
        if (expedienteId is { } expediente)
            consulta = consulta.Where(e => e.ExpedienteId == expediente);
        if (cuestionarioId is { } cuestionario)
            consulta = consulta.Where(e => e.Cuestionario.Id == cuestionario);
        if (!string.IsNullOrWhiteSpace(estado))
        {
            var buscado = Leer<EstadoDeEvaluacion>(estado, "estado-invalido", "El estado de una evaluación");
            consulta = consulta.Where(e => e.Estado == buscado);
        }

        if (!string.IsNullOrWhiteSpace(responde))
        {
            var quien = Leer<QuienResponde>(responde, "responde-invalido", "Quién responde");
            consulta = consulta.Where(e => e.Definicion.Responde == quien);
        }

        var pagina = await consulta.OrderByDescending(e => e.AsignadaEn).ThenBy(e => e.Id).Skip(desde).Take(tamano + 1).ToListAsync(ct);
        var folios = await FoliosAsync(empresa, pagina, ct);
        return new PaginaDto<EvaluacionResumenDto>([.. pagina.Take(tamano).Select(e => e.Resumen(Folio(folios, e)))],
            pagina.Count > tamano ? Peticiones.EscribirDesplazamiento(desde + tamano) : null);
    }

    [WolverineGet("/api/v1/evaluaciones/{id}")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<EvaluacionDto> Obtener(Guid id, SesionDeEmpresa empresa, CancellationToken ct) =>
        await DtoAsync(empresa, await empresa.CargarEvaluacionAsync(id, ct), ct);

    /// <summary>
    /// Asigna a mano un cuestionario publicado a un vínculo (por ejemplo, para evaluar a un proveedor que ya existía). Sin expediente al que frenar, su efecto es <c>Observar</c>.
    /// 409 <c>estado-terminal</c> (vínculo anulado o desvinculado), <c>evaluacion-pendiente</c> (ya hay una sin responder de ese cuestionario); 422 <c>cuestionario-sin-publicar</c>.
    /// </summary>
    [WolverinePost("/api/v1/vinculos/{vinculoId}/evaluaciones")]
    [Authorize(Policy = Permisos.VinculosEscribir)]
    public static async Task<IResult> Asignar(Guid vinculoId, AsignarEvaluacionDto dto, SesionDeEmpresa empresa, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var vinculo = await empresa.CargarVinculoAsync(vinculoId, ct);
        if (vinculo.Estado is EstadoVinculo.Anulado or EstadoVinculo.Desvinculado)
            throw ReglaDeNegocioException.Conflicto("estado-terminal", $"El vínculo está {vinculo.Estado}: no se le asignan evaluaciones.");
        var cuestionario = await empresa.CargarCuestionarioAsync(dto.CuestionarioId, ct);
        var publicada = cuestionario.VersionPublicada
                        ?? throw ReglaDeNegocioException.Validacion("cuestionario-sin-publicar", $"Publica el cuestionario {cuestionario.Codigo} antes de asignarlo.");
        var cuestionarioId = cuestionario.Id;
        if (await empresa.Evaluaciones().AnyAsync(e => e.VinculoId == vinculoId && e.Cuestionario.Id == cuestionarioId && e.Estado == EstadoDeEvaluacion.Pendiente, ct))
            throw ReglaDeNegocioException.Conflicto("evaluacion-pendiente", "El vínculo ya tiene una evaluación sin responder de ese cuestionario.");

        var tercero = await empresa.Sesion.LoadAsync<Tercero>(vinculo.TerceroId, ct)
                      ?? throw ReglaDeNegocioException.NoEncontrado("tercero-no-encontrado", "El tercero del vínculo no existe.");
        var evento = EvaluacionDeProveedor.Asignar(empresa.EmpresaId, vinculo.Id, null, tercero.Id, tercero.Nombre, tercero.Identificacion.Clave, MotivoDeEvaluacion.Manual,
            new CuestionarioDeLaEvaluacion(cuestionario.Id, publicada.Id, publicada.Version, cuestionario.Codigo, cuestionario.Nombre), publicada.Definicion,
            EfectoDeLaEvaluacion.Observar, null, ahora);
        empresa.Sesion.Events.StartStream<EvaluacionDeProveedor>(evento.EvaluacionId, evento);
        await empresa.Sesion.SaveChangesAsync(ct);
        return Results.Created($"/api/v1/evaluaciones/{evento.EvaluacionId}", EvaluacionDeProveedor.Create(evento).ADto());
    }

    /// <summary>
    /// Qué secciones y preguntas se muestran con las respuestas que hay hasta ahora (las condiciones de visibilidad con las respuestas anteriores y los datos del tercero), sin guardar nada.
    /// Es lo que consulta la pantalla mientras se responde.
    /// </summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/visibilidad")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<VisibilidadDto> Visibilidad(Guid id, ResponderEvaluacionDto dto, SesionDeEmpresa empresa, CancellationToken ct)
    {
        var evaluacion = await empresa.CargarEvaluacionAsync(id, ct);
        return VisibilidadDe(evaluacion, dto, await ProcesoDeEvaluaciones.ContextoAsync(empresa.Sesion, evaluacion, ct));
    }

    /// <summary>
    /// Responde como evaluador interno (solo una persona de la empresa con <c>evaluaciones:responder</c>, no una llave sin usuario delegado) y califica. El expediente que la esperaba se
    /// entera en la misma transacción: si era lo último que lo frenaba, se aprueba. 403 <c>responde-otro</c> (el cuestionario lo responde el tercero), <c>conflicto-de-intereses</c>;
    /// 409 <c>evaluacion-no-pendiente</c>; 422 <c>pregunta-obligatoria</c>, <c>respuesta-invalida</c>, <c>pregunta-no-visible</c>, <c>adjunto-invalido</c>…
    /// </summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/responder")]
    [Authorize(Policy = Permisos.EvaluacionesResponder)]
    public static async Task<EvaluacionDto> Responder(Guid id, ResponderEvaluacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes,
        TimeProvider reloj, CancellationToken ct)
    {
        empresa.UsarMensajeria(mensajes);
        return await empresa.ReintentarAnteCarreraAsync(async () =>
        {
            var ahora = reloj.GetUtcNow();
            var stream = await empresa.EvaluacionParaEscribirAsync(id, ct);
            var evaluacion = stream.Aggregate!;
            var persona = await PersonaAsync(empresa, contexto, ct);
            if (!string.IsNullOrWhiteSpace(persona.Clave) && persona.Clave == evaluacion.TerceroIdentificacion)
                throw ReglaDeNegocioException.Prohibido("conflicto-de-intereses", "Tu identificación coincide con la del tercero: no puedes evaluarlo.");

            var eventos = evaluacion.Responder([.. dto.Respuestas.Select(r => r.ADominio())], await ProcesoDeEvaluaciones.ContextoAsync(empresa.Sesion, evaluacion, ct),
                persona.Actor, ahora);
            var despues = await ProcesoDeEvaluaciones.GuardarAsync(empresa.Sesion, stream, eventos, empresa.Certificados, ahora, ct);
            await empresa.Sesion.SaveChangesAsync(ct);
            return await DtoAsync(empresa, despues, ct);
        });
    }

    /// <summary>
    /// Recalifica con justificación (obligatoria): ajusta el puntaje de preguntas, levanta eliminatorias y/o fija el veredicto a mano. Deja una calificación nueva en el historial; la
    /// anterior no se borra. Si el veredicto cambia, el expediente que la esperaba se entera en la misma transacción. 409 <c>evaluacion-no-calificada</c>; 422
    /// <c>justificacion-requerida</c>, <c>sin-cambios</c>, <c>ajuste-invalido</c>, <c>pregunta-desconocida</c>.
    /// </summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/recalificar")]
    [Authorize(Policy = Permisos.EvaluacionesRecalificar)]
    public static async Task<EvaluacionDto> Recalificar(Guid id, RecalificarEvaluacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes,
        TimeProvider reloj, CancellationToken ct) =>
        await DecidirAsync(id, empresa, contexto, mensajes, reloj, ct, (e, actor, ahora) =>
            e.Recalificar([.. (dto.Ajustes ?? []).Select(a => a.ADominio())], dto.Aprobada, dto.Justificacion, actor, ahora));

    /// <summary>Devuelve la evaluación a pendiente para que se responda de nuevo (el resultado anterior queda en el historial). 409 <c>evaluacion-no-calificada</c>; 422 <c>justificacion-requerida</c>.</summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/reabrir")]
    [Authorize(Policy = Permisos.EvaluacionesRecalificar)]
    public static async Task<EvaluacionDto> Reabrir(Guid id, JustificacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes, TimeProvider reloj,
        CancellationToken ct) =>
        await DecidirAsync(id, empresa, contexto, mensajes, reloj, ct, (e, actor, ahora) => e.Reabrir(dto.Justificacion, actor, ahora));

    /// <summary>Anula la evaluación (el expediente deja de esperarla). 409 <c>evaluacion-cerrada</c>; 422 <c>justificacion-requerida</c>.</summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/anular")]
    [Authorize(Policy = Permisos.EvaluacionesRecalificar)]
    public static async Task<EvaluacionDto> Anular(Guid id, JustificacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes, TimeProvider reloj,
        CancellationToken ct) =>
        await DecidirAsync(id, empresa, contexto, mensajes, reloj, ct, (e, actor, ahora) => e.Anular(dto.Justificacion, actor, ahora));

    // ---------- Archivos de evidencia ----------

    /// <summary>Paso 1 de la subida de un archivo de evidencia (PDF o imagen de hasta 15 MB). 422 <c>adjunto-invalido</c>; 409 <c>evaluacion-no-pendiente</c>.</summary>
    [WolverinePut("/api/v1/evaluaciones/{id}/adjuntos")]
    [Authorize(Policy = Permisos.EvaluacionesResponder)]
    public static async Task<CargaDeAdjuntoDto> IniciarAdjunto(Guid id, IniciarAdjuntoDeEvaluacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto,
        IAlmacenDeArchivos almacen, ReglasDeCarga reglas, CancellationToken ct)
    {
        var evaluacion = await empresa.CargarEvaluacionAsync(id, ct);
        if (!evaluacion.EstaPendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", $"La evaluación está {evaluacion.Estado}: ya no recibe archivos.");
        return await AdjuntosDeEvaluacion.IniciarAsync(contexto.TenantRequerido(), dto, almacen, reglas, ct);
    }

    /// <summary>Paso 2: verifica el archivo y lo registra en la evaluación; se cita después en la respuesta de una pregunta de adjunto. 409 <c>archivo-no-cargado</c>; 422 <c>adjunto-invalido</c>.</summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/adjuntos/{cargaId}/confirmar")]
    [Authorize(Policy = Permisos.EvaluacionesResponder)]
    public static async Task<AdjuntoDeEvaluacionDto> ConfirmarAdjunto(Guid id, Guid cargaId, ConfirmarAdjuntoDeEvaluacionDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto,
        IAlmacenDeArchivos almacen, TimeProvider reloj, CancellationToken ct)
    {
        var persona = await PersonaAsync(empresa, contexto, ct);
        var stream = await empresa.EvaluacionParaEscribirAsync(id, ct);
        var evaluacion = stream.Aggregate!;
        if (!evaluacion.EstaPendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", $"La evaluación está {evaluacion.Estado}: ya no recibe archivos.");

        var adjunto = await AdjuntosDeEvaluacion.ConfirmarAsync(contexto.TenantRequerido(), empresa.EmpresaId, id, cargaId, dto.NombreArchivo, persona.Actor, almacen, reloj.GetUtcNow(), ct);
        stream.AppendOne(evaluacion.RegistrarAdjunto(adjunto));
        await empresa.Sesion.SaveChangesAsync(ct);
        return adjunto.ADto();
    }

    /// <summary>URL prefirmada (5 min) de un archivo de evidencia; la descarga queda en la auditoría. 404 <c>adjunto-no-encontrado</c>.</summary>
    [WolverinePost("/api/v1/evaluaciones/{id}/adjuntos/{adjuntoId}/descarga")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<DescargaEvidenciaDto> DescargarAdjunto(Guid id, Guid adjuntoId, SesionDeEmpresa empresa, IContextoSolicitud contexto, IAlmacenDeArchivos almacen,
        ReglasDeCarga reglas, TimeProvider reloj, CancellationToken ct)
    {
        var evaluacion = await empresa.CargarEvaluacionAsync(id, ct);
        var adjunto = evaluacion.BuscarAdjunto(adjuntoId)
                      ?? throw ReglaDeNegocioException.NoEncontrado("adjunto-no-encontrado", "Ese archivo no está en la evaluación.");
        Auditoria.Registrar(empresa.Sesion, contexto, "AdjuntoDeEvaluacion", $"{id}/{adjuntoId}", AccionConfiguracion.Modificado, null, new { Descargado = adjunto.Nombre },
            reloj.GetUtcNow(), empresa.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        var url = await almacen.UrlDeDescargaAsync(adjunto.Bucket, adjunto.Clave, adjunto.Nombre, adjunto.TipoContenido, reglas.VigenciaDescarga, ct);
        return new DescargaEvidenciaDto(url.Url, url.Expira, adjunto.Nombre);
    }

    // ---------- Apoyos ----------

    /// <summary>Corre una decisión sobre la evaluación (recalificar, reabrir o anular) con su bloqueo, el expediente al día en la misma transacción y reintento ante una carrera.</summary>
    private static async Task<EvaluacionDto> DecidirAsync(Guid id, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes, TimeProvider reloj,
        CancellationToken ct, Func<EvaluacionDeProveedor, ActorDeEvaluacion, DateTimeOffset, IReadOnlyList<object>> decision)
    {
        empresa.UsarMensajeria(mensajes);
        return await empresa.ReintentarAnteCarreraAsync(async () =>
        {
            var ahora = reloj.GetUtcNow();
            var stream = await empresa.EvaluacionParaEscribirAsync(id, ct);
            var actor = (await PersonaAsync(empresa, contexto, ct, exigirPersona: false)).Actor;
            var eventos = decision(stream.Aggregate!, actor, ahora);
            var despues = await ProcesoDeEvaluaciones.GuardarAsync(empresa.Sesion, stream, eventos, empresa.Certificados, ahora, ct);
            await empresa.Sesion.SaveChangesAsync(ct);
            return await DtoAsync(empresa, despues, ct);
        });
    }

    /// <summary>
    /// Quién actúa: con <paramref name="exigirPersona"/>, una persona activa con rol en la empresa (con su identificación, para el conflicto de intereses); si no, también una
    /// integración (su sistema o credencial). 422 <c>usuario-delegado-requerido</c>; 403 <c>usuario-sin-rol</c>.
    /// </summary>
    internal static async Task<(ActorDeEvaluacion Actor, string? Clave)> PersonaAsync(SesionDeEmpresa empresa, IContextoSolicitud contexto, CancellationToken ct,
        bool exigirPersona = true)
    {
        if (contexto.ActorTipo != ActorTipo.Usuario || !Guid.TryParse(contexto.ActorId, out var usuarioId))
        {
            if (exigirPersona)
                throw ReglaDeNegocioException.Validacion("usuario-delegado-requerido",
                    "Evaluar lo hace una persona: actúa con la identidad delegada (X-Usuario-Delegado) o con su sesión.");
            return (new ActorDeEvaluacion(contexto.ActorTipo, contexto.ActorId, contexto.Sistema is { } sistema ? $"Sistema integrado {sistema}" : "Credencial de API"), null);
        }

        var usuario = await empresa.Sesion.LoadAsync<Usuario>(usuarioId, ct);
        if (usuario is not { Activo: true } || !usuario.TieneRolEn(empresa.EmpresaId))
            throw ReglaDeNegocioException.Prohibido("usuario-sin-rol", "No tienes un rol activo en esta empresa.");
        return (new ActorDeEvaluacion(ActorTipo.Usuario, usuarioId.ToString(), usuario.Nombre), usuario.Identificacion?.Clave);
    }

    internal static VisibilidadDto VisibilidadDe(EvaluacionDeProveedor evaluacion, ResponderEvaluacionDto dto, ContextoDeExigencia contexto)
    {
        var (preguntas, secciones) = CalculadoraDePuntaje.Visibles(evaluacion.Definicion, [.. dto.Respuestas.Select(r => r.ADominio())], contexto);
        return new VisibilidadDto(preguntas, secciones);
    }

    internal static async Task<EvaluacionDto> DtoAsync(SesionDeEmpresa empresa, EvaluacionDeProveedor evaluacion, CancellationToken ct)
    {
        var folio = evaluacion.ExpedienteId is { } id ? (await empresa.Sesion.LoadAsync<Expediente>(id, ct))?.Folio : null;
        return evaluacion.ADto(folio);
    }

    /// <summary>Folio del expediente de cada evaluación (una sola lectura por página).</summary>
    internal static async Task<IReadOnlyDictionary<Guid, string>> FoliosAsync(SesionDeEmpresa empresa, IEnumerable<EvaluacionDeProveedor> evaluaciones, CancellationToken ct)
    {
        var ids = evaluaciones.Where(e => e.ExpedienteId is not null).Select(e => e.ExpedienteId!.Value).Distinct().ToArray();
        if (ids.Length == 0)
            return new Dictionary<Guid, string>();
        return (await empresa.Sesion.LoadManyAsync<Expediente>(ct, ids)).Where(e => e.EmpresaId == empresa.EmpresaId).ToDictionary(e => e.Id, e => e.Folio);
    }

    internal static string? Folio(IReadOnlyDictionary<Guid, string> folios, EvaluacionDeProveedor e) =>
        e.ExpedienteId is { } id && folios.TryGetValue(id, out var folio) ? folio : null;

    internal static T Leer<T>(string valor, string codigo, string nombre) where T : struct, Enum =>
        Enum.TryParse<T>(valor, true, out var resultado) && Enum.IsDefined(resultado)
            ? resultado
            : throw ReglaDeNegocioException.Validacion(codigo, $"{nombre} es {string.Join(", ", Enum.GetNames<T>())}.");
}
