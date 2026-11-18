namespace Avalasoft.Contratos;

// ---------- Cuestionario de evaluación del proveedor nuevo (CE-1…CE-12): privado de la empresa ----------
// Enums como texto. Los puntajes, pesos, eliminatorias y el umbral solo los ven las personas de la empresa: la vista del tercero (autoevaluación) no los trae.

/// <summary>Opción de una pregunta. <see cref="Puntaje"/> son puntos relativos (la mejor opción vale el 100 % de la pregunta); <see cref="Elimina"/> reprueba la evaluación si se elige.</summary>
public sealed record OpcionDePreguntaDto(string Codigo, string Texto, decimal Puntaje, bool Elimina = false);

/// <summary>Tramo de una pregunta numérica: <c>Desde</c> y <c>Hasta</c> inclusive (nulos = sin límite).</summary>
public sealed record RangoDeNumeroDto(decimal? Desde, decimal? Hasta, decimal Puntaje, bool Elimina = false);

/// <summary>Escala de enteros de <see cref="Minimo"/> a <see cref="Maximo"/> (el mayor es el mejor); por debajo de <see cref="MinimoAceptable"/> elimina.</summary>
public sealed record EscalaDePreguntaDto(int Minimo, int Maximo, int? MinimoAceptable = null);

/// <summary>
/// Pregunta. <see cref="Tipo"/>: <c>SiNo|OpcionUnica|OpcionMultiple|Escala|Numero|Texto|Adjunto</c>. <see cref="Codigo"/> vacío = el sistema lo genera
/// (<c>P1</c>, <c>P2</c>…). <see cref="Condicion"/> usa el motor de exigencia con <c>tercero.*</c>, <c>vinculo.tipo</c> y <c>respuesta.{codigo}</c> de preguntas anteriores.
/// </summary>
public sealed record PreguntaDeCuestionarioDto(
    string? Codigo, string Texto, string Tipo, bool Obligatoria, decimal Peso, bool Eliminatoria, IReadOnlyList<OpcionDePreguntaDto>? Opciones = null,
    EscalaDePreguntaDto? Escala = null, IReadOnlyList<RangoDeNumeroDto>? Rangos = null, CondicionDto? Condicion = null, string? Ayuda = null,
    bool PermiteComentario = false);

public sealed record SeccionDeCuestionarioDto(
    string? Codigo, string Nombre, decimal Peso, IReadOnlyList<PreguntaDeCuestionarioDto> Preguntas, CondicionDto? Condicion = null, string? Descripcion = null);

/// <summary>
/// Contenido de una versión. <see cref="Responde"/>: <c>Tercero</c> (autoevaluación) o <c>Evaluador</c> (una persona de la empresa).
/// <see cref="UmbralDeAprobacion"/> de 0 a 100; <see cref="ReevaluarCadaMeses"/> (1 a 60) repite la evaluación aprobada (vacío = no se repite).
/// </summary>
public sealed record DefinicionDeCuestionarioDto(
    IReadOnlyList<SeccionDeCuestionarioDto> Secciones, decimal UmbralDeAprobacion, string Responde, int? ReevaluarCadaMeses = null, string? Descripcion = null);

public sealed record CuestionarioVersionDto(
    Guid Id, int Version, string Estado, DefinicionDeCuestionarioDto Definicion, DateTimeOffset CreadaEn, DateTimeOffset? PublicadaEn, DateTimeOffset? RetiradaEn);

/// <summary>Cuestionario con su versión publicada y su borrador (si existen).</summary>
public sealed record CuestionarioDto(
    Guid Id, Guid EmpresaId, string Codigo, string Nombre, CuestionarioVersionDto? Publicada, CuestionarioVersionDto? Borrador, DateTimeOffset CreadoEn,
    DateTimeOffset ActualizadoEn);

public sealed record CrearCuestionarioDto(string Codigo, string Nombre, DefinicionDeCuestionarioDto Definicion);

