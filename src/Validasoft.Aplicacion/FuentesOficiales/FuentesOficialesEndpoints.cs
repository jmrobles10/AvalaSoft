using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validasoft.Aplicacion.Comun;
using Validasoft.Aplicacion.Documentos;
using Validasoft.Aplicacion.Expedientes;
using Validasoft.Aplicacion.Identidad;
using Validasoft.Aplicacion.Verificaciones;
using Validasoft.Contratos;
using Validasoft.Dominio.Auditoria;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.FuentesOficiales;
using Wolverine;
using Wolverine.Http;

namespace Validasoft.Aplicacion.FuentesOficiales;

/// <summary>
/// Fuentes oficiales del expediente y del vínculo (FO-1…FO-7, docs/05 §2.7), todo con <c>X-Empresa</c>: consultar o reconsultar el RUES o la DIAN
/// (<c>verificaciones:escribir</c>; el mismo <c>POST /expedientes/{id}/verificaciones/{tipo}/consultar</c> de las listas), aceptar o confirmar una diferencia
/// con justificación (<c>cumplimiento:decidir</c>, siempre una persona), y el monitoreo opcional de los vínculos activos. La evidencia se descarga con el
/// mismo <c>…/evidencia/descarga</c> de las listas. Cada decisión pasa por la cascada del expediente: si era lo último que faltaba, el expediente se aprueba
/// en la misma transacción.
/// </summary>
public static class FuentesOficialesEndpoints
{
    /// <summary>
    /// Consulta (o reconsulta) ahora la fuente por el tercero del expediente y registra el resultado; lo llama <c>VerificacionesEndpoints.Consultar</c> cuando
    /// el tipo es <c>Rues</c> o <c>Dian</c>. 409 <c>estado-invalido</c> con el expediente cerrado; 503 <c>verificacion-no-disponible</c> (nada se registra como
    /// satisfecho: la verificación sigue pendiente).
    /// </summary>
    internal static async Task<ExpedienteDto> ConsultarAsync(Guid id, TipoVerificacion tipo, SesionDeEmpresa empresa, IContextoSolicitud contexto, HttpContext http,
        ConsultaDeFuentesOficiales consulta, IMessageBus mensajes, IProtectorDeSecretos protector, TimeProvider reloj, CancellationToken ct)
    {
        empresa.UsarMensajeria(mensajes);
        var expediente = await empresa.CargarExpedienteAsync(id, ct);
        if (!expediente.EstaAbierto)
            throw ReglaDeNegocioException.Conflicto("estado-invalido", $"El expediente está {expediente.Estado}: ya no recibe verificaciones.");
        await ExpedientesEndpoints.AsegurarVinculoNoBloqueadoAsync(empresa, expediente, ct);

        var dias = expediente.BuscarVerificacion(tipo)?.VigenciaDias ?? consulta.Opciones.VigenciaDias;
        var resultado = await consulta.ConsultarAsync(empresa.Sesion, contexto.TenantRequerido(), empresa.EmpresaId, expediente.TerceroId, tipo, expediente.Folio,
            await VerificacionesEndpoints.QuienAsync(empresa, contexto, ct), dias, ct);
        return await empresa.ReintentarAnteCarreraAsync(async () =>
        {
            var stream = await empresa.ExpedienteParaEscribirAsync(id, null, ct);
            var eventos = stream.Aggregate!.RegistrarConsultaOficial(tipo, resultado, contexto.ActorId, reloj.GetUtcNow());
            return await VerificacionesEndpoints.GuardarAsync(empresa, stream, eventos, mensajes, protector, http, reloj, ct);
        });
    }

