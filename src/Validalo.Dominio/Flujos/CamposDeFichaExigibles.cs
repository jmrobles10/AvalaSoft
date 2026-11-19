using System.Text.Json;
using System.Text.RegularExpressions;
using Validalo.Dominio.Configuracion;
using Validalo.Dominio.Ficha;

namespace Validalo.Dominio.Flujos;

/// <summary>
/// Cómo se amplía un valor declarado en la ficha antes de compararlo con una condición (EF-3): <see cref="PorPadreDelCatalogo"/> suma sus
/// ancestros del catálogo (una especialidad de nivel 3 también «es» de su categoría y de su grupo, como en las exigencias por grupo y categoría del
/// SRM) y <see cref="PorPrefijo"/> suma los prefijos del código (un CIIU de cuatro dígitos también «es» de su grupo de tres y de su división de dos).
/// </summary>
public enum JerarquiaDeCampo
{
    Ninguna,
    PorPadreDelCatalogo,
    PorPrefijo
}

/// <summary>
/// Un campo de la ficha del tercero que una condición puede mirar (EF-1). <see cref="Ruta"/> es el atributo de la condición
/// (<c>ficha.{seccion}.{campo}</c>); <see cref="Seccion"/> y <see cref="Fuentes"/> dicen dónde se lee en los datos de la sección (claves en snake_case; con
/// varias, sus valores se juntan: la actividad es la principal y las secundarias). <see cref="Catalogo"/> es el catálogo de plataforma del que salen los valores
/// y <see cref="ValidaExistencia"/>, si cada código de la condición debe existir (activo) en él al guardar el flujo.
/// </summary>
public sealed record CampoDeFichaExigible(
    string Ruta,
    string Seccion,
    IReadOnlyList<string> Fuentes,
    string Etiqueta,
    TipoAtributo Tipo,
    CatalogoDePlataforma? Catalogo,
    JerarquiaDeCampo Jerarquia,
    bool ValidaExistencia,
    Func<string, string?> Normalizar)
{
    /// <summary>Nombre corto de la sección en la ruta (<c>especialidades</c> para <c>FICHA_ESPECIALIDADES</c>).</summary>
    public string NombreDeSeccion => CamposDeFicha.NombreCorto(Seccion);

    public bool EsLista => Tipo == TipoAtributo.ListaOpciones;
}

/// <summary>
/// Catálogo cerrado de los campos de la ficha que pueden mirar las condiciones de un flujo (requisitos y selección, EF-1). Es una lista corta y a propósito: solo
/// campos que sirven para decidir qué se le pide a un tercero (especialidades, actividad económica, ciudad, responsabilidades tributarias…); nada de nombres,
/// identificaciones, direcciones ni cuentas. Agregar uno es agregar una fila aquí: el editor lo ofrece solo.
/// </summary>
public static partial class CamposDeFicha
{
    public const string Prefijo = "ficha.";

    [GeneratedRegex("^[0-9]{2,4}$")]
    private static partial Regex RegexCiiu();

    [GeneratedRegex("^[A-Z]{2}$")]
    private static partial Regex RegexPais();

    [GeneratedRegex("^[A-Z][A-Z0-9_]{0,39}$")]
    private static partial Regex RegexRegimen();

