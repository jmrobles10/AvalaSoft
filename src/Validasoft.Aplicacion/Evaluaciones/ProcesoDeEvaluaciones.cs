using System.Text.Json;
using JasperFx.Events;
using Marten;
using Validasoft.Aplicacion.Certificados;
using Validasoft.Aplicacion.Expedientes;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Configuracion;
using Validasoft.Dominio.Evaluaciones;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Flujos;
using Validasoft.Dominio.Terceros;
using Validasoft.Dominio.Vinculos;

namespace Validasoft.Aplicacion.Evaluaciones;

/// <summary>Una evaluación que pide la versión del flujo, lista para abrir el expediente: lo que el expediente copia y el cuestionario ya congelado.</summary>
public sealed record EvaluacionPreparada(EvaluacionRequeridaPorElFlujo Requerida, CuestionarioDeLaEvaluacion Referencia, DefinicionDeCuestionario Definicion);

/// <summary>
/// Orquesta las evaluaciones del proveedor (CE-7, CE-8): las asigna al abrir el expediente inicial con la versión publicada del cuestionario, y cada vez que una
/// evaluación cambia de estado le dice al expediente <b>en la misma transacción</b>, de modo que una evaluación aprobada cierre el expediente que la esperaba (con
/// su vínculo y su certificado) sin esperar a nadie.
/// </summary>
public static class ProcesoDeEvaluaciones
{
    /// <summary>
    /// Los cuestionarios que pide la versión del flujo, resueltos a su versión publicada de ahora (esa es la que se congela en la evaluación). Un cuestionario que ya no
    /// existe o no tiene versión publicada se omite: el flujo se validó al publicarse, pero no se frena un expediente por algo que ya no se puede evaluar.
    /// </summary>
    public static async Task<IReadOnlyList<EvaluacionPreparada>> PrepararAsync(IDocumentSession sesion, Guid empresaId, FlujoVersion version, CancellationToken ct)
    {
        var preparadas = new List<EvaluacionPreparada>();
        foreach (var pedida in version.Evaluaciones)
        {
            var cuestionario = await sesion.LoadAsync<Cuestionario>(pedida.CuestionarioId, ct);
            if (cuestionario is null || cuestionario.EmpresaId != empresaId || cuestionario.VersionPublicada is not { } publicada)
                continue;
            var evaluacionId = Guid.CreateVersion7();
            preparadas.Add(new EvaluacionPreparada(
                new EvaluacionRequeridaPorElFlujo(evaluacionId, cuestionario.Id, publicada.Id, cuestionario.Codigo, cuestionario.Nombre, publicada.Definicion.Responde, pedida.Efecto),
                new CuestionarioDeLaEvaluacion(cuestionario.Id, publicada.Id, publicada.Version, cuestionario.Codigo, cuestionario.Nombre), publicada.Definicion));
        }

        return preparadas;
    }

    /// <summary>Abre el stream de cada evaluación preparada, ya con el id del expediente que acaba de abrirse.</summary>
    public static void Asignar(IDocumentSession sesion, IReadOnlyList<EvaluacionPreparada> preparadas, Vinculo vinculo, Tercero tercero, Guid expedienteId, DateTimeOffset ahora)
    {
        foreach (var p in preparadas)
            sesion.Events.StartStream<EvaluacionDeProveedor>(p.Requerida.EvaluacionId,
                EvaluacionDeProveedor.Asignar(vinculo.EmpresaId, vinculo.Id, expedienteId, tercero.Id, tercero.Nombre, tercero.Identificacion.Clave,
                    MotivoDeEvaluacion.Expediente, p.Referencia, p.Definicion, p.Requerida.Efecto, null, ahora, p.Requerida.EvaluacionId));
    }

