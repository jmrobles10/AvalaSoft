using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Validasoft.Aplicacion.FuentesOficiales;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.FuentesOficiales;

namespace Validasoft.Infraestructura.FuentesOficiales;

/// <summary>
/// Fuente por contrato (FO-2): la API que Plataforma o la empresa contrate. Para el RUES completo y al día (representantes y suplentes, dirección,
/// establecimientos) es la API del RUES con Confecámaras o un proveedor autorizado que la revenda; para la DIAN es <b>la única vía</b>: la DIAN
/// no publica una API del estado del RUT (la consulta pública de muisca.dian.gov.co va con captcha y no se automatiza: no se hace scraping), así que
/// hace falta un convenio o un proveedor autorizado (p. ej. un intermediario de datos tributarios o el servicio web de facturación electrónica con
/// habilitación de la DIAN). <b>Nada de esto se pudo confirmar sin contrato</b>, por eso la forma de la consulta y de la respuesta es <b>configuración
/// y un lector tolerante</b>, no código: ruta, nombre de los parámetros, autenticación (<c>Bearer</c>, <c>Basic</c> o un encabezado) y claves de la
/// respuesta (<see cref="LectorDeRespuestaOficial"/>). Cuando llegue el contrato se ajusta en
/// <c>Validasoft:Verificadores:FuentesOficiales:{Fuente}:Proveedores:Contrato:*</c> y se prueba con el usuario de pruebas. Apagado por omisión; nunca se
/// llama sin credenciales.
/// </summary>
public sealed class ConsultaPorContrato(TipoVerificacion fuente, IHttpClientFactory clientes) : IFuenteOficial
{
    public const string Cliente = "fuentes-contrato";

    public TipoVerificacion Fuente => fuente;

    public string Proveedor => ProveedoresDeFuentes.Contrato;

    public async Task<RespuestaOficial> ConsultarAsync(SolicitudOficial solicitud, CancellationToken ct)
    {
        var nombre = $"{CatalogoDeFuentes.Nombre(fuente)} por contrato";
        var credenciales = solicitud.Credenciales;
        if (credenciales is null || string.IsNullOrEmpty(credenciales.Clave) || (credenciales.UrlBase ?? solicitud.Opciones.UrlBase) is not { Length: > 0 } direccion)
            throw new FuenteOficialNoDisponibleException($"{nombre} necesita la URL del contrato y las credenciales.");

        var opciones = solicitud.Opciones;
        var ruta = opciones.Extra("Ruta", string.Empty);
        var parametroNit = opciones.Extra("ParametroNit", "nit");
        var parametroTipo = opciones.Extra("ParametroTipoDocumento", string.Empty);
        var numero = Uri.EscapeDataString(new string(solicitud.Numero.Where(char.IsLetterOrDigit).ToArray()));
        var consulta = $"{ruta}?{parametroNit}={numero}" + (parametroTipo.Length == 0 ? string.Empty : $"&{parametroTipo}={Uri.EscapeDataString(solicitud.TipoIdentificacion)}");
        var uri = new Uri(ClienteDeFuentes.Base(direccion), consulta.TrimStart('/'));
        var autenticacion = opciones.Extra("Autenticacion", "Bearer");

        var (estado, texto) = await ClienteDeFuentes.EnviarAsync(clientes.CreateClient(Cliente), () =>
        {
            var peticion = new HttpRequestMessage(HttpMethod.Get, uri);
            peticion.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            switch (autenticacion.ToLowerInvariant())
            {
                case "basic":
                    peticion.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{credenciales.Usuario}:{credenciales.Clave}")));
                    break;
                case "encabezado":
                    peticion.Headers.TryAddWithoutValidation(opciones.Extra("Encabezado", "X-Api-Key"), credenciales.Clave);
                    break;
                default:
                    peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credenciales.Clave);
                    break;
            }

            return peticion;
        }, opciones, nombre, ct);

        var referencia = $"{CatalogoDeFuentes.Nombre(fuente).ToLowerInvariant()}-{Guid.CreateVersion7():N}";
        var criterio = $"{CatalogoDeFuentes.Nombre(fuente)} · API por contrato";
        if (estado == HttpStatusCode.NotFound)
            return new RespuestaOficial(referencia, DatosOficiales.NoEncontrado, criterio, texto.Length == 0 ? "{}" : texto);
        if (estado is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new FuenteOficialNoDisponibleException($"{nombre} rechazó las credenciales.");
        if (estado == HttpStatusCode.TooManyRequests)
            throw new FuenteOficialNoDisponibleException($"{nombre} respondió que se superó el límite de consultas del plan; se reintentará.");
        if (!(estado is >= HttpStatusCode.OK and < HttpStatusCode.MultipleChoices))
            throw new FuenteOficialNoDisponibleException($"{nombre} respondió HTTP {(int)estado}.");

        try
        {
            return new RespuestaOficial(referencia, LectorDeRespuestaOficial.Leer(texto, fuente), criterio, texto);
        }
        catch (JsonException e)
        {
            throw new FuenteOficialNoDisponibleException($"{nombre} devolvió una respuesta que no es JSON.", e);
        }
    }
}