    private static readonly IReadOnlyDictionary<string, string> NombresCortos = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        [CodigosDeSeccion.General] = "general",
        [CodigosDeSeccion.Tributaria] = "tributaria",
        [CodigosDeSeccion.Legal] = "legal",
        [CodigosDeSeccion.Financiera] = "financiera",
        [CodigosDeSeccion.Sst] = "sst",
        [CodigosDeSeccion.Especialidades] = "especialidades"
    };

    public static string NombreCorto(string seccion) => NombresCortos.GetValueOrDefault(seccion) ?? seccion.ToLowerInvariant();

    private static string? Ciiu(string valor) => RegexCiiu().IsMatch(valor) ? valor : null;

    private static string? Pais(string valor) => RegexPais().IsMatch(valor.ToUpperInvariant()) ? valor.ToUpperInvariant() : null;

    private static string? Booleano(string valor) => bool.TryParse(valor, out var b) ? (b ? "true" : "false") : null;

    /// <summary>Código de un régimen tributario (<c>MAYÚSCULAS_Y_GUIONES_BAJOS</c>, RG-3): la lista de cada país la da su perfil, no un catálogo.</summary>
    private static string? Regimen(string valor)
    {
        var codigo = valor.ToUpperInvariant();
        return RegexRegimen().IsMatch(codigo) ? codigo : null;
    }

    private static Func<string, string?> DeCatalogo(CatalogoDePlataforma catalogo) => valor => ReglasDeCatalogo.NormalizarCodigo(catalogo, valor);

    private static CampoDeFichaExigible Campo(string seccion, string campo, string[] fuentes, string etiqueta, TipoAtributo tipo, CatalogoDePlataforma? catalogo,
        JerarquiaDeCampo jerarquia, bool validaExistencia, Func<string, string?> normalizar) =>
        new($"{Prefijo}{NombreCorto(seccion)}.{campo}", seccion, fuentes, etiqueta, tipo, catalogo, jerarquia, validaExistencia, normalizar);

    /// <summary>Los campos que una condición puede mirar, en el orden en que los ofrece el editor.</summary>
    public static readonly IReadOnlyList<CampoDeFichaExigible> Todos =
    [
        Campo(CodigosDeSeccion.Especialidades, "especialidades", ["especialidades"], "Especialidades", TipoAtributo.ListaOpciones,
            CatalogoDePlataforma.Especialidades, JerarquiaDeCampo.PorPadreDelCatalogo, true, DeCatalogo(CatalogoDePlataforma.Especialidades)),
        Campo(CodigosDeSeccion.General, "ciiu", ["ciiu_principal", "ciiu_secundarias"], "Actividad económica (CIIU)", TipoAtributo.ListaOpciones,
            CatalogoDePlataforma.ActividadesEconomicas, JerarquiaDeCampo.PorPrefijo, false, Ciiu),
        Campo(CodigosDeSeccion.General, "ciiu_principal", ["ciiu_principal"], "Actividad económica principal (CIIU)", TipoAtributo.Opcion,
            CatalogoDePlataforma.ActividadesEconomicas, JerarquiaDeCampo.Ninguna, false, Ciiu),
        Campo(CodigosDeSeccion.General, "ciudad", ["ciudad"], "Ciudad", TipoAtributo.Opcion, CatalogoDePlataforma.Ciudades, JerarquiaDeCampo.Ninguna, true,
            DeCatalogo(CatalogoDePlataforma.Ciudades)),
        Campo(CodigosDeSeccion.General, "pais", ["pais"], "País del domicilio", TipoAtributo.Texto, null, JerarquiaDeCampo.Ninguna, false, Pais),
        Campo(CodigosDeSeccion.General, "certificado_iso", ["certificado_iso"], "Cuenta con certificado ISO", TipoAtributo.Booleano, null,
            JerarquiaDeCampo.Ninguna, false, Booleano),
        Campo(CodigosDeSeccion.Tributaria, "responsabilidades", ["responsabilidades"], "Responsabilidades tributarias (RUT)", TipoAtributo.ListaOpciones,
            CatalogoDePlataforma.ResponsabilidadesDian, JerarquiaDeCampo.Ninguna, true, DeCatalogo(CatalogoDePlataforma.ResponsabilidadesDian)),
        Campo(CodigosDeSeccion.Tributaria, "responsable_ica", ["responsable_ica"], "Responsable del impuesto de industria y comercio", TipoAtributo.Booleano,
            null, JerarquiaDeCampo.Ninguna, false, Booleano),
        Campo(CodigosDeSeccion.Tributaria, "exento_rete_cree", ["exento_rete_cree"], "Exento de la retención del CREE", TipoAtributo.Booleano, null,
            JerarquiaDeCampo.Ninguna, false, Booleano),
        // El modelo tributario de los demás países (Panamá, República Dominicana…, RG-3): no tienen la casilla 53 ni ICA, tienen régimen, impuesto a las ventas y retenciones.
        Campo(CodigosDeSeccion.Tributaria, "regimen", ["regimen"], "Régimen tributario (fuera de Colombia)", TipoAtributo.Opcion, null, JerarquiaDeCampo.Ninguna, false,
            Regimen),
        Campo(CodigosDeSeccion.Tributaria, "contribuyente_impuesto_ventas", ["contribuyente_impuesto_ventas"], "Contribuyente del impuesto a las ventas (fuera de Colombia)",
            TipoAtributo.Booleano, null, JerarquiaDeCampo.Ninguna, false, Booleano),
        Campo(CodigosDeSeccion.Tributaria, "agente_de_retencion", ["agente_de_retencion"], "Agente de retención (fuera de Colombia)", TipoAtributo.Booleano, null,
            JerarquiaDeCampo.Ninguna, false, Booleano),
        Campo(CodigosDeSeccion.Tributaria, "exento_de_retenciones", ["exento_de_retenciones"], "Exento de retenciones (fuera de Colombia)", TipoAtributo.Booleano, null,
            JerarquiaDeCampo.Ninguna, false, Booleano)
    ];

    private static readonly IReadOnlyDictionary<string, CampoDeFichaExigible> PorRuta = Todos.ToDictionary(c => c.Ruta, StringComparer.Ordinal);

    public static CampoDeFichaExigible? Buscar(string? ruta) => ruta is not null && PorRuta.TryGetValue(ruta.Trim(), out var campo) ? campo : null;

    /// <summary>Los valores que un campo tiene en los datos de su sección (JSON canónico): texto, lista de textos o booleano; vacío si no los declaró.</summary>
    public static IReadOnlyList<string> Leer(CampoDeFichaExigible campo, JsonElement datos)
    {
        if (datos.ValueKind != JsonValueKind.Object)
            return [];

        var valores = new List<string>();
        foreach (var fuente in campo.Fuentes)
        {
            if (!datos.TryGetProperty(fuente, out var valor))
                continue;
            switch (valor.ValueKind)
            {
                case JsonValueKind.String when !string.IsNullOrWhiteSpace(valor.GetString()):
                    valores.Add(valor.GetString()!.Trim());
                    break;
                case JsonValueKind.True:
                    valores.Add("true");
                    break;
                case JsonValueKind.False:
                    valores.Add("false");
                    break;
                case JsonValueKind.Array:
                    valores.AddRange(valor.EnumerateArray()
                        .Where(e => e.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(e.GetString()))
                        .Select(e => e.GetString()!.Trim()));
                    break;
            }
        }

        return [.. valores.Select(v => campo.Normalizar(v)).OfType<string>().Distinct(StringComparer.Ordinal)];
    }
}

