using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Configuracion;
using Validalo.Dominio.Flujos;

namespace Validalo.Dominio.Evaluaciones;

/// <summary>Cómo se responde una pregunta (CE-2). Sí/No, opción única y múltiple y escala se puntúan por opción o por valor; número, por rangos; texto y adjunto no puntúan.</summary>
public enum TipoDePregunta
{
    SiNo,
    OpcionUnica,
    OpcionMultiple,
    Escala,
    Numero,
    Texto,
    Adjunto
}

/// <summary>Quién responde un cuestionario (CE-4): el tercero (autoevaluación, en el portal) o una persona de la empresa (evaluador interno).</summary>
public enum QuienResponde
{
    Tercero,
    Evaluador
}

/// <summary>
/// Qué pasa cuando la evaluación sale reprobada (puntaje bajo el umbral o una eliminatoria) (CE-8): <see cref="Observar"/> deja la
/// observación visible en el expediente y no frena su cierre; <see cref="Bloquear"/> impide aprobar el expediente mientras la evaluación no
/// esté aprobada.
/// </summary>
public enum EfectoDeLaEvaluacion
{
    Observar,
    Bloquear
}

public enum EstadoCuestionarioVersion
{
    Borrador,
    Publicada,
    Retirada
}

/// <summary>
/// Opción de una pregunta de opciones. <see cref="Puntaje"/> son puntos relativos (la mejor opción vale el 100 % de la pregunta);
/// <see cref="Elimina"/> marca la opción que reprueba la evaluación entera si se elige (pregunta eliminatoria).
/// </summary>
public sealed record OpcionDePregunta(string Codigo, string Texto, decimal Puntaje, bool Elimina = false);

/// <summary>Tramo de una pregunta numérica: <c>Desde</c> y <c>Hasta</c> inclusive (nulos = sin límite) con sus puntos relativos y si elimina.</summary>
public sealed record RangoDeNumero(decimal? Desde, decimal? Hasta, decimal Puntaje, bool Elimina = false);

/// <summary>Escala de enteros de <see cref="Minimo"/> a <see cref="Maximo"/> (el mayor es el mejor); por debajo de <see cref="MinimoAceptable"/> elimina.</summary>
public sealed record EscalaDePregunta(int Minimo, int Maximo, int? MinimoAceptable = null);

/// <summary>
/// Pregunta de un cuestionario. <see cref="Codigo"/> es su identificador estable (lo usan las condiciones de las preguntas siguientes y las
/// respuestas). <see cref="Peso"/> cuenta dentro de su sección (0 = informativa). <see cref="Condicion"/> nula = siempre visible; si no,
/// solo se muestra al tercero y vínculo que la cumplen y con las respuestas anteriores que pide.
/// </summary>
public sealed record PreguntaDeCuestionario(
    string Codigo,
    string Texto,
    TipoDePregunta Tipo,
    bool Obligatoria,
    decimal Peso,
    bool Eliminatoria,
    IReadOnlyList<OpcionDePregunta>? Opciones = null,
    EscalaDePregunta? Escala = null,
    IReadOnlyList<RangoDeNumero>? Rangos = null,
    CondicionDeExigencia? Condicion = null,
    string? Ayuda = null,
    bool PermiteComentario = false)
{
    /// <summary>Cuenta en el puntaje (peso mayor que cero).</summary>
    [JsonIgnore]
    public bool Puntua => Peso > 0;
}

/// <summary>Sección de un cuestionario con su peso dentro del total y, opcionalmente, la condición con la que se muestra.</summary>
public sealed record SeccionDeCuestionario(
    string Codigo,
    string Nombre,
    decimal Peso,
    IReadOnlyList<PreguntaDeCuestionario> Preguntas,
    CondicionDeExigencia? Condicion = null,
    string? Descripcion = null);

