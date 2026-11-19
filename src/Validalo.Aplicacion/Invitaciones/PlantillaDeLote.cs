using System.Globalization;
using System.IO.Compression;
using System.Text;
using Marten;
using Validalo.Aplicacion.Comun;
using Validalo.Dominio.Configuracion;
using Validalo.Dominio.Identificaciones;
using Validalo.Dominio.Plataforma;

namespace Validalo.Aplicacion.Invitaciones;

/// <summary>Un atributo permitido de un tipo de vínculo, tal como la plantilla lo explica y, si es de opciones o sí/no, lo ofrece en una lista desplegable.</summary>
public sealed record AtributoDePlantilla(string Clave, TipoAtributo Tipo, bool Obligatorio, IReadOnlyList<string>? Opciones);

/// <summary>
/// Un tipo de vínculo activo del tenant tal como lo ofrece la plantilla («Nombre (CÓDIGO)») y, si tiene, sus atributos permitidos: la plantilla trae una columna
/// <c>Atributo: clave</c> por cada uno.
/// </summary>
public sealed record TipoVinculoDePlantilla(string Codigo, string Nombre, IReadOnlyList<AtributoDePlantilla>? Atributos = null)
{
    /// <summary>Lo que ve y elige quien llena la plantilla; el importador toma el código entre paréntesis (<see cref="ArchivoDeLote.CodigoDe"/>).</summary>
    public string Etiqueta => $"{Nombre} ({Codigo})";
}

/// <summary>
/// La columna <c>Atributo: clave</c> de la plantilla: un atributo (por su clave) y lo que es en cada tipo de vínculo que lo tiene. Una misma clave en varios tipos comparte columna
/// (<c>nivelRiesgo</c> de Proveedor y de Cliente); la fila dice a cuál se refiere por su tipo de vínculo.
/// </summary>
public sealed record ColumnaDeAtributo(string Clave, IReadOnlyList<(TipoVinculoDePlantilla Tipo, AtributoDePlantilla Atributo)> Definiciones)
{
    public string Encabezado => ArchivoDeLote.EncabezadoDeAtributo(Clave);

    /// <summary>El tipo del atributo si es el mismo en todos los tipos de vínculo que lo tienen; <c>null</c> si difiere.</summary>
    public TipoAtributo? TipoComun => Definiciones.Select(d => d.Atributo.Tipo).Distinct().Count() == 1 ? Definiciones[0].Atributo.Tipo : null;

    /// <summary>Las opciones de todos los tipos (sin repetir): lo que ofrece la lista desplegable.</summary>
    public IReadOnlyList<string> Opciones => [.. Definiciones.SelectMany(d => d.Atributo.Opciones ?? []).Distinct(StringComparer.Ordinal)];

    /// <summary>Si es obligatorio en alguno de los tipos que lo tienen (en las filas de ese tipo hay que llenarlo).</summary>
    public bool ObligatorioEnAlguno => Definiciones.Any(d => d.Atributo.Obligatorio);
}

/// <summary>Un flujo publicado de la empresa para un tipo de vínculo, tal como lo ofrece la plantilla.</summary>
public sealed record FlujoDePlantilla(string Codigo, string Nombre, TipoVinculoDePlantilla TipoVinculo)
{
    public string Etiqueta => $"{Nombre} ({Codigo})";
}

/// <summary>
/// Lo propio de una empresa que la plantilla de invitación masiva ofrece en sus listas desplegables: sus tipos de vínculo activos y sus flujos publicados (el catálogo de
/// países y tipos de identificación es el del sistema).
/// </summary>
public sealed record CatalogoDePlantilla(string? Empresa, IReadOnlyList<TipoVinculoDePlantilla> TiposVinculo, IReadOnlyList<FlujoDePlantilla> Flujos)
{
    public static CatalogoDePlantilla Vacio { get; } = new(null, [], []);

    /// <summary>Las columnas de atributos de la plantilla: una por clave de los atributos de los tipos de vínculo activos (en el orden de los tipos y de sus atributos).</summary>
    public IReadOnlyList<ColumnaDeAtributo> Atributos =>
    [
        .. TiposVinculo.SelectMany(t => (t.Atributos ?? []).Select(a => (Tipo: t, Atributo: a)))
            .GroupBy(x => x.Atributo.Clave, StringComparer.Ordinal)
            .Select(g => new ColumnaDeAtributo(g.Key, [.. g.Select(x => (x.Tipo, x.Atributo))]))
    ];

    /// <summary>Los tipos de vínculo activos del tenant (con sus atributos) y los flujos con versión publicada de la empresa activa, por nombre.</summary>
    public static async Task<CatalogoDePlantilla> CargarAsync(SesionDeEmpresa empresa, CancellationToken ct)
    {
        var orden = StringComparer.Create(CultureInfo.InvariantCulture, ignoreCase: true);
        var tipos = (await empresa.Sesion.Query<TipoVinculo>().ToListAsync(ct)).Where(t => t.Activo).OrderBy(t => t.Nombre, orden).ThenBy(t => t.Codigo, orden).ToList();
        var porId = tipos.ToDictionary(t => t.Id, t => new TipoVinculoDePlantilla(t.Codigo, t.Nombre,
            [.. t.AtributosPermitidos.Select(a => new AtributoDePlantilla(a.Clave, a.Tipo, a.Obligatorio, a.Opciones))]));
        var flujos = (await empresa.Flujos().ToListAsync(ct))
            .Where(f => f.VersionPublicada is not null && porId.ContainsKey(f.TipoVinculoId))
            .Select(f => new FlujoDePlantilla(f.Codigo, f.Nombre, porId[f.TipoVinculoId]))
            .OrderBy(f => f.TipoVinculo.Nombre, orden).ThenBy(f => f.Nombre, orden).ThenBy(f => f.Codigo, orden)
            .ToList();
        return new CatalogoDePlantilla((await empresa.Sesion.LoadAsync<Empresa>(empresa.EmpresaId, ct))?.Nombre, [.. porId.Values.OrderBy(t => t.Nombre, orden).ThenBy(t => t.Codigo, orden)], flujos);
    }
}

