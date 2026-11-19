using Marten;
using Validalo.Contratos;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Ficha;
using Validalo.Dominio.Flujos;

namespace Validalo.Aplicacion.Flujos;

/// <summary>
/// Lo que el flujo necesita de la plataforma para las condiciones sobre la ficha del tercero (EF-1): la lista de campos que puede mirar una condición, para el
/// editor, y la verificación de que cada código de catálogo que cita exista. La forma de la condición (campo, operador, formato del valor) la valida el
/// dominio al guardar; que el código exista en el catálogo es un dato de plataforma y se mira aquí.
/// </summary>
public static class CondicionesDeFicha
{
    /// <summary>Los campos de la ficha que una condición puede mirar, con su tipo, sus operadores y el catálogo de sus valores.</summary>
    public static IReadOnlyList<CampoDeFichaDto> Campos() =>
    [
        .. CamposDeFicha.Todos.Select(c => new CampoDeFichaDto(c.Ruta, c.NombreDeSeccion, c.Etiqueta, c.Tipo.ToString(),
            [.. AtributosDeExigencia.OperadoresDe(c).Select(o => o.ToString())], c.Catalogo is { } catalogo ? ReglasDeCatalogo.Ruta(catalogo) : null,
            c.Jerarquia != JerarquiaDeCampo.Ninguna))
    ];

    /// <summary>
    /// Cada código de catálogo que citan las condiciones de la versión sobre campos con <see cref="CampoDeFichaExigible.ValidaExistencia"/> (especialidades,
    /// ciudades, responsabilidades) debe existir y estar activo (422 <c>condicion-invalida</c>; en un requisito trae su posición en <c>requisito</c>): una
    /// especialidad mal escrita nunca se cumpliría y nadie lo notaría. Los CIIU solo se miran de formato: el catálogo no trae divisiones ni grupos.
    /// </summary>
    public static async Task ValidarCatalogosAsync(IQuerySession sesion, FlujoVersion version, CancellationToken ct)
    {
        var citas = new List<(int? Requisito, string Documento, CampoDeFichaExigible Campo, string Valor)>();
        for (var i = 0; i < version.Requisitos.Count; i++)
        {
            var requisito = version.Requisitos[i];
            citas.AddRange(Citas(requisito.Condicion, i, $"el requisito {requisito.CodigoTipo}"));
        }

        citas.AddRange(Citas(version.Seleccion?.Condicion, null, "la selección del flujo"));
        if (citas.Count == 0)
            return;

        var ids = citas.Select(c => EntradaDeCatalogo.IdPara(c.Campo.Catalogo!.Value, c.Valor)).Distinct().ToArray();
        var existentes = (await sesion.LoadManyAsync<EntradaDeCatalogo>(ct, ids)).Where(e => e.Activo).Select(e => e.Id).ToHashSet(StringComparer.Ordinal);
        var faltante = citas.FirstOrDefault(c => !existentes.Contains(EntradaDeCatalogo.IdPara(c.Campo.Catalogo!.Value, c.Valor)));
        if (faltante.Campo is null)
            return;

        throw new ReglaDeNegocioException(TipoFalla.Validacion, "condicion-invalida",
            $"La condición de {faltante.Documento} cita «{faltante.Valor}», que no existe (o está inactivo) en el catálogo de {faltante.Campo.Etiqueta.ToLowerInvariant()}.")
        {
            Datos = faltante.Requisito is { } indice ? new Dictionary<string, object?> { ["requisito"] = indice } : null
        };
    }

    private static IEnumerable<(int? Requisito, string Documento, CampoDeFichaExigible Campo, string Valor)> Citas(CondicionDeExigencia? condicion, int? requisito,
        string documento) =>
        AtributosDeExigencia.ComparacionesDeFicha(condicion)
            .Where(c => c.Campo is { ValidaExistencia: true, Catalogo: not null })
            .SelectMany(c => c.Valores.Select(v => (requisito, documento, c.Campo, v)));
}
