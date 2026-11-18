using System.Text.Json;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Configuracion;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.Flujos;
using Avalasoft.Dominio.Terceros;
using C = Avalasoft.Dominio.Flujos.CondicionDeExigencia;
using Op = Avalasoft.Dominio.Flujos.OperadorCondicion;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Condiciones sobre la ficha del tercero (EF-1…EF-6, docs/03 §12.2): tabla de casos del evaluador con la especialidad, el CIIU y otros campos declarados, la
/// ampliación por jerarquía (grupo, categoría, especialidad; división, grupo, clase), un dato faltante, la validación al guardar el flujo y el porqué.
/// </summary>
public class CondicionesSobreLaFichaTests
{
    private const string Especialidades = "ficha.especialidades.especialidades";
    private const string Ciiu = "ficha.general.ciiu";
    private const string CiiuPrincipal = "ficha.general.ciiu_principal";
    private const string Responsabilidades = "ficha.tributaria.responsabilidades";
    private const string ResponsableIca = "ficha.tributaria.responsable_ica";
    private const string Persona = AtributosDeExigencia.TipoPersona;

    private static EntradaDeCatalogo Entrada(string codigo, string nombre, int nivel, string? padre = null) => new()
    {
        Id = EntradaDeCatalogo.IdPara(CatalogoDePlataforma.Especialidades, codigo),
        Catalogo = CatalogoDePlataforma.Especialidades,
        Codigo = codigo,
        Nombre = nombre,
        Nivel = nivel,
        Padre = padre,
        Activo = true
    };

    // Obra gris → Concretos → Concreto premezclado y Acabados → Pisos → Cerámica.
    private static readonly CatalogosEnMemoria Catalogos = new(
    [
        Entrada("OG", "Obra gris", 1), Entrada("OG.CON", "Concretos", 2, "OG"), Entrada("OG.CON.PRE", "Concreto premezclado", 3, "OG.CON"),
        Entrada("AC", "Acabados", 1), Entrada("AC.PIS", "Pisos y enchapes", 2, "AC"), Entrada("AC.PIS.CER", "Cerámica y porcelanato", 3, "AC.PIS")
    ]);

    private static IReadOnlyDictionary<string, JsonElement> FichaDe(string? especialidades = null, string? general = null, string? tributaria = null)
    {
        var datos = new Dictionary<string, JsonElement>();
        if (especialidades is not null)
            datos[CodigosDeSeccion.Especialidades] = JsonDocument.Parse(especialidades).RootElement.Clone();
        if (general is not null)
            datos[CodigosDeSeccion.General] = JsonDocument.Parse(general).RootElement.Clone();
        if (tributaria is not null)
            datos[CodigosDeSeccion.Tributaria] = JsonDocument.Parse(tributaria).RootElement.Clone();
        return FichaParaExigencia.Construir(FichaParaExigencia.Declarados(datos), Catalogos);
    }

    private static ContextoDeExigencia Contexto(IReadOnlyDictionary<string, JsonElement>? ficha, TipoPersona persona = TipoPersona.Juridica) =>
        new(persona, "CO", "NIT", false, "PROVEEDOR", new Dictionary<string, JsonElement>(), Ficha: ficha);

    private static C Esp(Op op, params string[] valores) => C.Predicado(Especialidades, op, valores);

    private static readonly IReadOnlyDictionary<string, JsonElement> ConConcreto = FichaDe("""{"especialidades": ["OG.CON.PRE"]}""");
    private static readonly IReadOnlyDictionary<string, JsonElement> ConConcretoYCeramica = FichaDe("""{"especialidades": ["OG.CON.PRE", "AC.PIS.CER"]}""");

