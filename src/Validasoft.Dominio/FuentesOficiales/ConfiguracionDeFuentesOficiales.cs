using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Expedientes;

namespace Validasoft.Dominio.FuentesOficiales;

/// <summary>
/// Credenciales de un proveedor de una fuente oficial (FO-5): usuario y clave (o token) con la clave solo cifrada; se expone si está
/// configurada y sus últimos 4. Todo es opcional según el proveedor: los datos abiertos del RUES funcionan sin nada (con un token de aplicación de
/// datos.gov.co se reduce el límite de consultas); un proveedor por contrato pide al menos la clave.
/// </summary>
public sealed class CredencialesDeFuenteOficial
{
    public string? Usuario { get; set; }

    public string? ClaveProtegida { get; set; }

    public string? UltimosCuatroClave { get; set; }

    /// <summary>URL propia del contrato (nula = la de la instalación). Siempre https.</summary>
    public string? UrlBase { get; set; }

    /// <summary>Notas del contrato o del plan (informativo).</summary>
    public string? Notas { get; set; }

    public DateTimeOffset ActualizadasEn { get; set; }

    public bool TieneClave => !string.IsNullOrEmpty(ClaveProtegida);

    /// <summary>
    /// Aplica un cambio (no el de quitar) y devuelve las credenciales nuevas. 422 <c>usuario-de-fuente-invalido</c> (hasta 200), <c>clave-invalida</c>
    /// (4 a 512), <c>url-invalida</c> (https), <c>notas-invalidas</c> (hasta 200), <c>credenciales-vacias</c> (sin nada que guardar).
    /// <paramref name="proteger"/> cifra la clave nueva.
    /// </summary>
    public static CredencialesDeFuenteOficial Combinar(CredencialesDeFuenteOficial? actuales, CambioDeCredencialesDeFuente cambio, Func<string, string> proteger,
        DateTimeOffset ahora)
    {
        var usuario = (cambio.Usuario ?? actuales?.Usuario)?.Trim();
        if (string.IsNullOrEmpty(usuario))
            usuario = null;
        if (usuario is { Length: > 200 })
            throw ReglaDeNegocioException.Validacion("usuario-de-fuente-invalido", "El usuario admite hasta 200 caracteres.");
        if (cambio.Clave is { } nueva && nueva.Trim().Length is < 4 or > 512)
            throw ReglaDeNegocioException.Validacion("clave-invalida", "La clave o el token deben tener entre 4 y 512 caracteres.");
        var url = string.IsNullOrWhiteSpace(cambio.UrlBase) ? null : cambio.UrlBase.Trim();
        if (url is not null && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps))
            throw ReglaDeNegocioException.Validacion("url-invalida", "La URL del proveedor debe ser https.");
        var notas = string.IsNullOrWhiteSpace(cambio.Notas) ? null : cambio.Notas.Trim();
        if (notas is { Length: > 200 })
            throw ReglaDeNegocioException.Validacion("notas-invalidas", "Las notas admiten hasta 200 caracteres.");
        if (usuario is null && cambio.Clave is null && actuales?.TieneClave != true)
            throw ReglaDeNegocioException.Validacion("credenciales-vacias", "Indica al menos el usuario o la clave del proveedor.");

        var credenciales = actuales ?? new CredencialesDeFuenteOficial();
        credenciales.Usuario = usuario;
        if (cambio.Clave is { } claveNueva)
        {
            var limpia = claveNueva.Trim();
            credenciales.ClaveProtegida = proteger(limpia);
            credenciales.UltimosCuatroClave = limpia[^4..];
        }

        credenciales.UrlBase = url;
        credenciales.Notas = notas;
        credenciales.ActualizadasEn = ahora;
        return credenciales;
    }
}

/// <summary>Cambio de credenciales de un proveedor. <see cref="Clave"/>: nula conserva, vacía quita las credenciales.</summary>
public sealed record CambioDeCredencialesDeFuente(string Fuente, string Proveedor, string? Usuario, string? Clave, string? UrlBase, string? Notas);

/// <summary>Reglas comunes de la configuración de la plataforma y de la empresa.</summary>
public static class ConfiguracionDeFuentes
{
    /// <summary>Reconsulta periódica de los vínculos activos: 0 (apagada) o de 1 a 365 días (FO-7).</summary>
    public const int MaximoDiasDeMonitoreo = 365;

