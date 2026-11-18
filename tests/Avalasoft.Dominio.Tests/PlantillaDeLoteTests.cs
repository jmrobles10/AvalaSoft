using System.IO.Compression;
using System.Security;
using System.Text;
using System.Xml.Linq;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Invitaciones;
using Avalasoft.Contratos;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// La plantilla Excel de la invitación por lote (decisión IM): la hoja de datos sigue siendo la primera y se lee igual; trae formato de marca, listas desplegables con lo que la
/// empresa tiene configurado, instrucciones, y lo que el usuario elige de las listas («Nombre (CÓDIGO)») lo entiende el importador.
/// </summary>
public sealed class PlantillaDeLoteTests
{
    private static readonly XNamespace Principal = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    private static readonly TipoVinculoDePlantilla Proveedor = new("PROVEEDOR", "Proveedor");
    private static readonly TipoVinculoDePlantilla Contratista = new("CONTRATISTA", "Contratista");

    private static readonly CatalogoDePlantilla Norte = new("Constructora Norte", [Proveedor, Contratista],
    [
        new FlujoDePlantilla("FLU-PROV", "Proveedores nacionales", Proveedor),
        new FlujoDePlantilla("FLU-PROV2", "Proveedores críticos", Proveedor),
        new FlujoDePlantilla("FLU-CON", "Contratistas de obra", Contratista)
    ]);

    private static byte[] Plantilla(CatalogoDePlantilla? catalogo = null) => ArchivoDeLote.Plantilla("xlsx", catalogo ?? Norte).Contenido;

    private static XDocument Parte(byte[] libro, string ruta)
    {
        using var zip = new ZipArchive(new MemoryStream(libro), ZipArchiveMode.Read);
        using var flujo = zip.GetEntry(ruta)!.Open();
        return XDocument.Load(flujo);
    }

    /// <summary>Las filas de una hoja como texto por columna («A» → «Proveedor (PROVEEDOR)»), con sus textos en línea.</summary>
    private static IReadOnlyList<IReadOnlyDictionary<string, string>> Filas(XDocument hoja) =>
        [.. hoja.Descendants(Principal + "row").Select(f => (IReadOnlyDictionary<string, string>)f.Elements(Principal + "c")
            .ToDictionary(c => new string([.. c.Attribute("r")!.Value.TakeWhile(char.IsLetter)]), c => string.Concat(c.Descendants(Principal + "t").Select(t => t.Value))))];

    /// <summary>Agrega filas con texto en línea debajo del encabezado de la hoja de datos, como las dejaría quien llena la plantilla.</summary>
    internal static byte[] Llenar(byte[] plantilla, params string?[][] filas)
    {
        using var memoria = new MemoryStream();
        memoria.Write(plantilla);
        using (var zip = new ZipArchive(memoria, ZipArchiveMode.Update, leaveOpen: true))
        {
            var entrada = zip.GetEntry("xl/worksheets/sheet1.xml")!;
            string xml;
            using (var lector = new StreamReader(entrada.Open(), Encoding.UTF8))
                xml = lector.ReadToEnd();
            entrada.Delete();

            var nuevas = new StringBuilder();
            for (var i = 0; i < filas.Length; i++)
            {
                nuevas.Append($"<row r=\"{i + 2}\">");
                for (var j = 0; j < filas[i].Length; j++)
                    if (filas[i][j] is { } valor)
                        nuevas.Append($"<c r=\"{HojaDeCalculo.Columna(j)}{i + 2}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{SecurityElement.Escape(valor)}</t></is></c>");
                nuevas.Append("</row>");
            }

            using var escritor = new StreamWriter(zip.CreateEntry("xl/worksheets/sheet1.xml").Open(), new UTF8Encoding(false));
            escritor.Write(xml.Replace("</sheetData>", $"{nuevas}</sheetData>", StringComparison.Ordinal));
        }

        return memoria.ToArray();
    }

    [Fact]
    public void La_hoja_de_datos_es_la_primera_y_se_llama_Invitaciones_con_Instrucciones_y_Listas_ocultas()
    {
        var libro = Parte(Plantilla(), "xl/workbook.xml");
        var hojas = libro.Descendants(Principal + "sheet").Select(h => (Nombre: (string)h.Attribute("name")!, Estado: (string?)h.Attribute("state"))).ToList();

        hojas.ShouldBe([("Invitaciones", null), ("Instrucciones", null), ("Listas", "hidden")]);
        ArchivoDeLote.HojaDeDatos.ShouldBe("Invitaciones");
        // Lo que lee el importador: la primera hoja, que solo trae el encabezado (el ejemplo vive en «Instrucciones»).
        LectorDeHojaDeCalculo.Leer(Plantilla()).ShouldHaveSingleItem()
            .ShouldBe(ArchivoDeLote.Columnas.Select(c => c.Obligatoria ? $"{c.Encabezado} *" : c.Encabezado));
        Parte(Plantilla(), "xl/worksheets/sheet3.xml").Descendants(Principal + "sheetProtection").ShouldHaveSingleItem();
    }

