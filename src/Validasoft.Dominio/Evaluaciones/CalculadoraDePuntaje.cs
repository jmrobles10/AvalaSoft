using System.Text.Json;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Flujos;

namespace Validasoft.Dominio.Evaluaciones;

/// <summary>
/// Respuesta a una pregunta (CE-2). Según el tipo se llena una cosa: <see cref="Opciones"/> (códigos; Sí/No usa <c>si</c> o <c>no</c>),
/// <see cref="Numero"/> (escala y número), <see cref="Texto"/> o <see cref="Adjuntos"/> (ids de archivos ya subidos a la evaluación). Todas pueden
/// llevar <see cref="Comentario"/> si la pregunta lo permite.
/// </summary>
public sealed record RespuestaDePregunta(
    string Pregunta,
    IReadOnlyList<string>? Opciones = null,
    decimal? Numero = null,
    string? Texto = null,
    IReadOnlyList<Guid>? Adjuntos = null,
    string? Comentario = null)
{
    public const int LongitudMaximaTexto = 4000;
    public const int LongitudMaximaComentario = 1000;
    public const int MaximoAdjuntos = 5;

    /// <summary>No trae valor alguno (un comentario suelto no cuenta como respuesta).</summary>
    public bool EstaVacia => (Opciones is null || Opciones.Count == 0) && Numero is null && string.IsNullOrWhiteSpace(Texto) && (Adjuntos is null || Adjuntos.Count == 0);
}

/// <summary>
/// Primera fase del cálculo, sobre las respuestas: si la pregunta se mostró (<see cref="Visible"/>), si se respondió, cuánto vale lo respondido
/// de 0 a 1 (<see cref="Normalizado"/>; nulo si la pregunta no puntúa) y si esa respuesta elimina (<see cref="Elimina"/>). Se guarda con la evaluación para
/// poder recalificar sin volver a leer las respuestas.
/// </summary>
public sealed record PreguntaEvaluada(string Codigo, bool Visible, bool Respondida, decimal? Normalizado, bool Elimina);

/// <summary>
/// Cambio de un revisor sobre una pregunta al recalificar (CE-10): <see cref="Puntaje"/> (0 a 100, el porcentaje que vale lo respondido; nulo = se deja el
/// calculado) y <see cref="LevantaEliminatoria"/> (la respuesta ya no elimina).
/// </summary>
public sealed record AjusteDeCalificacion(string Pregunta, decimal? Puntaje, bool LevantaEliminatoria = false);

/// <summary>Puntaje de una sección (0 a 100); <see cref="Aplica"/> falso si no se mostró o ninguna de sus preguntas puntúa.</summary>
public sealed record PuntajeDeSeccion(string Codigo, string Nombre, decimal Peso, decimal? Puntaje, bool Aplica);

/// <summary>Una pregunta ya calificada: su puntaje de 0 a 100 (nulo si no puntúa), si elimina y si un revisor la ajustó.</summary>
public sealed record PreguntaCalificada(string Codigo, bool Visible, bool Respondida, decimal? Puntaje, bool Elimina, bool Ajustada);

/// <summary>
/// Resultado de una evaluación (CE-9): puntaje total de 0 a 100 (nulo si nada puntuó), el de cada sección y pregunta, las eliminatorias falladas
/// y el veredicto. <see cref="Aprobada"/> es el veredicto vigente; <see cref="Calculada"/> falso cuando un revisor lo fijó a mano al recalificar
/// (los <see cref="Motivos"/> siguen diciendo qué dio el cálculo).
/// </summary>
public sealed record ResultadoDeEvaluacion(
    decimal? Puntaje,
    decimal Umbral,
    bool Aprobada,
    bool Calculada,
    IReadOnlyList<string> Motivos,
    IReadOnlyList<string> Eliminatorias,
    IReadOnlyList<PuntajeDeSeccion> Secciones,
    IReadOnlyList<PreguntaCalificada> Preguntas)
{
    public const string BajoElUmbral = "BajoElUmbral";

    public const string EliminatoriaFallida = "Eliminatoria";
}