    /// <summary>Resuelve fuente y proveedor del cambio de credenciales o de la elección de proveedor. 422 <c>fuente-oficial-invalida</c> / <c>proveedor-invalido</c>.</summary>
    public static (TipoVerificacion Fuente, string Proveedor) Resolver(string? fuente, string? proveedor, bool soloReales)
    {
        var tipo = CatalogoDeFuentes.Normalizar(fuente)
                   ?? throw ReglaDeNegocioException.Validacion("fuente-oficial-invalida", $"La fuente es {string.Join(" o ", CatalogoDeFuentes.Todas)}.");
        var nombre = ProveedoresDeFuentes.Normalizar(tipo, proveedor);
        if (nombre is null || (soloReales && nombre == ProveedoresDeFuentes.Simulado))
            throw ReglaDeNegocioException.Validacion("proveedor-invalido",
                $"Los proveedores de {CatalogoDeFuentes.Nombre(tipo)} son {string.Join(", ", soloReales ? ProveedoresDeFuentes.RealesPara(tipo) : ProveedoresDeFuentes.Para(tipo))}.");
        return (tipo, nombre);
    }
}

/// <summary>
/// Cuenta de la plataforma con los proveedores de las fuentes oficiales (FO-5): las credenciales que Plataforma contrata o recibe una vez para todos
/// los clientes (el token de datos.gov.co, la API contratada con Confecámaras o con quien consulte el RUT de la DIAN). La clave solo se guarda
/// cifrada con la clave maestra y nunca sale. Una empresa puede traer las suyas (<see cref="FuentesOficialesEmpresa"/>) y entonces mandan las suyas.
/// Un solo documento (id <see cref="IdUnico"/>) en el esquema <c>plataforma</c>. <see cref="Predeterminados"/>: el proveedor que usa cada fuente cuando
/// la empresa no escogió uno.
/// </summary>
public sealed class FuentesOficialesDePlataforma
{
    public const string IdUnico = "fuentes-oficiales";

    public string Id { get; set; } = IdUnico;

    /// <summary>Credenciales por <see cref="ProveedoresDeFuentes.Clave"/>.</summary>
    public Dictionary<string, CredencialesDeFuenteOficial> Credenciales { get; set; } = [];

    /// <summary>Proveedor predeterminado por fuente (<c>Rues</c> ⇒ <c>DatosAbiertos</c>).</summary>
    public Dictionary<string, string> Predeterminados { get; set; } = [];

    public DateTimeOffset ActualizadaEn { get; set; }

    public string? ActualizadaPor { get; set; }

    public CredencialesDeFuenteOficial? CredencialesDe(TipoVerificacion fuente, string proveedor) =>
        Credenciales.GetValueOrDefault(ProveedoresDeFuentes.Clave(fuente, proveedor));

    public string? PredeterminadoDe(TipoVerificacion fuente) => Predeterminados.GetValueOrDefault(fuente.ToString());

    /// <summary>Crea, cambia o quita (<c>Clave</c> vacía) las credenciales de un proveedor. Solo los reales llevan credenciales.</summary>
    public void CambiarCredenciales(CambioDeCredencialesDeFuente cambio, Func<string, string> proteger, string actor, DateTimeOffset ahora)
    {
        var (fuente, proveedor) = ConfiguracionDeFuentes.Resolver(cambio.Fuente, cambio.Proveedor, soloReales: true);
        var clave = ProveedoresDeFuentes.Clave(fuente, proveedor);
        if (cambio.Clave is { } quitar && quitar.Trim().Length == 0)
            Credenciales.Remove(clave);
        else
            Credenciales[clave] = CredencialesDeFuenteOficial.Combinar(Credenciales.GetValueOrDefault(clave), cambio, proteger, ahora);
        ActualizadaPor = actor;
        ActualizadaEn = ahora;
    }

    /// <summary>Fija (o quita, con nulo) el proveedor predeterminado de una fuente. 422 <c>fuente-oficial-invalida</c> / <c>proveedor-invalido</c>.</summary>
    public void ElegirPredeterminado(string fuente, string? proveedor, string actor, DateTimeOffset ahora)
    {
        if (string.IsNullOrWhiteSpace(proveedor))
        {
            var tipo = CatalogoDeFuentes.Normalizar(fuente) ?? throw ReglaDeNegocioException.Validacion("fuente-oficial-invalida", "La fuente es Rues o Dian.");
            Predeterminados.Remove(tipo.ToString());
        }
        else
        {
            var (tipo, nombre) = ConfiguracionDeFuentes.Resolver(fuente, proveedor, soloReales: false);
            Predeterminados[tipo.ToString()] = nombre;
        }

        ActualizadaPor = actor;
        ActualizadaEn = ahora;
    }
}

