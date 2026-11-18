using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Avalasoft.Aplicacion.FuentesOficiales;
using Avalasoft.Dominio.Documentos;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.FuentesOficiales;

namespace Avalasoft.Infraestructura.FuentesOficiales;

/// <summary>
/// Fuente simulada y determinista (FO-2), para el sandbox y las pruebas (<c>PermitirSimulado</c>): devuelve al tercero conforme a lo que declaró (razón
/// social, NIT, matrícula activa y renovada, RUT activo) y cambia según palabras del nombre (sin tildes ni mayúsculas): «caida» (la fuente no responde,
/// para probar el fallo), «noregistrado» (no figura), «cancelad» o «suspendid» (estado no vigente), «sinrenovar» (matrícula sin renovar, RUES),
/// «otranombre» (otra razón social), «otrorepresentante» (otro representante, RUES) y «otradireccion» (otra dirección, DIAN). No llama a nadie.
/// </summary>
public sealed class FuenteOficialSimulada(TipoVerificacion fuente, TimeProvider reloj) : IFuenteOficial
{
    public const string Caida = "caida";
    public const string NoRegistrado = "noregistrad";
    public const string NoVigente = "cancelad";
    public const string Suspendido = "suspendid";
    public const string SinRenovar = "sinrenovar";
    public const string OtroNombre = "otranombre";
    public const string OtroRepresentante = "otrorepresentante";
    public const string OtraDireccion = "otradireccion";

    public TipoVerificacion Fuente => fuente;

    public string Proveedor => ProveedoresDeFuentes.Simulado;

    public Task<RespuestaOficial> ConsultarAsync(SolicitudOficial solicitud, CancellationToken ct)
    {
        var nombre = SinTildes(solicitud.NombreDeclarado).Replace(" ", string.Empty, StringComparison.Ordinal).ToLowerInvariant();
        var referencia = $"sim-{CatalogoDeFuentes.Nombre(fuente).ToLowerInvariant()}-{Guid.CreateVersion7():N}";
        var criterio = $"Simulado (desarrollo y pruebas): {CatalogoDeFuentes.Nombre(fuente)} devuelve lo declarado, salvo palabras de prueba en el nombre.";
        if (nombre.Contains(Caida, StringComparison.Ordinal))
            throw new FuenteOficialNoDisponibleException($"{CatalogoDeFuentes.Nombre(fuente)} simulada: la fuente no responde (nombre de prueba «caida»).");
        if (nombre.Contains(NoRegistrado, StringComparison.Ordinal))
            return Task.FromResult(new RespuestaOficial(referencia, DatosOficiales.NoEncontrado, criterio, """{"simulado":true,"encontrado":false}"""));

        var rues = fuente == TipoVerificacion.Rues;
        var noVigente = nombre.Contains(NoVigente, StringComparison.Ordinal) || (!rues && nombre.Contains(Suspendido, StringComparison.Ordinal));
        var estado = rues ? (noVigente ? "CANCELADA" : "ACTIVA") : noVigente ? (nombre.Contains(Suspendido, StringComparison.Ordinal) ? "SUSPENDIDO" : "CANCELADO") : "REGISTRO ACTIVO";
        var hoy = CalculadoraDeVigencia.Fecha(reloj.GetUtcNow());
        var esperado = ReglasDeFuente.AnoDeRenovacionEsperado(hoy);
        var ultimoAno = nombre.Contains(SinRenovar, StringComparison.Ordinal) ? esperado - 2 : esperado;
        var datos = new DatosOficiales
        {
            Encontrado = true,
            Nit = solicitud.Numero,
            Dv = solicitud.Dv,
            RazonSocial = nombre.Contains(OtroNombre, StringComparison.Ordinal) ? "EMPRESA DISTINTA S.A.S." : solicitud.NombreDeclarado.ToUpperInvariant(),
            Estado = estado,
            EstadoNormalizado = EstadosOficiales.Normalizar(estado),
            Matricula = rues ? $"SIM-{solicitud.Numero}" : null,
            Camara = rues ? "SIMULADA" : null,
            UltimoAnoRenovado = rues ? ultimoAno : null,
            FechaRenovacion = rues ? new DateOnly(ultimoAno, 3, 30) : null,
            Representantes = rues && nombre.Contains(OtroRepresentante, StringComparison.Ordinal) ? [new RepresentanteOficial("Persona Distinta", "9999999999", "Representante legal")] : [],
            Direccion = !rues && nombre.Contains(OtraDireccion, StringComparison.Ordinal) ? "CL 1 2 3 OTRA" : null
        };
        var cruda = new JsonObject { ["simulado"] = true, ["fuente"] = fuente.ToString(), ["datos"] = JsonSerializer.SerializeToNode(datos) }.ToJsonString();
        return Task.FromResult(new RespuestaOficial(referencia, datos, criterio, cruda));
    }

    private static string SinTildes(string texto) =>
        new([.. texto.Normalize(NormalizationForm.FormD).Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)]);
}
