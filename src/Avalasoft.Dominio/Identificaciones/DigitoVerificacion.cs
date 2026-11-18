namespace Avalasoft.Dominio.Identificaciones;

/// <summary>Cálculo de dígitos de verificación por país.</summary>
public static class DigitoVerificacion
{
    private static readonly int[] PesosNit = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

    private static readonly int[] PesosCuit = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    private static readonly int[] PesosRnc = [7, 9, 8, 6, 5, 4, 3, 2];

    public static string? Calcular(AlgoritmoDv algoritmo, string numero) => algoritmo switch
    {
        AlgoritmoDv.NitColombia => NitColombia(numero),
        AlgoritmoDv.RutChile => RutChile(numero),
        AlgoritmoDv.CuitArgentina => CuitArgentina(numero),
        _ => null
    };

    /// <summary>El DV declarado de un RUC de Panamá son dos dígitos (AvalaSoft no lo calcula).</summary>
    public static bool DvDeclaradoValido(string? dv) => dv is { Length: 2 } && dv.All(char.IsAsciiDigit);

    /// <summary>¿El número (solo dígitos, ya normalizado) pasa el control propio de su tipo? Sin control, siempre.</summary>
    public static bool NumeroValido(ControlDeNumero control, string numero) => control switch
    {
        ControlDeNumero.RncDominicano => numero.Length switch
        {
            9 => numero.All(char.IsAsciiDigit) && numero[8].ToString() == RncDominicano(numero[..8]),
            11 => CedulaDominicana(numero),
            _ => false
        },
        ControlDeNumero.CedulaDominicana => CedulaDominicana(numero),
        _ => true
    };

    /// <summary>DGII: pesos 7, 9, 8, 6, 5, 4, 3, 2 sobre los ocho primeros dígitos; residuo módulo 11 (0 ⇒ 2, 1 ⇒ 1, otro ⇒ 11 − residuo).</summary>
    public static string RncDominicano(string primerosOcho)
    {
        var suma = 0;
        for (var i = 0; i < PesosRnc.Length; i++)
            suma += (primerosOcho[i] - '0') * PesosRnc[i];

        return (suma % 11) switch
        {
            0 => "2",
            1 => "1",
            var r => (11 - r).ToString()
        };
    }

    /// <summary>Cédula dominicana: 11 dígitos, el último de control con el algoritmo de Luhn (pesos 1 y 2 de izquierda a derecha).</summary>
    public static bool CedulaDominicana(string numero)
    {
        if (numero.Length != 11 || !numero.All(char.IsAsciiDigit))
            return false;

        var suma = 0;
        for (var i = 0; i < 11; i++)
        {
            var producto = (numero[i] - '0') * (i % 2 == 0 ? 1 : 2);
            suma += producto > 9 ? producto - 9 : producto;
        }

        return suma % 10 == 0;
    }

    /// <summary>DIAN: pesos primos de derecha a izquierda, residuo módulo 11.</summary>
    public static string NitColombia(string numero)
    {
        var suma = 0;
        for (var i = 0; i < numero.Length; i++)
            suma += (numero[numero.Length - 1 - i] - '0') * PesosNit[i];

        var residuo = suma % 11;
        return (residuo > 1 ? 11 - residuo : residuo).ToString();
    }

    /// <summary>Módulo 11 con pesos 2..7 cíclicos de derecha a izquierda; 10 se escribe K.</summary>
    public static string RutChile(string numero)
    {
        var suma = 0;
        var peso = 2;
        for (var i = numero.Length - 1; i >= 0; i--)
        {
            suma += (numero[i] - '0') * peso;
            peso = peso == 7 ? 2 : peso + 1;
        }

        return (11 - (suma % 11)) switch
        {
            11 => "0",
            10 => "K",
            var r => r.ToString()
        };
    }

    /// <summary>AFIP: pesos 5432765432 sobre los diez primeros dígitos.</summary>
    public static string CuitArgentina(string numero)
    {
        var suma = 0;
        for (var i = 0; i < PesosCuit.Length; i++)
            suma += (numero[i] - '0') * PesosCuit[i];

        return (11 - (suma % 11)) switch
        {
            11 => "0",
            10 => "9",
            var r => r.ToString()
        };
    }
}
