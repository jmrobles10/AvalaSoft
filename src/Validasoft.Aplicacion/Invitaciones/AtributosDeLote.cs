using System.Globalization;
using System.Text.Json;
using Validasoft.Dominio.Configuracion;
using Validasoft.Dominio.Invitaciones;

namespace Validasoft.Aplicacion.Invitaciones;

/// <summary>
/// Los atributos del vínculo que traen una fila del lote y la invitación individual (decisión IM): valores de las columnas «Atributo: clave» del archivo (siempre texto) o de un
/// JSON ya tipado (<c>POST /invitaciones</c>). <see cref="Resolver"/> los convierte al tipo que declara el tipo de vínculo de la fila —número, sí/no, fecha, una opción o una lista de
/// ellas— y dice, por atributo, qué está mal; lo que sale es lo que entiende <see cref="ValidadorDeAtributos"/>. Un atributo que el tipo de la fila no admite es un error claro de esa
/// fila (campo <c>atributos.{clave}</c>), no se ignora.
/// </summary>
public static class AtributosDeLote
{
    /// <summary>Prefijo del campo de un error de atributo (<c>atributos.nivelRiesgo</c>): lo que la pantalla muestra bajo cada control.</summary>
    public const string PrefijoDeCampo = "atributos.";

    /// <summary>Formatos de fecha que se aceptan además de <c>AAAA-MM-DD</c> (como las escribe quien llena la plantilla en Excel).</summary>
    private static readonly string[] FormatosDeFecha = ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "yyyy/MM/dd", "dd-MM-yyyy", "d-M-yyyy"];

    /// <summary>Separadores de las opciones de un atributo de lista cuando llegan en una sola celda: punto y coma o coma.</summary>
    private static readonly char[] SeparadoresDeLista = [';', ','];

    public static string CampoDe(string clave) => PrefijoDeCampo + clave;

    /// <summary>
    /// Los valores de la fila convertidos al tipo de cada atributo del <paramref name="tipo"/> y los errores de lo que no sirve. Lo vacío (celda sin valor, texto en blanco, nulo) es
    /// «no vino» y se ignora; la clave se reconoce sin importar mayúsculas y sale como la define el tipo. No exige los obligatorios: eso es <see cref="Faltantes"/>, porque solo
    /// aplica al crear el vínculo (en uno que ya existe y se reinvita, solo se aplican los atributos que vienen).
    /// </summary>
    public static (Dictionary<string, JsonElement> Valores, List<ErrorDeFila> Errores) Resolver(TipoVinculo tipo, IReadOnlyDictionary<string, JsonElement>? crudos)
    {
        var valores = new Dictionary<string, JsonElement>();
        var errores = new List<ErrorDeFila>();
        foreach (var (claveCruda, crudo) in crudos ?? new Dictionary<string, JsonElement>())
        {
            if (EsVacio(crudo))
                continue;

            var clave = claveCruda.Trim();
            var permitido = tipo.AtributosPermitidos.FirstOrDefault(a => a.Clave == clave)
                            ?? tipo.AtributosPermitidos.FirstOrDefault(a => string.Equals(a.Clave, clave, StringComparison.OrdinalIgnoreCase));
            if (permitido is null)
            {
                errores.Add(new ErrorDeFila(CampoDe(clave), "atributo-no-permitido",
                    $"El tipo de vínculo {tipo.Codigo} no admite el atributo «{clave}»: quita ese valor o usa un tipo que lo tenga."));
                continue;
            }

            if (Convertir(permitido, crudo) is { } convertido)
                valores[permitido.Clave] = convertido;
            else
                errores.Add(new ErrorDeFila(CampoDe(permitido.Clave), "atributo-invalido", $"El valor del atributo «{permitido.Clave}» no es válido: escribe {Esperado(permitido)}."));
        }

        return (valores, errores);
    }

    /// <summary>Los atributos obligatorios del tipo que no tienen valor (<paramref name="resueltos"/> es lo que devolvió <see cref="Resolver"/>): un error por cada uno.</summary>
    public static List<ErrorDeFila> Faltantes(TipoVinculo tipo, IReadOnlyDictionary<string, JsonElement> resueltos) =>
        [.. tipo.AtributosPermitidos.Where(a => a.Obligatorio && !resueltos.ContainsKey(a.Clave))
            .Select(a => new ErrorDeFila(CampoDe(a.Clave), "atributo-requerido", $"El atributo «{a.Clave}» es obligatorio para {tipo.Codigo}."))];

    private static bool EsVacio(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null => true,
        JsonValueKind.String => string.IsNullOrWhiteSpace(v.GetString()),
        JsonValueKind.Array => v.GetArrayLength() == 0,
        _ => false
    };

    private static JsonElement? Convertir(AtributoPermitido a, JsonElement v)
    {
        switch (a.Tipo)
        {
            case TipoAtributo.Texto:
                return v.ValueKind == JsonValueKind.String ? Json(v.GetString()!.Trim()) : null;
            case TipoAtributo.Numero:
                return Numero(v) is { } numero ? Json(numero) : null;
            case TipoAtributo.Booleano:
                return Booleano(v) is { } booleano ? Json(booleano) : null;
            case TipoAtributo.Fecha:
                return Fecha(v) is { } fecha ? Json(fecha.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)) : null;
            case TipoAtributo.Opcion:
                return v.ValueKind == JsonValueKind.String && Opcion(a, v.GetString()!) is { } opcion ? Json(opcion) : null;
            case TipoAtributo.ListaOpciones:
                return Lista(a, v) is { } lista ? Json(lista) : null;
            default:
                return null;
        }
    }

    private static JsonElement Json<T>(T valor) => JsonSerializer.SerializeToElement(valor);

    /// <summary>Un número JSON, o el texto de una celda: con punto decimal (también «1500,5», con una sola coma y sin punto) y sin separador de miles.</summary>
    private static decimal? Numero(JsonElement v)
    {
        if (v.ValueKind == JsonValueKind.Number)
            return v.TryGetDecimal(out var n) ? n : null;
        if (v.ValueKind != JsonValueKind.String)
            return null;

        const NumberStyles estilo = NumberStyles.Number & ~NumberStyles.AllowThousands;
        var texto = v.GetString()!.Trim();
        if (decimal.TryParse(texto, estilo, CultureInfo.InvariantCulture, out var d))
            return d;
        return texto.Count(c => c == ',') == 1 && !texto.Contains('.') && decimal.TryParse(texto.Replace(',', '.'), estilo, CultureInfo.InvariantCulture, out d) ? d : null;
    }

    /// <summary><c>true</c>/<c>false</c> de JSON, o el texto de una celda: sí/no, true/false, verdadero/falso, 1/0 (como guarda Excel un sí/no).</summary>
    private static bool? Booleano(JsonElement v)
    {
        switch (v.ValueKind)
        {
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.String:
                return ArchivoDeLote.Normalizar(v.GetString()) switch
                {
                    "si" or "s" or "true" or "verdadero" or "yes" or "y" or "1" => true,
                    "no" or "n" or "false" or "falso" or "0" => false,
                    _ => null
                };
            default:
                return null;
        }
    }

    /// <summary>Una fecha <c>AAAA-MM-DD</c> (o <c>dd/MM/AAAA</c>…) y, por si Excel la guardó como fecha, su número de serie.</summary>
    private static DateOnly? Fecha(JsonElement v)
    {
        string? texto = v.ValueKind switch
        {
            JsonValueKind.String => v.GetString()!.Trim(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null
        };
        if (texto is null)
            return null;
        if (DateOnly.TryParseExact(texto, FormatosDeFecha, CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha))
            return fecha;
        return texto.All(char.IsAsciiDigit) && int.TryParse(texto, NumberStyles.None, CultureInfo.InvariantCulture, out var serie) && serie is >= 20000 and <= 80000
            ? DateOnly.FromDateTime(DateTime.FromOADate(serie))
            : null;
    }

    /// <summary>La opción del atributo como la define el tipo: exacta o, si no, sin importar mayúsculas ni tildes.</summary>
    private static string? Opcion(AtributoPermitido a, string texto)
    {
        var opciones = a.Opciones ?? [];
        var limpio = texto.Trim();
        if (opciones.FirstOrDefault(o => o == limpio) is { } exacta)
            return exacta;
        var buscado = ArchivoDeLote.Normalizar(limpio);
        return buscado.Length == 0 ? null : opciones.FirstOrDefault(o => ArchivoDeLote.Normalizar(o) == buscado);
    }

    /// <summary>Una lista JSON de textos o el texto de una celda con las opciones separadas por «;» o «,»; todas deben ser opciones del atributo (sin repetir).</summary>
    private static List<string>? Lista(AtributoPermitido a, JsonElement v)
    {
        IEnumerable<string>? crudos = v.ValueKind switch
        {
            JsonValueKind.String => v.GetString()!.Split(SeparadoresDeLista, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            JsonValueKind.Array when v.EnumerateArray().All(e => e.ValueKind == JsonValueKind.String) => v.EnumerateArray().Select(e => e.GetString()!),
            _ => null
        };
        if (crudos is null)
            return null;

        var resultado = new List<string>();
        foreach (var crudo in crudos)
        {
            if (Opcion(a, crudo) is not { } opcion)
                return null;
            if (!resultado.Contains(opcion))
                resultado.Add(opcion);
        }

        return resultado.Count == 0 ? null : resultado;
    }

    /// <summary>Qué se espera de un atributo, para el mensaje de un valor inválido.</summary>
    public static string Esperado(AtributoPermitido a) => a.Tipo switch
    {
        TipoAtributo.Numero => "un número (con punto decimal)",
        TipoAtributo.Booleano => "Sí o No",
        TipoAtributo.Fecha => "una fecha AAAA-MM-DD",
        TipoAtributo.Opcion => $"una de estas opciones: {string.Join(", ", a.Opciones ?? [])}",
        TipoAtributo.ListaOpciones => $"una o varias de estas opciones, separadas por punto y coma: {string.Join(", ", a.Opciones ?? [])}",
        _ => "un texto"
    };
}