/// <summary>
/// Lee de forma tolerante la respuesta de una fuente por contrato (FO-3): busca el registro en la raíz o dentro de <c>data</c>/<c>result</c>/
/// <c>content</c>/<c>commercialRegistry</c> (si es una lista, el primero), y en él cada dato con varios nombres posibles (español, inglés, snake y camel
/// case). Lo que no entiende queda nulo, nunca inventado; un registro vacío o sin razón social ni estado es «no encontrado».
/// </summary>
public static class LectorDeRespuestaOficial
{
    private static readonly string[] Contenedores = ["data", "result", "resultado", "content", "response", "respuesta", "commercialRegistry", "registro"];
    private static readonly string[] ClavesNit = ["nit", "numeroIdentificacion", "numero_identificacion", "documentNumber", "identificacion", "identification"];
    private static readonly string[] ClavesDv = ["dv", "digitoVerificacion", "digito_verificacion", "verificationDigit"];
    private static readonly string[] ClavesRazon = ["razonSocial", "razon_social", "businessName", "nombre", "name", "denominacion"];
    private static readonly string[] ClavesEstado = ["estado", "estadoMatricula", "estado_matricula", "registrationStatus", "estadoRut", "estado_rut", "status"];
    private static readonly string[] ClavesMatricula = ["matricula", "numeroMatricula", "registrationNumber"];
    private static readonly string[] ClavesCamara = ["camaraComercio", "camara_comercio", "camara", "chamberCommerce", "chamber"];
    private static readonly string[] ClavesOrganizacion = ["organizacionJuridica", "organizacion_juridica", "tipoOrganizacion", "organizationType", "companyType"];
    private static readonly string[] ClavesAno = ["ultimoAnoRenovado", "ultimo_ano_renovado", "ultimoAnioRenovado", "lastRenewedYear"];
    private static readonly string[] ClavesRenovacion = ["fechaRenovacion", "fecha_renovacion", "renewalDate"];
    private static readonly string[] ClavesMatriculaFecha = ["fechaMatricula", "fecha_matricula", "enrollmentDate"];
    private static readonly string[] ClavesCancelacion = ["fechaCancelacion", "fecha_cancelacion", "cancellationDate"];
    private static readonly string[] ClavesRepresentantes = ["representantesLegales", "representantes_legales", "legalRepresentatives", "representantes"];
    private static readonly string[] ClavesDireccion = ["direccion", "direccionPrincipal", "address", "commercialAddress"];
    private static readonly string[] ClavesMunicipio = ["codigoMunicipio", "codigo_municipio", "municipio", "ciudad", "city", "companyLocation"];
    private static readonly string[] ClavesActividad = ["actividadEconomicaPrincipal", "actividadPrincipal", "ciiu", "codigoCiiu", "cod_ciiu_act_econ_pri"];
    private static readonly string[] ClavesResponsabilidades = ["responsabilidades", "responsibilities", "calidadesTributarias"];
    private static readonly string[] ClavesActualizado = ["fechaActualizacion", "fecha_actualizacion", "lastUpdatedDate", "actualizadoEn"];

