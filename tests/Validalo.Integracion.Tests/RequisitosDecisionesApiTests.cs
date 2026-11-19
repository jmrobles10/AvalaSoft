using System.Text.Json;
using Validalo.Contratos;
using Xunit.Abstractions;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Decisiones de las áreas sobre un expediente con documentos (PC-1, conversión de las e2e <c>decisiones</c> y <c>actualizaciones</c>): la
/// versión nueva durante la revisión que invalida lo que un área ya había aprobado, la respuesta del tercero con una explicación (sin
/// versión nueva) y la aprobación en nombre de un área por quien administra sin ser de ninguna. Escenario base: Compras (Laura) y
/// Cumplimiento (Carlos) en paralelo; RUT (ambas áreas) y Cámara de comercio (solo Cumplimiento).
/// </summary>
[Collection(Colecciones.Api1)]
[Trait("Requiere", "Docker")]
public sealed class RequisitosDecisionesApiTests(ApiFixture fixture, ITestOutputHelper salida) : RequisitosApiBase(fixture, salida)
{
    /// <summary>Proveedor de Norte que ya aceptó y subió RUT y Cámara: el expediente está en revisión (con el flujo ya ajustado por <paramref name="configurar"/>).</summary>
    private async Task<(Escenario E, VinculoDto Vinculo, SesionTerceroDto Sesion, Guid ExpedienteId)> ExpedienteEnRevisionAsync(Func<Escenario, Task>? configurar = null)
    {
        var e = await PrepararAsync();
        if (configurar is not null)
            await configurar(e);
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v1"));
        await AceptarAsync(sesion, vinculo.Id);
        var expedienteId = await ExpedienteAbiertoAsync(e, vinculo.Id);
        await EsperarAsync(e.Norte, expedienteId, x => x.Estado == "EnRevision" && x.Requisitos!.All(r => r.VersionActual is not null));
        return (e, vinculo, sesion, expedienteId);
    }

