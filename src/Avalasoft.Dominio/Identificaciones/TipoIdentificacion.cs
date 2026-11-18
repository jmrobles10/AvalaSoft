namespace Avalasoft.Dominio.Identificaciones;

public enum AplicaA
{
    Natural,
    Juridica,
    Ambas
}

/// <summary>Algoritmo del dígito de verificación de un tipo de identificación.</summary>
public enum AlgoritmoDv
{
    Ninguno,
    NitColombia,
    RutChile,
    CuitArgentina,

    /// <summary>
    /// El dígito lo informa el tercero y AvalaSoft solo valida su formato (2 dígitos): el RUC de Panamá lleva un DV que publica la DGI
    /// y que AvalaSoft no calcula. No es parte del número ni de la clave de unicidad; se guarda en la ficha general (<c>dv</c>).
    /// </summary>
    Declarado
}

/// <summary>
/// Control del número cuando el dígito de verificación es <b>parte del propio número</b> y no se guarda aparte (RNC y cédula de la
/// República Dominicana): el número normalizado debe pasar el control o la identificación se rechaza.
/// </summary>
public enum ControlDeNumero
{
    Ninguno,

    /// <summary>RNC de la DGII: 9 dígitos con su dígito de control (módulo 11) o, para una persona física, la cédula de 11 dígitos.</summary>
    RncDominicano,

    /// <summary>Cédula de identidad y electoral: 11 dígitos con el último de control (Luhn).</summary>
    CedulaDominicana
}

/// <summary>Tipo de identificación de un país (docs/05 <c>TipoIdentificacionDto</c>).</summary>
public sealed record TipoIdentificacion(
    string Pais,
    string Codigo,
    string Nombre,
    AplicaA AplicaA,
    AlgoritmoDv AlgoritmoDv,
    string Patron,
    ControlDeNumero Control = ControlDeNumero.Ninguno)
{
    /// <summary>AvalaSoft calcula el DV y lo guarda aparte del número (NIT, RUT de Chile, CUIT).</summary>
    public bool TieneDv => AlgoritmoDv is not (AlgoritmoDv.Ninguno or AlgoritmoDv.Declarado);

    /// <summary>El DV existe, pero lo declara el tercero en la ficha (RUC de Panamá).</summary>
    public bool DvDeclarado => AlgoritmoDv == AlgoritmoDv.Declarado;
}

public sealed record Pais(string Codigo, string Nombre, IReadOnlyList<TipoIdentificacion> TiposIdentificacion);
