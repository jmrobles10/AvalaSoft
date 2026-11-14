using System.Globalization;
using System.Text.Json.Serialization;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Ficha;

namespace Validasoft.Dominio.FuentesOficiales;

/// <summary>
/// Fuentes oficiales con las que se corrobora el tercero (FO-1): el registro mercantil (RUES, Confecámaras) y el estado del RUT
/// (DIAN). Cada una es una <see cref="TipoVerificacion"/> del expediente (<c>Rues</c>, <c>Dian</c>): el flujo decide por tipo de
/// vínculo si pide una y si bloquea o solo informa, igual que las listas restrictivas.
/// </summary>
public static class CatalogoDeFuentes
{
    public static readonly IReadOnlyList<TipoVerificacion> Todas = [TipoVerificacion.Rues, TipoVerificacion.Dian];

    public static bool EsFuente(TipoVerificacion tipo) => tipo is TipoVerificacion.Rues or TipoVerificacion.Dian;

    /// <summary>Nombre para las pantallas, los PDF y los mensajes: «RUES» o «DIAN».</summary>
    public static string Nombre(TipoVerificacion tipo) => tipo switch
    {
        TipoVerificacion.Rues => "RUES",
        TipoVerificacion.Dian => "DIAN",
        _ => tipo.ToString()
    };

    /// <summary>Qué cubre cada fuente, en una frase (pantallas y documentación).</summary>
    public static string Descripcion(TipoVerificacion tipo) => tipo switch
    {
        TipoVerificacion.Rues => "Registro mercantil: razón social, estado y renovación de la matrícula y representante legal.",
        TipoVerificacion.Dian => "Estado del RUT: razón social, estado, responsabilidades y dirección.",
        _ => string.Empty
    };

    /// <summary>La fuente por su nombre (<c>Rues</c>, <c>Dian</c>, sin importar mayúsculas) o nulo.</summary>
    public static TipoVerificacion? Normalizar(string? nombre) =>
        Todas.Cast<TipoVerificacion?>().FirstOrDefault(t => string.Equals(t.ToString(), nombre?.Trim(), StringComparison.OrdinalIgnoreCase));
}

/// <summary>
/// Proveedores de cada fuente (FO-2). <see cref="DatosAbiertos"/>: el conjunto de datos abiertos de Confecámaras en datos.gov.co (RUES; gratis,
/// sin contrato, actualización mensual). <see cref="Contrato"/>: la API contratada con un proveedor autorizado (la de RUES con Confecámaras o un
/// agregador; para la DIAN es la única vía, que no tiene API pública del estado del RUT). <see cref="Simulado"/>: determinista, para sandbox y pruebas.
/// </summary>
public static class ProveedoresDeFuentes
{
    public const string DatosAbiertos = "DatosAbiertos";
    public const string Contrato = "Contrato";
    public const string Simulado = "Simulado";

    /// <summary>Los proveedores que existen para la fuente, el principal primero.</summary>
    public static IReadOnlyList<string> Para(TipoVerificacion fuente) =>
        fuente == TipoVerificacion.Rues ? [DatosAbiertos, Contrato, Simulado] : [Contrato, Simulado];

    public static IReadOnlyList<string> RealesPara(TipoVerificacion fuente) => [.. Para(fuente).Where(p => p != Simulado)];

    /// <summary>Nombre canónico del proveedor de la fuente (sin importar mayúsculas) o nulo.</summary>
    public static string? Normalizar(TipoVerificacion fuente, string? nombre) =>
        string.IsNullOrWhiteSpace(nombre) ? null : Para(fuente).FirstOrDefault(p => string.Equals(p, nombre.Trim(), StringComparison.OrdinalIgnoreCase));

    /// <summary>Clave de las credenciales y las opciones de un proveedor de una fuente: <c>Rues:DatosAbiertos</c>.</summary>
    public static string Clave(TipoVerificacion fuente, string proveedor) => $"{fuente}:{proveedor}";
}

/// <summary>Cómo está lo que se corrobora según la fuente: vigente (matrícula activa, RUT activo) o no.</summary>
public enum EstadoOficial
{
    Desconocido,
    Vigente,
    NoVigente
}

public static class EstadosOficiales
{
    /// <summary>
    /// «ACTIVA», «REGISTRO ACTIVO» ⇒ vigente; «CANCELADA», «SUSPENDIDO», «EN LIQUIDACIÓN», «INACTIVA»… ⇒ no vigente; lo que no se entiende queda
    /// «desconocido» (no se afirma nada: lo ve una persona).
    /// </summary>
    public static EstadoOficial Normalizar(string? texto)
    {
        var estado = Normalizacion.Texto(texto);
        if (estado.Length == 0)
            return EstadoOficial.Desconocido;
        if (new[] { "CANCEL", "SUSPEN", "LIQUID", "INACTIV", "DISUELT", "CLAUSUR", "BLOQUE", "NO ACTIV", "NO VIGENT", "EXTINT" }.Any(estado.Contains))
            return EstadoOficial.NoVigente;
        return estado.Contains("ACTIV", StringComparison.Ordinal) || estado.Contains("VIGENT", StringComparison.Ordinal) || estado.Contains("RENOVAD", StringComparison.Ordinal)
            ? EstadoOficial.Vigente
            : EstadoOficial.Desconocido;
    }
}