    [Fact]
    public void Marca_las_obligatorias_con_asterisco_y_color_y_deja_filtros_fila_fija_notas_y_formato_de_texto()
    {
        var hoja = Parte(Plantilla(), "xl/worksheets/sheet1.xml");

        var encabezado = hoja.Descendants(Principal + "row").First().Elements(Principal + "c").ToList();
        encabezado.Count.ShouldBe(ArchivoDeLote.Columnas.Count);
        foreach (var (columna, celda) in ArchivoDeLote.Columnas.Zip(encabezado))
        {
            // Estilo 1: encabezado azul de la marca (obligatoria); estilo 2: gris azulado (opcional).
            celda.Attribute("s")!.Value.ShouldBe(columna.Obligatoria ? "1" : "2");
            celda.Value.ShouldBe(columna.Obligatoria ? $"{columna.Encabezado} *" : columna.Encabezado);
        }

        hoja.Descendants(Principal + "pane").Single().Attribute("state")!.Value.ShouldBe("frozen");
        hoja.Descendants(Principal + "autoFilter").Single().Attribute("ref")!.Value.ShouldBe("A1:L1");

        // Número de identificación (B), DV (G) y teléfono (L) son de texto (estilo 3, formato «@»): Excel no se come los ceros.
        var texto = hoja.Descendants(Principal + "col").Where(c => c.Attribute("style")?.Value == "3").Select(c => c.Attribute("min")!.Value).ToList();
        texto.ShouldBe(["2", "7", "12"]);

        var notas = Parte(Plantilla(), "xl/comments1.xml").Descendants(Principal + "comment").ToList();
        notas.Count.ShouldBe(ArchivoDeLote.Columnas.Count);
        notas[0].Attribute("ref")!.Value.ShouldBe("A1");
        notas[0].Value.ShouldContain("obligatoria");
        notas[9].Value.ShouldContain("opcional");

        var estilos = Parte(Plantilla(), "xl/styles.xml");
        estilos.Descendants(Principal + "fgColor").Select(c => c.Attribute("rgb")!.Value).ShouldContain("FF2F55D9"); // accionPrimaria del design system
        estilos.Descendants(Principal + "cellXfs").Single().Elements(Principal + "xf").ElementAt(3).Attribute("numFmtId")!.Value.ShouldBe("49");
    }

    [Fact]
    public void Ofrece_los_tipos_de_vinculo_y_los_flujos_de_la_empresa_como_nombre_y_codigo()
    {
        var libro = Plantilla();
        var listas = Filas(Parte(libro, "xl/worksheets/sheet3.xml"));
        listas.Select(f => f.GetValueOrDefault("A")).Where(v => v is not null).ShouldBe(["Tipos de vínculo", "Proveedor (PROVEEDOR)", "Contratista (CONTRATISTA)"]);
        // Los flujos van agrupados por su tipo de vínculo (la lista de la celda depende del tipo elegido).
        listas.Skip(1).Select(f => (f.GetValueOrDefault("F"), f.GetValueOrDefault("G"))).Where(p => p.Item1 is not null).ShouldBe(
        [
            ("Proveedor (PROVEEDOR)", "Proveedores nacionales (FLU-PROV)"),
            ("Proveedor (PROVEEDOR)", "Proveedores críticos (FLU-PROV2)"),
            ("Contratista (CONTRATISTA)", "Contratistas de obra (FLU-CON)")
        ]);

        var validaciones = Parte(libro, "xl/worksheets/sheet1.xml").Descendants(Principal + "dataValidation").ToDictionary(v => v.Attribute("sqref")!.Value, v => v.Element(Principal + "formula1")!.Value);
        validaciones["E2:E10001"].ShouldBe("Listas!$A$2:$A$3"); // tipo de vínculo: las de la empresa, y solo ellas (stop)
        validaciones["J2:J10001"].ShouldStartWith("OFFSET(Listas!$F$1,MATCH($E2,"); // flujo: los del tipo elegido
        validaciones["F2:F10001"].ShouldBe("Listas!$C$2:$C$10");
        validaciones["H2:H10001"].ShouldBe("Listas!$B$2:$B$4");
        validaciones["A2:A10001"].ShouldStartWith("OFFSET(Listas!$D$1,MATCH(IF($F2=\"\",\"Colombia (CO)\",$F2),"); // tipo de identificación: los del país
        validaciones["D2:D10001"].ShouldContain("FIND(\"@\"");
        Parte(libro, "xl/worksheets/sheet1.xml").Descendants(Principal + "dataValidation")
            .Single(v => v.Attribute("sqref")!.Value == "E2:E10001").Attribute("errorStyle")!.Value.ShouldBe("stop");
    }

