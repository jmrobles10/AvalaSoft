using Validasoft.Aplicacion.Comun;
using Validasoft.Contratos;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Evaluaciones;
using Validasoft.Dominio.Expedientes;

namespace Validasoft.Aplicacion.Evaluaciones;

/// <summary>Traducción dominio ↔ DTO del cuestionario y la evaluación (CE-1…CE-12). La vista del tercero (<see cref="APublica"/>) nunca trae puntajes, pesos, eliminatorias ni el umbral.</summary>
public static class MapeosDeEvaluaciones
{
    // ---------- Cuestionario ----------

    public static DefinicionDeCuestionarioDto ADto(this DefinicionDeCuestionario d) =>
        new([.. d.Secciones.Select(s => new SeccionDeCuestionarioDto(s.Codigo, s.Nombre, s.Peso, [.. s.Preguntas.Select(ADto)], s.Condicion?.ADto(), s.Descripcion))],
            d.UmbralDeAprobacion, d.Responde.ToString(), d.ReevaluarCadaMeses, d.Descripcion);

    private static PreguntaDeCuestionarioDto ADto(PreguntaDeCuestionario p) =>
        new(p.Codigo, p.Texto, p.Tipo.ToString(), p.Obligatoria, p.Peso, p.Eliminatoria,
            p.Opciones is null ? null : [.. p.Opciones.Select(o => new OpcionDePreguntaDto(o.Codigo, o.Texto, o.Puntaje, o.Elimina))],
            p.Escala is null ? null : new EscalaDePreguntaDto(p.Escala.Minimo, p.Escala.Maximo, p.Escala.MinimoAceptable),
            p.Rangos is null ? null : [.. p.Rangos.Select(r => new RangoDeNumeroDto(r.Desde, r.Hasta, r.Puntaje, r.Elimina))],
            p.Condicion?.ADto(), p.Ayuda, p.PermiteComentario);

    /// <summary>Definición del cuerpo a dominio; un tipo desconocido responde 422 <c>pregunta-invalida</c> y <c>quien-responde-invalido</c>. El dominio valida el resto al guardar.</summary>
    public static DefinicionDeCuestionario ADominio(this DefinicionDeCuestionarioDto d) =>
        new([.. (d.Secciones ?? []).Select(s => new SeccionDeCuestionario(s.Codigo ?? string.Empty, s.Nombre, s.Peso, [.. (s.Preguntas ?? []).Select(ADominio)],
            s.Condicion?.ADominio(), s.Descripcion))],
            d.UmbralDeAprobacion, Enumerado<QuienResponde>(d.Responde, "quien-responde-invalido", "Quién responde es Tercero o Evaluador."), d.ReevaluarCadaMeses, d.Descripcion);

    private static PreguntaDeCuestionario ADominio(PreguntaDeCuestionarioDto p) =>
        new(p.Codigo ?? string.Empty, p.Texto, Enumerado<TipoDePregunta>(p.Tipo, "pregunta-invalida",
                $"El tipo de pregunta es {string.Join(", ", Enum.GetNames<TipoDePregunta>())}."), p.Obligatoria, p.Peso, p.Eliminatoria,
            p.Opciones is null ? null : [.. p.Opciones.Select(o => new OpcionDePregunta(o.Codigo, o.Texto, o.Puntaje, o.Elimina))],
            p.Escala is null ? null : new EscalaDePregunta(p.Escala.Minimo, p.Escala.Maximo, p.Escala.MinimoAceptable),
            p.Rangos is null ? null : [.. p.Rangos.Select(r => new RangoDeNumero(r.Desde, r.Hasta, r.Puntaje, r.Elimina))],
            p.Condicion?.ADominio(), p.Ayuda, p.PermiteComentario);

    public static CuestionarioVersionDto ADto(this CuestionarioVersion v) =>
        new(v.Id, v.Version, v.Estado.ToString(), v.Definicion.ADto(), v.CreadaEn, v.PublicadaEn, v.RetiradaEn);