    public static TheoryData<string, C, IReadOnlyDictionary<string, JsonElement>?, bool> Casos => new()
    {
        // Especialidades: la declarada de nivel 3 también es de su categoría y de su grupo (las exigencias por grupo y por categoría del SRM).
        { "especialidad exacta", Esp(Op.ContieneAlguno, "OG.CON.PRE"), ConConcreto, true },
        { "categoría de la especialidad", Esp(Op.ContieneAlguno, "OG.CON"), ConConcreto, true },
        { "grupo de la especialidad", Esp(Op.ContieneAlguno, "OG"), ConConcreto, true },
        { "otro grupo", Esp(Op.ContieneAlguno, "AC"), ConConcreto, false },
        { "alguno de varios, uno coincide", Esp(Op.ContieneAlguno, "AC", "OG"), ConConcreto, true },
        { "todos, falta uno", Esp(Op.ContieneTodos, "OG", "AC"), ConConcreto, false },
        { "todos, los dos grupos declarados", Esp(Op.ContieneTodos, "OG", "AC"), ConConcretoYCeramica, true },
        { "todos, grupo y especialidad exacta", Esp(Op.ContieneTodos, "OG", "AC.PIS.CER"), ConConcretoYCeramica, true },
        { "una especialidad declarada «existe»", Esp(Op.Existe), ConConcreto, true },
        // Un dato faltante: «se pide si declara X» no pide; «se pide salvo que declare X» sí pide.
        { "sin especialidades no contiene ninguna", Esp(Op.ContieneAlguno, "OG"), FichaDe(), false },
        { "sin especialidades no contiene todas", Esp(Op.ContieneTodos, "OG"), FichaDe(), false },
        { "sin especialidades no existe", Esp(Op.Existe), FichaDe(), false },
        { "salvo que declare obra gris, sin especialidades", C.Negar(Esp(Op.ContieneAlguno, "OG")), FichaDe(), true },
        { "salvo que declare obra gris, con concreto", C.Negar(Esp(Op.ContieneAlguno, "OG")), ConConcreto, false },
        { "salvo que declare obra gris, con cerámica", C.Negar(Esp(Op.ContieneAlguno, "OG")), FichaDe("""{"especialidades": ["AC.PIS.CER"]}"""), true },
        { "la ficha no está disponible (nula): nada se cumple", Esp(Op.ContieneAlguno, "OG"), null, false },
        { "la ficha no está disponible: «salvo que» sí pide", C.Negar(Esp(Op.ContieneAlguno, "OG")), null, true },
        // Actividad económica: principal y secundarias, con división y grupo.
        { "CIIU: la principal", C.Predicado(Ciiu, Op.ContieneAlguno, "4111"), FichaDe(general: """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}"""), true },
        { "CIIU: una secundaria", C.Predicado(Ciiu, Op.ContieneAlguno, "4290"), FichaDe(general: """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}"""), true },
        { "CIIU: división de la principal (41)", C.Predicado(Ciiu, Op.ContieneAlguno, "41"), FichaDe(general: """{"ciiu_principal": "4111"}"""), true },
        { "CIIU: grupo de la principal (411)", C.Predicado(Ciiu, Op.ContieneAlguno, "411"), FichaDe(general: """{"ciiu_principal": "4111"}"""), true },
        { "CIIU: división de una secundaria (42)", C.Predicado(Ciiu, Op.ContieneAlguno, "42"), FichaDe(general: """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}"""), true },
        { "CIIU: otra división", C.Predicado(Ciiu, Op.ContieneAlguno, "43"), FichaDe(general: """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}"""), false },
        { "CIIU: otra clase del mismo grupo", C.Predicado(Ciiu, Op.ContieneAlguno, "4112"), FichaDe(general: """{"ciiu_principal": "4111"}"""), false },
        { "CIIU principal igual", C.Predicado(CiiuPrincipal, Op.Igual, "4111"), FichaDe(general: """{"ciiu_principal": "4111"}"""), true },
        { "CIIU principal no es una secundaria", C.Predicado(CiiuPrincipal, Op.Igual, "4290"), FichaDe(general: """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}"""), false },
        { "CIIU principal en", C.Predicado(CiiuPrincipal, Op.En, "4111", "4112"), FichaDe(general: """{"ciiu_principal": "4112"}"""), true },
        { "sin actividad no coincide", C.Predicado(Ciiu, Op.ContieneAlguno, "41"), FichaDe(general: """{"razon_social": "Aceros"}"""), false },
        // Responsabilidades del RUT, booleanos y otros campos de catálogo.
        { "autorretenedor (15) entre las responsabilidades", C.Predicado(Responsabilidades, Op.ContieneAlguno, "15"),
            FichaDe(tributaria: """{"responsabilidades": ["05", "15"]}"""), true },
        { "sin la gran contribuyente (13)", C.Predicado(Responsabilidades, Op.ContieneAlguno, "13"), FichaDe(tributaria: """{"responsabilidades": ["05", "15"]}"""), false },
        { "responsable de ICA", C.Predicado(ResponsableIca, Op.Igual, "true"), FichaDe(tributaria: """{"responsable_ica": true}"""), true },
        { "no responsable de ICA no cumple «es responsable»", C.Predicado(ResponsableIca, Op.Igual, "true"), FichaDe(tributaria: """{"responsable_ica": false}"""), false },
        { "sin declarar ICA tampoco es «responsable»", C.Predicado(ResponsableIca, Op.Igual, "true"), FichaDe(tributaria: """{"responsabilidades": ["05"]}"""), false },
        { "sin declarar ICA «no es responsable» sí cumple", C.Predicado(ResponsableIca, Op.Distinto, "true"), FichaDe(tributaria: """{"responsabilidades": ["05"]}"""), true },
        // El modelo tributario de los demás países (Panamá, República Dominicana…): régimen, impuesto a las ventas y retenciones.
        { "régimen fuera de Colombia", C.Predicado("ficha.tributaria.regimen", Op.En, "ZONA_LIBRE", "ZONA_FRANCA"), FichaDe(tributaria: """{"regimen": "ZONA_LIBRE"}"""), true },
        { "otro régimen", C.Predicado("ficha.tributaria.regimen", Op.Igual, "GENERAL"), FichaDe(tributaria: """{"regimen": "ZONA_LIBRE"}"""), false },
        { "exento de retenciones", C.Predicado("ficha.tributaria.exento_de_retenciones", Op.Igual, "true"), FichaDe(tributaria: """{"exento_de_retenciones": true}"""), true },
        { "agente de retención sin declarar no cumple «es agente»", C.Predicado("ficha.tributaria.agente_de_retencion", Op.Igual, "true"),
            FichaDe(tributaria: """{"regimen": "GENERAL"}"""), false },
        { "contribuyente del impuesto a las ventas", C.Predicado("ficha.tributaria.contribuyente_impuesto_ventas", Op.Igual, "true"),
            FichaDe(tributaria: """{"contribuyente_impuesto_ventas": true}"""), true },
        { "ciudad", C.Predicado("ficha.general.ciudad", Op.En, "05001", "11001"), FichaDe(general: """{"ciudad": "11001"}"""), true },
        { "país del domicilio", C.Predicado("ficha.general.pais", Op.Igual, "PE"), FichaDe(general: """{"pais": "PE"}"""), true },
        // Combinaciones con el resto del motor.
        { "jurídica Y obra gris", C.Todas(C.Predicado(Persona, Op.Igual, "Juridica"), Esp(Op.ContieneAlguno, "OG")), ConConcreto, true },
        { "obra gris O acabados, con cerámica", C.Alguna(Esp(Op.ContieneAlguno, "OG"), Esp(Op.ContieneAlguno, "AC")), FichaDe("""{"especialidades": ["AC.PIS.CER"]}"""), true },
        { "obra gris Y gran contribuyente, falta la responsabilidad",
            C.Todas(Esp(Op.ContieneAlguno, "OG"), C.Predicado(Responsabilidades, Op.ContieneAlguno, "13")), ConConcreto, false },
    };