    [Fact]
    public void Los_paises_y_tipos_de_identificacion_son_los_del_catalogo_del_sistema()
    {
        var listas = Filas(Parte(Plantilla(), "xl/worksheets/sheet3.xml")).Skip(1).ToList();

        listas.Select(f => f.GetValueOrDefault("C")).Where(v => v is not null).ShouldBe(
            ["Colombia (CO)", "Chile (CL)", "Argentina (AR)", "México (MX)", "Perú (PE)", "Ecuador (EC)", "Estados Unidos (US)", "Panamá (PA)", "República Dominicana (DO)"]);
        var tipos = listas.Where(f => f.ContainsKey("D")).Select(f => (Pais: f["D"], Tipo: f["E"])).ToList();
        tipos.Where(t => t.Pais == "Colombia (CO)").Select(t => t.Tipo).ShouldBe(
        [
            "Número de Identificación Tributaria (NIT)", "Cédula de ciudadanía (CC)", "Cédula de extranjería (CE)", "Tarjeta de identidad (TI)",
            "Permiso por protección temporal (PPT)", "Pasaporte (PA)", "Pasaporte (PASAPORTE)", "Identificación fiscal del país (ID_FISCAL)"
        ]);
        tipos.ShouldContain(("Chile (CL)", "Rol Único Tributario (RUT)"));
        // Cada país con sus tipos agrupados (la lista de la celda es un bloque contiguo).
        var bloques = tipos.Select(t => t.Pais).Where((p, i) => i == 0 || p != tipos[i - 1].Pais).ToList();
        bloques.Count.ShouldBe(9);
        bloques.Distinct().Count().ShouldBe(9);
    }

    [Fact]
    public void Las_instrucciones_dicen_que_es_obligatorio_que_hace_cada_columna_y_dan_un_ejemplo()
    {
        var filas = Filas(Parte(Plantilla(), "xl/worksheets/sheet2.xml"));
        var texto = string.Join('\n', filas.SelectMany(f => f.Values));

        texto.ShouldContain("Plantilla de invitación por lote");
        texto.ShouldContain("Para Constructora Norte");
        texto.ShouldContain("Las columnas con asterisco (*) son obligatorias");
        var tabla = filas.Where(f => f.ContainsKey("D") && f.ContainsKey("A")).ToDictionary(f => f["A"]);
        foreach (var columna in ArchivoDeLote.Columnas)
        {
            tabla[columna.Encabezado]["B"].ShouldBe(columna.Obligatoria ? "Sí" : "No");
            tabla[columna.Encabezado]["C"].ShouldNotBeNullOrWhiteSpace();
        }

        tabla["Número de identificación"]["D"].ShouldBe("900123456");
        tabla["DV"]["D"].ShouldBe("8"); // el dígito de verificación real del NIT de ejemplo
        tabla["Tipo de vínculo"]["D"].ShouldBe("Proveedor (PROVEEDOR)");
        tabla["Tipo de vínculo"]["C"].ShouldContain("Constructora Norte");
        tabla["Flujo"]["D"].ShouldBe("Proveedores nacionales (FLU-PROV)");
    }

    [Fact]
    public void Sin_tipos_de_vinculo_la_plantilla_lo_avisa_y_no_ofrece_las_listas_vacias()
    {
        var libro = Plantilla(CatalogoDePlantilla.Vacio);
        var validaciones = Parte(libro, "xl/worksheets/sheet1.xml").Descendants(Principal + "dataValidation").Select(v => v.Attribute("sqref")!.Value).ToList();

        validaciones.ShouldNotContain("E2:E10001");
        validaciones.ShouldNotContain("J2:J10001");
        string.Join('\n', Filas(Parte(libro, "xl/worksheets/sheet2.xml")).SelectMany(f => f.Values)).ShouldContain("aún no tiene tipos de vínculo activos");
        ArchivoDeLote.Plantilla("xlsx").Contenido.Length.ShouldBeGreaterThan(0); // sin catálogo también se descarga
    }

    [Fact]
    public void El_csv_sigue_siendo_solo_los_encabezados_sin_estilos()
    {
        var (contenido, tipo, nombre) = ArchivoDeLote.Plantilla("csv", Norte);
        tipo.ShouldBe(ArchivoDeLote.TipoCsv);
        nombre.ShouldBe("plantilla-invitacion-masiva.csv");
        Encoding.UTF8.GetString(contenido).TrimStart('﻿').ShouldBe(string.Join(';', ArchivoDeLote.Columnas.Select(c => c.Encabezado)) + "\r\n");
    }

