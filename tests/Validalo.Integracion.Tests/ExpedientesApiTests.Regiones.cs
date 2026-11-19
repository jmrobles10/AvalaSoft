using Validalo.Contratos;

namespace Validalo.Integracion.Tests;

/// <summary>
/// RUES y DIAN solo cubren Colombia (RG-6): a un tercero con identificación de otro país el flujo no se las pide (una bloqueante que nadie puede
/// satisfacer lo dejaría para siempre sin aprobar), y las listas restrictivas y el estudio de cumplimiento siguen aplicando a todos.
/// </summary>
public sealed partial class ExpedientesApiTests
{
    private Task<VinculoDto> CrearVinculoDeAsync(Escenario e, string tipo, IdentificacionDto identificacion, string nombre)
    {
        var correo = CorreoNuevo();
        return ApiAsync<VinculoDto>("POST", "/api/v1/vinculos", Admin(e), new CrearVinculoDto(
            TerceroId: null,
            Tercero: new CrearTerceroDto(identificacion, "Juridica", nombre, null, [new ContactoDto("Ana Pérez", correo, null, "Comercial")]),
            TipoVinculo: tipo,
            Atributos: null,
            CorreoInvitacion: correo,
            ReferenciaExterna: null), 201);
    }

    [Fact]
    public async Task A_un_tercero_dominicano_o_panameno_no_se_le_piden_el_RUES_ni_la_DIAN_pero_si_el_estudio_y_a_uno_colombiano_todo()
    {
        var e = await PrepararAsync();
        await CrearFlujoConVerificacionesAsync(e, "CLIENTE", RuesRequerida, DianInformativa, EstudioRequerido);

        foreach (var identificacion in new[] { new IdentificacionDto("DO", "RNC", "101850043"), new IdentificacionDto("PA", "RUC", "155612345-2-2019", "56") })
        {
            var vinculo = await CrearVinculoDeAsync(e, "CLIENTE", identificacion, "Extranjera " + identificacion.Pais);
            var abierto = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/expedientes", Admin(e), new AbrirExpedienteDto(), 201);
            abierto.Verificaciones!.Select(v => (v.Tipo, v.Bloqueante)).ShouldBe([("EstudioDeCumplimiento", true)], identificacion.Pais);
        }

        var colombiano = await CrearVinculoConNombreAsync(e, "CLIENTE", "Colombiana Oficial S.A.S.");
        var deColombia = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/vinculos/{colombiano.Id}/expedientes", Admin(e), new AbrirExpedienteDto(), 201);
        deColombia.Verificaciones!.Select(v => v.Tipo).ShouldBe(["Rues", "Dian", "EstudioDeCumplimiento"], ignoreOrder: true);
    }
}
