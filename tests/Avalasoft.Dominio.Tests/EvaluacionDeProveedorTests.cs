using System.Text.Json;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Configuracion;
using Avalasoft.Dominio.Evaluaciones;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Flujos;
using Avalasoft.Dominio.Terceros;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Evaluación del proveedor nuevo (CE-3…CE-12): quién responde, resultado inmutable con historial, recalificación con justificación, reapertura, anulación y
/// vencimiento por reevaluación periódica; el cierre del expediente bloqueado por una evaluación (o solo observado) y el flujo que la pide.
/// </summary>
public class EvaluacionDeProveedorTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-5));

    private static readonly ContextoDeExigencia Contexto =
        new(TipoPersona.Juridica, "CO", "NIT", false, "PROVEEDOR", new Dictionary<string, JsonElement>());

    private static readonly ActorDeEvaluacion Tercero = new(ActorTipo.Tercero, "tercero-1", "Aceros S.A.S.");
    private static readonly ActorDeEvaluacion Laura = new(ActorTipo.Usuario, Guid.NewGuid().ToString(), "Laura");
    private static readonly ActorDeEvaluacion Carlos = new(ActorTipo.Usuario, Guid.NewGuid().ToString(), "Carlos");

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    /// <summary>Dos preguntas: P1 sí/no de peso 3 y P2 escala 1–5 de peso 1, un adjunto opcional P3. Umbral 70; se repite cada 12 meses.</summary>
    private static DefinicionDeCuestionario Definicion(QuienResponde responde = QuienResponde.Evaluador, int? meses = 12) => new(
    [
        new SeccionDeCuestionario("S1", "General", 100,
        [
            new PreguntaDeCuestionario("P1", "¿Cumple?", TipoDePregunta.SiNo, true, 3, false,
                [new OpcionDePregunta("si", "Sí", 10), new OpcionDePregunta("no", "No", 0)]),
            new PreguntaDeCuestionario("P2", "Calidad", TipoDePregunta.Escala, true, 1, false, Escala: new EscalaDePregunta(1, 5)),
            new PreguntaDeCuestionario("P3", "Evidencia", TipoDePregunta.Adjunto, false, 0, false)
        ])
    ], 70, responde, meses);

    private static readonly RespuestaDePregunta[] Buenas =
        [new("P1", Opciones: ["si"]), new("P2", Numero: 5)];

    // P1 = sí (100) y P2 = 2 (25): (3·100 + 1·25)/4 = 81,25. Con P1 = no: (0 + 25)/4 = 6,25.
    private static readonly RespuestaDePregunta[] Malas = [new("P1", Opciones: ["no"]), new("P2", Numero: 2)];

    private static EvaluacionDeProveedor Aplicar(EvaluacionDeProveedor? evaluacion, IEnumerable<object> eventos)
    {
        foreach (var evento in eventos)
            switch (evento)
            {
                case EvaluacionAsignada e: evaluacion = EvaluacionDeProveedor.Create(e); break;
                case AdjuntoDeEvaluacionSubido e: evaluacion!.Apply(e); break;
                case EvaluacionRespondida e: evaluacion!.Apply(e); break;
                case EvaluacionRecalificada e: evaluacion!.Apply(e); break;
                case EvaluacionReabierta e: evaluacion!.Apply(e); break;
                case EvaluacionAnulada e: evaluacion!.Apply(e); break;
                case EvaluacionVencida e: evaluacion!.Apply(e); break;
                default: throw new InvalidOperationException(evento.GetType().Name);
            }

        return evaluacion!;
    }

    private static EvaluacionDeProveedor Asignada(QuienResponde responde = QuienResponde.Evaluador, int? meses = 12, Guid? expedienteId = null,
        EfectoDeLaEvaluacion efecto = EfectoDeLaEvaluacion.Bloquear) =>
        Aplicar(null, [EvaluacionDeProveedor.Asignar(Guid.NewGuid(), Guid.NewGuid(), expedienteId, Guid.NewGuid(), "Aceros S.A.S.", "CO|NIT|900123456",
            MotivoDeEvaluacion.Expediente, new CuestionarioDeLaEvaluacion(Guid.NewGuid(), Guid.NewGuid(), 1, "PROVEEDOR_NUEVO", "Proveedor nuevo"), Definicion(responde, meses),
            efecto, null, Ahora)]);

    private static EvaluacionDeProveedor Respondida(QuienResponde responde, RespuestaDePregunta[] respuestas, int? meses = 12)
    {
        var e = Asignada(responde, meses);
        return Aplicar(e, e.Responder(respuestas, Contexto, responde == QuienResponde.Tercero ? Tercero : Laura, Ahora));
    }

    // ---------- Asignar y responder ----------

    [Fact]
    public void La_evaluacion_nace_pendiente_y_copia_el_cuestionario_con_su_version()
    {
        var e = Asignada();

        e.Estado.ShouldBe(EstadoDeEvaluacion.Pendiente);
        e.Cuestionario.Version.ShouldBe(1);
        e.Definicion.Secciones.ShouldHaveSingleItem();
        e.Resultado.ShouldBeNull();
        e.EstadoParaExpediente.ShouldBe(EstadoDeEvaluacionEnExpediente.Pendiente);
        Codigo(() => EvaluacionDeProveedor.Asignar(Guid.NewGuid(), Guid.NewGuid(), null, Guid.NewGuid(), "T", "x", MotivoDeEvaluacion.Manual,
            e.Cuestionario, new DefinicionDeCuestionario([], 70, QuienResponde.Tercero), EfectoDeLaEvaluacion.Observar, null, Ahora)).ShouldBe("cuestionario-invalido");
    }

    [Fact]
    public void Responde_quien_dice_el_cuestionario_y_el_otro_recibe_403()
    {
        var porTercero = Asignada(QuienResponde.Tercero);
        Should.Throw<ReglaDeNegocioException>(() => porTercero.Responder(Buenas, Contexto, Laura, Ahora)).Tipo.ShouldBe(TipoFalla.Prohibido);
        Codigo(() => porTercero.Responder(Buenas, Contexto, Laura, Ahora)).ShouldBe("responde-otro");

        var porEvaluador = Asignada(QuienResponde.Evaluador);
        Codigo(() => porEvaluador.Responder(Buenas, Contexto, Tercero, Ahora)).ShouldBe("responde-otro");

        porTercero = Aplicar(porTercero, porTercero.Responder(Buenas, Contexto, Tercero, Ahora));
        porTercero.Estado.ShouldBe(EstadoDeEvaluacion.Calificada);
        porTercero.RespondidaPor.ShouldBe(Tercero);
        porEvaluador = Aplicar(porEvaluador, porEvaluador.Responder(Buenas, Contexto, Laura, Ahora));
        porEvaluador.RespondidaPor!.Nombre.ShouldBe("Laura");
    }

    [Fact]
    public void Al_responder_queda_el_resultado_inmutable_con_quien_y_cuando()
    {
        var e = Respondida(QuienResponde.Evaluador, Buenas);

        e.Resultado!.Puntaje.ShouldBe(100m);
        e.Resultado.Aprobada.ShouldBeTrue();
        e.RespondidaPor.ShouldBe(Laura);
        e.RespondidaEn.ShouldBe(Ahora);
        e.Intentos.ShouldBe(1);
        e.Calificaciones.ShouldHaveSingleItem().Origen.ShouldBe("Respuesta");
        e.Respuestas.Count.ShouldBe(2);
        e.EstadoParaExpediente.ShouldBe(EstadoDeEvaluacionEnExpediente.Aprobada);

        // Ya no se responde de nuevo: lo calificado solo cambia recalificando o reabriendo, con justificación.
        Codigo(() => e.Responder(Malas, Contexto, Laura, Ahora)).ShouldBe("evaluacion-no-pendiente");
        Codigo(() => e.RegistrarAdjunto(Archivo(Guid.NewGuid()))).ShouldBe("evaluacion-no-pendiente");
    }

    [Fact]
    public void Una_respuesta_invalida_no_cambia_nada()
    {
        var e = Asignada();

        Codigo(() => e.Responder([new RespuestaDePregunta("P1", Opciones: ["si"])], Contexto, Laura, Ahora)).ShouldBe("pregunta-obligatoria");
        Codigo(() => e.Responder([.. Buenas, new RespuestaDePregunta("P9", Numero: 1)], Contexto, Laura, Ahora)).ShouldBe("pregunta-desconocida");
        e.Estado.ShouldBe(EstadoDeEvaluacion.Pendiente);
        e.Resultado.ShouldBeNull();
    }

    private static AdjuntoDeEvaluacion Archivo(Guid id) =>
        new(id, "certificado.pdf", "application/pdf", 1024, new string('a', 64), "tenant-x", $"empresas/x/evaluaciones/{id:N}", Laura, Ahora);

    [Fact]
    public void Un_adjunto_se_responde_con_archivos_ya_subidos_a_la_evaluacion()
    {
        var e = Asignada();
        var archivo = Guid.NewGuid();
        var conAdjunto = (RespuestaDePregunta[])[.. Buenas, new RespuestaDePregunta("P3", Adjuntos: [archivo])];

        Codigo(() => e.Responder(conAdjunto, Contexto, Laura, Ahora)).ShouldBe("adjunto-invalido");

        e = Aplicar(e, [e.RegistrarAdjunto(Archivo(archivo))]);
        e.BuscarAdjunto(archivo).ShouldNotBeNull();
        e = Aplicar(e, e.Responder(conAdjunto, Contexto, Laura, Ahora));
        e.Respuestas.Single(r => r.Pregunta == "P3").Adjuntos.ShouldBe([archivo]);
    }

    // ---------- Reevaluación periódica ----------

    [Fact]
    public void Una_evaluacion_aprobada_con_reevaluacion_vence_a_los_meses_y_una_reprobada_no()
    {
        var aprobada = Respondida(QuienResponde.Evaluador, Buenas);
        aprobada.VigenteHasta.ShouldBe(Ahora.AddMonths(12));
        aprobada.ProximaReevaluacion.ShouldBe(Ahora.AddMonths(12));

        var reprobada = Respondida(QuienResponde.Evaluador, Malas);
        reprobada.Resultado!.Aprobada.ShouldBeFalse();
        reprobada.VigenteHasta.ShouldBeNull();
        reprobada.ProximaReevaluacion.ShouldBeNull();

        var sinRepeticion = Respondida(QuienResponde.Evaluador, Buenas, meses: null);
        sinRepeticion.ProximaReevaluacion.ShouldBeNull();

        aprobada.Vencer(Ahora.AddMonths(12).AddTicks(-1)).ShouldBeEmpty();
        var vencida = Aplicar(aprobada, aprobada.Vencer(Ahora.AddMonths(12)));
        vencida.Estado.ShouldBe(EstadoDeEvaluacion.Vencida);
        vencida.ProximaReevaluacion.ShouldBeNull();
        vencida.Vencer(Ahora.AddYears(5)).ShouldBeEmpty();
        reprobada.Vencer(Ahora.AddYears(5)).ShouldBeEmpty();
        Codigo(() => vencida.Anular("x", Laura, Ahora)).ShouldBe("evaluacion-cerrada");
    }

    // ---------- Recalificar, reabrir y anular ----------

    [Fact]
    public void Recalificar_pide_justificacion_conserva_el_historial_y_cambia_el_veredicto_vigente()
    {
        var e = Respondida(QuienResponde.Evaluador, Malas);
        e.Resultado!.Aprobada.ShouldBeFalse();

        Codigo(() => e.Recalificar([new AjusteDeCalificacion("P1", 100)], null, " ", Carlos, Ahora)).ShouldBe("justificacion-requerida");
        Codigo(() => e.Recalificar([new AjusteDeCalificacion("P1", 100)], null, new string('x', 1001), Carlos, Ahora)).ShouldBe("justificacion-demasiado-larga");
        Codigo(() => e.Recalificar([], null, "Sin cambios.", Carlos, Ahora)).ShouldBe("sin-cambios");
        Codigo(() => e.Recalificar([new AjusteDeCalificacion("P9", 10)], null, "Pregunta inexistente.", Carlos, Ahora)).ShouldBe("pregunta-desconocida");

        // El revisor sube P1 a 100 (el soporte que mostró el proveedor lo respalda): (3·100 + 25)/4 = 81,25.
        var eventos = e.Recalificar([new AjusteDeCalificacion("P1", 100)], null, "El proveedor mostró el certificado en la visita.", Carlos, Ahora.AddDays(1));
        e = Aplicar(e, eventos);

        e.Resultado!.Puntaje.ShouldBe(81.25m);
        e.Resultado.Aprobada.ShouldBeTrue();
        e.Recalificaciones.ShouldBe(1);
        e.Justificacion.ShouldBe("El proveedor mostró el certificado en la visita.");
        e.Calificaciones.Select(c => (c.Numero, c.Origen, c.Resultado.Puntaje, c.Resultado.Aprobada)).ShouldBe(
            [(1, "Respuesta", 6.25m, false), (2, "Recalificacion", 81.25m, true)]);
        e.Calificaciones[1].Por.ShouldBe(Carlos);
        e.Calificaciones[1].Fecha.ShouldBe(Ahora.AddDays(1));
        e.Respuestas.Single(r => r.Pregunta == "P1").Opciones.ShouldBe(["no"]); // lo respondido no se toca
        e.RespondidaPor.ShouldBe(Laura);
        e.VigenteHasta.ShouldBe(Ahora.AddMonths(12)); // la vigencia cuenta desde la respuesta
        e.EstadoParaExpediente.ShouldBe(EstadoDeEvaluacionEnExpediente.Aprobada);

        // Recalificar de nuevo reemplaza el conjunto de ajustes; repetir el mismo no cambia nada.
        Codigo(() => e.Recalificar([new AjusteDeCalificacion("P1", 100)], null, "Otra vez.", Carlos, Ahora)).ShouldBe("sin-cambios");
        e = Aplicar(e, e.Recalificar([], null, "Se deshace el ajuste.", Carlos, Ahora.AddDays(2)));
        e.Resultado!.Aprobada.ShouldBeFalse();
        e.Ajustes.ShouldBeEmpty();
        e.VigenteHasta.ShouldBeNull();
    }

    [Fact]
    public void El_veredicto_se_puede_fijar_a_mano_y_queda_marcado_como_no_calculado()
    {
        var e = Respondida(QuienResponde.Evaluador, Malas);

        e = Aplicar(e, e.Recalificar([], true, "Aprobación excepcional autorizada por la gerencia.", Carlos, Ahora));

        e.Resultado!.Aprobada.ShouldBeTrue();
        e.Resultado.Calculada.ShouldBeFalse();
        e.Resultado.Motivos.ShouldBe([ResultadoDeEvaluacion.BajoElUmbral]);
        e.Resultado.Puntaje.ShouldBe(6.25m);
        Codigo(() => e.Recalificar([], true, "Lo mismo.", Carlos, Ahora)).ShouldBe("sin-cambios");
    }

    [Fact]
    public void Solo_se_recalifica_o_reabre_una_evaluacion_calificada()
    {
        var pendiente = Asignada();
        Codigo(() => pendiente.Recalificar([new AjusteDeCalificacion("P1", 100)], null, "x", Carlos, Ahora)).ShouldBe("evaluacion-no-calificada");
        Codigo(() => pendiente.Reabrir("x", Carlos, Ahora)).ShouldBe("evaluacion-no-calificada");
    }

    [Fact]
    public void Reabrir_devuelve_a_pendiente_y_conserva_las_respuestas_y_el_resultado_anteriores_en_el_historial()
    {
        var e = Respondida(QuienResponde.Tercero, Malas);

        Codigo(() => e.Reabrir(null, Carlos, Ahora)).ShouldBe("justificacion-requerida");
        e = Aplicar(e, e.Reabrir("Se equivocó al responder; se le da otra oportunidad.", Carlos, Ahora.AddDays(1)));

        e.Estado.ShouldBe(EstadoDeEvaluacion.Pendiente);
        e.EstadoParaExpediente.ShouldBe(EstadoDeEvaluacionEnExpediente.Pendiente);
        e.Calificaciones.ShouldHaveSingleItem(); // el historial no se borra
        e.ProximaReevaluacion.ShouldBeNull();

        e = Aplicar(e, e.Responder(Buenas, Contexto, Tercero, Ahora.AddDays(2)));
        e.Resultado!.Aprobada.ShouldBeTrue();
        e.Intentos.ShouldBe(2);
        e.Calificaciones.Select(c => c.Resultado.Puntaje).ShouldBe([6.25m, 100m]);
    }

    [Fact]
    public void Anular_deja_la_evaluacion_sin_efecto_con_justificacion()
    {
        var e = Asignada();
        Codigo(() => e.Anular(" ", Carlos, Ahora)).ShouldBe("justificacion-requerida");

        e = Aplicar(e, e.Anular("Ya no se exige para este proveedor.", Carlos, Ahora));

        e.Estado.ShouldBe(EstadoDeEvaluacion.Anulada);
        e.EstadoParaExpediente.ShouldBe(EstadoDeEvaluacionEnExpediente.Anulada);
        Codigo(() => e.Responder(Buenas, Contexto, Laura, Ahora)).ShouldBe("evaluacion-no-pendiente");
        Codigo(() => e.Anular("otra vez", Carlos, Ahora)).ShouldBe("evaluacion-cerrada");
    }

    // ---------- El expediente espera la evaluación ----------

    private readonly Guid _area = Guid.NewGuid();
    private readonly Revisor _ana = new(Guid.NewGuid(), null);

    private static EvaluacionRequeridaPorElFlujo Requerida(EfectoDeLaEvaluacion efecto, QuienResponde responde = QuienResponde.Tercero) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "PROVEEDOR_NUEVO", "Proveedor nuevo", responde, efecto);

    private Expediente Abrir(TipoExpediente tipo = TipoExpediente.Inicial, params EvaluacionRequeridaPorElFlujo[] evaluaciones) =>
        Expediente.Reproducir(null, Expediente.Abrir(
            new DatosDeApertura(Guid.NewGuid(), Guid.NewGuid(), tipo, "NORTE-E-2026-000001", Guid.NewGuid(), "Aceros S.A.S.", "CO|NIT|900123456", Guid.NewGuid(),
                "PROVEEDOR", "Proveedor", new ActorDeExpediente(ActorTipo.Tercero, "tercero"), []),
            new FlujoParaExpediente(Guid.NewGuid(), Guid.NewGuid(), "HAB", "Habilitación", 1, OrigenFlujo.PorDefecto,
                [new EtapaDelFlujo(1, [new AreaDelFlujo(_area, "COMPRAS", "Compras", 1, true, false, null)])], PoliticaDevolucion.Inmediata, false,
                Evaluaciones: evaluaciones), Ahora));

    private static Expediente Reproducir(Expediente e, IReadOnlyList<object> eventos) => Expediente.Reproducir(e, eventos);

    [Fact]
    public void El_flujo_copia_las_evaluaciones_al_expediente_inicial_y_las_demas_clases_de_expediente_no_las_piden()
    {
        var bloquea = Requerida(EfectoDeLaEvaluacion.Bloquear);

        var inicial = Abrir(TipoExpediente.Inicial, bloquea);
        var copiada = inicial.Evaluaciones.ShouldHaveSingleItem();
        (copiada.EvaluacionId, copiada.Estado, copiada.Efecto, copiada.Responde).ShouldBe(
            (bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Pendiente, EfectoDeLaEvaluacion.Bloquear, QuienResponde.Tercero));

        Abrir(TipoExpediente.Renovacion, bloquea).Evaluaciones.ShouldBeEmpty();
        Abrir(TipoExpediente.Actualizacion, bloquea).Evaluaciones.ShouldBeEmpty();
        Abrir().Evaluaciones.ShouldBeEmpty();
    }

    [Fact]
    public void Una_evaluacion_que_bloquea_impide_aprobar_aunque_el_area_apruebe_y_al_aprobarse_se_cierra()
    {
        var bloquea = Requerida(EfectoDeLaEvaluacion.Bloquear);
        var e = Abrir(TipoExpediente.Inicial, bloquea);
        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));

        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        e.EsperandoVerificaciones.ShouldBeTrue();
        e.EsperandoEvaluaciones.ShouldBeTrue();
        e.EvaluacionesSatisfechas.ShouldBeFalse();

        // Reprobada: sigue esperando.
        e = Reproducir(e, e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Reprobada, 40m, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        e.BuscarEvaluacion(bloquea.EvaluacionId)!.Puntaje.ShouldBe(40m);

        // Recalificada como aprobada: la misma cascada cierra el expediente.
        var eventos = e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Aprobada, 82m, Ahora);
        eventos.Select(x => x.GetType().Name).ShouldBe(["EvaluacionDelExpedienteActualizada", "ExpedienteAprobado"]);
        e = Reproducir(e, eventos);
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
        e.EsperandoEvaluaciones.ShouldBeFalse();
    }

    [Fact]
    public void Si_la_evaluacion_se_aprueba_antes_que_las_areas_el_cierre_lo_decide_la_ultima_area()
    {
        var bloquea = Requerida(EfectoDeLaEvaluacion.Bloquear);
        var e = Abrir(TipoExpediente.Inicial, bloquea);

        e = Reproducir(e, e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Aprobada, 90m, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);

        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
    }

    [Fact]
    public void Una_evaluacion_con_efecto_observar_no_frena_el_cierre_pero_deja_la_observacion()
    {
        var observa = Requerida(EfectoDeLaEvaluacion.Observar);
        var e = Abrir(TipoExpediente.Inicial, observa);

        e = Reproducir(e, e.ActualizarEvaluacion(observa.EvaluacionId, EstadoDeEvaluacionEnExpediente.Reprobada, 30m, Ahora));
        e.ConEvaluacionObservada.ShouldBeTrue();
        e.EvaluacionesSatisfechas.ShouldBeTrue();

        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
        e.ConEvaluacionObservada.ShouldBeTrue();
    }

    [Fact]
    public void Anular_la_evaluacion_libera_el_cierre()
    {
        var bloquea = Requerida(EfectoDeLaEvaluacion.Bloquear);
        var e = Abrir(TipoExpediente.Inicial, bloquea);
        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));

        e = Reproducir(e, e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Anulada, null, Ahora));

        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
    }

    [Fact]
    public void Reabrir_una_evaluacion_aprobada_antes_del_cierre_vuelve_a_frenarlo_y_lo_repetido_no_produce_eventos()
    {
        var bloquea = Requerida(EfectoDeLaEvaluacion.Bloquear);
        var e = Abrir(TipoExpediente.Inicial, bloquea);
        e = Reproducir(e, e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Aprobada, 90m, Ahora));
        e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Aprobada, 90m, Ahora).ShouldBeEmpty();

        e = Reproducir(e, e.ActualizarEvaluacion(bloquea.EvaluacionId, EstadoDeEvaluacionEnExpediente.Pendiente, null, Ahora));
        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        e.EsperandoEvaluaciones.ShouldBeTrue();

        e.ActualizarEvaluacion(Guid.NewGuid(), EstadoDeEvaluacionEnExpediente.Aprobada, 1m, Ahora).ShouldBeEmpty();
    }

    [Fact]
    public void Un_expediente_cerrado_no_cambia_por_una_evaluacion_que_llega_tarde()
    {
        var observa = Requerida(EfectoDeLaEvaluacion.Observar);
        var e = Abrir(TipoExpediente.Inicial, observa);
        e = Reproducir(e, e.EmitirVeredicto(_area, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);

        e.ActualizarEvaluacion(observa.EvaluacionId, EstadoDeEvaluacionEnExpediente.Reprobada, 10m, Ahora).ShouldBeEmpty();
    }

    // ---------- El flujo pide el cuestionario ----------

    private static Cuestionario Publicado(Guid empresa, string codigo = "PROVEEDOR_NUEVO", bool publicar = true)
    {
        var cuestionario = Cuestionario.Crear(empresa, codigo, "Proveedor nuevo", Definicion(), Ahora);
        if (publicar)
            cuestionario.Publicar(Ahora);
        return cuestionario;
    }

    [Fact]
    public void El_flujo_valida_los_cuestionarios_que_pide_y_los_congela_al_publicar()
    {
        var empresa = Guid.NewGuid();
        var area = Area.Crear(empresa, "COMPRAS", "Compras");
        var cuestionario = Publicado(empresa);
        var otro = Publicado(empresa, "OTRO");
        var sinPublicar = Publicado(empresa, "BORRADOR", publicar: false);
        var ajeno = Publicado(Guid.NewGuid(), "AJENO");
        var todos = new[] { cuestionario, otro, sinPublicar, ajeno };
        var basica = DefinicionDeFlujo.TodasEnParalelo([area]);

        string CodigoDe(params EvaluacionRequeridaDelFlujo[] pedidas) => Should.Throw<ReglaDeNegocioException>(() =>
            (basica with { Evaluaciones = pedidas }).Validar(empresa, [area], null, null, todos)).Codigo;

        CodigoDe(new EvaluacionRequeridaDelFlujo(Guid.NewGuid(), EfectoDeLaEvaluacion.Bloquear)).ShouldBe("cuestionario-invalido");
        CodigoDe(new EvaluacionRequeridaDelFlujo(ajeno.Id, EfectoDeLaEvaluacion.Bloquear)).ShouldBe("cuestionario-invalido"); // de otra empresa
        CodigoDe(new EvaluacionRequeridaDelFlujo(sinPublicar.Id, EfectoDeLaEvaluacion.Bloquear)).ShouldBe("cuestionario-sin-publicar");
        CodigoDe(new EvaluacionRequeridaDelFlujo(cuestionario.Id, EfectoDeLaEvaluacion.Bloquear), new EvaluacionRequeridaDelFlujo(cuestionario.Id, EfectoDeLaEvaluacion.Observar))
            .ShouldBe("evaluacion-duplicada");
        CodigoDe(new EvaluacionRequeridaDelFlujo(cuestionario.Id, (EfectoDeLaEvaluacion)9)).ShouldBe("efecto-invalido");
        Should.Throw<ReglaDeNegocioException>(() => (basica with { Evaluaciones = [new EvaluacionRequeridaDelFlujo(cuestionario.Id, EfectoDeLaEvaluacion.Bloquear)] })
            .Validar(empresa, [area])).Codigo.ShouldBe("cuestionario-invalido"); // sin la lista de cuestionarios no se puede comprobar

        var flujo = Flujo.Crear(empresa, "HAB", "Habilitación", Guid.NewGuid(),
            basica with { Evaluaciones = [new EvaluacionRequeridaDelFlujo(cuestionario.Id, EfectoDeLaEvaluacion.Bloquear), new EvaluacionRequeridaDelFlujo(otro.Id, EfectoDeLaEvaluacion.Observar)] },
            [area], Ahora, null, null, todos);
        var publicada = flujo.Publicar([area], Ahora, null, null, todos);
        publicada.Evaluaciones.Select(e => (e.CuestionarioId, e.Efecto)).ShouldBe(
            [(cuestionario.Id, EfectoDeLaEvaluacion.Bloquear), (otro.Id, EfectoDeLaEvaluacion.Observar)]);
        publicada.Definicion().Evaluaciones!.Count.ShouldBe(2);

        // Editar abre un borrador que parte de lo publicado y se puede quitar lo que se pedía.
        var borrador = flujo.EditarBorrador(null, publicada.Definicion() with { Evaluaciones = [] }, [area], Ahora, null, null, todos);
        borrador.Evaluaciones.ShouldBeEmpty();
        flujo.VersionPublicada!.Evaluaciones.Count.ShouldBe(2);
    }
}