/// <summary>Edita el borrador (o abre uno nuevo si solo hay versión publicada). Lo que llega nulo conserva el valor de la última versión.</summary>
public sealed record EditarCuestionarioDto(string? Nombre = null, DefinicionDeCuestionarioDto? Definicion = null);

/// <summary>
/// Respuesta a una pregunta: <see cref="Opciones"/> (códigos; Sí/No usa <c>si</c> o <c>no</c>), <see cref="Numero"/> (escala y número), <see cref="Texto"/> o
/// <see cref="Adjuntos"/> (ids de archivos subidos a la evaluación).
/// </summary>
public sealed record RespuestaDto(
    string Pregunta, IReadOnlyList<string>? Opciones = null, decimal? Numero = null, string? Texto = null, IReadOnlyList<Guid>? Adjuntos = null, string? Comentario = null);

/// <summary>Prueba un cuestionario con respuestas inventadas, sin guardar nada: <see cref="TipoPersona"/> (<c>Natural|Juridica|Consorcio</c>, por omisión Juridica) y <see cref="Pais"/> alimentan las condiciones.</summary>
public sealed record SimularCuestionarioDto(IReadOnlyList<RespuestaDto> Respuestas, string? TipoPersona = null, string? Pais = null, string? TipoVinculo = null);

public sealed record PreguntaCalificadaDto(string Codigo, bool Visible, bool Respondida, decimal? Puntaje, bool Elimina, bool Ajustada);

public sealed record PuntajeDeSeccionDto(string Codigo, string Nombre, decimal Peso, decimal? Puntaje, bool Aplica);

/// <summary>
/// Resultado: puntaje total de 0 a 100 (nulo si nada puntuó), por sección y pregunta, <see cref="Motivos"/> (<c>BajoElUmbral</c>, <c>Eliminatoria</c>) y las
/// preguntas eliminatorias falladas. <see cref="Calculada"/> falso si un revisor fijó el veredicto a mano al recalificar.
/// </summary>
public sealed record ResultadoDeEvaluacionDto(
    decimal? Puntaje, decimal Umbral, bool Aprobada, bool Calculada, IReadOnlyList<string> Motivos, IReadOnlyList<string> Eliminatorias,
    IReadOnlyList<PuntajeDeSeccionDto> Secciones, IReadOnlyList<PreguntaCalificadaDto> Preguntas);

/// <summary>Vista previa de un cuestionario (<c>POST /cuestionarios/{id}/simular</c>): el resultado de las respuestas dadas, sin guardar nada.</summary>
public sealed record SimulacionDeCuestionarioDto(int Version, string Estado, ResultadoDeEvaluacionDto Resultado);

/// <summary>Qué preguntas y secciones se muestran con las respuestas dadas (las condiciones de visibilidad, evaluadas en el servidor).</summary>
public sealed record VisibilidadDto(IReadOnlyList<string> Preguntas, IReadOnlyList<string> Secciones);

// ---------- Evaluación ----------

public sealed record ActorDeEvaluacionDto(string Tipo, string Id, string? Nombre);

public sealed record CuestionarioDeEvaluacionDto(Guid Id, Guid VersionId, int Version, string Codigo, string Nombre);

public sealed record CalificacionDto(int Numero, string Origen, ResultadoDeEvaluacionDto Resultado, string? Justificacion, ActorDeEvaluacionDto Por, DateTimeOffset Fecha);

public sealed record AjusteDto(string Pregunta, decimal? Puntaje = null, bool LevantaEliminatoria = false);

public sealed record AdjuntoDeEvaluacionDto(Guid Id, string Nombre, string TipoContenido, long Tamano, DateTimeOffset Fecha);