/// <summary>
/// Cálculo del puntaje de un cuestionario (CE-5), función pura sin estado:
/// <list type="number">
/// <item><see cref="Evaluar"/>: valida las respuestas (visibilidad, obligatorias, tipos) y da, por pregunta, cuánto vale de 0 a 1 y si elimina.</item>
/// <item><see cref="Totalizar"/>: puntaje de cada sección (promedio de sus preguntas visibles ponderado por <c>Peso</c>), total (promedio de las secciones ponderado
/// por su peso), eliminatorias y veredicto. Aprobada = ninguna eliminatoria y total ≥ umbral. Lo no respondido (opcional) vale 0; lo oculto no cuenta.</item>
/// </list>
/// Opción única y Sí/No valen <c>puntaje / mejor puntaje</c>; la múltiple, la suma de lo marcado sobre la suma de todas; la escala, <c>(valor − mínimo) / (máximo − mínimo)</c>;
/// el número, el del primer rango que lo contiene sobre el mejor rango. Los puntajes se redondean a dos decimales y el veredicto usa el redondeado.
/// </summary>
public static class CalculadoraDePuntaje
{
    public const int Decimales = 2;

    /// <summary>
    /// Fase 1. 422: <c>pregunta-desconocida</c>, <c>respuesta-duplicada</c>, <c>pregunta-no-visible</c>, <c>pregunta-obligatoria</c>, <c>respuesta-invalida</c>,
    /// <c>comentario-no-permitido</c> (con <c>datos.pregunta</c>). Que los archivos de un adjunto existan lo comprueba el agregado.
    /// </summary>
    public static IReadOnlyList<PreguntaEvaluada> Evaluar(DefinicionDeCuestionario definicion, IReadOnlyList<RespuestaDePregunta> respuestas, ContextoDeExigencia contexto)
    {
        var porPregunta = new Dictionary<string, RespuestaDePregunta>(StringComparer.Ordinal);
        foreach (var respuesta in respuestas ?? [])
        {
            if (definicion.Buscar(respuesta.Pregunta ?? string.Empty) is null)
                throw Falla("pregunta-desconocida", $"La pregunta «{respuesta.Pregunta}» no existe en el cuestionario.", respuesta.Pregunta);
            if (!porPregunta.TryAdd(respuesta.Pregunta!, respuesta))
                throw Falla("respuesta-duplicada", $"La pregunta {respuesta.Pregunta} se respondió dos veces.", respuesta.Pregunta);
        }

        var vistas = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        var evaluadas = new List<PreguntaEvaluada>();
        foreach (var seccion in definicion.Secciones)
        {
            var seccionVisible = EvaluadorDeExigencia.Aplica(seccion.Condicion, ConRespuestas(contexto, vistas));
            foreach (var pregunta in seccion.Preguntas)
            {
                var respuesta = porPregunta.GetValueOrDefault(pregunta.Codigo);
                var visible = seccionVisible && EvaluadorDeExigencia.Aplica(pregunta.Condicion, ConRespuestas(contexto, vistas));
                if (!visible)
                {
                    if (respuesta is { EstaVacia: false })
                        throw Falla("pregunta-no-visible", $"La pregunta {pregunta.Codigo} no se muestra con las respuestas dadas: no se responde.", pregunta.Codigo);
                    evaluadas.Add(new PreguntaEvaluada(pregunta.Codigo, false, false, null, false));
                    continue;
                }

                if (respuesta?.Comentario is { Length: > 0 } comentario)
                {
                    if (!pregunta.PermiteComentario)
                        throw Falla("comentario-no-permitido", $"La pregunta {pregunta.Codigo} no admite comentario.", pregunta.Codigo);
                    if (comentario.Length > RespuestaDePregunta.LongitudMaximaComentario)
                        throw Falla("respuesta-invalida", $"El comentario de {pregunta.Codigo} admite hasta {RespuestaDePregunta.LongitudMaximaComentario} caracteres.", pregunta.Codigo);
                }

                if (respuesta is null or { EstaVacia: true })
                {
                    if (pregunta.Obligatoria)
                        throw Falla("pregunta-obligatoria", $"La pregunta {pregunta.Codigo} es obligatoria.", pregunta.Codigo);
                    evaluadas.Add(new PreguntaEvaluada(pregunta.Codigo, true, false, pregunta.Puntua ? 0m : null, false));
                    continue;
                }

                var (normalizado, elimina, valor) = Valorar(pregunta, respuesta);
                if (valor is { } json)
                    vistas[pregunta.Codigo] = json;
                evaluadas.Add(new PreguntaEvaluada(pregunta.Codigo, true, true, pregunta.Puntua ? normalizado : null, elimina));
            }
        }

        return evaluadas;
    }