    public static CuestionarioDto ADto(this Cuestionario c) =>
        new(c.Id, c.EmpresaId, c.Codigo, c.Nombre, c.VersionPublicada?.ADto(), c.Borrador?.ADto(), c.CreadoEn, c.ActualizadoEn);

    // ---------- Respuestas y resultado ----------

    public static RespuestaDto ADto(this RespuestaDePregunta r) => new(r.Pregunta, r.Opciones, r.Numero, r.Texto, r.Adjuntos, r.Comentario);

    public static RespuestaDePregunta ADominio(this RespuestaDto r) => new(r.Pregunta, r.Opciones, r.Numero, r.Texto, r.Adjuntos, r.Comentario);

    public static ResultadoDeEvaluacionDto ADto(this ResultadoDeEvaluacion r) =>
        new(r.Puntaje, r.Umbral, r.Aprobada, r.Calculada, [.. r.Motivos], [.. r.Eliminatorias],
            [.. r.Secciones.Select(s => new PuntajeDeSeccionDto(s.Codigo, s.Nombre, s.Peso, s.Puntaje, s.Aplica))],
            [.. r.Preguntas.Select(p => new PreguntaCalificadaDto(p.Codigo, p.Visible, p.Respondida, p.Puntaje, p.Elimina, p.Ajustada))]);

    public static ActorDeEvaluacionDto ADto(this ActorDeEvaluacion a) => new(a.Tipo.ToString(), a.Id, a.Nombre);

    public static AjusteDto ADto(this AjusteDeCalificacion a) => new(a.Pregunta, a.Puntaje, a.LevantaEliminatoria);

    public static AjusteDeCalificacion ADominio(this AjusteDto a) => new(a.Pregunta, a.Puntaje, a.LevantaEliminatoria);

    public static AdjuntoDeEvaluacionDto ADto(this AdjuntoDeEvaluacion a) => new(a.Id, a.Nombre, a.TipoContenido, a.Tamano, a.Fecha);

    // ---------- Evaluación ----------

    /// <summary>La evaluación completa para la empresa. <paramref name="folio"/> es el del expediente que la pidió, si lo hay.</summary>
    public static EvaluacionDto ADto(this EvaluacionDeProveedor e, string? folio = null) =>
        new(e.Id, e.EmpresaId, e.VinculoId, e.ExpedienteId, folio, new TerceroResumenDto(e.TerceroId, e.TerceroNombre, e.TerceroIdentificacion), e.Motivo.ToString(),
            new CuestionarioDeEvaluacionDto(e.Cuestionario.Id, e.Cuestionario.VersionId, e.Cuestionario.Version, e.Cuestionario.Codigo, e.Cuestionario.Nombre),
            e.Definicion.Responde.ToString(), e.Efecto.ToString(), e.Estado.ToString(), e.Definicion.ADto(), [.. e.Respuestas.Select(ADto)], e.Resultado?.ADto(),
            [.. e.Calificaciones.Select(c => new CalificacionDto(c.Numero, c.Origen, c.Resultado.ADto(), c.Justificacion, c.Por.ADto(), c.Fecha))],
            [.. e.Ajustes.Select(ADto)], e.RespondidaPor?.ADto(), e.RespondidaEn, e.VigenteHasta, e.Intentos, e.Recalificaciones, e.Justificacion,
            [.. e.Adjuntos.Select(ADto)], e.Anterior, e.AsignadaEn, e.ActualizadaEn, e.Version);

    public static EvaluacionResumenDto Resumen(this EvaluacionDeProveedor e, string? folio = null) =>
        new(e.Id, e.VinculoId, e.ExpedienteId, folio, new TerceroResumenDto(e.TerceroId, e.TerceroNombre, e.TerceroIdentificacion), e.Cuestionario.Nombre,
            e.Cuestionario.Version, e.Estado.ToString(), e.Definicion.Responde.ToString(), e.Efecto.ToString(), e.Motivo.ToString(), e.Resultado?.Puntaje,
            e.Resultado?.Aprobada, e.AsignadaEn, e.RespondidaEn, e.VigenteHasta);

