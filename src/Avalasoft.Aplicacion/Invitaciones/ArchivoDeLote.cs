using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Identificaciones;
using Avalasoft.Dominio.Invitaciones;

namespace Avalasoft.Aplicacion.Invitaciones;

/// <summary>
/// Plantilla de la invitación masiva (LT-6): las columnas, el archivo descargable (.xlsx o .csv) y la lectura de lo que sube la
/// empresa. Los encabezados se reconocen sin importar mayúsculas, tildes, espacios ni guiones («Número de identificación»,
/// «numero_identificacion» o «NIT»); las columnas que no se reconocen se ignoran y las filas vacías se saltan.
/// </summary>
public static partial class ArchivoDeLote
{
    /// <summary>Columnas en el orden de la plantilla; las obligatorias van primero.</summary>
    public static readonly IReadOnlyList<(string Campo, string Encabezado, bool Obligatoria)> Columnas =
    [
        ("tipoIdentificacion", "Tipo de identificación", true),
        ("numeroIdentificacion", "Número de identificación", true),
        ("nombre", "Razón social o nombres", true),
        ("correo", "Correo", true),
        ("tipoVinculo", "Tipo de vínculo", true),
        ("pais", "País", false),
        ("digitoVerificacion", "DV", false),
        ("tipoPersona", "Tipo de persona", false),
        ("nombreComercial", "Nombre comercial", false),
        ("flujo", "Flujo", false),
        ("contacto", "Contacto", false),
        ("telefono", "Teléfono", false)
    ];

    /// <summary>Encabezado normalizado → campo.</summary>
    private static readonly Dictionary<string, string> Sinonimos = new(StringComparer.Ordinal)
    {
        ["tipoidentificacion"] = "tipoIdentificacion", ["tipodeidentificacion"] = "tipoIdentificacion", ["tipoid"] = "tipoIdentificacion",
        ["tipodocumento"] = "tipoIdentificacion", ["tipodedocumento"] = "tipoIdentificacion",
        ["numeroidentificacion"] = "numeroIdentificacion", ["numerodeidentificacion"] = "numeroIdentificacion", ["identificacion"] = "numeroIdentificacion",
        ["numero"] = "numeroIdentificacion", ["nit"] = "numeroIdentificacion", ["documento"] = "numeroIdentificacion",
        ["numerodocumento"] = "numeroIdentificacion", ["numerodedocumento"] = "numeroIdentificacion",
        ["razonsocialonombres"] = "nombre", ["razonsocial"] = "nombre", ["nombre"] = "nombre", ["nombres"] = "nombre",
        ["nombreorazonsocial"] = "nombre",
        ["correo"] = "correo", ["correoelectronico"] = "correo", ["email"] = "correo", ["correoinvitacion"] = "correo", ["correodeinvitacion"] = "correo",
        ["tipovinculo"] = "tipoVinculo", ["tipodevinculo"] = "tipoVinculo", ["vinculo"] = "tipoVinculo",
        ["pais"] = "pais",
        ["dv"] = "digitoVerificacion", ["digitoverificacion"] = "digitoVerificacion", ["digitodeverificacion"] = "digitoVerificacion",
        ["tipopersona"] = "tipoPersona", ["tipodepersona"] = "tipoPersona",
        ["nombrecomercial"] = "nombreComercial",
        ["flujo"] = "flujo", ["codigoflujo"] = "flujo", ["codigodeflujo"] = "flujo",
        ["contacto"] = "contacto", ["nombrecontacto"] = "contacto", ["nombredelcontacto"] = "contacto",
        ["telefono"] = "telefono", ["celular"] = "telefono"
    };

    public const string TipoCsv = "text/csv; charset=utf-8";

    /// <summary>Nombre de la hoja de datos de la plantilla Excel: la primera, la que lee el importador y la vista previa.</summary>
    public const string HojaDeDatos = "Invitaciones";

