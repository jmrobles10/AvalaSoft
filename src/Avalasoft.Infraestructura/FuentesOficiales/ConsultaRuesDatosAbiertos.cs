using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Avalasoft.Aplicacion.FuentesOficiales;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.FuentesOficiales;

namespace Avalasoft.Infraestructura.FuentesOficiales;

/// <summary>
/// RUES por los datos abiertos de Confecámaras (FO-2): el conjunto «Personas Naturales, Personas Jurídicas y Entidades Sin Ánimo de Lucro»
/// (<c>c82u-588k</c>) de datos.gov.co, con la API pública SODA de Socrata. Es la única API oficial del registro mercantil que se pudo confirmar sin
/// contrato: gratis, licencia CC BY-SA 4.0, sin autenticación (un token de aplicación de datos.gov.co, en el campo clave, sube el límite de
/// consultas). <b>Limitaciones</b>: Confecámaras lo sincroniza <b>cada mes</b> (una cancelación reciente puede no aparecer todavía; la fecha de
/// actualización va en los datos); solo trae un representante legal por matrícula (el principal), sin cargo ni suplentes; no trae dirección ni correo.
/// Para lo completo y al día hay que contratar la API del RUES (proveedor <c>Contrato</c>). La consulta va por NIT o número de identificación
/// (<c>$where=nit='…' OR numero_identificacion='…'</c>, solo dígitos). Si el NIT tiene varias matrículas se toma la principal activa y, entre
/// ellas, la de renovación más reciente. Apagado por omisión.
/// </summary>
public sealed class ConsultaRuesDatosAbiertos(IHttpClientFactory clientes) : IFuenteOficial
{
    public const string Cliente = "fuentes-rues-datosabiertos";
    public const string RecursoPorOmision = "resource/c82u-588k.json";

    public TipoVerificacion Fuente => TipoVerificacion.Rues;

    public string Proveedor => ProveedoresDeFuentes.DatosAbiertos;

