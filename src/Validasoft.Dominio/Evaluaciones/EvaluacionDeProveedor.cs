using System.Text.Json.Serialization;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Flujos;

namespace Validasoft.Dominio.Evaluaciones;

public enum EstadoDeEvaluacion
{
    /// <summary>Asignada y sin responder.</summary>
    Pendiente,

    /// <summary>Respondida y calificada (inmutable salvo recalificar o reabrir, con justificación).</summary>
    Calificada,

    /// <summary>Pasó su vigencia (reevaluación periódica, CE-11): ya no cuenta; la reemplaza una evaluación nueva.</summary>
    Vencida,

    Anulada
}

/// <summary>Por qué existe la evaluación: la pide el flujo al abrir el expediente inicial, la repite el barrido de reevaluación o la asignó una persona a mano.</summary>
public enum MotivoDeEvaluacion
{
    Expediente,
    Reevaluacion,
    Manual
}

/// <summary>Versión del cuestionario con la que se evalúa (la publicada al asignar, copiada entera en <see cref="EvaluacionAsignada.Definicion"/>).</summary>
public sealed record CuestionarioDeLaEvaluacion(Guid Id, Guid VersionId, int Version, string Codigo, string Nombre);

/// <summary>Quién respondió o recalificó: un usuario de la empresa o el tercero. <see cref="Nombre"/> es el de ese momento.</summary>
public sealed record ActorDeEvaluacion(ActorTipo Tipo, string Id, string? Nombre = null);

/// <summary>Archivo de evidencia que se subió a la evaluación para responder una pregunta de tipo adjunto (bucket del tenant, privado de la empresa).</summary>
public sealed record AdjuntoDeEvaluacion(Guid Id, string Nombre, string TipoContenido, long Tamano, string Sha256, string Bucket, string Clave, ActorDeEvaluacion SubidoPor,
    DateTimeOffset Fecha);

// Eventos del stream EvaluacionDeProveedor-{id} (tenant de la empresa). Actor, sistema y correlación viajan además en los metadatos.

/// <summary>Se asignó la evaluación: copia el cuestionario (versión congelada) y el efecto con el que se pidió. <see cref="Anterior"/>: la evaluación vencida que esta reemplaza.</summary>
public sealed record EvaluacionAsignada(
    Guid EvaluacionId, Guid EmpresaId, Guid VinculoId, Guid? ExpedienteId, Guid TerceroId, string TerceroNombre, string TerceroIdentificacion,
    MotivoDeEvaluacion Motivo, CuestionarioDeLaEvaluacion Cuestionario, DefinicionDeCuestionario Definicion, EfectoDeLaEvaluacion Efecto, Guid? Anterior,
    DateTimeOffset Fecha);

public sealed record AdjuntoDeEvaluacionSubido(AdjuntoDeEvaluacion Adjunto);

/// <summary>Respondida y calificada: las respuestas, la primera fase del cálculo (para recalificar) y el resultado. <see cref="VigenteHasta"/>: hasta cuándo vale si se repite.</summary>
public sealed record EvaluacionRespondida(IReadOnlyList<RespuestaDePregunta> Respuestas, IReadOnlyList<PreguntaEvaluada> Evaluadas, ResultadoDeEvaluacion Resultado,
    ActorDeEvaluacion Por, DateTimeOffset? VigenteHasta, DateTimeOffset Fecha);

/// <summary>Un revisor recalificó con justificación: el conjunto completo de ajustes (reemplaza al anterior), el veredicto fijado a mano si lo hubo y el resultado nuevo.</summary>
public sealed record EvaluacionRecalificada(IReadOnlyList<AjusteDeCalificacion> Ajustes, bool? VeredictoManual, ResultadoDeEvaluacion Resultado, string Justificacion,
    ActorDeEvaluacion Por, DateTimeOffset? VigenteHasta, DateTimeOffset Fecha);

/// <summary>Se devolvió a pendiente para que se responda de nuevo (el resultado anterior queda en el historial).</summary>
public sealed record EvaluacionReabierta(string Justificacion, ActorDeEvaluacion Por, DateTimeOffset Fecha);

public sealed record EvaluacionAnulada(string Justificacion, ActorDeEvaluacion Por, DateTimeOffset Fecha);

/// <summary>Pasó su vigencia: el barrido de reevaluación la marca y asigna una nueva (CE-11).</summary>
public sealed record EvaluacionVencida(DateTimeOffset Fecha);