    /// <summary>
    /// La plantilla vacía en el formato pedido: <c>xlsx</c> (por omisión) o <c>csv</c>. El Excel es la plantilla de la empresa (<paramref name="catalogo"/>: sus tipos de vínculo
    /// activos y sus flujos publicados), con formato, listas desplegables e instrucciones (<see cref="PlantillaDeLoteXlsx"/>); el CSV son solo los encabezados.
    /// </summary>
    public static (byte[] Contenido, string Tipo, string Nombre) Plantilla(string? formato, CatalogoDePlantilla? catalogo = null)
    {
        if (string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase))
        {
            // Solo los encabezados: los de siempre y, si la empresa tiene atributos en sus tipos de vínculo, una columna «Atributo: clave» por cada uno.
            var encabezados = Columnas.Select(c => c.Encabezado).Concat((catalogo?.Atributos ?? []).Select(a => EncabezadoDeAtributo(a.Clave)));
            return (Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(string.Join(';', encabezados) + "\r\n")).ToArray(), TipoCsv, "plantilla-invitacion-masiva.csv");
        }
        if (formato is not null && !string.Equals(formato, "xlsx", StringComparison.OrdinalIgnoreCase))
            throw ReglaDeNegocioException.Validacion("formato-invalido", "El formato de la plantilla es xlsx o csv.");
        return (PlantillaDeLoteXlsx.Crear(catalogo ?? CatalogoDePlantilla.Vacio), HojaDeCalculo.TipoContenido, "plantilla-invitacion-masiva.xlsx");
    }

    [GeneratedRegex(@"\(([^()]+)\)\s*$")]
    private static partial Regex RegexCodigoEntreParentesis();

    /// <summary>
    /// El código de un valor de lista: las listas de la plantilla ofrecen «Nombre (CÓDIGO)» y el importador entiende tanto eso («Cédula de ciudadanía (CC)» ⇒ <c>CC</c>) como el código
    /// solo. Sin paréntesis al final el valor queda como está.
    /// </summary>
    public static string? CodigoDe(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
            return null;
        var texto = valor.Trim();
        return RegexCodigoEntreParentesis().Match(texto) is { Success: true } m ? m.Groups[1].Value.Trim() : texto;
    }

    /// <summary>
    /// El país como código ISO: «Colombia (CO)», <c>CO</c> o el nombre del país del catálogo («Colombia»). Un país que no se reconoce queda como se escribió (la validación de la
    /// fila dice «pais-invalido»).
    /// </summary>
    public static string? PaisDe(string? valor)
    {
        var codigo = CodigoDe(valor);
        if (codigo is null || codigo.Length == 2)
            return codigo;
        var buscado = Normalizar(codigo);
        return CatalogoIdentificacion.Paises.FirstOrDefault(p => Normalizar(p.Nombre) == buscado)?.Codigo ?? codigo;
    }

    /// <summary>
    /// El tipo de identificación como código: «Cédula de ciudadanía (CC)», <c>CC</c> o el nombre del tipo en el catálogo del país de la fila («Cédula de ciudadanía»). Un valor que no se
    /// reconoce queda como se escribió (la validación de la fila dice «tipo-identificacion-invalido»).
    /// </summary>
    public static string? TipoIdentificacionDe(string? valor, string? pais)
    {
        var codigo = CodigoDe(valor);
        if (codigo is null)
            return null;
        try
        {
            var tipos = CatalogoIdentificacion.TiposDe(pais ?? "CO");
            if (tipos.Any(t => t.Codigo == codigo.ToUpperInvariant()))
                return codigo;
            var buscado = Normalizar(valor);
            return tipos.FirstOrDefault(t => Normalizar(t.Nombre) == buscado)?.Codigo ?? codigo;
        }
        catch (ReglaDeNegocioException)
        {
            return codigo; // el país no es válido: la validación de la fila lo dice
        }
    }

    /// <summary>
    /// Filas del archivo (base64; .xlsx o .csv por la extensión del nombre). 422 <c>archivo-invalido</c> (no se puede leer),
    /// <c>formato-invalido</c> (otra extensión), <c>plantilla-invalida</c> (faltan columnas obligatorias) y
    /// <c>lote-sin-filas</c>.
    /// </summary>
    public static IReadOnlyList<FilaDeLoteEntrada> Leer(ArchivoDeLoteDto archivo)
    {
        byte[] contenido;
        try
        {
            contenido = Convert.FromBase64String(archivo.ContenidoBase64 ?? string.Empty);
        }
        catch (FormatException)
        {
            throw ReglaDeNegocioException.Validacion("archivo-invalido", "El contenido del archivo no está en base64.");
        }

        var nombre = (archivo.Nombre ?? string.Empty).Trim().ToLowerInvariant();
        var filas = nombre.EndsWith(".xlsx", StringComparison.Ordinal) ? LectorDeHojaDeCalculo.Leer(contenido)
            : nombre.EndsWith(".csv", StringComparison.Ordinal) || nombre.EndsWith(".txt", StringComparison.Ordinal) ? Csv(contenido)
            : throw ReglaDeNegocioException.Validacion("formato-invalido", "Sube la plantilla como .xlsx o .csv.");
        return DeFilas(filas);
    }

    /// <summary>Encabezado en la primera fila no vacía; cada fila siguiente con algún valor es una fila del lote.</summary>
    public static IReadOnlyList<FilaDeLoteEntrada> DeFilas(IReadOnlyList<IReadOnlyList<string>> filas)
    {
        var inicio = 0;
        while (inicio < filas.Count && filas[inicio].All(string.IsNullOrWhiteSpace))
            inicio++;
        if (inicio == filas.Count)
            throw ReglaDeNegocioException.Validacion("lote-sin-filas", "El archivo está vacío.");

        var indices = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < filas[inicio].Count; i++)
            if (Sinonimos.TryGetValue(Normalizar(filas[inicio][i]), out var campo))
                indices.TryAdd(campo, i);

        var faltantes = Columnas.Where(c => c.Obligatoria && !indices.ContainsKey(c.Campo)).Select(c => c.Encabezado).ToList();
        if (faltantes.Count > 0)
            throw ReglaDeNegocioException.Validacion("plantilla-invalida",
                $"Al archivo le faltan columnas de la plantilla: {string.Join(", ", faltantes)}. Descarga la plantilla y úsala como base.");

        // Las columnas «Atributo: clave» (una por atributo de los tipos de vínculo); si una clave se repite, vale la primera.
        var columnasDeAtributos = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var i = 0; i < filas[inicio].Count; i++)
            if (ClaveDeAtributo(filas[inicio][i]) is { } claveDeAtributo)
                columnasDeAtributos.TryAdd(claveDeAtributo, i);

        string? Valor(IReadOnlyList<string> fila, string campo) =>
            indices.TryGetValue(campo, out var i) && i < fila.Count && !string.IsNullOrWhiteSpace(fila[i]) ? fila[i].Trim() : null;

        // Solo los atributos con valor: la celda vacía es «no vino». Se guardan como texto; la validación de la fila los convierte al tipo que declara su tipo de vínculo.
        IReadOnlyDictionary<string, JsonElement>? Atributos(IReadOnlyList<string> fila)
        {
            var valores = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var (clave, i) in columnasDeAtributos)
                if (i < fila.Count && !string.IsNullOrWhiteSpace(fila[i]))
                    valores[clave] = JsonSerializer.SerializeToElement(fila[i].Trim());
            return valores.Count == 0 ? null : valores;
        }

        var resultado = new List<FilaDeLoteEntrada>();
        // Las listas de la plantilla ofrecen «Nombre (CÓDIGO)»: el importador toma el código (país, tipo de identificación, tipo de vínculo y flujo).
        foreach (var fila in filas.Skip(inicio + 1).Where(f => f.Any(c => !string.IsNullOrWhiteSpace(c))))
        {
            var pais = PaisDe(Valor(fila, "pais"));
            resultado.Add(new FilaDeLoteEntrada(pais, TipoIdentificacionDe(Valor(fila, "tipoIdentificacion"), pais), Valor(fila, "numeroIdentificacion"),
                Valor(fila, "digitoVerificacion"), Valor(fila, "tipoPersona"), Valor(fila, "nombre"), Valor(fila, "nombreComercial"), Valor(fila, "correo"),
                CodigoDe(Valor(fila, "tipoVinculo")), CodigoDe(Valor(fila, "flujo")), Valor(fila, "contacto"), Valor(fila, "telefono"), Atributos(fila)));
        }

        if (resultado.Count == 0)
            throw ReglaDeNegocioException.Validacion("lote-sin-filas", "El archivo no tiene filas debajo del encabezado.");
        return resultado;
    }

    /// <summary>Prefijo del encabezado de una columna de atributo del vínculo: <c>Atributo: nivelRiesgo</c>.</summary>
    public const string PrefijoDeAtributo = "Atributo:";

    /// <summary>El encabezado de la columna de un atributo del vínculo (<c>Atributo: clave</c>).</summary>
    public static string EncabezadoDeAtributo(string clave) => $"{PrefijoDeAtributo} {clave}";

    [GeneratedRegex(@"^\s*atributo\s*:\s*(?<clave>.*?)[\s*]*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RegexAtributo();

    /// <summary>
    /// La clave de un encabezado <c>Atributo: clave</c> (sin importar mayúsculas del prefijo ni espacios; un asterisco al final, que algunas plantillas ponen a las obligatorias, no
    /// cuenta); <c>null</c> si el encabezado no es de un atributo. La clave conserva sus mayúsculas: la validación la compara con las del tipo de vínculo de cada fila.
    /// </summary>
    public static string? ClaveDeAtributo(string? encabezado)
    {
        if (string.IsNullOrWhiteSpace(encabezado))
            return null;
        var clave = RegexAtributo().Match(encabezado) is { Success: true } m ? m.Groups["clave"].Value.Trim() : string.Empty;
        return clave.Length == 0 ? null : clave;
    }

    /// <summary>Minúsculas, sin tildes y solo letras y dígitos («Número de identificación» → <c>numerodeidentificacion</c>).</summary>
    public static string Normalizar(string? texto)
    {
        var descompuesto = (texto ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var limpio = new StringBuilder();
        foreach (var c in descompuesto)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))
                limpio.Append(c);
        return limpio.ToString();
    }

    /// <summary>
    /// CSV en UTF-8 (con o sin BOM; si no es UTF-8 válido, Windows-1252 como lo guarda Excel en español), separado por <c>;</c>
    /// o <c>,</c> (el que más aparezca en el encabezado) y con comillas dobles (RFC 4180).
    /// </summary>
    public static IReadOnlyList<IReadOnlyList<string>> Csv(byte[] contenido)
    {
        string texto;
        try
        {
            texto = new UTF8Encoding(false, true).GetString(contenido);
        }
        catch (DecoderFallbackException)
        {
            texto = Encoding.Latin1.GetString(contenido);
        }

        texto = texto.TrimStart('﻿');
        var primeraLinea = texto.Split('\n', 2)[0];
        var separador = primeraLinea.Count(c => c == ';') >= primeraLinea.Count(c => c == ',') ? ';' : ',';

        var filas = new List<IReadOnlyList<string>>();
        var fila = new List<string>();
        var celda = new StringBuilder();
        var entreComillas = false;
        for (var i = 0; i < texto.Length; i++)
        {
            var c = texto[i];
            if (entreComillas)
            {
                if (c == '"' && i + 1 < texto.Length && texto[i + 1] == '"')
                {
                    celda.Append('"');
                    i++;
                }
                else if (c == '"')
                    entreComillas = false;
                else
                    celda.Append(c);
            }
            else if (c == '"')
                entreComillas = true;
            else if (c == separador)
            {
                fila.Add(celda.ToString());
                celda.Clear();
            }
            else if (c == '\n' || c == '\r')
            {
                if (c == '\r' && i + 1 < texto.Length && texto[i + 1] == '\n')
                    i++;
                fila.Add(celda.ToString());
                celda.Clear();
                filas.Add(fila);
                fila = [];
            }
            else
                celda.Append(c);
        }

        if (celda.Length > 0 || fila.Count > 0)
        {
            fila.Add(celda.ToString());
            filas.Add(fila);
        }

        return filas;
    }

    public static FilaDeLoteEntrada ADominio(this FilaDeLoteEntradaDto f)
    {
        var pais = PaisDe(Recortar(f.Pais));
        return new FilaDeLoteEntrada(pais, TipoIdentificacionDe(Recortar(f.TipoIdentificacion), pais), Recortar(f.NumeroIdentificacion), Recortar(f.DigitoVerificacion),
            Recortar(f.TipoPersona), Recortar(f.Nombre), Recortar(f.NombreComercial), Recortar(f.Correo), CodigoDe(Recortar(f.TipoVinculo)), CodigoDe(Recortar(f.Flujo)),
            Recortar(f.Contacto), Recortar(f.Telefono), f.Atributos is { Count: > 0 } ? new Dictionary<string, JsonElement>(f.Atributos) : null);
    }

    public static FilaDeLoteEntradaDto ADto(this FilaDeLoteEntrada f) =>
        new(f.Pais, f.TipoIdentificacion, f.NumeroIdentificacion, f.DigitoVerificacion, f.TipoPersona, f.Nombre, f.NombreComercial, f.Correo,
            f.TipoVinculo, f.Flujo, f.Contacto, f.Telefono, f.Atributos is { Count: > 0 } ? new Dictionary<string, JsonElement>(f.Atributos) : null);

    private static string? Recortar(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
}
