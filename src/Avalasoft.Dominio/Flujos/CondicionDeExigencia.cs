using System.Globalization;
using System.Text.Json;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Configuracion;
using Avalasoft.Dominio.Terceros;

namespace Avalasoft.Dominio.Flujos;

/// <summary>Nodo del árbol de una condición (docs/03 §12): combina otros nodos o compara un atributo.</summary>
public enum TipoNodoCondicion
{
    Y,
    O,
    No,
    Predicado
}

public enum OperadorCondicion
{
    Igual,
    Distinto,
    En,
    NoEn,
    ContieneAlguno,
    ContieneTodos,
    Existe,
    Mayor,
    Menor,
    Entre
}

/// <summary>
/// «Se pide cuando» de un requisito (RQ-12). <see cref="TipoNodoCondicion.Y"/>/<see cref="TipoNodoCondicion.O"/> combinan
/// <see cref="Nodos"/>; <see cref="TipoNodoCondicion.No"/> niega su único nodo; <see cref="TipoNodoCondicion.Predicado"/>
/// compara <see cref="Atributo"/> con <see cref="Valores"/> (texto invariante: números con punto, fechas
/// <c>yyyy-MM-dd</c>, booleanos <c>true</c>/<c>false</c>). Sin condición el requisito se pide siempre.
/// </summary>
public sealed record CondicionDeExigencia(
    TipoNodoCondicion Tipo,
    IReadOnlyList<CondicionDeExigencia>? Nodos = null,
    string? Atributo = null,
    OperadorCondicion? Operador = null,
    IReadOnlyList<string>? Valores = null)
{
    public static CondicionDeExigencia Predicado(string atributo, OperadorCondicion operador, params string[] valores) =>
        new(TipoNodoCondicion.Predicado, null, atributo, operador, valores);

    public static CondicionDeExigencia Todas(params CondicionDeExigencia[] nodos) => new(TipoNodoCondicion.Y, nodos);

    public static CondicionDeExigencia Alguna(params CondicionDeExigencia[] nodos) => new(TipoNodoCondicion.O, nodos);

    public static CondicionDeExigencia Negar(CondicionDeExigencia nodo) => new(TipoNodoCondicion.No, [nodo]);
}

/// <summary>
/// Lo que se sabe del tercero y del vínculo al decidir qué documentos se le piden. <see cref="TipoVinculo"/> es el código
/// del tipo del vínculo; <see cref="Atributos"/>, los del vínculo (los valida su tipo). <see cref="Ficha"/> trae lo que el tercero declaró en su
/// ficha, por <c>ficha.{seccion}.{campo}</c> (<see cref="FichaParaExigencia"/>); es nula cuando la ficha no está disponible para la empresa (antes de
/// que el tercero acepte) o el llamador no la cargó, y entonces sus campos son «datos faltantes».
/// </summary>
public sealed record ContextoDeExigencia(
    TipoPersona TipoPersona,
    string Pais,
    string TipoIdentificacion,
    bool EsExtranjero,
    string TipoVinculo,
    IReadOnlyDictionary<string, JsonElement> Atributos,
    IReadOnlyDictionary<string, JsonElement>? Respuestas = null,
    IReadOnlyDictionary<string, JsonElement>? Ficha = null)
{
    public ContextoDeExigencia ConFicha(IReadOnlyDictionary<string, JsonElement>? ficha) => this with { Ficha = ficha };

    public static ContextoDeExigencia De(Tercero tercero, string tipoVinculo, IReadOnlyDictionary<string, JsonElement>? atributos) =>
        new(tercero.TipoPersona, tercero.Identificacion.Pais, tercero.Identificacion.Tipo, tercero.EsExtranjero, tipoVinculo,
            atributos ?? new Dictionary<string, JsonElement>());
}

