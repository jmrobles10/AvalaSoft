using Validasoft.Aplicacion.Verificaciones;
using Validasoft.Contratos;
using Validasoft.Dominio.FuentesOficiales;

namespace Validasoft.Aplicacion.FuentesOficiales;

/// <summary>Fuentes oficiales a DTO (FO-4). Solo para la empresa: el tercero no las ve.</summary>
public static class MapeosDeFuentesOficiales
{
    public static DatosOficialesDto ADto(this DatosOficiales d) =>
        new(d.Encontrado, d.Nit, d.Dv, d.RazonSocial, d.Estado, d.EstadoNormalizado.ToString(), d.Matricula, d.Camara, d.TipoOrganizacion, d.UltimoAnoRenovado, d.FechaMatricula,
            d.FechaRenovacion, d.FechaCancelacion, [.. d.Representantes.Select(r => new RepresentanteOficialDto(r.Nombre, r.Identificacion, r.Cargo))], d.Direccion, d.Municipio,
            d.ActividadPrincipal, [.. d.Responsabilidades], d.ActualizadoEnLaFuente);

    public static CampoCotejadoDto ADto(this CampoDeFuente c) =>
        new(c.Id, c.Campo, c.Etiqueta, c.Contra.ToString(), c.Referencia, c.Oficial, c.Comparado, c.Resultado.ToString(), c.Critico, c.Detalle, c.Resolucion?.Decision.ToString(),
            c.Resolucion?.Justificacion, c.Resolucion?.Por, c.Resolucion?.Fecha, c.Resolucion?.VigenteHasta, c.Heredada);

    public static FuenteOficialDto ADto(this ResultadoDeFuenteOficial r) => new(r.Datos.ADto(), [.. r.Campos.Select(c => c.ADto())]);

    public static MonitoreoFuentesOficialesDto ADto(this MonitoreoDeFuentesOficiales m) =>
        new(m.VinculoId, m.ExpedienteId, m.Folio, m.FrecuenciaDias, m.ProximaConsulta, [.. m.Fuentes.Select(f => f.ADto())]);
}
