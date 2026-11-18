using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Hosting;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Comun;
using Wolverine.Http;

namespace Avalasoft.Aplicacion.Verificaciones;

/// <summary>Ejecución inmediata del procesamiento de verificaciones (Plataforma), con fecha simulada solo en Development.</summary>
public static class ProcesamientoInmediatoDeVerificacionesEndpoints
{
    /// <summary>
    /// Corre ya lo que el procesador periódico haría (consultas automáticas de listas, expiración de lo vencido con el expediente abierto y
    /// monitoreo de los vínculos activos) y espera su resultado: de un tenant o de todos. <c>fecha</c> simula «ahora» y solo se admite en
    /// Development (pruebas de punta a punta: así se prueba un estudio vencido o la reconsulta periódica sin esperar 30 días; 422
    /// <c>fecha-simulada-no-permitida</c> en otro entorno).
    /// </summary>
    [WolverinePost("/api/v1/plataforma/verificaciones/revisar")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<ResultadoRevisionVerificacionesDto> Revisar(RevisarVerificacionesDto dto, TareasDeVerificaciones tareas,
        FuentesOficiales.TareasDeFuentesOficiales fuentes, IHostEnvironment entorno, CancellationToken ct)
    {
        if (dto.Fecha is not null && !entorno.IsDevelopment())
            throw ReglaDeNegocioException.Validacion("fecha-simulada-no-permitida", "La fecha simulada solo se admite en Development.");

        var procesador = dto.Fecha is { } fecha ? tareas.ConReloj(new RelojFijo(fecha)) : tareas;
        var resultado = await procesador.ProcesarPendientesAsync(ct, dto.TenantId);
        // También las fuentes oficiales (RUES, DIAN): sus consultas pendientes y la reconsulta periódica de los vínculos activos.
        var oficiales = await (dto.Fecha is { } simulada ? fuentes.ConReloj(new RelojFijo(simulada)) : fuentes).ProcesarPendientesAsync(ct, dto.TenantId);
        return new ResultadoRevisionVerificacionesDto(resultado.Consultas, resultado.Expiraciones, resultado.Monitoreos, oficiales.Consultas, oficiales.Monitoreos);
    }

    private sealed class RelojFijo(DateTimeOffset ahora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => ahora;
    }
}