/// <summary>
/// Lo que la ficha del tercero le dice al motor de exigencia (EF-2): por cada campo exigible que el tercero declaró, su valor ya normalizado y ampliado por la
/// jerarquía de su catálogo (<see cref="JerarquiaDeCampo"/>). Función pura sobre los datos de la versión vigente de cada sección; lo que el tercero no ha
/// declarado no aparece (un dato faltante se comporta como en los atributos del vínculo).
/// </summary>
public static class FichaParaExigencia
{
    /// <summary>Profundidad máxima de ancestros que se siguen en un catálogo (los de especialidades tienen tres niveles).</summary>
    private const int NivelesMaximos = 5;

    /// <summary>
    /// Lo que el tercero declaró en cada campo exigible (ruta → valores normalizados, sin ampliar), leído de los datos de la versión vigente de cada sección
    /// (<paramref name="datosPorSeccion"/>, por código: <c>FICHA_GENERAL</c>…). Un campo vacío no aparece.
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> Declarados(IReadOnlyDictionary<string, JsonElement> datosPorSeccion)
    {
        var declarados = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var campo in CamposDeFicha.Todos)
        {
            if (datosPorSeccion.TryGetValue(campo.Seccion, out var datos) && CamposDeFicha.Leer(campo, datos) is { Count: > 0 } valores)
                declarados[campo.Ruta] = valores;
        }