    /// <summary>
    /// Fase 2: el resultado con los <paramref name="ajustes"/> de un revisor (<c>pregunta-desconocida</c> o <c>ajuste-invalido</c> si no se pueden aplicar) y, si se da,
    /// el <paramref name="veredictoManual"/> que reemplaza al calculado.
    /// </summary>
    public static ResultadoDeEvaluacion Totalizar(DefinicionDeCuestionario definicion, IReadOnlyList<PreguntaEvaluada> evaluadas,
        IReadOnlyList<AjusteDeCalificacion>? ajustes = null, bool? veredictoManual = null)
    {
        var porAjuste = new Dictionary<string, AjusteDeCalificacion>(StringComparer.Ordinal);
        foreach (var ajuste in ajustes ?? [])
        {
            var pregunta = definicion.Buscar(ajuste.Pregunta ?? string.Empty)
                           ?? throw Falla("pregunta-desconocida", $"La pregunta «{ajuste.Pregunta}» no existe en el cuestionario.", ajuste.Pregunta);
            var evaluada = evaluadas.FirstOrDefault(e => e.Codigo == pregunta.Codigo);
            if (evaluada is not { Visible: true } || !porAjuste.TryAdd(pregunta.Codigo, ajuste) || ajuste.Puntaje is < 0 or > 100 ||
                (ajuste.Puntaje is not null && !pregunta.Puntua) || (ajuste.LevantaEliminatoria && !evaluada.Elimina))
                throw Falla("ajuste-invalido",
                    $"No se puede ajustar la pregunta {pregunta.Codigo}: debe estar visible, puntuar si se le da puntaje, no repetirse y eliminar si se le levanta la eliminatoria.", pregunta.Codigo);
        }

        var calificadas = new List<PreguntaCalificada>();
        var secciones = new List<PuntajeDeSeccion>();
        foreach (var seccion in definicion.Secciones)
        {
            decimal suma = 0, pesos = 0;
            foreach (var pregunta in seccion.Preguntas)
            {
                var evaluada = evaluadas.FirstOrDefault(e => e.Codigo == pregunta.Codigo) ?? new PreguntaEvaluada(pregunta.Codigo, false, false, null, false);
                var ajuste = porAjuste.GetValueOrDefault(pregunta.Codigo);
                var puntaje = evaluada.Normalizado is { } n ? Redondear(n * 100m) : (decimal?)null;
                if (ajuste?.Puntaje is { } ajustado)
                    puntaje = Redondear(ajustado);
                var elimina = evaluada.Elimina && ajuste?.LevantaEliminatoria != true;
                calificadas.Add(new PreguntaCalificada(pregunta.Codigo, evaluada.Visible, evaluada.Respondida, puntaje, elimina, ajuste is not null));
                if (evaluada.Visible && pregunta.Puntua)
                {
                    suma += pregunta.Peso * (puntaje ?? 0m);
                    pesos += pregunta.Peso;
                }
            }

            var aplica = pesos > 0 && evaluadas.Any(e => e.Visible && seccion.Preguntas.Any(p => p.Codigo == e.Codigo));
            secciones.Add(new PuntajeDeSeccion(seccion.Codigo, seccion.Nombre, seccion.Peso, aplica ? Redondear(suma / pesos) : null, aplica));
        }

        var conPeso = secciones.Where(s => s.Aplica && s.Peso > 0).ToList();
        decimal? total = conPeso.Count == 0 ? null : Redondear(conPeso.Sum(s => s.Peso * s.Puntaje!.Value) / conPeso.Sum(s => s.Peso));
        var eliminatorias = calificadas.Where(c => c is { Visible: true, Elimina: true }).Select(c => c.Codigo).ToList();
        var motivos = new List<string>();
        if (eliminatorias.Count > 0)
            motivos.Add(ResultadoDeEvaluacion.EliminatoriaFallida);
        if (total is { } puntajeTotal && puntajeTotal < definicion.UmbralDeAprobacion)
            motivos.Add(ResultadoDeEvaluacion.BajoElUmbral);

        var aprobadaCalculada = motivos.Count == 0;
        return new ResultadoDeEvaluacion(total, definicion.UmbralDeAprobacion, veredictoManual ?? aprobadaCalculada, veredictoManual is null, motivos, eliminatorias,
            secciones, calificadas);
    }

