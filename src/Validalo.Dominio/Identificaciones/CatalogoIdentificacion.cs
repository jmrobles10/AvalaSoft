using System.Text.RegularExpressions;
using Validalo.Dominio.Comun;

namespace Validalo.Dominio.Identificaciones;

/// <summary>
/// Catálogo de tipos de identificación por país (P-1-1, P-1-4). Los países listados tienen sus tipos
/// propios; cualquier otro país ISO 3166-1 alfa-2 admite <c>PASAPORTE</c> e <c>ID_FISCAL</c>.
/// En H1 vive en código; la tabla <c>plataforma.catalogo_tipo_identificacion</c> lo reemplaza cuando
/// Plataforma necesite editarlo sin desplegar.
/// </summary>
public static class CatalogoIdentificacion
{
    private const string Alfanumerico = "^[A-Z0-9]{3,20}$";

    private static readonly IReadOnlyList<Pais> PaisesConocidos =
    [
        new("CO", "Colombia",
        [
            new("CO", "NIT", "Número de Identificación Tributaria", AplicaA.Ambas, AlgoritmoDv.NitColombia, "^[0-9]{6,15}$"),
            new("CO", "CC", "Cédula de ciudadanía", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{3,10}$"),
            new("CO", "CE", "Cédula de extranjería", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{3,10}$"),
            new("CO", "TI", "Tarjeta de identidad", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{6,11}$"),
            new("CO", "PPT", "Permiso por protección temporal", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{4,15}$"),
            new("CO", "PA", "Pasaporte", AplicaA.Natural, AlgoritmoDv.Ninguno, Alfanumerico)
        ]),
        new("CL", "Chile",
        [
            new("CL", "RUT", "Rol Único Tributario", AplicaA.Ambas, AlgoritmoDv.RutChile, "^[0-9]{7,8}$")
        ]),
        new("AR", "Argentina",
        [
            new("AR", "CUIT", "Clave Única de Identificación Tributaria", AplicaA.Ambas, AlgoritmoDv.CuitArgentina, "^[0-9]{10}$"),
            new("AR", "DNI", "Documento Nacional de Identidad", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{7,8}$")
        ]),
        new("MX", "México",
        [
            new("MX", "RFC", "Registro Federal de Contribuyentes", AplicaA.Ambas, AlgoritmoDv.Ninguno, "^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$"),
            new("MX", "CURP", "Clave Única de Registro de Población", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[A-Z]{4}[0-9]{6}[A-Z]{6}[A-Z0-9]{2}$")
        ]),
        new("PE", "Perú",
        [
            new("PE", "RUC", "Registro Único de Contribuyentes", AplicaA.Ambas, AlgoritmoDv.Ninguno, "^[0-9]{11}$"),
            new("PE", "DNI", "Documento Nacional de Identidad", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{8}$")
        ]),
        new("EC", "Ecuador",
        [
            new("EC", "RUC", "Registro Único de Contribuyentes", AplicaA.Ambas, AlgoritmoDv.Ninguno, "^[0-9]{13}$"),
            new("EC", "CI", "Cédula de identidad", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{10}$")
        ]),
        new("US", "Estados Unidos",
        [
            new("US", "EIN", "Employer Identification Number", AplicaA.Juridica, AlgoritmoDv.Ninguno, "^[0-9]{9}$")
        ]),
        // Regiones del SRM que faltaban (RG-2). Los números se validan sin guiones: «8-123-456» queda «8123456».
        // Panamá: la persona natural usa su cédula como RUC («8-123-456», «PE-12-345», «E-8-123456», «N-12-345», «8-AV-123-456») y la
        // jurídica un RUC largo de folio, tomo, asiento y año («155612345-2-2019»). El DV (2 dígitos) lo declara el tercero.
        new("PA", "Panamá",
        [
            new("PA", "RUC", "Registro Único de Contribuyente (DGI)", AplicaA.Ambas, AlgoritmoDv.Declarado,
                "^((PE|PI|E|N)?[0-9]{1,2}(AV)?[0-9]{3,9}|[0-9]{12,20})$"),
            new("PA", "CIP", "Cédula de identidad personal", AplicaA.Natural, AlgoritmoDv.Ninguno,
                "^(PE|PI|E|N)?[0-9]{1,2}(AV)?[0-9]{3,9}$")
        ]),
        // República Dominicana: los mismos códigos que el SRM homologa en esa región (NIT ⇒ RNC, CC ⇒ CED). El dígito de control va
        // dentro del número (RNC de 9 dígitos o cédula de 11 para la persona física), así que no hay DV aparte.
        new("DO", "República Dominicana",
        [
            new("DO", "RNC", "Registro Nacional de Contribuyentes (DGII)", AplicaA.Ambas, AlgoritmoDv.Ninguno, "^([0-9]{9}|[0-9]{11})$",
                ControlDeNumero.RncDominicano),
            new("DO", "CED", "Cédula de identidad y electoral", AplicaA.Natural, AlgoritmoDv.Ninguno, "^[0-9]{11}$", ControlDeNumero.CedulaDominicana)
        ])
    ];

    public static IReadOnlyList<Pais> Paises => PaisesConocidos;

    /// <summary>Tipos propios del país más los genéricos (sin duplicar códigos).</summary>
    public static IReadOnlyList<TipoIdentificacion> TiposDe(string pais)
    {
        var codigo = NormalizarPais(pais);
        var propios = PaisesConocidos.FirstOrDefault(p => p.Codigo == codigo)?.TiposIdentificacion ?? [];
        var genericos = new[]
        {
            new TipoIdentificacion(codigo, "PASAPORTE", "Pasaporte", AplicaA.Natural, AlgoritmoDv.Ninguno, Alfanumerico),
            new TipoIdentificacion(codigo, "ID_FISCAL", "Identificación fiscal del país", AplicaA.Ambas, AlgoritmoDv.Ninguno, Alfanumerico)
        };
        return [.. propios, .. genericos.Where(g => propios.All(p => p.Codigo != g.Codigo))];
    }

    public static TipoIdentificacion? Buscar(string pais, string tipo) =>
        TiposDe(pais).FirstOrDefault(t => t.Codigo == (tipo ?? string.Empty).Trim().ToUpperInvariant());

    /// <summary>Países con catálogo propio cuyos tipos (sin los genéricos) incluyen el código: <c>CED</c> ⇒ DO, <c>CIP</c> ⇒ PA, <c>RUC</c> ⇒ PE, EC y PA.</summary>
    public static IReadOnlyList<string> PaisesDelTipo(string? tipo)
    {
        var codigo = (tipo ?? string.Empty).Trim().ToUpperInvariant();
        return [.. PaisesConocidos.Where(p => p.TiposIdentificacion.Any(t => t.Codigo == codigo)).Select(p => p.Codigo)];
    }

    /// <summary>
    /// Los códigos de tipo de identificación de cualquier país del catálogo más los genéricos, sin repetir y ordenados: lo que acepta un documento
    /// que firma o nombra una persona de cualquier país (la declaración PEP, que no valida el número).
    /// </summary>
    public static IReadOnlyList<string> TiposConocidos { get; } =
        [.. PaisesConocidos.SelectMany(p => p.TiposIdentificacion).Select(t => t.Codigo).Concat(["PASAPORTE", "ID_FISCAL"]).Distinct().Order(StringComparer.Ordinal)];

    private static readonly string[] TiposGenericos = ["PASAPORTE", "ID_FISCAL"];

    /// <summary>
    /// El país con cuyo catálogo se valida un tipo de identificación de una persona relacionada con un tercero: el primero de
    /// <paramref name="preferidos"/> (la nacionalidad, el país del tercero) y, al final, Colombia (compatibilidad) cuyo catálogo propio tiene ese
    /// tipo; un tipo genérico (<c>PASAPORTE</c>, <c>ID_FISCAL</c>) se valida con el primer país preferido (o Colombia). Nulo si el tipo no es de
    /// ninguno de esos países: una persona de un tercero de Panamá admite CIP y RUC, no el CED de República Dominicana.
    /// </summary>
    public static string? PaisParaTipo(string? tipo, params string?[] preferidos)
    {
        var codigo = (tipo ?? string.Empty).Trim().ToUpperInvariant();
        if (codigo.Length == 0)
            return null;
        var candidatos = preferidos
            .Where(p => !string.IsNullOrWhiteSpace(p) && Regex.IsMatch(p.Trim(), "^[A-Za-z]{2}$"))
            .Select(p => p!.Trim().ToUpperInvariant())
            .Append("CO")
            .Distinct()
            .ToList();
        var propios = PaisesDelTipo(codigo);
        if (candidatos.FirstOrDefault(c => propios.Contains(c)) is { } pais)
            return pais;
        return TiposGenericos.Contains(codigo) ? candidatos[0] : null;
    }

    /// <summary>
    /// ¿El tipo y el número son de una sociedad y no de una persona? Un NIT; un RNC de 9 dígitos (el de 11 es la cédula de una persona física); un
    /// RUC de Panamá de 12 dígitos o más (el de una persona natural es su cédula, más corta y con letras en algunos casos).
    /// </summary>
    public static bool EsDeSociedad(string? tipo, string? numero)
    {
        var normalizado = Regex.Replace((numero ?? string.Empty).Trim().ToUpperInvariant(), @"[\s.\-]", string.Empty);
        return (tipo ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "NIT" => true,
            "RNC" => normalizado.Length == 9,
            "RUC" => normalizado.Length >= 12 && normalizado.All(char.IsAsciiDigit),
            _ => false
        };
    }

    /// <summary>
    /// Los tipos que admite una persona relacionada de un tercero de ese país: los de Colombia (compatibilidad), los del país y los genéricos, sin
    /// repetir y ordenados (para el mensaje de «tipo inválido»).
    /// </summary>
    public static IReadOnlyList<string> TiposParaPersona(string? paisDelTercero)
    {
        var paises = new List<string> { "CO" };
        if (!string.IsNullOrWhiteSpace(paisDelTercero) && Regex.IsMatch(paisDelTercero.Trim(), "^[A-Za-z]{2}$") && !string.Equals(paisDelTercero.Trim(), "CO", StringComparison.OrdinalIgnoreCase))
            paises.Add(paisDelTercero.Trim().ToUpperInvariant());
        return [.. paises.SelectMany(TiposDe).Select(t => t.Codigo).Distinct().Order(StringComparer.Ordinal)];
    }

    public static string NormalizarPais(string pais)
    {
        var codigo = (pais ?? string.Empty).Trim().ToUpperInvariant();
        if (!Regex.IsMatch(codigo, "^[A-Z]{2}$"))
            throw ReglaDeNegocioException.Validacion("pais-invalido", $"'{pais}' no es un código de país ISO 3166-1 alfa-2.");
        return codigo;
    }
}
