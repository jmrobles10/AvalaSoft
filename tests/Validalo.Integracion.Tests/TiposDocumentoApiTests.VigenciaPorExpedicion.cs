using Marten;
using Microsoft.Extensions.DependencyInjection;
using Validalo.Aplicacion.Comun;
using Validalo.Aplicacion.Documentos;
using Validalo.Contratos;
using Validalo.Dominio.Documentos;

namespace Validalo.Integracion.Tests;

public sealed partial class TiposDocumentoApiTests
{
    // ---------- vigencia por fecha de expedición (TD-6, TD-7, NW-15) ----------

    /// <summary>
    /// Una empresa con el tipo propio «Certificado de seguridad y salud» (solo formulario: fecha de expedición y origen; vence 30 días después de
    /// expedido) pedido por su flujo, con los días de aviso y de gracia indicados, y un tercero que ya aceptó (expediente abierto).
    /// </summary>
    private async Task<EscenarioFormulario> EscenarioConExpedicionAsync(int[] diasAviso, int diasGracia)
    {
        var empresa = await EmpresaNuevaAsync("Comercial " + Guid.NewGuid().ToString("N")[..6], "F" + Random.Shared.Next(10, 99));
        var tipo = await ApiAsync<TipoDocumentoTenantDto>("POST", "/api/v1/tipos-documento", Admin(empresa),
            new CrearTipoDocumentoDto("CERT_SST", "Certificado de seguridad y salud", null,
                ReglaFrescura: new ReglaFrescuraDto("MaxDiasDesdeExpedicion", 30), DiasAviso: diasAviso, DiasGracia: diasGracia, Modo: "Formulario",
                Campos:
                [
                    new CampoFormularioDto("fecha_expedicion", "Fecha de expedición", "Fecha", true),
                    new CampoFormularioDto("origen", "Origen de los fondos", "Lista", true, ["Nacional", "Extranjero"])
                ]), 201);
        await FlujoConAsync(empresa, [new RequisitoDelFlujoDto(TipoDocumentoTenantId: tipo.Id)]);
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(empresa, correo);
        var sesion = await SesionAsync(correo);
        await AceptarAsync(sesion, vinculo.Id);
        var expedienteId = (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(empresa), null, 200)).ExpedienteAbiertoId!.Value;
        var expediente = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Admin(empresa), null, 200);
        return new EscenarioFormulario(empresa, tipo, vinculo, sesion, expediente, correo);
    }

    private async Task<Guid> SubirCertificadoAsync(EscenarioFormulario e, int diasDesdeExpedicion) =>
        (await TerceroAsync<ConfirmacionCargaDto>("POST", "/public/v1/boveda/formularios", e.Sesion.AccessToken,
            Formulario(e, ("fecha_expedicion", Hoy().AddDays(-diasDesdeExpedicion).ToString("yyyy-MM-dd")), ("origen", "Nacional")), 200)).Version.DocumentoId;

    /// <summary>La vigencia de la versión del requisito vista por la empresa, cuando ya tiene fecha (el cálculo llega por un mensaje).</summary>
    private async Task<VigenciaDto> VigenciaParaLaEmpresaAsync(EscenarioFormulario e, Func<VigenciaDto, bool>? condicion = null)
    {
        var expediente = await EsperarAsync(e.Empresa, e.Expediente.Id,
            x => x.Requisitos!.Single().VersionActual?.Vigencia is { VigenteHasta: not null } v && (condicion?.Invoke(v) ?? true));
        return expediente.Requisitos!.Single().VersionActual!.Vigencia!;
    }

    [Theory]
    [InlineData(3, "Vigente", 27, true)]
    [InlineData(25, "PorVencer", 5, false)]
    [InlineData(32, "EnGracia", -2, false)]
    [InlineData(40, "Vencida", -10, false)]
    public async Task Segun_la_expedicion_declarada_el_documento_queda_vigente_por_vencer_en_gracia_o_vencido_y_solo_se_programa_el_aviso_que_aun_no_paso(
        int diasDesdeExpedicion, string estado, int diasParaVencer, bool seProgramaElAviso)
    {
        var e = await EscenarioConExpedicionAsync([10], 5);
        var vence = Hoy().AddDays(diasParaVencer);

        var documentoId = await SubirCertificadoAsync(e, diasDesdeExpedicion);

        // La vigencia que registra la bóveda para el vínculo: vence 30 días después de expedido, con 5 de gracia.
        var calculada = await EsperarEventoAsync<VigenciaDeVersionCalculada>(documentoId);
        (calculada.VigenteHasta, calculada.Base, calculada.DiasGracia, calculada.VinculoId).ShouldBe((vence, BaseVigencia.FechaExpedicion, 5, e.Vinculo.Id));

        // La empresa y el tercero ven el mismo estado y las mismas fechas.
        var vigencia = await VigenciaParaLaEmpresaAsync(e);
        (vigencia.Estado, vigencia.VigenteHasta, vigencia.FinDeGracia).ShouldBe((estado, vence, vence.AddDays(5)));
        var publica = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{e.Expediente.Id}", e.Sesion.AccessToken, null, 200);
        var vista = publica.Requisitos!.Single().VersionActual!.Vigencia!;
        (vista.Estado, vista.VigenteHasta, vista.FinDeGracia).ShouldBe((estado, vence, vence.AddDays(5)));

        // El aviso de los 10 días solo se programa si todavía no pasó (NW-15): quien sube un documento a 5 días de vencer no recibe un aviso atrasado.
        var fechaAviso = vence.AddDays(-10);
        await using (var consulta = Host.Services.GetRequiredService<IDocumentStore>().QuerySession(TenantsTecnicos.Boveda))
        {
            var programado = await consulta.LoadAsync<AvisoDeVencimiento>(AvisoDeVencimiento.Clave(e.Sesion.TerceroId, fechaAviso));
            (programado is not null).ShouldBe(seProgramaElAviso);
            programado?.Estado.ShouldBe(EstadoAviso.Programado);
        }

        if (estado != "Vencida")
        {
            // Mientras esté vigente, por vencer o en gracia, la versión no vence y nadie recibe el aviso de vencido ni uno atrasado.
            (await EventosAsync(documentoId)).OfType<VersionVencida>().ShouldBeEmpty();
            fixture.Correos.Para(e.Correo).ShouldNotContain(m => m.Asunto.Contains("venció") || m.Asunto.Contains("por vencer"));
            return;
        }

        // Ya pasó la gracia: el vencimiento programado en el pasado se ejecuta enseguida (TD-7) y se le avisa al tercero por correo.
        var vencida = await EsperarEventoAsync<VersionVencida>(documentoId);
        (vencida.VinculoId, vencida.VigenteHasta).ShouldBe((e.Vinculo.Id, vence));
        var aviso = await fixture.Correos.EsperarAsync(e.Correo, m => m.Asunto == $"Tu Certificado de seguridad y salud venció para {e.Empresa.Nombre}");
        aviso.Texto.ShouldContain("ya pasó el plazo de gracia");
        aviso.Texto.ShouldContain("vigente hasta el");
    }

    [Fact]
    public async Task Cambiar_la_regla_de_frescura_del_tipo_recalcula_la_vigencia_que_ya_tenia_el_documento_y_reprograma_su_aviso()
    {
        var e = await EscenarioConExpedicionAsync([10], 5);
        var hoy = Hoy();
        var documentoId = await SubirCertificadoAsync(e, 25);

        // Con 30 días desde la expedición le quedan 5: por vencer.
        var antes = await VigenciaParaLaEmpresaAsync(e);
        (antes.Estado, antes.VigenteHasta).ShouldBe(("PorVencer", hoy.AddDays(5)));

        // La administración del grupo amplía la frescura a 90 días: el mismo documento pasa a vigente hasta la expedición + 90.
        var tipo = await ApiAsync<TipoDocumentoTenantDto>("PUT", $"/api/v1/tipos-documento/{e.Tipo.Id}", Admin(e.Empresa),
            new ActualizarTipoDocumentoDto(ReglaFrescura: new ReglaFrescuraDto("MaxDiasDesdeExpedicion", 90)), 200);
        tipo.ReglaFrescura.Dias.ShouldBe(90);
        var despues = await VigenciaParaLaEmpresaAsync(e, v => v.VigenteHasta == hoy.AddDays(65));
        (despues.Estado, despues.VigenteHasta, despues.FinDeGracia).ShouldBe(("Vigente", hoy.AddDays(65), hoy.AddDays(70)));

        // Quedó registrada como una vigencia nueva del mismo vínculo (la versión es la misma) y su aviso, a los 10 días de la fecha nueva, programado.
        var calculadas = (await EventosAsync(documentoId)).OfType<VigenciaDeVersionCalculada>().ToList();
        calculadas.Select(c => (c.VinculoId, c.VigenteHasta)).ShouldBe([(e.Vinculo.Id, hoy.AddDays(5)), (e.Vinculo.Id, hoy.AddDays(65))]);
        await using var consulta = Host.Services.GetRequiredService<IDocumentStore>().QuerySession(TenantsTecnicos.Boveda);
        (await consulta.LoadAsync<AvisoDeVencimiento>(AvisoDeVencimiento.Clave(e.Sesion.TerceroId, hoy.AddDays(55)))).ShouldNotBeNull().Estado.ShouldBe(EstadoAviso.Programado);
    }
}
