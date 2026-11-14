using System.Text.Json;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Expedientes;

namespace Validasoft.Dominio.FuentesOficiales;

/// <summary>
/// Reconsulta periódica de las fuentes oficiales de un vínculo activo (FO-7, opcional, por empresa): tras aprobarse un expediente que consultó el RUES
/// o la DIAN, y si la empresa fijó <see cref="FuentesOficialesEmpresa.DiasMonitoreo"/>, el vínculo se vuelve a cotejar con cada fuente cada
/// <see cref="FrecuenciaDias"/> días (una matrícula que se cancela o no se renueva, un RUT suspendido, un representante nuevo). Hereda las decisiones
/// vigentes; una diferencia nueva avisa a Cumplimiento por la campana y nunca se aprueba sola. Mismo patrón que <see cref="MonitoreoDeListas"/>.
/// Esquema <c>validacion</c>, multi-tenant; id = vínculo.
/// </summary>
public sealed class MonitoreoDeFuentesOficiales
{
    public Guid Id { get; set; }

    public Guid EmpresaId { get; set; }

    public Guid TerceroId { get; set; }

    public string TerceroNombre { get; set; } = string.Empty;

    public string TerceroIdentificacion { get; set; } = string.Empty;

    /// <summary>Expediente aprobado que lo originó (o el último que lo renovó).</summary>
    public Guid ExpedienteId { get; set; }

    public string Folio { get; set; } = string.Empty;

    public int FrecuenciaDias { get; set; }

    /// <summary>La primera consulta que toca (la de la fuente que antes vence o reintenta); nulo = detenido.</summary>
    public DateTimeOffset? ProximaConsulta { get; set; }

    /// <summary>Una verificación por fuente, con su último resultado y cotejo.</summary>
    public List<VerificacionDeExpediente> Fuentes { get; set; } = [];

    /// <summary>Hay una diferencia con alguna fuente que espera la decisión del oficial.</summary>
    public bool PendienteDeCumplimiento { get; set; }

    public DateTimeOffset CreadoEn { get; set; }

    public DateTimeOffset ActualizadoEn { get; set; }

    public Guid VinculoId => Id;

    public VerificacionDeExpediente? De(TipoVerificacion tipo) => Fuentes.FirstOrDefault(f => f.Tipo == tipo);

    /// <summary>
    /// Inicia (o renueva) el monitoreo con las fuentes que consultó el expediente aprobado: copia el resultado, las decisiones y la evidencia, y
    /// programa la siguiente consulta. Sin consulta de fuentes en el expediente o con <paramref name="frecuenciaDias"/> en 0, devuelve nulo.
    /// </summary>
    public static MonitoreoDeFuentesOficiales? Iniciar(Expediente expediente, MonitoreoDeFuentesOficiales? anterior, int frecuenciaDias, DateTimeOffset ahora)
    {
        var consultadas = expediente.Verificaciones.Where(v => CatalogoDeFuentes.EsFuente(v.Tipo) && v.ReferenciaExterna is not null && v.FuenteOficial is not null).ToList();
        if (consultadas.Count == 0 || frecuenciaDias <= 0)
            return null;

        var monitoreo = anterior ?? new MonitoreoDeFuentesOficiales { Id = expediente.VinculoId, CreadoEn = ahora };
        monitoreo.EmpresaId = expediente.EmpresaId;
        monitoreo.TerceroId = expediente.TerceroId;
        monitoreo.TerceroNombre = expediente.TerceroNombre;
        monitoreo.TerceroIdentificacion = expediente.TerceroIdentificacion;
        monitoreo.ExpedienteId = expediente.Id;
        monitoreo.Folio = expediente.Folio;
        monitoreo.FrecuenciaDias = frecuenciaDias;
        monitoreo.Fuentes =
        [
            .. consultadas.Select(v => new VerificacionDeExpediente
            {
                Tipo = v.Tipo,
                Bloqueante = false,
                Estado = v.Estado,
                Resultado = v.Resultado,
                Proveedor = v.Proveedor,
                ReferenciaExterna = v.ReferenciaExterna,
                RegistradaEn = v.RegistradaEn,
                RegistradaPor = v.RegistradaPor,
                VigenteHasta = v.VigenteHasta,
                Evidencia = v.Evidencia,
                FuenteOficial = Copiar(v.FuenteOficial!),
                Anteriores = [.. monitoreo.De(v.Tipo)?.Anteriores ?? []]
            })
        ];
        monitoreo.ActualizadoEn = ahora;
        monitoreo.Recalcular(ahora);
        return monitoreo;
    }

    /// <summary>La fuente toca consultarla: llegó su fecha (o su reintento tras un fallo).</summary>
    public bool Vence(VerificacionDeExpediente fuente, DateTimeOffset ahora) => Proxima(fuente) <= ahora;

