using System.Security.Cryptography;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Documentos;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Documentos;
using Avalasoft.Dominio.Evaluaciones;

namespace Avalasoft.Aplicacion.Evaluaciones;

/// <summary>
/// Archivos de evidencia de una evaluación (CE-2, preguntas de tipo adjunto), en dos pasos como toda carga: URL prefirmada y confirmación, que lee el objeto, comprueba el
/// tipo real por sus bytes y lo guarda content-addressed en el bucket del tenant. Los usa la empresa (evaluador interno) y el tercero (autoevaluación); el archivo es privado
/// de la empresa: no entra a la bóveda del tercero ni se comparte con nadie.
/// </summary>
public static class AdjuntosDeEvaluacion
{
    /// <summary>Máximo de un archivo de evidencia (15 MB).</summary>
    public const long TamanoMaximo = 15L * 1024 * 1024;

    /// <summary>Formatos que admite: PDF o imagen.</summary>
    public static readonly IReadOnlyList<string> Formatos = InspectorDeArchivos.Permitidos;

    /// <summary>Paso 1: URL PUT del archivo. 422 <c>adjunto-invalido</c> (tamaño, formato o nombre).</summary>
    public static async Task<CargaDeAdjuntoDto> IniciarAsync(Guid tenantId, IniciarAdjuntoDeEvaluacionDto dto, IAlmacenDeArchivos almacen, ReglasDeCarga reglas,
        CancellationToken ct)
    {
        if (dto.TamanoBytes is <= 0 or > TamanoMaximo || !Formatos.Contains(dto.TipoMime ?? string.Empty) || string.IsNullOrWhiteSpace(dto.NombreArchivo))
            throw ReglaDeNegocioException.Validacion("adjunto-invalido", "El archivo debe ser un PDF o una imagen (JPEG, PNG o WebP) de hasta 15 MB.");

        var bucket = ClavesDeAlmacen.BucketDeTenant(tenantId);
        var cargaId = Guid.CreateVersion7();
        await almacen.AsegurarBucketAsync(bucket, ct);
        var url = await almacen.UrlDeSubidaAsync(bucket, ClavesDeAlmacen.Carga(cargaId), dto.TipoMime!, reglas.VigenciaSubida, ct);
        return new CargaDeAdjuntoDto(cargaId, new InstruccionCargaDto(url.Metodo, url.Url, url.Cabeceras, url.Expira));
    }

    /// <summary>
    /// Paso 2: lee el objeto, verifica tamaño y tipo real (422 <c>adjunto-invalido</c>) y lo deja en su clave definitiva. 409 <c>archivo-no-cargado</c> si aún no llegó. Devuelve el
    /// adjunto para que la evaluación lo registre.
    /// </summary>
    public static async Task<AdjuntoDeEvaluacion> ConfirmarAsync(Guid tenantId, Guid empresaId, Guid evaluacionId, Guid cargaId, string? nombreArchivo, ActorDeEvaluacion por,
        IAlmacenDeArchivos almacen, DateTimeOffset ahora, CancellationToken ct)
    {
        var bucket = ClavesDeAlmacen.BucketDeTenant(tenantId);
        var temporal = ClavesDeAlmacen.Carga(cargaId);
        var objeto = await almacen.ConsultarAsync(bucket, temporal, ct)
                     ?? throw ReglaDeNegocioException.Conflicto("archivo-no-cargado", "Aún no recibimos el archivo: súbelo con la URL de carga y vuelve a confirmar.");

        var limites = new ReglasDeArchivo("El archivo", Formatos, TamanoMaximo, int.MaxValue, false);
        var contenido = await CargaEndpoints.ConLimpiezaAsync(almacen, bucket, temporal, async () =>
        {
            limites.ValidarTamano(objeto.Tamano);
            return await CargaEndpoints.LeerAsync(almacen, bucket, temporal, limites, ct);
        }, ct);
        var mime = InspectorDeArchivos.DetectarMime(contenido);
        if (mime is null || !Formatos.Contains(mime))
        {
            await almacen.EliminarAsync(bucket, temporal, ct);
            throw ReglaDeNegocioException.Validacion("adjunto-invalido", "El archivo no es un PDF ni una imagen válida (el tipo declarado no basta).");
        }

        var sha = Convert.ToHexStringLower(SHA256.HashData(contenido));
        var clave = ClavesDeAlmacen.AdjuntoDeEvaluacion(empresaId, evaluacionId, sha);
        var nombre = Limpiar(nombreArchivo);
        await almacen.CopiarAsync(bucket, temporal, bucket, clave, mime, new Dictionary<string, string>
        {
            ["nombre-original"] = Uri.EscapeDataString(nombre),
            ["evaluacion"] = evaluacionId.ToString(),
            ["mime"] = mime
        }, ct);
        await almacen.EliminarAsync(bucket, temporal, ct);
        return new AdjuntoDeEvaluacion(Guid.CreateVersion7(), nombre, mime, contenido.LongLength, sha, bucket, clave, por, ahora);
    }

    private static string Limpiar(string? nombre)
    {
        var limpio = Path.GetFileName((nombre ?? string.Empty).Replace('\\', '/')).Trim();
        return limpio.Length == 0 ? "archivo" : limpio.Length > 150 ? limpio[..150] : limpio;
    }
}
