using System.Text.Json;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Evaluaciones;
using Validalo.Dominio.Flujos;
using Validalo.Dominio.Terceros;
using C = Validalo.Dominio.Flujos.CondicionDeExigencia;
using Op = Validalo.Dominio.Flujos.OperadorCondicion;

namespace Validalo.Dominio.Tests;

/// <summary>
/// Cuestionario de evaluación del proveedor nuevo (CE-1…CE-6, CE-9): validación de la definición, cálculo del puntaje con tabla de casos (pesos de pregunta y de
/// sección, puntaje por opción, escala, rangos, múltiple, lo no respondido), preguntas eliminatorias, visibilidad por respuestas anteriores y versión publicada congelada.
/// </summary>
public class CalculoDePuntajeTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-5));

    private static readonly ContextoDeExigencia Contexto =
        new(TipoPersona.Juridica, "CO", "NIT", false, "PROVEEDOR", new Dictionary<string, JsonElement>());

    private static OpcionDePregunta Si(decimal puntaje, bool elimina = false) => new(DefinicionDeCuestionario.CodigoSi, "Sí", puntaje, elimina);

    private static OpcionDePregunta No(decimal puntaje, bool elimina = false) => new(DefinicionDeCuestionario.CodigoNo, "No", puntaje, elimina);

    private static PreguntaDeCuestionario SiNo(string codigo, decimal peso, decimal si = 10, decimal no = 0, bool eliminaNo = false, CondicionDeExigencia? condicion = null,
        bool obligatoria = true) =>
        new(codigo, $"Pregunta {codigo}", TipoDePregunta.SiNo, obligatoria, peso, eliminaNo, [Si(si), No(no, eliminaNo)], Condicion: condicion);

    /// <summary>
    /// Cuestionario de la tabla de casos. Legal (peso 60): P1 sí/no (peso 2), P2 antigüedad (opción única, peso 1). Operación (peso 40): P3 escala 1–5, P4 certificaciones
    /// (múltiple, opcional), P5 años de experiencia (número por rangos, opcional), todas de peso 1. Umbral 70.
    /// </summary>
    private static DefinicionDeCuestionario Base(decimal umbral = 70) => new(
    [
        new SeccionDeCuestionario("LEGAL", "Legal", 60,
        [
            SiNo("P1", 2),
            new PreguntaDeCuestionario("P2", "Antigüedad", TipoDePregunta.OpcionUnica, true, 1, false,
                [new OpcionDePregunta("menos1", "Menos de un año", 0), new OpcionDePregunta("de1a3", "De uno a tres años", 5), new OpcionDePregunta("mas3", "Más de tres años", 10)])
        ]),
        new SeccionDeCuestionario("OPERACION", "Operación", 40,
        [
            new PreguntaDeCuestionario("P3", "Calidad del servicio", TipoDePregunta.Escala, true, 1, false, Escala: new EscalaDePregunta(1, 5)),
            new PreguntaDeCuestionario("P4", "Certificaciones", TipoDePregunta.OpcionMultiple, false, 1, false,
                [new OpcionDePregunta("iso9001", "ISO 9001", 5), new OpcionDePregunta("iso14001", "ISO 14001", 3), new OpcionDePregunta("sgsst", "SG-SST", 2)]),
            new PreguntaDeCuestionario("P5", "Años de experiencia", TipoDePregunta.Numero, false, 1, false,
                Rangos: [new RangoDeNumero(0, 2, 2), new RangoDeNumero(3, 9, 6), new RangoDeNumero(10, null, 10)])
        ])
    ], umbral, QuienResponde.Evaluador);

    private static RespuestaDePregunta Opc(string pregunta, params string[] opciones) => new(pregunta, Opciones: opciones);

    private static RespuestaDePregunta Num(string pregunta, decimal valor) => new(pregunta, Numero: valor);

    private static ResultadoDeEvaluacion Calcular(DefinicionDeCuestionario definicion, params RespuestaDePregunta[] respuestas) =>
        CalculadoraDePuntaje.Totalizar(definicion, CalculadoraDePuntaje.Evaluar(definicion, respuestas, Contexto));

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    // ---------- Tabla de casos del cálculo ----------

    public static TheoryData<string, RespuestaDePregunta[], decimal, decimal, decimal, bool> Casos => new()
    {
        // Todo lo mejor: 100 en cada sección y en el total.
        { "todo lo mejor", [Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 5), Opc("P4", "iso9001", "iso14001", "sgsst"), Num("P5", 12)], 100m, 100m, 100m, true },
        // Legal = (2·100 + 1·50)/3 = 83,33; Operación = (50 + 50 + 60)/3 = 53,33; total = (60·83,33 + 40·53,33)/100 = 71,33.
        { "mixto sobre el umbral", [Opc("P1", "si"), Opc("P2", "de1a3"), Num("P3", 3), Opc("P4", "iso9001"), Num("P5", 5)], 83.33m, 53.33m, 71.33m, true },
        // Operación = (25 + 0 + 20)/3 = 15 (lo opcional sin responder vale 0; 1 año vale 2/10); total = 50 + 6 = 56.
        { "mixto bajo el umbral", [Opc("P1", "si"), Opc("P2", "de1a3"), Num("P3", 2), Num("P5", 1)], 83.33m, 15m, 56m, false },
        // Sin una sola respuesta buena: 0.
        { "todo lo peor", [Opc("P1", "no"), Opc("P2", "menos1"), Num("P3", 1)], 0m, 0m, 0m, false },
        // El peso de la pregunta pesa: P1 (peso 2) en 100 y P2 en 0 dan 66,67 en Legal.
        { "peso de la pregunta", [Opc("P1", "si"), Opc("P2", "menos1"), Num("P3", 5)], 66.67m, 33.33m, 53.33m, false },
        // Múltiple parcial (5 de 10 = 50) y rango abierto (15 años = 100).
        { "múltiple parcial y rango abierto", [Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 1), Opc("P4", "iso9001"), Num("P5", 15)], 100m, 50m, 80m, true },
        // El 2 está en el primer rango (0–2): vale 2/10 = 20; el 3 abre el segundo.
        { "límite inclusivo del rango", [Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 1), Num("P5", 2)], 100m, 6.67m, 62.67m, false }
    };

    [Theory]
    [MemberData(nameof(Casos))]
    public void El_puntaje_sale_de_los_pesos_y_los_puntajes_de_las_respuestas(string caso, RespuestaDePregunta[] respuestas, decimal legal, decimal operacion, decimal total,
        bool aprobada)
    {
        var resultado = Calcular(Base(), respuestas);

        resultado.Secciones.Single(s => s.Codigo == "LEGAL").Puntaje.ShouldBe(legal, caso);
        resultado.Secciones.Single(s => s.Codigo == "OPERACION").Puntaje.ShouldBe(operacion, caso);
        resultado.Puntaje.ShouldBe(total, caso);
        resultado.Aprobada.ShouldBe(aprobada, caso);
        resultado.Calculada.ShouldBeTrue();
        resultado.Motivos.ShouldBe(aprobada ? [] : [ResultadoDeEvaluacion.BajoElUmbral], caso);
    }

    [Fact]
    public void El_umbral_es_inclusivo_y_el_veredicto_usa_el_puntaje_redondeado()
    {
        var respuestas = new[] { Opc("P1", "si"), Opc("P2", "de1a3"), Num("P3", 3), Opc("P4", "iso9001"), Num("P5", 5) }; // 71,33
        Calcular(Base(71.33m), respuestas).Aprobada.ShouldBeTrue();
        Calcular(Base(71.34m), respuestas).Aprobada.ShouldBeFalse();
    }

    // ---------- Eliminatorias ----------

    private static DefinicionDeCuestionario ConEliminatoria() => new(
    [
        new SeccionDeCuestionario("CUMPLIMIENTO", "Cumplimiento", 100,
        [
            SiNo("P1", 1, eliminaNo: true), // «¿Está al día con la seguridad social?»: «no» elimina
            new PreguntaDeCuestionario("P2", "Calidad", TipoDePregunta.Escala, true, 3, true, Escala: new EscalaDePregunta(1, 5, MinimoAceptable: 2)),
            new PreguntaDeCuestionario("P3", "Multas del último año", TipoDePregunta.Numero, true, 1, true,
                Rangos: [new RangoDeNumero(0, 0, 10), new RangoDeNumero(1, 3, 5), new RangoDeNumero(4, null, 0, Elimina: true)])
        ])
    ], 50, QuienResponde.Tercero);

    [Fact]
    public void Una_eliminatoria_fallida_reprueba_aunque_el_total_supere_el_umbral()
    {
        // P1 = no (elimina). Lo demás es lo mejor: la pregunta peor puntuada solo pesa 1 de 5 y el total sigue alto.
        var resultado = Calcular(ConEliminatoria(), Opc("P1", "no"), Num("P2", 5), Num("P3", 0));

        resultado.Puntaje.ShouldBe(80m);
        resultado.Puntaje!.Value.ShouldBeGreaterThanOrEqualTo(resultado.Umbral);
        resultado.Aprobada.ShouldBeFalse();
        resultado.Eliminatorias.ShouldBe(["P1"]);
        resultado.Motivos.ShouldBe([ResultadoDeEvaluacion.EliminatoriaFallida]);
    }

    [Theory]
    [InlineData(1, true)] // bajo el mínimo aceptable de la escala
    [InlineData(2, false)]
    [InlineData(5, false)]
    public void La_escala_elimina_por_debajo_del_minimo_aceptable(int valor, bool elimina)
    {
        var resultado = Calcular(ConEliminatoria(), Opc("P1", "si"), Num("P2", valor), Num("P3", 0));

        resultado.Eliminatorias.Contains("P2").ShouldBe(elimina);
        resultado.Aprobada.ShouldBe(!elimina);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(3, false)]
    [InlineData(4, true)] // el rango «4 o más multas» elimina
    [InlineData(30, true)]
    public void Un_rango_numerico_puede_eliminar(decimal multas, bool elimina)
    {
        var resultado = Calcular(ConEliminatoria(), Opc("P1", "si"), Num("P2", 5), Num("P3", multas));

        resultado.Eliminatorias.Contains("P3").ShouldBe(elimina);
        resultado.Aprobada.ShouldBe(!elimina);
    }

    [Fact]
    public void Una_eliminatoria_en_una_opcion_multiple_elimina_si_se_marca_esa_opcion()
    {
        var definicion = new DefinicionDeCuestionario(
        [
            new SeccionDeCuestionario("S1", "Riesgos", 100,
            [
                new PreguntaDeCuestionario("P1", "Hallazgos", TipoDePregunta.OpcionMultiple, true, 1, true,
                    [new OpcionDePregunta("ninguno", "Ninguno", 10), new OpcionDePregunta("lavado", "Investigación por lavado de activos", 0, Elimina: true),
                        new OpcionDePregunta("multa", "Multa administrativa", 4)])
            ])
        ], 50, QuienResponde.Evaluador);

        Calcular(definicion, Opc("P1", "ninguno")).Aprobada.ShouldBeTrue();
        var eliminado = Calcular(definicion, Opc("P1", "multa", "lavado"));
        eliminado.Aprobada.ShouldBeFalse();
        eliminado.Eliminatorias.ShouldBe(["P1"]);
    }

    // ---------- Visibilidad ----------

    private static DefinicionDeCuestionario ConCondiciones() => new(
    [
        new SeccionDeCuestionario("S1", "General", 50,
        [
            SiNo("P1", 1),
            // Solo si «no» a P1 se pregunta el motivo (obligatoria).
            new PreguntaDeCuestionario("P2", "¿Por qué no?", TipoDePregunta.Texto, true, 0, false, Condicion: C.Predicado("respuesta.P1", Op.Igual, "no"))
        ]),
        // La sección completa solo para personas jurídicas que dijeron «sí» a P1.
        new SeccionDeCuestionario("S2", "Jurídicas", 50, [SiNo("P3", 1)],
            C.Todas(C.Predicado(AtributosDeExigencia.TipoPersona, Op.Igual, "Juridica"), C.Predicado("respuesta.P1", Op.Igual, "si")))
    ], 60, QuienResponde.Tercero);

    [Fact]
    public void Una_pregunta_oculta_no_se_responde_no_se_exige_y_no_cuenta_en_el_puntaje()
    {
        var definicion = ConCondiciones();

        // P1 = sí ⇒ P2 oculta; S2 visible (jurídica y «sí»). Total: (50·100 + 50·100)/100.
        var si = Calcular(definicion, Opc("P1", "si"), Opc("P3", "si"));
        si.Preguntas.Single(p => p.Codigo == "P2").Visible.ShouldBeFalse();
        si.Secciones.Single(s => s.Codigo == "S2").Aplica.ShouldBeTrue();
        si.Puntaje.ShouldBe(100m);

        // P1 = no ⇒ P2 visible y obligatoria; S2 oculta y fuera del total.
        Codigo(() => Calcular(definicion, Opc("P1", "no"))).ShouldBe("pregunta-obligatoria");
        var no = Calcular(definicion, Opc("P1", "no"), new RespuestaDePregunta("P2", Texto: "Aún no lo tenemos."));
        no.Secciones.Single(s => s.Codigo == "S2").Aplica.ShouldBeFalse();
        no.Puntaje.ShouldBe(0m);

        Codigo(() => Calcular(definicion, Opc("P1", "si"), new RespuestaDePregunta("P2", Texto: "x"), Opc("P3", "si"))).ShouldBe("pregunta-no-visible");
        Codigo(() => Calcular(definicion, Opc("P1", "no"), new RespuestaDePregunta("P2", Texto: "x"), Opc("P3", "si"))).ShouldBe("pregunta-no-visible");
    }

    [Fact]
    public void La_condicion_de_una_seccion_lee_los_atributos_del_tercero()
    {
        var natural = Contexto with { TipoPersona = TipoPersona.Natural };
        var definicion = ConCondiciones();
        var respuestas = new[] { Opc("P1", "si") };

        var resultado = CalculadoraDePuntaje.Totalizar(definicion, CalculadoraDePuntaje.Evaluar(definicion, respuestas, natural));

        resultado.Secciones.Single(s => s.Codigo == "S2").Aplica.ShouldBeFalse();
        resultado.Puntaje.ShouldBe(100m);
    }

    // ---------- Respuestas ----------

    [Fact]
    public void Las_respuestas_se_validan_contra_el_tipo_y_lo_obligatorio()
    {
        var definicion = Base();
        var completas = new[] { Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 5) };
        CalculadoraDePuntaje.Evaluar(definicion, completas, Contexto).ShouldNotBeEmpty();

        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "si"), Opc("P2", "mas3")], Contexto)).ShouldBe("pregunta-obligatoria");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [.. completas, Opc("P9", "x")], Contexto)).ShouldBe("pregunta-desconocida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [.. completas, Opc("P1", "no")], Contexto)).ShouldBe("respuesta-duplicada");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "quizas"), Opc("P2", "mas3"), Num("P3", 5)], Contexto)).ShouldBe("respuesta-invalida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "si", "no"), Opc("P2", "mas3"), Num("P3", 5)], Contexto)).ShouldBe("respuesta-invalida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 6)], Contexto)).ShouldBe("respuesta-invalida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "si"), Opc("P2", "mas3"), Num("P3", 2.5m)], Contexto)).ShouldBe("respuesta-invalida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [.. completas, Opc("P4", "iso9001", "iso9001")], Contexto)).ShouldBe("respuesta-invalida");
        Codigo(() => CalculadoraDePuntaje.Evaluar(definicion, [.. completas, new RespuestaDePregunta("P1", Comentario: "x")], Contexto)).ShouldBe("respuesta-duplicada");
    }

    [Fact]
    public void El_comentario_solo_se_admite_donde_la_pregunta_lo_permite()
    {
        var definicion = Base() with
        {
            Secciones = [Base().Secciones[0] with { Preguntas = [SiNo("P1", 1) with { PermiteComentario = true }, Base().Secciones[0].Preguntas[1]] }, Base().Secciones[1]]
        };
        var comentada = Calcular(definicion, new RespuestaDePregunta("P1", ["si"], Comentario: "Con soporte."), Opc("P2", "mas3"), Num("P3", 5));
        comentada.Puntaje.ShouldNotBeNull();

        Codigo(() => Calcular(definicion, Opc("P1", "si"), new RespuestaDePregunta("P2", ["mas3"], Comentario: "no cabe"), Num("P3", 5))).ShouldBe("comentario-no-permitido");
    }

    [Fact]
    public void Un_adjunto_se_responde_con_archivos_y_no_puntua()
    {
        var definicion = new DefinicionDeCuestionario(
        [
            new SeccionDeCuestionario("S1", "Evidencias", 100,
            [
                SiNo("P1", 1),
                new PreguntaDeCuestionario("P2", "Sube la certificación", TipoDePregunta.Adjunto, true, 0, false)
            ])
        ], 50, QuienResponde.Tercero);
        var archivo = Guid.NewGuid();

        var resultado = Calcular(definicion, Opc("P1", "si"), new RespuestaDePregunta("P2", Adjuntos: [archivo]));

        resultado.Puntaje.ShouldBe(100m);
        resultado.Preguntas.Single(p => p.Codigo == "P2").Puntaje.ShouldBeNull();
        Codigo(() => Calcular(definicion, Opc("P1", "si"))).ShouldBe("pregunta-obligatoria");
        Codigo(() => Calcular(definicion, Opc("P1", "si"), new RespuestaDePregunta("P2", Texto: "adjunto"))).ShouldBe("respuesta-invalida");
        Codigo(() => Calcular(definicion, Opc("P1", "si"), new RespuestaDePregunta("P2", Adjuntos: [archivo, archivo]))).ShouldBe("respuesta-invalida");
    }

    // ---------- Recalificación ----------

    [Fact]
    public void Los_ajustes_de_un_revisor_cambian_el_puntaje_de_una_pregunta_y_levantan_una_eliminatoria()
    {
        var definicion = ConEliminatoria();
        var evaluadas = CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "no"), Num("P2", 4), Num("P3", 2)], Contexto);
        var original = CalculadoraDePuntaje.Totalizar(definicion, evaluadas);
        original.Aprobada.ShouldBeFalse();

        var ajustado = CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("P1", 100, LevantaEliminatoria: true)]);

        ajustado.Eliminatorias.ShouldBeEmpty();
        ajustado.Preguntas.Single(p => p.Codigo == "P1").Ajustada.ShouldBeTrue();
        ajustado.Puntaje!.Value.ShouldBeGreaterThan(original.Puntaje!.Value);
        ajustado.Aprobada.ShouldBeTrue();
        ajustado.Calculada.ShouldBeTrue();

        // El veredicto fijado a mano reemplaza al calculado, pero los motivos del cálculo siguen a la vista.
        var manual = CalculadoraDePuntaje.Totalizar(definicion, evaluadas, null, veredictoManual: true);
        manual.Aprobada.ShouldBeTrue();
        manual.Calculada.ShouldBeFalse();
        manual.Motivos.ShouldBe([ResultadoDeEvaluacion.EliminatoriaFallida]);
    }

    [Fact]
    public void Un_ajuste_solo_aplica_a_una_pregunta_visible_que_puntua_y_una_eliminatoria_que_existe()
    {
        var definicion = ConCondiciones();
        var evaluadas = CalculadoraDePuntaje.Evaluar(definicion, [Opc("P1", "si"), Opc("P3", "si")], Contexto);

        Codigo(() => CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("P2", 50)])).ShouldBe("ajuste-invalido"); // oculta
        Codigo(() => CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("P1", 150)])).ShouldBe("ajuste-invalido");
        Codigo(() => CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("P1", 50, true)])).ShouldBe("ajuste-invalido"); // no elimina
        Codigo(() => CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("P1", 50), new AjusteDeCalificacion("P1", 60)])).ShouldBe("ajuste-invalido");
        Codigo(() => CalculadoraDePuntaje.Totalizar(definicion, evaluadas, [new AjusteDeCalificacion("PX", 50)])).ShouldBe("pregunta-desconocida");
    }

    // ---------- Validación de la definición ----------

    private static DefinicionDeCuestionario Con(Func<PreguntaDeCuestionario, PreguntaDeCuestionario> cambio) =>
        Base() with { Secciones = [Base().Secciones[0] with { Preguntas = [cambio(Base().Secciones[0].Preguntas[0]), Base().Secciones[0].Preguntas[1]] }, Base().Secciones[1]] };

    [Fact]
    public void La_definicion_valida_se_normaliza_y_genera_los_codigos_que_faltan()
    {
        var definicion = new DefinicionDeCuestionario(
        [
            new SeccionDeCuestionario("", "  Legal  ", 10, [SiNo("", 1) with { Texto = "  ¿Está al día?  " }, SiNo("P1", 1)])
        ], 70, QuienResponde.Tercero);

        var validada = definicion.Validar();

        validada.Secciones[0].Codigo.ShouldBe("S1");
        validada.Secciones[0].Nombre.ShouldBe("Legal");
        validada.Secciones[0].Preguntas.Select(p => p.Codigo).ShouldBe(["P2", "P1"]); // P1 ya estaba tomada
        validada.Secciones[0].Preguntas[0].Texto.ShouldBe("¿Está al día?");
    }

    [Theory]
    [InlineData("umbral", "umbral-invalido")]
    [InlineData("meses", "reevaluacion-invalida")]
    [InlineData("sinsecciones", "secciones-requeridas")]
    [InlineData("sinpreguntas", "preguntas-requeridas")]
    [InlineData("codigorepetido", "codigo-duplicado")]
    [InlineData("pesoseccion", "peso-invalido")]
    [InlineData("sinpuntuadas", "sin-preguntas-puntuadas")]
    public void La_definicion_invalida_se_rechaza_con_su_codigo(string caso, string esperado)
    {
        var d = Base();
        var invalida = caso switch
        {
            "umbral" => d with { UmbralDeAprobacion = 101 },
            "meses" => d with { ReevaluarCadaMeses = 0 },
            "sinsecciones" => d with { Secciones = [] },
            "sinpreguntas" => d with { Secciones = [d.Secciones[0] with { Preguntas = [] }] },
            "codigorepetido" => Con(p => p with { Codigo = "P2" }),
            "pesoseccion" => d with { Secciones = [d.Secciones[0] with { Peso = -1 }, d.Secciones[1]] },
            _ => d with { Secciones = [new SeccionDeCuestionario("S1", "Solo informativa", 10, [SiNo("P1", 0)])] }
        };

        Codigo(() => invalida.Validar()).ShouldBe(esperado);
    }

    [Theory]
    [InlineData("textoVacio", "pregunta-invalida")]
    [InlineData("pesoNegativo", "peso-invalido")]
    [InlineData("siNoSinNo", "opciones-invalidas")]
    [InlineData("puntajeFuera", "puntaje-invalido")]
    [InlineData("sinPuntaje", "pregunta-sin-puntaje")]
    [InlineData("eliminatoriaSinCriterio", "eliminatoria-sin-criterio")]
    [InlineData("eliminatoriaOpcional", "eliminatoria-obligatoria")]
    [InlineData("eliminaSinMarca", "eliminatoria-sin-criterio")]
    [InlineData("opcionesQueSobran", "pregunta-invalida")]
    [InlineData("condicionFutura", "condicion-invalida")]
    [InlineData("condicionDeVinculo", "condicion-invalida")]
    public void Una_pregunta_invalida_se_rechaza_con_su_codigo_y_dice_cual(string caso, string esperado)
    {
        var invalida = caso switch
        {
            "textoVacio" => Con(p => p with { Texto = " " }),
            "pesoNegativo" => Con(p => p with { Peso = -1 }),
            "siNoSinNo" => Con(p => p with { Opciones = [Si(10)] }),
            "puntajeFuera" => Con(p => p with { Opciones = [Si(2000), No(0)] }),
            "sinPuntaje" => Con(p => p with { Opciones = [Si(0), No(0)] }),
            "eliminatoriaSinCriterio" => Con(p => p with { Eliminatoria = true, Opciones = [Si(10), No(0)] }),
            "eliminatoriaOpcional" => Con(p => p with { Eliminatoria = true, Obligatoria = false, Opciones = [Si(10), No(0, true)] }),
            "eliminaSinMarca" => Con(p => p with { Opciones = [Si(10), No(0, true)] }),
            "opcionesQueSobran" => Con(p => p with { Tipo = TipoDePregunta.Escala, Escala = new EscalaDePregunta(1, 5) }),
            "condicionFutura" => Con(p => p with { Condicion = C.Predicado("respuesta.P3", Op.Igual, "1") }),
            _ => Con(p => p with { Condicion = C.Predicado("vinculo.atributos.monto", Op.Mayor, "1") })
        };

        var ex = Should.Throw<ReglaDeNegocioException>(() => invalida.Validar());
        ex.Codigo.ShouldBe(esperado);
        ex.Datos!["pregunta"].ShouldBe("P1");
    }

    [Fact]
    public void Las_escalas_y_los_rangos_se_validan()
    {
        PreguntaDeCuestionario Escala(EscalaDePregunta escala) => new("P9", "Escala", TipoDePregunta.Escala, true, 1, false, Escala: escala);
        DefinicionDeCuestionario Con9(PreguntaDeCuestionario p) => Base() with { Secciones = [Base().Secciones[0], Base().Secciones[1] with { Preguntas = [p] }] };

        Con9(Escala(new EscalaDePregunta(1, 5))).Validar().ShouldNotBeNull();
        Codigo(() => Con9(Escala(new EscalaDePregunta(5, 5))).Validar()).ShouldBe("escala-invalida");
        Codigo(() => Con9(Escala(new EscalaDePregunta(0, 11))).Validar()).ShouldBe("escala-invalida");
        Codigo(() => Con9(Escala(new EscalaDePregunta(1, 5, MinimoAceptable: 1))).Validar()).ShouldBe("escala-invalida");
        Codigo(() => Con9(Escala(new EscalaDePregunta(1, 5, MinimoAceptable: 3))).Validar()).ShouldBe("eliminatoria-sin-criterio");
        Codigo(() => Con9(new PreguntaDeCuestionario("P9", "N", TipoDePregunta.Numero, true, 1, false, Rangos: [new RangoDeNumero(5, 1, 10)])).Validar())
            .ShouldBe("rangos-invalidos");
        Codigo(() => Con9(new PreguntaDeCuestionario("P9", "N", TipoDePregunta.Numero, true, 1, false)).Validar()).ShouldBe("pregunta-sin-puntaje");
    }

    // ---------- Versiones ----------

    [Fact]
    public void Publicar_congela_la_version_y_editar_crea_un_borrador_nuevo_sin_tocar_lo_publicado()
    {
        var empresa = Guid.NewGuid();
        var cuestionario = Cuestionario.Crear(empresa, " proveedor_nuevo ", "Evaluación de proveedor nuevo", Base(), Ahora);
        cuestionario.Codigo.ShouldBe("PROVEEDOR_NUEVO");
        cuestionario.Versiones.ShouldHaveSingleItem().Estado.ShouldBe(EstadoCuestionarioVersion.Borrador);
        cuestionario.VersionPublicada.ShouldBeNull();

        var primera = cuestionario.Publicar(Ahora);
        primera.Estado.ShouldBe(EstadoCuestionarioVersion.Publicada);
        primera.PublicadaEn.ShouldBe(Ahora);
        Codigo(() => cuestionario.Publicar(Ahora)).ShouldBe("sin-borrador");

        // Editar lo publicado abre el borrador v2; la v1 queda como estaba.
        var borrador = cuestionario.EditarBorrador("Evaluación 2027", Base(80), Ahora.AddDays(1));
        borrador.Version.ShouldBe(2);
        borrador.Definicion.UmbralDeAprobacion.ShouldBe(80m);
        cuestionario.VersionPublicada!.Definicion.UmbralDeAprobacion.ShouldBe(70m);
        cuestionario.Nombre.ShouldBe("Evaluación 2027");

        // Publicar la v2 retira la v1, que sigue consultable.
        cuestionario.Publicar(Ahora.AddDays(2)).Version.ShouldBe(2);
        cuestionario.Versiones.Single(v => v.Version == 1).Estado.ShouldBe(EstadoCuestionarioVersion.Retirada);
        cuestionario.Versiones.Single(v => v.Version == 1).Definicion.UmbralDeAprobacion.ShouldBe(70m);
    }

    [Theory]
    [InlineData("1ABC", "codigo-invalido")]
    [InlineData("a", "codigo-invalido")]
    [InlineData("", "codigo-invalido")]
    public void El_codigo_del_cuestionario_se_valida(string codigo, string esperado) =>
        Codigo(() => Cuestionario.Crear(Guid.NewGuid(), codigo, "Nombre", Base(), Ahora)).ShouldBe(esperado);

    [Fact]
    public void El_cuestionario_sin_nombre_o_con_definicion_invalida_no_se_crea()
    {
        Codigo(() => Cuestionario.Crear(Guid.NewGuid(), "CUEST", " ", Base(), Ahora)).ShouldBe("nombre-requerido");
        Codigo(() => Cuestionario.Crear(Guid.NewGuid(), "CUEST", "Nombre", Base() with { Secciones = [] }, Ahora)).ShouldBe("secciones-requeridas");
    }
}