    public static DatosOficiales Leer(string json, TipoVerificacion fuente)
    {
        using var documento = JsonDocument.Parse(json);
        var registro = Registro(documento.RootElement);
        if (registro is not { } r || (Texto(r, ClavesRazon) is null && Texto(r, ClavesEstado) is null))
            return DatosOficiales.NoEncontrado;

        var estado = Texto(r, ClavesEstado);
        var renovacion = Fecha(r, ClavesRenovacion);
        return new DatosOficiales
        {
            Encontrado = true,
            Nit = Texto(r, ClavesNit),
            Dv = Texto(r, ClavesDv),
            RazonSocial = Texto(r, ClavesRazon),
            Estado = estado,
            EstadoNormalizado = EstadosOficiales.Normalizar(estado),
            Matricula = fuente == TipoVerificacion.Rues ? Texto(r, ClavesMatricula) : null,
            Camara = fuente == TipoVerificacion.Rues ? Texto(r, ClavesCamara) : null,
            TipoOrganizacion = Texto(r, ClavesOrganizacion),
            UltimoAnoRenovado = Texto(r, ClavesAno) is { } ano && int.TryParse(ano, NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : renovacion?.Year,
            FechaMatricula = Fecha(r, ClavesMatriculaFecha),
            FechaRenovacion = renovacion,
            FechaCancelacion = Fecha(r, ClavesCancelacion),
            Representantes = Representantes(r),
            Direccion = Texto(r, ClavesDireccion),
            Municipio = Texto(r, ClavesMunicipio),
            ActividadPrincipal = Texto(r, ClavesActividad),
            Responsabilidades = Lista(r, ClavesResponsabilidades),
            ActualizadoEnLaFuente = Fecha(r, ClavesActualizado)
        };
    }

    private static JsonElement? Registro(JsonElement raiz)
    {
        if (raiz.ValueKind == JsonValueKind.Array)
            return raiz.EnumerateArray().Cast<JsonElement?>().FirstOrDefault(e => e is { ValueKind: JsonValueKind.Object });
        if (raiz.ValueKind != JsonValueKind.Object)
            return null;
        // Un registro tiene datos propios; si no, se busca dentro del contenedor habitual.
        if (Texto(raiz, ClavesRazon) is not null || Texto(raiz, ClavesEstado) is not null)
            return raiz;
        foreach (var clave in Contenedores)
        {
            if (Propiedad(raiz, clave) is { } interior && Registro(interior) is { } encontrado)
                return encontrado;
        }

        return null;
    }

    private static JsonElement? Propiedad(JsonElement objeto, string nombre)
    {
        if (objeto.ValueKind != JsonValueKind.Object)
            return null;
        foreach (var p in objeto.EnumerateObject())
            if (string.Equals(p.Name, nombre, StringComparison.OrdinalIgnoreCase))
                return p.Value;
        return null;
    }

    private static string? Texto(JsonElement objeto, string[] claves)
    {
        foreach (var clave in claves)
        {
            if (Propiedad(objeto, clave) is not { } valor)
                continue;
            var texto = valor.ValueKind switch
            {
                JsonValueKind.String => valor.GetString(),
                JsonValueKind.Number => valor.GetRawText(),
                _ => null
            };
            if (!string.IsNullOrWhiteSpace(texto))
                return texto.Trim();
        }

        return null;
    }

    private static IReadOnlyList<string> Lista(JsonElement objeto, string[] claves)
    {
        foreach (var clave in claves)
        {
            if (Propiedad(objeto, clave) is not { ValueKind: JsonValueKind.Array } lista)
                continue;
            return
            [
                .. lista.EnumerateArray().Select(e => e.ValueKind switch
                {
                    JsonValueKind.String => e.GetString(),
                    JsonValueKind.Number => e.GetRawText(),
                    JsonValueKind.Object => Texto(e, ["codigo", "code", "id", "valor"]),
                    _ => null
                }).Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t!.Trim())
            ];
        }

        return [];
    }

    private static IReadOnlyList<RepresentanteOficial> Representantes(JsonElement registro)
    {
        foreach (var clave in ClavesRepresentantes)
        {
            if (Propiedad(registro, clave) is not { ValueKind: JsonValueKind.Array } lista)
                continue;
            return
            [
                .. lista.EnumerateArray().Where(e => e.ValueKind == JsonValueKind.Object).Select(e => new RepresentanteOficial(
                    Texto(e, ["nombre", "name", "fullName", "nombreCompleto", "razonSocial"]),
                    Texto(e, ["identificacion", "documentNumber", "numeroIdentificacion", "numero_identificacion", "documento", "numeroDocumento"]),
                    Texto(e, ["cargo", "role", "rol", "tipo", "type"]))).Where(r => r.Nombre is not null || r.Identificacion is not null)
            ];
        }

        return [];
    }

    private static DateOnly? Fecha(JsonElement objeto, string[] claves)
    {
        if (Texto(objeto, claves) is not { } texto)
            return null;
        foreach (var formato in new[] { "yyyyMMdd", "yyyy-MM-dd", "yyyy/MM/dd", "dd/MM/yyyy" })
        {
            if (texto.Length >= formato.Length && DateOnly.TryParseExact(texto[..formato.Length], formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var fecha) &&
                fecha.Year is > 1900 and < 3000)
                return fecha;
        }

        return DateOnly.TryParse(texto, CultureInfo.InvariantCulture, DateTimeStyles.None, out var libre) && libre.Year is > 1900 and < 3000 ? libre : null;
    }
}