    private Task<ExpedienteDto> VistoPorAsync(Escenario e, Guid expedienteId, Persona persona) =>
        ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Delegado(e.Norte, persona), null, 200);

    [Fact]
    public async Task Una_version_nueva_del_RUT_durante_la_revision_invalida_lo_que_Compras_aprobo_y_las_areas_ven_la_version_2()
    {
        var (e, _, sesion, expedienteId) = await ExpedienteEnRevisionAsync();

        // Compras aprueba su área: el RUT v1. El expediente sigue en revisión porque falta Cumplimiento.
        var aprobada = await AreaAsync<ExpedienteDto>(e, expedienteId, e.Compras, e.Laura, await AprobarLoDeAsync(e, expedienteId, "COMPRAS", e.Laura));
        Area(aprobada, "COMPRAS").Estado.ShouldBe("Aprobada");
        aprobada.Estado.ShouldBe("EnRevision");

        // Sin que nadie se lo pida, el tercero actualiza su RUT.
        await SubirAsync(sesion, "RUT", Pdf("RUT v2 actualizado"));
        var rut = Requisito(await EsperarAsync(e.Norte, expedienteId, x => Requisito(x, "RUT").VersionActual!.N == 2), "RUT");

        // El voto de Compras sobre la versión 1 deja de contar: vuelve a tener el RUT por decidir, ahora en la versión 2, y Cumplimiento lo ve igual.
        var deCompras = await VistoPorAsync(e, expedienteId, e.Laura);
        deCompras.Estado.ShouldBe("EnRevision");
        Area(deCompras, "COMPRAS").Estado.ShouldBe("Pendiente");
        Area(deCompras, "COMPRAS").DocumentosPorDecidir!.ShouldBe([new DocumentoPorDecidirDto(rut.Id, 2)]);
        var votoDeCompras = Requisito(deCompras, "RUT").Areas.Single(a => a.Codigo == "COMPRAS").Veredictos.ShouldHaveSingleItem();
        votoDeCompras.Invalidado.ShouldBeTrue();
        votoDeCompras.Vigente.ShouldBeFalse();
        var deCumplimiento = await VistoPorAsync(e, expedienteId, e.Carlos);
        Area(deCumplimiento, "CUMPLIMIENTO").DocumentosPorDecidir!.Select(d => (d.RequisitoId, d.VersionVigente))
            .ShouldBe([(rut.Id, 2), (Requisito(deCumplimiento, "CAMARA_COMERCIO").Id, 1)]);

        // Compras vuelve a aprobar, esta vez la versión 2, y con Cumplimiento el expediente queda aprobado.
        await AreaAsync<ExpedienteDto>(e, expedienteId, e.Compras, e.Laura, await AprobarLoDeAsync(e, expedienteId, "COMPRAS", e.Laura));
        var final = await AreaAsync<ExpedienteDto>(e, expedienteId, e.Cumplimiento, e.Carlos, await AprobarLoDeAsync(e, expedienteId, "CUMPLIMIENTO", e.Carlos));
        final.Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task Cumplimiento_observa_la_Camara_y_el_tercero_responde_con_una_explicacion_sin_version_nueva()
    {
        var (e, vinculo, sesion, expedienteId) = await ExpedienteEnRevisionAsync();
        var inicial = await VistoPorAsync(e, expedienteId, e.Carlos);
        var camara = Requisito(inicial, "CAMARA_COMERCIO");

        // Cumplimiento observa la Cámara: el expediente se devuelve al tercero.
        var observado = await VeredictoAsync<ExpedienteDto>(e, expedienteId, camara.Id, e.Cumplimiento, e.Carlos,
            new VeredictoDto("Observado", ["incompleto"], "Falta la firma.", SobreVersion: 1));
        observado.Estado.ShouldBe("Observado");

        // El tercero responde con una explicación, sin subir una versión nueva.
        var reenviado = await TerceroAsync<ExpedientePublicoDto>("POST", $"/public/v1/expedientes/{expedienteId}/reenviar", sesion.AccessToken,
            new ReenviarExpedienteDto("La Cámara se expide con firma digital; está en la última página."), 200);
        reenviado.Estado.ShouldBe("EnRevision");

        // Cumplimiento ve la respuesta y vuelve a decidir sobre la misma versión 1.
        var visto = await VistoPorAsync(e, expedienteId, e.Carlos);
        visto.Estado.ShouldBe("EnRevision");
        visto.UltimaRespuesta.ShouldBe("La Cámara se expide con firma digital; está en la última página.");
        Requisito(visto, "CAMARA_COMERCIO").VersionActual!.N.ShouldBe(1);
        Requisito(visto, "CAMARA_COMERCIO").Estado.ShouldBe("EnRevision");
        Area(visto, "CUMPLIMIENTO").DocumentosPorDecidir!.ShouldContain(new DocumentoPorDecidirDto(camara.Id, 1));

        // Compras nunca se frenó por la Cámara: las dos áreas aprueban y el vínculo queda activo.
        await AreaAsync<ExpedienteDto>(e, expedienteId, e.Cumplimiento, e.Carlos, await AprobarLoDeAsync(e, expedienteId, "CUMPLIMIENTO", e.Carlos));
        var aprobado = await AreaAsync<ExpedienteDto>(e, expedienteId, e.Compras, e.Laura, await AprobarLoDeAsync(e, expedienteId, "COMPRAS", e.Laura));
        aprobado.Estado.ShouldBe("Aprobado");
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Activo");
    }

    [Fact]
    public async Task Quien_administra_sin_ser_de_ningun_area_aprueba_en_nombre_de_Compras_solo_con_justificacion()
    {
        var (e, _, _, expedienteId) = await ExpedienteEnRevisionAsync();
        var url = $"/api/v1/expedientes/{expedienteId}/areas/{e.Compras.Id}/aprobar-como-administrador";

        // Solo quien administra expedientes, y con justificación.
        await ApiAsync("POST", url, Delegado(e.Norte, e.Laura), new JustificacionDto("Estoy de acuerdo."), 403);
        (await CodigoAsync(await ApiAsync("POST", url, Admin(e.Norte), new JustificacionDto(" "), 422))).ShouldBe("justificacion-requerida");

        var enNombre = await ApiAsync<ExpedienteDto>("POST", url, Admin(e.Norte), new JustificacionDto("Laura está de vacaciones; el RUT ya lo validó por correo."), 200);
        Area(enNombre, "COMPRAS").Estado.ShouldBe("Aprobada");
        Area(enNombre, "COMPRAS").Veredictos.Single(v => v.Vigente && v.Derivado).Origen.ShouldBe("Administrador");
        var delRut = Requisito(enNombre, "RUT").Areas.Single(a => a.Codigo == "COMPRAS").Veredictos.Single(v => v.Vigente);
        delRut.Origen.ShouldBe("Administrador");
        delRut.Justificacion.ShouldBe("Laura está de vacaciones; el RUT ya lo validó por correo.");
        enNombre.Estado.ShouldBe("EnRevision"); // falta Cumplimiento
        (Area(await VistoPorAsync(e, expedienteId, e.Laura), "COMPRAS").DocumentosPorDecidir ?? []).ShouldBeEmpty();

        var aprobado = await AreaAsync<ExpedienteDto>(e, expedienteId, e.Cumplimiento, e.Carlos, await AprobarLoDeAsync(e, expedienteId, "CUMPLIMIENTO", e.Carlos));
        aprobado.Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task El_tercero_rechazado_vuelve_a_postularse_con_lo_que_ya_tiene_en_la_boveda_y_al_aprobarse_el_certificado_es_del_expediente_nuevo()
    {
        var (e, vinculo, sesion, rechazadoId) = await ExpedienteEnRevisionAsync(async antes =>
        {
            // Cumplimiento puede rechazar y el flujo deja volver a postularse al instante.
            await ApiAsync<FlujoDto>("PUT", $"/api/v1/flujos/{antes.Flujo.Id}", Admin(antes.Norte), new EditarFlujoDto(
                Etapas: [new EtapaDto(1, [new AreaDeEtapaDto(antes.Compras.Id), new AreaDeEtapaDto(antes.Cumplimiento.Id, PuedeRechazarExpediente: true)])],
                Reintento: new ReintentoDto(true, 0)), 200);
            await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{antes.Flujo.Id}/publicar", Admin(antes.Norte), new { }, 200);
        });
        const string justificacion = "El representante legal aparece en una lista restrictiva con otro nombre.";

        // Cumplimiento rechaza el expediente por un hallazgo; Compras no alcanzó a decidir.
        var rechazado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{rechazadoId}/rechazar", Delegado(e.Norte, e.Carlos),
            new RechazarExpedienteDto(e.Cumplimiento.Id, ["no-corresponde-al-tercero"], justificacion), 200);
        rechazado.Estado.ShouldBe("Rechazado");
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Invitado");

        // El proveedor ve el rechazo con el texto del motivo; no la justificación, ni el área, ni quién la escribió.
        var lista = await (await TerceroAsync("GET", "/public/v1/vinculos", sesion.AccessToken, null, 200)).ReadAsTextAsync();
        lista.ShouldNotContain(justificacion);
        lista.ShouldNotContain("Cumplimiento");
        lista.ShouldNotContain("Carlos");
        var vinculos = JsonSerializer.Deserialize<List<VinculoPublicoDto>>(lista, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var reintento = vinculos.ShouldHaveSingleItem().Reintento.ShouldNotBeNull();
        (reintento.Permitido, reintento.Disponible).ShouldBe((true, true));
        reintento.Motivos.ShouldHaveSingleItem().Texto.ShouldBe("El documento no corresponde a la persona o empresa que se está validando.");

        // «Volver a postularme» abre una revisión nueva: sus documentos ya están en la bóveda y entran a ella, sin cargarlos otra vez.
        var nuevo = await TerceroAsync<ExpedientePublicoDto>("POST", $"/public/v1/vinculos/{vinculo.Id}/reintentar", sesion.AccessToken, null, 200);
        nuevo.Id.ShouldNotBe(rechazadoId);
        nuevo.Estado.ShouldBe("EnRevision");
        nuevo.Requisitos!.Select(r => (r.TipoDocumento.Codigo, r.VersionActual!.N)).ShouldBe([("RUT", 1), ("CAMARA_COMERCIO", 1)]);
        var reabierto = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e.Norte), null, 200);
        reabierto.Estado.ShouldBe("EnValidacion");
        reabierto.ExpedienteAbiertoId.ShouldBe(nuevo.Id);

        // El proveedor sube la versión corregida del RUT: llega al expediente nuevo y el rechazado se queda como estaba.
        await SubirAsync(sesion, "RUT", Pdf("RUT corregido"));
        var conVersion2 = await EsperarAsync(e.Norte, nuevo.Id, x => Requisito(x, "RUT").VersionActual!.N == 2);
        conVersion2.Estado.ShouldBe("EnRevision");
        var cerrado = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{rechazadoId}", Admin(e.Norte), null, 200);
        cerrado.Estado.ShouldBe("Rechazado");
        Requisito(cerrado, "RUT").VersionActual!.N.ShouldBe(1);

        // Las dos áreas aprueban el expediente nuevo: vínculo activo y certificado vigente del expediente nuevo.
        await AreaAsync<ExpedienteDto>(e, nuevo.Id, e.Compras, e.Laura, await AprobarLoDeAsync(e, nuevo.Id, "COMPRAS", e.Laura));
        var aprobado = await AreaAsync<ExpedienteDto>(e, nuevo.Id, e.Cumplimiento, e.Carlos, await AprobarLoDeAsync(e, nuevo.Id, "CUMPLIMIENTO", e.Carlos));
        aprobado.Estado.ShouldBe("Aprobado");
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Activo");
        var certificado = (await ApiAsync<CertificadoDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/certificado", Admin(e.Norte), null, 200)).Actual.ShouldNotBeNull();
        certificado.Estado.ShouldBe("Vigente");
        certificado.ExpedienteId.ShouldBe(nuevo.Id);
    }
}