    [Theory]
    [MemberData(nameof(Casos))]
    public void Evalua_la_tabla_de_casos(string caso, C condicion, IReadOnlyDictionary<string, JsonElement>? ficha, bool aplica) =>
        EvaluadorDeExigencia.Aplica(condicion, Contexto(ficha)).ShouldBe(aplica, caso);

    [Fact]
    public void Una_persona_natural_no_cumple_una_condicion_de_juridica_aunque_declare_la_especialidad()
    {
        var condicion = C.Todas(C.Predicado(Persona, Op.Igual, "Juridica"), Esp(Op.ContieneAlguno, "OG"));
        EvaluadorDeExigencia.Aplica(condicion, Contexto(ConConcreto, TipoPersona.Natural)).ShouldBeFalse();
    }

    [Fact]
    public void Filtrar_pide_el_documento_de_la_especialidad_solo_a_quien_la_declara_y_deja_lo_demas()
    {
        RequisitoDelFlujo R(string codigo, C? condicion = null) => new(Guid.NewGuid(), Guid.NewGuid(), codigo, true, [], null, condicion);
        var requisitos = new[]
        {
            R("RUT"), R("LICENCIA_DE_CONSTRUCCION", Esp(Op.ContieneAlguno, "OG")), R("CERTIFICADO_DE_ALTURAS", Esp(Op.ContieneAlguno, "OG.CON.PRE")),
            R("CATALOGO_DE_PRODUCTOS", Esp(Op.ContieneAlguno, "AC"))
        };

        EvaluadorDeExigencia.Filtrar(requisitos, Contexto(ConConcreto)).Select(r => r.CodigoTipo)
            .ShouldBe(["RUT", "LICENCIA_DE_CONSTRUCCION", "CERTIFICADO_DE_ALTURAS"]);
        EvaluadorDeExigencia.Filtrar(requisitos, Contexto(ConConcretoYCeramica)).Select(r => r.CodigoTipo)
            .ShouldBe(["RUT", "LICENCIA_DE_CONSTRUCCION", "CERTIFICADO_DE_ALTURAS", "CATALOGO_DE_PRODUCTOS"]);
        EvaluadorDeExigencia.Filtrar(requisitos, Contexto(FichaDe())).Select(r => r.CodigoTipo).ShouldBe(["RUT"]);
        EvaluadorDeExigencia.Filtrar(requisitos, Contexto(null)).Select(r => r.CodigoTipo).ShouldBe(["RUT"]);
    }

