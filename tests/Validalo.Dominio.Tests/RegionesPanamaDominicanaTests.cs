using System.Text.Json;
using Validalo.Aplicacion.Expedientes;
using Validalo.Aplicacion.Ficha;
using Validalo.Aplicacion.Ia;
using Validalo.Aplicacion.Plataforma;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Documentos;
using Validalo.Dominio.Expedientes;
using Validalo.Dominio.Ficha;
using Validalo.Dominio.Identificaciones;
using Validalo.Dominio.Terceros;

namespace Validalo.Dominio.Tests;

/// <summary>
/// Regiones del SRM que faltaban (RG-1…RG-11, registro 5-septuagies): Panamá y República Dominicana en el catálogo de identificaciones, la
/// ficha tributaria por país, los documentos equivalentes y lo que la lectura automática (IA, cruce, RUES y DIAN) cubre solo en Colombia.
/// </summary>
public class RegionesPanamaDominicanaTests
{
    private static readonly DateOnly Hoy = new(2026, 11, 14);
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 15, 0, 0, TimeSpan.Zero);

    private static readonly ContextoDeSeccion Colombia = new(TipoPersona.Juridica, Identificacion.Crear("CO", "NIT", "900373913"), null, Hoy);
    private static readonly ContextoDeSeccion Panama = new(TipoPersona.Juridica, Identificacion.Crear("PA", "RUC", "155612345-2-2019"), null, Hoy);
    private static readonly ContextoDeSeccion PanamaConDv = new(TipoPersona.Juridica, Identificacion.Crear("PA", "RUC", "155612345-2-2019", "56"), null, Hoy);
    private static readonly ContextoDeSeccion Dominicana = new(TipoPersona.Juridica, Identificacion.Crear("DO", "RNC", "101850043"), null, Hoy);
    private static readonly ContextoDeSeccion Chile = new(TipoPersona.Juridica, Identificacion.Crear("CL", "RUT", "12345678"), null, Hoy);

    private static readonly ICatalogosDeFicha Catalogos = CatalogosDeSemilla();

    private static ICatalogosDeFicha CatalogosDeSemilla()
    {
        var entradas = new List<EntradaDeCatalogo>();
        foreach (var (catalogo, filas) in SemillaDeCatalogos.Todas)
        {
            var niveles = new Dictionary<string, int>();
            foreach (var fila in filas.OrderBy(f => f.Nivel ?? 0))
            {
                var (entrada, rechazo) = ReglasDeCatalogo.Validar(catalogo, fila, p => niveles.TryGetValue(p, out var n) ? n : null, Ahora);
                rechazo.ShouldBeNull();
                if (entrada!.Nivel is { } nivel)
                    niveles[entrada.Codigo] = nivel;
                entradas.Add(entrada);
            }
        }

        return new CatalogosEnMemoria(entradas);
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static object Leer(string seccion, string json, ContextoDeSeccion contexto) =>
        ReglasDeFicha.Leer(CatalogoDeSecciones.Requerida(seccion), Json(json), contexto);

    private static ResultadoDeRegla Evaluar(string seccion, string json, ContextoDeSeccion contexto) =>
        ReglasDeFicha.Evaluar(CatalogoDeSecciones.Requerida(seccion), Leer(seccion, json, contexto), contexto, Catalogos, false, 0);

    private static IEnumerable<string?> Faltantes(ResultadoDeRegla r) => r.Completitud.Faltantes.Select(f => f.Campo ?? f.Regla);

    private static (string, string?) Codigo(Action accion)
    {
        var error = Should.Throw<ReglaDeNegocioException>(accion);
        return (error.Codigo, error.Datos?.GetValueOrDefault("campo") as string);
    }

    // ---------- Catálogo de identificaciones (RG-2) ----------

    [Fact]
    public void El_catalogo_trae_Panama_y_Republica_Dominicana_con_sus_tipos_y_los_genericos()
    {
        CatalogoIdentificacion.Paises.Select(p => p.Codigo).ShouldContain("PA");
        CatalogoIdentificacion.Paises.Select(p => p.Codigo).ShouldContain("DO");
        CatalogoIdentificacion.TiposDe("PA").Select(t => t.Codigo).ShouldBe(["RUC", "CIP", "PASAPORTE", "ID_FISCAL"]);
        CatalogoIdentificacion.TiposDe("DO").Select(t => t.Codigo).ShouldBe(["RNC", "CED", "PASAPORTE", "ID_FISCAL"]);
        CatalogosEndpoints.Paises().Single(p => p.Codigo == "DO").TiposIdentificacion.Select(t => t.Codigo).ShouldBe(["RNC", "CED", "PASAPORTE", "ID_FISCAL"]);
    }

    // Verificados con el algoritmo de la DGII: pesos 7, 9, 8, 6, 5, 4, 3, 2; residuo 0 ⇒ 2, 1 ⇒ 1, otro ⇒ 11 − residuo.
    [Theory]
    [InlineData("10185004", "3")] // 1-01-85004-3, Banco BHD León
    [InlineData("40100000", "8")]
    [InlineData("10000100", "2")] // residuo 0
    [InlineData("10001000", "1")] // residuo 1
    public void El_digito_de_control_del_RNC_dominicano_es_el_de_la_DGII(string primerosOcho, string control)
    {
        DigitoVerificacion.RncDominicano(primerosOcho).ShouldBe(control);
        var rnc = primerosOcho + control;
        Identificacion.Crear("DO", "RNC", rnc).Clave.ShouldBe($"DO|RNC|{rnc}");
    }

    [Theory]
    [InlineData("101850042")] // dígito de control equivocado
    [InlineData("101850044")]
    public void Un_RNC_con_el_digito_de_control_equivocado_se_rechaza(string rnc) =>
        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear("DO", "RNC", rnc)).Codigo.ShouldBe("digito-verificacion-invalido");

    [Theory]
    [InlineData("1-01-85004-3", "101850043")]
    [InlineData(" 101 850 043 ", "101850043")]
    public void El_RNC_se_normaliza_sin_guiones_y_no_lleva_dv_aparte(string escrito, string normalizado)
    {
        var id = Identificacion.Crear("do", "rnc", escrito);
        id.Numero.ShouldBe(normalizado);
        id.DigitoVerificacion.ShouldBeNull();
        CatalogoIdentificacion.Buscar("DO", "RNC")!.TieneDv.ShouldBeFalse();
    }

    [Theory]
    [InlineData("00113918205")]
    [InlineData("001-1391820-5")]
    [InlineData("40200000004")]
    public void La_cedula_dominicana_pasa_el_control_de_Luhn(string cedula) =>
        Identificacion.Crear("DO", "CED", cedula).Numero.ShouldBe(cedula.Replace("-", string.Empty));

    [Theory]
    [InlineData("DO", "CED", "00113918204", "digito-verificacion-invalido")]
    [InlineData("DO", "CED", "1234567", "numero-identificacion-invalido")]
    [InlineData("DO", "RNC", "12345678", "numero-identificacion-invalido")] // ni 9 ni 11 dígitos
    [InlineData("DO", "RNC", "ABC123456", "numero-identificacion-invalido")]
    public void Rechaza_numeros_dominicanos_invalidos(string pais, string tipo, string numero, string codigo) =>
        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear(pais, tipo, numero)).Codigo.ShouldBe(codigo);

    [Fact]
    public void Un_RNC_de_once_digitos_es_la_cedula_de_una_persona_fisica_y_pasa_el_mismo_control()
    {
        Identificacion.Crear("DO", "RNC", "00113918205").Numero.ShouldBe("00113918205");
        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear("DO", "RNC", "00113918204")).Codigo.ShouldBe("digito-verificacion-invalido");
    }

    [Theory]
    [InlineData("RUC", "8-123-456")]
    [InlineData("RUC", "155612345-2-2019")]
    [InlineData("RUC", "PE-12-345")]
    [InlineData("CIP", "8-123-456")]
    [InlineData("CIP", "PE-12-345")]
    [InlineData("CIP", "E-8-123456")]
    [InlineData("CIP", "N-12-345")]
    [InlineData("CIP", "8-AV-123-456")]
    [InlineData("CIP", "13-1234-12345")]
    public void Acepta_los_formatos_panamenos_y_los_normaliza_sin_guiones(string tipo, string numero)
    {
        var id = Identificacion.Crear("PA", tipo, numero);
        id.Numero.ShouldBe(numero.Replace("-", string.Empty));
        id.DigitoVerificacion.ShouldBeNull();
    }

    [Theory]
    [InlineData("RUC", "ABC")]
    [InlineData("RUC", "12")]
    [InlineData("CIP", "PE-1")]
    [InlineData("CIP", "155612345-2-2019")] // una cédula no es un RUC jurídico
    public void Rechaza_formatos_panamenos_invalidos(string tipo, string numero) =>
        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear("PA", tipo, numero)).Codigo.ShouldBe("numero-identificacion-invalido");

    [Fact]
    public void El_DV_del_RUC_panameno_lo_declara_el_tercero_son_dos_digitos_y_no_entra_en_la_clave()
    {
        var tipo = CatalogoIdentificacion.Buscar("PA", "RUC")!;
        (tipo.TieneDv, tipo.DvDeclarado).ShouldBe((false, true));

        var sinDv = Identificacion.Crear("PA", "RUC", "8-123-456");
        var conDv = Identificacion.Crear("PA", "RUC", "8-123-456", " 56 ");
        sinDv.DigitoVerificacion.ShouldBeNull();
        conDv.DigitoVerificacion.ShouldBe("56");
        conDv.Clave.ShouldBe(sinDv.Clave);
        conDv.Clave.ShouldBe("PA|RUC|8123456");

        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear("PA", "RUC", "8-123-456", "5")).Codigo.ShouldBe("digito-verificacion-invalido");
        Should.Throw<ReglaDeNegocioException>(() => Identificacion.Crear("PA", "RUC", "8-123-456", "AB")).Codigo.ShouldBe("digito-verificacion-invalido");
    }

    [Fact]
    public void Un_tercero_se_crea_con_los_tipos_de_los_nuevos_paises_y_respeta_a_quien_aplican()
    {
        Tercero.Crear(Identificacion.Crear("DO", "RNC", "101850043"), TipoPersona.Juridica, "Banco BHD León", null, null, Ahora).EsExtranjero.ShouldBeTrue();
        Tercero.Crear(Identificacion.Crear("PA", "CIP", "8-123-456"), TipoPersona.Natural, "Ana Pérez", null, null, Ahora).Identificacion.Clave.ShouldBe("PA|CIP|8123456");
        Should.Throw<ReglaDeNegocioException>(() => Tercero.Crear(Identificacion.Crear("DO", "CED", "00113918205"), TipoPersona.Juridica, "X", null, null, Ahora))
            .Codigo.ShouldBe("tipo-identificacion-no-aplica");
    }

    [Fact]
    public void Colombia_y_los_demas_paises_siguen_validando_como_antes()
    {
        Identificacion.Crear("CO", "NIT", "800197268").DigitoVerificacion.ShouldBe("4");
        Identificacion.Crear("CL", "RUT", "12345678").DigitoVerificacion.ShouldBe("5");
        CatalogoIdentificacion.Buscar("CO", "NIT")!.TieneDv.ShouldBeTrue();
        CatalogoIdentificacion.Buscar("CL", "RUT")!.TieneDv.ShouldBeTrue();
        CatalogoIdentificacion.Buscar("CO", "PA")!.Nombre.ShouldBe("Pasaporte"); // el «PA» de Colombia es el pasaporte, no el país Panamá
    }

    // ---------- Tipos de las personas relacionadas ----------

    [Fact]
    public void Una_persona_se_valida_con_el_catalogo_de_su_pais_el_del_tercero_y_el_de_Colombia()
    {
        CatalogoIdentificacion.PaisParaTipo("CED", "DO").ShouldBe("DO");
        CatalogoIdentificacion.PaisParaTipo("CIP", "PA").ShouldBe("PA");
        CatalogoIdentificacion.PaisParaTipo("CC", "DO").ShouldBe("CO");
        CatalogoIdentificacion.PaisParaTipo("PASAPORTE", "DO").ShouldBe("DO");
        CatalogoIdentificacion.PaisParaTipo("PASAPORTE").ShouldBe("CO");
        CatalogoIdentificacion.PaisParaTipo("CED", "PA").ShouldBeNull(); // la cédula dominicana no es de un tercero panameño
        CatalogoIdentificacion.PaisParaTipo("RUC", "CO").ShouldBeNull();
        CatalogoIdentificacion.PaisParaTipo("RUC", "PA").ShouldBe("PA");
        CatalogoIdentificacion.PaisParaTipo("RUC", "PE").ShouldBe("PE");
        CatalogoIdentificacion.TiposParaPersona("DO").ShouldBe(["CC", "CE", "CED", "ID_FISCAL", "NIT", "PA", "PASAPORTE", "PPT", "RNC", "TI"]);
        CatalogoIdentificacion.TiposParaPersona("CO").ShouldBe(["CC", "CE", "ID_FISCAL", "NIT", "PA", "PASAPORTE", "PPT", "TI"]);
    }

    [Theory]
    [InlineData("NIT", "900373913", true)]
    [InlineData("RNC", "101850043", true)]
    [InlineData("RNC", "00113918205", false)] // la cédula de una persona física usada como RNC
    [InlineData("RUC", "155612345-2-2019", true)]
    [InlineData("RUC", "8-123-456", false)] // el RUC de una persona natural panameña es su cédula
    [InlineData("CC", "79123456", false)]
    public void Reconoce_cuando_el_numero_fiscal_es_de_una_sociedad(string tipo, string numero, bool esperado) =>
        CatalogoIdentificacion.EsDeSociedad(tipo, numero).ShouldBe(esperado);

    private static string Persona(string rol, string tipo, string numero, string nombres, string? apellidos, string extra = "")
    {
        var apellido = apellidos is null ? string.Empty : $", \"apellidos\": \"{apellidos}\"";
        return $"{{ \"rol\": \"{rol}\", \"tipo_identificacion\": \"{tipo}\", \"numero\": \"{numero}\", \"nombres\": \"{nombres}\"{apellido}, \"pep\": false, \"vinculo_pep\": false{extra} }}";
    }

    [Fact]
    public void La_legal_de_una_empresa_dominicana_admite_cedula_y_RNC_y_pide_razon_social_a_la_sociedad()
    {
        var representante = Persona("RepresentanteLegal", "CED", "001-1391820-5", "Ana", "Pérez");
        var socio = Persona("Socio", "RNC", "101-85004-3", "Inversiones del Caribe S.R.L.", null, ", \"porcentaje\": 100");
        var r = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{representante}}, {{socio}}] }""", Dominicana);

        r.Errores.ShouldBeEmpty();
        Faltantes(r).ShouldBeEmpty();
        var datos = (DatosLegales)Leer(CodigosDeSeccion.Legal, $$"""{ "personas": [{{representante}}, {{socio}}] }""", Dominicana);
        datos.Personas!.Select(p => p.Numero).ShouldBe(["00113918205", "101850043"]);
        datos.Personas!.ShouldAllBe(p => p.Dv == null);
    }

    [Fact]
    public void Una_cedula_con_el_control_equivocado_o_un_tipo_de_otro_pais_se_rechaza_en_la_legal()
    {
        var mala = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{Persona("RepresentanteLegal", "CED", "00113918204", "Ana", "Pérez")}}] }""", Dominicana);
        mala.Errores.Select(e => e.Campo).ShouldBe(["personas[0].numero"]);

        // La CIP es de Panamá: un tercero dominicano no la usa; la CED dominicana tampoco es de un tercero panameño.
        var cip = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{Persona("RepresentanteLegal", "CIP", "8-123-456", "Ana", "Pérez")}}] }""", Dominicana);
        cip.Errores.Single().Campo.ShouldBe("personas[0].tipo_identificacion");
        cip.Errores.Single().Mensaje.ShouldContain("CED");
        var ced = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{Persona("RepresentanteLegal", "CED", "00113918205", "Ana", "Pérez")}}] }""", Panama);
        ced.Errores.Single().Campo.ShouldBe("personas[0].tipo_identificacion");
    }

    [Fact]
    public void La_legal_de_una_empresa_panamena_admite_cip_y_pide_el_dv_del_RUC_de_la_sociedad()
    {
        var representante = Persona("RepresentanteLegal", "CIP", "PE-12-345", "Ana", "Pérez");
        string Socio(string extra) => Persona("Socio", "RUC", "155612345-2-2019", "Inversiones Istmo S.A.", null, $", \"porcentaje\": 100{extra}");

        var sinDv = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{representante}}, {{Socio("")}}] }""", Panama);
        sinDv.Errores.ShouldBeEmpty();
        Faltantes(sinDv).ShouldBe(["personas[1].dv"]);

        var conDv = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{representante}}, {{Socio(", \"dv\": \"56\"")}}] }""", Panama);
        conDv.Errores.ShouldBeEmpty();
        Faltantes(conDv).ShouldBeEmpty();

        var malo = Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{representante}}, {{Socio(", \"dv\": \"5\"")}}] }""", Panama);
        malo.Errores.Single().Campo.ShouldBe("personas[1].dv");
    }

    [Fact]
    public void La_firma_de_revisoria_se_identifica_con_el_numero_fiscal_del_pais_del_tercero()
    {
        const string Rep = """{ "rol": "RepresentanteLegal", "tipo_identificacion": "CED", "numero": "00113918205", "nombres": "Ana", "apellidos": "Pérez", "pep": false, "vinculo_pep": false }""";
        Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{Rep}}], "revisor_fiscal_firma": { "nit": "101850043", "razon_social": "Auditores S.R.L." } }""", Dominicana)
            .Errores.ShouldBeEmpty();
        Evaluar(CodigosDeSeccion.Legal, $$"""{ "personas": [{{Rep}}], "revisor_fiscal_firma": { "nit": "101850042", "razon_social": "Auditores S.R.L." } }""", Dominicana)
            .Errores.Single().Campo.ShouldBe("revisor_fiscal_firma.nit");
    }

    // ---------- Ficha general: el DV del RUC panameño (RG-2) ----------

    [Fact]
    public void El_dv_del_RUC_panameno_se_declara_en_la_general_es_obligatorio_y_de_dos_digitos()
    {
        ((DatosGenerales)Leer(CodigosDeSeccion.General, """{ "dv": " 56 " }""", Panama)).Dv.ShouldBe("56");
        Faltantes(Evaluar(CodigosDeSeccion.General, "{}", Panama)).ShouldContain("dv");
        Faltantes(Evaluar(CodigosDeSeccion.General, """{ "dv": "56" }""", Panama)).ShouldNotContain("dv");
        Evaluar(CodigosDeSeccion.General, """{ "dv": "5" }""", Panama).Errores.Select(e => e.Campo).ShouldContain("dv");

        // Con el DV ya en el registro del tercero, la ficha lo hereda y no lo cambia.
        ((DatosGenerales)Leer(CodigosDeSeccion.General, "{}", PanamaConDv)).Dv.ShouldBe("56");
        Codigo(() => Leer(CodigosDeSeccion.General, """{ "dv": "99" }""", PanamaConDv)).ShouldBe(("dv-no-editable", "dv"));
        Faltantes(Evaluar(CodigosDeSeccion.General, "{}", PanamaConDv)).ShouldNotContain("dv");
    }

    [Fact]
    public void Ni_Colombia_ni_Republica_Dominicana_piden_un_dv_declarado()
    {
        Faltantes(Evaluar(CodigosDeSeccion.General, "{}", Colombia)).ShouldNotContain("dv");
        Faltantes(Evaluar(CodigosDeSeccion.General, "{}", Dominicana)).ShouldNotContain("dv");
        Codigo(() => Leer(CodigosDeSeccion.General, """{ "dv": "5" }""", Dominicana)).ShouldBe(("dv-no-editable", "dv"));
        ((DatosGenerales)Leer(CodigosDeSeccion.General, "{}", Colombia)).Dv.ShouldBe("4");
    }

    // ---------- Perfiles y ficha tributaria por país (RG-3) ----------

    [Fact]
    public void Cada_pais_tiene_su_perfil_tributario_y_los_demas_el_generico()
    {
        var co = PerfilesTributarios.De("co");
        (co.EsColombiano, co.Autoridad, co.Regimenes).ShouldBe((true, "DIAN", []));

        var pa = PerfilesTributarios.De("PA");
        (pa.EsColombiano, pa.Autoridad, pa.ImpuestoVentas).ShouldBe((false, "DGI", "ITBMS"));
        pa.Regimenes.Select(r => r.Codigo).ShouldBe(["GENERAL", "ZONA_LIBRE", "ZONA_FRANCA_O_ESPECIAL", "SIN_FINES_DE_LUCRO", "OTRO"]);

        var dom = PerfilesTributarios.De("DO");
        (dom.Autoridad, dom.ImpuestoVentas).ShouldBe(("DGII", "ITBIS"));
        dom.Regimenes.Select(r => r.Codigo).ShouldBe(["ORDINARIO", "RST", "ZONA_FRANCA", "SIN_FINES_DE_LUCRO", "OTRO"]);

        var cl = PerfilesTributarios.De("CL");
        (cl.Pais, cl.EsColombiano, cl.Modelo).ShouldBe(("CL", false, ModeloTributario.Generico));
        cl.Regimenes.Select(r => r.Codigo).ShouldBe(["GENERAL", "SIMPLIFICADO", "ESPECIAL", "OTRO"]);
        PerfilesTributarios.ConPerfilPropio.ShouldBe(["CO", "PA", "DO"]);
    }

    [Fact]
    public void La_tributaria_sube_de_version_para_que_el_recalculo_la_ponga_al_dia()
    {
        var definicion = CatalogoDeSecciones.Requerida(CodigosDeSeccion.Tributaria);
        (definicion.VersionEsquema, definicion.VersionReglas).ShouldBe((2, 2));
    }

    private const string TributariaDominicanaCompleta =
        """{ "regimen": "rst", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": false }""";

    [Fact]
    public void Una_tributaria_dominicana_completa_no_pide_nada_de_la_casilla_53()
    {
        var r = Evaluar(CodigosDeSeccion.Tributaria, TributariaDominicanaCompleta, Dominicana);
        r.Errores.ShouldBeEmpty();
        r.Completitud.Completa.ShouldBeTrue();
        r.Completitud.ReglaVersion.ShouldBe(2);
        ((DatosTributarios)Leer(CodigosDeSeccion.Tributaria, TributariaDominicanaCompleta, Dominicana)).Regimen.ShouldBe("RST");
    }

    [Theory]
    [MemberData(nameof(CasosGenericos))]
    public void La_tributaria_generica_pide_su_conjunto_y_sus_coherencias(string pais, string json, string[] faltantes)
    {
        var contexto = pais switch { "PA" => Panama, "DO" => Dominicana, _ => Chile };
        var r = Evaluar(CodigosDeSeccion.Tributaria, json, contexto);
        r.Errores.ShouldBeEmpty();
        Faltantes(r).ShouldBe(faltantes);
    }

    public static TheoryData<string, string, string[]> CasosGenericos => new()
    {
        { "PA", "{}", ["regimen", "contribuyente_impuesto_ventas", "agente_de_retencion", "exento_de_retenciones"] },
        { "PA", """{ "regimen": "GENERAL", "contribuyente_impuesto_ventas": true, "agente_de_retencion": true, "exento_de_retenciones": false }""", [] },
        // Un «no» es una respuesta; vacío no.
        { "DO", """{ "regimen": "ORDINARIO", "contribuyente_impuesto_ventas": false }""", ["agente_de_retencion", "exento_de_retenciones"] },
        // Exento de retenciones exige el certificado (número y fecha).
        { "DO", """{ "regimen": "ZONA_FRANCA", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": true }""",
            ["certificado_exencion.numero", "certificado_exencion.fecha"] },
        { "DO", """{ "regimen": "ZONA_FRANCA", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": true, "certificado_exencion": { "numero": "DGII-123", "fecha": "2025-03-01" } }""", [] },
        { "DO", """{ "regimen": "OTRO", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": false, "certificado_exencion": { "numero": "DGII-123" } }""",
            ["exencion-sin-declarar"] },
        // Cualquier otro país: el perfil genérico.
        { "CL", """{ "regimen": "SIMPLIFICADO", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": false, "emisor_comprobantes_electronicos": true }""", [] },
        { "CL", "{}", ["regimen", "contribuyente_impuesto_ventas", "agente_de_retencion", "exento_de_retenciones"] }
    };

    [Fact]
    public void El_regimen_debe_ser_uno_del_pais_y_las_fechas_no_pueden_ser_futuras()
    {
        // RST es de República Dominicana; ZONA_LIBRE, de Panamá.
        Evaluar(CodigosDeSeccion.Tributaria, """{ "regimen": "ZONA_LIBRE" }""", Dominicana).Errores.Single().Codigo.ShouldBe("codigo-invalido");
        Evaluar(CodigosDeSeccion.Tributaria, """{ "regimen": "RST" }""", Panama).Errores.Single().Campo.ShouldBe("regimen");
        Evaluar(CodigosDeSeccion.Tributaria, """{ "regimen": "ZONA_LIBRE" }""", Panama).Errores.ShouldBeEmpty();

        var futura = Evaluar(CodigosDeSeccion.Tributaria,
            """{ "exento_de_retenciones": true, "certificado_exencion": { "numero": "A", "fecha": "2027-01-01" } }""", Dominicana);
        futura.Errores.Select(e => e.Campo).ShouldBe(["certificado_exencion.fecha"]);
    }

    [Fact]
    public void Un_campo_del_otro_modelo_es_422_campo_no_aplica()
    {
        // Fuera de Colombia no hay casilla 53, resoluciones de la DIAN ni ICA.
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "responsabilidades": ["48"] }""", Panama)).ShouldBe(("campo-no-aplica", "responsabilidades"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "responsable_ica": false }""", Dominicana)).ShouldBe(("campo-no-aplica", "responsable_ica"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "ica": [ { "municipio": "11001", "ciiu": "4663" } ] }""", Chile)).ShouldBe(("campo-no-aplica", "ica"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "resolucion_gran_contribuyente": { "numero": "1" } }""", Panama))
            .ShouldBe(("campo-no-aplica", "resolucion_gran_contribuyente"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "exento_rete_cree": true }""", Panama)).ShouldBe(("campo-no-aplica", "exento_rete_cree"));

        // Colombia no diligencia el conjunto genérico.
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "regimen": "GENERAL" }""", Colombia)).ShouldBe(("campo-no-aplica", "regimen"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "contribuyente_impuesto_ventas": true }""", Colombia)).ShouldBe(("campo-no-aplica", "contribuyente_impuesto_ventas"));
        Codigo(() => Leer(CodigosDeSeccion.Tributaria, """{ "certificado_exencion": { "numero": "1" } }""", Colombia)).ShouldBe(("campo-no-aplica", "certificado_exencion"));

        // Una lista vacía es «sin diligenciar», no un campo enviado.
        Should.NotThrow(() => Leer(CodigosDeSeccion.Tributaria, """{ "responsabilidades": [], "ica": [] }""", Panama));
    }

    [Fact]
    public void Colombia_conserva_su_tributaria_tal_cual()
    {
        var r = Evaluar(CodigosDeSeccion.Tributaria, """{ "responsabilidades": ["48"], "responsable_ica": false }""", Colombia);
        r.Errores.ShouldBeEmpty();
        r.Completitud.Completa.ShouldBeTrue();
        Faltantes(Evaluar(CodigosDeSeccion.Tributaria, "{}", Colombia)).ShouldBe(["responsabilidades", "responsable_ica"]);
        Faltantes(Evaluar(CodigosDeSeccion.Tributaria, """{ "responsabilidades": ["13"], "responsable_ica": false }""", Colombia))
            .ShouldBe(["resolucion_gran_contribuyente.numero", "resolucion_gran_contribuyente.fecha"]);
    }

    [Fact]
    public void Lo_guardado_antes_del_modelo_por_pais_se_sigue_leyendo_y_recalculando_sin_romperse()
    {
        // Una versión vieja de un tercero extranjero con los campos de Colombia: se lee igual (huella intacta) y el recálculo solo dice qué falta.
        var guardada = Json("""{"responsabilidades":["48"],"responsable_ica":false,"autorretenedor_ica":true}""");
        var definicion = CatalogoDeSecciones.Requerida(CodigosDeSeccion.Tributaria);
        var datos = definicion.Esquema.Deserializar(guardada);
        JsonDeFicha.Huella(definicion.Esquema.Canonico(datos)).ShouldBe(JsonDeFicha.Huella(guardada));

        var recalculo = ReglasDeFicha.ParaRecalculo(ReglasDeFicha.Evaluar(definicion, datos, Dominicana, Catalogos, false, 0));
        recalculo.Completa.ShouldBeFalse();
        recalculo.ReglaVersion.ShouldBe(2);
        recalculo.Faltantes.Select(f => f.Campo).ShouldBe(["regimen", "contribuyente_impuesto_ventas", "agente_de_retencion", "exento_de_retenciones"]);

        // Y la de Colombia, con los mismos datos, sigue completa.
        ReglasDeFicha.ParaRecalculo(ReglasDeFicha.Evaluar(definicion, datos, Colombia, Catalogos, false, 0)).Completa.ShouldBeTrue();
    }

    [Fact]
    public void Lo_que_se_guarda_de_Colombia_no_cambia_de_huella_por_los_campos_nuevos()
    {
        var colombia = (DatosTributarios)Leer(CodigosDeSeccion.Tributaria, """{ "responsabilidades": ["48", "5"], "responsable_ica": false }""", Colombia);
        CatalogoDeSecciones.Requerida(CodigosDeSeccion.Tributaria).Esquema.Canonico(colombia).GetRawText()
            .ShouldBe("""{"responsabilidades":["05","48"],"responsable_ica":false}""");
    }

    // ---------- La ficha que ve el tercero y el ERP (RG-3, RG-7) ----------

    [Fact]
    public void El_perfil_de_la_ficha_dice_el_modelo_tributario_los_regimenes_y_si_el_dv_se_declara()
    {
        var pa = Identificacion.Crear("PA", "RUC", "8-123-456").PerfilDeFicha();
        (pa.Pais, pa.TipoIdentificacion, pa.DvDeclarado, pa.ModeloTributario, pa.AutoridadTributaria, pa.ImpuestoVentas).ShouldBe(("PA", "RUC", true, "Generico", "DGI", "ITBMS"));
        pa.Regimenes.Select(r => r.Codigo).ShouldBe(["GENERAL", "ZONA_LIBRE", "ZONA_FRANCA_O_ESPECIAL", "SIN_FINES_DE_LUCRO", "OTRO"]);

        pa.TiposDePersona.ShouldBe(["CC", "CE", "CIP", "ID_FISCAL", "NIT", "PA", "PASAPORTE", "PPT", "RUC", "TI"]);
        pa.TiposConDvDeclarado.ShouldBe(["RUC"]);

        var dom = Identificacion.Crear("DO", "RNC", "101850043").PerfilDeFicha();
        (dom.DvDeclarado, dom.ModeloTributario, dom.ImpuestoVentas).ShouldBe((false, "Generico", "ITBIS"));
        dom.TiposDePersona.ShouldContain("CED");
        dom.TiposDePersona.ShouldContain("RNC");
        dom.TiposConDvDeclarado.ShouldBeEmpty();

        var co = Identificacion.Crear("CO", "NIT", "900373913").PerfilDeFicha();
        (co.DvDeclarado, co.ModeloTributario, co.AutoridadTributaria).ShouldBe((false, "Colombiano", "DIAN"));
        co.Regimenes.ShouldBeEmpty();
        co.TiposDePersona.ShouldBe(["CC", "CE", "ID_FISCAL", "NIT", "PA", "PASAPORTE", "PPT", "TI"]);
        co.TiposConDvDeclarado.ShouldBeEmpty();
    }

    [Fact]
    public void El_contenido_para_el_ERP_trae_el_modelo_generico_solo_si_hay_algo_diligenciado()
    {
        var generica = new DatosTributarios
        {
            Regimen = "RST", ContribuyenteImpuestoVentas = true, AgenteDeRetencion = false, ExentoDeRetenciones = true,
            CertificadoExencion = new Resolucion { Numero = "DGII-1", Fecha = new DateOnly(2025, 3, 1) }, EmisorComprobantesElectronicos = true
        };
        var contenido = ContenidoParaErp.Normalizar(generica, CatalogosEnMemoria.Vacios).Tributaria!;
        contenido.Generico.ShouldBe(new Validalo.Contratos.ContenidoTributarioGenericoDto("RST", true, false, true,
            new Validalo.Contratos.ResolucionDto("DGII-1", new DateOnly(2025, 3, 1)), true));
        contenido.Responsabilidades.ShouldBeEmpty();
        // Un tercero de otro país no es «no responsable de IVA»: las calidades de la DIAN van todas nulas y sin notas, no «falsas».
        contenido.Calidades.ShouldBe(new Validalo.Contratos.CalidadesTributariasDto(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));
        contenido.CalidadesSinDerivar.ShouldBeEmpty();

        var colombiano = ContenidoParaErp.Normalizar(new DatosTributarios { Responsabilidades = ["48"], ResponsableIca = false }, CatalogosEnMemoria.Vacios).Tributaria!;
        colombiano.Generico.ShouldBeNull();
        colombiano.Calidades.ResponsableIva.ShouldBe(true);
        colombiano.CalidadesSinDerivar.ShouldNotBeEmpty();
    }

    // ---------- Documentos equivalentes por país (RG-5) ----------

    [Theory]
    [InlineData("CERTIFICADO_RUC", "PA", "RUT")]
    [InlineData("CONSTANCIA_RNC", "DO", "RUT")]
    [InlineData("REGISTRO_PUBLICO", "PA", "CAMARA_COMERCIO")]
    [InlineData("REGISTRO_MERCANTIL", "DO", "CAMARA_COMERCIO")]
    public void Cada_pais_tiene_su_equivalente_del_RUT_y_de_la_Camara(string codigo, string pais, string equivalente)
    {
        var tipo = CatalogoCanonico.Requerido(codigo);
        tipo.Paises.ShouldBe([pais]);
        tipo.EquivalenteA.ShouldBe(equivalente);
        tipo.Ambito.ShouldBe(AmbitoDocumento.Global);
        tipo.Clase.ShouldBe(ClaseDocumento.Archivo);
        tipo.AplicaAlPais(pais.ToLowerInvariant()).ShouldBeTrue();
        tipo.AplicaAlPais("CO").ShouldBeFalse();
        // El equivalente tiene las mismas reglas de vigencia y formato que el colombiano.
        var colombiano = CatalogoCanonico.Requerido(equivalente);
        tipo.ReglaFrescuraSugerida.ShouldBe(colombiano.ReglaFrescuraSugerida);
        tipo.AplicaA.ShouldBe(colombiano.AplicaA);
        tipo.Formatos.ShouldBe(colombiano.Formatos);
    }

    [Fact]
    public void El_RUT_y_la_Camara_son_de_Colombia_y_los_demas_canonicos_de_cualquier_pais()
    {
        CatalogoCanonico.Requerido("RUT").Paises.ShouldBe(["CO"]);
        CatalogoCanonico.Requerido("CAMARA_COMERCIO").Paises.ShouldBe(["CO"]);
        CatalogoCanonico.Requerido("CEDULA").Paises.ShouldBeNull();
        CatalogoCanonico.Requerido("ESTADOS_FINANCIEROS").AplicaAlPais("DO").ShouldBeTrue();
        CatalogoCanonico.Todos.Select(t => t.Codigo).ShouldBeUnique();
        CatalogoCanonico.Todos.Where(t => t.EquivalenteA is not null).Select(t => t.EquivalenteA!)
            .ShouldAllBe(e => CatalogoCanonico.Buscar(e) != null && CatalogoCanonico.Buscar(e)!.Paises!.Contains("CO"));
    }

    [Fact]
    public void Los_equivalentes_sirven_de_soporte_de_la_ficha_pero_sin_lectura_ni_cruce()
    {
        var general = CatalogoDeSecciones.Requerida(CodigosDeSeccion.General);
        var tributaria = CatalogoDeSecciones.Requerida(CodigosDeSeccion.Tributaria);
        var legal = CatalogoDeSecciones.Requerida(CodigosDeSeccion.Legal);
        general.AdmiteSoporte("CONSTANCIA_RNC").ShouldBeTrue();
        tributaria.AdmiteSoporte("CERTIFICADO_RUC").ShouldBeTrue();
        tributaria.AdmiteSoporte("REGISTRO_MERCANTIL").ShouldBeFalse(); // el registro mercantil no respalda lo tributario
        legal.AdmiteSoporte("REGISTRO_PUBLICO").ShouldBeTrue();
        CatalogoDeSecciones.Requerida(CodigosDeSeccion.Financiera).AdmiteSoporte("CONSTANCIA_RNC").ShouldBeFalse();

        foreach (var codigo in new[] { "CERTIFICADO_RUC", "REGISTRO_PUBLICO", "CONSTANCIA_RNC", "REGISTRO_MERCANTIL" })
        {
            MapaDeRespaldo.RespaldaAlguna(codigo).ShouldBeFalse(codigo);
            EsquemasDeAnalisis.Para(codigo).ShouldBeNull(codigo);
            EsquemaDeAnalisis.TiposDetectables.ShouldNotContain(codigo);
        }

        EsquemasDeAnalisis.Para("RUT").ShouldNotBeNull();
        EsquemasDeAnalisis.Para("CERTIFICACION_BANCARIA").ShouldNotBeNull();
        EsquemaDeAnalisis.TiposDetectables.ShouldContain("RUT");
    }

    // ---------- Moneda de las cuentas por país (RG-8) ----------

    [Theory]
    [InlineData("DO", null, "DOP")]
    [InlineData("do", " ", "DOP")]
    [InlineData("PA", null, "USD")]
    [InlineData("CO", null, "COP")]
    [InlineData(null, null, "COP")]
    [InlineData("US", null, "COP")] // los demás países, como siempre
    [InlineData("DO", "usd", "USD")] // lo declarado manda
    public void Una_cuenta_sin_moneda_toma_la_del_pais_del_banco(string? pais, string? moneda, string esperada)
    {
        var cuenta = CuentaBancaria.Registrar(Guid.NewGuid(), new DatosDeCuentaBancaria(pais, "Banco BHD León", "Ahorros", "123456789", "Inversiones S.R.L.", "RNC 101850043", moneda),
            numero => numero, Ahora);
        cuenta.Moneda.ShouldBe(esperada);
    }

    // ---------- La lectura automática y las fuentes oficiales, solo en Colombia (RG-6) ----------

    [Theory]
    [InlineData("CO", true)]
    [InlineData("co", true)]
    [InlineData(" CO ", true)]
    [InlineData("PA", false)]
    [InlineData("DO", false)]
    [InlineData("US", false)]
    [InlineData(null, false)]
    public void La_lectura_automatica_aplica_solo_a_Colombia(string? pais, bool aplica) => AlcanceDeLaLectura.Aplica(pais).ShouldBe(aplica);

    private static readonly IReadOnlyList<VerificacionRequeridaDelFlujo> Pedidas =
    [
        new(TipoVerificacion.ListasRestrictivas), new(TipoVerificacion.EstudioDeCumplimiento), new(TipoVerificacion.Rues),
        new(TipoVerificacion.Dian, Bloqueante: false)
    ];

    [Fact]
    public void El_RUES_y_la_DIAN_no_se_piden_a_un_tercero_de_otro_pais_pero_las_listas_y_el_estudio_si()
    {
        var dominicano = Tercero.Crear(Identificacion.Crear("DO", "RNC", "101850043"), TipoPersona.Juridica, "Banco BHD León", null, null, Ahora);
        var colombiano = Tercero.Crear(Identificacion.Crear("CO", "NIT", "900373913"), TipoPersona.Juridica, "Aceros S.A.S.", null, null, Ahora);

        ProcesoDeValidacion.VerificacionesQueAplican(Pedidas, dominicano).Select(v => v.Tipo)
            .ShouldBe([TipoVerificacion.ListasRestrictivas, TipoVerificacion.EstudioDeCumplimiento]);
        ProcesoDeValidacion.VerificacionesQueAplican(Pedidas, colombiano).Select(v => v.Tipo)
            .ShouldBe([TipoVerificacion.ListasRestrictivas, TipoVerificacion.EstudioDeCumplimiento, TipoVerificacion.Rues, TipoVerificacion.Dian]);
    }

    [Fact]
    public void Un_expediente_de_un_tercero_extranjero_no_queda_bloqueado_por_una_fuente_que_no_cubre_su_pais()
    {
        var dominicano = Tercero.Crear(Identificacion.Crear("DO", "RNC", "101850043"), TipoPersona.Juridica, "Banco BHD León", null, null, Ahora);
        var aplicables = ProcesoDeValidacion.VerificacionesQueAplican([new VerificacionRequeridaDelFlujo(TipoVerificacion.Rues), new VerificacionRequeridaDelFlujo(TipoVerificacion.Dian)], dominicano);
        aplicables.ShouldBeEmpty();
    }
}
