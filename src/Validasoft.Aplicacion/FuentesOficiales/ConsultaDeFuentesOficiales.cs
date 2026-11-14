using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Marten;
using Validasoft.Aplicacion.Comun;
using Validasoft.Aplicacion.Verificaciones;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Documentos;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.FuentesOficiales;
using Validasoft.Dominio.Ia;
using Validasoft.Dominio.Plataforma;
using Validasoft.Dominio.Terceros;

namespace Validasoft.Aplicacion.FuentesOficiales;

/// <summary>Lo que hay que saber para consultar: el proveedor que toca, sus opciones y las credenciales (las de la empresa si trae las suyas; si no, las de la plataforma).</summary>
public sealed record ProveedorOficialResuelto(TipoVerificacion Fuente, string Nombre, OpcionesDeFuente Opciones, CredencialesDeFuenteOficial? Credenciales,
    bool CuentaDeLaPlataforma, IFuenteOficial Adaptador);

/// <summary>
/// Consulta de las fuentes oficiales (FO-2…FO-6): resuelve el proveedor de la empresa, consulta con el control de concurrencia, el tiempo de espera y
/// el cortacircuito por empresa y proveedor (los de las listas, VE-8), cotejo de lo que dice la fuente con la ficha maestra y con lo que la IA
/// extrajo del certificado de Cámara y del RUT, y guarda la evidencia (constancia con la respuesta, la fecha, la fuente y el hash de la respuesta, más
/// la respuesta cruda). No decide nada: el expediente o el monitoreo registran el resultado. Un fallo del proveedor es 503
/// <c>verificacion-no-disponible</c>: nada se da por satisfecho.
/// </summary>
public sealed class ConsultaDeFuentesOficiales(
    IEnumerable<IFuenteOficial> adaptadores, OpcionesDeFuentesOficiales opciones, ControlDeProveedores control, IAlmacenDeArchivos almacen,
    IProtectorDeSecretos protector, IDocumentStore store, IEntornos entornos, TimeProvider reloj)
{
    public const string TipoConstancia = "application/json";

    private static readonly JsonSerializerOptions OpcionesDeConstancia = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public OpcionesDeFuentesOficiales Opciones => opciones;

    /// <summary>La cuenta de la plataforma con las fuentes (credenciales y proveedor predeterminado): un solo documento global; nulo si Plataforma no la configuró.</summary>
    public async Task<FuentesOficialesDePlataforma?> PlataformaAsync(CancellationToken ct)
    {
        await using var global = store.QuerySession();
        return await global.LoadAsync<FuentesOficialesDePlataforma>(FuentesOficialesDePlataforma.IdUnico, ct);
    }

    /// <summary>
    /// Proveedor que usará la empresa para la fuente: el que eligió, el predeterminado de la plataforma o el de la instalación; en el sandbox, siempre el
    /// simulado (SB-4). 503 <c>verificacion-no-disponible</c> si no hay ninguno, si la instalación no lo habilitó, si falta su adaptador o si el de contrato
    /// no tiene credenciales. Las credenciales de la empresa mandan sobre las de la plataforma.
    /// </summary>
    public ProveedorOficialResuelto Resolver(TipoVerificacion fuente, FuentesOficialesEmpresa? empresa, FuentesOficialesDePlataforma? plataforma, bool sandbox = false)
    {
        var nombreFuente = CatalogoDeFuentes.Nombre(fuente);
        var elegido = sandbox ? ProveedoresDeFuentes.Simulado : empresa?.ProveedorDe(fuente) ?? plataforma?.PredeterminadoDe(fuente) ?? opciones.ProveedorPorDefecto(fuente)
                      ?? throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible",
                          $"La empresa no tiene un proveedor de {nombreFuente} configurado (Configuración › Fuentes oficiales).");
        var nombre = ProveedoresDeFuentes.Normalizar(fuente, elegido)
                     ?? throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible", $"«{elegido}» ya no es un proveedor de {nombreFuente}.");
        var deProveedor = sandbox ? opciones.Proveedor(fuente, nombre) with { Habilitado = true } : opciones.Proveedor(fuente, nombre);
        if (!deProveedor.Habilitado)
            throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible", $"{nombreFuente} · {nombre} no está habilitado en esta instalación.");
        var adaptador = adaptadores.FirstOrDefault(a => a.Fuente == fuente && a.Proveedor == nombre)
                        ?? throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible", $"No hay adaptador para {nombreFuente} · {nombre}.");
        var propias = empresa?.CredencialesDe(fuente, nombre);
        var deLaPlataforma = plataforma?.CredencialesDe(fuente, nombre);
        var credenciales = propias ?? deLaPlataforma;
        if (!sandbox && nombre == ProveedoresDeFuentes.Contrato && credenciales?.TieneClave != true)
            throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible",
                $"{nombreFuente} · Contrato no tiene credenciales: las configura Plataforma o la empresa (Configuración › Fuentes oficiales).");
        return new ProveedorOficialResuelto(fuente, nombre, deProveedor, credenciales, propias is null && deLaPlataforma is not null, adaptador);
    }

    /// <summary>El proveedor efectivo sin lanzar (para mostrarlo en la configuración); nulo si no hay ninguno utilizable.</summary>
    public string? Efectivo(TipoVerificacion fuente, FuentesOficialesEmpresa? empresa, FuentesOficialesDePlataforma? plataforma)
    {
        try
        {
            return Resolver(fuente, empresa, plataforma).Nombre;
        }
        catch (ReglaDeNegocioException)
        {
            return null;
        }
    }

    /// <summary>
    /// Consulta la fuente por el tercero del expediente y devuelve el resultado listo para registrar, con la evidencia ya guardada en el almacén del
    /// tenant. 503 <c>verificacion-no-disponible</c> si el proveedor falla, no está habilitado o no tiene credenciales. <paramref name="contexto"/>: folio
    /// del expediente (va en la constancia). <paramref name="vigenciaDias"/>: la del flujo o la de la instalación.
    /// </summary>
    public async Task<ConsultaOficialRealizada> ConsultarAsync(IDocumentSession sesion, Guid tenantId, Guid empresaId, Guid terceroId, TipoVerificacion fuente,
        string contexto, string consultadoPor, int vigenciaDias, CancellationToken ct)
    {
        var propias = await sesion.LoadAsync<FuentesOficialesEmpresa>(empresaId, ct);
        var proveedor = Resolver(fuente, propias, await PlataformaAsync(ct), await entornos.EsSandboxAsync(tenantId, ct));
        var tercero = await sesion.LoadAsync<Tercero>(terceroId, ct)
                      ?? throw ReglaDeNegocioException.NoEncontrado("tercero-no-encontrado", "El tercero del expediente no existe.");
        var (ficha, documentos) = await CargarParaCotejoAsync(sesion, empresaId, tercero, ct);
        var ahora = reloj.GetUtcNow();

        var identificacion = tercero.Identificacion;
        var enColombia = string.Equals(identificacion.Pais, "CO", StringComparison.OrdinalIgnoreCase);
        RespuestaOficial respuesta;
        if (!enColombia)
        {
            // La fuente solo cubre Colombia: no se llama a nadie y queda como «no figura» para que lo vea una persona (nunca se da por satisfecha).
            respuesta = new RespuestaOficial($"sin-consulta-{Guid.CreateVersion7():N}", DatosOficiales.NoEncontrado,
                $"{CatalogoDeFuentes.Nombre(fuente)} cubre solo Colombia: el tercero tiene una identificación de {identificacion.Pais}; no se consultó.",
                new JsonObject { ["consultada"] = false, ["motivo"] = "identificacion-fuera-de-colombia", ["pais"] = identificacion.Pais }.ToJsonString());
        }
        else
        {
            var credenciales = proveedor.Credenciales is { } c
                ? new CredencialesOficialesEnClaro(c.Usuario, c.TieneClave ? Descifrar(c, proveedor.CuentaDeLaPlataforma, tenantId) : null, c.UrlBase ?? proveedor.Opciones.UrlBase)
                : null;
            var solicitud = new SolicitudOficial(empresaId, fuente, identificacion.Pais, identificacion.Tipo, identificacion.Numero, ficha.General?.Dv, tercero.Nombre,
                credenciales, proveedor.Opciones);
            try
            {
                respuesta = await control.EjecutarAsync(empresaId, proveedor.Opciones.ParaElControl(), t => proveedor.Adaptador.ConsultarAsync(solicitud, t), ct);
            }
            catch (ProveedorDeListasNoDisponibleException e)
            {
                throw ReglaDeNegocioException.NoDisponible("verificacion-no-disponible", e.Message);
            }
        }

        var hoy = CalculadoraDeVigencia.Fecha(ahora);
        var campos = CruceConFuenteOficial.Cotejar(fuente, respuesta.Datos, ficha, documentos, hoy);
        var empresa = await sesion.LoadAsync<Empresa>(empresaId, ct);
        var evidencia = await GuardarEvidenciaAsync(tenantId, empresaId, fuente, proveedor.Nombre, respuesta, empresa?.Nombre ?? "Empresa", tercero, contexto, consultadoPor, ahora, ct);
        return new ConsultaOficialRealizada(proveedor.Nombre, respuesta.ReferenciaExterna, respuesta.Datos, campos, evidencia, ahora.AddDays(vigenciaDias));
    }

    private string Descifrar(CredencialesDeFuenteOficial c, bool deLaPlataforma, Guid tenantId) =>
        deLaPlataforma ? protector.Desproteger(c.ClaveProtegida!) : protector.DesprotegerDeGrupo(tenantId, c.ClaveProtegida!);

    /// <summary>
    /// La ficha maestra vigente (general, tributaria y legal) y los documentos analizados por IA que la empresa recibió (IA-11): el certificado de Cámara y
    /// el RUT, en su versión actual. Lo que la empresa no recibió no se cruza, igual que en el cruce de la ficha (F5).
    /// </summary>
    public async Task<(FichaParaCotejo Ficha, IReadOnlyList<DocumentoParaCotejo> Documentos)> CargarParaCotejoAsync(IDocumentSession sesion, Guid empresaId, Tercero tercero,
        CancellationToken ct)
    {
        var terceroId = tercero.Id;
        await using var boveda = store.QuerySession(TenantsTecnicos.Boveda);
        async Task<T?> Seccion<T>(string codigo) where T : class, new() =>
            await boveda.LoadAsync<SeccionDeFicha>(SeccionDeFicha.IdPara(terceroId, codigo, null), ct) is { Vigente: { } version } ? JsonDeFicha.Deserializar<T>(version.Datos) : null;

        var ficha = new FichaParaCotejo(tercero.TipoPersona, tercero.Nombre, tercero.Identificacion.Numero, await Seccion<DatosGenerales>(CodigosDeSeccion.General),
            await Seccion<DatosTributarios>(CodigosDeSeccion.Tributaria), await Seccion<DatosLegales>(CodigosDeSeccion.Legal));

        var candidatos = (await boveda.Query<Documento>().Where(d => d.TerceroId == terceroId && d.Ambito == AmbitoDocumento.Global).ToListAsync(ct))
            .Where(d => d.TipoCanonico is CruceConFuenteOficial.DocumentoCamara or CruceConFuenteOficial.DocumentoRut && d.VersionActual is not null)
            .ToList();
        if (candidatos.Count == 0)
            return (ficha, []);

        var ids = candidatos.Select(d => d.Id).ToArray();
        var consumidas = (await sesion.Query<ValidacionIaConsumida>().Where(v => v.EmpresaId == empresaId && v.DocumentoId.IsOneOf(ids)).ToListAsync(ct))
            .Select(v => (v.DocumentoId, v.Numero)).ToHashSet();
        var documentos = new List<DocumentoParaCotejo>();
        foreach (var documento in candidatos)
        {
            var numero = documento.VersionActual!.Value;
            if (!consumidas.Contains((documento.Id, numero)) || documento.Buscar(numero)?.Ia is not { Campos: { } campos } ia)
                continue;
            documentos.Add(new DocumentoParaCotejo(documento.TipoCanonico!, documento.Id, numero, campos, ia.Legible));
        }

        return (ficha, documentos);
    }

    /// <summary>
    /// La evidencia (FO-6): la respuesta cruda del proveedor con su SHA-256 y una constancia legible (fuente, proveedor, fecha, quién, criterio, lo
    /// normalizado y la respuesta), ambas content-addressed en el bucket del tenant. La constancia es lo que se descarga.
    /// </summary>
    private async Task<EvidenciaDeVerificacion> GuardarEvidenciaAsync(Guid tenantId, Guid empresaId, TipoVerificacion fuente, string proveedor, RespuestaOficial respuesta,
        string empresa, Tercero tercero, string contexto, string consultadoPor, DateTimeOffset ahora, CancellationToken ct)
    {
        var bucket = ClavesDeAlmacen.BucketDeTenant(tenantId);
        await almacen.AsegurarBucketAsync(bucket, ct);
        var metadatos = new Dictionary<string, string>
        {
            ["fuente"] = fuente.ToString(), ["proveedor"] = proveedor, ["referencia"] = respuesta.ReferenciaExterna
        };

        var cruda = Encoding.UTF8.GetBytes(respuesta.RespuestaCruda);
        var shaRespuesta = Convert.ToHexStringLower(SHA256.HashData(cruda));
        var claveRespuesta = ClavesDeAlmacen.EvidenciaDeVerificacion(empresaId, shaRespuesta, "json");
        await almacen.GuardarAsync(bucket, claveRespuesta, cruda, TipoConstancia, metadatos, ct);

        JsonNode? respuestaComoJson;
        try
        {
            respuestaComoJson = JsonNode.Parse(respuesta.RespuestaCruda);
        }
        catch (JsonException)
        {
            respuestaComoJson = JsonValue.Create(respuesta.RespuestaCruda);
        }

        var constancia = new JsonObject
        {
            ["documento"] = "Constancia de consulta a fuente oficial",
            ["fuente"] = CatalogoDeFuentes.Nombre(fuente),
            ["proveedor"] = proveedor,
            ["referencia"] = respuesta.ReferenciaExterna,
            ["criterio"] = respuesta.Criterio,
            ["consultadoEn"] = ahora.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture),
            ["consultadoPor"] = consultadoPor,
            ["empresa"] = empresa,
            ["contexto"] = contexto,
            ["tercero"] = $"{tercero.Identificacion.Tipo} {tercero.Identificacion.Numero}",
            ["sha256Respuesta"] = shaRespuesta,
            ["datos"] = JsonSerializer.SerializeToNode(respuesta.Datos, OpcionesDeConstancia),
            ["respuesta"] = respuestaComoJson
        };
        var bytes = new UTF8Encoding(false).GetBytes(constancia.ToJsonString(OpcionesDeConstancia));
        var sha = Convert.ToHexStringLower(SHA256.HashData(bytes));
        var clave = ClavesDeAlmacen.EvidenciaDeVerificacion(empresaId, sha, "json");
        await almacen.GuardarAsync(bucket, clave, bytes, TipoConstancia, metadatos, ct);

        var nombre = $"constancia-{fuente.ToString().ToLowerInvariant()}-{contexto}-{ahora.UtcDateTime.ToString("yyyyMMdd-HHmm", CultureInfo.InvariantCulture)}.json";
        return new EvidenciaDeVerificacion(bucket, clave, sha, bytes.LongLength, TipoConstancia, nombre, DelProveedor: false, claveRespuesta, shaRespuesta);
    }
}