/// <summary>
/// La plantilla Excel de la invitación por lote: tres hojas —<c>Invitaciones</c> (la de datos, la primera: es la que leen el importador y la vista previa; solo trae el
/// encabezado), <c>Instrucciones</c> y <c>Listas</c> (oculta y protegida: el origen de las listas desplegables)—. El encabezado lleva el azul de la marca (obligatorias con
/// asterisco y un tono propio, opcionales en gris azulado) con una nota de ayuda en cada columna, fila fija y filtros; el número de identificación, el DV y el teléfono son de texto
/// (Excel no se come los ceros); y las celdas ofrecen listas con lo configurado: países, tipos de identificación del país elegido, tipo de persona, tipos de vínculo activos de la
/// empresa y los flujos publicados del tipo elegido, siempre como «Nombre (CÓDIGO)», que el importador entiende (<see cref="ArchivoDeLote.CodigoDe"/>). Sin dependencias, como el resto
/// de los libros: el .xlsx se escribe directo (Office Open XML).
/// </summary>
public static class PlantillaDeLoteXlsx
{
    /// <summary>Hasta dónde llegan las listas y validaciones: el máximo de filas de un lote por omisión.</summary>
    private const int FilasConListas = LotesEndpoints.MaximoFilasPorOmision;

    private const string HojaInstrucciones = "Instrucciones";
    private const string HojaListas = "Listas";
    private const string PaisPorOmision = "Colombia (CO)";

    // Estilos (cellXfs): ver EstilosXml.
    private const int EstiloEncabezadoObligatoria = 1;
    private const int EstiloEncabezadoOpcional = 2;
    private const int EstiloTexto = 3;
    private const int EstiloTitulo = 4;
    private const int EstiloAtenuado = 5;
    private const int EstiloSeccion = 6;
    private const int EstiloTablaEncabezado = 7;
    private const int EstiloTablaCelda = 8;
    private const int EstiloTablaNegrita = 9;
    private const int EstiloTablaTexto = 10;
    private const int EstiloPasoNumero = 11;
    private const int EstiloPasoTexto = 12;

    public static byte[] Crear(CatalogoDePlantilla catalogo)
    {
        var listas = new Listas(catalogo);
        var columnas = ColumnasDe(catalogo);
        var notas = columnas.Select((c, i) => (Referencia: $"{HojaDeCalculo.Columna(i)}1", Texto: NotaDe(c, catalogo))).ToList();

        using var memoria = new MemoryStream();
        using (var zip = new ZipArchive(memoria, ZipArchiveMode.Create, leaveOpen: true))
        {
            var ultima = HojaDeCalculo.Columna(columnas.Count - 1);
            HojaDeCalculo.Escribir(zip, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                <Default Extension="xml" ContentType="application/xml"/>
                <Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>
                <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                <Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>
                </Types>
                """);
            HojaDeCalculo.Escribir(zip, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                </Relationships>
                """);
            HojaDeCalculo.Escribir(zip, "xl/workbook.xml", $"""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="0"/></bookViews>
                <sheets>
                <sheet name="{HojaDeCalculo.Xml(ArchivoDeLote.HojaDeDatos)}" sheetId="1" r:id="rId1"/>
                <sheet name="{HojaInstrucciones}" sheetId="2" r:id="rId2"/>
                <sheet name="{HojaListas}" sheetId="3" state="hidden" r:id="rId3"/>
                </sheets>
                <definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">{HojaDeCalculo.Xml(ArchivoDeLote.HojaDeDatos)}!$A$1:${ultima}$1</definedName></definedNames>
                </workbook>
                """);
            HojaDeCalculo.Escribir(zip, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
                <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
                <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);
            HojaDeCalculo.Escribir(zip, "xl/styles.xml", EstilosXml);
            HojaDeCalculo.Escribir(zip, "xl/worksheets/_rels/sheet1.xml.rels", """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>
                <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/>
                </Relationships>
                """);
            HojaDeCalculo.Escribir(zip, "xl/comments1.xml", ComentariosXml(notas));
            HojaDeCalculo.Escribir(zip, "xl/drawings/vmlDrawing1.vml", VmlXml(notas.Count));
            HojaDeCalculo.Escribir(zip, "xl/worksheets/sheet1.xml", HojaDeDatosXml(listas, catalogo, columnas));
            HojaDeCalculo.Escribir(zip, "xl/worksheets/sheet2.xml", HojaDeInstruccionesXml(catalogo, columnas));
            HojaDeCalculo.Escribir(zip, "xl/worksheets/sheet3.xml", HojaDeListasXml(listas));
        }

        return memoria.ToArray();
    }