/// <summary>
/// Atributo <c>respuesta.{clave}</c> que puede mirar la condición de visibilidad de una pregunta de un cuestionario de evaluación (CE-6): la
/// respuesta a otra pregunta, con el tipo de valor que esa pregunta produce y, si es de opciones, los códigos admitidos.
/// </summary>
public sealed record AtributoDeRespuesta(string Clave, TipoAtributo Tipo, IReadOnlyList<string>? Opciones);

/// <summary>
/// Catálogo de atributos que puede mirar una condición y validación de las condiciones al guardar el flujo (422
/// <c>condicion-invalida</c>). Los del tercero valen para cualquier flujo; <c>vinculo.atributos.{clave}</c> solo si el
/// tipo de vínculo del flujo admite esa clave, y con su tipo.
/// </summary>
public static class AtributosDeExigencia
{
    public const string TipoPersona = "tercero.tipoPersona";
    public const string Pais = "tercero.pais";
    public const string TipoIdentificacion = "tercero.tipoIdentificacion";
    public const string EsExtranjero = "tercero.esExtranjero";
    public const string TipoVinculo = "vinculo.tipo";
    public const string PrefijoAtributos = "vinculo.atributos.";

    /// <summary>Campos de la ficha del tercero (EF-1): <c>ficha.{seccion}.{campo}</c>, solo los de <see cref="CamposDeFicha"/>. Valen en los requisitos y la selección de un flujo, no en los cuestionarios.</summary>
    public const string PrefijoFicha = CamposDeFicha.Prefijo;

    /// <summary>Respuestas a preguntas anteriores de un cuestionario de evaluación (CE-6): solo valen en las condiciones del cuestionario.</summary>
    public const string PrefijoRespuestas = "respuesta.";

    public const int ProfundidadMaxima = 4;
    public const int PredicadosMaximos = 20;

    private static readonly string[] TiposDePersona = Enum.GetNames<TipoPersona>();

    /// <summary>Valida y normaliza (valores sin espacios; país y códigos en mayúsculas; tipo de persona con su nombre exacto).</summary>
    public static CondicionDeExigencia? Validar(CondicionDeExigencia? condicion, TipoVinculo? tipoDelFlujo, string documento,
        IReadOnlyList<AtributoDeRespuesta>? respuestas = null)
    {
        if (condicion is null || (condicion.Tipo is TipoNodoCondicion.Y && (condicion.Nodos?.Count ?? 0) == 0))
            return null;

        var predicados = 0;
        var normalizada = Validar(condicion, tipoDelFlujo, documento, respuestas, 1, ref predicados);
        if (predicados > PredicadosMaximos)
            throw Invalida(documento, $"admite hasta {PredicadosMaximos} comparaciones.");
        return normalizada;
    }

    private static CondicionDeExigencia Validar(CondicionDeExigencia nodo, TipoVinculo? tipo, string documento, IReadOnlyList<AtributoDeRespuesta>? respuestas,
        int profundidad, ref int predicados)
    {
        if (profundidad > ProfundidadMaxima)
            throw Invalida(documento, $"admite hasta {ProfundidadMaxima} niveles de agrupación.");

        switch (nodo.Tipo)
        {
            case TipoNodoCondicion.Y or TipoNodoCondicion.O:
            {
                if (nodo.Nodos is not { Count: > 0 } hijos)
                    throw Invalida(documento, "un grupo «Y»/«O» necesita al menos una condición.");
                var normalizados = new List<CondicionDeExigencia>();
                foreach (var hijo in hijos)
                    normalizados.Add(Validar(hijo, tipo, documento, respuestas, profundidad + 1, ref predicados));
                return new CondicionDeExigencia(nodo.Tipo, normalizados);
            }
            case TipoNodoCondicion.No:
                if (nodo.Nodos is not { Count: 1 } unico)
                    throw Invalida(documento, "«No» niega exactamente una condición.");
                return new CondicionDeExigencia(TipoNodoCondicion.No, [Validar(unico[0], tipo, documento, respuestas, profundidad + 1, ref predicados)]);
            case TipoNodoCondicion.Predicado:
                predicados++;
                return ValidarPredicado(nodo, tipo, documento, respuestas);
            default:
                throw Invalida(documento, "tiene un nodo desconocido.");
        }
    }

