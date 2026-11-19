using Validalo.Dominio.Flujos;

namespace Validalo.Dominio.Expedientes;

/// <summary>
/// Enrutamiento por sector de una <b>actualización</b> (el expediente que abre un cambio del tercero después de aprobado): cada sección cambiada va solo al área responsable de su
/// sector, según el flujo (<see cref="ResponsableDeSector"/>), y no a todas las áreas que revisan. Es el «responsable por sector» de las Actualizaciones del SRM; la revisión inicial no
/// cambia. Función pura: se aplica sobre los requisitos ya calculados, antes de abrir o ampliar el expediente.
/// </summary>
public static class ResponsablesDeActualizacion
{
    /// <summary>
    /// A cada requisito de sección cuyo sector tiene responsable en el flujo le deja como único revisor a esa área, aunque su requisito del flujo nombrara otras (el responsable de la
    /// actualización manda sobre quién revisó lo inicial). Lo demás queda igual: documentos, secciones de un sector sin responsable (conservan sus áreas o, si no tienen, todas) y
    /// un responsable cuya área ya no participa en las etapas del flujo con el que se abrió el expediente (nadie podría decidir: se conserva el comportamiento de siempre).
    /// </summary>
    public static IReadOnlyList<RequisitoCalculado> Enrutar(IReadOnlyList<RequisitoCalculado> requisitos, IReadOnlyList<ResponsableDeSector>? responsables,
        IReadOnlyCollection<Guid> areasDelFlujo)
    {
        if (responsables is null || responsables.Count == 0)
            return requisitos;

        return
        [
            .. requisitos.Select(r =>
                r is { TipoRequisito: TipoDeRequisito.Seccion, Seccion: { } sector } &&
                responsables.FirstOrDefault(x => string.Equals(x.Sector, sector, StringComparison.Ordinal)) is { } responsable &&
                areasDelFlujo.Contains(responsable.AreaId)
                    ? r with { AreasQueRevisan = [responsable.AreaId] }
                    : r)
        ];
    }
}