/// <summary>
/// Evaluación completa (solo la empresa que la asignó): la versión del cuestionario con la que se evalúa, las respuestas, el resultado vigente y el historial de
/// calificaciones. <see cref="Estado"/>: <c>Pendiente|Calificada|Vencida|Anulada</c>; <see cref="Motivo"/>: <c>Expediente|Reevaluacion|Manual</c>; <see cref="Efecto"/>:
/// <c>Observar|Bloquear</c>.
/// </summary>
public sealed record EvaluacionDto(
    Guid Id, Guid EmpresaId, Guid VinculoId, Guid? ExpedienteId, string? Folio, TerceroResumenDto Tercero, string Motivo, CuestionarioDeEvaluacionDto Cuestionario,
    string Responde, string Efecto, string Estado, DefinicionDeCuestionarioDto Definicion, IReadOnlyList<RespuestaDto> Respuestas, ResultadoDeEvaluacionDto? Resultado,
    IReadOnlyList<CalificacionDto> Calificaciones, IReadOnlyList<AjusteDto> Ajustes, ActorDeEvaluacionDto? RespondidaPor, DateTimeOffset? RespondidaEn,
    DateTimeOffset? VigenteHasta, int Intentos, int Recalificaciones, string? Justificacion, IReadOnlyList<AdjuntoDeEvaluacionDto> Adjuntos, Guid? Anterior,
    DateTimeOffset AsignadaEn, DateTimeOffset ActualizadaEn, long Version);

/// <summary>Fila de la lista de evaluaciones.</summary>
public sealed record EvaluacionResumenDto(
    Guid Id, Guid VinculoId, Guid? ExpedienteId, string? Folio, TerceroResumenDto Tercero, string Cuestionario, int VersionCuestionario, string Estado, string Responde,
    string Efecto, string Motivo, decimal? Puntaje, bool? Aprobada, DateTimeOffset AsignadaEn, DateTimeOffset? RespondidaEn, DateTimeOffset? VigenteHasta);

public sealed record ResponderEvaluacionDto(IReadOnlyList<RespuestaDto> Respuestas);

/// <summary>
/// Recalifica con justificación (obligatoria): <see cref="Ajustes"/> reemplaza al conjunto vigente (puntaje de 0 a 100 de una pregunta y/o levantar su eliminatoria) y
/// <see cref="Aprobada"/> fija el veredicto a mano (nulo = el calculado).
/// </summary>
public sealed record RecalificarEvaluacionDto(string Justificacion, IReadOnlyList<AjusteDto>? Ajustes = null, bool? Aprobada = null);

/// <summary>Asigna a mano un cuestionario publicado a un vínculo (efecto <c>Observar</c>: sin expediente al que frenar).</summary>
public sealed record AsignarEvaluacionDto(Guid CuestionarioId);

/// <summary>Paso 1 de la subida de un archivo de evidencia (PDF o imagen de hasta 15 MB).</summary>
public sealed record IniciarAdjuntoDeEvaluacionDto(string NombreArchivo, long TamanoBytes, string TipoMime);

public sealed record ConfirmarAdjuntoDeEvaluacionDto(string NombreArchivo);

/// <summary>Resumen de una evaluación dentro del expediente: su estado y puntaje (el detalle está en la evaluación).</summary>
public sealed record EvaluacionDeExpedienteDto(
    Guid EvaluacionId, string Codigo, string Nombre, string Responde, string Efecto, string Estado, decimal? Puntaje, DateTimeOffset? ActualizadaEn);

// ---------- Vista del tercero (autoevaluación): sin puntajes, pesos, eliminatorias ni umbral ----------

public sealed record OpcionPublicaDto(string Codigo, string Texto);

public sealed record EscalaPublicaDto(int Minimo, int Maximo);

public sealed record PreguntaPublicaDto(
    string Codigo, string Texto, string Tipo, bool Obligatoria, string? Ayuda, bool PermiteComentario, IReadOnlyList<OpcionPublicaDto>? Opciones, EscalaPublicaDto? Escala);

public sealed record SeccionPublicaDto(string Codigo, string Nombre, string? Descripcion, IReadOnlyList<PreguntaPublicaDto> Preguntas);