    // ---------- lo que la ficha le dice al motor ----------

    [Fact]
    public void Lee_lo_declarado_normalizado_y_sin_repetidos_e_ignora_lo_que_no_es_exigible()
    {
        var datos = new Dictionary<string, JsonElement>
        {
            [CodigosDeSeccion.General] = JsonDocument.Parse("""
                {"razon_social": "Aceros S.A.S.", "ciiu_principal": "4111", "ciiu_secundarias": ["4290", "4111"], "ciudad": "11001", "pais": "co",
                 "certificado_iso": true, "correo": "a@b.co"}
                """).RootElement.Clone(),
            [CodigosDeSeccion.Especialidades] = JsonDocument.Parse("""{"especialidades": ["og.con.pre", "OG.CON.PRE", ""]}""").RootElement.Clone(),
            [CodigosDeSeccion.Tributaria] = JsonDocument.Parse("""{"responsabilidades": ["5", "15"], "responsable_ica": false, "exento_rete_cree": null}""").RootElement.Clone()
        };

        var declarados = FichaParaExigencia.Declarados(datos);

        declarados[Ciiu].ShouldBe(["4111", "4290"]);
        declarados[CiiuPrincipal].ShouldBe(["4111"]);
        declarados["ficha.general.ciudad"].ShouldBe(["11001"]);
        declarados["ficha.general.pais"].ShouldBe(["CO"]);
        declarados["ficha.general.certificado_iso"].ShouldBe(["true"]);
        declarados[Especialidades].ShouldBe(["OG.CON.PRE"]);
        declarados[Responsabilidades].ShouldBe(["05", "15"]);
        declarados[ResponsableIca].ShouldBe(["false"]);
        declarados.ContainsKey("ficha.tributaria.exento_rete_cree").ShouldBeFalse(); // nulo = sin diligenciar
        declarados.Keys.ShouldNotContain(k => k.Contains("razon_social") || k.Contains("correo")); // el nombre y el contacto no son exigibles
    }

    [Fact]
    public void Amplia_la_especialidad_con_su_categoria_y_su_grupo_y_el_CIIU_con_su_grupo_y_su_division()
    {
        var ficha = FichaDe("""{"especialidades": ["OG.CON.PRE"]}""", """{"ciiu_principal": "4111", "ciiu_secundarias": ["4290"]}""");

        ficha[Especialidades].EnumerateArray().Select(e => e.GetString()).ShouldBe(["OG.CON.PRE", "OG.CON", "OG"]);
        ficha[Ciiu].EnumerateArray().Select(e => e.GetString()).ShouldBe(["4111", "4290", "411", "41", "429", "42"], ignoreOrder: true);
        ficha[CiiuPrincipal].GetString().ShouldBe("4111"); // la principal no se amplía: es la clase exacta
    }

    [Fact]
    public void Una_especialidad_fuera_del_catalogo_se_conserva_sin_ancestros()
    {
        var ficha = FichaDe("""{"especialidades": ["ZZ.NUEVA"]}""");
        ficha[Especialidades].EnumerateArray().Select(e => e.GetString()).ShouldBe(["ZZ.NUEVA"]);
        EvaluadorDeExigencia.Aplica(Esp(Op.ContieneAlguno, "ZZ.NUEVA"), Contexto(ficha)).ShouldBeTrue();
    }

