using System.Text.Json.Serialization;
using Validasoft.Dominio.Evaluaciones;

namespace Validasoft.Dominio.Expedientes;

/// <summary>Estado de una evaluación tal como lo ve el expediente (CE-8): sin responder, aprobada, reprobada o anulada (una persona de la empresa la dejó sin efecto).</summary>
public enum EstadoDeEvaluacionEnExpediente
{
    Pendiente,
    Aprobada,
    Reprobada,
    Anulada
}

/// <summary>Evaluación que el flujo pidió para este expediente, con la versión del cuestionario ya congelada en su evaluación (<see cref="EvaluacionId"/>).</summary>
public sealed record EvaluacionRequeridaPorElFlujo(Guid EvaluacionId, Guid CuestionarioId, Guid VersionId, string Codigo, string Nombre, QuienResponde Responde,
    EfectoDeLaEvaluacion Efecto);

// Eventos del stream Expediente-{id} (CE-8). Actor, sistema y correlación viajan en los metadatos.

/// <summary>La versión del flujo pide evaluaciones al abrir el expediente inicial: cada una es un stream <c>EvaluacionDeProveedor</c> asignado en la misma transacción.</summary>
public sealed record EvaluacionesRequeridas(IReadOnlyList<EvaluacionRequeridaPorElFlujo> Evaluaciones, DateTimeOffset Fecha);

/// <summary>Una evaluación cambió de estado (se respondió, se recalificó, se reabrió o se anuló): lo que el expediente necesita saber para cerrar. El detalle vive en la evaluación.</summary>
public sealed record EvaluacionDelExpedienteActualizada(Guid EvaluacionId, EstadoDeEvaluacionEnExpediente Estado, decimal? Puntaje, DateTimeOffset Fecha);

/// <summary>Resumen de una evaluación en el expediente: su estado y puntaje (el detalle, las respuestas y el historial viven en la evaluación, que es privada de la empresa).</summary>
public sealed class EvaluacionDeExpediente
{
    public Guid EvaluacionId { get; set; }

    public Guid CuestionarioId { get; set; }

    public Guid VersionId { get; set; }

    public string Codigo { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public QuienResponde Responde { get; set; }

    public EfectoDeLaEvaluacion Efecto { get; set; }

    public EstadoDeEvaluacionEnExpediente Estado { get; set; }

    public decimal? Puntaje { get; set; }

    public DateTimeOffset? ActualizadaEn { get; set; }

    /// <summary>Cuenta para el cierre: solo una evaluación que bloquea y aún no está aprobada ni anulada lo frena.</summary>
    [JsonIgnore]
    public bool Frena => Efecto == EfectoDeLaEvaluacion.Bloquear && Estado is EstadoDeEvaluacionEnExpediente.Pendiente or EstadoDeEvaluacionEnExpediente.Reprobada;

    /// <summary>Reprobada con efecto «observar»: no frena, pero queda a la vista.</summary>
    [JsonIgnore]
    public bool Observada => Efecto == EfectoDeLaEvaluacion.Observar && Estado == EstadoDeEvaluacionEnExpediente.Reprobada;
}

/// <summary>
/// Evaluaciones del expediente (CE-8). El flujo dice qué cuestionarios pide; <b>el expediente no se aprueba mientras una evaluación que bloquea no esté aprobada</b>
/// (o anulada por una persona con justificación), aunque todas las áreas hayan aprobado: queda <c>EnRevision</c> con todas sus etapas aprobadas
/// (<see cref="EsperandoEvaluaciones"/>) y se cierra en cuanto la última se aprueba, por la misma cascada que las verificaciones y la cuenta designada.
/// Una evaluación con efecto «observar» nunca frena el cierre. Solo el expediente <c>Inicial</c> las pide: la reevaluación periódica asigna las suyas.
/// </summary>
public sealed partial class Expediente
{
    public List<EvaluacionDeExpediente> Evaluaciones { get; set; } = [];

    /// <summary>Ninguna evaluación frena el cierre.</summary>
    [JsonIgnore]
    public bool EvaluacionesSatisfechas => Evaluaciones.All(e => !e.Frena);

    /// <summary>Todas las áreas aprobaron y lo que impide cerrar (también) es una evaluación que bloquea.</summary>
    [JsonIgnore]
    public bool EsperandoEvaluaciones => EsperandoVerificaciones && !EvaluacionesSatisfechas;

    /// <summary>
    /// Todas las áreas aprobaron y <b>solo</b> falta una evaluación: las verificaciones bloqueantes y la cuenta designada, si las hay, ya están satisfechas. Con esto la pantalla de la
    /// empresa no dice «falta cumplimiento» cuando lo que falta es una evaluación.
    /// </summary>
    [JsonIgnore]
    public bool EsperandoSoloLasEvaluaciones =>
        EsperandoEvaluaciones && CuentaDesignadaSatisfecha && Verificaciones.Where(v => v.Bloqueante).All(v => v.Estado == EstadoVerificacion.Satisfecha);

    /// <summary>Hay una evaluación reprobada con efecto «observar» (a la vista, sin frenar).</summary>
    [JsonIgnore]
    public bool ConEvaluacionObservada => Evaluaciones.Any(e => e.Observada);

    public EvaluacionDeExpediente? BuscarEvaluacion(Guid evaluacionId) => Evaluaciones.FirstOrDefault(e => e.EvaluacionId == evaluacionId);

    /// <summary>
    /// Registra el estado que dejó una evaluación (respondida, recalificada, reabierta o anulada) y vuelve a evaluar el cierre: con todas las áreas aprobadas y
    /// nada más pendiente, un cambio que desbloquea aprueba el expediente en el acto. Idempotente: un expediente cerrado, una evaluación que no pidió o un estado
    /// que ya tenía no producen eventos (la evaluación es suya; el expediente nunca falla por ella).
    /// </summary>
    public IReadOnlyList<object> ActualizarEvaluacion(Guid evaluacionId, EstadoDeEvaluacionEnExpediente estado, decimal? puntaje, DateTimeOffset ahora) =>
        EstaAbierto && BuscarEvaluacion(evaluacionId) is { } actual && (actual.Estado != estado || actual.Puntaje != puntaje)
            ? Simular(s => s.Emitir(new EvaluacionDelExpedienteActualizada(evaluacionId, estado, puntaje, ahora)), ahora)
            : [];

    // ---------- Evolución ----------

    public void Apply(EvaluacionesRequeridas e)
    {
        Evaluaciones =
        [
            .. e.Evaluaciones.Select(r => new EvaluacionDeExpediente
            {
                EvaluacionId = r.EvaluacionId, CuestionarioId = r.CuestionarioId, VersionId = r.VersionId, Codigo = r.Codigo, Nombre = r.Nombre,
                Responde = r.Responde, Efecto = r.Efecto, Estado = EstadoDeEvaluacionEnExpediente.Pendiente
            })
        ];
        ActualizadoEn = e.Fecha;
    }

    public void Apply(EvaluacionDelExpedienteActualizada e)
    {
        if (BuscarEvaluacion(e.EvaluacionId) is not { } evaluacion)
            return;
        evaluacion.Estado = e.Estado;
        evaluacion.Puntaje = e.Puntaje;
        evaluacion.ActualizadaEn = e.Fecha;
        ActualizadoEn = e.Fecha;
    }
}