/// <summary>Una calificación del historial: la primera (<c>Respuesta</c>) o una recalificación.</summary>
public sealed class CalificacionRegistrada
{
    public int Numero { get; set; }

    /// <summary><c>Respuesta</c> (la calificación al responder) o <c>Recalificacion</c>.</summary>
    public string Origen { get; set; } = "Respuesta";

    public ResultadoDeEvaluacion Resultado { get; set; } = null!;

    public string? Justificacion { get; set; }

    public ActorDeEvaluacion Por { get; set; } = null!;

    public DateTimeOffset Fecha { get; set; }
}

/// <summary>
/// Evaluación de un proveedor con un cuestionario (CE-3…CE-12, docs/03 §12.2). Event-sourced, un stream por evaluación: lo que se respondió, el puntaje por
/// sección y total, si aprobó, quién y cuándo, y cada recalificación con su justificación, sin borrar nada. Es <b>privada de la empresa</b> (aislada por
/// <see cref="EmpresaId"/>, también dentro de un grupo) y no se comparte como la bóveda. Copia el cuestionario al asignarse: lo que se publique después no
/// la cambia.
/// </summary>
public sealed class EvaluacionDeProveedor
{
    public const int LongitudMaximaJustificacion = 1000;
    public const int MaximoDeAjustes = 200;

    public Guid Id { get; set; }

    public long Version { get; set; }

    public Guid EmpresaId { get; set; }

    public Guid VinculoId { get; set; }

    public Guid? ExpedienteId { get; set; }

    public Guid TerceroId { get; set; }

    public string TerceroNombre { get; set; } = string.Empty;

    public string TerceroIdentificacion { get; set; } = string.Empty;

    public MotivoDeEvaluacion Motivo { get; set; }

    public CuestionarioDeLaEvaluacion Cuestionario { get; set; } = new(Guid.Empty, Guid.Empty, 0, string.Empty, string.Empty);

    public DefinicionDeCuestionario Definicion { get; set; } = new([], 70, QuienResponde.Tercero);

    public EfectoDeLaEvaluacion Efecto { get; set; }

    /// <summary>La evaluación vencida que esta reemplaza (reevaluación periódica).</summary>
    public Guid? Anterior { get; set; }

    public EstadoDeEvaluacion Estado { get; set; }

    public DateTimeOffset AsignadaEn { get; set; }

    public DateTimeOffset ActualizadaEn { get; set; }

    public List<RespuestaDePregunta> Respuestas { get; set; } = [];

    /// <summary>Primera fase del cálculo con las respuestas vigentes (base de las recalificaciones).</summary>
    public List<PreguntaEvaluada> Evaluadas { get; set; } = [];

    /// <summary>Ajustes vigentes de la última recalificación (vacío si nunca se recalificó).</summary>
    public List<AjusteDeCalificacion> Ajustes { get; set; } = [];

    /// <summary>Resultado vigente (el de la última calificación); nulo mientras está pendiente.</summary>
    public ResultadoDeEvaluacion? Resultado { get; set; }

    public List<CalificacionRegistrada> Calificaciones { get; set; } = [];

    public ActorDeEvaluacion? RespondidaPor { get; set; }

    public DateTimeOffset? RespondidaEn { get; set; }

    public List<AdjuntoDeEvaluacion> Adjuntos { get; set; } = [];

    /// <summary>Cuántas veces se respondió (se suma al reabrir).</summary>
    public int Intentos { get; set; }

    public int Recalificaciones { get; set; }

    /// <summary>Hasta cuándo vale lo calificado si el cuestionario se repite; nulo si no se repite o reprobó.</summary>
    public DateTimeOffset? VigenteHasta { get; set; }

    /// <summary>Cuándo debe correr el barrido de reevaluación (indexado): solo una evaluación calificada y aprobada con vigencia lleva valor.</summary>
    public DateTimeOffset? ProximaReevaluacion { get; set; }

    public string? Justificacion { get; set; }

    [JsonIgnore]
    public bool EstaPendiente => Estado == EstadoDeEvaluacion.Pendiente;