    [Fact]
    public void Las_referencias_a_cargar_son_las_especialidades_declaradas_y_sus_padres_la_ronda_siguiente()
    {
        var datos = new Dictionary<string, JsonElement>
        {
            [CodigosDeSeccion.Especialidades] = JsonDocument.Parse("""{"especialidades": ["OG.CON.PRE", "AC.PIS.CER"]}""").RootElement.Clone(),
            [CodigosDeSeccion.General] = JsonDocument.Parse("""{"ciiu_principal": "4111"}""").RootElement.Clone()
        };

        var referencias = FichaParaExigencia.Referencias(FichaParaExigencia.Declarados(datos));

        referencias.ShouldBe([new ReferenciaACatalogo(CatalogoDePlataforma.Especialidades, "OG.CON.PRE"),
            new ReferenciaACatalogo(CatalogoDePlataforma.Especialidades, "AC.PIS.CER")]); // el CIIU se amplía por prefijo: no necesita catálogo
        FichaParaExigencia.Padres([Entrada("OG.CON.PRE", "Concreto premezclado", 3, "OG.CON"), Entrada("OG", "Obra gris", 1)])
            .ShouldBe([new ReferenciaACatalogo(CatalogoDePlataforma.Especialidades, "OG.CON")]);
    }

    // ---------- validación al guardar el flujo ----------

    private static readonly TipoVinculo Proveedor = TipoVinculo.Semilla().Single(t => t.Codigo == "PROVEEDOR");

    private static string Invalida(C condicion, IReadOnlyList<AtributoDeRespuesta>? respuestas = null) =>
        Should.Throw<ReglaDeNegocioException>(() => AtributosDeExigencia.Validar(condicion, Proveedor, "Licencia de construcción", respuestas)).Codigo;

    [Fact]
    public void Normaliza_los_codigos_de_la_ficha_y_acepta_los_operadores_de_cada_tipo()
    {
        var normalizada = AtributosDeExigencia.Validar(C.Todas(
            Esp(Op.ContieneAlguno, " og.con ", "OG", "og"),
            C.Predicado(Ciiu, Op.ContieneAlguno, "41", "4290"),
            C.Predicado(CiiuPrincipal, Op.En, "4111"),
            C.Predicado(Responsabilidades, Op.ContieneTodos, "5", "15"),
            C.Predicado(ResponsableIca, Op.Igual, "True"),
            C.Predicado("ficha.general.ciudad", Op.Distinto, "11001"),
            C.Predicado("ficha.general.pais", Op.Igual, "pe"),
            Esp(Op.Existe),
            C.Predicado("ficha.tributaria.regimen", Op.En, "zona_libre", "ZONA_FRANCA")), Proveedor, "Licencia de construcción")!;

        normalizada.Nodos![8].Valores.ShouldBe(["ZONA_LIBRE", "ZONA_FRANCA"]);

        normalizada.Nodos![0].Valores.ShouldBe(["OG.CON", "OG"]);
        normalizada.Nodos[1].Valores.ShouldBe(["41", "4290"]);
        normalizada.Nodos[3].Valores.ShouldBe(["05", "15"]);
        normalizada.Nodos[4].Valores.ShouldBe(["true"]);
        normalizada.Nodos[6].Valores.ShouldBe(["PE"]);
        normalizada.Nodos[7].Valores.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("ficha.general.razon_social", Op.Igual, "Aceros")] // el nombre no es un campo exigible
    [InlineData("ficha.general.correo", Op.Existe, null)]
    [InlineData("ficha.legal.personas", Op.ContieneAlguno, "X")]
    [InlineData("ficha.especialidades", Op.ContieneAlguno, "OG")] // falta el campo
    [InlineData("ficha.especialidades.especialidades", Op.Igual, "OG")] // una lista no se compara con «es»
    [InlineData("ficha.especialidades.especialidades", Op.En, "OG")]
    [InlineData("ficha.tributaria.responsable_ica", Op.ContieneAlguno, "true")] // un sí/no no es una lista
    [InlineData("ficha.tributaria.responsable_ica", Op.Igual, "quizás")]
    [InlineData("ficha.general.ciudad", Op.ContieneAlguno, "11001")] // una opción no se recorre como lista
    [InlineData("ficha.especialidades.especialidades", Op.ContieneAlguno, "og con pre")] // formato de código inválido
    [InlineData("ficha.general.ciiu", Op.ContieneAlguno, "41111")] // CIIU: de dos a cuatro dígitos
    [InlineData("ficha.general.ciiu", Op.ContieneAlguno, "4")]
    [InlineData("ficha.general.ciiu", Op.ContieneAlguno, "ABCD")]
    [InlineData("ficha.general.ciudad", Op.Igual, "1100")] // DANE de cinco dígitos
    [InlineData("ficha.general.pais", Op.Igual, "COL")]
    [InlineData("ficha.tributaria.regimen", Op.Igual, "zona libre")] // MAYÚSCULAS_Y_GUIONES_BAJOS, sin espacios
    [InlineData("ficha.tributaria.exento_de_retenciones", Op.ContieneAlguno, "true")]
    public void Rechaza_lo_que_no_es_un_campo_exigible_su_operador_o_su_valor(string atributo, Op operador, string? valor) =>
        Invalida(C.Predicado(atributo, operador, valor is null ? [] : [valor])).ShouldBe("condicion-invalida");