/// <summary>
/// Contenido versionado de un cuestionario (lo que se congela al publicar, CE-1): secciones y preguntas con sus pesos y puntajes, el umbral
/// de aprobación (0 a 100), quién lo responde y cada cuánto se repite (opcional).
/// </summary>
public sealed record DefinicionDeCuestionario(
    IReadOnlyList<SeccionDeCuestionario> Secciones,
    decimal UmbralDeAprobacion,
    QuienResponde Responde,
    int? ReevaluarCadaMeses = null,
    string? Descripcion = null)
{
    public const int MaximoSecciones = 20;
    public const int MaximoPreguntasPorSeccion = 50;
    public const int MaximoPreguntas = 200;
    public const int MaximoOpciones = 20;
    public const int MaximoRangos = 10;
    public const int MaximoNiveles = 10;
    public const decimal MaximoPeso = 1000m;
    public const decimal MaximoPuntajeDeOpcion = 1000m;
    public const int MaximoMesesDeReevaluacion = 60;
    public const int LongitudMaximaTexto = 500;
    public const int LongitudMaximaAyuda = 1000;

    private static readonly Regex Codigos = new("^[A-Za-z][A-Za-z0-9_]{0,29}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>Códigos de las opciones de una pregunta Sí/No.</summary>
    public const string CodigoSi = "si";

    public const string CodigoNo = "no";

    [JsonIgnore]
    public IEnumerable<PreguntaDeCuestionario> Preguntas => Secciones.SelectMany(s => s.Preguntas);

    public PreguntaDeCuestionario? Buscar(string codigo) => Preguntas.FirstOrDefault(p => p.Codigo == codigo);

    public SeccionDeCuestionario? SeccionDe(string codigoPregunta) => Secciones.FirstOrDefault(s => s.Preguntas.Any(p => p.Codigo == codigoPregunta));

    /// <summary>
    /// Valida y normaliza (textos recortados, códigos vacíos generados): 422 <c>secciones-requeridas</c>, <c>seccion-invalida</c>,
    /// <c>preguntas-requeridas</c>, <c>pregunta-invalida</c>, <c>codigo-invalido</c>, <c>codigo-duplicado</c>, <c>peso-invalido</c>,
    /// <c>opciones-invalidas</c>, <c>puntaje-invalido</c>, <c>escala-invalida</c>, <c>rangos-invalidos</c>, <c>pregunta-sin-puntaje</c>,
    /// <c>eliminatoria-no-aplica</c>, <c>eliminatoria-obligatoria</c>, <c>eliminatoria-sin-criterio</c>, <c>condicion-invalida</c>,
    /// <c>sin-preguntas-puntuadas</c>, <c>umbral-invalido</c>, <c>reevaluacion-invalida</c>, <c>quien-responde-invalido</c>.
    /// Los errores de una pregunta traen en <c>datos.pregunta</c> su código.
    /// </summary>
    public DefinicionDeCuestionario Validar()
    {
        if (!Enum.IsDefined(Responde))
            throw ReglaDeNegocioException.Validacion("quien-responde-invalido", "Quién responde es Tercero o Evaluador.");
        if (UmbralDeAprobacion is < 0 or > 100)
            throw ReglaDeNegocioException.Validacion("umbral-invalido", "El umbral de aprobación va de 0 a 100.");
        if (ReevaluarCadaMeses is < 1 or > MaximoMesesDeReevaluacion)
            throw ReglaDeNegocioException.Validacion("reevaluacion-invalida", $"La reevaluación periódica va de 1 a {MaximoMesesDeReevaluacion} meses (vacía = no se repite).");
        if (Secciones is null || Secciones.Count == 0 || Secciones.Count > MaximoSecciones)
            throw ReglaDeNegocioException.Validacion("secciones-requeridas", $"El cuestionario necesita entre 1 y {MaximoSecciones} secciones.");
        if (Secciones.Sum(s => s.Preguntas?.Count ?? 0) > MaximoPreguntas)
            throw ReglaDeNegocioException.Validacion("preguntas-demasiadas", $"El cuestionario admite hasta {MaximoPreguntas} preguntas.");

        // Códigos: los dados deben ser únicos y bien formados; los vacíos se generan sin chocar con los dados.
        var usados = new HashSet<string>(StringComparer.Ordinal);
        foreach (var codigo in Secciones.SelectMany(s => new[] { s.Codigo }.Concat((s.Preguntas ?? []).Select(p => p.Codigo))).Where(c => !string.IsNullOrWhiteSpace(c)))
            if (!usados.Add(codigo.Trim()))
                throw ReglaDeNegocioException.Validacion("codigo-duplicado", $"El código {codigo.Trim()} se repite en el cuestionario.");

        var siguiente = new Dictionary<char, int> { ['S'] = 0, ['P'] = 0 };
        string Generar(char prefijo)
        {
            string codigo;
            do
            {
                siguiente[prefijo]++;
                codigo = $"{prefijo}{siguiente[prefijo]}";
            } while (!usados.Add(codigo));

            return codigo;
        }

        var secciones = new List<SeccionDeCuestionario>();
        var anteriores = new List<AtributoDeRespuesta>();
        var puntuadas = 0;
        foreach (var seccion in Secciones)
        {
            var codigoSeccion = string.IsNullOrWhiteSpace(seccion.Codigo) ? Generar('S') : seccion.Codigo.Trim();
            var nombre = (seccion.Nombre ?? string.Empty).Trim();
            if (nombre.Length is 0 or > 150 || !Codigos.IsMatch(codigoSeccion))
                throw ReglaDeNegocioException.Validacion("seccion-invalida", "Cada sección lleva un nombre (hasta 150 caracteres) y un código de letras, números o guion bajo.");
            if (seccion.Peso is < 0 or > MaximoPeso)
                throw ReglaDeNegocioException.Validacion("peso-invalido", $"El peso de la sección «{nombre}» va de 0 a {MaximoPeso:0}.");
            if (seccion.Preguntas is null || seccion.Preguntas.Count == 0 || seccion.Preguntas.Count > MaximoPreguntasPorSeccion)
                throw ReglaDeNegocioException.Validacion("preguntas-requeridas", $"La sección «{nombre}» necesita entre 1 y {MaximoPreguntasPorSeccion} preguntas.");

            // La condición de una sección solo mira preguntas de secciones anteriores.
            var condicionDeSeccion = AtributosDeExigencia.Validar(seccion.Condicion, null, $"la sección «{nombre}»", [.. anteriores]);
            var delaSeccion = new List<AtributoDeRespuesta>();
            var preguntas = new List<PreguntaDeCuestionario>();
            foreach (var pregunta in seccion.Preguntas)
            {
                var codigoPregunta = string.IsNullOrWhiteSpace(pregunta.Codigo) ? Generar('P') : pregunta.Codigo.Trim();
                try
                {
                    var validada = ValidarPregunta(pregunta with { Codigo = codigoPregunta }, [.. anteriores, .. delaSeccion]);
                    preguntas.Add(validada);
                    if (validada.Puntua)
                        puntuadas++;
                    if (AtributoDe(validada) is { } atributo)
                        delaSeccion.Add(atributo);
                }
                catch (ReglaDeNegocioException ex) when (ex.Tipo == TipoFalla.Validacion && ex.Datos?.ContainsKey("pregunta") != true)
                {
                    throw new ReglaDeNegocioException(ex.Tipo, ex.Codigo, ex.Message)
                    {
                        Datos = new Dictionary<string, object?>(ex.Datos ?? new Dictionary<string, object?>()) { ["pregunta"] = codigoPregunta }
                    };
                }
            }

            anteriores.AddRange(delaSeccion);
            secciones.Add(seccion with
            {
                Codigo = codigoSeccion, Nombre = nombre, Preguntas = preguntas, Condicion = condicionDeSeccion,
                Descripcion = Recortar(seccion.Descripcion, LongitudMaximaTexto)
            });
        }

        if (puntuadas == 0)
            throw ReglaDeNegocioException.Validacion("sin-preguntas-puntuadas", "Al menos una pregunta debe puntuar (peso mayor que cero).");
        if (!secciones.Any(s => s.Peso > 0 && s.Preguntas.Any(p => p.Puntua)))
            throw ReglaDeNegocioException.Validacion("sin-preguntas-puntuadas", "Al menos una sección con peso debe tener una pregunta que puntúe.");

        return this with { Secciones = secciones, Descripcion = Recortar(Descripcion, LongitudMaximaTexto) };
    }

    /// <summary>Cómo ve una condición la respuesta a esta pregunta (nulo si no se puede condicionar: los adjuntos).</summary>
    private static AtributoDeRespuesta? AtributoDe(PreguntaDeCuestionario pregunta) => pregunta.Tipo switch
    {
        TipoDePregunta.SiNo => new AtributoDeRespuesta(pregunta.Codigo, TipoAtributo.Opcion, [CodigoSi, CodigoNo]),
        TipoDePregunta.OpcionUnica => new AtributoDeRespuesta(pregunta.Codigo, TipoAtributo.Opcion, [.. pregunta.Opciones!.Select(o => o.Codigo)]),
        TipoDePregunta.OpcionMultiple => new AtributoDeRespuesta(pregunta.Codigo, TipoAtributo.ListaOpciones, [.. pregunta.Opciones!.Select(o => o.Codigo)]),
        TipoDePregunta.Escala or TipoDePregunta.Numero => new AtributoDeRespuesta(pregunta.Codigo, TipoAtributo.Numero, null),
        TipoDePregunta.Texto => new AtributoDeRespuesta(pregunta.Codigo, TipoAtributo.Texto, null),
        _ => null
    };

    private static PreguntaDeCuestionario ValidarPregunta(PreguntaDeCuestionario p, IReadOnlyList<AtributoDeRespuesta> anteriores)
    {
        var texto = (p.Texto ?? string.Empty).Trim();
        if (texto.Length is 0 or > LongitudMaximaTexto || !Codigos.IsMatch(p.Codigo))
            throw ReglaDeNegocioException.Validacion("pregunta-invalida", $"Cada pregunta lleva un texto (hasta {LongitudMaximaTexto} caracteres) y un código de letras, números o guion bajo.");
        if (!Enum.IsDefined(p.Tipo))
            throw ReglaDeNegocioException.Validacion("pregunta-invalida", "El tipo de la pregunta no existe.");
        if (p.Peso is < 0 or > MaximoPeso)
            throw ReglaDeNegocioException.Validacion("peso-invalido", $"El peso de una pregunta va de 0 a {MaximoPeso:0}.");
        if (p.Eliminatoria && p.Tipo is TipoDePregunta.Texto or TipoDePregunta.Adjunto)
            throw ReglaDeNegocioException.Validacion("eliminatoria-no-aplica", "Una pregunta de texto o de adjunto no puede ser eliminatoria.");
        if (p.Eliminatoria && !p.Obligatoria)
            throw ReglaDeNegocioException.Validacion("eliminatoria-obligatoria", "Una pregunta eliminatoria es obligatoria: sin respuesta no se puede saber si elimina.");

        var opciones = p.Tipo switch
        {
            TipoDePregunta.SiNo => OpcionesDeSiNo(p.Opciones),
            TipoDePregunta.OpcionUnica or TipoDePregunta.OpcionMultiple => ValidarOpciones(p.Opciones),
            _ => null
        };
        var escala = p.Tipo == TipoDePregunta.Escala ? ValidarEscala(p.Escala) : null;
        var rangos = p.Tipo == TipoDePregunta.Numero ? ValidarRangos(p.Rangos) : null;
        if ((p.Tipo != TipoDePregunta.Escala && p.Escala is not null) || (p.Tipo != TipoDePregunta.Numero && p.Rangos is { Count: > 0 }) ||
            (opciones is null && p.Opciones is { Count: > 0 }))
            throw ReglaDeNegocioException.Validacion("pregunta-invalida", "La pregunta trae opciones, escala o rangos que su tipo no usa.");

        // Lo que puntúa necesita con qué puntuar; lo que no puntúa (texto, adjunto) no lleva peso.
        if (p.Peso > 0)
        {
            var puede = p.Tipo switch
            {
                TipoDePregunta.Texto or TipoDePregunta.Adjunto => false,
                TipoDePregunta.Escala => true,
                TipoDePregunta.Numero => rangos is { Count: > 0 } && rangos.Any(r => r.Puntaje > 0),
                _ => opciones!.Any(o => o.Puntaje > 0)
            };
            if (!puede)
                throw ReglaDeNegocioException.Validacion("pregunta-sin-puntaje", "Una pregunta con peso necesita con qué puntuar: al menos una opción o rango con puntaje, o una escala.");
        }

        if (p.Eliminatoria)
        {
            var criterio = p.Tipo switch
            {
                TipoDePregunta.Escala => escala!.MinimoAceptable is not null,
                TipoDePregunta.Numero => rangos is not null && rangos.Any(r => r.Elimina),
                _ => opciones!.Any(o => o.Elimina)
            };
            if (!criterio)
                throw ReglaDeNegocioException.Validacion("eliminatoria-sin-criterio", "Una pregunta eliminatoria necesita decir qué respuesta elimina (una opción o rango, o el mínimo aceptable de la escala).");
        }
        else if ((opciones?.Any(o => o.Elimina) ?? false) || (rangos?.Any(r => r.Elimina) ?? false) || escala?.MinimoAceptable is not null)
        {
            throw ReglaDeNegocioException.Validacion("eliminatoria-sin-criterio", "Marca la pregunta como eliminatoria para que una respuesta pueda eliminar.");
        }

        var condicion = AtributosDeExigencia.Validar(p.Condicion, null, $"la pregunta {p.Codigo}", anteriores);
        return p with
        {
            Texto = texto, Opciones = opciones, Escala = escala, Rangos = rangos, Condicion = condicion,
            Ayuda = Recortar(p.Ayuda, LongitudMaximaAyuda)
        };
    }

    private static IReadOnlyList<OpcionDePregunta> OpcionesDeSiNo(IReadOnlyList<OpcionDePregunta>? opciones)
    {
        var si = opciones?.FirstOrDefault(o => o.Codigo == CodigoSi);
        var no = opciones?.FirstOrDefault(o => o.Codigo == CodigoNo);
        if (opciones is null || opciones.Count != 2 || si is null || no is null)
            throw ReglaDeNegocioException.Validacion("opciones-invalidas", "Una pregunta Sí/No tiene exactamente las opciones «si» y «no» (cada una con su puntaje).");
        ValidarPuntajes([si, no]);
        return [si with { Texto = "Sí" }, no with { Texto = "No" }];
    }

    private static IReadOnlyList<OpcionDePregunta> ValidarOpciones(IReadOnlyList<OpcionDePregunta>? opciones)
    {
        if (opciones is null || opciones.Count is < 2 or > MaximoOpciones)
            throw ReglaDeNegocioException.Validacion("opciones-invalidas", $"Una pregunta de opciones tiene entre 2 y {MaximoOpciones} opciones.");
        var vistas = new HashSet<string>(StringComparer.Ordinal);
        var resultado = new List<OpcionDePregunta>();
        foreach (var opcion in opciones)
        {
            var codigo = (opcion.Codigo ?? string.Empty).Trim();
            var texto = (opcion.Texto ?? string.Empty).Trim();
            if (!Codigos.IsMatch(codigo) || texto.Length is 0 or > 200)
                throw ReglaDeNegocioException.Validacion("opciones-invalidas", "Cada opción lleva un código (letras, números o guion bajo) y un texto de hasta 200 caracteres.");
            if (!vistas.Add(codigo))
                throw ReglaDeNegocioException.Validacion("opciones-invalidas", $"La opción {codigo} se repite.");
            resultado.Add(opcion with { Codigo = codigo, Texto = texto });
        }

        ValidarPuntajes(resultado);
        return resultado;
    }

    private static void ValidarPuntajes(IEnumerable<OpcionDePregunta> opciones)
    {
        if (opciones.Any(o => o.Puntaje is < 0 or > MaximoPuntajeDeOpcion))
            throw ReglaDeNegocioException.Validacion("puntaje-invalido", $"El puntaje de una opción va de 0 a {MaximoPuntajeDeOpcion:0}.");
    }

    private static EscalaDePregunta ValidarEscala(EscalaDePregunta? escala)
    {
        if (escala is null || escala.Maximo <= escala.Minimo || escala.Maximo - escala.Minimo + 1 > MaximoNiveles)
            throw ReglaDeNegocioException.Validacion("escala-invalida", $"La escala va de un mínimo a un máximo mayor, con hasta {MaximoNiveles} niveles.");
        if (escala.MinimoAceptable is { } aceptable && (aceptable <= escala.Minimo || aceptable > escala.Maximo))
            throw ReglaDeNegocioException.Validacion("escala-invalida", "El mínimo aceptable debe estar entre el segundo nivel y el máximo de la escala.");
        return escala;
    }

    private static IReadOnlyList<RangoDeNumero> ValidarRangos(IReadOnlyList<RangoDeNumero>? rangos)
    {
        if (rangos is null || rangos.Count == 0)
            return [];
        if (rangos.Count > MaximoRangos)
            throw ReglaDeNegocioException.Validacion("rangos-invalidos", $"Una pregunta numérica admite hasta {MaximoRangos} rangos.");
        foreach (var r in rangos)
        {
            if (r.Desde is { } desde && r.Hasta is { } hasta && desde > hasta)
                throw ReglaDeNegocioException.Validacion("rangos-invalidos", "En un rango, «desde» no puede ser mayor que «hasta».");
            if (r.Puntaje is < 0 or > MaximoPuntajeDeOpcion)
                throw ReglaDeNegocioException.Validacion("puntaje-invalido", $"El puntaje de un rango va de 0 a {MaximoPuntajeDeOpcion:0}.");
        }

        return rangos;
    }

    private static string? Recortar(string? texto, int maximo)
    {
        var limpio = texto?.Trim();
        return string.IsNullOrEmpty(limpio) ? null : limpio.Length > maximo ? limpio[..maximo] : limpio;
    }
}

/// <summary>Versión de un cuestionario. La publicada es inmutable y la copian las evaluaciones al asignarse; <c>Retirada</c> cuando otra la reemplaza.</summary>
public sealed class CuestionarioVersion
{
    public Guid Id { get; set; }

    public int Version { get; set; }

    public EstadoCuestionarioVersion Estado { get; set; }

    public DefinicionDeCuestionario Definicion { get; set; } = new([], 70, QuienResponde.Tercero);

    public DateTimeOffset CreadaEn { get; set; }

    public DateTimeOffset? PublicadaEn { get; set; }

    public DateTimeOffset? RetiradaEn { get; set; }
}

/// <summary>
/// Cuestionario de evaluación de una empresa (CE-1, docs/03 §12.2): versionado como los flujos. Publicar congela la versión; editar trabaja sobre
/// un borrador que nace como la versión siguiente. Es privado de la empresa (esquema <c>validacion</c>, aislado por <see cref="EmpresaId"/>, también
/// dentro de un mismo grupo).
/// </summary>
public sealed class Cuestionario
{
    private static readonly Regex Codigos = new("^[A-Z][A-Z0-9_]{1,39}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public Guid Id { get; set; }

    public Guid EmpresaId { get; set; }

    /// <summary>Mayúsculas, único en la empresa e inmutable.</summary>
    public string Codigo { get; set; } = string.Empty;

    public string Nombre { get; set; } = string.Empty;

    public List<CuestionarioVersion> Versiones { get; set; } = [];

    public DateTimeOffset CreadoEn { get; set; }

    public DateTimeOffset ActualizadoEn { get; set; }

    [JsonIgnore]
    public CuestionarioVersion? VersionPublicada => Versiones.FirstOrDefault(v => v.Estado == EstadoCuestionarioVersion.Publicada);

    [JsonIgnore]
    public CuestionarioVersion? Borrador => Versiones.FirstOrDefault(v => v.Estado == EstadoCuestionarioVersion.Borrador);

    /// <summary>La versión más reciente (borrador o la última publicada): base de una edición parcial.</summary>
    [JsonIgnore]
    public CuestionarioVersion Ultima => Versiones.OrderByDescending(v => v.Version).First();

    /// <summary>Crea el cuestionario con su primera versión en borrador. 422 <c>codigo-invalido</c>, <c>nombre-requerido</c> y los de <see cref="DefinicionDeCuestionario.Validar"/>.</summary>
    public static Cuestionario Crear(Guid empresaId, string codigo, string nombre, DefinicionDeCuestionario definicion, DateTimeOffset ahora)
    {
        var codigoNormalizado = (codigo ?? string.Empty).Trim().ToUpperInvariant();
        if (!Codigos.IsMatch(codigoNormalizado))
            throw ReglaDeNegocioException.Validacion("codigo-invalido",
                "El código del cuestionario debe empezar con letra y usar solo mayúsculas, números y guion bajo (máx. 40).");

        var cuestionario = new Cuestionario
        {
            Id = Guid.CreateVersion7(), EmpresaId = empresaId, Codigo = codigoNormalizado, Nombre = ValidarNombre(nombre), CreadoEn = ahora, ActualizadoEn = ahora
        };
        cuestionario.Versiones.Add(NuevaVersion(1, definicion.Validar(), ahora));
        return cuestionario;
    }

    /// <summary>Edita el borrador; si no hay, crea uno nuevo con la versión siguiente. Lo publicado no cambia nunca.</summary>
    public CuestionarioVersion EditarBorrador(string? nombre, DefinicionDeCuestionario definicion, DateTimeOffset ahora)
    {
        var validada = definicion.Validar();
        if (nombre is not null)
            Nombre = ValidarNombre(nombre);

        var borrador = Borrador;
        if (borrador is null)
        {
            borrador = NuevaVersion(Versiones.Max(v => v.Version) + 1, validada, ahora);
            Versiones.Add(borrador);
        }
        else
        {
            borrador.Definicion = validada;
        }

        ActualizadoEn = ahora;
        return borrador;
    }

    /// <summary>Publica el borrador (lo valida de nuevo) y retira la publicada anterior. Las evaluaciones ya asignadas conservan la versión que copiaron. 409 <c>sin-borrador</c>.</summary>
    public CuestionarioVersion Publicar(DateTimeOffset ahora)
    {
        var borrador = Borrador
                       ?? throw ReglaDeNegocioException.Conflicto("sin-borrador", "No hay un borrador por publicar; edita el cuestionario primero.");
        borrador.Definicion = borrador.Definicion.Validar();
        if (VersionPublicada is { } anterior)
        {
            anterior.Estado = EstadoCuestionarioVersion.Retirada;
            anterior.RetiradaEn = ahora;
        }

        borrador.Estado = EstadoCuestionarioVersion.Publicada;
        borrador.PublicadaEn = ahora;
        ActualizadoEn = ahora;
        return borrador;
    }

    private static CuestionarioVersion NuevaVersion(int numero, DefinicionDeCuestionario definicion, DateTimeOffset ahora) => new()
    {
        Id = Guid.CreateVersion7(), Version = numero, Estado = EstadoCuestionarioVersion.Borrador, Definicion = definicion, CreadaEn = ahora
    };

    private static string ValidarNombre(string? nombre) =>
        string.IsNullOrWhiteSpace(nombre) || nombre.Trim().Length > 150
            ? throw ReglaDeNegocioException.Validacion("nombre-requerido", "El nombre del cuestionario es obligatorio (hasta 150 caracteres).")
            : nombre.Trim();
}