    /// <summary>
    /// Registra una reconsulta periódica: hereda las diferencias aceptadas vigentes y programa la siguiente. Devuelve las diferencias nuevas (sin decisión y
    /// que no estaban pendientes antes) para avisar a Cumplimiento. Idempotente por referencia.
    /// </summary>
    public IReadOnlyList<CampoDeFuente> RegistrarConsulta(TipoVerificacion tipo, ConsultaOficialRealizada consulta, string por, DateTimeOffset ahora)
    {
        var fuente = De(tipo) ?? throw ReglaDeNegocioException.NoEncontrado("monitoreo-no-encontrado", "El vínculo no monitorea esa fuente.");
        if (fuente.ReferenciaExterna == consulta.ReferenciaExterna || fuente.Anteriores.Any(a => a.ReferenciaExterna == consulta.ReferenciaExterna))
            return [];

        var previos = fuente.FuenteOficial?.Campos ?? [];
        var campos = ReglasDeFuente.Heredar(consulta.Campos, previos, ahora).Select(ReglasDeFuente.Detalle).ToList();
        if (fuente.ReferenciaExterna is { } anterior)
            fuente.Anteriores.Add(new ConsultaAnterior(fuente.Proveedor ?? string.Empty, anterior, fuente.Resultado ?? ResultadoVerificacion.Conforme,
                fuente.RegistradaEn ?? ahora, fuente.Evidencia, previos.Count(c => c.Resultado == Ficha.ResultadoDeCruce.Discrepa)));

        fuente.Proveedor = consulta.Proveedor;
        fuente.ReferenciaExterna = consulta.ReferenciaExterna;
        fuente.RegistradaEn = ahora;
        fuente.RegistradaPor = por;
        fuente.VigenteHasta = consulta.VigenteHasta;
        fuente.Evidencia = consulta.Evidencia;
        fuente.FuenteOficial = new ResultadoDeFuenteOficial { Datos = consulta.Datos, Campos = campos };
        fuente.Resultado = ReglasDeFuente.Resultado(campos);
        fuente.Estado = ReglasDeFuente.Estado(campos);
        fuente.Fallos = 0;
        fuente.UltimoError = null;
        fuente.ReintentarDesde = null;
        ActualizadoEn = ahora;
        Recalcular(ahora);
        return [.. campos.Where(c => c.PorRevisar && !previos.Any(p => p.EsLaMisma(c.ACotejado())))];
    }

    /// <summary>Un revisor decide una diferencia del monitoreo (mismas reglas que en el expediente: justificación, sin conflicto de intereses).</summary>
    public CampoDeFuente ResolverDiferencia(TipoVerificacion tipo, Guid campoId, DecisionCoincidencia decision, string? justificacion, Revisor oficial, DateTimeOffset ahora)
    {
        var fuente = De(tipo);
        var campo = fuente?.FuenteOficial?.Campos.FirstOrDefault(c => c.Id == campoId && c.Resultado == Ficha.ResultadoDeCruce.Discrepa)
                    ?? throw ReglaDeNegocioException.NoEncontrado("diferencia-no-encontrada", "No hay una diferencia con ese id en la última consulta.");
        if (campo.Resuelta)
            throw ReglaDeNegocioException.Conflicto("diferencia-ya-resuelta", "Esa diferencia ya se resolvió.");
        if (!string.IsNullOrWhiteSpace(oficial.ClaveIdentificacion) && oficial.ClaveIdentificacion == TerceroIdentificacion)
            throw ReglaDeNegocioException.Prohibido("conflicto-de-intereses",
                "Tu identificación coincide con la del tercero: no puedes decidir esta verificación.");
        var texto = string.IsNullOrWhiteSpace(justificacion)
            ? throw ReglaDeNegocioException.Validacion("justificacion-requerida", "Resolver una diferencia necesita una justificación.")
            : justificacion.Trim();
        if (texto.Length > 4000)
            throw ReglaDeNegocioException.Validacion("texto-demasiado-largo", "La justificación admite hasta 4000 caracteres.");

        campo.Resolucion = new ResolucionDeCoincidencia(decision, texto, oficial.UsuarioId.ToString(), ahora, ahora.AddMonths(ReglasDeFuente.MesesVigenciaDeDecision));
        campo.Heredada = false;
        fuente!.Estado = ReglasDeFuente.Estado(fuente.FuenteOficial!.Campos);
        ActualizadoEn = ahora;
        Recalcular(ahora);
        return campo;
    }

    /// <summary>La reconsulta de una fuente falló: se reintenta más tarde sin perder el último resultado.</summary>
    public void RegistrarFallo(TipoVerificacion tipo, string error, DateTimeOffset reintentarDesde, DateTimeOffset ahora)
    {
        var fuente = De(tipo);
        if (fuente is null)
            return;
        fuente.Fallos++;
        fuente.UltimoError = error.Length > 500 ? error[..500] : error;
        fuente.ReintentarDesde = reintentarDesde;
        ActualizadoEn = ahora;
        Recalcular(ahora);
    }

    /// <summary>El vínculo dejó de estar activo: no se consulta más (el historial se conserva).</summary>
    public void Detener(DateTimeOffset ahora)
    {
        ProximaConsulta = null;
        ActualizadoEn = ahora;
    }

    private DateTimeOffset Proxima(VerificacionDeExpediente fuente) =>
        fuente.ReintentarDesde ?? (fuente.RegistradaEn ?? CreadoEn).AddDays(FrecuenciaDias);

    private void Recalcular(DateTimeOffset ahora)
    {
        PendienteDeCumplimiento = Fuentes.Any(f => f.FuenteOficial?.TieneDiferenciasPorRevisar == true);
        ProximaConsulta = Fuentes.Count == 0 ? null : Fuentes.Min(Proxima);
        ActualizadoEn = ahora;
    }

    private static ResultadoDeFuenteOficial Copiar(ResultadoDeFuenteOficial origen) =>
        JsonSerializer.Deserialize<ResultadoDeFuenteOficial>(JsonSerializer.Serialize(origen))!;
}