    // ---------- Listas: lo que ofrecen las celdas ----------

    /// <summary>Una columna de la hoja de datos: las de siempre (<see cref="ArchivoDeLote.Columnas"/>) y, después, una <c>Atributo: clave</c> por cada atributo de los tipos de vínculo.</summary>
    private sealed record Columna(string Campo, string Encabezado, bool Obligatoria, ColumnaDeAtributo? Atributo);

    private static IReadOnlyList<Columna> ColumnasDe(CatalogoDePlantilla catalogo) =>
    [
        .. ArchivoDeLote.Columnas.Select(c => new Columna(c.Campo, c.Encabezado, c.Obligatoria, null)),
        .. catalogo.Atributos.Select(a => new Columna($"atributo:{a.Clave}", a.Encabezado, false, a))
    ];

    /// <summary>
    /// Los valores de la hoja oculta <c>Listas</c> y dónde quedan: A tipos de vínculo, B tipo de persona, C países, D–E tipos de identificación por país (la clave repetida en D, sus
    /// tipos en E, agrupados), F–G flujos por tipo de vínculo (clave en F, flujos en G) y, desde la H, las opciones de cada atributo de un solo tipo «una opción» (una columna por atributo).
    /// </summary>
    private sealed class Listas
    {
        /// <summary>Primera columna (desde 0) de las listas de opciones de los atributos: la H.</summary>
        public const int PrimeraDeAtributos = 7;

        public IReadOnlyList<string> TiposVinculo { get; }

        public IReadOnlyList<string> TiposPersona { get; } = ["Natural", "Jurídica", "Consorcio"];

        public IReadOnlyList<string> Paises { get; }

        public IReadOnlyList<(string Clave, string Valor)> TiposIdentificacion { get; }

        public IReadOnlyList<(string Clave, string Valor)> Flujos { get; }

        /// <summary>Las opciones de los atributos que ofrecen una lista desplegable (los de un solo tipo «una opción»), en el orden de sus columnas de la hoja de listas.</summary>
        public IReadOnlyList<(string Clave, IReadOnlyList<string> Opciones)> Atributos { get; }

        public Listas(CatalogoDePlantilla catalogo)
        {
            TiposVinculo = [.. catalogo.TiposVinculo.Select(t => t.Etiqueta)];
            Paises = [.. CatalogoIdentificacion.Paises.Select(EtiquetaDe)];
            TiposIdentificacion =
            [
                .. CatalogoIdentificacion.Paises.SelectMany(p => CatalogoIdentificacion.TiposDe(p.Codigo).Select(t => (EtiquetaDe(p), $"{t.Nombre} ({t.Codigo})")))
            ];
            Flujos = [.. catalogo.Flujos.Select(f => (f.TipoVinculo.Etiqueta, f.Etiqueta))];
            Atributos = [.. catalogo.Atributos.Where(a => a.TipoComun == TipoAtributo.Opcion && a.Opciones.Count > 0).Select(a => (a.Clave, a.Opciones))];
        }

        /// <summary>La columna (letra) de la hoja de listas con las opciones de un atributo.</summary>
        public string ColumnaDe(string clave) => HojaDeCalculo.Columna(PrimeraDeAtributos + Atributos.Select((a, i) => (a.Clave, i)).First(x => x.Clave == clave).i);

        public int Maximo => new[] { TiposVinculo.Count, TiposPersona.Count, Paises.Count, TiposIdentificacion.Count, Flujos.Count, Atributos.Select(a => a.Opciones.Count).DefaultIfEmpty(0).Max() }.Max();
    }

    private static string EtiquetaDe(Pais pais) => $"{pais.Nombre} ({pais.Codigo})";

    private static int Indice(string campo) => ArchivoDeLote.Columnas.Select((c, i) => (c.Campo, i)).First(x => x.Campo == campo).i;

    private static string Letra(string campo) => HojaDeCalculo.Columna(Indice(campo));

    // ---------- Hoja «Invitaciones» ----------