    /// <summary>
    /// Qué secciones y preguntas se muestran con las respuestas que hay hasta ahora (CE-6), sin exigir lo obligatorio ni rechazar una respuesta a medias (esa pregunta
    /// simplemente no condiciona a las siguientes). Es lo que consulta la pantalla mientras se responde.
    /// </summary>
    public static (IReadOnlyList<string> Preguntas, IReadOnlyList<string> Secciones) Visibles(DefinicionDeCuestionario definicion,
        IReadOnlyList<RespuestaDePregunta> respuestas, ContextoDeExigencia contexto)
    {
        var porPregunta = new Dictionary<string, RespuestaDePregunta>(StringComparer.Ordinal);
        foreach (var respuesta in respuestas ?? [])
            if (respuesta.Pregunta is not null)
                porPregunta.TryAdd(respuesta.Pregunta, respuesta);

        var vistas = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        var preguntas = new List<string>();
        var secciones = new List<string>();
        foreach (var seccion in definicion.Secciones)
        {
            if (!EvaluadorDeExigencia.Aplica(seccion.Condicion, ConRespuestas(contexto, vistas)))
                continue;
            secciones.Add(seccion.Codigo);
            foreach (var pregunta in seccion.Preguntas)
            {
                if (!EvaluadorDeExigencia.Aplica(pregunta.Condicion, ConRespuestas(contexto, vistas)))
                    continue;
                preguntas.Add(pregunta.Codigo);
                if (!porPregunta.TryGetValue(pregunta.Codigo, out var respuesta) || respuesta.EstaVacia)
                    continue;
                try
                {
                    if (Valorar(pregunta, respuesta).Valor is { } json)
                        vistas[pregunta.Codigo] = json;
                }
                catch (ReglaDeNegocioException)
                {
                    // Una respuesta a medias no condiciona a las siguientes.
                }
            }
        }

        return (preguntas, secciones);
    }

    /// <summary>Redondeo del cálculo (dos decimales, hacia arriba en el punto medio).</summary>

    public static decimal Redondear(decimal valor) => Math.Round(valor, Decimales, MidpointRounding.AwayFromZero);

    private static ContextoDeExigencia ConRespuestas(ContextoDeExigencia contexto, IReadOnlyDictionary<string, JsonElement> respuestas) =>
        contexto with { Respuestas = new Dictionary<string, JsonElement>(respuestas) };

