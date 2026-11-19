using System.Globalization;
using Microsoft.Extensions.Configuration;
using Validalo.Dominio.Documentos;
using Validalo.Dominio.Plataforma;

namespace Validalo.Aplicacion.Comun;

/// <summary>
/// Cómo se escribe en un correo un instante (el vencimiento de un enlace o de un código, la fecha de una constancia): en <b>hora local</b> de la
/// zona del grupo y legible en es-CO —«17 de noviembre de 2026, 10:08 p. m.»—, nunca en UTC (el tercero lee «03:08 UTC» y no sabe qué hora es
/// en su reloj). Es el único lugar que formatea fechas con hora de los correos: los redactores no llaman a <c>ToString</c> con su propio formato.
/// </summary>
public static class FechasDeCorreo
{
    /// <summary>Zona de la plataforma si <c>Validalo:ZonaHoraria</c> no dice otra (la misma de las fechas de calendario del negocio, FE-1).</summary>
    public const string ZonaPorOmision = "America/Bogota";

    private static readonly CultureInfo Cultura = CultureInfo.GetCultureInfo("es-CO");

    /// <summary>La zona de la plataforma: <c>Validalo:ZonaHoraria</c> o, sin ella, <see cref="ZonaPorOmision"/>.</summary>
    public static string ZonaDeLaPlataforma(IConfiguration configuracion) =>
        configuracion["Validalo:ZonaHoraria"] is { Length: > 0 } zona ? zona : ZonaPorOmision;

    /// <summary>
    /// «17 de noviembre de 2026, 10:08 p. m. (hora de Colombia)» para el instante en <paramref name="zonaHoraria"/> (IANA; vacía o nula = la de la
    /// plataforma por omisión). La aclaración «hora de Colombia» solo va si la zona es la de Bogotá; con otra zona se escribe la hora local sin
    /// aclaración, y si el sistema no conoce la zona se dice que es UTC (no se deja una hora sin zona que parezca local).
    /// </summary>
    public static string Larga(DateTimeOffset instante, string? zonaHoraria)
    {
        var id = string.IsNullOrWhiteSpace(zonaHoraria) ? ZonaPorOmision : zonaHoraria.Trim();
        var zona = CalculadoraDeVigencia.Zona(id);
        var local = TimeZoneInfo.ConvertTime(instante, zona);
        var hora = local.Hour % 12 == 0 ? 12 : local.Hour % 12;
        var meridiano = local.Hour < 12 ? "a. m." : "p. m.";
        var texto = $"{local.ToString("d 'de' MMMM 'de' yyyy", Cultura)}, {hora}:{local.Minute:00} {meridiano}";
        if (string.Equals(id, ZonaPorOmision, StringComparison.OrdinalIgnoreCase))
            return texto + " (hora de Colombia)";
        return zona.Equals(TimeZoneInfo.Utc) && !string.Equals(id, "UTC", StringComparison.OrdinalIgnoreCase) ? texto + " (UTC)" : texto;
    }
}

/// <summary>
/// La zona horaria con la que se escriben las fechas de un correo: la del grupo (tenant) que lo origina si lo hay y, si no (el acceso general del
/// tercero no es de ninguna empresa), la de la plataforma.
/// </summary>
public sealed class ZonasDeCorreo(ISesiones sesiones, IConfiguration configuracion)
{
    /// <summary>Zona IANA del grupo; la de la plataforma si no hay grupo o ya no existe.</summary>
    public async Task<string> DelTenantAsync(Guid? tenantId, CancellationToken ct)
    {
        if (tenantId is { } id)
        {
            await using var consulta = sesiones.ConsultaGlobal();
            if ((await consulta.LoadAsync<Tenant>(id, ct))?.ZonaHoraria is { Length: > 0 } zona)
                return zona;
        }

        return FechasDeCorreo.ZonaDeLaPlataforma(configuracion);
    }
}
