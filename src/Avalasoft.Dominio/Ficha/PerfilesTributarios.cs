namespace Avalasoft.Dominio.Ficha;

/// <summary>
/// Cómo se diligencia la información tributaria según el país del tercero (RG-3): <see cref="Colombiano"/> es la de siempre (casilla 53
/// del RUT de la DIAN, resoluciones e ICA); <see cref="Generico"/> es el conjunto de campos que sirve a cualquier otro país (régimen,
/// contribuyente del impuesto a las ventas, agente de retención, exención y facturación electrónica).
/// </summary>
public enum ModeloTributario
{
    Colombiano,
    Generico
}

/// <summary>Un régimen tributario de un país: <see cref="Codigo"/> estable (MAYÚSCULAS_Y_GUIONES_BAJOS) y su nombre.</summary>
public sealed record RegimenTributario(string Codigo, string Nombre);

/// <summary>
/// Perfil tributario de un país: el modelo, la autoridad, cómo se llama allí el impuesto a las ventas y los regímenes que ofrece
/// (vacíos en Colombia: ahí rigen las responsabilidades de la casilla 53). El perfil no se guarda: sale del país de la
/// identificación del tercero, así que un dato guardado nunca queda «de otro país».
/// </summary>
public sealed record PerfilTributario(string Pais, ModeloTributario Modelo, string Autoridad, string ImpuestoVentas, IReadOnlyList<RegimenTributario> Regimenes)
{
    public bool EsColombiano => Modelo == ModeloTributario.Colombiano;

    public RegimenTributario? Regimen(string? codigo) =>
        codigo is null ? null : Regimenes.FirstOrDefault(r => string.Equals(r.Codigo, codigo, StringComparison.Ordinal));
}

/// <summary>
/// Perfiles tributarios por país (RG-3). Colombia conserva su modelo; Panamá y la República Dominicana traen su autoridad, su
/// impuesto (ITBMS, ITBIS) y sus regímenes; cualquier otro país usa el perfil genérico. Función pura, sin estado.
/// </summary>
public static class PerfilesTributarios
{
    private static readonly PerfilTributario Colombia = new("CO", ModeloTributario.Colombiano, "DIAN", "IVA", []);

    private static readonly PerfilTributario Panama = new("PA", ModeloTributario.Generico, "DGI", "ITBMS",
    [
        new("GENERAL", "Régimen general"),
        new("ZONA_LIBRE", "Zona Libre de Colón"),
        new("ZONA_FRANCA_O_ESPECIAL", "Zona franca o régimen especial"),
        new("SIN_FINES_DE_LUCRO", "Sin fines de lucro o exento por ley"),
        new("OTRO", "Otro")
    ]);

    private static readonly PerfilTributario RepublicaDominicana = new("DO", ModeloTributario.Generico, "DGII", "ITBIS",
    [
        new("ORDINARIO", "Régimen ordinario"),
        new("RST", "Régimen Simplificado de Tributación (RST)"),
        new("ZONA_FRANCA", "Zona franca"),
        new("SIN_FINES_DE_LUCRO", "Sin fines de lucro"),
        new("OTRO", "Otro")
    ]);

    private static readonly IReadOnlyList<RegimenTributario> RegimenesGenericos =
    [
        new("GENERAL", "Régimen general"),
        new("SIMPLIFICADO", "Régimen simplificado o de pequeño contribuyente"),
        new("ESPECIAL", "Régimen especial, zona franca o exento"),
        new("OTRO", "Otro")
    ];

    /// <summary>El perfil del país (código ISO 3166-1 alfa-2); un país sin perfil propio recibe el genérico con su código.</summary>
    public static PerfilTributario De(string? pais)
    {
        var codigo = (pais ?? string.Empty).Trim().ToUpperInvariant();
        return codigo switch
        {
            "CO" => Colombia,
            "PA" => Panama,
            "DO" => RepublicaDominicana,
            _ => new PerfilTributario(codigo, ModeloTributario.Generico, "autoridad tributaria", "IVA o equivalente", RegimenesGenericos)
        };
    }

    /// <summary>Los países con perfil propio (los demás usan el genérico).</summary>
    public static IReadOnlyList<string> ConPerfilPropio { get; } = ["CO", "PA", "DO"];
}