    [Fact]
    public void Lo_que_el_usuario_elige_de_las_listas_se_lee_como_codigos()
    {
        var llena = Llenar(Plantilla(),
            // Una fila por tercero, en el orden de las columnas de la plantilla.
            ["Número de Identificación Tributaria (NIT)", "900123456", "Aceros del Norte S.A.S.", "compras@aceros.co", "Proveedor (PROVEEDOR)", "Colombia (CO)", "8", "Jurídica",
                "Aceros", "Proveedores nacionales (FLU-PROV)", "Laura", "0301234567"],
            ["Cédula de ciudadanía (CC)", "0012345678", "Ana Gómez", "ana@correo.co", "Contratista (CONTRATISTA)"],
            ["Registro Único de Contribuyentes (RUC)", "20123456789", "Inca S.A.", "inca@correo.pe", "PROVEEDOR", "Perú (PE)"],
            ["cc", "1020304050", "Solo códigos", "codigos@correo.co", "proveedor", "co"],
            ["Cédula de ciudadanía", "1020304051", "Solo el nombre del tipo", "nombre@correo.co", "PROVEEDOR", "Colombia"]);

        var filas = ArchivoDeLote.Leer(new ArchivoDeLoteDto("lote.xlsx", Convert.ToBase64String(llena)));

        filas.Count.ShouldBe(5);
        filas[0].Pais.ShouldBe("CO");
        filas[0].TipoIdentificacion.ShouldBe("NIT");
        filas[0].NumeroIdentificacion.ShouldBe("900123456");
        filas[0].DigitoVerificacion.ShouldBe("8");
        filas[0].TipoPersona.ShouldBe("Jurídica");
        filas[0].TipoVinculo.ShouldBe("PROVEEDOR");
        filas[0].Flujo.ShouldBe("FLU-PROV");
        filas[0].Telefono.ShouldBe("0301234567"); // los ceros se conservan: es una celda de texto
        filas[1].TipoIdentificacion.ShouldBe("CC");
        filas[1].NumeroIdentificacion.ShouldBe("0012345678");
        filas[1].Pais.ShouldBeNull(); // vacío = Colombia
        filas[1].TipoVinculo.ShouldBe("CONTRATISTA");
        filas[2].Pais.ShouldBe("PE");
        filas[2].TipoIdentificacion.ShouldBe("RUC");
        filas[3].ShouldSatisfyAllConditions(f => f.Pais.ShouldBe("co"), f => f.TipoIdentificacion.ShouldBe("cc"), f => f.TipoVinculo.ShouldBe("proveedor"));
        filas[4].Pais.ShouldBe("CO");
        filas[4].TipoIdentificacion.ShouldBe("CC");
    }

    [Theory]
    [InlineData("Proveedor (PROVEEDOR)", "PROVEEDOR")]
    [InlineData("PROVEEDOR", "PROVEEDOR")]
    [InlineData("  Registro Único de Contribuyente (DGI) (RUC) ", "RUC")]
    [InlineData("Identificación fiscal del país (ID_FISCAL)", "ID_FISCAL")]
    [InlineData("Sin código", "Sin código")]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void El_codigo_de_un_valor_de_lista_es_lo_que_va_entre_parentesis_al_final(string? valor, string? esperado) =>
        ArchivoDeLote.CodigoDe(valor).ShouldBe(esperado);

    [Theory]
    [InlineData("Colombia (CO)", "CO")]
    [InlineData("CO", "CO")]
    [InlineData("Colombia", "CO")]
    [InlineData("  méxico ", "MX")]
    [InlineData("Brasil", "Brasil")] // no es del catálogo: lo dice la validación de la fila
    public void El_pais_se_lee_como_codigo_por_codigo_o_por_nombre(string valor, string esperado) =>
        ArchivoDeLote.PaisDe(valor).ShouldBe(esperado);

    [Fact]
    public void Las_filas_de_la_api_tambien_aceptan_nombre_y_codigo()
    {
        var fila = new FilaDeLoteEntradaDto("Colombia (CO)", "Número de Identificación Tributaria (NIT)", "900123456", null, null, "Aceros", null, "a@b.co", "Proveedor (PROVEEDOR)",
            "Flujo (F1)").ADominio();

        fila.Pais.ShouldBe("CO");
        fila.TipoIdentificacion.ShouldBe("NIT");
        fila.TipoVinculo.ShouldBe("PROVEEDOR");
        fila.Flujo.ShouldBe("F1");
    }
}