    [Fact]
    public void Las_condiciones_de_un_cuestionario_no_miran_la_ficha()
    {
        // Los cuestionarios se evalúan con respuestas (CE-7): su visibilidad solo mira tercero.*, vinculo.tipo y las respuestas anteriores.
        Invalida(Esp(Op.ContieneAlguno, "OG"), []).ShouldBe("condicion-invalida");
    }

    [Fact]
    public void Detecta_si_una_condicion_mira_la_ficha_y_que_valores_cita()
    {
        AtributosDeExigencia.MencionaFicha(null).ShouldBeFalse();
        AtributosDeExigencia.MencionaFicha(C.Predicado(Persona, Op.Igual, "Juridica")).ShouldBeFalse();
        AtributosDeExigencia.MencionaFicha(C.Todas(C.Predicado(Persona, Op.Igual, "Juridica"), C.Negar(Esp(Op.ContieneAlguno, "OG")))).ShouldBeTrue();

        var citas = AtributosDeExigencia.ComparacionesDeFicha(C.Alguna(Esp(Op.ContieneAlguno, "OG", "AC"), C.Predicado(ResponsableIca, Op.Igual, "true"),
            C.Predicado(Persona, Op.Igual, "Juridica"))).ToList();
        citas.Select(c => (c.Campo.Ruta, string.Join(",", c.Valores))).ShouldBe([(Especialidades, "OG,AC"), (ResponsableIca, "true")]);
    }

    [Fact]
    public void Cada_campo_ofrece_los_operadores_de_su_tipo()
    {
        var por = CamposDeFicha.Todos.ToDictionary(c => c.Ruta, c => AtributosDeExigencia.OperadoresDe(c).Order().ToList());

        por[Especialidades].ShouldBe([Op.ContieneAlguno, Op.ContieneTodos, Op.Existe]);
        por[ResponsableIca].ShouldBe([Op.Igual, Op.Distinto, Op.Existe]);
        por["ficha.general.ciudad"].ShouldBe([Op.Igual, Op.Distinto, Op.En, Op.NoEn, Op.Existe]);
        CamposDeFicha.Todos.Select(c => c.Ruta).ShouldAllBe(r => r.StartsWith("ficha.", StringComparison.Ordinal));
        CamposDeFicha.Todos.Select(c => c.Ruta).Distinct().Count().ShouldBe(CamposDeFicha.Todos.Count);
    }

    // ---------- el porqué ----------

    [Fact]
    public void Dice_que_valores_declarados_hicieron_que_se_pida_y_no_explica_negaciones()
    {
        var contexto = Contexto(ConConcretoYCeramica);

        var simple = EvaluadorDeExigencia.Coincidencias(Esp(Op.ContieneAlguno, "OG", "AC", "XX"), contexto).ShouldHaveSingleItem();
        simple.Campo.Ruta.ShouldBe(Especialidades);
        simple.Valores.ShouldBe(["OG", "AC"]); // lo de la condición que el tercero tiene declarado (por su grupo)

        var conO = C.Alguna(Esp(Op.ContieneAlguno, "ZZ"), C.Predicado(ResponsableIca, Op.Igual, "true"), Esp(Op.ContieneAlguno, "OG.CON"));
        EvaluadorDeExigencia.Coincidencias(conO, contexto).Select(c => c.Campo.Ruta).ShouldBe([Especialidades]); // las del «O» que no se cumplen no cuentan

        var conY = C.Todas(C.Predicado(Persona, Op.Igual, "Juridica"), Esp(Op.ContieneTodos, "OG", "AC"), C.Negar(Esp(Op.ContieneAlguno, "ZZ")));
        var coincidencias = EvaluadorDeExigencia.Coincidencias(conY, contexto);
        coincidencias.ShouldHaveSingleItem().Valores.ShouldBe(["OG", "AC"]); // la negación y el tipo de persona no se explican

        EvaluadorDeExigencia.Coincidencias(null, contexto).ShouldBeEmpty();
        EvaluadorDeExigencia.Coincidencias(C.Negar(Esp(Op.ContieneAlguno, "ZZ")), contexto).ShouldBeEmpty();
    }