    private static CondicionDeExigencia ValidarPredicado(CondicionDeExigencia nodo, TipoVinculo? tipo, string documento,
        IReadOnlyList<AtributoDeRespuesta>? respuestas)
    {
        var atributo = (nodo.Atributo ?? string.Empty).Trim();
        var clase = ClaseDe(atributo, tipo, documento, respuestas);
        if (nodo.Operador is not { } operador)
            throw Invalida(documento, $"falta el operador de «{atributo}».");
        if (!clase.Operadores.Contains(operador))
            throw Invalida(documento, $"«{atributo}» no admite el operador {operador}.");

        var valores = (nodo.Valores ?? []).Select(v => (v ?? string.Empty).Trim()).ToList();
        var esperados = operador switch
        {
            OperadorCondicion.Existe => (0, 0),
            OperadorCondicion.Entre => (2, 2),
            OperadorCondicion.En or OperadorCondicion.NoEn or OperadorCondicion.ContieneAlguno or OperadorCondicion.ContieneTodos => (1, 50),
            _ => (1, 1)
        };
        if (valores.Count < esperados.Item1 || valores.Count > esperados.Item2)
            throw Invalida(documento, operador == OperadorCondicion.Existe
                ? $"«{atributo}» existe no lleva valores."
                : $"«{atributo}» {operador} necesita {(esperados.Item1 == esperados.Item2 ? esperados.Item1.ToString(CultureInfo.InvariantCulture) : "al menos un")} valor(es).");

        var normalizados = valores.Select(v => clase.Normalizar(v) ?? throw Invalida(documento, $"«{v}» no es un valor válido para «{atributo}».")).ToList();
        if (operador == OperadorCondicion.Entre && Comparar(clase.Tipo, normalizados[0], normalizados[1]) > 0)
            throw Invalida(documento, $"en «{atributo}» entre, el primer valor debe ser el menor.");

        return CondicionDeExigencia.Predicado(atributo, operador, [.. normalizados.Distinct(StringComparer.Ordinal)]);
    }

    /// <summary>Clase de valor de un atributo: su tipo, los operadores que admite y cómo normaliza un valor (nulo ⇒ inválido).</summary>
    private sealed record Clase(TipoAtributo Tipo, IReadOnlySet<OperadorCondicion> Operadores, Func<string, string?> Normalizar);

    private static readonly HashSet<OperadorCondicion> DeTexto = [OperadorCondicion.Igual, OperadorCondicion.Distinto, OperadorCondicion.En, OperadorCondicion.NoEn];
    private static readonly HashSet<OperadorCondicion> DeBooleano = [OperadorCondicion.Igual, OperadorCondicion.Distinto];
    private static readonly HashSet<OperadorCondicion> DeOrden =
        [OperadorCondicion.Igual, OperadorCondicion.Distinto, OperadorCondicion.Mayor, OperadorCondicion.Menor, OperadorCondicion.Entre];
    private static readonly HashSet<OperadorCondicion> DeLista = [OperadorCondicion.ContieneAlguno, OperadorCondicion.ContieneTodos];

