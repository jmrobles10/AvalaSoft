using Validalo.Contratos;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Lo que hace la empresa para cerrar o corregir un expediente y su vínculo (PC-1, conversión de la e2e <c>ciclo-vinculo</c>): anular el
/// veredicto de un área (el cierre manual de una observación), anular el expediente y abrir otro, anular el vínculo y desvincular con un
/// expediente abierto. Flujo de una etapa con el aprobador inicial y Cumplimiento en paralelo, sin documentos.
/// </summary>
public sealed partial class ExpedientesApiTests
{
    /// <summary>Vínculo en validación con el expediente abierto a mano por un administrador.</summary>
    private async Task<(VinculoDto Vinculo, ExpedienteDto Expediente)> VinculoConExpedienteAbiertoAsync(Escenario e)
    {
        await CrearFlujoAsync(e, "CLIENTE", [new EtapaDto(1, [new AreaDeEtapaDto(e.Aprobador.Id), new AreaDeEtapaDto(e.Cumplimiento.Id)])]);
        var vinculo = await CrearVinculoAsync(e, "CLIENTE", CorreoNuevo());
        var expediente = await AbrirManualAsync(e, vinculo);
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("EnValidacion");
        return (vinculo, expediente);
    }

    [Fact]
    public async Task Anular_el_veredicto_de_cumplimiento_levanta_la_devolucion_al_tercero_sin_esperar_su_respuesta()
    {
        var e = await PrepararAsync();
        var (vinculo, expediente) = await VinculoConExpedienteAbiertoAsync(e);
        var url = $"/api/v1/expedientes/{expediente.Id}/areas/{e.Cumplimiento.Id}";

        // Cumplimiento observa: el expediente se devuelve al tercero y nadie más decide.
        var observado = await ApiAsync<ExpedienteDto>("POST", $"{url}/veredicto", Delegado(e, e.Carlos),
            new VeredictoDto("Observado", ["incompleto"], "Falta el certificado de existencia."), 200);
        observado.Estado.ShouldBe("Observado");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/expedientes/{expediente.Id}/areas/{e.Aprobador.Id}/veredicto", Delegado(e, e.Laura),
            new VeredictoDto("Aprobado"), 409))).ShouldBe("expediente-observado");

        // Solo un administrador anula el veredicto, y con justificación.
        await ApiAsync("POST", $"{url}/anular-veredicto", Delegado(e, e.Carlos), new AnularVeredictoDto("Ya lo entregó."), 403);
        (await CodigoAsync(await ApiAsync("POST", $"{url}/anular-veredicto", Admin(e), new AnularVeredictoDto(" "), 422))).ShouldBe("justificacion-requerida");

        // La administradora lo anula (el tercero ya lo resolvió por otro canal): la revisión sigue sin esperar un reenvío.
        var reanudado = await ApiAsync<ExpedienteDto>("POST", $"{url}/anular-veredicto", Admin(e),
            new AnularVeredictoDto("El tercero ya entregó el certificado por correo."), 200);
        reanudado.Estado.ShouldBe("EnRevision");
        var area = reanudado.Etapas.Single().Areas.Single(a => a.AreaId == e.Cumplimiento.Id);
        area.Estado.ShouldBe("Pendiente");
        var anulado = area.Veredictos.ShouldHaveSingleItem();
        anulado.Anulado.ShouldBeTrue();
        anulado.Vigente.ShouldBeFalse();
        anulado.AnuladoPor.ShouldNotBeNull();

        // Con la devolución levantada las dos áreas pueden decidir de nuevo y el vínculo queda activo.
        await AprobarAreaAsync(e, expediente.Id, e.Aprobador, e.Laura);
        (await AprobarAreaAsync(e, expediente.Id, e.Cumplimiento, e.Carlos)).Estado.ShouldBe("Aprobado");
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("Activo");

        var historial = (await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/expedientes/{expediente.Id}/historial", Admin(e), null, 200)).Select(h => h.Tipo).ToList();
        historial.ShouldContain("veredicto_anulado_por_administrador");
        historial.ShouldContain("revision_reanudada");
    }

    [Fact]
    public async Task Anular_el_expediente_devuelve_el_vinculo_a_invitado_y_la_empresa_abre_otro_sin_esperar_al_tercero()
    {
        var e = await PrepararAsync();
        var (vinculo, expediente) = await VinculoConExpedienteAbiertoAsync(e);
        var url = $"/api/v1/expedientes/{expediente.Id}/anular";

        // Solo un administrador anula, y con motivo.
        await ApiAsync("POST", url, Delegado(e, e.Laura), new MotivoDto("Equivocado."), 403);
        (await CodigoAsync(await ApiAsync("POST", url, Admin(e), new MotivoDto(" "), 422))).ShouldBe("motivo-requerido");

        var anulado = await ApiAsync<ExpedienteDto>("POST", url, Admin(e), new MotivoDto("Se abrió con el tipo de vínculo equivocado."), 200);
        anulado.Estado.ShouldBe("Anulado");
        anulado.MotivoAnulacion.ShouldBe("Se abrió con el tipo de vínculo equivocado.");
        var invitado = await VinculoAsync(e, vinculo.Id);
        invitado.Estado.ShouldBe("Invitado");
        invitado.ExpedienteAbiertoId.ShouldBeNull();
        (await BandejaDePersonaAsync(e, e.Laura)).ShouldBeEmpty();

        // Desde el vínculo, la empresa abre un expediente nuevo.
        var nuevo = await AbrirManualAsync(e, vinculo);
        nuevo.Id.ShouldNotBe(expediente.Id);
        nuevo.Estado.ShouldBe("EnRevision");
        var enValidacion = await VinculoAsync(e, vinculo.Id);
        enValidacion.Estado.ShouldBe("EnValidacion");
        enValidacion.ExpedienteAbiertoId.ShouldBe(nuevo.Id);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expediente.Id}", Admin(e), null, 200)).Estado.ShouldBe("Anulado");
    }

    [Fact]
    public async Task Anular_el_vinculo_es_definitivo_y_anula_su_expediente_abierto()
    {
        var e = await PrepararAsync();
        var (vinculo, expediente) = await VinculoConExpedienteAbiertoAsync(e);
        var url = $"/api/v1/vinculos/{vinculo.Id}";

        (await CodigoAsync(await ApiAsync("POST", $"{url}/anular", Admin(e), new MotivoDto(" "), 422))).ShouldBe("motivo-requerido");
        var anulado = await ApiAsync<VinculoDto>("POST", $"{url}/anular", Admin(e), new MotivoDto("Se creó por error."), 200);
        anulado.Estado.ShouldBe("Anulado");
        anulado.ExpedienteAbiertoId.ShouldBeNull();
        var cerrado = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expediente.Id}", Admin(e), null, 200);
        cerrado.Estado.ShouldBe("Anulado");
        cerrado.MotivoAnulacion.ShouldNotBeNull().ShouldContain("Se creó por error.");
        (await BandejaDePersonaAsync(e, e.Laura)).ShouldBeEmpty();

        // Terminal: ni se anula otra vez, ni se desvincula, ni se reintegra, ni se abre un expediente.
        (await CodigoAsync(await ApiAsync("POST", $"{url}/anular", Admin(e), new MotivoDto("Otra vez."), 409))).ShouldBe("estado-terminal");
        (await CodigoAsync(await ApiAsync("POST", $"{url}/desvincular", Admin(e), new MotivoDto("Fin."), 409))).ShouldBe("estado-terminal");
        (await CodigoAsync(await ApiAsync("POST", $"{url}/reintegrar", Admin(e), new ReintegrarVinculoDto("Retoma."), 409))).ShouldBe("estado-invalido");
        (await CodigoAsync(await ApiAsync("POST", $"{url}/expedientes", Admin(e), new AbrirExpedienteDto(), 409))).ShouldBe("estado-terminal");
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("Anulado");
    }

    [Fact]
    public async Task Desvincular_con_el_expediente_abierto_lo_anula_y_el_tercero_se_puede_reintegrar()
    {
        var e = await PrepararAsync();
        var (vinculo, expediente) = await VinculoConExpedienteAbiertoAsync(e);
        var url = $"/api/v1/vinculos/{vinculo.Id}";

        (await CodigoAsync(await ApiAsync("POST", $"{url}/desvincular", Admin(e), new MotivoDto(" "), 422))).ShouldBe("motivo-requerido");
        var desvinculado = await ApiAsync<VinculoDto>("POST", $"{url}/desvincular", Admin(e), new MotivoDto("Terminó la relación comercial."), 200);
        desvinculado.Estado.ShouldBe("Desvinculado");
        desvinculado.ExpedienteAbiertoId.ShouldBeNull();
        var cerrado = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expediente.Id}", Admin(e), null, 200);
        cerrado.Estado.ShouldBe("Anulado");
        cerrado.MotivoAnulacion.ShouldNotBeNull().ShouldContain("Terminó la relación comercial.");
        (await BandejaDePersonaAsync(e, e.Carlos)).ShouldBeEmpty();

        // Se puede reintegrar: como nunca fue aprobado, vuelve a Invitado para validarse de nuevo (no hay nada que restituir sin revalidar).
        var viabilidad = await ApiAsync<ViabilidadDeReintegroDto>("GET", $"{url}/reintegro", Admin(e), null, 200);
        viabilidad.PuedeSinRevalidar.ShouldBeFalse();
        (await ApiAsync<VinculoDto>("POST", $"{url}/reintegrar", Admin(e), new ReintegrarVinculoDto("Retoma la relación."), 200)).Estado.ShouldBe("Invitado");
    }
}