/// <summary>Representante legal tal como lo reporta la fuente.</summary>
public sealed record RepresentanteOficial(string? Nombre, string? Identificacion, string? Cargo);

/// <summary>
/// Lo que dice la fuente del tercero, normalizado (FO-3): lo que cada fuente no da queda nulo. Es evidencia pública del registro: no incluye
/// teléfonos ni correos de personas. <see cref="Encontrado"/> falso = la fuente no tiene al tercero.
/// </summary>
public sealed record DatosOficiales
{
    public bool Encontrado { get; init; }

    public string? Nit { get; init; }

    public string? Dv { get; init; }

    public string? RazonSocial { get; init; }

    /// <summary>El estado como lo escribe la fuente («ACTIVA», «CANCELADA», «REGISTRO ACTIVO»…).</summary>
    public string? Estado { get; init; }

    public EstadoOficial EstadoNormalizado { get; init; }

    // Registro mercantil (RUES)
    public string? Matricula { get; init; }

    public string? Camara { get; init; }

    public string? TipoOrganizacion { get; init; }

    public int? UltimoAnoRenovado { get; init; }

    public DateOnly? FechaMatricula { get; init; }

    public DateOnly? FechaRenovacion { get; init; }

    public DateOnly? FechaCancelacion { get; init; }

    public IReadOnlyList<RepresentanteOficial> Representantes { get; init; } = [];

    // RUT (DIAN) y comunes
    public string? Direccion { get; init; }

    /// <summary>Municipio: el código DANE de 5 dígitos si la fuente lo da; si no, el nombre.</summary>
    public string? Municipio { get; init; }

    public string? ActividadPrincipal { get; init; }

    public IReadOnlyList<string> Responsabilidades { get; init; } = [];

    /// <summary>Cuándo actualizó la fuente su dato (los datos abiertos del RUES se sincronizan cada mes).</summary>
    public DateOnly? ActualizadoEnLaFuente { get; init; }

    public static DatosOficiales NoEncontrado { get; } = new() { Encontrado = false };
}

/// <summary>Contra qué se coteja un campo de la fuente: la propia fuente (su estado), la ficha maestra o un documento analizado por IA.</summary>
public enum ContraQue
{
    Fuente,
    Ficha,
    Documento
}

/// <summary>
/// Un campo cotejado de una consulta (FO-4): lo que dice la fuente frente a la ficha maestra o frente a lo que la IA extrajo de un
/// documento. <see cref="Heredada"/>: la misma diferencia ya se aceptó (descartada) y la decisión sigue vigente. Es lo que viaja en el evento.
/// </summary>
public sealed record CampoCotejado(
    Guid Id, string Campo, string Etiqueta, ContraQue Contra, string? Referencia, string? Oficial, string? Comparado, ResultadoDeCruce Resultado,
    bool Critico, string? Detalle = null, ResolucionDeCoincidencia? Heredada = null);

/// <summary>Un campo cotejado con su decisión (si ya la hay): lo que el expediente y el monitoreo guardan de la última consulta.</summary>
public sealed class CampoDeFuente
{
    public Guid Id { get; set; }

    /// <summary>Ruta del campo (<c>razon_social</c>, <c>estado_matricula</c>, <c>personas[0]</c>).</summary>
    public string Campo { get; set; } = string.Empty;

    public string Etiqueta { get; set; } = string.Empty;

    public ContraQue Contra { get; set; }

    /// <summary>Con qué se cotejó: «FICHA_GENERAL», «CAMARA_COMERCIO v2»…</summary>
    public string? Referencia { get; set; }

    public string? Oficial { get; set; }

    public string? Comparado { get; set; }

    public ResultadoDeCruce Resultado { get; set; }

    public bool Critico { get; set; }

    public string? Detalle { get; set; }

    public ResolucionDeCoincidencia? Resolucion { get; set; }

    public bool Heredada { get; set; }

    [JsonIgnore]
    public bool Resuelta => Resolucion is not null;

    /// <summary>Una diferencia espera la decisión de un revisor: discrepa y nadie la ha resuelto.</summary>
    [JsonIgnore]
    public bool PorRevisar => Resultado == ResultadoDeCruce.Discrepa && !Resuelta;

    /// <summary>Misma diferencia en otra consulta: mismo campo, contra lo mismo, con los mismos valores.</summary>
    public bool EsLaMisma(CampoCotejado otro) =>
        Resultado == ResultadoDeCruce.Discrepa && otro.Resultado == ResultadoDeCruce.Discrepa && Campo == otro.Campo && Contra == otro.Contra &&
        Referencia?.Split(' ')[0] == otro.Referencia?.Split(' ')[0] && Mismo(Oficial, otro.Oficial) && Mismo(Comparado, otro.Comparado);