    private static Clase ClaseDe(string atributo, TipoVinculo? tipo, string documento, IReadOnlyList<AtributoDeRespuesta>? respuestas = null)
    {
        switch (atributo)
        {
            case TipoPersona:
                return new Clase(TipoAtributo.Opcion, DeTexto, v => TiposDePersona.FirstOrDefault(t => string.Equals(t, v, StringComparison.OrdinalIgnoreCase)));
            case Pais or TipoIdentificacion or TipoVinculo:
                return new Clase(TipoAtributo.Texto, DeTexto, v => v.Length == 0 ? null : v.ToUpperInvariant());
            case EsExtranjero:
                return new Clase(TipoAtributo.Booleano, DeBooleano, NormalizarBooleano);
        }

        if (respuestas is not null && atributo.StartsWith(PrefijoRespuestas, StringComparison.Ordinal))
        {
            var pregunta = respuestas.FirstOrDefault(r => r.Clave == atributo[PrefijoRespuestas.Length..])
                           ?? throw Invalida(documento, $"«{atributo}» no es una pregunta anterior del cuestionario.");
            return ClaseDeAtributo(pregunta.Tipo, pregunta.Opciones ?? [], pregunta.Clave, documento);
        }

        if (atributo.StartsWith(PrefijoFicha, StringComparison.Ordinal))
        {
            if (respuestas is not null)
                throw Invalida(documento, $"no puede mirar la ficha del tercero («{atributo}»): eso solo se usa en los requisitos y la selección de un flujo.");
            var campo = CamposDeFicha.Buscar(atributo)
                        ?? throw Invalida(documento, $"«{atributo}» no es un campo de la ficha que se pueda usar en una condición.");
            return ClaseDeCampoDeFicha(campo);
        }

        if (!atributo.StartsWith(PrefijoAtributos, StringComparison.Ordinal))
            throw Invalida(documento, $"«{atributo}» no es un atributo que se pueda usar en una condición.");

        var clave = atributo[PrefijoAtributos.Length..];
        var permitido = tipo?.AtributosPermitidos.FirstOrDefault(a => a.Clave == clave)
                        ?? throw Invalida(documento, $"el tipo de vínculo {tipo?.Codigo ?? "del flujo"} no tiene el atributo «{clave}».");
        return ClaseDeAtributo(permitido.Tipo, permitido.Opciones ?? [], clave, documento);
    }

    private static Clase ClaseDeAtributo(TipoAtributo tipo, IReadOnlyList<string> opciones, string clave, string documento)
    {
        var conExiste = (HashSet<OperadorCondicion> baseOps) => new HashSet<OperadorCondicion>(baseOps) { OperadorCondicion.Existe };
        return tipo switch
        {
            TipoAtributo.Texto => new Clase(TipoAtributo.Texto, conExiste(DeTexto), v => v.Length == 0 ? null : v),
            TipoAtributo.Opcion => new Clase(TipoAtributo.Opcion, conExiste(DeTexto), v => opciones.FirstOrDefault(o => o == v)),
            TipoAtributo.ListaOpciones => new Clase(TipoAtributo.ListaOpciones, conExiste(DeLista), v => opciones.FirstOrDefault(o => o == v)),
            TipoAtributo.Booleano => new Clase(TipoAtributo.Booleano, conExiste(DeBooleano), NormalizarBooleano),
            TipoAtributo.Numero => new Clase(TipoAtributo.Numero, conExiste(DeOrden),
                v => decimal.TryParse(v, NumberStyles.Number & ~NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var n)
                    ? n.ToString(CultureInfo.InvariantCulture) : null),
            TipoAtributo.Fecha => new Clase(TipoAtributo.Fecha, conExiste(DeOrden),
                v => DateOnly.TryParseExact(v, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)
                    ? f.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null),
            _ => throw Invalida(documento, $"«{clave}» tiene un tipo que no se puede comparar.")
        };
    }

    /// <summary>Clase de valor de un campo de la ficha: sus operadores salen de su tipo y sus valores se normalizan como los del catálogo del que vienen.</summary>
    private static Clase ClaseDeCampoDeFicha(CampoDeFichaExigible campo)
    {
        var operadores = new HashSet<OperadorCondicion>(campo.Tipo switch
        {
            TipoAtributo.ListaOpciones => DeLista,
            TipoAtributo.Booleano => DeBooleano,
            _ => DeTexto
        }) { OperadorCondicion.Existe };
        return new Clase(campo.Tipo, operadores, campo.Normalizar);
    }

    /// <summary>Los operadores que admite un campo de la ficha según su tipo (listas: contiene alguno o todos; texto y opciones: es, es uno de…; booleanos: es), y «existe».</summary>
    public static IReadOnlyCollection<OperadorCondicion> OperadoresDe(CampoDeFichaExigible campo) => ClaseDeCampoDeFicha(campo).Operadores;

