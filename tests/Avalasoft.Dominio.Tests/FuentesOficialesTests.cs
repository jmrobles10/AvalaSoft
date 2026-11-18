using System.Text.Json;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.Flujos;
using Avalasoft.Dominio.FuentesOficiales;
using Avalasoft.Dominio.Terceros;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Fuentes oficiales, RUES y DIAN (FO-1…FO-7): el cotejo con la ficha y los documentos, el bloqueo del cierre, las diferencias para el revisor, el
/// fallo del proveedor (nada se da por satisfecho), las decisiones heredadas, el vencimiento y el monitoreo de vínculos activos. Sin llamar a nadie.
/// </summary>
public class FuentesOficialesTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 10, 9, 0, 0, TimeSpan.FromHours(-5));
    private static readonly DateOnly Hoy = new(2026, 11, 10);
    private const string ClaveTercero = "CO|NIT|900123456";

    private readonly Guid _a = Guid.NewGuid();
    private readonly Revisor _ana = new(Guid.NewGuid(), null);
    private readonly Revisor _oficial = new(Guid.NewGuid(), "CO|CC|79000001");

    // ---------- Cotejo ----------

    private static FichaParaCotejo Ficha(string razonSocial = "Aceros del Norte S.A.S.", params PersonaRelacionada[] personas) =>
        new(TipoPersona.Juridica, "Aceros del Norte", "900123456",
            new DatosGenerales { RazonSocial = razonSocial, Numero = "900123456", Dv = "7", Direccion = "Carrera 10 # 20-30", Ciudad = "05001", CiiuPrincipal = "2410" },
            new DatosTributarios { Responsabilidades = ["05", "07", "48"] }, new DatosLegales { Personas = personas });

    private static PersonaRelacionada Representante(string nombres, string apellidos, string numero, RolPersonaRelacionada rol = RolPersonaRelacionada.RepresentanteLegal) =>
        new() { Rol = rol, Nombres = nombres, Apellidos = apellidos, Numero = numero, TipoIdentificacion = "CC" };

    private static DatosOficiales Rues(string estado = "ACTIVA", int ano = 2026, string razon = "ACEROS DEL NORTE SAS", params RepresentanteOficial[] representantes) => new()
    {
        Encontrado = true, Nit = "900123456", Dv = "7", RazonSocial = razon, Estado = estado, EstadoNormalizado = EstadosOficiales.Normalizar(estado), Matricula = "123456",
        Camara = "BOGOTA", UltimoAnoRenovado = ano, FechaRenovacion = new DateOnly(ano, 3, 28), Representantes = representantes, ActividadPrincipal = "2410"
    };

    private static DatosOficiales Dian(string estado = "REGISTRO ACTIVO", string direccion = "KR 10 20 30", params string[] responsabilidades) => new()
    {
        Encontrado = true, Nit = "900123456", Dv = "7", RazonSocial = "ACEROS DEL NORTE SAS", Estado = estado, EstadoNormalizado = EstadosOficiales.Normalizar(estado),
        Direccion = direccion, Municipio = "05001", ActividadPrincipal = "2410", Responsabilidades = responsabilidades.Length == 0 ? ["05", "07", "48"] : responsabilidades
    };

    private static Dictionary<string, JsonElement> Campos(string json) => JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json)!;

    private static List<CampoCotejado> Cotejar(TipoVerificacion fuente, DatosOficiales datos, FichaParaCotejo? ficha = null, params DocumentoParaCotejo[] documentos) =>
        CruceConFuenteOficial.Cotejar(fuente, datos, ficha ?? Ficha(), documentos, Hoy);

    private static CampoCotejado De(IEnumerable<CampoCotejado> campos, string campo, ContraQue? contra = null) =>
        campos.Single(c => c.Campo == campo && (contra is null || c.Contra == contra));

    [Fact]
    public void Un_tercero_conforme_no_deja_diferencias_y_los_nombres_se_comparan_sin_puntuacion_ni_orden()
    {
        var campos = Cotejar(TipoVerificacion.Rues, Rues(), Ficha("Aceros del Norte S.A.S."));

        campos.ShouldNotContain(c => c.Resultado == ResultadoDeCruce.Discrepa);
        De(campos, "estado_matricula").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(campos, "razon_social").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(campos, "numero").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(campos, "ciiu_principal").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
    }

    [Theory]
    [InlineData("CANCELADA")]
    [InlineData("EN LIQUIDACION")]
    [InlineData("INACTIVA")]
    public void Una_matricula_que_no_esta_activa_es_una_diferencia_critica_de_la_fuente(string estado)
    {
        var campo = De(Cotejar(TipoVerificacion.Rues, Rues(estado)), "estado_matricula");

        (campo.Resultado, campo.Critico, campo.Contra).ShouldBe((ResultadoDeCruce.Discrepa, true, ContraQue.Fuente));
        campo.Detalle.ShouldNotBeNull().ShouldContain("no está activa");
    }

    [Fact]
    public void Un_estado_que_no_se_entiende_no_se_afirma_y_queda_no_verificable()
    {
        De(Cotejar(TipoVerificacion.Rues, Rues("EN TRAMITE")), "estado_matricula").Resultado.ShouldBe(ResultadoDeCruce.NoVerificable);
    }

    [Theory]
    [InlineData(2026, 11, 10, 2026, true)] // en noviembre debe estar renovada al año en curso
    [InlineData(2026, 11, 10, 2025, false)]
    [InlineData(2026, 2, 10, 2025, true)] // antes del 31 de marzo todavía vale el año anterior
    [InlineData(2026, 4, 1, 2025, false)]
    public void La_renovacion_se_exige_al_ano_que_corresponde_segun_la_fecha_de_negocio(int anio, int mes, int dia, int renovada, bool alDia)
    {
        var campos = CruceConFuenteOficial.Cotejar(TipoVerificacion.Rues, Rues(ano: renovada), Ficha(), [], new DateOnly(anio, mes, dia));

        var renovacion = De(campos, "renovacion");
        renovacion.Resultado.ShouldBe(alDia ? ResultadoDeCruce.Coincide : ResultadoDeCruce.Discrepa);
        renovacion.Oficial.ShouldNotBeNull().ShouldContain(renovada.ToString());
    }

    [Fact]
    public void La_razon_social_la_identificacion_y_el_ciiu_distintos_a_la_ficha_son_diferencias()
    {
        var datos = Rues() with { RazonSocial = "SIDERURGICA DEL SUR LTDA", Nit = "800999888", ActividadPrincipal = "4711" };

        var campos = Cotejar(TipoVerificacion.Rues, datos);

        De(campos, "razon_social").Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        (De(campos, "razon_social").Critico, De(campos, "numero").Critico, De(campos, "ciiu_principal").Critico).ShouldBe((true, true, false));
        De(campos, "numero").Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        De(campos, "ciiu_principal").Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
    }

    [Fact]
    public void Un_representante_de_la_fuente_debe_figurar_en_la_ficha_como_principal_o_suplente()
    {
        var ficha = Ficha("Aceros del Norte S.A.S.", Representante("Ana", "Pérez", "1020304050"), Representante("Luis", "Gómez", "79000111", RolPersonaRelacionada.Suplente));

        var coincide = Cotejar(TipoVerificacion.Rues, Rues(representantes: new RepresentanteOficial("PEREZ ANA", "1.020.304.050", "Representante legal")), ficha);
        De(coincide, "representante[0]").Resultado.ShouldBe(ResultadoDeCruce.Coincide);

        var suplente = Cotejar(TipoVerificacion.Rues, Rues(representantes: new RepresentanteOficial("Luis Gómez", "79000111", null)), ficha);
        De(suplente, "representante[0]").Resultado.ShouldBe(ResultadoDeCruce.Coincide);

        var otro = Cotejar(TipoVerificacion.Rues, Rues(representantes: new RepresentanteOficial("Carlos Ruiz", "52000999", "Representante legal")), ficha);
        var diferencia = De(otro, "representante[0]");
        (diferencia.Resultado, diferencia.Critico, diferencia.Detalle).ShouldBe((ResultadoDeCruce.Discrepa, true, "Figura en el registro y no entre los representantes de la ficha."));

        // La ficha sin ningún representante: el registro sí lo tiene.
        De(Cotejar(TipoVerificacion.Rues, Rues(representantes: new RepresentanteOficial("Carlos Ruiz", "52000999", null)), Ficha()), "representante[0]").Resultado
            .ShouldBe(ResultadoDeCruce.Discrepa);
    }

    [Fact]
    public void Lo_que_la_ficha_no_tiene_diligenciado_o_la_fuente_no_trae_no_se_puede_verificar_y_no_pide_decision()
    {
        var sinCiiu = Ficha() with { General = Ficha().General! with { CiiuPrincipal = null } };
        De(Cotejar(TipoVerificacion.Rues, Rues(), sinCiiu), "ciiu_principal").Resultado.ShouldBe(ResultadoDeCruce.NoVerificable);
        De(Cotejar(TipoVerificacion.Rues, Rues() with { ActividadPrincipal = null }), "ciiu_principal").Resultado.ShouldBe(ResultadoDeCruce.NoVerificable);
    }

    [Fact]
    public void Un_nit_que_no_figura_en_la_fuente_es_una_sola_diferencia_critica()
    {
        var campos = Cotejar(TipoVerificacion.Rues, DatosOficiales.NoEncontrado);

        var campo = campos.ShouldHaveSingleItem();
        (campo.Campo, campo.Resultado, campo.Critico).ShouldBe(("registro", ResultadoDeCruce.Discrepa, true));
    }

    [Fact]
    public void El_certificado_de_camara_se_coteja_con_la_fuente_estado_razon_social_matricula_y_representantes()
    {
        var camara = new DocumentoParaCotejo("CAMARA_COMERCIO", Guid.NewGuid(), 2, Campos("""
            { "razonSocial": "Aceros del Norte S.A.S.", "nit": "900123456", "matricula": "00123456", "estadoMatricula": "Cancelada",
              "representantesLegales": [ { "nombre": "Ana Pérez", "identificacion": "1020304050", "cargo": "Gerente" } ] }
            """), true);
        var datos = Rues(representantes: [new RepresentanteOficial("Ana Perez", "1020304050", null), new RepresentanteOficial("Otro Socio", "1000", null)]);

        var campos = Cotejar(TipoVerificacion.Rues, datos, null, camara);

        var delDocumento = campos.Where(c => c.Contra == ContraQue.Documento).ToList();
        delDocumento.ShouldAllBe(c => c.Referencia == "CAMARA_COMERCIO v2");
        De(delDocumento, "razon_social").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(delDocumento, "matricula").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        var estado = De(delDocumento, "estado_matricula");
        (estado.Resultado, estado.Critico, estado.Detalle).ShouldBe((ResultadoDeCruce.Discrepa, true, "El certificado dice «Cancelada» y el RUES «ACTIVA»."));
        De(delDocumento, "representante[0]").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(delDocumento, "representante[1]").Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
    }

    [Fact]
    public void Un_documento_que_no_se_lee_no_se_coteja_y_el_rut_no_se_usa_para_el_registro_mercantil()
    {
        var ilegible = new DocumentoParaCotejo("CAMARA_COMERCIO", Guid.NewGuid(), 1, Campos("""{ "razonSocial": "Otra" }"""), false);
        var rut = new DocumentoParaCotejo("RUT", Guid.NewGuid(), 1, Campos("""{ "razonSocial": "Otra" }"""), true);

        Cotejar(TipoVerificacion.Rues, Rues(), null, ilegible, rut).ShouldNotContain(c => c.Contra == ContraQue.Documento);
    }

    [Fact]
    public void La_dian_coteja_estado_direccion_responsabilidades_y_el_rut_con_la_ficha_y_el_documento()
    {
        var conforme = Cotejar(TipoVerificacion.Dian, Dian());
        conforme.ShouldNotContain(c => c.Resultado == ResultadoDeCruce.Discrepa);
        De(conforme, "estado_rut").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(conforme, "direccion").Resultado.ShouldBe(ResultadoDeCruce.Coincide); // «Carrera 10 # 20-30» = «KR 10 20 30»
        De(conforme, "responsabilidades").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(conforme, "dv").Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(conforme, "ciudad").Resultado.ShouldBe(ResultadoDeCruce.Coincide);

        var rut = new DocumentoParaCotejo("RUT", Guid.NewGuid(), 3, Campos("""
            { "nit": "900123999", "razonSocial": "Aceros del Norte SAS", "direccion": "Calle 1 # 2-3", "responsabilidades": ["05", "07"] }
            """), true);
        var campos = Cotejar(TipoVerificacion.Dian, Dian("SUSPENDIDO", "CL 99 1 1", "05", "09"), null, rut);

        De(campos, "estado_rut").Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        De(campos, "direccion", ContraQue.Ficha).Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        var responsabilidades = De(campos, "responsabilidades", ContraQue.Ficha);
        responsabilidades.Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        responsabilidades.Detalle.ShouldNotBeNull().ShouldContain("09");
        De(campos, "numero", ContraQue.Documento).Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
        De(campos, "razon_social", ContraQue.Documento).Resultado.ShouldBe(ResultadoDeCruce.Coincide);
        De(campos, "responsabilidades", ContraQue.Documento).Resultado.ShouldBe(ResultadoDeCruce.Discrepa);
    }

    // ---------- Reglas de estado y herencia ----------

    [Fact]
    public void El_estado_sale_de_las_decisiones_sin_decidir_por_analizar_confirmada_fallida_y_todo_aceptado_satisfecha()
    {
        var sin = new CampoDeFuente { Id = Guid.NewGuid(), Resultado = ResultadoDeCruce.Discrepa };
        var coincide = new CampoDeFuente { Id = Guid.NewGuid(), Resultado = ResultadoDeCruce.Coincide };
        ReglasDeFuente.Estado([coincide]).ShouldBe(EstadoVerificacion.Satisfecha);
        ReglasDeFuente.Resultado([coincide]).ShouldBe(ResultadoVerificacion.Conforme);
        ReglasDeFuente.Estado([coincide, sin]).ShouldBe(EstadoVerificacion.CoincidenciaPorAnalizar);
        ReglasDeFuente.Resultado([coincide, sin]).ShouldBe(ResultadoVerificacion.ConDiferencias);

        sin.Resolucion = new ResolucionDeCoincidencia(DecisionCoincidencia.Descartada, "ok", "u", Ahora, Ahora.AddMonths(12));
        ReglasDeFuente.Estado([coincide, sin]).ShouldBe(EstadoVerificacion.Satisfecha);
        sin.Resolucion = sin.Resolucion with { Decision = DecisionCoincidencia.Confirmada };
        ReglasDeFuente.Estado([coincide, sin]).ShouldBe(EstadoVerificacion.Fallida);
    }

    // ---------- En el expediente ----------

    private FlujoParaExpediente Flujo(params VerificacionRequeridaDelFlujo[] verificaciones) =>
        new(Guid.NewGuid(), Guid.NewGuid(), "HAB", "Habilitación", 1, OrigenFlujo.PorDefecto,
            [new EtapaDelFlujo(1, [new AreaDelFlujo(_a, "COMPRAS", "Compras", 1, true, false, null)])], PoliticaDevolucion.Inmediata, false, verificaciones);

    private static DatosDeApertura Datos() =>
        new(Guid.NewGuid(), Guid.NewGuid(), TipoExpediente.Inicial, "NORTE-E-2026-000001", Guid.NewGuid(), "Aceros S.A.S.", ClaveTercero,
            Guid.NewGuid(), "PROVEEDOR", "Proveedor", new ActorDeExpediente(ActorTipo.Tercero, "tercero"), []);

    private Expediente Abrir(params VerificacionRequeridaDelFlujo[] verificaciones) =>
        Expediente.Reproducir(null, Expediente.Abrir(Datos(), Flujo(verificaciones), Ahora));

    private static Expediente Aplicar(Expediente e, IReadOnlyList<object> eventos) => Expediente.Reproducir(e, eventos);

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    private static readonly VerificacionRequeridaDelFlujo RuesBloqueante = new(TipoVerificacion.Rues);
    private static readonly VerificacionRequeridaDelFlujo DianBloqueante = new(TipoVerificacion.Dian);

    private static ConsultaOficialRealizada Consulta(string referencia, DatosOficiales datos, params DocumentoParaCotejo[] documentos) =>
        new("Simulado", referencia, datos, Cotejar(TipoVerificacion.Rues, datos, null, documentos), null, Ahora.AddDays(30));

    [Fact]
    public void El_flujo_pide_las_fuentes_por_tipo_las_deja_pendientes_y_las_consulta_al_pasar_a_revision()
    {
        var e = Abrir(RuesBloqueante, DianBloqueante with { Bloqueante = false });

        e.Verificaciones.Select(v => (v.Tipo, v.Estado, v.Bloqueante)).ShouldBe(
            [(TipoVerificacion.Rues, EstadoVerificacion.Pendiente, true), (TipoVerificacion.Dian, EstadoVerificacion.Pendiente, false)]);
        e.ProximaConsultaOficial.ShouldBe(Ahora);
        e.ProximaConsultaDeListas.ShouldBeNull();
        e.PendienteDeCumplimiento.ShouldBeTrue();
    }

    [Fact]
    public void Una_fuente_bloqueante_pendiente_impide_aprobar_aunque_las_areas_aprueben_y_al_satisfacerse_se_cierra()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        e.EsperandoVerificaciones.ShouldBeTrue();

        var eventos = e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues()), "sistema", Ahora);
        eventos.Select(x => x.GetType().Name).ShouldBe(["FuenteOficialConsultada", "ExpedienteAprobado"]);
        e = Aplicar(e, eventos);

        var rues = e.BuscarVerificacion(TipoVerificacion.Rues)!;
        (rues.Estado, rues.Resultado, rues.Proveedor).ShouldBe((EstadoVerificacion.Satisfecha, ResultadoVerificacion.Conforme, "Simulado"));
        rues.FuenteOficial!.Datos.RazonSocial.ShouldBe("ACEROS DEL NORTE SAS");
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
        e.ProximaConsultaOficial.ShouldBeNull();
        e.PendienteDeCumplimiento.ShouldBeFalse();
    }

    [Fact]
    public void Una_fuente_informativa_no_frena_el_cierre_aunque_siga_pendiente()
    {
        var e = Abrir(RuesBloqueante with { Bloqueante = false });
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
    }

    [Fact]
    public void Las_diferencias_quedan_por_revisar_bloquean_y_aceptadas_con_justificacion_satisfacen()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues("CANCELADA")), "sistema", Ahora));

        var rues = e.BuscarVerificacion(TipoVerificacion.Rues)!;
        (rues.Estado, rues.Resultado).ShouldBe((EstadoVerificacion.CoincidenciaPorAnalizar, ResultadoVerificacion.ConDiferencias));
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        var diferencia = rues.FuenteOficial!.Diferencias.ShouldHaveSingleItem();
        diferencia.Campo.ShouldBe("estado_matricula");

        Codigo(() => e.ResolverDiferenciaOficial(TipoVerificacion.Rues, diferencia.Id, DecisionCoincidencia.Descartada, " ", _oficial, Ahora)).ShouldBe("justificacion-requerida");
        Codigo(() => e.ResolverDiferenciaOficial(TipoVerificacion.Rues, Guid.NewGuid(), DecisionCoincidencia.Descartada, "x", _oficial, Ahora)).ShouldBe("diferencia-no-encontrada");
        // Un campo que coincide no es una diferencia: no se decide.
        var coincide = rues.FuenteOficial.Campos.First(c => c.Resultado == ResultadoDeCruce.Coincide);
        Codigo(() => e.ResolverDiferenciaOficial(TipoVerificacion.Rues, coincide.Id, DecisionCoincidencia.Descartada, "x", _oficial, Ahora)).ShouldBe("diferencia-no-encontrada");

        var eventos = e.ResolverDiferenciaOficial(TipoVerificacion.Rues, diferencia.Id, DecisionCoincidencia.Descartada, "En liquidación voluntaria: la empresa lo aceptó.", _oficial, Ahora);
        ((DiferenciaDeFuenteResuelta)eventos[0]).VigenteHasta.ShouldBe(Ahora.AddMonths(12));
        e = Aplicar(e, eventos);
        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.Satisfecha);
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
        Codigo(() => e.ResolverDiferenciaOficial(TipoVerificacion.Rues, diferencia.Id, DecisionCoincidencia.Confirmada, "x", _oficial, Ahora)).ShouldBe("estado-invalido");
    }

    [Fact]
    public void Una_diferencia_confirmada_deja_la_fuente_fallida_el_expediente_no_cierra_y_cumplimiento_puede_rechazarlo()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues("CANCELADA")), "sistema", Ahora));
        var id = e.BuscarVerificacion(TipoVerificacion.Rues)!.FuenteOficial!.Diferencias.Single().Id;

        e = Aplicar(e, e.ResolverDiferenciaOficial(TipoVerificacion.Rues, id, DecisionCoincidencia.Confirmada, "La matrícula está cancelada.", _oficial, Ahora));

        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.Fallida);
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        var rechazo = e.RechazarPorCumplimiento(_oficial, [new MotivoAplicado("rues", "Matrícula mercantil cancelada.")], "La matrícula está cancelada en el RUES.", Ahora);
        Aplicar(e, rechazo).Estado.ShouldBe(EstadoExpediente.Rechazado);
    }

    [Fact]
    public void Quien_decide_no_puede_ser_el_propio_tercero()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues("CANCELADA")), "sistema", Ahora));
        var id = e.BuscarVerificacion(TipoVerificacion.Rues)!.FuenteOficial!.Diferencias.Single().Id;

        Codigo(() => e.ResolverDiferenciaOficial(TipoVerificacion.Rues, id, DecisionCoincidencia.Descartada, "x", new Revisor(Guid.NewGuid(), ClaveTercero), Ahora))
            .ShouldBe("conflicto-de-intereses");
    }

    [Fact]
    public void La_consulta_es_idempotente_por_referencia_y_la_reconsulta_hereda_lo_aceptado_vigente_pero_nunca_lo_confirmado()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues("CANCELADA")), "sistema", Ahora));
        e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues("CANCELADA")), "sistema", Ahora).ShouldBeEmpty();
        var id = e.BuscarVerificacion(TipoVerificacion.Rues)!.FuenteOficial!.Diferencias.Single().Id;
        e = Aplicar(e, e.ResolverDiferenciaOficial(TipoVerificacion.Rues, id, DecisionCoincidencia.Descartada, "Aceptada.", _oficial, Ahora));

        // La misma diferencia en otra consulta se hereda; la consulta anterior queda con su evidencia.
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-2", Rues("CANCELADA")), "sistema", Ahora.AddDays(1)));
        var rues = e.BuscarVerificacion(TipoVerificacion.Rues)!;
        rues.Estado.ShouldBe(EstadoVerificacion.Satisfecha);
        rues.FuenteOficial!.Diferencias.ShouldHaveSingleItem().Heredada.ShouldBeTrue();
        rues.Anteriores.ShouldHaveSingleItem().ReferenciaExterna.ShouldBe("ref-1");

        // Una diferencia nueva (otro valor) vuelve a pedirse; pasados los 12 meses también.
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-3", Rues("SUSPENDIDA")), "sistema", Ahora.AddDays(2)));
        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.CoincidenciaPorAnalizar);
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-4", Rues("CANCELADA")), "sistema", Ahora.AddMonths(13)));
        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.CoincidenciaPorAnalizar);

        // Lo confirmado nunca se hereda.
        var otra = e.BuscarVerificacion(TipoVerificacion.Rues)!.FuenteOficial!.Diferencias.Single().Id;
        e = Aplicar(e, e.ResolverDiferenciaOficial(TipoVerificacion.Rues, otra, DecisionCoincidencia.Confirmada, "Confirmada.", _oficial, Ahora.AddMonths(13)));
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-5", Rues("CANCELADA")), "sistema", Ahora.AddMonths(13).AddDays(1)));
        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.CoincidenciaPorAnalizar);
    }

    [Fact]
    public void Si_la_fuente_falla_la_verificacion_sigue_pendiente_se_reintenta_y_una_bloqueante_no_deja_cerrar()
    {
        var e = Abrir(RuesBloqueante);
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));

        var reintento = Ahora.AddMinutes(5);
        e = Aplicar(e, e.RegistrarFalloDeConsulta(TipoVerificacion.Rues, "Simulado", "RUES simulada: la fuente no responde.", reintento, Ahora));

        var rues = e.BuscarVerificacion(TipoVerificacion.Rues)!;
        (rues.Estado, rues.Fallos, rues.ReintentarDesde, rues.UltimoError).ShouldBe((EstadoVerificacion.Pendiente, 1, reintento, "RUES simulada: la fuente no responde."));
        e.ProximaConsultaOficial.ShouldBe(reintento);
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
        e.EsperandoVerificaciones.ShouldBeTrue();

        // Al responder, el fallo se olvida.
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues()), "sistema", reintento));
        e.BuscarVerificacion(TipoVerificacion.Rues)!.Fallos.ShouldBe(0);
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
    }

    [Fact]
    public void El_resultado_vence_y_se_reconsulta_con_el_expediente_abierto()
    {
        var e = Abrir(RuesBloqueante, DianBloqueante);
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues()) with { VigenteHasta = Ahora.AddDays(1) }, "sistema", Ahora));
        e.ProximoVencimientoDeVerificacion.ShouldBe(Ahora.AddDays(1));

        var eventos = e.ExpirarVerificaciones(Ahora.AddDays(2));
        eventos.ShouldHaveSingleItem().ShouldBeOfType<VerificacionExpirada>().Tipo.ShouldBe(TipoVerificacion.Rues);
        e = Aplicar(e, eventos);

        e.BuscarVerificacion(TipoVerificacion.Rues)!.Estado.ShouldBe(EstadoVerificacion.Expirada);
        e.ProximaConsultaOficial.ShouldBe(Ahora.AddDays(2)); // la RUES vencida y la DIAN pendiente se consultan ya
    }

    [Fact]
    public void Solo_el_rues_y_la_dian_se_consultan_y_un_expediente_cerrado_no_recibe_consultas()
    {
        var e = Abrir(RuesBloqueante);
        Codigo(() => e.RegistrarConsultaOficial(TipoVerificacion.ListasRestrictivas, Consulta("ref-1", Rues()), "sistema", Ahora)).ShouldBe("tipo-no-consultable");

        var cerrado = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-1", Rues()), "sistema", Ahora));
        cerrado = Aplicar(cerrado, cerrado.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        cerrado.Estado.ShouldBe(EstadoExpediente.Aprobado);
        Codigo(() => cerrado.RegistrarConsultaOficial(TipoVerificacion.Rues, Consulta("ref-2", Rues()), "sistema", Ahora)).ShouldBe("estado-invalido");
    }

    [Fact]
    public void Una_consulta_sin_que_el_flujo_la_pida_queda_como_informativa()
    {
        var e = Abrir();
        e = Aplicar(e, e.RegistrarConsultaOficial(TipoVerificacion.Dian, Consulta("ref-1", Dian()), "María (consulta manual)", Ahora));

        var dian = e.BuscarVerificacion(TipoVerificacion.Dian)!;
        (dian.Bloqueante, dian.RequeridaPorElFlujo, dian.RegistradaPor).ShouldBe((false, false, "María (consulta manual)"));
    }

    // ---------- Monitoreo ----------

    private Expediente Aprobado(params string[] fuentes)
    {
        var e = Abrir([.. fuentes.Select(f => new VerificacionRequeridaDelFlujo(Enum.Parse<TipoVerificacion>(f)))]);
        foreach (var f in fuentes)
            e = Aplicar(e, e.RegistrarConsultaOficial(Enum.Parse<TipoVerificacion>(f), Consulta($"ref-{f}", Rues()), "sistema", Ahora));
        e = Aplicar(e, e.EmitirVeredicto(_a, _ana, Veredicto.Aprobado, [], null, Ahora));
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);
        return e;
    }

    [Fact]
    public void El_monitoreo_se_inicia_con_lo_consultado_y_solo_si_hay_frecuencia()
    {
        var e = Aprobado("Rues", "Dian");

        MonitoreoDeFuentesOficiales.Iniciar(e, null, 0, Ahora).ShouldBeNull();
        MonitoreoDeFuentesOficiales.Iniciar(Abrir(), null, 30, Ahora).ShouldBeNull();

        var m = MonitoreoDeFuentesOficiales.Iniciar(e, null, 30, Ahora)!;
        m.Fuentes.Select(f => f.Tipo).ShouldBe([TipoVerificacion.Rues, TipoVerificacion.Dian]);
        m.Fuentes.ShouldAllBe(f => !f.Bloqueante && f.Estado == EstadoVerificacion.Satisfecha);
        m.ProximaConsulta.ShouldBe(Ahora.AddDays(30));
        (m.VinculoId, m.PendienteDeCumplimiento).ShouldBe((e.VinculoId, false));
        m.Vence(m.De(TipoVerificacion.Rues)!, Ahora.AddDays(29)).ShouldBeFalse();
        m.Vence(m.De(TipoVerificacion.Rues)!, Ahora.AddDays(30)).ShouldBeTrue();
    }

    [Fact]
    public void La_reconsulta_periodica_avisa_solo_de_las_diferencias_nuevas_hereda_y_se_resuelve_con_justificacion()
    {
        var m = MonitoreoDeFuentesOficiales.Iniciar(Aprobado("Rues"), null, 30, Ahora)!;
        var dia30 = Ahora.AddDays(30);

        var nuevas = m.RegistrarConsulta(TipoVerificacion.Rues, Consulta("m-1", Rues("CANCELADA")), "sistema", dia30);
        nuevas.ShouldHaveSingleItem().Campo.ShouldBe("estado_matricula");
        (m.PendienteDeCumplimiento, m.De(TipoVerificacion.Rues)!.Estado).ShouldBe((true, EstadoVerificacion.CoincidenciaPorAnalizar));
        m.ProximaConsulta.ShouldBe(dia30.AddDays(30));
        m.De(TipoVerificacion.Rues)!.Anteriores.ShouldHaveSingleItem();

        // Mientras nadie la resuelva, la misma diferencia no vuelve a avisar.
        m.RegistrarConsulta(TipoVerificacion.Rues, Consulta("m-2", Rues("CANCELADA")), "sistema", dia30.AddDays(30)).ShouldBeEmpty();
        m.RegistrarConsulta(TipoVerificacion.Rues, Consulta("m-2", Rues("CANCELADA")), "sistema", dia30.AddDays(30)).ShouldBeEmpty(); // idempotente

        var id = m.De(TipoVerificacion.Rues)!.FuenteOficial!.Diferencias.Single().Id;
        Codigo(() => m.ResolverDiferencia(TipoVerificacion.Rues, id, DecisionCoincidencia.Descartada, " ", _oficial, dia30)).ShouldBe("justificacion-requerida");
        Codigo(() => m.ResolverDiferencia(TipoVerificacion.Rues, id, DecisionCoincidencia.Descartada, "x", new Revisor(Guid.NewGuid(), ClaveTercero), dia30)).ShouldBe("conflicto-de-intereses");
        m.ResolverDiferencia(TipoVerificacion.Rues, id, DecisionCoincidencia.Descartada, "Aceptada.", _oficial, dia30);
        (m.PendienteDeCumplimiento, m.De(TipoVerificacion.Rues)!.Estado).ShouldBe((false, EstadoVerificacion.Satisfecha));
        Codigo(() => m.ResolverDiferencia(TipoVerificacion.Rues, id, DecisionCoincidencia.Confirmada, "x", _oficial, dia30)).ShouldBe("diferencia-ya-resuelta");

        // La aceptada se hereda en la siguiente.
        m.RegistrarConsulta(TipoVerificacion.Rues, Consulta("m-3", Rues("CANCELADA")), "sistema", dia30.AddDays(60)).ShouldBeEmpty();
        m.PendienteDeCumplimiento.ShouldBeFalse();
    }

    [Fact]
    public void Un_fallo_en_el_monitoreo_se_reintenta_sin_perder_el_ultimo_resultado_y_un_vinculo_inactivo_lo_detiene()
    {
        var m = MonitoreoDeFuentesOficiales.Iniciar(Aprobado("Rues", "Dian"), null, 30, Ahora)!;
        var reintento = Ahora.AddDays(30).AddMinutes(5);

        m.RegistrarFallo(TipoVerificacion.Rues, "RUES: sin respuesta.", reintento, Ahora.AddDays(30));

        var rues = m.De(TipoVerificacion.Rues)!;
        (rues.Fallos, rues.UltimoError, rues.Estado).ShouldBe((1, "RUES: sin respuesta.", EstadoVerificacion.Satisfecha));
        m.Vence(rues, reintento).ShouldBeTrue();
        m.Vence(m.De(TipoVerificacion.Dian)!, Ahora.AddDays(29)).ShouldBeFalse();
        m.ProximaConsulta.ShouldBe(Ahora.AddDays(30)); // la DIAN, que no falló, vence antes que el reintento de la RUES

        m.Detener(Ahora.AddDays(31));
        m.ProximaConsulta.ShouldBeNull();
    }

    // ---------- Configuración ----------

    [Fact]
    public void Las_credenciales_se_validan_se_cifran_y_la_clave_solo_se_escribe()
    {
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());
        static string Proteger(string clave) => $"vs2.protegida.{clave}";

        empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("rues", "contrato", "convenio-1", "token-secreto-9876", "https://api.confecamaras.example/", "Plan anual"), Proteger, Ahora);
        var credenciales = empresa.CredencialesDe(TipoVerificacion.Rues, ProveedoresDeFuentes.Contrato)!;
        (credenciales.Usuario, credenciales.UltimosCuatroClave, credenciales.TieneClave, credenciales.ClaveProtegida).ShouldBe(
            ("convenio-1", "9876", true, "vs2.protegida.token-secreto-9876"));

        // Sin clave nueva se conserva; con clave vacía se quitan.
        empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Contrato", "convenio-2", null, "https://api.confecamaras.example/", null), Proteger, Ahora);
        empresa.CredencialesDe(TipoVerificacion.Rues, ProveedoresDeFuentes.Contrato)!.ClaveProtegida.ShouldBe("vs2.protegida.token-secreto-9876");
        empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Contrato", null, "", null, null), Proteger, Ahora);
        empresa.CredencialesDe(TipoVerificacion.Rues, ProveedoresDeFuentes.Contrato).ShouldBeNull();

        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Contrato", "u", "abc", null, null), Proteger, Ahora)).ShouldBe("clave-invalida");
        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Contrato", "u", "clave-valida", "http://inseguro", null), Proteger, Ahora)).ShouldBe("url-invalida");
        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Contrato", null, null, null, null), Proteger, Ahora)).ShouldBe("credenciales-vacias");
        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "Simulado", "u", "clave-valida", null, null), Proteger, Ahora)).ShouldBe("proveedor-invalido");
        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Dian", "DatosAbiertos", "u", "clave-valida", null, null), Proteger, Ahora)).ShouldBe("proveedor-invalido");
        Codigo(() => empresa.CambiarCredenciales(new CambioDeCredencialesDeFuente("Sunat", "Contrato", "u", "clave-valida", null, null), Proteger, Ahora)).ShouldBe("fuente-oficial-invalida");
    }

    [Fact]
    public void El_proveedor_se_elige_por_fuente_y_los_datos_abiertos_son_solo_del_rues()
    {
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());

        empresa.ElegirProveedor("Rues", "datosabiertos", Ahora);
        empresa.ElegirProveedor("Dian", "Contrato", Ahora);
        (empresa.ProveedorDe(TipoVerificacion.Rues), empresa.ProveedorDe(TipoVerificacion.Dian)).ShouldBe(("DatosAbiertos", "Contrato"));
        empresa.ElegirProveedor("Rues", "", Ahora);
        empresa.ProveedorDe(TipoVerificacion.Rues).ShouldBeNull();
        Codigo(() => empresa.ElegirProveedor("Dian", "DatosAbiertos", Ahora)).ShouldBe("proveedor-invalido");
        Codigo(() => empresa.ElegirProveedor("Otra", "Contrato", Ahora)).ShouldBe("fuente-oficial-invalida");

        ProveedoresDeFuentes.Para(TipoVerificacion.Rues).ShouldBe(["DatosAbiertos", "Contrato", "Simulado"]);
        ProveedoresDeFuentes.Para(TipoVerificacion.Dian).ShouldBe(["Contrato", "Simulado"]);
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(365, true)]
    [InlineData(-1, false)]
    [InlineData(366, false)]
    public void La_reconsulta_periodica_es_cero_o_de_uno_a_un_ano(int dias, bool valido)
    {
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());

        if (valido)
        {
            empresa.FijarMonitoreo(dias, Ahora);
            empresa.DiasMonitoreo.ShouldBe(dias);
        }
        else
            Codigo(() => empresa.FijarMonitoreo(dias, Ahora)).ShouldBe("monitoreo-invalido");
    }

    [Fact]
    public void La_cuenta_de_la_plataforma_guarda_credenciales_y_el_proveedor_predeterminado_por_fuente()
    {
        var plataforma = new FuentesOficialesDePlataforma();

        plataforma.CambiarCredenciales(new CambioDeCredencialesDeFuente("Rues", "DatosAbiertos", null, "token-datos-gov-1234", null, null), c => $"cifrada.{c}", "operador", Ahora);
        plataforma.ElegirPredeterminado("Rues", "DatosAbiertos", "operador", Ahora);
        plataforma.ElegirPredeterminado("Dian", "Contrato", "operador", Ahora);

        plataforma.CredencialesDe(TipoVerificacion.Rues, ProveedoresDeFuentes.DatosAbiertos)!.UltimosCuatroClave.ShouldBe("1234");
        (plataforma.PredeterminadoDe(TipoVerificacion.Rues), plataforma.PredeterminadoDe(TipoVerificacion.Dian), plataforma.ActualizadaPor).ShouldBe(("DatosAbiertos", "Contrato", "operador"));
        plataforma.ElegirPredeterminado("Dian", null, "operador", Ahora);
        plataforma.PredeterminadoDe(TipoVerificacion.Dian).ShouldBeNull();
    }

    [Theory]
    [InlineData("ACTIVA", EstadoOficial.Vigente)]
    [InlineData("REGISTRO ACTIVO", EstadoOficial.Vigente)]
    [InlineData("Renovada", EstadoOficial.Vigente)]
    [InlineData("CANCELADA", EstadoOficial.NoVigente)]
    [InlineData("SUSPENDIDO", EstadoOficial.NoVigente)]
    [InlineData("INACTIVA", EstadoOficial.NoVigente)]
    [InlineData("NO ACTIVO", EstadoOficial.NoVigente)]
    [InlineData("en liquidación", EstadoOficial.NoVigente)]
    [InlineData("", EstadoOficial.Desconocido)]
    [InlineData("EN TRAMITE", EstadoOficial.Desconocido)]
    public void El_estado_de_la_fuente_se_normaliza_y_lo_que_no_se_entiende_queda_desconocido(string texto, EstadoOficial esperado)
    {
        EstadosOficiales.Normalizar(texto).ShouldBe(esperado);
    }
}
