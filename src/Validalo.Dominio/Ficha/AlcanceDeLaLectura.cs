namespace Validalo.Dominio.Ficha;

/// <summary>
/// Hasta dónde llega hoy la lectura automática (RG-6): el análisis con IA del RUT y de la Cámara de comercio, el cruce de la ficha con sus
/// soportes, la propuesta «Actualizar desde mi documento» y la corroboración contra el RUES y la DIAN están escritos para documentos y
/// registros <b>colombianos</b>. Para un tercero cuya identificación es de otro país no se leen, no se cruzan, no se proponen ni se consultan:
/// la revisión es manual (nunca una discrepancia falsa ni una verificación que no se puede satisfacer). Función pura.
/// </summary>
public static class AlcanceDeLaLectura
{
    /// <summary>País cuyos documentos y registros oficiales sabe leer Valídalo.</summary>
    public const string Pais = "CO";

    /// <summary>¿La lectura automática aplica a un tercero con identificación de ese país (ISO 3166-1 alfa-2)?</summary>
    public static bool Aplica(string? paisDeLaIdentificacion) => string.Equals(paisDeLaIdentificacion?.Trim(), Pais, StringComparison.OrdinalIgnoreCase);
}
