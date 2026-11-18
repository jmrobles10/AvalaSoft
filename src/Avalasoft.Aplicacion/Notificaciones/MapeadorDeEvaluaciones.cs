using JasperFx.Events;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Evaluaciones;

namespace Avalasoft.Aplicacion.Notificaciones;

/// <summary>
/// Evento público de las evaluaciones del proveedor (CE-12, docs/05 §7): <c>evaluacion.calificada</c> sale de <see cref="EvaluacionRespondida"/> y de <see cref="EvaluacionRecalificada"/> (stream
/// <c>EvaluacionDeProveedor-{id}</c>). Lleva el puntaje, el veredicto y los motivos de ese resultado (los del evento, no los de la evaluación de ahora, así un reproceso publica lo mismo) y
/// la referencia del vínculo en los sistemas integrados; nunca las respuestas ni el detalle por pregunta, que solo ve la empresa por la API. Va a las suscripciones de la propia empresa.
/// </summary>
public sealed class MapeadorDeEvaluaciones : IMapeadorDeEventos
{
    public const string Calificada = "evaluacion.calificada";

    public static readonly IReadOnlyList<TipoEventoPublicoDto> Tipos =
    [
        new(Calificada, "Una evaluación del proveedor se respondió o se recalificó: trae el puntaje, si aprobó y por qué no (bajo el umbral o eliminatoria); no trae las respuestas.")
    ];

    public IReadOnlyList<TipoEventoPublicoDto> Catalogo => Tipos;

    public async ValueTask<EventoPublicoMapeado?> MapearAsync(IEvent evento, IContextoDeEventos contexto, CancellationToken ct)
    {
        if (evento.Data is not (EvaluacionRespondida or EvaluacionRecalificada) || !Guid.TryParse(evento.TenantId, out var tenantId) ||
            await contexto.EvaluacionAsync(tenantId, evento.StreamId, ct) is not { } evaluacion)
            return null;

        var (resultado, origen, fecha) = evento.Data switch
        {
            EvaluacionRespondida r => (r.Resultado, "Respuesta", r.Fecha),
            EvaluacionRecalificada c => (c.Resultado, "Recalificacion", c.Fecha),
            _ => throw new InvalidOperationException()
        };
        var vinculo = await contexto.VinculoAsync(tenantId, evaluacion.VinculoId, ct);
        IReadOnlyList<ReferenciaExternaDto> referencias = vinculo is null ? [] : [.. vinculo.Referencias.Select(r => new ReferenciaExternaDto(r.Sistema, r.Id))];

        return new EventoPublicoMapeado(Calificada, tenantId, evaluacion.EmpresaId,
            new DatosEvaluacionDto(evaluacion.Id, evaluacion.VinculoId, evaluacion.ExpedienteId, referencias, evaluacion.TerceroId, evaluacion.Cuestionario.Codigo,
                evaluacion.Cuestionario.Nombre, evaluacion.Cuestionario.Version, origen, resultado.Puntaje, resultado.Umbral, resultado.Aprobada, resultado.Calculada,
                [.. resultado.Motivos], evaluacion.Efecto.ToString(), fecha));
    }
}