    /// <summary>
    /// Un revisor acepta (<c>Descartada</c>) o confirma (<c>Confirmada</c>) una diferencia con la fuente, siempre con justificación. Confirmada ⇒ la
    /// verificación queda <c>Fallida</c> y el expediente no cierra (nunca automático). 404 <c>diferencia-no-encontrada</c>; 409 <c>diferencia-ya-resuelta</c>;
    /// 403 <c>conflicto-de-intereses</c>; 422 <c>justificacion-requerida</c>, <c>decision-invalida</c>, <c>tipo-no-consultable</c>.
    /// </summary>
    [WolverinePost("/api/v1/expedientes/{id}/verificaciones/{tipo}/diferencias/{campoId}/resolver")]
    [Authorize(Policy = Permisos.CumplimientoDecidir)]
    public static async Task<ExpedienteDto> ResolverDiferencia(Guid id, string tipo, Guid campoId, ResolverCoincidenciaDto dto, SesionDeEmpresa empresa,
        IContextoSolicitud contexto, HttpContext http, IMessageBus mensajes, IProtectorDeSecretos protector, TimeProvider reloj, CancellationToken ct)
    {
        var fuente = LeerFuente(tipo);
        var decision = LeerDecision(dto.Decision);
        empresa.UsarMensajeria(mensajes);
        return await empresa.ReintentarAnteCarreraAsync(async () =>
        {
            var stream = await empresa.ExpedienteParaEscribirAsync(id, Peticiones.VersionEsperada(http), ct);
            var oficial = await VerificacionesEndpoints.OficialAsync(empresa, contexto, ct);
            var eventos = stream.Aggregate!.ResolverDiferenciaOficial(fuente, campoId, decision, dto.Justificacion, oficial, reloj.GetUtcNow());
            return await VerificacionesEndpoints.GuardarAsync(empresa, stream, eventos, mensajes, protector, http, reloj, ct);
        });
    }

    // ---------- Configuración de la empresa ----------

    public const string Entidad = "FuentesOficialesEmpresa";

    /// <summary>Fuentes oficiales de la empresa: proveedor elegido y efectivo por fuente, qué proveedores hay y están disponibles, y la reconsulta periódica.</summary>
    [WolverineGet("/api/v1/configuracion/fuentes-oficiales")]
    [Authorize(Policy = Permisos.ConfiguracionLeer)]
    public static async Task<FuentesOficialesConfigDto> Obtener(SesionDeEmpresa empresa, ConsultaDeFuentesOficiales consulta, CancellationToken ct)
    {
        var configuracion = await empresa.Sesion.LoadAsync<FuentesOficialesEmpresa>(empresa.EmpresaId, ct);
        return Dto(configuracion, await consulta.PlataformaAsync(ct), consulta);
    }

