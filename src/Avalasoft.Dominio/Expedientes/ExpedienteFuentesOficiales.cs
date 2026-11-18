using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.FuentesOficiales;

namespace Avalasoft.Dominio.Expedientes;

/// <summary>
/// Fuentes oficiales del expediente (FO-1…FO-6): el RUES y la DIAN corroboran al tercero. Entran por el mismo camino que las listas: el flujo las
/// pide por tipo de vínculo (bloqueantes o solo informativas), se consultan solas al pasar a revisión, el resultado vence y se reconsulta, y un fallo
/// del proveedor deja la verificación pendiente (nunca satisfecha en silencio): una bloqueante no deja cerrar el expediente. Lo que no coincide queda
/// como diferencia para el revisor, que la acepta (descarta) o la confirma, siempre con justificación.
/// </summary>
public sealed partial class Expediente
{
    /// <summary>Cuándo debe correr la consulta automática de una fuente oficial (nulo = ninguna pendiente). Lo lee el procesador.</summary>
    public DateTimeOffset? ProximaConsultaOficial { get; set; }

    /// <summary>
    /// Registra el resultado de consultar una fuente oficial (automática o «Reconsultar»). Idempotente: una referencia externa ya registrada no
    /// produce eventos. Las diferencias ya aceptadas con decisión vigente se heredan; si queda alguna sin decidir, la verificación pasa a
    /// <c>CoincidenciaPorAnalizar</c>. Si el flujo no la pedía, queda como verificación no bloqueante. 409 <c>estado-invalido</c> con el
    /// expediente cerrado; 422 <c>tipo-no-consultable</c> si no es una fuente oficial.
    /// </summary>
    public IReadOnlyList<object> RegistrarConsultaOficial(TipoVerificacion tipo, ConsultaOficialRealizada consulta, string por, DateTimeOffset ahora)
    {
        AsegurarFuente(tipo);
        AsegurarAbiertoParaVerificar();
        var actual = BuscarVerificacion(tipo);
        if (actual is not null && (actual.ReferenciaExterna == consulta.ReferenciaExterna || actual.Anteriores.Any(a => a.ReferenciaExterna == consulta.ReferenciaExterna)))
            return [];

        var campos = ReglasDeFuente.Heredar(consulta.Campos, actual?.FuenteOficial?.Campos ?? [], ahora);
        return Simular(s => s.Emitir(new FuenteOficialConsultada(tipo, consulta.Proveedor, consulta.ReferenciaExterna, consulta.Datos, campos, consulta.Evidencia,
            consulta.VigenteHasta, por, ahora)), ahora);
    }

    /// <summary>
    /// Un revisor acepta (descarta) o confirma una diferencia con la fuente, siempre con justificación. Aceptadas todas ⇒ <c>Satisfecha</c>; una
    /// confirmada ⇒ <c>Fallida</c> (el expediente no cierra; un área lo rechaza o Cumplimiento lo rechaza, nunca automático). 404
    /// <c>diferencia-no-encontrada</c>; 409 <c>diferencia-ya-resuelta</c>; 403 <c>conflicto-de-intereses</c>; 422 <c>justificacion-requerida</c>.
    /// </summary>
    public IReadOnlyList<object> ResolverDiferenciaOficial(TipoVerificacion tipo, Guid campoId, DecisionCoincidencia decision, string? justificacion, Revisor oficial,
        DateTimeOffset ahora)
    {
        AsegurarFuente(tipo);
        AsegurarAbiertoParaVerificar();
        var verificacion = BuscarVerificacion(tipo);
        var campo = verificacion?.FuenteOficial?.Campos.FirstOrDefault(c => c.Id == campoId && c.Resultado == Ficha.ResultadoDeCruce.Discrepa)
                    ?? throw ReglaDeNegocioException.NoEncontrado("diferencia-no-encontrada", "No hay una diferencia con ese id en la consulta vigente.");
        if (campo.Resuelta)
            throw ReglaDeNegocioException.Conflicto("diferencia-ya-resuelta", "Esa diferencia ya se resolvió; si cambió algo, vuelve a consultar la fuente.");
        AsegurarSinConflictoDeIntereses(oficial, verificacion);

        var texto = Requerido(justificacion, "justificacion-requerida", "Resolver una diferencia necesita una justificación.");
        return Simular(s => s.Emitir(new DiferenciaDeFuenteResuelta(tipo, campoId, decision, texto, oficial.UsuarioId.ToString(),
            ahora.AddMonths(ReglasDeFuente.MesesVigenciaDeDecision), ahora)), ahora);
    }

