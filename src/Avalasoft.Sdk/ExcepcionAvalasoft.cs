using System.Net;

namespace Avalasoft.Sdk;

/// <summary>
/// Respuesta de error de la API (Problem Details): <see cref="Codigo"/> es el código estable de la regla
/// (<c>vinculo-no-encontrado</c>, <c>api-key-ya-rotada</c>…) para decidir en el integrador; <see cref="Detalle"/> es el texto
/// para humanos.
/// </summary>
public sealed class ExcepcionAvalasoft : Exception
{
    public ExcepcionAvalasoft(HttpStatusCode estado, string? codigo, string? detalle, string? correlacion)
        : base($"AvalaSoft respondió {(int)estado}{(codigo is null ? string.Empty : " " + codigo)}: {detalle ?? "sin detalle"}")
    {
        Estado = estado;
        Codigo = codigo;
        Detalle = detalle;
        Correlacion = correlacion;
    }

    public HttpStatusCode Estado { get; }

    public string? Codigo { get; }

    public string? Detalle { get; }

    /// <summary><c>X-Correlation-Id</c> de la respuesta: con él soporte encuentra la petición.</summary>
    public string? Correlacion { get; }
}