    /// <summary>¿Alguna comparación de la condición mira la ficha del tercero?</summary>
    public static bool MencionaFicha(CondicionDeExigencia? condicion) =>
        condicion is not null && (condicion.Tipo == TipoNodoCondicion.Predicado
            ? (condicion.Atributo ?? string.Empty).StartsWith(PrefijoFicha, StringComparison.Ordinal)
            : (condicion.Nodos ?? []).Any(MencionaFicha));

    /// <summary>Las comparaciones sobre campos de la ficha que trae la condición, con los valores que citan (para cargar de antemano los catálogos que mencionan).</summary>
    public static IEnumerable<(CampoDeFichaExigible Campo, IReadOnlyList<string> Valores)> ComparacionesDeFicha(CondicionDeExigencia? condicion)
    {
        if (condicion is null)
            yield break;
        if (condicion.Tipo == TipoNodoCondicion.Predicado)
        {
            if (CamposDeFicha.Buscar(condicion.Atributo) is { } campo)
                yield return (campo, condicion.Valores ?? []);
            yield break;
        }

        foreach (var hijo in condicion.Nodos ?? [])
        {
            foreach (var comparacion in ComparacionesDeFicha(hijo))
                yield return comparacion;
        }
    }

    private static string? NormalizarBooleano(string v) =>
        bool.TryParse(v, out var b) ? (b ? "true" : "false") : null;

    /// <summary>Compara dos valores ya normalizados de un atributo ordenable (número o fecha).</summary>
    internal static int Comparar(TipoAtributo tipo, string a, string b) => tipo == TipoAtributo.Numero
        ? decimal.Parse(a, CultureInfo.InvariantCulture).CompareTo(decimal.Parse(b, CultureInfo.InvariantCulture))
        : string.CompareOrdinal(a, b); // yyyy-MM-dd ordena como texto

    private static ReglaDeNegocioException Invalida(string documento, string detalle) =>
        ReglaDeNegocioException.Validacion("condicion-invalida", $"La condición de {documento} {detalle}");
}

/// <summary>
/// Una comparación sobre un campo de la ficha que se cumple y por qué (EF-6): <see cref="Valores"/> son los de la condición que el tercero declaró
/// (vacío con «es distinto», «no está en» o «existe»: solo declaró el campo).
/// </summary>
public sealed record CoincidenciaDeFicha(CampoDeFichaExigible Campo, OperadorCondicion Operador, IReadOnlyList<string> Valores);

/// <summary>
/// Qué requisitos del flujo se le piden a este tercero en este vínculo (docs/03 §12): función pura, sin estado. Un
/// atributo del vínculo sin valor solo cumple <c>Distinto</c>, <c>NoEn</c> y la negación de <c>Existe</c>: ante la duda
/// sobre un dato faltante, «se pide si es X» no pide y «se pide salvo que sea X» sí pide.
/// </summary>
public static class EvaluadorDeExigencia
{
    /// <summary>
    /// Los requisitos que se le piden a este tercero en este vínculo: los que cumplen su condición y, si piden una sección de
    /// la ficha, que la sección le aplique a su tipo de persona (la natural no tiene Legal ni Financiera: <c>NoAplica</c>, FM-17).
    /// </summary>
    public static IReadOnlyList<RequisitoDelFlujo> Filtrar(IEnumerable<RequisitoDelFlujo> requisitos, ContextoDeExigencia contexto) =>
        [.. requisitos.Where(r => Aplica(r.Condicion, contexto) && SeccionAplica(r, contexto))];

    private static bool SeccionAplica(RequisitoDelFlujo requisito, ContextoDeExigencia contexto) =>
        requisito.Seccion is null || Ficha.CatalogoDeSecciones.Buscar(requisito.Seccion)?.Obligatoria(contexto.TipoPersona) != false;