    [Fact]
    public void Con_igual_o_en_los_valores_son_los_que_coinciden_y_con_existe_solo_se_sabe_que_declaro_el_campo()
    {
        var contexto = Contexto(FichaDe(general: """{"ciiu_principal": "4111", "pais": "CO"}""", tributaria: """{"responsable_ica": true}"""));

        EvaluadorDeExigencia.Coincidencias(C.Predicado(CiiuPrincipal, Op.En, "4112", "4111"), contexto).ShouldHaveSingleItem().Valores.ShouldBe(["4111"]);
        EvaluadorDeExigencia.Coincidencias(C.Predicado(ResponsableIca, Op.Igual, "true"), contexto).ShouldHaveSingleItem().Valores.ShouldBe(["true"]);
        EvaluadorDeExigencia.Coincidencias(C.Predicado("ficha.general.pais", Op.Distinto, "PE"), contexto).ShouldHaveSingleItem().Valores.ShouldBeEmpty();
        EvaluadorDeExigencia.Coincidencias(C.Predicado(Ciiu, Op.Existe), contexto).ShouldHaveSingleItem().Valores.ShouldBeEmpty();
    }

    // ---------- selección del flujo por la ficha (FR-1 con la ficha) ----------

    private static readonly Guid Empresa = Guid.NewGuid();
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-5));

    private static Flujo Publicado(string codigo, C? condicion = null, int? prioridad = null)
    {
        List<Area> areas = [Area.Crear(Empresa, "COMPRAS", "Compras")];
        var definicion = DefinicionDeFlujo.TodasEnParalelo(areas) with
        {
            Seleccion = condicion is null ? null : new SeleccionDeFlujo(condicion, prioridad)
        };
        var flujo = Flujo.Crear(Empresa, codigo, "Flujo " + codigo, Proveedor.Id, definicion, areas, Ahora, null, Proveedor);
        flujo.Publicar(areas, Ahora, null, Proveedor);
        return flujo;
    }

    [Fact]
    public void Un_flujo_se_escoge_por_la_especialidad_declarada_y_sin_la_ficha_cae_al_por_defecto()
    {
        var defecto = Publicado("DEFECTO");
        var obra = Publicado("OBRA", Esp(Op.ContieneAlguno, "OG"), 1);
        var flujos = new[] { defecto, obra };

        var conObra = EvaluadorDeSeleccion.Seleccionar(flujos, defecto, Contexto(ConConcreto));
        (conObra.Flujo!.Codigo, conObra.Origen).ShouldBe(("OBRA", OrigenFlujo.Regla));
        conObra.Regla!.Condicion.Atributo.ShouldBe(Especialidades); // la condición queda registrada como estaba en la versión publicada

        EvaluadorDeSeleccion.Seleccionar(flujos, defecto, Contexto(FichaDe("""{"especialidades": ["AC.PIS.CER"]}"""))).Flujo!.Codigo.ShouldBe("DEFECTO");
        EvaluadorDeSeleccion.Seleccionar(flujos, defecto, Contexto(null)).Flujo!.Codigo.ShouldBe("DEFECTO"); // aún no aceptó: la ficha no se ve
    }

    [Fact]
    public void Una_regla_de_seleccion_con_un_campo_inexistente_de_la_ficha_se_rechaza_al_guardar()
    {
        Should.Throw<ReglaDeNegocioException>(() => Publicado("MAL", C.Predicado("ficha.general.nombre", Op.Igual, "x"), 1)).Codigo.ShouldBe("condicion-invalida");
    }
}
