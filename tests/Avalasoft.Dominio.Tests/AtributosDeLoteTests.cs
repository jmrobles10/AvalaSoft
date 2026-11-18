using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Avalasoft.Aplicacion.Invitaciones;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Configuracion;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Los atributos del vínculo en la invitación masiva y en la invitación a mano (decisión IM): las columnas «Atributo: clave» de la plantilla (con su lista cuando son de opciones), su
/// lectura del Excel y del CSV, y la conversión de cada valor al tipo del atributo con el error claro de la fila cuando no sirve.
/// </summary>
public sealed class AtributosDeLoteTests
{
    private static readonly XNamespace Principal = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    private static readonly TipoVinculo Proveedor = TipoVinculo.Crear("PROVEEDOR", "Proveedor",
    [
        new("nivelRiesgo", TipoAtributo.Opcion, true, ["Bajo", "Medio", "Alto"]),
        new("categorias", TipoAtributo.ListaOpciones, false, ["Materiales", "Servicios", "Equipos"]),
        new("montoEstimado", TipoAtributo.Numero, false, null),
        new("vigencia", TipoAtributo.Fecha, false, null),
        new("critico", TipoAtributo.Booleano, false, null),
        new("nota", TipoAtributo.Texto, false, null)
    ], false);

    private static Dictionary<string, JsonElement> Texto(params (string Clave, string Valor)[] valores) =>
        valores.ToDictionary(v => v.Clave, v => JsonSerializer.SerializeToElement(v.Valor));

    // ---------- Importador ----------

    [Fact]
    public void El_importador_lee_las_columnas_Atributo_clave_con_su_clave_exacta_y_solo_las_celdas_con_valor()
    {
        var encabezados = new[]
        {
            "Tipo de identificación *", "Número de identificación *", "Razón social o nombres *", "Correo *", "Tipo de vínculo *",
            "Atributo: nivelRiesgo", "atributo :  categorias *", "Atributo: montoEstimado", "Atributo:", "Nivel"
        };
        var filas = ArchivoDeLote.DeFilas(
        [
            encabezados,
            ["NIT", "900123456", "Aceros", "a@b.co", "Proveedor (PROVEEDOR)", "Alto", "Servicios; Equipos", "", "ignorada", "ignorado"],
            ["CC", "1234", "Ana", "ana@b.co", "CLIENTE", "", "", "", "", ""]
        ]);

        filas[0].Atributos.ShouldNotBeNull().Keys.ShouldBe(["nivelRiesgo", "categorias"], ignoreOrder: true);
        filas[0].Atributos!["categorias"].GetString().ShouldBe("Servicios; Equipos");
        // Sin ninguna celda con valor no hay atributos (nulo, no un diccionario vacío): la fila se ve como las de antes.
        filas[1].Atributos.ShouldBeNull();
        ArchivoDeLote.ClaveDeAtributo("Atributo: nivelRiesgo").ShouldBe("nivelRiesgo");
        ArchivoDeLote.ClaveDeAtributo("Atributo:   ").ShouldBeNull();
        ArchivoDeLote.ClaveDeAtributo("Nombre").ShouldBeNull();
    }

    [Fact]
    public void El_importador_tambien_lee_las_columnas_de_atributo_de_un_csv()
    {
        var csv = "Tipo de identificación;Número de identificación;Razón social o nombres;Correo;Tipo de vínculo;Atributo: nivelRiesgo;Atributo: montoEstimado\r\n" +
                  "NIT;900123456;Aceros;a@b.co;PROVEEDOR;Medio;1500000\r\n";
        var filas = ArchivoDeLote.Leer(new ArchivoDeLoteDto("lote.csv", Convert.ToBase64String(Encoding.UTF8.GetBytes(csv))));

        filas.ShouldHaveSingleItem().Atributos.ShouldNotBeNull().Keys.ShouldBe(["nivelRiesgo", "montoEstimado"], ignoreOrder: true);
        filas[0].Atributos!["montoEstimado"].GetString().ShouldBe("1500000");
    }

    // ---------- Conversión al tipo de cada atributo ----------