    public static bool Aplica(CondicionDeExigencia? condicion, ContextoDeExigencia contexto) => condicion is null || Evaluar(condicion, contexto);

    /// <summary>
    /// Lo que de la ficha del tercero hizo que se cumpla la condición (EF-6), para decirle por qué se le pide algo: por cada comparación sobre un campo de la
    /// ficha que se cumple y que aporta (las de un «O» solo si ellas se cumplen; las de un «No» no se explican), el campo y los valores de la condición que
    /// el tercero tiene declarados. Con «es distinto», «no está en» o «existe» no hay valores: solo se sabe que declaró el campo. Se llama con una condición que
    /// ya se cumple.
    /// </summary>
    public static IReadOnlyList<CoincidenciaDeFicha> Coincidencias(CondicionDeExigencia? condicion, ContextoDeExigencia contexto)
    {
        if (condicion is null)
            return [];
        switch (condicion.Tipo)
        {
            case TipoNodoCondicion.Y:
                return [.. (condicion.Nodos ?? []).SelectMany(n => Coincidencias(n, contexto))];
            case TipoNodoCondicion.O:
                return [.. (condicion.Nodos ?? []).Where(n => Evaluar(n, contexto)).SelectMany(n => Coincidencias(n, contexto))];
            case TipoNodoCondicion.Predicado:
                if (CamposDeFicha.Buscar(condicion.Atributo) is not { } campo || !Predicado(condicion, contexto))
                    return [];
                var (presente, actual) = Leer(campo.Ruta, contexto);
                if (!presente)
                    return [];
                var operador = condicion.Operador ?? OperadorCondicion.Igual;
                var valores = condicion.Valores ?? [];
                IReadOnlyList<string> coinciden = operador switch
                {
                    OperadorCondicion.ContieneAlguno or OperadorCondicion.ContieneTodos when actual.Lista is { } lista => [.. valores.Where(lista.Contains)],
                    OperadorCondicion.Igual or OperadorCondicion.En when actual.Escalar is { } escalar => [.. valores.Where(v => string.Equals(v, escalar, StringComparison.Ordinal))],
                    _ => []
                };
                return [new CoincidenciaDeFicha(campo, operador, coinciden)];
            default:
                return [];
        }
    }

    private static bool Evaluar(CondicionDeExigencia nodo, ContextoDeExigencia contexto) => nodo.Tipo switch
    {
        TipoNodoCondicion.Y => (nodo.Nodos ?? []).All(n => Evaluar(n, contexto)),
        TipoNodoCondicion.O => (nodo.Nodos ?? []).Any(n => Evaluar(n, contexto)),
        TipoNodoCondicion.No => !(nodo.Nodos is { Count: 1 } unico && Evaluar(unico[0], contexto)),
        TipoNodoCondicion.Predicado => Predicado(nodo, contexto),
        _ => false
    };

    private static bool Predicado(CondicionDeExigencia nodo, ContextoDeExigencia contexto)
    {
        var valores = nodo.Valores ?? [];
        var operador = nodo.Operador ?? OperadorCondicion.Igual;
        var (presente, actual) = Leer(nodo.Atributo ?? string.Empty, contexto);
        if (!presente)
            return operador is OperadorCondicion.Distinto or OperadorCondicion.NoEn;
        if (operador == OperadorCondicion.Existe)
            return true;

        var lista = actual.Lista;
        var escalar = actual.Escalar;
        return operador switch
        {
            OperadorCondicion.Igual => escalar is not null && Igual(actual, escalar, valores[0]),
            OperadorCondicion.Distinto => escalar is null || !Igual(actual, escalar, valores[0]),
            OperadorCondicion.En => escalar is not null && valores.Any(v => Igual(actual, escalar, v)),
            OperadorCondicion.NoEn => escalar is null || !valores.Any(v => Igual(actual, escalar, v)),
            OperadorCondicion.ContieneAlguno => lista is not null && valores.Any(lista.Contains),
            OperadorCondicion.ContieneTodos => lista is not null && valores.All(lista.Contains),
            OperadorCondicion.Mayor => actual.Ordenable is { } m && AtributosDeExigencia.Comparar(m, escalar!, valores[0]) > 0,
            OperadorCondicion.Menor => actual.Ordenable is { } n && AtributosDeExigencia.Comparar(n, escalar!, valores[0]) < 0,
            OperadorCondicion.Entre => actual.Ordenable is { } e && AtributosDeExigencia.Comparar(e, escalar!, valores[0]) >= 0 &&
                                       AtributosDeExigencia.Comparar(e, escalar!, valores[1]) <= 0,
            _ => false
        };
    }

