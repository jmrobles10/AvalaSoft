using Microsoft.Extensions.Configuration;
using Avalasoft.Aplicacion.Verificaciones;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.FuentesOficiales;

namespace Avalasoft.Aplicacion.FuentesOficiales;

/// <summary>Credenciales ya descifradas (solo viven en memoria durante la consulta). Todo es opcional según el proveedor.</summary>
public sealed record CredencialesOficialesEnClaro(string? Usuario, string? Clave, string? UrlBase);

/// <summary>
/// Lo que se le pregunta a una fuente: la identificación del tercero. <see cref="NombreDeclarado"/> solo lo usa el simulado (un adaptador real no
/// envía el nombre a nadie). <see cref="Opciones"/>: las de la instalación para ese proveedor (URL, tiempos y lo propio de cada adaptador).
/// </summary>
public sealed record SolicitudOficial(Guid EmpresaId, TipoVerificacion Fuente, string Pais, string TipoIdentificacion, string Numero, string? Dv,
    string NombreDeclarado, CredencialesOficialesEnClaro? Credenciales, OpcionesDeFuente Opciones);

/// <summary>Respuesta de un proveedor: lo normalizado, el criterio de la consulta (para la constancia) y su respuesta cruda para guardarla con su hash.</summary>
public sealed record RespuestaOficial(string ReferenciaExterna, DatosOficiales Datos, string Criterio, string RespuestaCruda);

/// <summary>
/// Adaptador de una fuente oficial (FO-2): corrobora al tercero contra el RUES (<see cref="TipoVerificacion.Rues"/>) o la DIAN
/// (<see cref="TipoVerificacion.Dian"/>). Los reales viven en infraestructura, están apagados por omisión y nunca se llaman sin que la instalación
/// los habilite; el simulado es determinista, para sandbox y pruebas. Un proveedor caído lanza <see cref="FuenteOficialNoDisponibleException"/>:
/// la verificación queda pendiente y se reintenta (nunca se da por satisfecha).
/// </summary>
public interface IFuenteOficial
{
    TipoVerificacion Fuente { get; }

    string Proveedor { get; }

    Task<RespuestaOficial> ConsultarAsync(SolicitudOficial solicitud, CancellationToken ct);
}

/// <summary>La fuente no respondió o respondió algo inutilizable. Es un <see cref="ProveedorDeListasNoDisponibleException"/> para que el mismo cortacircuito la cuente.</summary>
public sealed class FuenteOficialNoDisponibleException(string mensaje, Exception? causa = null) : ProveedorDeListasNoDisponibleException(mensaje, causa);

/// <summary>Opciones de un proveedor de una fuente (<c>Avalasoft:Verificadores:FuentesOficiales:{Fuente}:{Proveedor}:*</c>).</summary>
public sealed record OpcionesDeFuente(TipoVerificacion Fuente, string Nombre, bool Habilitado, string? UrlBase, TimeSpan Timeout, int MaximoConcurrencia, int FallosParaAbrir,
    TimeSpan TiempoAbierto, int Reintentos, TimeSpan EsperaEntreReintentos, IConfigurationSection? Seccion = null)
{
    /// <summary>Un valor propio del adaptador (ruta, nombres de parámetros…), con su valor por omisión.</summary>
    public string Extra(string clave, string porOmision) => Seccion?[clave] is { Length: > 0 } valor ? valor : porOmision;

    /// <summary>Lo mismo que el cortacircuito de las listas entiende (el nombre lleva la fuente: <c>Rues:DatosAbiertos</c>).</summary>
    public OpcionesDeProveedor ParaElControl() => new(ProveedoresDeFuentes.Clave(Fuente, Nombre), Habilitado, UrlBase, Timeout, MaximoConcurrencia, FallosParaAbrir, TiempoAbierto);
}

/// <summary>
/// Configuración de la instalación de las fuentes oficiales (<c>Avalasoft:Verificadores:FuentesOficiales</c>): qué proveedores están habilitados y
/// con qué URL, tiempos, concurrencia y cortacircuito (los mismos que las listas, VE-8), si el simulado está permitido (solo desarrollo y pruebas),
/// el proveedor por omisión de cada fuente, la vigencia de una consulta y cada cuánto se reintenta tras un fallo.
/// </summary>
public sealed class OpcionesDeFuentesOficiales(IConfiguration configuracion)
{
    private const string Raiz = "Avalasoft:Verificadores:FuentesOficiales";

    public bool PermitirSimulado { get; } = configuracion.GetValue($"{Raiz}:PermitirSimulado", false);

    /// <summary>Vigencia por omisión del resultado de una consulta, en días, cuando el flujo no indica la suya.</summary>
    public int VigenciaDias { get; } = Math.Clamp(configuracion.GetValue($"{Raiz}:VigenciaDias", 30), 1, 3650);

    public int MinutosReintento { get; } = Math.Clamp(configuracion.GetValue($"{Raiz}:MinutosReintento", 5), 1, 1440);

    public string? ProveedorPorDefecto(TipoVerificacion fuente) => ProveedoresDeFuentes.Normalizar(fuente, configuracion[$"{Raiz}:{fuente}:ProveedorPorDefecto"]);

    public OpcionesDeFuente Proveedor(TipoVerificacion fuente, string nombre)
    {
        var seccion = configuracion.GetSection($"{Raiz}:{fuente}:Proveedores:{nombre}");
        return new OpcionesDeFuente(fuente, nombre,
            nombre == ProveedoresDeFuentes.Simulado ? PermitirSimulado : seccion.GetValue("Habilitado", false),
            seccion["UrlBase"] ?? UrlPorOmision(fuente, nombre),
            TimeSpan.FromSeconds(Math.Clamp(seccion.GetValue("TimeoutSegundos", 30), 1, 300)),
            Math.Clamp(seccion.GetValue("MaximoConcurrencia", 4), 1, 64),
            Math.Clamp(seccion.GetValue("FallosParaAbrir", 5), 1, 100),
            TimeSpan.FromSeconds(Math.Clamp(seccion.GetValue("SegundosAbierto", 60), 1, 3600)),
            Math.Clamp(seccion.GetValue("Reintentos", 2), 0, 5),
            TimeSpan.FromMilliseconds(Math.Clamp(seccion.GetValue("EsperaEntreReintentosMs", 500), 0, 30000)),
            seccion);
    }

    /// <summary>URL pública conocida del proveedor (la empresa o la plataforma pueden traer la de su contrato). El de contrato no tiene: la da el contrato.</summary>
    public static string? UrlPorOmision(TipoVerificacion fuente, string nombre) =>
        fuente == TipoVerificacion.Rues && nombre == ProveedoresDeFuentes.DatosAbiertos ? "https://www.datos.gov.co/" : null;
}