    /// <summary>Estado en el expediente (<c>Pendiente|Aprobada|Reprobada|Anulada</c>) y puntaje, tal como los ve su detalle.</summary>
    public static EvaluacionDeExpedienteDto ADto(this EvaluacionDeExpediente e) =>
        new(e.EvaluacionId, e.Codigo, e.Nombre, e.Responde.ToString(), e.Efecto.ToString(), e.Estado.ToString(), e.Puntaje, e.ActualizadaEn);

    // ---------- Vista del tercero ----------

    /// <summary>
    /// Lo que ve el tercero al responder (CE-4): las preguntas con sus opciones, sin puntajes, pesos, eliminatorias, rangos ni umbral. Tras enviar solo ve sus
    /// respuestas y que quedó <c>Enviada</c>: el resultado es privado de la empresa.
    /// </summary>
    public static EvaluacionPublicaDto APublica(this EvaluacionDeProveedor e) =>
        new(e.Id, e.VinculoId, e.Cuestionario.Nombre, e.Definicion.Descripcion, e.Estado == EstadoDeEvaluacion.Pendiente ? "Pendiente" : "Enviada",
            [.. e.Definicion.Secciones.Select(s => new SeccionPublicaDto(s.Codigo, s.Nombre, s.Descripcion, [.. s.Preguntas.Select(APublica)]))],
            [.. e.Respuestas.Select(ADto)], [.. e.Adjuntos.Select(ADto)], e.AsignadaEn, e.RespondidaEn);

    private static PreguntaPublicaDto APublica(PreguntaDeCuestionario p) =>
        new(p.Codigo, p.Texto, p.Tipo.ToString(), p.Obligatoria, p.Ayuda, p.PermiteComentario,
            p.Opciones is null ? null : [.. p.Opciones.Select(o => new OpcionPublicaDto(o.Codigo, o.Texto))],
            p.Escala is null ? null : new EscalaPublicaDto(p.Escala.Minimo, p.Escala.Maximo));

    public static EvaluacionPublicaResumenDto APublicaResumen(this EvaluacionDeProveedor e) =>
        new(e.Id, e.Cuestionario.Nombre, e.Estado == EstadoDeEvaluacion.Pendiente ? "Pendiente" : "Enviada", e.AsignadaEn, e.RespondidaEn);

    /// <summary>La evaluación del tercero tal como la ve el expediente público: <c>Pendiente</c> o <c>Enviada</c> (nunca aprobada ni reprobada), sin las anuladas.</summary>
    public static IReadOnlyList<EvaluacionPublicaResumenDto> EvaluacionesPublicas(this Expediente e) =>
        [.. e.Evaluaciones.Where(x => x.Responde == QuienResponde.Tercero && x.Estado != EstadoDeEvaluacionEnExpediente.Anulada)
            .Select(x => new EvaluacionPublicaResumenDto(x.EvaluacionId, x.Nombre, x.Estado == EstadoDeEvaluacionEnExpediente.Pendiente ? "Pendiente" : "Enviada",
                e.AbiertoEn, x.Estado == EstadoDeEvaluacionEnExpediente.Pendiente ? null : x.ActualizadaEn))];

    // ---------- Flujo ----------

    public static EvaluacionRequeridaDto ADto(this Dominio.Flujos.EvaluacionRequeridaDelFlujo e) => new(e.CuestionarioId, e.Efecto.ToString());

    public static Dominio.Flujos.EvaluacionRequeridaDelFlujo ADominio(this EvaluacionRequeridaDto e) =>
        new(e.CuestionarioId, Enumerado<EfectoDeLaEvaluacion>(e.Efecto, "efecto-invalido", "El efecto de una evaluación reprobada es Observar o Bloquear."));

    private static T Enumerado<T>(string? valor, string codigo, string mensaje) where T : struct, Enum =>
        Enum.TryParse<T>(valor, true, out var resultado) && Enum.IsDefined(resultado) ? resultado : throw ReglaDeNegocioException.Validacion(codigo, mensaje);
}