    /// <summary>Estado que ve el expediente: pendiente, aprobada o reprobada según el resultado vigente; anulada si se anuló.</summary>
    [JsonIgnore]
    public Expedientes.EstadoDeEvaluacionEnExpediente EstadoParaExpediente => Estado switch
    {
        EstadoDeEvaluacion.Anulada => Expedientes.EstadoDeEvaluacionEnExpediente.Anulada,
        EstadoDeEvaluacion.Pendiente => Expedientes.EstadoDeEvaluacionEnExpediente.Pendiente,
        _ => Resultado is { Aprobada: true } ? Expedientes.EstadoDeEvaluacionEnExpediente.Aprobada : Expedientes.EstadoDeEvaluacionEnExpediente.Reprobada
    };

    // ---------- Decisiones ----------

    /// <summary>Asigna la evaluación con la versión del cuestionario ya resuelta (422 <c>cuestionario-invalido</c> si no tiene preguntas).</summary>
    public static EvaluacionAsignada Asignar(Guid empresaId, Guid vinculoId, Guid? expedienteId, Guid terceroId, string terceroNombre, string terceroIdentificacion,
        MotivoDeEvaluacion motivo, CuestionarioDeLaEvaluacion cuestionario, DefinicionDeCuestionario definicion, EfectoDeLaEvaluacion efecto, Guid? anterior,
        DateTimeOffset ahora, Guid? evaluacionId = null)
    {
        if (definicion.Secciones.Count == 0)
            throw ReglaDeNegocioException.Validacion("cuestionario-invalido", "La versión del cuestionario no tiene preguntas.");
        return new EvaluacionAsignada(evaluacionId ?? Guid.CreateVersion7(), empresaId, vinculoId, expedienteId, terceroId, terceroNombre, terceroIdentificacion, motivo, cuestionario,
            definicion, efecto, anterior, ahora);
    }