    /// <summary>El campo como se cotejó (sin la decisión), para compararlo con el de otra consulta.</summary>
    public CampoCotejado ACotejado() => new(Id, Campo, Etiqueta, Contra, Referencia, Oficial, Comparado, Resultado, Critico, Detalle);

    private static bool Mismo(string? a, string? b) => Normalizacion.Texto(a) == Normalizacion.Texto(b);
}

/// <summary>Lo último que dijo la fuente y su cotejo (snapshot en la verificación del expediente y del monitoreo).</summary>
public sealed class ResultadoDeFuenteOficial
{
    public DatosOficiales Datos { get; set; } = DatosOficiales.NoEncontrado;

    public List<CampoDeFuente> Campos { get; set; } = [];

    /// <summary>Las diferencias: lo que discrepa, con o sin decisión.</summary>
    [JsonIgnore]
    public IEnumerable<CampoDeFuente> Diferencias => Campos.Where(c => c.Resultado == ResultadoDeCruce.Discrepa);

    [JsonIgnore]
    public bool TieneDiferenciasPorRevisar => Campos.Any(c => c.PorRevisar);
}

/// <summary>Reglas del cotejo compartidas por el expediente y el monitoreo del vínculo (FO-4).</summary>
public static class ReglasDeFuente
{
    /// <summary>Meses que vale aceptar una diferencia (como las coincidencias de listas, docs/03 §6.3).</summary>
    public const int MesesVigenciaDeDecision = Expediente.MesesVigenciaDecisionCoincidencia;

    /// <summary>
    /// Da id a cada campo cotejado y hereda la decisión de una diferencia igual ya <b>descartada</b> cuya decisión sigue vigente. Una confirmada
    /// nunca se hereda: vuelve a pedirse (nunca se aprueba sola). Lo que coincide o no se puede verificar no necesita decisión.
    /// </summary>
    public static List<CampoCotejado> Heredar(IReadOnlyList<CampoCotejado> nuevos, IReadOnlyList<CampoDeFuente> previos, DateTimeOffset ahora) =>
    [
        .. nuevos.Select(c =>
        {
            var heredada = c.Resultado == ResultadoDeCruce.Discrepa
                ? previos.FirstOrDefault(p => p.EsLaMisma(c) && p.Resolucion is { Decision: DecisionCoincidencia.Descartada } r && r.VigenteHasta > ahora)
                : null;
            return c with { Id = Guid.CreateVersion7(), Heredada = heredada?.Resolucion };
        })
    ];

    public static CampoDeFuente Detalle(CampoCotejado c) => new()
    {
        Id = c.Id,
        Campo = c.Campo,
        Etiqueta = c.Etiqueta,
        Contra = c.Contra,
        Referencia = c.Referencia,
        Oficial = c.Oficial,
        Comparado = c.Comparado,
        Resultado = c.Resultado,
        Critico = c.Critico,
        Detalle = c.Detalle,
        Resolucion = c.Heredada,
        Heredada = c.Heredada is not null
    };

    /// <summary>Una confirmada ⇒ <c>Fallida</c>; alguna diferencia sin decidir ⇒ <c>CoincidenciaPorAnalizar</c> (diferencias por revisar); si no ⇒ <c>Satisfecha</c>.</summary>
    public static EstadoVerificacion Estado(IReadOnlyList<CampoDeFuente> campos) =>
        campos.Any(c => c.Resolucion is { Decision: DecisionCoincidencia.Confirmada }) ? EstadoVerificacion.Fallida
        : campos.Any(c => c.PorRevisar) ? EstadoVerificacion.CoincidenciaPorAnalizar
        : EstadoVerificacion.Satisfecha;

    public static ResultadoVerificacion Resultado(IReadOnlyList<CampoDeFuente> campos) =>
        campos.Any(c => c.Resultado == ResultadoDeCruce.Discrepa) ? ResultadoVerificacion.ConDiferencias : ResultadoVerificacion.Conforme;

    /// <summary>El último año de renovación que debe tener la matrícula hoy: se renueva hasta el 31 de marzo (en enero a marzo aún vale el año anterior).</summary>
    public static int AnoDeRenovacionEsperado(DateOnly hoy) => hoy.Month >= 4 ? hoy.Year : hoy.Year - 1;

    public static string Fecha(DateOnly fecha) => fecha.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
}

/// <summary>Resultado de una consulta a una fuente, listo para registrarse (sin ids de campo todavía).</summary>
public sealed record ConsultaOficialRealizada(
    string Proveedor, string ReferenciaExterna, DatosOficiales Datos, IReadOnlyList<CampoCotejado> Campos, EvidenciaDeVerificacion? Evidencia,
    DateTimeOffset VigenteHasta);
