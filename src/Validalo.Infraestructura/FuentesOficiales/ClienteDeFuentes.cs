using System.Net;
using Validalo.Aplicacion.FuentesOficiales;

namespace Validalo.Infraestructura.FuentesOficiales;

/// <summary>
/// Envío HTTP de los adaptadores reales de las fuentes oficiales (FO-2): reintenta en el acto los fallos transitorios (red, 408, 500, 502, 503, 504)
/// <see cref="OpcionesDeFuente.Reintentos"/> veces con espera exponencial, y deja que el resto (4xx, límite de consultas) lo juzgue el adaptador. El
/// tiempo de espera total, la concurrencia y el cortacircuito los pone <c>ControlDeProveedores</c> por encima; los reintentos de más largo plazo
/// (minutos) son del expediente. Una cancelación (el tiempo se acabó) no se reintenta.
/// </summary>
internal static class ClienteDeFuentes
{
    public static async Task<(HttpStatusCode Estado, string Texto)> EnviarAsync(HttpClient cliente, Func<HttpRequestMessage> crear, OpcionesDeFuente opciones,
        string nombre, CancellationToken ct)
    {
        for (var intento = 0; ; intento++)
        {
            try
            {
                using var peticion = crear();
                using var respuesta = await cliente.SendAsync(peticion, ct);
                var texto = await respuesta.Content.ReadAsStringAsync(ct);
                if (!EsTransitorio(respuesta.StatusCode) || intento >= opciones.Reintentos)
                    return (respuesta.StatusCode, texto);
            }
            catch (HttpRequestException e)
            {
                if (intento >= opciones.Reintentos)
                    throw new FuenteOficialNoDisponibleException($"{nombre} no respondió: {e.Message}", e);
            }

            if (opciones.EsperaEntreReintentos > TimeSpan.Zero)
                await Task.Delay(opciones.EsperaEntreReintentos * Math.Pow(2, intento), ct);
        }
    }

    private static bool EsTransitorio(HttpStatusCode estado) =>
        estado is HttpStatusCode.RequestTimeout or HttpStatusCode.InternalServerError or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.GatewayTimeout;

    public static Uri Base(string url) => new(url.EndsWith('/') ? url : url + "/");
}