    /// <summary>Valor leído del contexto: texto escalar (normalizado como en la validación), lista o nada.</summary>
    private sealed record Valor(string? Escalar, IReadOnlyList<string>? Lista, TipoAtributo? Ordenable);

    /// <summary>Números por valor (<c>1.0</c> = <c>1</c>); lo demás, texto exacto (ya normalizado al validar).</summary>
    private static bool Igual(Valor actual, string escalar, string esperado) => actual.Ordenable == TipoAtributo.Numero
        ? AtributosDeExigencia.Comparar(TipoAtributo.Numero, escalar, esperado) == 0
        : string.Equals(escalar, esperado, StringComparison.Ordinal);

    private static (bool Presente, Valor Valor) Leer(string atributo, ContextoDeExigencia c)
    {
        switch (atributo)
        {
            case AtributosDeExigencia.TipoPersona:
                return (true, new Valor(c.TipoPersona.ToString(), null, null));
            case AtributosDeExigencia.Pais:
                return (true, new Valor(c.Pais.ToUpperInvariant(), null, null));
            case AtributosDeExigencia.TipoIdentificacion:
                return (true, new Valor(c.TipoIdentificacion.ToUpperInvariant(), null, null));
            case AtributosDeExigencia.TipoVinculo:
                return (true, new Valor(c.TipoVinculo.ToUpperInvariant(), null, null));
            case AtributosDeExigencia.EsExtranjero:
                return (true, new Valor(c.EsExtranjero ? "true" : "false", null, null));
        }

        JsonElement json;
        if (atributo.StartsWith(AtributosDeExigencia.PrefijoFicha, StringComparison.Ordinal))
        {
            if (c.Ficha is null || !c.Ficha.TryGetValue(atributo, out json))
                return (false, new Valor(null, null, null));
        }
        else if (atributo.StartsWith(AtributosDeExigencia.PrefijoRespuestas, StringComparison.Ordinal))
        {
            if (c.Respuestas is null || !c.Respuestas.TryGetValue(atributo[AtributosDeExigencia.PrefijoRespuestas.Length..], out json))
                return (false, new Valor(null, null, null));
        }
        else if (!atributo.StartsWith(AtributosDeExigencia.PrefijoAtributos, StringComparison.Ordinal) ||
                 !c.Atributos.TryGetValue(atributo[AtributosDeExigencia.PrefijoAtributos.Length..], out json))
        {
            return (false, new Valor(null, null, null));
        }

        return json.ValueKind switch
        {
            JsonValueKind.String when DateOnly.TryParseExact(json.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _) =>
                (true, new Valor(json.GetString(), null, TipoAtributo.Fecha)),
            JsonValueKind.String => (true, new Valor(json.GetString(), null, null)),
            JsonValueKind.Number when json.TryGetDecimal(out var n) => (true, new Valor(n.ToString(CultureInfo.InvariantCulture), null, TipoAtributo.Numero)),
            JsonValueKind.True => (true, new Valor("true", null, null)),
            JsonValueKind.False => (true, new Valor("false", null, null)),
            JsonValueKind.Array => (true, new Valor(null, [.. json.EnumerateArray().Where(e => e.ValueKind == JsonValueKind.String).Select(e => e.GetString()!)], null)),
            _ => (false, new Valor(null, null, null))
        };
    }
}
