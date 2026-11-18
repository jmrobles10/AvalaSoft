using Avalasoft.Contratos;

namespace Avalasoft.Integracion.Tests;

/// <summary>
/// Desaprobar un expediente aprobado eligiendo desde qué etapa se revisa de nuevo (DS-2): la elección llega por la API y la etapa elegida
/// manda sobre la «última, la que lo cerró» que se toma por omisión.
/// </summary>
public sealed partial class ExpedientesApiTests
{
    [Fact]
    public async Task Desaprobar_un_expediente_aprobado_desde_la_primera_etapa_repite_todo_el_flujo_y_el_vinculo_pasa_a_en_validacion()
    {
        var e = await PrepararAsync();
        var (vinculo, aprobado) = await AprobadoEnDosEtapasAsync(e);

        var desaprobado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{aprobado.Id}/desaprobar", Admin(e),
            new DesaprobarExpedienteDto("Cambió la política de contratación.", 1), 200);

        // Desde la primera etapa: la 1 vuelve a revisarse, la 2 espera y los veredictos de las dos quedan revertidos.
        desaprobado.Estado.ShouldBe("EnRevision");
        desaprobado.EtapaActual.ShouldBe(1);
        desaprobado.Etapas.Select(x => x.Estado).ShouldBe(["Activa", "Esperando"]);
        desaprobado.Desaprobaciones.ShouldBe(1);
        var ultima = desaprobado.UltimaDesaprobacion.ShouldNotBeNull();
        ultima.Alcance.ShouldBe("ExpedienteAprobado"); // era una desaprobación, aunque la etapa elegida sea la primera
        ultima.Etapa.ShouldBe(1);
        ultima.Justificacion.ShouldBe("Cambió la política de contratación.");
        desaprobado.Etapas.SelectMany(x => x.Areas).SelectMany(a => a.Veredictos).ShouldAllBe(v => !v.Vigente && v.Revertido);

        // Igual que al desaprobar desde la última etapa: el vínculo vuelve a validación con este expediente y el certificado se revoca.
        var enValidacion = await VinculoAsync(e, vinculo.Id);
        enValidacion.Estado.ShouldBe("EnValidacion");
        enValidacion.ExpedienteAbiertoId.ShouldBe(aprobado.Id);
        (await CertificadoAsync(e, vinculo.Id)).Actual!.Estado.ShouldBe("Revocado");

        // La bandeja de Cumplimiento ya no lo muestra (su etapa espera) y la del aprobador inicial sí.
        (await ApiAsync<PaginaDto<FilaBandejaDto>>("GET", "/api/v1/bandeja", Delegado(e, e.Carlos), null, 200)).Datos.ShouldBeEmpty();
        (await ApiAsync<PaginaDto<FilaBandejaDto>>("GET", "/api/v1/bandeja", Delegado(e, e.Laura), null, 200)).Datos.ShouldHaveSingleItem().EstadoArea.ShouldBe("Pendiente");
    }
}