    /// <summary>Valida la respuesta contra el tipo y devuelve cuánto vale (0 a 1), si elimina y el valor que ven las condiciones siguientes.</summary>
    private static (decimal Normalizado, bool Elimina, JsonElement? Valor) Valorar(PreguntaDeCuestionario pregunta, RespuestaDePregunta respuesta)
    {
        switch (pregunta.Tipo)
        {
            case TipoDePregunta.SiNo or TipoDePregunta.OpcionUnica:
            {
                var codigo = respuesta.Opciones is { Count: 1 } uno ? uno[0] : null;
                var opcion = codigo is null ? null : pregunta.Opciones!.FirstOrDefault(o => o.Codigo == codigo);
                if (opcion is null || respuesta.Numero is not null || respuesta.Texto is not null || respuesta.Adjuntos is { Count: > 0 })
                    throw Falla("respuesta-invalida", $"La pregunta {pregunta.Codigo} se responde con una sola de sus opciones.", pregunta.Codigo);
                return (Fraccion(opcion.Puntaje, pregunta.Opciones!.Max(o => o.Puntaje)), opcion.Elimina, JsonSerializer.SerializeToElement(opcion.Codigo));
            }
            case TipoDePregunta.OpcionMultiple:
            {
                var codigos = respuesta.Opciones ?? [];
                var elegidas = pregunta.Opciones!.Where(o => codigos.Contains(o.Codigo)).ToList();
                if (codigos.Distinct().Count() != codigos.Count || elegidas.Count != codigos.Count || respuesta.Numero is not null || respuesta.Texto is not null ||
                    respuesta.Adjuntos is { Count: > 0 })
                    throw Falla("respuesta-invalida", $"La pregunta {pregunta.Codigo} se responde con opciones suyas, sin repetir.", pregunta.Codigo);
                return (Fraccion(elegidas.Sum(o => o.Puntaje), pregunta.Opciones!.Sum(o => o.Puntaje)), elegidas.Any(o => o.Elimina),
                    JsonSerializer.SerializeToElement(codigos));
            }
            case TipoDePregunta.Escala:
            {
                var escala = pregunta.Escala!;
                if (respuesta.Numero is not { } valor || valor != decimal.Truncate(valor) || valor < escala.Minimo || valor > escala.Maximo || respuesta.Opciones is { Count: > 0 } ||
                    respuesta.Texto is not null || respuesta.Adjuntos is { Count: > 0 })
                    throw Falla("respuesta-invalida", $"La pregunta {pregunta.Codigo} se responde con un entero de {escala.Minimo} a {escala.Maximo}.", pregunta.Codigo);
                return (Fraccion(valor - escala.Minimo, escala.Maximo - escala.Minimo), escala.MinimoAceptable is { } minimo && valor < minimo, JsonSerializer.SerializeToElement(valor));
            }
            case TipoDePregunta.Numero:
            {
                if (respuesta.Numero is not { } numero || respuesta.Opciones is { Count: > 0 } || respuesta.Texto is not null || respuesta.Adjuntos is { Count: > 0 })
                    throw Falla("respuesta-invalida", $"La pregunta {pregunta.Codigo} se responde con un número.", pregunta.Codigo);
                var rangos = pregunta.Rangos ?? [];
                var rango = rangos.FirstOrDefault(r => (r.Desde is null || numero >= r.Desde) && (r.Hasta is null || numero <= r.Hasta));
                var mejor = rangos.Count == 0 ? 0m : rangos.Max(r => r.Puntaje);
                return (rango is null ? 0m : Fraccion(rango.Puntaje, mejor), rango?.Elimina ?? false, JsonSerializer.SerializeToElement(numero));
            }
            case TipoDePregunta.Texto:
            {
                var texto = (respuesta.Texto ?? string.Empty).Trim();
                if (texto.Length is 0 or > RespuestaDePregunta.LongitudMaximaTexto || respuesta.Opciones is { Count: > 0 } || respuesta.Numero is not null ||
                    respuesta.Adjuntos is { Count: > 0 })
                    throw Falla("respuesta-invalida", $"La pregunta {pregunta.Codigo} se responde con un texto de hasta {RespuestaDePregunta.LongitudMaximaTexto} caracteres.", pregunta.Codigo);
                return (0m, false, JsonSerializer.SerializeToElement(texto));
            }
            default:
            {
                if (respuesta.Adjuntos is not { Count: > 0 and <= RespuestaDePregunta.MaximoAdjuntos } adjuntos || adjuntos.Distinct().Count() != adjuntos.Count ||
                    respuesta.Opciones is { Count: > 0 } || respuesta.Numero is not null || respuesta.Texto is not null)
                    throw Falla("respuesta-invalida",
                        $"La pregunta {pregunta.Codigo} se responde con entre 1 y {RespuestaDePregunta.MaximoAdjuntos} archivos ya subidos.", pregunta.Codigo);
                return (0m, false, null);
            }
        }
    }

    private static decimal Fraccion(decimal parte, decimal total) => total <= 0 ? 0m : Math.Clamp(parte / total, 0m, 1m);

    private static ReglaDeNegocioException Falla(string codigo, string mensaje, string? pregunta) =>
        new(TipoFalla.Validacion, codigo, mensaje) { Datos = new Dictionary<string, object?> { ["pregunta"] = pregunta } };
}
