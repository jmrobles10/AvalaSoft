using Avalasoft.Contratos;
using Xunit.Abstractions;

namespace Avalasoft.Integracion.Tests;

[Collection(Colecciones.Api3)]
[Trait("Requiere", "Docker")]
public sealed class RequisitosVersionNuevaApiTests(ApiFixture fixture, ITestOutputHelper salida) : RequisitosApiBase(fixture, salida)
{
    // ---------- aviso de versión nueva en un expediente en revisión (NW-17) ----------

    [Fact]
    public async Task Una_version_nueva_en_una_revalidacion_abierta_avisa_a_las_areas_que_revisan_ese_documento()
    {
        var a = await ProveedorAprobadoAsync();
        var e = a.E;

        // La v2 del RUT abre la revalidación (avisa «Nuevo expediente en tu área», no «versión nueva»).
        await SubirAsync(a.Sesion, "RUT", Pdf("RUT v2"));
        var revalidacion = await ExpedienteAbiertoAsync(e, a.Vinculo.Id);
        revalidacion.ShouldNotBe(a.Expediente);
        await EsperarAsync(async () => (await CampanaAsync(e, e.Laura)).Any(n => n.ExpedienteId == revalidacion && n.Tipo == "expediente.nuevo_en_area"));
        (await CampanaAsync(e, e.Laura)).ShouldNotContain(n => n.Tipo == "expediente.version_nueva");

        // La v3 llega con la revalidación todavía en revisión: Compras y Cumplimiento (revisan el RUT) se enteran.
        await SubirAsync(a.Sesion, "RUT", Pdf("RUT v3"));
        foreach (var persona in new[] { e.Laura, e.Carlos })
        {
            await EsperarAsync(async () => (await CampanaAsync(e, persona)).Any(n => n.Tipo == "expediente.version_nueva"));
            var aviso = (await CampanaAsync(e, persona)).Single(n => n.Tipo == "expediente.version_nueva");
            aviso.ExpedienteId.ShouldBe(revalidacion);
            aviso.Titulo.ShouldBe("Versión nueva de un documento");
            aviso.Mensaje.ShouldContain("versión 3 de Registro Único Tributario (antes la 2)");
        }
    }
}