        return declarados;
    }

    /// <param name="declarados">Lo declarado por campo (<see cref="Declarados"/>).</param>
    /// <param name="catalogos">Catálogos con las entradas declaradas y sus ancestros (ver <see cref="Referencias"/>).</param>
    public static IReadOnlyDictionary<string, JsonElement> Construir(IReadOnlyDictionary<string, IReadOnlyList<string>> declarados, ICatalogosDeFicha catalogos)
    {
        var resultado = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        foreach (var campo in CamposDeFicha.Todos)
        {
            if (!declarados.TryGetValue(campo.Ruta, out var valoresDeclarados) || valoresDeclarados.Count == 0)
                continue;

            var valores = Ampliar(campo, valoresDeclarados, catalogos);
            resultado[campo.Ruta] = campo.EsLista
                ? JsonSerializer.SerializeToElement(valores)
                : campo.Tipo == TipoAtributo.Booleano
                    ? JsonSerializer.SerializeToElement(valores[0] == "true")
                    : JsonSerializer.SerializeToElement(valores[0]);
        }

        return resultado;
    }

    /// <summary>
    /// Las entradas de catálogo que hay que cargar para ampliar lo declarado: los códigos declarados de cada campo con jerarquía por catálogo. Con cada ronda
    /// de carga, los padres de lo cargado son las siguientes referencias (<see cref="Padres"/>).
    /// </summary>
    public static IReadOnlyList<ReferenciaACatalogo> Referencias(IReadOnlyDictionary<string, IReadOnlyList<string>> declarados) =>
    [
        .. CamposDeFicha.Todos
            .Where(c => c.Jerarquia == JerarquiaDeCampo.PorPadreDelCatalogo && c.Catalogo is not null && declarados.ContainsKey(c.Ruta))
            .SelectMany(c => declarados[c.Ruta].Select(v => new ReferenciaACatalogo(c.Catalogo!.Value, v)))
            .Distinct()
    ];

    /// <summary>Los padres de unas entradas ya cargadas (la siguiente ronda de carga de ancestros).</summary>
    public static IReadOnlyList<ReferenciaACatalogo> Padres(IEnumerable<EntradaDeCatalogo> entradas) =>
        [.. entradas.Where(e => e.Padre is not null).Select(e => new ReferenciaACatalogo(e.Catalogo, e.Padre!)).Distinct()];

    private static List<string> Ampliar(CampoDeFichaExigible campo, IReadOnlyList<string> declarados, ICatalogosDeFicha catalogos)
    {
        var valores = new List<string>(declarados);
        switch (campo.Jerarquia)
        {
            case JerarquiaDeCampo.PorPadreDelCatalogo when campo.Catalogo is { } catalogo:
                foreach (var codigo in declarados)
                {
                    var actual = catalogos.Buscar(catalogo, codigo);
                    for (var nivel = 0; nivel < NivelesMaximos && actual?.Padre is { } padre; nivel++)
                    {
                        valores.Add(padre);
                        actual = catalogos.Buscar(catalogo, padre);
                    }
                }

                break;
            case JerarquiaDeCampo.PorPrefijo:
                foreach (var codigo in declarados)
                {
                    for (var largo = codigo.Length - 1; largo >= 2; largo--)
                        valores.Add(codigo[..largo]);
                }

                break;
        }

        return [.. valores.Distinct(StringComparer.Ordinal)];
    }
}