    /// <summary>
    /// Elige el proveedor de una o más fuentes (<c>proveedor: ""</c> = el predeterminado), cambia las credenciales propias de uno real y/o fija cada cuántos
    /// días se reconsultan los vínculos activos (0 la apaga). Las credenciales se cifran con la clave del grupo y la clave es de solo escritura. 422
    /// <c>fuente-oficial-invalida</c>, <c>proveedor-invalido</c>, <c>proveedor-no-habilitado</c> (la instalación no lo habilitó), <c>usuario-de-fuente-invalido</c>,
    /// <c>clave-invalida</c>, <c>url-invalida</c>, <c>notas-invalidas</c>, <c>credenciales-vacias</c>, <c>monitoreo-invalido</c>. Queda en la auditoría, sin la clave.
    /// </summary>
    [WolverinePut("/api/v1/configuracion/fuentes-oficiales")]
    [Authorize(Policy = Permisos.ConfiguracionEscribir)]
    public static async Task<FuentesOficialesConfigDto> Actualizar(ActualizarFuentesOficialesDto dto, SesionDeEmpresa empresa, IContextoSolicitud contexto,
        ConsultaDeFuentesOficiales consulta, IProtectorDeSecretos protector, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var grupoId = contexto.TenantRequerido(); // la clave de las credenciales es del grupo, como las de las listas (CU-20)
        var plataforma = await consulta.PlataformaAsync(ct);
        var existente = await empresa.Sesion.LoadAsync<FuentesOficialesEmpresa>(empresa.EmpresaId, ct);
        var antes = existente is null ? null : Dto(existente, plataforma, consulta);
        var configuracion = existente ?? FuentesOficialesEmpresa.Nueva(empresa.EmpresaId);

        if (dto.Credenciales is { } c)
            configuracion.CambiarCredenciales(new CambioDeCredencialesDeFuente(c.Fuente, c.Proveedor, c.Usuario, c.Clave, c.UrlBase, c.Notas),
                clave => protector.ProtegerDeGrupo(grupoId, clave), ahora);
        foreach (var eleccion in dto.Elecciones ?? [])
        {
            if (!string.IsNullOrWhiteSpace(eleccion.Proveedor))
            {
                var (fuente, proveedor) = ConfiguracionDeFuentes.Resolver(eleccion.Fuente, eleccion.Proveedor, soloReales: false);
                if (!consulta.Opciones.Proveedor(fuente, proveedor).Habilitado)
                    throw ReglaDeNegocioException.Validacion("proveedor-no-habilitado", $"{CatalogoDeFuentes.Nombre(fuente)} · {proveedor} no está habilitado en esta instalación.");
            }

            configuracion.ElegirProveedor(eleccion.Fuente, eleccion.Proveedor, ahora);
        }

        if (dto.DiasMonitoreo is { } dias)
            configuracion.FijarMonitoreo(dias, ahora);

        empresa.Sesion.Store(configuracion);
        var despues = Dto(configuracion, plataforma, consulta);
        Auditoria.Registrar(empresa.Sesion, contexto, Entidad, empresa.EmpresaId.ToString(), existente is null ? AccionConfiguracion.Creado : AccionConfiguracion.Modificado,
            antes, despues, ahora, empresa.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        return despues;
    }

    private static FuentesOficialesConfigDto Dto(FuentesOficialesEmpresa? empresa, FuentesOficialesDePlataforma? plataforma, ConsultaDeFuentesOficiales consulta)
    {
        var opciones = consulta.Opciones;
        var fuentes = CatalogoDeFuentes.Todas.Select(fuente => new FuenteOficialConfigDto(fuente.ToString(), CatalogoDeFuentes.Nombre(fuente), CatalogoDeFuentes.Descripcion(fuente),
            empresa?.ProveedorDe(fuente), consulta.Efectivo(fuente, empresa, plataforma),
            [
                .. ProveedoresDeFuentes.Para(fuente).Where(n => n != ProveedoresDeFuentes.Simulado || opciones.PermitirSimulado).Select(nombre =>
                {
                    var habilitado = opciones.Proveedor(fuente, nombre).Habilitado;
                    var propias = empresa?.CredencialesDe(fuente, nombre);
                    var deLaPlataforma = plataforma?.CredencialesDe(fuente, nombre);
                    var disponible = habilitado && (nombre != ProveedoresDeFuentes.Contrato || (propias ?? deLaPlataforma)?.TieneClave == true);
                    return new ProveedorDeFuenteDto(nombre, nombre != ProveedoresDeFuentes.Simulado, habilitado, propias is not null, propias is null && deLaPlataforma is not null,
                        propias?.Usuario, propias?.UltimosCuatroClave, propias?.UrlBase, propias?.Notas, disponible);
                })
            ])).ToList();
        return new FuentesOficialesConfigDto(fuentes, empresa?.DiasMonitoreo ?? 0, opciones.VigenciaDias);
    }

    // ---------- Monitoreo de vínculos activos ----------

    /// <summary>Monitoreo de las fuentes oficiales del vínculo (FO-7): la última reconsulta de cada fuente y la próxima. 404 <c>monitoreo-no-encontrado</c>.</summary>
    [WolverineGet("/api/v1/vinculos/{id}/monitoreo-fuentes-oficiales")]
    [Authorize(Policy = Permisos.ExpedientesLeer)]
    public static async Task<MonitoreoFuentesOficialesDto> Monitoreo(Guid id, SesionDeEmpresa empresa, CancellationToken ct) =>
        (await CargarMonitoreoAsync(empresa, id, ct)).ADto();

    /// <summary>
    /// Resuelve una diferencia del monitoreo con las mismas reglas que en el expediente; queda en la auditoría (<c>MonitoreoDeFuentesOficiales</c>). Confirmada:
    /// el administrador decide bloquear o desvincular (nunca automático).
    /// </summary>
    [WolverinePost("/api/v1/vinculos/{id}/monitoreo-fuentes-oficiales/{tipo}/diferencias/{campoId}/resolver")]
    [Authorize(Policy = Permisos.CumplimientoDecidir)]
    public static async Task<MonitoreoFuentesOficialesDto> ResolverDiferenciaDeMonitoreo(Guid id, string tipo, Guid campoId, ResolverCoincidenciaDto dto, SesionDeEmpresa empresa,
        IContextoSolicitud contexto, TimeProvider reloj, CancellationToken ct)
    {
        var fuente = LeerFuente(tipo);
        var decision = LeerDecision(dto.Decision);
        var monitoreo = await CargarMonitoreoAsync(empresa, id, ct);
        var oficial = await VerificacionesEndpoints.OficialAsync(empresa, contexto, ct);
        var ahora = reloj.GetUtcNow();
        var campo = monitoreo.ResolverDiferencia(fuente, campoId, decision, dto.Justificacion, oficial, ahora);
        empresa.Sesion.Store(monitoreo);
        Auditoria.Registrar(empresa.Sesion, contexto, "MonitoreoDeFuentesOficiales", $"{id}/{tipo}/{campoId}", AccionConfiguracion.Modificado, null,
            new { Fuente = fuente.ToString(), campo.Campo, campo.Etiqueta, Decision = decision.ToString(), dto.Justificacion }, ahora, empresa.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        return monitoreo.ADto();
    }

    /// <summary>URL prefirmada de la constancia de la última reconsulta de una fuente del monitoreo (la entrega queda en la auditoría).</summary>
    [WolverinePost("/api/v1/vinculos/{id}/monitoreo-fuentes-oficiales/{tipo}/evidencia/descarga")]
    [Authorize(Policy = Permisos.DocumentosDescargar)]
    public static async Task<DescargaEvidenciaDto> DescargarEvidenciaDeMonitoreo(Guid id, string tipo, SesionDeEmpresa empresa, IContextoSolicitud contexto,
        IAlmacenDeArchivos almacen, ReglasDeCarga reglas, TimeProvider reloj, CancellationToken ct)
    {
        var fuente = LeerFuente(tipo);
        var monitoreo = await CargarMonitoreoAsync(empresa, id, ct);
        var verificacion = monitoreo.De(fuente);
        var evidencia = verificacion?.Evidencia ?? throw ReglaDeNegocioException.NoEncontrado("evidencia-no-encontrada", "El monitoreo no tiene evidencia guardada.");
        Auditoria.Registrar(empresa.Sesion, contexto, "EvidenciaDeFuenteOficial", $"{id}/{fuente}/{verificacion!.ReferenciaExterna}", AccionConfiguracion.Modificado, null,
            new { Descargada = evidencia.NombreArchivo }, reloj.GetUtcNow(), empresa.EmpresaId);
        await empresa.Sesion.SaveChangesAsync(ct);
        return await VerificacionesEndpoints.UrlAsync(almacen, reglas, evidencia, ct);
    }

    private static async Task<MonitoreoDeFuentesOficiales> CargarMonitoreoAsync(SesionDeEmpresa empresa, Guid vinculoId, CancellationToken ct)
    {
        await empresa.CargarVinculoAsync(vinculoId, ct);
        var monitoreo = await empresa.Sesion.LoadAsync<MonitoreoDeFuentesOficiales>(vinculoId, ct);
        return monitoreo is not null && monitoreo.EmpresaId == empresa.EmpresaId
            ? monitoreo
            : throw ReglaDeNegocioException.NoEncontrado("monitoreo-no-encontrado", "El vínculo no tiene monitoreo de fuentes oficiales.");
    }

    internal static TipoVerificacion LeerFuente(string tipo) =>
        CatalogoDeFuentes.Normalizar(tipo) ?? throw ReglaDeNegocioException.Validacion("tipo-no-consultable", "Solo el RUES (Rues) y la DIAN (Dian) son fuentes oficiales.");

    private static DecisionCoincidencia LeerDecision(string? decision) =>
        Enum.TryParse<DecisionCoincidencia>(decision, true, out var valor) && Enum.IsDefined(valor)
            ? valor
            : throw ReglaDeNegocioException.Validacion("decision-invalida", "La decisión es Descartada o Confirmada.");
}

/// <summary>
/// Cuenta de la plataforma con los proveedores de las fuentes oficiales (FO-5): el token de datos.gov.co, la API contratada con Confecámaras o con quien
/// consulte el RUT de la DIAN, y el proveedor predeterminado de cada fuente. La configura Plataforma desde su consola; la clave es de solo escritura (vuelve
/// «configurada · …1234») y se cifra con la clave maestra, como las demás credenciales de la plataforma. Las empresas consultan con ella sin verla; una
/// empresa puede traer las suyas. Todo cambio queda en la auditoría, sin la clave.
/// </summary>
public static class FuentesOficialesDePlataformaEndpoints
{
    public const string Entidad = "FuentesOficialesDePlataforma";

    [WolverineGet("/api/v1/plataforma/fuentes-oficiales")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<FuentesDePlataformaDto> Obtener(ConsultaDeFuentesOficiales consulta, CancellationToken ct) =>
        Dto(await consulta.PlataformaAsync(ct), consulta);

    /// <summary>
    /// Crea, cambia o quita (<c>clave: ""</c>) las credenciales de un proveedor real de una fuente y/o fija el proveedor predeterminado (<c>proveedor</c> vacío
    /// = ninguno: manda el de la instalación). Exige confirmar con la passkey (la clave es de todos los clientes). 422 <c>fuente-oficial-invalida</c>,
    /// <c>proveedor-invalido</c>, <c>usuario-de-fuente-invalido</c>, <c>clave-invalida</c>, <c>url-invalida</c>, <c>notas-invalidas</c>, <c>credenciales-vacias</c>.
    /// </summary>
    [WolverinePut("/api/v1/plataforma/fuentes-oficiales")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<FuentesDePlataformaDto> Actualizar(ActualizarFuentesDePlataformaDto dto, HttpContext http, ISesiones sesiones, IContextoSolicitud contexto,
        ConsultaDeFuentesOficiales consulta, IProtectorDeSecretos protector, ServicioDeIngreso servicio, TimeProvider reloj, CancellationToken ct)
    {
        await servicio.ExigirReautenticacionAsync(http.User, "configurar-fuentes-oficiales", ct);
        var ahora = reloj.GetUtcNow();
        await using var sesion = sesiones.Global();
        var existente = await sesion.LoadAsync<FuentesOficialesDePlataforma>(FuentesOficialesDePlataforma.IdUnico, ct);
        var antes = existente is null ? null : Dto(existente, consulta);
        var cuenta = existente ?? new FuentesOficialesDePlataforma();

        if (dto.Credenciales is { } c)
            cuenta.CambiarCredenciales(new CambioDeCredencialesDeFuente(c.Fuente, c.Proveedor, c.Usuario, c.Clave, c.UrlBase, c.Notas), protector.Proteger, contexto.ActorId, ahora);
        foreach (var eleccion in dto.Predeterminados ?? [])
            cuenta.ElegirPredeterminado(eleccion.Fuente, eleccion.Proveedor, contexto.ActorId, ahora);

        sesion.Store(cuenta);
        var despues = Dto(cuenta, consulta);
        Auditoria.Registrar(sesion, contexto, Entidad, FuentesOficialesDePlataforma.IdUnico, existente is null ? AccionConfiguracion.Creado : AccionConfiguracion.Modificado, antes,
            despues, ahora);
        await sesion.SaveChangesAsync(ct);
        return despues;
    }

    private static FuentesDePlataformaDto Dto(FuentesOficialesDePlataforma? cuenta, ConsultaDeFuentesOficiales consulta)
    {
        var opciones = consulta.Opciones;
        var fuentes = CatalogoDeFuentes.Todas.Select(fuente => new FuentePlataformaDto(fuente.ToString(), CatalogoDeFuentes.Nombre(fuente), CatalogoDeFuentes.Descripcion(fuente),
            cuenta?.PredeterminadoDe(fuente),
            [
                .. ProveedoresDeFuentes.RealesPara(fuente).Select(nombre =>
                {
                    var credenciales = cuenta?.CredencialesDe(fuente, nombre);
                    return new ProveedorDePlataformaFuenteDto(nombre, opciones.Proveedor(fuente, nombre).Habilitado, credenciales is not null, credenciales?.Usuario,
                        credenciales?.UltimosCuatroClave, credenciales?.UrlBase, credenciales?.Notas, credenciales?.ActualizadasEn);
                })
            ])).ToList();
        return new FuentesDePlataformaDto(fuentes, cuenta?.ActualizadaEn, cuenta?.ActualizadaPor);
    }
}