/// <summary>
/// Fuentes oficiales de una empresa (FO-5, FO-7): qué proveedor usa para cada fuente (nulo = el predeterminado de la plataforma o de la
/// instalación), sus credenciales propias si las tiene (opcional: manda la cuenta de la empresa sobre la de la plataforma; la clave se cifra con
/// la del grupo, como las de listas) y cada cuántos días se reconsultan los vínculos activos (0 = apagado, el valor por omisión). Esquema
/// <c>validacion</c>, multi-tenant; id = empresa.
/// </summary>
public sealed class FuentesOficialesEmpresa
{
    public Guid Id { get; set; }

    /// <summary>Proveedor elegido por fuente (<c>Rues</c> ⇒ <c>Contrato</c>).</summary>
    public Dictionary<string, string> Proveedores { get; set; } = [];

    public Dictionary<string, CredencialesDeFuenteOficial> Credenciales { get; set; } = [];

    /// <summary>Días entre reconsultas de un vínculo activo; 0 = no se reconsulta.</summary>
    public int DiasMonitoreo { get; set; }

    public DateTimeOffset ActualizadaEn { get; set; }

    public Guid EmpresaId => Id;

    public static FuentesOficialesEmpresa Nueva(Guid empresaId) => new() { Id = empresaId };

    public string? ProveedorDe(TipoVerificacion fuente) => Proveedores.GetValueOrDefault(fuente.ToString());

    public CredencialesDeFuenteOficial? CredencialesDe(TipoVerificacion fuente, string proveedor) =>
        Credenciales.GetValueOrDefault(ProveedoresDeFuentes.Clave(fuente, proveedor));

    /// <summary>Elige el proveedor de la fuente (vacío = el predeterminado). 422 <c>fuente-oficial-invalida</c> / <c>proveedor-invalido</c>.</summary>
    public void ElegirProveedor(string fuente, string? proveedor, DateTimeOffset ahora)
    {
        if (string.IsNullOrWhiteSpace(proveedor))
        {
            var tipo = CatalogoDeFuentes.Normalizar(fuente) ?? throw ReglaDeNegocioException.Validacion("fuente-oficial-invalida", "La fuente es Rues o Dian.");
            Proveedores.Remove(tipo.ToString());
        }
        else
        {
            var (tipo, nombre) = ConfiguracionDeFuentes.Resolver(fuente, proveedor, soloReales: false);
            Proveedores[tipo.ToString()] = nombre;
        }

        ActualizadaEn = ahora;
    }

    /// <summary>Crea, cambia o quita (<c>Clave</c> vacía) las credenciales propias de un proveedor real.</summary>
    public void CambiarCredenciales(CambioDeCredencialesDeFuente cambio, Func<string, string> proteger, DateTimeOffset ahora)
    {
        var (fuente, proveedor) = ConfiguracionDeFuentes.Resolver(cambio.Fuente, cambio.Proveedor, soloReales: true);
        var clave = ProveedoresDeFuentes.Clave(fuente, proveedor);
        if (cambio.Clave is { } quitar && quitar.Trim().Length == 0)
            Credenciales.Remove(clave);
        else
            Credenciales[clave] = CredencialesDeFuenteOficial.Combinar(Credenciales.GetValueOrDefault(clave), cambio, proteger, ahora);
        ActualizadaEn = ahora;
    }

    /// <summary>Cada cuántos días se reconsultan los vínculos activos: 0 o de 1 a <see cref="ConfiguracionDeFuentes.MaximoDiasDeMonitoreo"/>. 422 <c>monitoreo-invalido</c>.</summary>
    public void FijarMonitoreo(int dias, DateTimeOffset ahora)
    {
        if (dias is < 0 or > ConfiguracionDeFuentes.MaximoDiasDeMonitoreo)
            throw ReglaDeNegocioException.Validacion("monitoreo-invalido",
                $"La reconsulta periódica va de 1 a {ConfiguracionDeFuentes.MaximoDiasDeMonitoreo} días (0 la apaga).");
        DiasMonitoreo = dias;
        ActualizadaEn = ahora;
    }
}
