using Validalo.Contratos;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Decisiones de las áreas sobre un expediente de un flujo sin documentos (PC-1, conversión de las e2e <c>decisiones</c> y <c>secuencia</c>):
/// el rechazo con el expediente devuelto al tercero, la bandeja de cada área cuando le toca su etapa y la separación de funciones con su
/// mensaje.
/// </summary>
public sealed partial class ExpedientesApiTests
{
    private async Task<List<FilaBandejaDto>> BandejaDePersonaAsync(Escenario e, Persona persona) =>
        [.. (await ApiAsync<PaginaDto<FilaBandejaDto>>("GET", "/api/v1/bandeja", Delegado(e, persona), null, 200)).Datos];

    private async Task<string?> DetalleAsync(Alba.IScenarioResult resultado) =>
        (await resultado.ReadAsJsonAsync<System.Text.Json.JsonElement>()).GetProperty("detail").GetString();

    // ---------- rechazo con el expediente devuelto ----------

    [Fact]
    public async Task Cumplimiento_rechaza_con_el_expediente_devuelto_al_tercero_y_este_ya_no_puede_reenviar()
    {
        var e = await PrepararAsync();
        await CrearFlujoAsync(e, "CLIENTE",
            [new EtapaDto(1, [new AreaDeEtapaDto(e.Aprobador.Id), new AreaDeEtapaDto(e.Cumplimiento.Id, PuedeRechazarExpediente: true)])]);
        await PublicarTextosAsync(e);
        var correoTercero = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e, "CLIENTE", correoTercero);
        var sesion = await AceptarInvitacionAsync(vinculo, correoTercero);
        var expedienteId = (await VinculoAsync(e, vinculo.Id)).ExpedienteAbiertoId.ShouldNotBeNull();

