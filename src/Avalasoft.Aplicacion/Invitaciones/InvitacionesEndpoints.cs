using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Vinculos;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Auditoria;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Configuracion;
using Avalasoft.Dominio.Invitaciones;
using Avalasoft.Dominio.Vinculos;
using Wolverine;
using Wolverine.Http;

namespace Avalasoft.Aplicacion.Invitaciones;

/// <summary>
/// Invitar a un tercero a mano desde la app (decisión IM): el formulario de «Invitar tercero» hace <b>exactamente lo que hace una fila del lote</b>, sin esperar a un archivo.
/// Comparte las dos mitades del lote: la validación por fila (<see cref="ValidacionDeLote"/>: la misma identificación multipaís, el mismo tipo de vínculo activo, el mismo flujo, el
/// mismo correo) y el procesamiento (<c>ProcesarTandaDeLoteHandler.InvitarAsync</c>: crea o reutiliza el tercero, crea el vínculo e invita, o reenvía la invitación del vínculo que
/// aún no acepta), sin duplicar ni una regla.
/// </summary>
public static class InvitacionesEndpoints
{
    /// <summary>
    /// Invita a un tercero (<c>vinculos:escribir</c>, con <c>Idempotency-Key</c>): 201 con <c>Accion = Invitado</c> si el vínculo es nuevo; 200 con <c>Reinvitado</c> (el vínculo ya existía y
    /// aún no aceptaba: se reenvió al correo indicado) o <c>SinCambios</c> (el tercero ya aceptó: no se reenvía). Con un tipo de vínculo que exige aprobación antes de invitar (decisión
    /// AI) la invitación queda retenida (<c>PorAprobar = true</c>) hasta que otra persona la apruebe: no sale ningún correo. Si el tercero no existía en la plataforma se registra con
    /// estos datos; si ya existe no se tocan sus datos maestros (P-1-7). <c>Atributos</c> (opcional) son los valores de los atributos del tipo de vínculo: los valida el tipo (campo
    /// <c>atributos.{clave}</c>: <c>atributo-no-permitido</c>, <c>atributo-invalido</c>, <c>atributo-requerido</c> al crear el vínculo) y, si el vínculo ya existía y se reinvita, solo se
    /// aplican los que vienen. 422 con el primer error en <c>codigo</c> y todos por campo en <c>errores</c> (<c>campo</c>, <c>codigo</c>,
    /// <c>mensaje</c>: los mismos de la vista previa de un lote), 422 <c>sin-aprobadores-de-invitacion</c> y <c>vigencia-invalida</c>; 409 <c>vinculo-no-invitable</c> (bloqueado o
    /// terminado) e <c>invitacion-por-aprobar</c> (ya espera a quien apruebe) con el <c>vinculoId</c> existente.
    /// </summary>
    [WolverinePost("/api/v1/invitaciones")]
    [Authorize(Policy = Permisos.VinculosEscribir)]
    public static async Task<IResult> Invitar(InvitarTerceroDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto, IMessageBus mensajes,
        IProtectorDeSecretos protector, Avalasoft.Aplicacion.Plataforma.ControlDePlan plan, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        empresa.UsarMensajeria(mensajes);
        var fila = new FilaDeLoteEntradaDto(dto.Pais, dto.TipoIdentificacion, dto.NumeroIdentificacion, dto.DigitoVerificacion, dto.TipoPersona, dto.Nombre,
            dto.NombreComercial, dto.Correo, dto.TipoVinculo, dto.Flujo, dto.Contacto, dto.Telefono, dto.Atributos).ADominio();

        var validada = (await ValidacionDeLote.ValidarAsync(empresa, [fila], ahora, ct))[0];
        if (validada.Errores.Count > 0)
            throw ErrorDeFila(validada);

        var catalogo = await CatalogoDeLote.CargarAsync(empresa.Sesion, empresa.EmpresaId, ct);
        var retencion = new RetencionDeInvitacion(AprobadoresDeInvitaciones.Solicitante(contexto),
            tipos => AprobadoresDeInvitaciones.ExigirAprobadoresAsync(empresa, tipos, contexto, ct),
            (vinculoId, accion, retenida, fecha) => AprobadoresDeInvitaciones.Auditar(empresa, contexto, "InvitacionDeVinculo", vinculoId, accion, null,
                new { Estado = nameof(EstadoAprobacionDeInvitacion.Pendiente), retenida.SolicitadaPor, Correo = retenida.CorreoDestino }, fecha));
        var resultado = await ProcesarTandaDeLoteHandler.InvitarAsync(empresa.Sesion, mensajes, protector, contexto.TenantRequerido(), empresa.TenantSandbox,
            new ParametrosDeInvitacion(empresa.EmpresaId, null, TimeSpan.FromHours(dto.VigenciaHoras), retencion), fila, catalogo, ahora, ct, plan);
        await empresa.Sesion.SaveChangesAsync(ct);

        var respuesta = new InvitacionDeTerceroDto(resultado.Accion.ToString(), resultado.TerceroId, resultado.VinculoId, resultado.TerceroCreado, resultado.PorAprobar,
            resultado.Detalle);
        return resultado.Accion == AccionFilaLote.Invitado
            ? Results.Created($"/api/v1/vinculos/{resultado.VinculoId}", respuesta)
            : Results.Ok(respuesta);
    }

    /// <summary>
    /// El rechazo de una fila inválida: el primer error como <c>codigo</c> y <c>detail</c>, y todos como <c>errores</c> (los que el cliente muestra por campo). Si el vínculo ya existe y no se
    /// puede invitar es un conflicto (409) que lleva su <c>vinculoId</c>: la pantalla ofrece abrirlo.
    /// </summary>
    private static ReglaDeNegocioException ErrorDeFila(FilaValidada fila)
    {
        var primero = fila.Errores[0];
        var datos = new Dictionary<string, object?>
        {
            ["campo"] = primero.Campo,
            ["errores"] = fila.Errores.Select(e => new Dictionary<string, string?> { ["campo"] = e.Campo, ["codigo"] = e.Codigo, ["mensaje"] = e.Mensaje }).ToList()
        };
        if (fila.VinculoId is { } vinculoId && primero.Codigo is "vinculo-no-invitable" or "invitacion-por-aprobar")
        {
            datos["vinculoId"] = vinculoId;
            return new ReglaDeNegocioException(TipoFalla.Conflicto, primero.Codigo, primero.Mensaje) { Datos = datos };
        }

        return new ReglaDeNegocioException(TipoFalla.Validacion, primero.Codigo, primero.Mensaje) { Datos = datos };
    }
}