    private static string HojaDeDatosXml(Listas listas, CatalogoDePlantilla catalogo, IReadOnlyList<Columna> columnas)
    {
        var ultima = HojaDeCalculo.Columna(columnas.Count - 1);
        var hoja = new StringBuilder();
        hoja.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
            .Append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">""")
            .Append("""<sheetPr><tabColor rgb="FF2F55D9"/></sheetPr>""")
            .Append($"<dimension ref=\"A1:{ultima}1\"/>")
            .Append("""<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>""")
            .Append("""<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>""")
            .Append("""<sheetFormatPr defaultRowHeight="15"/>""")
            .Append("<cols>");
        for (var i = 0; i < columnas.Count; i++)
        {
            // Número, DV y teléfono son de texto desde la primera fila vacía: Excel no se come los ceros de la izquierda. Los atributos también (las fechas se quedan como
            // se escriben, AAAA-MM-DD), salvo los números, que Excel guarda como números.
            var texto = columnas[i].Campo is "numeroIdentificacion" or "digitoVerificacion" or "telefono" || columnas[i].Atributo is { } a && a.TipoComun != TipoAtributo.Numero;
            hoja.Append($"<col min=\"{i + 1}\" max=\"{i + 1}\" width=\"{Ancho(columnas[i].Campo)}\" customWidth=\"1\"{(texto ? $" style=\"{EstiloTexto}\"" : string.Empty)}/>");
        }

        hoja.Append("</cols><sheetData><row r=\"1\" ht=\"36\" customHeight=\"1\">");
        for (var i = 0; i < columnas.Count; i++)
        {
            var (_, encabezado, obligatoria, _) = columnas[i];
            hoja.Append($"<c r=\"{HojaDeCalculo.Columna(i)}1\" s=\"{(obligatoria ? EstiloEncabezadoObligatoria : EstiloEncabezadoOpcional)}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                .Append(HojaDeCalculo.Xml(obligatoria ? $"{encabezado} *" : encabezado)).Append("</t></is></c>");
        }

        hoja.Append("</row></sheetData>")
            .Append($"<autoFilter ref=\"A1:{ultima}1\"/>");

        var validaciones = ValidacionesXml(listas, catalogo, columnas).ToList();
        hoja.Append($"<dataValidations count=\"{validaciones.Count}\">").AppendJoin(string.Empty, validaciones).Append("</dataValidations>")
            .Append("""<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>""")
            .Append("""<legacyDrawing r:id="rId1"/></worksheet>""");
        return hoja.ToString();
    }

    private static int Ancho(string campo) => campo switch
    {
        "tipoIdentificacion" => 36,
        "numeroIdentificacion" => 24,
        "nombre" => 36,
        "correo" => 32,
        "tipoVinculo" => 30,
        "pais" => 20,
        "digitoVerificacion" => 8,
        "tipoPersona" => 16,
        "nombreComercial" => 28,
        "flujo" => 30,
        "contacto" => 24,
        _ when campo.StartsWith("atributo:", StringComparison.Ordinal) => 24,
        _ => 18
    };

    private static IEnumerable<string> ValidacionesXml(Listas listas, CatalogoDePlantilla catalogo, IReadOnlyList<Columna> columnas)
    {
        string RangoDe(string letra) => $"{letra}2:{letra}{FilasConListas + 1}";
        string Rango(string campo) => RangoDe(Letra(campo));

        // País: lista fija (el catálogo del sistema); otro código ISO se admite (los demás países usan pasaporte o identificación fiscal), con aviso.
        yield return Lista("pais", $"{HojaListas}!$C$2:$C${listas.Paises.Count + 1}", "warning", "País",
            "Elige un país de la lista. Si es otro, escribe su código ISO de dos letras (por ejemplo BR).");

        // Tipo de identificación: los del país de la fila (Colombia si está vacío), con aviso si se escribe otro.
        var tipos = listas.TiposIdentificacion.Count + 1;
        var pais = Letra("pais");
        var llave = $"IF(${pais}2=\"\",\"{PaisPorOmision}\",${pais}2)";
        yield return Lista("tipoIdentificacion",
            $"OFFSET({HojaListas}!$D$1,MATCH({llave},{HojaListas}!$D$1:$D${tipos},0)-1,1,COUNTIF({HojaListas}!$D$1:$D${tipos},{llave}),1)", "warning", "Tipo de identificación",
            "Elige un tipo de la lista (depende del país). Si el tercero no es colombiano, elige primero el país.");

        yield return Lista("tipoPersona", $"{HojaListas}!$B$2:$B${listas.TiposPersona.Count + 1}", "warning", "Tipo de persona", "Natural, Jurídica o Consorcio.");

        if (listas.TiposVinculo.Count > 0)
            yield return Lista("tipoVinculo", $"{HojaListas}!$A$2:$A${listas.TiposVinculo.Count + 1}", "stop", "Tipo de vínculo",
                $"Elige uno de los tipos de vínculo activos{(catalogo.Empresa is null ? string.Empty : $" de {catalogo.Empresa}")}.");

        if (listas.Flujos.Count > 0)
        {
            var flujos = listas.Flujos.Count + 1;
            var tipo = Letra("tipoVinculo");
            yield return Lista("flujo",
                $"OFFSET({HojaListas}!$F$1,MATCH(${tipo}2,{HojaListas}!$F$1:$F${flujos},0)-1,1,COUNTIF({HojaListas}!$F$1:$F${flujos},${tipo}2),1)", "warning", "Flujo",
                "Elige un flujo publicado del tipo de vínculo (elige primero el tipo). Déjalo vacío para que se asigne según las reglas de la empresa.");
        }

        // Correo: una comprobación simple (arroba, un punto después y sin espacios); la revisión completa la hace la vista previa.
        var c = Letra("correo");
        yield return $"<dataValidation type=\"custom\" allowBlank=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"Correo\" error=\"Escribe un correo válido, por ejemplo compras@empresa.co.\" sqref=\"{Rango("correo")}\">" +
                     $"<formula1>{HojaDeCalculo.Xml($"AND(ISNUMBER(FIND(\"@\",{c}2)),ISNUMBER(FIND(\".\",{c}2,FIND(\"@\",{c}2)+2)),ISERROR(FIND(\" \",{c}2)),LEN({c}2)<=254)")}</formula1></dataValidation>";

        foreach (var campo in new[] { "nombre", "nombreComercial", "contacto", "telefono" })
            yield return $"<dataValidation type=\"textLength\" operator=\"lessThanOrEqual\" allowBlank=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"Texto demasiado largo\" " +
                         $"error=\"Admite hasta {ValidacionDeLote.LongitudMaximaTexto} caracteres.\" sqref=\"{Rango(campo)}\"><formula1>{ValidacionDeLote.LongitudMaximaTexto}</formula1></dataValidation>";

        // Atributos del vínculo: «una opción» (un solo tipo en todos los tipos de vínculo que lo tienen) ofrece sus opciones y «sí/no» ofrece Sí y No; siempre con aviso (no bloquea:
        // la fila puede ser de un tipo con otras opciones, y la vista previa dice qué corregir). Los demás tipos (texto, número, fecha, varias opciones) se escriben.
        for (var i = 0; i < columnas.Count; i++)
        {
            if (columnas[i].Atributo is not { } atributo)
                continue;
            var rango = RangoDe(HojaDeCalculo.Columna(i));
            if (atributo.TipoComun == TipoAtributo.Opcion && listas.Atributos.Any(a => a.Clave == atributo.Clave))
                yield return ListaEn(rango, $"{HojaListas}!${listas.ColumnaDe(atributo.Clave)}$2:${listas.ColumnaDe(atributo.Clave)}${atributo.Opciones.Count + 1}", "warning", atributo.Encabezado,
                    "Elige una de las opciones de la lista.");
            else if (atributo.TipoComun == TipoAtributo.Booleano)
                yield return ListaEn(rango, "\"Sí,No\"", "warning", atributo.Encabezado, "Elige Sí o No.");
        }

        string Lista(string campo, string origen, string estilo, string titulo, string aviso) => ListaEn(Rango(campo), origen, estilo, titulo, aviso);

        string ListaEn(string rango, string origen, string estilo, string titulo, string aviso) =>
            $"<dataValidation type=\"list\" errorStyle=\"{estilo}\" allowBlank=\"1\" showErrorMessage=\"1\" errorTitle=\"{HojaDeCalculo.Xml(titulo)}\" " +
            $"error=\"{HojaDeCalculo.Xml(estilo == "stop" ? aviso : $"{aviso} ¿Quieres usar ese valor de todos modos?")}\" sqref=\"{rango}\"><formula1>{HojaDeCalculo.Xml(origen)}</formula1></dataValidation>";
    }

    // ---------- Notas de los encabezados (comentarios) ----------

    private static string NotaDe(Columna columna, CatalogoDePlantilla catalogo)
    {
        var (descripcion, _) = AyudaDe(columna, catalogo);
        return $"{columna.Encabezado} ({Obligatoriedad(columna).ToLowerInvariant()})\n{descripcion}";
    }

    /// <summary>«Obligatoria», «Opcional» o, en un atributo que alguno de los tipos exige, «Según el tipo de vínculo».</summary>
    private static string Obligatoriedad(Columna columna) =>
        columna.Obligatoria ? "Obligatoria" : columna.Atributo is { ObligatorioEnAlguno: true } ? "Según el tipo de vínculo" : "Opcional";

    private static (string Descripcion, string Ejemplo) AyudaDe(Columna columna, CatalogoDePlantilla catalogo) =>
        columna.Atributo is { } atributo ? AyudaDeAtributo(atributo) : Ayuda(columna.Campo, catalogo);

    /// <summary>
    /// Qué escribir en la columna de un atributo del vínculo: qué valor admite, a qué tipos de vínculo aplica y cuáles lo exigen. Si la misma clave es de otro tipo de dato en otro
    /// tipo de vínculo, lo dice por tipo.
    /// </summary>
    private static (string Descripcion, string Ejemplo) AyudaDeAtributo(ColumnaDeAtributo columna)
    {
        var tipos = string.Join(", ", columna.Definiciones.Select(d => d.Atributo.Obligatorio ? $"{d.Tipo.Nombre} (obligatorio)" : d.Tipo.Nombre));
        var que = columna.TipoComun is { } comun
            ? Que(comun, columna.Opciones)
            : string.Join(" ", columna.Definiciones.Select(d => $"En {d.Tipo.Nombre}: {Que(d.Atributo.Tipo, d.Atributo.Opciones ?? [])}."));
        var descripcion = $"Atributo del vínculo: {que}. Aplica a: {tipos}. Llénala solo en las filas de esos tipos de vínculo; en los demás déjala vacía.";
        var ejemplo = columna.TipoComun switch
        {
            TipoAtributo.Numero => "1500000",
            TipoAtributo.Fecha => "2026-12-31",
            TipoAtributo.Booleano => "Sí",
            TipoAtributo.Opcion => columna.Opciones.FirstOrDefault() ?? string.Empty,
            TipoAtributo.ListaOpciones => string.Join("; ", columna.Opciones.Take(2)),
            TipoAtributo.Texto => "Texto libre",
            _ => string.Empty
        };
        return (descripcion, ejemplo);
    }

    private static string Que(TipoAtributo tipo, IReadOnlyList<string> opciones) => tipo switch
    {
        TipoAtributo.Numero => "un número con punto decimal (por ejemplo 1500000 o 12.5)",
        TipoAtributo.Fecha => "una fecha AAAA-MM-DD (por ejemplo 2026-12-31)",
        TipoAtributo.Booleano => "Sí o No",
        TipoAtributo.Opcion => $"una de estas opciones: {string.Join(", ", opciones)}",
        TipoAtributo.ListaOpciones => $"una o varias de estas opciones, separadas por punto y coma (;) o coma (,): {string.Join(", ", opciones)}",
        _ => "un texto"
    };

    private static string ComentariosXml(IReadOnlyList<(string Referencia, string Texto)> notas)
    {
        var xml = new StringBuilder();
        xml.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
            .Append("""<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>Valídalo</author></authors><commentList>""");
        foreach (var (referencia, texto) in notas)
            xml.Append($"<comment ref=\"{referencia}\" authorId=\"0\"><text><t xml:space=\"preserve\">{HojaDeCalculo.Xml(texto)}</t></text></comment>");
        return xml.Append("</commentList></comments>").ToString();
    }

    /// <summary>El dibujo VML que Excel necesita para mostrar cada nota (oculta hasta pasar el cursor por el encabezado).</summary>
    private static string VmlXml(int columnas)
    {
        var vml = new StringBuilder();
        vml.Append("""<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">""")
            .Append("""<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>""")
            .Append("""<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>""");
        for (var i = 0; i < columnas; i++)
            vml.Append($"<v:shape id=\"_x0000_s{1025 + i}\" type=\"#_x0000_t202\" style=\"position:absolute;margin-left:0;margin-top:0;width:240pt;height:96pt;z-index:{i + 1};visibility:hidden\" fillcolor=\"#ffffe1\" o:insetmode=\"auto\">")
                .Append("""<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>""")
                .Append($"<x:ClientData ObjectType=\"Note\"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>{i + 1}, 15, 0, 2, {i + 4}, 15, 7, 16</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>0</x:Row><x:Column>{i}</x:Column></x:ClientData></v:shape>");
        return vml.Append("</xml>").ToString();
    }

    // ---------- Hoja «Instrucciones» ----------

    /// <summary>Qué escribir en cada columna y un ejemplo (el mismo texto va en la nota del encabezado y en la tabla de instrucciones).</summary>
    private static (string Descripcion, string Ejemplo) Ayuda(string campo, CatalogoDePlantilla catalogo)
    {
        var empresa = catalogo.Empresa is null ? "la empresa" : catalogo.Empresa;
        var tipo = catalogo.TiposVinculo.FirstOrDefault()?.Etiqueta ?? "Proveedor (PROVEEDOR)";
        var flujo = catalogo.Flujos.FirstOrDefault(f => f.TipoVinculo.Etiqueta == tipo)?.Etiqueta ?? string.Empty;
        return campo switch
        {
            "pais" => ("Elige el país de la lista; si la dejas vacía es Colombia (CO). Otros países admiten pasaporte e identificación fiscal.", "Colombia (CO)"),
            "tipoIdentificacion" => ("Elige de la lista el tipo de documento del tercero. Las opciones dependen del país: si no es colombiano, elige primero el país.",
                "Número de Identificación Tributaria (NIT)"),
            "numeroIdentificacion" => ("Solo el número, sin puntos ni espacios. Con NIT puedes escribir el dígito de verificación con guion (900123456-7) o ponerlo en la columna DV. " +
                                       "La columna es de texto: Excel no le quita los ceros de la izquierda.", "900123456"),
            "digitoVerificacion" => ("Si la dejas vacía, Valídalo lo calcula; si lo escribes, lo comprueba.", DigitoVerificacion.Calcular(AlgoritmoDv.NitColombia, "900123456") ?? "7"),
            "tipoPersona" => ("Natural, Jurídica o Consorcio. Si la dejas vacía: Jurídica con NIT y Natural con los demás tipos.", "Jurídica"),
            "nombre" => ("Razón social de la empresa o nombres y apellidos de la persona (hasta 200 caracteres).", "Aceros del Norte S.A.S."),
            "nombreComercial" => ("Nombre con el que se conoce al tercero (hasta 200 caracteres).", "Aceros del Norte"),
            "correo" => ("Correo al que llega la invitación.", "compras@acerosdelnorte.co"),
            "contacto" => ("Nombre de la persona de contacto: con el correo y el teléfono queda como contacto del tercero.", "Laura Gómez"),
            "telefono" => ("Teléfono de contacto. La columna es de texto: Excel no le quita los ceros.", "3001234567"),
            "tipoVinculo" => ($"Elige de la lista uno de los tipos de vínculo activos de {empresa}. Si el tipo exige aprobación antes de invitar, el lote espera a que otra persona lo apruebe.", tipo),
            "flujo" => ($"Elige un flujo publicado de {empresa} para ese tipo de vínculo (la lista depende del tipo que elegiste). Vacía: se asigna el flujo que corresponda según las reglas de la empresa.",
                flujo),
            _ => (string.Empty, string.Empty)
        };
    }

    private static string HojaDeInstruccionesXml(CatalogoDePlantilla catalogo, IReadOnlyList<Columna> columnas)
    {
        var empresa = catalogo.Empresa is null ? "la empresa" : catalogo.Empresa;
        var hoja = new StringBuilder();
        var combinadas = new List<string>();
        hoja.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
            .Append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""")
            .Append("""<sheetPr><tabColor rgb="FF0E2A6B"/></sheetPr>""")
            .Append("""<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>""")
            .Append("""<sheetFormatPr defaultRowHeight="15"/>""")
            .Append("""<cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="78" customWidth="1"/><col min="4" max="4" width="40" customWidth="1"/></cols>""")
            .Append("<sheetData>");

        var fila = 1;
        void Texto(string columna, string texto, int estilo) =>
            hoja.Append($"<c r=\"{columna}{fila}\" s=\"{estilo}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{HojaDeCalculo.Xml(texto)}</t></is></c>");

        void Vacia(string columna, int estilo) => hoja.Append($"<c r=\"{columna}{fila}\" s=\"{estilo}\"/>");

        // Un párrafo que ocupa de la A a la D (o de la B a la D con un número a la izquierda): su alto se calcula, porque Excel no ajusta el de las celdas combinadas.
        void Parrafo(string? numero, string texto, int estilo, int caracteresPorLinea)
        {
            var lineas = Math.Max(1, (int)Math.Ceiling(texto.Length / (double)caracteresPorLinea));
            hoja.Append($"<row r=\"{fila}\" ht=\"{lineas * 15 + 4}\" customHeight=\"1\">");
            if (numero is not null)
                Texto("A", numero, EstiloPasoNumero);
            var primera = numero is null ? "A" : "B";
            Texto(primera, texto, estilo);
            foreach (var columna in new[] { "B", "C", "D" }.Where(c => string.CompareOrdinal(c, primera) > 0))
                Vacia(columna, estilo);
            hoja.Append("</row>");
            combinadas.Add($"{primera}{fila}:D{fila}");
            fila++;
        }

        hoja.Append($"<row r=\"{fila}\" ht=\"26\" customHeight=\"1\">");
        Texto("A", "Plantilla de invitación por lote", EstiloTitulo);
        hoja.Append("</row>");
        fila++;
        Parrafo(null, $"Para {empresa}. Las listas desplegables de la hoja «{ArchivoDeLote.HojaDeDatos}» salen de su configuración en Valídalo.", EstiloAtenuado, 150);
        fila++;

        hoja.Append($"<row r=\"{fila}\" ht=\"20\" customHeight=\"1\">");
        Texto("A", "Cómo se usa", EstiloSeccion);
        hoja.Append("</row>");
        fila++;
        var pasos = new List<string>
        {
            $"Escribe una fila por cada tercero en la hoja «{ArchivoDeLote.HojaDeDatos}». No cambies los nombres de las columnas ni borres la fila de encabezados.",
            "Las columnas con asterisco (*) son obligatorias; las demás son opcionales. Donde la celda ofrece una lista desplegable, elige el valor de la lista.",
            "Si el tercero no es colombiano, elige primero el país: la lista de tipos de identificación depende de él.",
            "Guarda el archivo como Excel (.xlsx) y súbelo en «Nuevo lote»: antes de invitar, Valídalo revisa cada fila y te dice qué corregir."
        };
        if (catalogo.Atributos.Count > 0)
            pasos.Add("Las columnas «Atributo: …» son los atributos de los tipos de vínculo: llena las de cada fila según su tipo de vínculo y deja vacías las que ese tipo no tiene (un valor en un atributo que el " +
                      "tipo de la fila no admite es un error de esa fila). Los atributos obligatorios del tipo hay que llenarlos al crear el vínculo; si el tercero ya tenía el vínculo, solo se aplican los que vienen. " +
                      "Número: con punto decimal. Fecha: AAAA-MM-DD. Sí/No: elige de la lista. Varias opciones en un atributo de lista: sepáralas con punto y coma (;) o coma (,).");
        if (catalogo.TiposVinculo.Count == 0)
            pasos.Add("Esta empresa aún no tiene tipos de vínculo activos: créalos en Configuración › Tipos de vínculo antes de invitar.");
        for (var i = 0; i < pasos.Count; i++)
            Parrafo((i + 1).ToString(CultureInfo.InvariantCulture), pasos[i], EstiloPasoTexto, 118);
        fila++;

        hoja.Append($"<row r=\"{fila}\" ht=\"20\" customHeight=\"1\">");
        Texto("A", $"Las columnas de la hoja «{ArchivoDeLote.HojaDeDatos}»", EstiloSeccion);
        hoja.Append("</row>");
        fila++;
        hoja.Append($"<row r=\"{fila}\" ht=\"22\" customHeight=\"1\">");
        Texto("A", "Columna", EstiloTablaEncabezado);
        Texto("B", "¿Obligatoria?", EstiloTablaEncabezado);
        Texto("C", "Qué escribir", EstiloTablaEncabezado);
        Texto("D", "Ejemplo de una fila", EstiloTablaEncabezado);
        hoja.Append("</row>");
        fila++;
        foreach (var columna in columnas)
        {
            var (descripcion, ejemplo) = AyudaDe(columna, catalogo);
            hoja.Append($"<row r=\"{fila}\">");
            Texto("A", columna.Encabezado, EstiloTablaNegrita);
            Texto("B", columna.Obligatoria ? "Sí" : columna.Atributo is { ObligatorioEnAlguno: true } ? "Según el tipo" : "No", EstiloTablaCelda);
            Texto("C", descripcion, EstiloTablaCelda);
            Texto("D", ejemplo, EstiloTablaTexto);
            hoja.Append("</row>");
            fila++;
        }

        fila++;
        Parrafo(null, $"Esta hoja y la hoja de listas (oculta) no se importan: solo se lee la hoja «{ArchivoDeLote.HojaDeDatos}». Borra la fila de ejemplo si la copiaste.", EstiloAtenuado, 150);

        hoja.Append("</sheetData>")
            .Append($"<mergeCells count=\"{combinadas.Count}\">").AppendJoin(string.Empty, combinadas.Select(r => $"<mergeCell ref=\"{r}\"/>")).Append("</mergeCells>")
            .Append("""<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>""");
        return hoja.ToString();
    }

    // ---------- Hoja «Listas» (oculta y protegida) ----------

    private static string HojaDeListasXml(Listas listas)
    {
        var hoja = new StringBuilder();
        hoja.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""")
            .Append("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""")
            .Append("""<sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>""")
            .Append($"<cols><col min=\"1\" max=\"{Listas.PrimeraDeAtributos + listas.Atributos.Count}\" width=\"40\" customWidth=\"1\"/></cols><sheetData>");

        // Las siete primeras columnas son fijas; las siguientes, una por cada atributo «una opción» (sus opciones).
        string[] encabezado = ["Tipos de vínculo", "Tipo de persona", "Países", "País", "Tipos de identificación", "Tipo de vínculo", "Flujos", .. listas.Atributos.Select(a => ArchivoDeLote.EncabezadoDeAtributo(a.Clave))];
        hoja.Append("<row r=\"1\">");
        for (var i = 0; i < encabezado.Length; i++)
            hoja.Append($"<c r=\"{HojaDeCalculo.Columna(i)}1\" s=\"{EstiloTablaEncabezado}\" t=\"inlineStr\"><is><t>{HojaDeCalculo.Xml(encabezado[i])}</t></is></c>");
        hoja.Append("</row>");

        for (var i = 0; i < listas.Maximo; i++)
        {
            var fila = i + 2;
            hoja.Append($"<row r=\"{fila}\">");
            Celda(hoja, "A", fila, i < listas.TiposVinculo.Count ? listas.TiposVinculo[i] : null);
            Celda(hoja, "B", fila, i < listas.TiposPersona.Count ? listas.TiposPersona[i] : null);
            Celda(hoja, "C", fila, i < listas.Paises.Count ? listas.Paises[i] : null);
            Celda(hoja, "D", fila, i < listas.TiposIdentificacion.Count ? listas.TiposIdentificacion[i].Clave : null);
            Celda(hoja, "E", fila, i < listas.TiposIdentificacion.Count ? listas.TiposIdentificacion[i].Valor : null);
            Celda(hoja, "F", fila, i < listas.Flujos.Count ? listas.Flujos[i].Clave : null);
            Celda(hoja, "G", fila, i < listas.Flujos.Count ? listas.Flujos[i].Valor : null);
            for (var k = 0; k < listas.Atributos.Count; k++)
                Celda(hoja, HojaDeCalculo.Columna(Listas.PrimeraDeAtributos + k), fila, i < listas.Atributos[k].Opciones.Count ? listas.Atributos[k].Opciones[i] : null);
            hoja.Append("</row>");
        }

        // Protegida sin contraseña: no se edita por accidente (la hoja ya va oculta).
        hoja.Append("""</sheetData><sheetProtection sheet="1" objects="1" scenarios="1"/>""")
            .Append("""<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>""");
        return hoja.ToString();
    }

    private static void Celda(StringBuilder hoja, string columna, int fila, string? texto)
    {
        if (texto is not null)
            hoja.Append($"<c r=\"{columna}{fila}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{HojaDeCalculo.Xml(texto)}</t></is></c>");
    }

    // ---------- Estilos ----------

    // 0 normal · 1 encabezado obligatoria (azul de la marca) · 2 encabezado opcional (gris azulado) · 3 texto («@») · 4 título · 5 atenuado · 6 sección · 7 encabezado de tabla ·
    // 8 celda de tabla · 9 celda de tabla en negrita · 10 celda de tabla de texto · 11 número de paso · 12 texto de paso. Los colores son los tokens del design system
    // (packages/ui/src/tokens.ts): accionPrimaria #2F55D9, estadoNeutro #6B7590, marcaProfundo #0E2A6B, textoSecundario #4C5670, bordeSutil #E3E8F1.
    private const string EstilosXml = """
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="6">
        <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
        <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
        <font><b/><sz val="16"/><color rgb="FF0E2A6B"/><name val="Calibri"/><family val="2"/></font>
        <font><sz val="11"/><color rgb="FF4C5670"/><name val="Calibri"/><family val="2"/></font>
        <font><b/><sz val="11"/><color rgb="FF0A0F1C"/><name val="Calibri"/><family val="2"/></font>
        <font><b/><sz val="12"/><color rgb="FF0E2A6B"/><name val="Calibri"/><family val="2"/></font>
        </fonts>
        <fills count="5">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF2F55D9"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF6B7590"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FF0E2A6B"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="3">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border><left style="thin"><color rgb="FFE3E8F1"/></left><right style="thin"><color rgb="FFE3E8F1"/></right><top style="thin"><color rgb="FFE3E8F1"/></top><bottom style="thin"><color rgb="FFE3E8F1"/></bottom><diagonal/></border>
        <border><left style="thin"><color rgb="FFFFFFFF"/></left><right style="thin"><color rgb="FFFFFFFF"/></right><top/><bottom/><diagonal/></border>
        </borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="13">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
        <xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
        <xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
        <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>
        <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
        </cellXfs>
        <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>
        """;
}