    private static void AsegurarFuente(TipoVerificacion tipo)
    {
        if (!CatalogoDeFuentes.EsFuente(tipo))
            throw ReglaDeNegocioException.Validacion("tipo-no-consultable", "Solo el RUES y la DIAN son fuentes oficiales.");
    }

    public void Apply(FuenteOficialConsultada e)
    {
        var verificacion = BuscarVerificacion(e.Tipo);
        if (verificacion is null)
            Verificaciones.Add(verificacion = new VerificacionDeExpediente { Tipo = e.Tipo, Bloqueante = false });

        if (verificacion.ReferenciaExterna is { } anterior)
            verificacion.Anteriores.Add(new ConsultaAnterior(verificacion.Proveedor ?? string.Empty, anterior,
                verificacion.Resultado ?? ResultadoVerificacion.Conforme, verificacion.RegistradaEn ?? e.Fecha, verificacion.Evidencia,
                verificacion.FuenteOficial?.Diferencias.Count() ?? 0));

        var campos = e.Campos.Select(ReglasDeFuente.Detalle).ToList();
        verificacion.Proveedor = e.Proveedor;
        verificacion.ReferenciaExterna = e.ReferenciaExterna;
        verificacion.RegistradaEn = e.Fecha;
        verificacion.RegistradaPor = e.Por;
        verificacion.VigenteHasta = e.VigenteHasta;
        verificacion.Evidencia = e.Evidencia;
        verificacion.FuenteOficial = new ResultadoDeFuenteOficial { Datos = e.Datos, Campos = campos };
        verificacion.Resultado = ReglasDeFuente.Resultado(campos);
        verificacion.Fallos = 0;
        verificacion.UltimoError = null;
        verificacion.ReintentarDesde = null;
        verificacion.ExpiroEn = null;
        verificacion.Estado = ReglasDeFuente.Estado(campos);
        RecalcularVerificaciones();
        ActualizadoEn = e.Fecha;
    }

    public void Apply(DiferenciaDeFuenteResuelta e)
    {
        var verificacion = BuscarVerificacion(e.Tipo)!;
        var campo = verificacion.FuenteOficial!.Campos.First(c => c.Id == e.CampoId);
        campo.Resolucion = new ResolucionDeCoincidencia(e.Decision, e.Justificacion, e.Por, e.Fecha, e.VigenteHasta);
        campo.Heredada = false;
        verificacion.Estado = ReglasDeFuente.Estado(verificacion.FuenteOficial.Campos);
        RecalcularVerificaciones();
        ActualizadoEn = e.Fecha;
    }

    /// <summary>
    /// Campo plano que lee el procesador: cuándo toca consultar la primera fuente oficial pendiente o vencida (con el expediente ya en revisión,
    /// para que la ficha esté diligenciada), o la hora del reintento tras un fallo.
    /// </summary>
    private void RecalcularConsultaOficial()
    {
        var porConsultar = EstaAbierto && Estado != EstadoExpediente.Abierto
            ? Verificaciones.Where(v => CatalogoDeFuentes.EsFuente(v.Tipo) && v.Estado is EstadoVerificacion.Pendiente or EstadoVerificacion.Expirada).ToList()
            : [];
        ProximaConsultaOficial = porConsultar.Count == 0 ? null : porConsultar.Min(v => v.ReintentarDesde ?? v.ExpiroEn ?? ActualizadoEn);
    }
}