    [Fact]
    public void Cada_valor_se_convierte_al_tipo_de_su_atributo_sea_texto_de_una_celda_o_un_valor_json()
    {
        var (valores, errores) = AtributosDeLote.Resolver(Proveedor, Texto(
            ("NIVELRIESGO", "alto"), ("categorias", " servicios ; Equipos,  materiales"), ("montoEstimado", "1500,5"), ("vigencia", "31/12/2026"), ("critico", "Sí"), ("nota", "  Hola  ")));

        errores.ShouldBeEmpty();
        valores["nivelRiesgo"].GetString().ShouldBe("Alto"); // clave y opción como las define el tipo
        valores["categorias"].EnumerateArray().Select(x => x.GetString()).ShouldBe(["Servicios", "Equipos", "Materiales"]);
        valores["montoEstimado"].GetDecimal().ShouldBe(1500.5m);
        valores["vigencia"].GetString().ShouldBe("2026-12-31");
        valores["critico"].GetBoolean().ShouldBeTrue();
        valores["nota"].GetString().ShouldBe("Hola");

        // Lo que ya viene tipado (la invitación a mano manda JSON) pasa igual.
        var (tipados, erroresTipados) = AtributosDeLote.Resolver(Proveedor, new Dictionary<string, JsonElement>
        {
            ["montoEstimado"] = JsonSerializer.SerializeToElement(2000),
            ["critico"] = JsonSerializer.SerializeToElement(false),
            ["categorias"] = JsonSerializer.SerializeToElement(new[] { "Equipos" })
        });
        erroresTipados.ShouldBeEmpty();
        (tipados["montoEstimado"].GetDecimal(), tipados["critico"].GetBoolean()).ShouldBe((2000m, false));
        tipados["categorias"].GetArrayLength().ShouldBe(1);

        // El validador del dominio acepta lo que sale de aquí.
        ValidadorDeAtributos.Validar(Proveedor, new Dictionary<string, JsonElement>(valores)).Count.ShouldBe(6);
    }

    [Fact]
    public void Un_atributo_que_el_tipo_no_tiene_o_un_valor_que_no_es_de_su_tipo_son_errores_de_esa_fila_y_lo_vacio_se_ignora()
    {
        var (valores, errores) = AtributosDeLote.Resolver(Proveedor, Texto(
            ("obra", "Torre 3"), ("nivelRiesgo", "Altísimo"), ("montoEstimado", "mucho"), ("vigencia", "mañana"), ("critico", "quizá"), ("categorias", "Servicios; Otra"), ("nota", "   ")));

        errores.Select(e => (e.Campo, e.Codigo)).ShouldBe(
        [
            ("atributos.obra", "atributo-no-permitido"), ("atributos.nivelRiesgo", "atributo-invalido"), ("atributos.montoEstimado", "atributo-invalido"),
            ("atributos.vigencia", "atributo-invalido"), ("atributos.critico", "atributo-invalido"), ("atributos.categorias", "atributo-invalido")
        ]);
        errores[0].Mensaje.ShouldContain("PROVEEDOR");
        errores[1].Mensaje.ShouldContain("Bajo, Medio, Alto");
        valores.ShouldBeEmpty(); // la nota en blanco es «no vino»
    }

    [Fact]
    public void Los_atributos_obligatorios_se_exigen_aparte_porque_solo_aplican_al_crear_el_vinculo()
    {
        // Sin ningún valor Resolver no se queja (en un vínculo que ya existe y se reinvita no hay nada que aplicar)…
        var (vacios, sinErrores) = AtributosDeLote.Resolver(Proveedor, null);
        sinErrores.ShouldBeEmpty();
        // …y al crear, Faltantes dice cuál obligatorio falta, con el mismo código que el validador del dominio.
        AtributosDeLote.Faltantes(Proveedor, vacios).Select(e => (e.Campo, e.Codigo)).ShouldBe([("atributos.nivelRiesgo", "atributo-requerido")]);
        AtributosDeLote.Faltantes(Proveedor, AtributosDeLote.Resolver(Proveedor, Texto(("nivelRiesgo", "Bajo"))).Valores).ShouldBeEmpty();
        Should.Throw<Avalasoft.Dominio.Comun.ReglaDeNegocioException>(() => ValidadorDeAtributos.Validar(Proveedor, vacios)).Codigo.ShouldBe("atributo-requerido");
    }

    [Fact]
    public void Una_fecha_que_Excel_guardo_como_numero_de_serie_se_lee_como_fecha()
    {
        // 46387 es el 2026-12-31 en el calendario de Excel.
        var (valores, errores) = AtributosDeLote.Resolver(Proveedor, Texto(("vigencia", "46387")));
        errores.ShouldBeEmpty();
        valores["vigencia"].GetString().ShouldBe("2026-12-31");
    }

    // ---------- Plantilla ----------