    public async Task<RespuestaOficial> ConsultarAsync(SolicitudOficial solicitud, CancellationToken ct)
    {
        var numero = new string(solicitud.Numero.Where(char.IsDigit).ToArray());
        var referencia = $"rues-{Guid.CreateVersion7():N}";
        const string criterio = "RUES · datos abiertos de Confecámaras (datos.gov.co, conjunto c82u-588k; se actualiza cada mes)";
        // Solo dígitos van al filtro: nada del tercero se arma como texto libre en la consulta.
        if (numero.Length is < 3 or > 15)
            return new RespuestaOficial(referencia, DatosOficiales.NoEncontrado, criterio, "[]");

        var url = FuenteBase(solicitud);
        var recurso = solicitud.Opciones.Extra("Recurso", RecursoPorOmision);
        var consulta = Uri.EscapeDataString($"nit='{numero}' OR numero_identificacion='{numero}'");
        var uri = new Uri(url, $"{recurso}?$where={consulta}&$limit=20");
        var (estado, texto) = await ClienteDeFuentes.EnviarAsync(clientes.CreateClient(Cliente), () =>
        {
            var peticion = new HttpRequestMessage(HttpMethod.Get, uri);
            peticion.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (solicitud.Credenciales?.Clave is { Length: > 0 } token)
                peticion.Headers.Add("X-App-Token", token);
            return peticion;
        }, solicitud.Opciones, "RUES (datos abiertos)", ct);

        if (estado == HttpStatusCode.TooManyRequests)
            throw new FuenteOficialNoDisponibleException("Los datos abiertos respondieron que se superó el límite de consultas; se reintentará (un token de aplicación de datos.gov.co lo sube).");
        if (estado is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new FuenteOficialNoDisponibleException("Los datos abiertos rechazaron el token de aplicación.");
        if (estado != HttpStatusCode.OK)
            throw new FuenteOficialNoDisponibleException($"Los datos abiertos del RUES respondieron HTTP {(int)estado}.");

        try
        {
            using var documento = JsonDocument.Parse(texto);
            if (documento.RootElement.ValueKind != JsonValueKind.Array)
                throw new FuenteOficialNoDisponibleException("Los datos abiertos del RUES devolvieron algo que no es una lista.");
            var filas = documento.RootElement.EnumerateArray().Where(f => f.ValueKind == JsonValueKind.Object).ToList();
            return new RespuestaOficial(referencia, filas.Count == 0 ? DatosOficiales.NoEncontrado : Mapear(Elegir(filas)), criterio, texto);
        }
        catch (JsonException e)
        {
            throw new FuenteOficialNoDisponibleException("Los datos abiertos del RUES devolvieron una respuesta que no es JSON.", e);
        }
    }

    private static Uri FuenteBase(SolicitudOficial solicitud) =>
        ClienteDeFuentes.Base(solicitud.Credenciales?.UrlBase ?? solicitud.Opciones.UrlBase ?? OpcionesDeFuentesOficiales.UrlPorOmision(TipoVerificacion.Rues, ProveedoresDeFuentes.DatosAbiertos)!);

    /// <summary>De varias matrículas del mismo NIT: la principal (o de persona natural), activa, y la renovada más recientemente.</summary>
    internal static JsonElement Elegir(IReadOnlyList<JsonElement> filas) =>
        filas.OrderByDescending(f => Texto(f, "categoria_matricula") is { } c && (c.Contains("PRINCIPAL", StringComparison.OrdinalIgnoreCase) || c.Contains("NATURAL", StringComparison.OrdinalIgnoreCase)))
            .ThenByDescending(f => EstadosOficiales.Normalizar(Texto(f, "estado_matricula")) == EstadoOficial.Vigente)
            .ThenByDescending(f => Entero(f, "ultimo_ano_renovado") ?? 0)
            .ThenByDescending(f => Texto(f, "fecha_actualizacion") ?? string.Empty, StringComparer.Ordinal)
            .First();

    internal static DatosOficiales Mapear(JsonElement fila)
    {
        var estado = Texto(fila, "estado_matricula");
        var representante = Texto(fila, "representante_legal");
        return new DatosOficiales
        {
            Encontrado = true,
            Nit = Texto(fila, "nit") ?? Texto(fila, "numero_identificacion"),
            Dv = Texto(fila, "digito_verificacion"),
            RazonSocial = Texto(fila, "razon_social"),
            Estado = estado,
            EstadoNormalizado = EstadosOficiales.Normalizar(estado),
            Matricula = Texto(fila, "matricula"),
            Camara = Texto(fila, "camara_comercio"),
            TipoOrganizacion = Texto(fila, "organizacion_juridica"),
            UltimoAnoRenovado = Entero(fila, "ultimo_ano_renovado"),
            FechaMatricula = Fecha(fila, "fecha_matricula"),
            FechaRenovacion = Fecha(fila, "fecha_renovacion"),
            FechaCancelacion = EstadosOficiales.Normalizar(estado) == EstadoOficial.NoVigente ? Fecha(fila, "fecha_cancelacion") : null,
            Representantes = representante is null ? [] : [new RepresentanteOficial(representante, Texto(fila, "num_identificacion_representante_legal"), "Representante legal")],
            ActividadPrincipal = Texto(fila, "cod_ciiu_act_econ_pri"),
            ActualizadoEnLaFuente = FechaHora(fila, "fecha_actualizacion")
        };
    }

    private static string? Texto(JsonElement fila, string clave) =>
        fila.TryGetProperty(clave, out var v) && v.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(v.GetString()) ? v.GetString()!.Trim() : null;

    private static int? Entero(JsonElement fila, string clave) =>
        Texto(fila, clave) is { } texto && int.TryParse(texto, NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : null;

    /// <summary>«20260330» (las fechas del conjunto van como texto); fechas sin sentido («00000000», «99991231») no cuentan.</summary>
    private static DateOnly? Fecha(JsonElement fila, string clave) =>
        Texto(fila, clave) is { } texto && DateOnly.TryParseExact(texto, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha) &&
        fecha.Year is > 1900 and < 3000
            ? fecha
            : null;

    private static DateOnly? FechaHora(JsonElement fila, string clave) =>
        Texto(fila, clave) is { Length: >= 10 } texto && DateOnly.TryParseExact(texto[..10], "yyyy/MM/dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha)
            ? fecha
            : null;
}