/// <summary>
/// La evaluación que debe responder el tercero. Tras responder, solo ve que la envió (nunca el resultado: es privado de la empresa). <see cref="Estado"/>:
/// <c>Pendiente</c> o <c>Enviada</c>.
/// </summary>
public sealed record EvaluacionPublicaDto(
    Guid Id, Guid VinculoId, string Cuestionario, string? Descripcion, string Estado, IReadOnlyList<SeccionPublicaDto> Secciones, IReadOnlyList<RespuestaDto> Respuestas,
    IReadOnlyList<AdjuntoDeEvaluacionDto> Adjuntos, DateTimeOffset AsignadaEn, DateTimeOffset? RespondidaEn);

public sealed record EvaluacionPublicaResumenDto(Guid Id, string Cuestionario, string Estado, DateTimeOffset AsignadaEn, DateTimeOffset? RespondidaEn);

// ---------- Informe ----------

public sealed record FilaInformeEvaluacionDto(
    Guid Id, Guid VinculoId, Guid? ExpedienteId, string? Folio, TerceroResumenDto Tercero, string Cuestionario, int VersionCuestionario, string Estado, string Responde,
    string Efecto, string Motivo, decimal? Puntaje, bool? Aprobada, IReadOnlyList<string> Motivos, IReadOnlyList<string> Eliminatorias, string? RespondidaPor,
    DateTimeOffset AsignadaEn, DateTimeOffset? RespondidaEn, DateTimeOffset? VigenteHasta, int Recalificaciones);

public sealed record ResumenEvaluacionesDto(int Total, int Pendientes, int Aprobadas, int Reprobadas, int Vencidas, int Anuladas, decimal? PuntajePromedio);

/// <summary>Informe de evaluaciones por proveedor: filtra por estado, cuestionario, vínculo, tercero y rango de fechas de asignación; se descarga en Excel con los mismos filtros.</summary>
public sealed record InformeEvaluacionesDto(ResumenEvaluacionesDto Resumen, IReadOnlyList<FilaInformeEvaluacionDto> Filas, string? SiguienteCursor);

// ---------- Flujo ----------

/// <summary>Cuestionario que pide el flujo (<c>Efecto</c>: <c>Observar|Bloquear</c>, por omisión Bloquear).</summary>
public sealed record EvaluacionRequeridaDto(Guid CuestionarioId, string Efecto = "Bloquear");

// ---------- Reevaluación periódica (Plataforma) ----------

/// <summary>Corre ya el barrido de reevaluaciones (Plataforma). <see cref="TenantId"/> lo limita a un tenant; <see cref="Fecha"/> simula «ahora» (solo en Development, para pruebas de punta a punta).</summary>
public sealed record RevisarReevaluacionesDto(Guid? TenantId = null, DateTimeOffset? Fecha = null);

public sealed record ResultadoRevisionReevaluacionesDto(int Revisadas, int Vencidas, int Asignadas);

// ---------- Evento público ----------

/// <summary>
/// Datos del evento <c>evaluacion.calificada</c> (docs/05 §7): una evaluación se respondió o se recalificó. <see cref="Origen"/>: <c>Respuesta</c> o <c>Recalificacion</c>. Lleva el puntaje, el
/// veredicto y los motivos (<c>BajoElUmbral</c>, <c>Eliminatoria</c>), nunca las respuestas ni el detalle: eso solo lo ve la empresa en la API.
/// </summary>
public sealed record DatosEvaluacionDto(
    Guid EvaluacionId, Guid VinculoId, Guid? ExpedienteId, IReadOnlyList<ReferenciaExternaDto> Referencias, Guid TerceroId, string CuestionarioCodigo, string CuestionarioNombre,
    int VersionCuestionario, string Origen, decimal? Puntaje, decimal Umbral, bool Aprobada, bool Calculada, IReadOnlyList<string> Motivos, string Efecto, DateTimeOffset Fecha);