    /// <summary>
    /// Registra la respuesta de quien corresponde (<see cref="QuienResponde"/> del cuestionario: <c>Tercero</c> solo el tercero, <c>Evaluador</c> solo una persona de la
    /// empresa) y la califica. 409 <c>evaluacion-no-pendiente</c>; 403 <c>responde-otro</c>; 422 los de <see cref="CalculadoraDePuntaje.Evaluar"/> y <c>adjunto-invalido</c>.
    /// </summary>
    public IReadOnlyList<object> Responder(IReadOnlyList<RespuestaDePregunta> respuestas, ContextoDeExigencia contexto, ActorDeEvaluacion por, DateTimeOffset ahora)
    {
        if (Estado != EstadoDeEvaluacion.Pendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", $"La evaluación está {Estado}: ya no se responde.");
        var esTercero = por.Tipo == ActorTipo.Tercero;
        if (esTercero != (Definicion.Responde == QuienResponde.Tercero))
            throw ReglaDeNegocioException.Prohibido("responde-otro",
                Definicion.Responde == QuienResponde.Tercero
                    ? "Este cuestionario lo responde el tercero (autoevaluación), no la empresa."
                    : "Este cuestionario lo responde una persona de la empresa, no el tercero.");

        var limpias = respuestas.Select(r => r with { Comentario = string.IsNullOrWhiteSpace(r.Comentario) ? null : r.Comentario.Trim() }).ToList();
        var evaluadas = CalculadoraDePuntaje.Evaluar(Definicion, limpias, contexto);
        foreach (var adjunto in limpias.Where(r => r.Adjuntos is { Count: > 0 }).SelectMany(r => r.Adjuntos!))
            if (Adjuntos.All(a => a.Id != adjunto))
                throw ReglaDeNegocioException.Validacion("adjunto-invalido", "Un archivo de la respuesta no se subió a esta evaluación.");

        var resultado = CalculadoraDePuntaje.Totalizar(Definicion, evaluadas);
        return [new EvaluacionRespondida(limpias, evaluadas, resultado, por, VigenciaPara(resultado, ahora), ahora)];
    }

    /// <summary>
    /// Un revisor recalifica con justificación (CE-10): ajusta el puntaje de preguntas o levanta una eliminatoria y/o fija el veredicto. El conjunto de
    /// <paramref name="ajustes"/> reemplaza al anterior. 409 <c>evaluacion-no-calificada</c>; 422 <c>justificacion-requerida</c>, <c>sin-cambios</c>, <c>ajuste-invalido</c>.
    /// </summary>
    public IReadOnlyList<object> Recalificar(IReadOnlyList<AjusteDeCalificacion> ajustes, bool? veredictoManual, string? justificacion, ActorDeEvaluacion por, DateTimeOffset ahora)
    {
        if (Estado != EstadoDeEvaluacion.Calificada || Resultado is null)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-calificada", $"Solo se recalifica una evaluación calificada; esta está {Estado}.");
        var texto = Justificar(justificacion, "Recalificar necesita una justificación.");
        if (ajustes.Count > MaximoDeAjustes)
            throw ReglaDeNegocioException.Validacion("ajuste-invalido", $"Una recalificación admite hasta {MaximoDeAjustes} ajustes.");

        var resultado = CalculadoraDePuntaje.Totalizar(Definicion, Evaluadas, ajustes, veredictoManual);
        var manualVigente = Resultado.Calculada ? (bool?)null : Resultado.Aprobada;
        if (veredictoManual == manualVigente && ajustes.Count == Ajustes.Count && ajustes.All(a => Ajustes.Contains(a)))
            throw ReglaDeNegocioException.Validacion("sin-cambios",
                "Indica qué cambia: el puntaje de alguna pregunta, una eliminatoria que se levanta o el veredicto.");
        return [new EvaluacionRecalificada([.. ajustes], veredictoManual, resultado, texto, por, VigenciaPara(resultado, RespondidaEn ?? ahora), ahora)];
    }

    /// <summary>Devuelve a pendiente para responder de nuevo (el resultado anterior queda en el historial). 409 <c>evaluacion-no-calificada</c>; 422 <c>justificacion-requerida</c>.</summary>
    public IReadOnlyList<object> Reabrir(string? justificacion, ActorDeEvaluacion por, DateTimeOffset ahora)
    {
        if (Estado != EstadoDeEvaluacion.Calificada)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-calificada", $"Solo se reabre una evaluación calificada; esta está {Estado}.");
        return [new EvaluacionReabierta(Justificar(justificacion, "Reabrir necesita una justificación."), por, ahora)];
    }

    /// <summary>Anula una evaluación pendiente o calificada (el expediente deja de esperarla). 409 <c>evaluacion-cerrada</c>; 422 <c>justificacion-requerida</c>.</summary>
    public IReadOnlyList<object> Anular(string? justificacion, ActorDeEvaluacion por, DateTimeOffset ahora)
    {
        if (Estado is EstadoDeEvaluacion.Anulada or EstadoDeEvaluacion.Vencida)
            throw ReglaDeNegocioException.Conflicto("evaluacion-cerrada", $"La evaluación ya está {Estado}.");
        return [new EvaluacionAnulada(Justificar(justificacion, "Anular necesita una justificación."), por, ahora)];
    }

    /// <summary>Marca como vencida una evaluación calificada y aprobada cuya vigencia ya pasó; en cualquier otro caso no hace nada.</summary>
    public IReadOnlyList<object> Vencer(DateTimeOffset ahora) =>
        Estado == EstadoDeEvaluacion.Calificada && ProximaReevaluacion is { } hasta && hasta <= ahora ? [new EvaluacionVencida(ahora)] : [];

    /// <summary>Registra un archivo de evidencia subido a una evaluación pendiente (409 <c>evaluacion-no-pendiente</c>; 422 <c>adjuntos-demasiados</c>).</summary>
    public AdjuntoDeEvaluacionSubido RegistrarAdjunto(AdjuntoDeEvaluacion adjunto)
    {
        if (Estado != EstadoDeEvaluacion.Pendiente)
            throw ReglaDeNegocioException.Conflicto("evaluacion-no-pendiente", $"La evaluación está {Estado}: ya no recibe archivos.");
        if (Adjuntos.Count >= 50)
            throw ReglaDeNegocioException.Validacion("adjuntos-demasiados", "La evaluación admite hasta 50 archivos.");
        return new AdjuntoDeEvaluacionSubido(adjunto);
    }

    public AdjuntoDeEvaluacion? BuscarAdjunto(Guid id) => Adjuntos.FirstOrDefault(a => a.Id == id);

    /// <summary>Hasta cuándo vale una evaluación aprobada si el cuestionario se repite (nulo si reprobó o no se repite).</summary>
    private DateTimeOffset? VigenciaPara(ResultadoDeEvaluacion resultado, DateTimeOffset desde) =>
        resultado.Aprobada && Definicion.ReevaluarCadaMeses is { } meses ? desde.AddMonths(meses) : null;

    private static string Justificar(string? justificacion, string mensaje)
    {
        var texto = justificacion?.Trim();
        if (string.IsNullOrEmpty(texto))
            throw ReglaDeNegocioException.Validacion("justificacion-requerida", mensaje);
        return texto.Length <= LongitudMaximaJustificacion
            ? texto
            : throw ReglaDeNegocioException.Validacion("justificacion-demasiado-larga", $"La justificación admite hasta {LongitudMaximaJustificacion} caracteres.");
    }

    // ---------- Evolución (Marten) ----------

    /// <summary>Aplica a este estado los eventos que acaba de producir una decisión (los guarda el stream; esto deja el agregado en memoria al día para leer el resultado).</summary>
    public void Aplicar(IEnumerable<object> eventos)
    {
        foreach (var evento in eventos)
            switch (evento)
            {
                case AdjuntoDeEvaluacionSubido e: Apply(e); break;
                case EvaluacionRespondida e: Apply(e); break;
                case EvaluacionRecalificada e: Apply(e); break;
                case EvaluacionReabierta e: Apply(e); break;
                case EvaluacionAnulada e: Apply(e); break;
                case EvaluacionVencida e: Apply(e); break;
                default: throw new InvalidOperationException($"Evento desconocido para la evaluación: {evento.GetType().Name}.");
            }
    }

    public static EvaluacionDeProveedor Create(EvaluacionAsignada e) => new()
    {
        Id = e.EvaluacionId,
        EmpresaId = e.EmpresaId,
        VinculoId = e.VinculoId,
        ExpedienteId = e.ExpedienteId,
        TerceroId = e.TerceroId,
        TerceroNombre = e.TerceroNombre,
        TerceroIdentificacion = e.TerceroIdentificacion,
        Motivo = e.Motivo,
        Cuestionario = e.Cuestionario,
        Definicion = e.Definicion,
        Efecto = e.Efecto,
        Anterior = e.Anterior,
        Estado = EstadoDeEvaluacion.Pendiente,
        AsignadaEn = e.Fecha,
        ActualizadaEn = e.Fecha
    };

    public void Apply(AdjuntoDeEvaluacionSubido e)
    {
        Adjuntos.Add(e.Adjunto);
        ActualizadaEn = e.Adjunto.Fecha;
    }

    public void Apply(EvaluacionRespondida e)
    {
        Estado = EstadoDeEvaluacion.Calificada;
        Respuestas = [.. e.Respuestas];
        Evaluadas = [.. e.Evaluadas];
        Ajustes = [];
        Resultado = e.Resultado;
        RespondidaPor = e.Por;
        RespondidaEn = e.Fecha;
        Intentos++;
        Calificaciones.Add(new CalificacionRegistrada { Numero = Calificaciones.Count + 1, Origen = "Respuesta", Resultado = e.Resultado, Por = e.Por, Fecha = e.Fecha });
        FijarVigencia(e.VigenteHasta);
        Justificacion = null;
        ActualizadaEn = e.Fecha;
    }

    public void Apply(EvaluacionRecalificada e)
    {
        Ajustes = [.. e.Ajustes];
        Resultado = e.Resultado;
        Recalificaciones++;
        Calificaciones.Add(new CalificacionRegistrada
        {
            Numero = Calificaciones.Count + 1, Origen = "Recalificacion", Resultado = e.Resultado, Justificacion = e.Justificacion, Por = e.Por, Fecha = e.Fecha
        });
        FijarVigencia(e.VigenteHasta);
        Justificacion = e.Justificacion;
        ActualizadaEn = e.Fecha;
    }

    public void Apply(EvaluacionReabierta e)
    {
        Estado = EstadoDeEvaluacion.Pendiente;
        FijarVigencia(null);
        Justificacion = e.Justificacion;
        ActualizadaEn = e.Fecha;
    }

    public void Apply(EvaluacionAnulada e)
    {
        Estado = EstadoDeEvaluacion.Anulada;
        FijarVigencia(null);
        Justificacion = e.Justificacion;
        ActualizadaEn = e.Fecha;
    }

    public void Apply(EvaluacionVencida e)
    {
        Estado = EstadoDeEvaluacion.Vencida;
        ProximaReevaluacion = null;
        ActualizadaEn = e.Fecha;
    }

    private void FijarVigencia(DateTimeOffset? hasta)
    {
        VigenteHasta = hasta;
        ProximaReevaluacion = hasta;
    }
}