        // El aprobador inicial observa: el expediente vuelve al tercero y esa persona del otro área ya no puede aprobar.
        var observado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/areas/{e.Aprobador.Id}/veredicto",
            Delegado(e, e.Laura), new VeredictoDto("Observado", ["incompleto"], "Los datos no coinciden."), 200);
        observado.Estado.ShouldBe("Observado");
        var frenado = await ApiAsync("POST", $"/api/v1/expedientes/{expedienteId}/areas/{e.Cumplimiento.Id}/veredicto", Delegado(e, e.Carlos),
            new VeredictoDto("Aprobado"), 409);
        (await CodigoAsync(frenado)).ShouldBe("expediente-observado");

        // Devuelto: nadie aprueba, pero un hallazgo grave sí se puede rechazar (FL-14), y solo el área que puede rechazar.
        var noPuede = await ApiAsync("POST", $"/api/v1/expedientes/{expedienteId}/rechazar", Delegado(e, e.Laura),
            new RechazarExpedienteDto(e.Aprobador.Id, ["no-corresponde-al-tercero"], "No es el proveedor."), 403);
        (await CodigoAsync(noPuede)).ShouldBe("area-no-puede-rechazar");
        var rechazado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/rechazar", Delegado(e, e.Carlos),
            new RechazarExpedienteDto(e.Cumplimiento.Id, ["no-corresponde-al-tercero"], "La razón social no coincide con la del RUT."), 200);
        rechazado.Estado.ShouldBe("Rechazado");
        rechazado.Rechazo!.Justificacion.ShouldBe("La razón social no coincide con la del RUT.");
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("Invitado");

        // El tercero lo ve cerrado: sin observaciones que responder ni nada que reenviar.
        var vista = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200);
        vista.Estado.ShouldBe("Rechazado");
        vista.PuedeReenviar.ShouldBeFalse();
        var reenvio = await TerceroAsync("POST", $"/public/v1/expedientes/{expedienteId}/reenviar", sesion.AccessToken, new ReenviarExpedienteDto("Corregido."), 409);
        (await CodigoAsync(reenvio)).ShouldBe("estado-invalido");
    }

    // ---------- etapas en secuencia ----------

    [Fact]
    public async Task En_varias_etapas_cada_area_ve_el_expediente_en_su_bandeja_solo_cuando_le_toca()
    {
        var e = await PrepararAsync();
        // Legal y Cumplimiento comparten una persona (Carlos): solo debe ver el área cuya etapa está en curso.
        var legal = await ApiAsync<AreaDto>("POST", "/api/v1/areas", Admin(e), new CrearAreaDto("LEGAL", "Legal"), 201);
        await ApiAsync<AreaDto>("PUT", $"/api/v1/areas/{legal.Id}/miembros", Admin(e), new MiembrosAreaDto([e.Carlos.Usuario.Id]), 200);
        await CrearFlujoAsync(e, "CLIENTE",
        [
            new EtapaDto(1, [new AreaDeEtapaDto(e.Aprobador.Id)]),
            new EtapaDto(2, [new AreaDeEtapaDto(legal.Id)]),
            new EtapaDto(3, [new AreaDeEtapaDto(e.Cumplimiento.Id, PuedeRechazarExpediente: true)])
        ]);
        var vinculo = await CrearVinculoAsync(e, "CLIENTE", CorreoNuevo());
        var expediente = await AbrirManualAsync(e, vinculo);

        // Con la etapa 1 en curso, las otras esperan y quien es de Legal y Cumplimiento no ve nada.
        expediente.EtapaActual.ShouldBe(1);
        expediente.Etapas.Select(x => x.Estado).ShouldBe(["Activa", "Esperando", "Esperando"]);
        (await BandejaDePersonaAsync(e, e.Carlos)).ShouldBeEmpty();
        var deLaura = (await BandejaDePersonaAsync(e, e.Laura)).ShouldHaveSingleItem();
        (deLaura.AreaCodigo, deLaura.Etapa).ShouldBe(("APROBADOR_INICIAL", 1));

        // Una etapa que no está en curso no admite veredictos.
        var adelantada = await ApiAsync("POST", $"/api/v1/expedientes/{expediente.Id}/areas/{legal.Id}/veredicto", Delegado(e, e.Carlos),
            new VeredictoDto("Aprobado"), 409);
        (await CodigoAsync(adelantada)).ShouldBe("area-no-activa");

        // Compras aprueba la etapa 1: la 2 pasa a estar en curso y solo Legal lo recibe.
        var etapa1 = await AprobarAreaAsync(e, expediente.Id, e.Aprobador, e.Laura);
        etapa1.EtapaActual.ShouldBe(2);
        etapa1.Etapas.Select(x => x.Estado).ShouldBe(["Aprobada", "Activa", "Esperando"]);
        var deLegal = (await BandejaDePersonaAsync(e, e.Carlos)).ShouldHaveSingleItem();
        (deLegal.AreaCodigo, deLegal.Etapa, deLegal.EstadoArea).ShouldBe(("LEGAL", 2, "Pendiente"));
        (await BandejaDePersonaAsync(e, e.Laura)).ShouldHaveSingleItem().EstadoArea.ShouldBe("Aprobada"); // su área ya decidió: no le queda nada por hacer

        // Cuando Legal aprueba, Cumplimiento (etapa 3) recibe el expediente; al aprobarlo, el vínculo queda activo.
        var etapa2 = await AprobarAreaAsync(e, expediente.Id, legal, e.Carlos);
        etapa2.EtapaActual.ShouldBe(3);
        etapa2.Etapas.Select(x => x.Estado).ShouldBe(["Aprobada", "Aprobada", "Activa"]);
        (await BandejaDePersonaAsync(e, e.Carlos)).Select(f => (f.AreaCodigo, f.Etapa, f.EstadoArea))
            .ShouldBe([("LEGAL", 2, "Aprobada"), ("OFICIAL_CUMPLIMIENTO", 3, "Pendiente")], ignoreOrder: true);

        var aprobado = await AprobarAreaAsync(e, expediente.Id, e.Cumplimiento, e.Carlos);
        aprobado.Estado.ShouldBe("Aprobado");
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("Activo");
        (await BandejaDePersonaAsync(e, e.Carlos)).ShouldBeEmpty();
    }

    // ---------- separación de funciones ----------

    [Fact]
    public async Task Con_separacion_de_funciones_quien_invito_al_tercero_no_decide_con_un_mensaje_que_lo_explica_y_otra_persona_del_area_si()
    {
        var e = await PrepararAsync();
        var flujo = await ApiAsync<FlujoDto>("POST", "/api/v1/flujos", Admin(e),
            new CrearFlujoDto("SEPARACION", "Separación de funciones", "CLIENTE", [new EtapaDto(1, [new AreaDeEtapaDto(e.Aprobador.Id)])],
                SeparacionDeFunciones: true), 201);
        await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{flujo.Id}/publicar", Admin(e), new { }, 200);

        // Laura, del aprobador inicial, crea el vínculo desde el sistema integrado y envía la invitación: queda como quien invitó.
        var sistema = (await ApiAsync<List<SistemaIntegradoDto>>("GET", "/api/v1/sistemas", new Credencial(e.Admin), null, 200)).ShouldHaveSingleItem();
        var llave = await ApiAsync<ApiKeyDto>("POST", "/api/v1/api-keys", new Credencial(e.Admin),
            new CrearApiKeyDto("Integración que invita", [.. ScopesDeSistema, "vinculos:escribir"], null, null, SistemaId: sistema.Id), 201);
        var comoLaura = Delegado(e, e.Laura) with { ApiKey = llave.Valor! };
        var nit = "9" + Random.Shared.Next(10_000_000, 99_999_999).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var vinculo = await ApiAsync<VinculoDto>("POST", "/api/v1/vinculos", comoLaura, new CrearVinculoDto(
            TerceroId: null,
            Tercero: new CrearTerceroDto(new IdentificacionDto("CO", "NIT", nit), "Juridica", "Tercero " + nit, null,
                [new ContactoDto("Ana Gómez", CorreoNuevo(), null, "Comercial")]),
            TipoVinculo: "CLIENTE", Atributos: null, CorreoInvitacion: CorreoNuevo(), ReferenciaExterna: null, FlujoId: flujo.Id), 201);
        var expediente = await AbrirManualAsync(e, vinculo);
        expediente.SeparacionDeFunciones.ShouldBeTrue();

        // Laura es del área y tiene permiso de revisar, pero invitó: la API la frena con un mensaje que lo explica y no pasa nada.
        var prohibido = await ApiAsync("POST", $"/api/v1/expedientes/{expediente.Id}/areas/{e.Aprobador.Id}/veredicto", Delegado(e, e.Laura),
            new VeredictoDto("Aprobado"), 403);
        (await CodigoAsync(prohibido)).ShouldBe("separacion-de-funciones");
        (await DetalleAsync(prohibido)).ShouldNotBeNull().ShouldContain("separación de funciones");
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expediente.Id}", Admin(e), null, 200)).Estado.ShouldBe("EnRevision");

        // Pedro, que no invitó, sí decide.
        (await AprobarAreaAsync(e, expediente.Id, e.Aprobador, e.Pedro)).Estado.ShouldBe("Aprobado");
        (await VinculoAsync(e, vinculo.Id)).Estado.ShouldBe("Activo");
    }
}
