using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Validalo.Contratos;
using Xunit.Abstractions;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Cuestionario de evaluación del proveedor nuevo (CE-1…CE-12) con PostgreSQL y MinIO reales: el cuestionario versionado, la autoevaluación del tercero (que nunca ve el
/// resultado) y la del evaluador interno, el cierre del expediente bloqueado por una evaluación (o solo observado), la recalificación con justificación, la privacidad entre empresas
/// y frente a otros terceros, la reevaluación periódica y el informe.
/// </summary>
[Collection(Colecciones.Api3)]
[Trait("Requiere", "Docker")]
public sealed class RequisitosEvaluacionesApiTests(ApiFixture fixture, ITestOutputHelper salida) : RequisitosApiBase(fixture, salida)
{
    private static readonly string[] ScopesDeEvaluaciones =
        [.. ScopesDeSistema, "cuestionarios:leer", "evaluaciones:leer", "evaluaciones:responder", "evaluaciones:recalificar"];

    /// <summary>
    /// Legal (60): P1 sí/no eliminatoria («no» elimina) y P2 antigüedad, ambas de peso 1. Operación (40): P3 escala 1–5 (peso 1) y P4 evidencia (adjunto opcional, no puntúa). Umbral 70.
    /// </summary>
    private static DefinicionDeCuestionarioDto DefinicionDeEvaluacion(string responde, int? meses = null, decimal umbral = 70) => new(
    [
        new SeccionDeCuestionarioDto("LEGAL", "Legal", 60,
        [
            new PreguntaDeCuestionarioDto("P1", "¿Cuenta con el sistema de seguridad y salud en el trabajo?", "SiNo", true, 1, true,
                [new OpcionDePreguntaDto("si", "Sí", 10), new OpcionDePreguntaDto("no", "No", 0, true)]),
            new PreguntaDeCuestionarioDto("P2", "Antigüedad en el mercado", "OpcionUnica", true, 1, false,
                [new OpcionDePreguntaDto("menos1", "Menos de un año", 0), new OpcionDePreguntaDto("mas3", "Más de tres años", 10)])
        ]),
        new SeccionDeCuestionarioDto("OPERACION", "Operación", 40,
        [
            new PreguntaDeCuestionarioDto("P3", "Calidad del servicio", "Escala", true, 1, false, Escala: new EscalaDePreguntaDto(1, 5)),
            new PreguntaDeCuestionarioDto("P4", "Evidencia de certificaciones", "Adjunto", false, 0, false)
        ])
    ], umbral, responde, meses);

    private static readonly RespuestaDto[] RespuestasBuenas = [new("P1", ["si"]), new("P2", ["mas3"]), new("P3", Numero: 5)];

    // «no» a la pregunta eliminatoria y lo mejor en el resto: Legal = (0 + 100)/2 = 50 y el total (60·50 + 40·100)/100 = 70 alcanza el umbral, pero aun así reprueba por la eliminatoria.
    // Sin eliminatoria pero floja: Legal = (100 + 0)/2 = 50, Operación = 0 y el total es 30, bajo el umbral de 70.
    private static readonly RespuestaDto[] RespuestasBajas = [new("P1", ["si"]), new("P2", ["menos1"]), new("P3", Numero: 1)];

    private static readonly RespuestaDto[] RespuestasEliminadas = [new("P1", ["no"]), new("P2", ["mas3"]), new("P3", Numero: 5)];

    private async Task<CuestionarioDto> CuestionarioPublicadoAsync(Empresa empresa, string codigo, string responde, int? meses = null)
    {
        var creado = await ApiAsync<CuestionarioDto>("POST", "/api/v1/cuestionarios", Admin(empresa),
            new CrearCuestionarioDto(codigo, "Evaluación " + codigo, DefinicionDeEvaluacion(responde, meses)), 201);
        creado.Publicada.ShouldBeNull();
        creado.Borrador!.Version.ShouldBe(1);
        return await ApiAsync<CuestionarioDto>("POST", $"/api/v1/cuestionarios/{creado.Id}/publicar", Admin(empresa), new { }, 200);
    }

    /// <summary>La llave del sistema integrado con los permisos de cuestionarios y evaluaciones (la de <see cref="EmpresaNuevaAsync"/> solo trae los de las pruebas anteriores).</summary>
    private async Task<Empresa> ConEvaluacionesAsync(Empresa empresa)
    {
        var sistema = (await ApiAsync<List<SistemaIntegradoDto>>("GET", "/api/v1/sistemas", new Credencial(empresa.Admin), null, 200)).Single(s => s.Codigo == "SRM");
        var llave = await ApiAsync<ApiKeyDto>("POST", "/api/v1/api-keys", new Credencial(empresa.Admin),
            new CrearApiKeyDto("SRM con evaluaciones", ScopesDeEvaluaciones, null, null, SistemaId: sistema.Id), 201);
        return empresa with { LlaveSrm = llave.Valor! };
    }

    /// <summary>Agrega al flujo de PROVEEDOR los cuestionarios dados (edita el borrador y publica).</summary>
    private async Task PedirEvaluacionesAsync(Escenario e, params EvaluacionRequeridaDto[] evaluaciones)
    {
        await ApiAsync<FlujoDto>("PUT", $"/api/v1/flujos/{e.Flujo.Id}", Admin(e.Norte), new EditarFlujoDto(Evaluaciones: evaluaciones), 200);
        var publicado = await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{e.Flujo.Id}/publicar", Admin(e.Norte), new { }, 200);
        publicado.Publicada!.Evaluaciones!.Select(x => (x.CuestionarioId, x.Efecto)).ShouldBe(evaluaciones.Select(x => (x.CuestionarioId, x.Efecto)));
    }

    /// <summary>Un proveedor de Norte que acepta la invitación y sube sus documentos: su expediente inicial queda abierto con las evaluaciones que pide el flujo.</summary>
    private async Task<(VinculoDto Vinculo, SesionTerceroDto Sesion, Guid Expediente)> ProveedorEnRevisionAsync(Escenario e)
    {
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT"));
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara"));
        await AceptarAsync(sesion, vinculo.Id);
        return (vinculo, sesion, await ExpedienteAbiertoAsync(e, vinculo.Id));
    }

    private Task<ExpedienteDto> ExpedienteDeAsync(Empresa empresa, Guid id) => ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{id}", Admin(empresa), null, 200);

    /// <summary>
    /// Sube un archivo de evidencia con la URL prefirmada (PUT directo a MinIO) y lo confirma; devuelve el id que se cita en la respuesta. <paramref name="credencial"/> es una fábrica:
    /// cada petición de una persona lleva su propia aserción de un solo uso.
    /// </summary>
    private async Task<Guid> SubirEvidenciaAsync(string rutaEvaluacion, Func<Credencial> credencial, byte[] contenido)
    {
        var inicio = await ApiAsync<CargaDeAdjuntoDto>("PUT", $"{rutaEvaluacion}/adjuntos", credencial(),
            new IniciarAdjuntoDeEvaluacionDto("certificado.pdf", contenido.Length, "application/pdf"), 200);
        using var put = new HttpRequestMessage(HttpMethod.Put, inicio.Carga.Url) { Content = new ByteArrayContent(contenido) };
        put.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(inicio.Carga.Cabeceras["Content-Type"]);
        using var respuesta = await Http.SendAsync(put);
        respuesta.StatusCode.ShouldBe(HttpStatusCode.OK);
        var adjunto = await ApiAsync<AdjuntoDeEvaluacionDto>("POST", $"{rutaEvaluacion}/adjuntos/{inicio.CargaId}/confirmar", credencial(),
            new ConfirmarAdjuntoDeEvaluacionDto("certificado.pdf"), 200);
        adjunto.Nombre.ShouldBe("certificado.pdf");
        return adjunto.Id;
    }

    // ---------- autoevaluación del tercero ----------

    [Fact]
    public async Task La_autoevaluacion_del_tercero_bloquea_el_cierre_hasta_que_se_recalifica_y_el_tercero_nunca_ve_el_resultado()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);
        var cuestionario = await CuestionarioPublicadoAsync(norte, "AUTOEVAL", "Tercero");
        await PedirEvaluacionesAsync(e, new EvaluacionRequeridaDto(cuestionario.Id, "Bloquear"));
        var (vinculo, sesion, expedienteId) = await ProveedorEnRevisionAsync(e);

        // Las áreas aprueban, pero el expediente espera la evaluación: no se aprueba (CE-8) y dice que falta eso, no cumplimiento.
        await EsperarAsync(e.Norte, expedienteId, x => x.Estado == "EnRevision");
        await AprobarAreasAsync(e, expedienteId);
        var esperando = await ExpedienteDeAsync(e.Norte, expedienteId);
        esperando.Estado.ShouldBe("EnRevision");
        esperando.EsperandoEvaluaciones.ShouldBeTrue();
        esperando.EsperandoVerificaciones.ShouldBeFalse();
        var delExpediente = esperando.Evaluaciones!.ShouldHaveSingleItem();
        (delExpediente.Estado, delExpediente.Efecto, delExpediente.Responde).ShouldBe(("Pendiente", "Bloquear", "Tercero"));

        // El tercero la ve en su expediente y en su vínculo, con las preguntas pero sin puntajes, pesos, eliminatorias ni umbral.
        var publico = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200);
        var pendiente = publico.Evaluaciones!.ShouldHaveSingleItem();
        pendiente.Estado.ShouldBe("Pendiente");
        (await TerceroAsync<List<EvaluacionPublicaResumenDto>>("GET", $"/public/v1/vinculos/{vinculo.Id}/evaluaciones", sesion.AccessToken, null, 200))
            .ShouldHaveSingleItem().Id.ShouldBe(pendiente.Id);
        var ruta = $"/public/v1/vinculos/{vinculo.Id}/evaluaciones/{pendiente.Id}";
        var cuerpo = await (await TerceroAsync("GET", ruta, sesion.AccessToken, null, 200)).ReadAsTextAsync();
        foreach (var prohibido in new[] { "puntaje", "peso", "elimina", "eliminatoria", "umbral", "rangos", "minimoAceptable" })
            cuerpo.ShouldNotContain($"\"{prohibido}\"", Case.Insensitive);
        var formulario = JsonSerializer.Deserialize<EvaluacionPublicaDto>(cuerpo, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        formulario.Estado.ShouldBe("Pendiente");
        formulario.Secciones.SelectMany(s => s.Preguntas).Select(p => p.Codigo).ShouldBe(["P1", "P2", "P3", "P4"]);

        // Un evaluador interno no puede responder lo que le toca al tercero.
        var intento = await ApiAsync("POST", $"/api/v1/evaluaciones/{pendiente.Id}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(RespuestasBuenas), 403);
        (await CodigoAsync(intento)).ShouldBe("responde-otro");

        // Responde «no» a la eliminatoria: queda Enviada y el tercero no ve el veredicto ni el puntaje.
        var visibles = await TerceroAsync<VisibilidadDto>("POST", $"{ruta}/visibilidad", sesion.AccessToken, new ResponderEvaluacionDto(RespuestasEliminadas), 200);
        visibles.Preguntas.ShouldBe(["P1", "P2", "P3", "P4"]);
        var enviada = await TerceroAsync("POST", $"{ruta}/responder", sesion.AccessToken, new ResponderEvaluacionDto(RespuestasEliminadas), 200);
        var textoEnviada = await enviada.ReadAsTextAsync();
        textoEnviada.ShouldContain("\"Enviada\"");
        foreach (var prohibido in new[] { "resultado", "aprobada", "reprobada", "puntaje", "calificaciones" })
            textoEnviada.ShouldNotContain($"\"{prohibido}\"", Case.Insensitive);
        (await CodigoAsync(await TerceroAsync("POST", $"{ruta}/responder", sesion.AccessToken, new ResponderEvaluacionDto(RespuestasBuenas), 409))).ShouldBe("evaluacion-no-pendiente");

        // La empresa sí ve el resultado: 70 de puntaje (alcanza el umbral), pero reprobada por la eliminatoria; el expediente sigue esperando.
        var evaluacion = await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{pendiente.Id}", Admin(norte), null, 200);
        evaluacion.Estado.ShouldBe("Calificada");
        evaluacion.Resultado!.Puntaje.ShouldBe(70m);
        evaluacion.Resultado.Aprobada.ShouldBeFalse();
        evaluacion.Resultado.Motivos.ShouldBe(["Eliminatoria"]);
        evaluacion.Resultado.Eliminatorias.ShouldBe(["P1"]);
        evaluacion.RespondidaPor!.Tipo.ShouldBe("Tercero");
        evaluacion.Cuestionario.Version.ShouldBe(1);
        evaluacion.Folio.ShouldBe(esperando.Folio);
        var reprobada = await ExpedienteDeAsync(e.Norte, expedienteId);
        reprobada.Estado.ShouldBe("EnRevision");
        reprobada.Evaluaciones!.ShouldHaveSingleItem().Estado.ShouldBe("Reprobada");
        var publicoDespues = await (await TerceroAsync("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200)).ReadAsTextAsync();
        publicoDespues.ShouldNotContain("Reprobada");

        // Recalificar exige justificación; con ella (y un revisor que levanta la eliminatoria) el expediente se aprueba en la misma transacción.
        var ajustes = new RecalificarEvaluacionDto("", [new AjusteDto("P1", 100, true)]);
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/evaluaciones/{pendiente.Id}/recalificar", Delegado(norte, e.Carlos), ajustes, 422))).ShouldBe("justificacion-requerida");
        var recalificada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/evaluaciones/{pendiente.Id}/recalificar", Delegado(norte, e.Carlos),
            ajustes with { Justificacion = "Mostró la certificación vigente en la visita." }, 200);
        recalificada.Resultado!.Aprobada.ShouldBeTrue();
        recalificada.Resultado.Eliminatorias.ShouldBeEmpty();
        recalificada.Calificaciones.Select(c => (c.Numero, c.Origen, c.Resultado.Aprobada)).ShouldBe([(1, "Respuesta", false), (2, "Recalificacion", true)]);
        recalificada.Calificaciones[1].Por.Nombre.ShouldBe(e.Carlos.Usuario.Nombre);
        recalificada.Calificaciones[1].Justificacion.ShouldBe("Mostró la certificación vigente en la visita.");
        var aprobado = await ExpedienteDeAsync(e.Norte, expedienteId);
        aprobado.Estado.ShouldBe("Aprobado");
        aprobado.EsperandoEvaluaciones.ShouldBeFalse();
        (await ApiAsync<CertificadoDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/certificado", Admin(e.Norte), null, 200)).Actual!.Estado.ShouldBe("Vigente");
        (await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{pendiente.Id}", Admin(norte), null, 200)).Respuestas
            .Select(r => (r.Pregunta, string.Join("|", r.Opciones ?? []), r.Numero)).ShouldBe([("P1", "no", null), ("P2", "mas3", null), ("P3", "", 5m)]); // lo respondido no se toca
    }

    // ---------- evaluador interno ----------

    [Fact]
    public async Task El_evaluador_interno_responde_con_su_evidencia_una_reprobada_que_solo_observa_no_frena_y_el_tercero_no_la_ve()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);
        var cuestionario = await CuestionarioPublicadoAsync(norte, "VISITA", "Evaluador");
        await PedirEvaluacionesAsync(e, new EvaluacionRequeridaDto(cuestionario.Id, "Observar"));
        var (vinculo, sesion, expedienteId) = await ProveedorEnRevisionAsync(e);
        var pendiente = (await ExpedienteDeAsync(e.Norte, expedienteId)).Evaluaciones!.ShouldHaveSingleItem();
        pendiente.Responde.ShouldBe("Evaluador");
        var ruta = $"/api/v1/evaluaciones/{pendiente.EvaluacionId}";

        // Solo una persona responde: la llave sola no; el tercero ni la ve.
        (await CodigoAsync(await ApiAsync("POST", $"{ruta}/responder", Admin(norte), new ResponderEvaluacionDto(RespuestasBuenas), 422))).ShouldBe("usuario-delegado-requerido");
        (await TerceroAsync<List<EvaluacionPublicaResumenDto>>("GET", $"/public/v1/vinculos/{vinculo.Id}/evaluaciones", sesion.AccessToken, null, 200)).ShouldBeEmpty();
        (await CodigoAsync(await TerceroAsync("GET", $"/public/v1/vinculos/{vinculo.Id}/evaluaciones/{pendiente.EvaluacionId}", sesion.AccessToken, null, 404))).ShouldBe("evaluacion-no-encontrada");
        (await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200)).Evaluaciones!.ShouldBeEmpty();

        // La visibilidad y los errores de la respuesta.
        (await ApiAsync<VisibilidadDto>("POST", $"{ruta}/visibilidad", Delegado(norte, e.Laura), new ResponderEvaluacionDto([new("P1", ["si"])]), 200)).Preguntas.Count.ShouldBe(4);
        (await CodigoAsync(await ApiAsync("POST", $"{ruta}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto([new("P1", ["si"])]), 422))).ShouldBe("pregunta-obligatoria");
        (await CodigoAsync(await ApiAsync("POST", $"{ruta}/responder", Delegado(norte, e.Laura),
            new ResponderEvaluacionDto([.. RespuestasBuenas, new RespuestaDto("P4", Adjuntos: [Guid.NewGuid()])]), 422))).ShouldBe("adjunto-invalido");

        // La evidencia se sube a la evaluación (privada de la empresa) y se cita en la respuesta.
        var contenido = Pdf("Certificación ISO");
        var archivoId = await SubirEvidenciaAsync(ruta, () => Delegado(norte, e.Laura), contenido);
        var respondida = await ApiAsync<EvaluacionDto>("POST", $"{ruta}/responder", Delegado(norte, e.Laura),
            new ResponderEvaluacionDto([new("P1", ["no"]), new("P2", ["mas3"]), new("P3", Numero: 5), new("P4", Adjuntos: [archivoId])]), 200);
        respondida.Resultado!.Aprobada.ShouldBeFalse();
        respondida.RespondidaPor!.Nombre.ShouldBe(e.Laura.Usuario.Nombre);
        respondida.Adjuntos.ShouldHaveSingleItem().Id.ShouldBe(archivoId);
        var descarga = await ApiAsync<DescargaEvidenciaDto>("POST", $"{ruta}/adjuntos/{archivoId}/descarga", Delegado(norte, e.Laura), null, 200);
        (await Http.GetByteArrayAsync(descarga.Url)).ShouldBe(contenido);
        (await CodigoAsync(await ApiAsync("POST", $"{ruta}/adjuntos/{Guid.NewGuid()}/descarga", Delegado(norte, e.Laura), null, 404))).ShouldBe("adjunto-no-encontrado");

        // «Observar»: la reprobada queda a la vista en el expediente pero no frena su aprobación.
        var observada = await ExpedienteDeAsync(e.Norte, expedienteId);
        observada.Evaluaciones!.ShouldHaveSingleItem().Estado.ShouldBe("Reprobada");
        await AprobarAreasAsync(e, expedienteId);
        var aprobado = await ExpedienteDeAsync(e.Norte, expedienteId);
        aprobado.Estado.ShouldBe("Aprobado");
        aprobado.Evaluaciones!.ShouldHaveSingleItem().Estado.ShouldBe("Reprobada");

        // Reabrir devuelve a pendiente (con justificación) y se responde de nuevo; el historial conserva la primera calificación.
        (await CodigoAsync(await ApiAsync("POST", $"{ruta}/reabrir", Delegado(norte, e.Carlos), new JustificacionDto(" "), 422))).ShouldBe("justificacion-requerida");
        var reabierta = await ApiAsync<EvaluacionDto>("POST", $"{ruta}/reabrir", Delegado(norte, e.Carlos), new JustificacionDto("Se equivocó de respuesta."), 200);
        reabierta.Estado.ShouldBe("Pendiente");
        // Un puntaje bajo el umbral (sin eliminatoria) reprueba por ese motivo: Legal = (100 + 0)/2 = 50 y Operación = 0 dan 30.
        var baja = await ApiAsync<EvaluacionDto>("POST", $"{ruta}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(RespuestasBajas), 200);
        baja.Resultado!.Puntaje.ShouldBe(30m);
        baja.Resultado.Aprobada.ShouldBeFalse();
        baja.Resultado.Motivos.ShouldBe(["BajoElUmbral"]);
        baja.Resultado.Eliminatorias.ShouldBeEmpty();
        await ApiAsync<EvaluacionDto>("POST", $"{ruta}/reabrir", Delegado(norte, e.Carlos), new JustificacionDto("Se corrige tras la segunda visita."), 200);
        var segunda = await ApiAsync<EvaluacionDto>("POST", $"{ruta}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(RespuestasBuenas), 200);
        segunda.Resultado!.Aprobada.ShouldBeTrue();
        segunda.Intentos.ShouldBe(3);
        segunda.Calificaciones.Select(c => c.Resultado.Puntaje).ShouldBe([70m, 30m, 100m]);
    }

    // ---------- privacidad ----------

    [Fact]
    public async Task Las_evaluaciones_y_los_cuestionarios_son_privados_de_la_empresa_otra_del_grupo_otro_grupo_y_otro_tercero_reciben_404()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);
        var cuestionario = await CuestionarioPublicadoAsync(norte, "PRIVADO", "Tercero");
        await PedirEvaluacionesAsync(e, new EvaluacionRequeridaDto(cuestionario.Id));
        var (vinculo, sesion, _) = await ProveedorEnRevisionAsync(e);
        var evaluacion = (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", $"/api/v1/evaluaciones?vinculoId={vinculo.Id}", Admin(norte), null, 200)).Datos.ShouldHaveSingleItem();
        evaluacion.Efecto.ShouldBe("Bloquear"); // sin efecto indicado, el flujo bloquea

        // Otro grupo: ni el detalle, ni la lista, ni el cuestionario, ni el informe.
        var sur = await ConEvaluacionesAsync(await EmpresaNuevaAsync("Sur S.A.S.", "SUR"));
        (await CodigoAsync(await ApiAsync("GET", $"/api/v1/evaluaciones/{evaluacion.Id}", Admin(sur), null, 404))).ShouldBe("evaluacion-no-encontrada");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/evaluaciones/{evaluacion.Id}/anular", Admin(sur), new JustificacionDto("x"), 404))).ShouldBe("evaluacion-no-encontrada");
        (await CodigoAsync(await ApiAsync("GET", $"/api/v1/cuestionarios/{cuestionario.Id}", Admin(sur), null, 404))).ShouldBe("cuestionario-no-encontrado");
        (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", "/api/v1/evaluaciones", Admin(sur), null, 200)).Datos.ShouldBeEmpty();
        (await ApiAsync<InformeEvaluacionesDto>("GET", "/api/v1/informes/evaluaciones", Admin(sur), null, 200)).Resumen.Total.ShouldBe(0);

        // Otra empresa del mismo grupo (las decisiones son privadas por empresa interna, ADR-0008).
        var hermana = await ApiAsync<EmpresaDto>("POST", "/api/v1/empresas", new Credencial(norte.Admin),
            new CrearEmpresaDto(new IdentificacionDto("CO", "NIT", "900123456-8"), "Norte Hermana S.A.S.", "NHE", null, null), 201);
        var comoHermana = new Credencial(norte.Admin, hermana.Id);
        (await CodigoAsync(await ApiAsync("GET", $"/api/v1/evaluaciones/{evaluacion.Id}", comoHermana, null, 404))).ShouldBe("evaluacion-no-encontrada");
        (await CodigoAsync(await ApiAsync("GET", $"/api/v1/cuestionarios/{cuestionario.Id}", comoHermana, null, 404))).ShouldBe("cuestionario-no-encontrado");
        (await ApiAsync<List<CuestionarioDto>>("GET", "/api/v1/cuestionarios", comoHermana, null, 200)).ShouldBeEmpty();
        (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", "/api/v1/evaluaciones", comoHermana, null, 200)).Datos.ShouldBeEmpty();
        (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", "/api/v1/evaluaciones", Admin(norte), null, 200)).Datos.Count.ShouldBe(1);

        // Otro tercero con su propia sesión: no entra al vínculo ajeno ni a la evaluación ajena desde el suyo.
        var correoAjeno = CorreoNuevo();
        var ajeno = await CrearVinculoAsync(e.Norte, "PROVEEDOR", correoAjeno);
        var sesionAjena = await SesionAsync(correoAjeno);
        (await CodigoAsync(await TerceroAsync("GET", $"/public/v1/vinculos/{vinculo.Id}/evaluaciones", sesionAjena.AccessToken, null, 404))).ShouldBe("vinculo-no-encontrado");
        (await CodigoAsync(await TerceroAsync("GET", $"/public/v1/vinculos/{ajeno.Id}/evaluaciones/{evaluacion.Id}", sesionAjena.AccessToken, null, 404))).ShouldBe("evaluacion-no-encontrada");
        (await CodigoAsync(await TerceroAsync("POST", $"/public/v1/vinculos/{ajeno.Id}/evaluaciones/{evaluacion.Id}/responder", sesionAjena.AccessToken,
            new ResponderEvaluacionDto(RespuestasBuenas), 404))).ShouldBe("evaluacion-no-encontrada");
        // Y el dueño sí la ve.
        (await TerceroAsync<List<EvaluacionPublicaResumenDto>>("GET", $"/public/v1/vinculos/{vinculo.Id}/evaluaciones", sesion.AccessToken, null, 200)).ShouldHaveSingleItem();
    }

    // ---------- cuestionarios: versiones, validación y permisos ----------

    [Fact]
    public async Task El_cuestionario_se_versiona_la_publicada_queda_congelada_y_la_evaluacion_conserva_la_version_que_copio()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);

        // Solo el administrador configura (CE-1); quien revisa no.
        await ApiAsync("POST", "/api/v1/cuestionarios", Delegado(norte, e.Laura), new CrearCuestionarioDto("NO_PUEDE", "No puede", DefinicionDeEvaluacion("Tercero")), 403);

        // Validación al crear, con la pregunta que falla.
        var invalida = DefinicionDeEvaluacion("Tercero") with { UmbralDeAprobacion = 120 };
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/cuestionarios", Admin(norte), new CrearCuestionarioDto("INVALIDO", "Inválido", invalida), 422))).ShouldBe("umbral-invalido");
        var sinCriterio = DefinicionDeEvaluacion("Tercero");
        sinCriterio = sinCriterio with
        {
            Secciones = [sinCriterio.Secciones[0] with { Preguntas = [sinCriterio.Secciones[0].Preguntas[0] with { Opciones = [new("si", "Sí", 10), new("no", "No", 0)] }, sinCriterio.Secciones[0].Preguntas[1]] }, sinCriterio.Secciones[1]]
        };
        var rechazo = await ApiAsync("POST", "/api/v1/cuestionarios", Admin(norte), new CrearCuestionarioDto("INVALIDO", "Inválido", sinCriterio), 422);
        (await CodigoAsync(rechazo)).ShouldBe("eliminatoria-sin-criterio");
        (await rechazo.ReadAsJsonAsync<JsonElement>()).GetProperty("pregunta").GetString().ShouldBe("P1");

        var publicado = await CuestionarioPublicadoAsync(norte, "VERSIONADO", "Evaluador");
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/cuestionarios", Admin(norte), new CrearCuestionarioDto("versionado", "Otro", DefinicionDeEvaluacion("Tercero")), 409)))
            .ShouldBe("cuestionario-duplicado");
        (await ApiAsync<List<CuestionarioDto>>("GET", "/api/v1/cuestionarios", Admin(norte), null, 200)).ShouldHaveSingleItem().Codigo.ShouldBe("VERSIONADO");

        // Un flujo no puede pedir uno sin versión publicada ni uno que no existe.
        var borrador = await ApiAsync<CuestionarioDto>("POST", "/api/v1/cuestionarios", Admin(norte),
            new CrearCuestionarioDto("SIN_PUBLICAR", "Sin publicar", DefinicionDeEvaluacion("Tercero")), 201);
        (await CodigoAsync(await ApiAsync("PUT", $"/api/v1/flujos/{e.Flujo.Id}", Admin(norte), new EditarFlujoDto(Evaluaciones: [new EvaluacionRequeridaDto(borrador.Id)]), 422)))
            .ShouldBe("cuestionario-sin-publicar");
        (await CodigoAsync(await ApiAsync("PUT", $"/api/v1/flujos/{e.Flujo.Id}", Admin(norte), new EditarFlujoDto(Evaluaciones: [new EvaluacionRequeridaDto(Guid.NewGuid())]), 422)))
            .ShouldBe("cuestionario-invalido");
        (await CodigoAsync(await ApiAsync("PUT", $"/api/v1/flujos/{e.Flujo.Id}", Admin(norte),
            new EditarFlujoDto(Evaluaciones: [new EvaluacionRequeridaDto(publicado.Id, "Quizas")]), 422))).ShouldBe("efecto-invalido");

        // Una evaluación asignada copia la v1.
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", CorreoNuevo());
        var asignada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/evaluaciones", Admin(norte), new AsignarEvaluacionDto(publicado.Id), 201);
        asignada.Cuestionario.Version.ShouldBe(1);
        asignada.Motivo.ShouldBe("Manual");
        asignada.Efecto.ShouldBe("Observar");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/vinculos/{vinculo.Id}/evaluaciones", Admin(norte), new AsignarEvaluacionDto(publicado.Id), 409))).ShouldBe("evaluacion-pendiente");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/vinculos/{vinculo.Id}/evaluaciones", Admin(norte), new AsignarEvaluacionDto(borrador.Id), 422))).ShouldBe("cuestionario-sin-publicar");

        // Editar lo publicado abre el borrador v2; publicarlo retira la v1, pero la evaluación sigue con su copia y el umbral de la v1.
        var v2 = await ApiAsync<CuestionarioDto>("PUT", $"/api/v1/cuestionarios/{publicado.Id}", Admin(norte),
            new EditarCuestionarioDto("Evaluación 2027", DefinicionDeEvaluacion("Evaluador", 6, 90)), 200);
        v2.Borrador!.Version.ShouldBe(2);
        v2.Publicada!.Definicion.UmbralDeAprobacion.ShouldBe(70m);
        var publicadaV2 = await ApiAsync<CuestionarioDto>("POST", $"/api/v1/cuestionarios/{publicado.Id}/publicar", Admin(norte), new { }, 200);
        publicadaV2.Publicada!.Version.ShouldBe(2);
        publicadaV2.Publicada.Definicion.UmbralDeAprobacion.ShouldBe(90m);
        var versiones = await ApiAsync<List<CuestionarioVersionDto>>("GET", $"/api/v1/cuestionarios/{publicado.Id}/versiones", Admin(norte), null, 200);
        versiones.Select(v => (v.Version, v.Estado)).ShouldBe([(1, "Retirada"), (2, "Publicada")]);
        (await ApiAsync<CuestionarioVersionDto>("GET", $"/api/v1/cuestionarios/{publicado.Id}/versiones/1", Admin(norte), null, 200)).Definicion.UmbralDeAprobacion.ShouldBe(70m);
        var conservada = await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{asignada.Id}", Admin(norte), null, 200);
        conservada.Cuestionario.Version.ShouldBe(1);
        conservada.Definicion.UmbralDeAprobacion.ShouldBe(70m);
        conservada.Definicion.ReevaluarCadaMeses.ShouldBeNull();

        // La simulación calcula el puntaje con la última versión sin guardar nada.
        var simulacion = await ApiAsync<SimulacionDeCuestionarioDto>("POST", $"/api/v1/cuestionarios/{publicado.Id}/simular", Admin(norte), new SimularCuestionarioDto(RespuestasBuenas), 200);
        (simulacion.Version, simulacion.Resultado.Puntaje, simulacion.Resultado.Aprobada, simulacion.Resultado.Umbral).ShouldBe((2, 100m, true, 90m));
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/cuestionarios/{publicado.Id}/simular", Admin(norte), new SimularCuestionarioDto([new("P1", ["si"])]), 422)))
            .ShouldBe("pregunta-obligatoria");
    }

    // ---------- reevaluación periódica ----------

    [Fact]
    public async Task La_reevaluacion_periodica_vence_la_evaluacion_aprobada_y_asigna_una_nueva_una_sola_vez()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);
        var cuestionario = await CuestionarioPublicadoAsync(norte, "ANUAL", "Evaluador", meses: 12);
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", CorreoNuevo());
        var asignada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/evaluaciones", Admin(norte), new AsignarEvaluacionDto(cuestionario.Id), 201);

        var reprobada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/evaluaciones/{asignada.Id}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(RespuestasEliminadas), 200);
        reprobada.VigenteHasta.ShouldBeNull(); // una reprobada no se repite: hay que corregirla
        await ApiAsync<EvaluacionDto>("POST", $"/api/v1/evaluaciones/{asignada.Id}/reabrir", Delegado(norte, e.Carlos), new JustificacionDto("Se reevalúa tras la visita."), 200);
        var aprobada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/evaluaciones/{asignada.Id}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(RespuestasBuenas), 200);
        aprobada.Resultado!.Aprobada.ShouldBeTrue();
        var vigenteHasta = aprobada.VigenteHasta.ShouldNotBeNull();
        vigenteHasta.ShouldBeInRange(DateTimeOffset.UtcNow.AddMonths(12).AddMinutes(-5), DateTimeOffset.UtcNow.AddMonths(12).AddMinutes(5));

        // Antes de la fecha no pasa nada.
        var antes = await ApiAsync<ResultadoRevisionReevaluacionesDto>("POST", "/api/v1/plataforma/reevaluaciones/revisar", new Credencial(ApiFixture.ClavePlataforma),
            new RevisarReevaluacionesDto(norte.Datos.TenantId, vigenteHasta.AddDays(-1)), 200);
        antes.Revisadas.ShouldBe(0);
        (await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{asignada.Id}", Admin(norte), null, 200)).Estado.ShouldBe("Calificada");

        // Al pasar la fecha vence y se asigna la nueva con la versión publicada de ese momento.
        var despues = await ApiAsync<ResultadoRevisionReevaluacionesDto>("POST", "/api/v1/plataforma/reevaluaciones/revisar", new Credencial(ApiFixture.ClavePlataforma),
            new RevisarReevaluacionesDto(norte.Datos.TenantId, vigenteHasta.AddDays(1)), 200);
        (despues.Revisadas, despues.Vencidas, despues.Asignadas).ShouldBe((1, 1, 1));
        var vencida = await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{asignada.Id}", Admin(norte), null, 200);
        vencida.Estado.ShouldBe("Vencida");
        vencida.Resultado!.Aprobada.ShouldBeTrue(); // lo que se calificó queda como estaba
        var filas = (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", $"/api/v1/evaluaciones?vinculoId={vinculo.Id}", Admin(norte), null, 200)).Datos;
        filas.Select(f => (f.Estado, f.Motivo)).ShouldBe([("Pendiente", "Reevaluacion"), ("Vencida", "Manual")], ignoreOrder: true);
        var nueva = await ApiAsync<EvaluacionDto>("GET", $"/api/v1/evaluaciones/{filas.Single(f => f.Estado == "Pendiente").Id}", Admin(norte), null, 200);
        (nueva.Anterior, nueva.ExpedienteId, nueva.Efecto).ShouldBe(((Guid?)asignada.Id, (Guid?)null, "Observar"));

        // Idempotente: otra pasada no vence ni asigna nada más.
        var otra = await ApiAsync<ResultadoRevisionReevaluacionesDto>("POST", "/api/v1/plataforma/reevaluaciones/revisar", new Credencial(ApiFixture.ClavePlataforma),
            new RevisarReevaluacionesDto(norte.Datos.TenantId, vigenteHasta.AddDays(2)), 200);
        otra.Revisadas.ShouldBe(0);
        (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", $"/api/v1/evaluaciones?vinculoId={vinculo.Id}", Admin(norte), null, 200)).Datos.Count.ShouldBe(2);
    }

    // ---------- informe ----------

    [Fact]
    public async Task El_informe_de_evaluaciones_resume_filtra_y_se_descarga_en_excel_con_el_detalle_por_pregunta()
    {
        var e = await PrepararAsync();
        var norte = await ConEvaluacionesAsync(e.Norte);
        var cuestionario = await CuestionarioPublicadoAsync(norte, "INFORME", "Evaluador");
        var buena = await CrearVinculoAsync(e.Norte, "PROVEEDOR", CorreoNuevo());
        var mala = await CrearVinculoAsync(e.Norte, "PROVEEDOR", CorreoNuevo());
        var pendiente = await CrearVinculoAsync(e.Norte, "PROVEEDOR", CorreoNuevo());
        foreach (var (vinculo, respuestas) in new[] { (buena, RespuestasBuenas), (mala, RespuestasEliminadas), (pendiente, null) })
        {
            var asignada = await ApiAsync<EvaluacionDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/evaluaciones", Admin(norte), new AsignarEvaluacionDto(cuestionario.Id), 201);
            if (respuestas is not null)
                await ApiAsync<EvaluacionDto>("POST", $"/api/v1/evaluaciones/{asignada.Id}/responder", Delegado(norte, e.Laura), new ResponderEvaluacionDto(respuestas), 200);
        }

        var informe = await ApiAsync<InformeEvaluacionesDto>("GET", "/api/v1/informes/evaluaciones", Admin(norte), null, 200);
        (informe.Resumen.Total, informe.Resumen.Pendientes, informe.Resumen.Aprobadas, informe.Resumen.Reprobadas).ShouldBe((3, 1, 1, 1));
        informe.Resumen.PuntajePromedio.ShouldBe(85m); // (100 + 70) / 2
        informe.Filas.Count.ShouldBe(3);
        informe.Filas.Single(f => f.VinculoId == mala.Id).Eliminatorias.ShouldBe(["P1"]);
        informe.Filas.Single(f => f.VinculoId == buena.Id).RespondidaPor.ShouldBe(e.Laura.Usuario.Nombre);

        var soloReprobadas = await ApiAsync<InformeEvaluacionesDto>("GET", $"/api/v1/informes/evaluaciones?estado=Calificada&vinculoId={mala.Id}", Admin(norte), null, 200);
        soloReprobadas.Filas.ShouldHaveSingleItem().Aprobada.ShouldBe(false);
        (await ApiAsync<PaginaDto<EvaluacionResumenDto>>("GET", "/api/v1/evaluaciones?estado=Pendiente", Admin(norte), null, 200)).Datos.ShouldHaveSingleItem().VinculoId.ShouldBe(pendiente.Id);
        (await CodigoAsync(await ApiAsync("GET", "/api/v1/informes/evaluaciones?estado=Nada", Admin(norte), null, 422))).ShouldBe("estado-invalido");
        (await CodigoAsync(await ApiAsync("GET", "/api/v1/informes/evaluaciones?desde=2026-12-31&hasta=2026-01-01", Admin(norte), null, 422))).ShouldBe("rango-invalido");

        var excel = await DescargarAsync("/api/v1/informes/evaluaciones/excel", Admin(norte));
        excel.Estado.ShouldBe(HttpStatusCode.OK);
        excel.Tipo.ShouldBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        Filas(await HojaAsync(excel.Contenido, 1)).ShouldBe(4); // encabezado y las tres evaluaciones
        Filas(await HojaAsync(excel.Contenido, 2)).ShouldBe(9); // encabezado y las 4 preguntas de cada una de las dos calificadas

        // La llave de las pruebas anteriores no trae los permisos de evaluaciones: ni siquiera con un revisor delegado se lee el informe.
        await ApiAsync("GET", "/api/v1/informes/evaluaciones", Delegado(e.Norte, e.Laura), null, 403);
    }
}