    private static readonly CatalogoDePlantilla Norte = new("Constructora Norte",
    [
        new TipoVinculoDePlantilla("CLIENTE", "Cliente", [new AtributoDePlantilla("nivelRiesgo", TipoAtributo.Opcion, false, ["Bajo", "Alto"])]),
        new TipoVinculoDePlantilla("PROVEEDOR", "Proveedor",
        [
            new AtributoDePlantilla("nivelRiesgo", TipoAtributo.Opcion, true, ["Bajo", "Medio", "Alto"]),
            new AtributoDePlantilla("categorias", TipoAtributo.ListaOpciones, false, ["Materiales", "Servicios"]),
            new AtributoDePlantilla("critico", TipoAtributo.Booleano, false, null)
        ])
    ], []);

    private static XDocument Parte(byte[] libro, string ruta)
    {
        using var zip = new ZipArchive(new MemoryStream(libro), ZipArchiveMode.Read);
        using var flujo = zip.GetEntry(ruta)!.Open();
        return XDocument.Load(flujo);
    }

    private static Dictionary<string, string> Celdas(XDocument hoja) =>
        hoja.Descendants(Principal + "c").ToDictionary(c => c.Attribute("r")!.Value, c => string.Concat(c.Descendants(Principal + "t").Select(t => t.Value)));

    [Fact]
    public void La_plantilla_trae_una_columna_por_atributo_con_su_lista_y_el_importador_lee_lo_que_se_llena()
    {
        var libro = ArchivoDeLote.Plantilla("xlsx", Norte).Contenido;
        var datos = Celdas(Parte(libro, "xl/worksheets/sheet1.xml"));

        // Después de las doce columnas de siempre: una por clave (nivelRiesgo es de dos tipos y comparte columna).
        (datos["M1"], datos["N1"], datos["O1"]).ShouldBe(("Atributo: nivelRiesgo", "Atributo: categorias", "Atributo: critico"));
        datos.ContainsKey("P1").ShouldBeFalse();

        // Una opción ofrece la lista de todos los tipos (sin repetir) y sí/no ofrece Sí y No; varias opciones se escriben.
        var listas = Celdas(Parte(libro, "xl/worksheets/sheet3.xml"));
        listas["H1"].ShouldBe("Atributo: nivelRiesgo");
        new[] { listas["H2"], listas["H3"], listas["H4"] }.ShouldBe(["Bajo", "Alto", "Medio"]);
        listas.ContainsKey("H5").ShouldBeFalse();
        listas.ContainsKey("I1").ShouldBeFalse();
        var validaciones = Parte(libro, "xl/worksheets/sheet1.xml").Descendants(Principal + "dataValidation").ToDictionary(v => (string)v.Attribute("sqref")!, v => v.Element(Principal + "formula1")!.Value);
        validaciones.Single(v => v.Key.StartsWith("M2:M", StringComparison.Ordinal)).Value.ShouldBe("Listas!$H$2:$H$4");
        validaciones.Single(v => v.Key.StartsWith("O2:O", StringComparison.Ordinal)).Value.ShouldBe("\"Sí,No\"");
        validaciones.Keys.ShouldNotContain(k => k.StartsWith("N2:N", StringComparison.Ordinal));

        // Las instrucciones explican la columna (a qué tipos aplica, cuáles la exigen) y cómo separar varias opciones.
        var instrucciones = string.Join("\n", Celdas(Parte(libro, "xl/worksheets/sheet2.xml")).Values);
        instrucciones.ShouldContain("Atributo: categorias");
        instrucciones.ShouldContain("Proveedor (obligatorio)");
        instrucciones.ShouldContain("punto y coma (;)");
        instrucciones.ShouldContain("Según el tipo");

        // Lo que alguien llena en la plantilla se lee con sus atributos (Excel guarda todo como texto en las celdas de la hoja).
        var llena = PlantillaDeLoteTests.Llenar(libro,
            ["NIT", "900123456", "Aceros", "a@b.co", "Proveedor (PROVEEDOR)", null, null, null, null, null, null, null, "Alto", "Materiales; Servicios", "Sí"]);
        var fila = ArchivoDeLote.Leer(new ArchivoDeLoteDto("plantilla.xlsx", Convert.ToBase64String(llena))).ShouldHaveSingleItem();
        fila.TipoVinculo.ShouldBe("PROVEEDOR");
        fila.Atributos.ShouldNotBeNull().Keys.ShouldBe(["nivelRiesgo", "categorias", "critico"], ignoreOrder: true);

        // El CSV de la empresa trae los mismos encabezados de atributo; sin catálogo es solo lo de siempre.
        Encoding.UTF8.GetString(ArchivoDeLote.Plantilla("csv", Norte).Contenido).ShouldContain("Atributo: nivelRiesgo;Atributo: categorias;Atributo: critico");
        Encoding.UTF8.GetString(ArchivoDeLote.Plantilla("csv").Contenido).ShouldNotContain("Atributo:");
    }
}