    /// <summary>
    /// Lo que se necesita saber del tercero y del vínculo para decidir qué preguntas se muestran (condiciones sobre <c>tercero.*</c> y <c>vinculo.tipo</c>); las respuestas
    /// anteriores las pone la calculadora.
    /// </summary>
    public static async Task<ContextoDeExigencia> ContextoAsync(IDocumentSession sesion, EvaluacionDeProveedor evaluacion, CancellationToken ct)
    {
        var tercero = await sesion.LoadAsync<Tercero>(evaluacion.TerceroId, ct)
                      ?? throw ReglaDeNegocioException.NoEncontrado("tercero-no-encontrado", "El tercero de la evaluación no existe.");
        var vinculo = await sesion.LoadAsync<Vinculo>(evaluacion.VinculoId, ct);
        var tipo = vinculo is null ? null : await sesion.LoadAsync<TipoVinculo>(vinculo.TipoVinculoId, ct);
        return ContextoDeExigencia.De(tercero, tipo?.Codigo ?? string.Empty, vinculo?.Atributos);
    }

    /// <summary>
    /// Anexa los eventos de una decisión sobre la evaluación y, si la pidió un expediente que sigue abierto, le informa el estado nuevo en la misma transacción
    /// (una evaluación que bloqueaba y se aprueba cierra el expediente, con su certificado). Devuelve la evaluación ya al día, para armar la respuesta sin releer.
    /// </summary>
    public static async Task<EvaluacionDeProveedor> GuardarAsync(IDocumentSession sesion, IEventStream<EvaluacionDeProveedor> stream, IReadOnlyList<object> eventos,
        EmisorDeCertificados certificados, DateTimeOffset ahora, CancellationToken ct)
    {
        var despues = Reproducir(stream.Aggregate!, eventos);
        stream.AppendMany(eventos);
        await ActualizarExpedienteAsync(sesion, despues, certificados, ahora, ct);
        return despues;
    }

    /// <summary>Estado resultante de aplicar <paramref name="eventos"/> a una copia de <paramref name="actual"/>.</summary>
    public static EvaluacionDeProveedor Reproducir(EvaluacionDeProveedor actual, IEnumerable<object> eventos)
    {
        var copia = JsonSerializer.Deserialize<EvaluacionDeProveedor>(JsonSerializer.Serialize(actual))!;
        copia.Aplicar(eventos);
        return copia;
    }

    /// <summary>Dice al expediente el estado de la evaluación (nada si no tiene expediente, si ya se cerró o si no cambió) y propaga lo que su cierre produzca.</summary>
    public static async Task ActualizarExpedienteAsync(IDocumentSession sesion, EvaluacionDeProveedor evaluacion, EmisorDeCertificados certificados, DateTimeOffset ahora,
        CancellationToken ct)
    {
        if (evaluacion.ExpedienteId is not { } expedienteId)
            return;
        var stream = await sesion.Events.FetchForExclusiveWriting<Expediente>(expedienteId, ct);
        if (stream.Aggregate is not { } expediente || expediente.EmpresaId != evaluacion.EmpresaId)
            return;
        var eventos = expediente.ActualizarEvaluacion(evaluacion.Id, evaluacion.EstadoParaExpediente, evaluacion.Resultado?.Puntaje, ahora);
        if (eventos.Count > 0)
            await ProcesoDeValidacion.AnexarAsync(sesion, stream, eventos, null, certificados, ahora, ct);
    }

    /// <summary>
    /// Un expediente que se cierra sin aprobarse (rechazado o anulado) deja sin efecto las evaluaciones que aún esperaba: ya no hay a quién evaluar. Optimista, sin bloquear la
    /// evaluación (el expediente ya está bloqueado y quien responde bloquea primero la evaluación).
    /// </summary>
    public static async Task AnularPendientesDelExpedienteAsync(IDocumentSession sesion, Expediente expediente, DateTimeOffset ahora, CancellationToken ct)
    {
        foreach (var pendiente in expediente.Evaluaciones.Where(e => e.Estado == EstadoDeEvaluacionEnExpediente.Pendiente))
        {
            var stream = await sesion.Events.FetchForWriting<EvaluacionDeProveedor>(pendiente.EvaluacionId, ct);
            if (stream.Aggregate is not { Estado: EstadoDeEvaluacion.Pendiente } evaluacion || evaluacion.EmpresaId != expediente.EmpresaId)
                continue;
            stream.AppendOne(new EvaluacionAnulada("El expediente se cerró sin aprobarse.", new ActorDeEvaluacion(ActorTipo.Sistema, "sistema", "Sistema"), ahora));
        }
    }
}
