using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.Identidad;

namespace Validasoft.Aplicacion.Comun;

/// <summary>
/// El alcance por sector de los grupos de acceso en los endpoints de la empresa: ver una sección de la ficha (<see cref="PuedeVer"/>) y actuar sobre ella (<see cref="ExigirEditar"/>:
/// veredicto, observación, aprobación de área o exención). Un permiso sin acotar (API key sin usuario, roles fijos, grupos sin sectores) alcanza todas las secciones, así que nada
/// cambia para quien no usa grupos acotados. Lo que no es una sección (un documento) nunca se acota por sector.
/// </summary>
public static class AlcancePorSector
{
    /// <summary>¿El permiso deja ver esa sección? Siempre para lo que no es una sección.</summary>
    public static bool PuedeVer(this IContextoSolicitud contexto, string permiso, string? seccion) =>
        seccion is null || contexto.Sectores(permiso, NivelDeSector.Ver).Permite(seccion);

    /// <summary>403 <c>sector-no-permitido</c> si el permiso no deja actuar sobre esa sección (el grupo solo la ve o no la alcanza).</summary>
    public static void ExigirEditar(this IContextoSolicitud contexto, string permiso, string? seccion)
    {
        if (seccion is null || contexto.Sectores(permiso, NivelDeSector.Editar).Permite(seccion))
            return;

        var nombre = CatalogoDeSecciones.Buscar(seccion)?.Nombre ?? seccion;
        throw new ReglaDeNegocioException(TipoFalla.Prohibido, "sector-no-permitido",
            $"Tus grupos de acceso no te dejan actuar sobre «{nombre}»: pide que te agreguen ese sector con el nivel «Editar».")
        {
            Datos = new Dictionary<string, object?> { ["sector"] = seccion, ["permiso"] = permiso }
        };
    }

    /// <summary>Lo mismo para cada sección que quedaría decidida de una vez (aprobar el área entera, aprobar como administrador).</summary>
    public static void ExigirEditar(this IContextoSolicitud contexto, string permiso, IEnumerable<RequisitoDeExpediente> requisitos)
    {
        foreach (var requisito in requisitos.Where(r => r.EsSeccion))
            contexto.ExigirEditar(permiso, requisito.Seccion);
    }
}
