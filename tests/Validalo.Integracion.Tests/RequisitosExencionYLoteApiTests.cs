using Marten;
using Microsoft.Extensions.DependencyInjection;
using Validalo.Aplicacion.Comun;
using Validalo.Contratos;
using Validalo.Dominio.Documentos;
using Xunit.Abstractions;

namespace Validalo.Integracion.Tests;

[Collection(Colecciones.Api4)]
[Trait("Requiere", "Docker")]
public sealed class RequisitosExencionYLoteApiTests(ApiFixture fixture, ITestOutputHelper salida) : RequisitosApiBase(fixture, salida)
{
    // ---------- eximir lo que falta y aprobar en lote lo que no cambió: el flujo completo de punta a punta ----------

    [Fact]
    public async Task Eximir_el_documento_que_falta_pasa_el_expediente_a_revision_las_areas_aprueban_sin_el_y_el_tercero_y_el_certificado_lo_ven_eximido()
    {
        var e = await PrepararAsync();
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await AceptarAsync(sesion, vinculo.Id); // la Cámara no la tiene: el expediente espera su documento
        var expedienteId = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var enCarga = await EsperarAsync(e.Norte, expedienteId, x => Requisito(x, "RUT").VersionActual is not null);
        enCarga.Estado.ShouldBe("Abierto");
        var camara = Requisito(enCarga, "CAMARA_COMERCIO");
        var delTerceroAntes = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200);
        (delTerceroAntes.Estado, delTerceroAntes.RequisitosFaltantes).ShouldBe(("Abierto", 1));

        // Eximir lo único que faltaba termina la fase de carga: el expediente pasa a revisión y la Cámara queda eximida solo para quien la revisaba.
        var eximido = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/requisitos/{camara.Id}/eximir", Admin(e.Norte),
            new JustificacionDto("Es una persona jurídica sin Cámara de comercio: está inscrita en la Cámara de otro país."), 200);
        eximido.Estado.ShouldBe("EnRevision");
        var exenta = Requisito(eximido, "CAMARA_COMERCIO");
        exenta.Estado.ShouldBe("Eximido");
        exenta.Exencion!.Justificacion.ShouldBe("Es una persona jurídica sin Cámara de comercio: está inscrita en la Cámara de otro país.");
        exenta.Areas.ShouldHaveSingleItem().ShouldSatisfyAllConditions(a => a.Codigo.ShouldBe("CUMPLIMIENTO"), a => a.Estado.ShouldBe("Eximido"));
        (await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/expedientes/{expedienteId}/historial", Admin(e.Norte), null, 200))
            .Single(h => h.Tipo == "requisito_eximido").Datos.GetProperty("justificacion").GetString().ShouldStartWith("Es una persona jurídica");

        // El tercero ve la Cámara eximida (ya no se la piden), el expediente en revisión y nada por subir.
        var delTercero = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200);
        (delTercero.Estado, delTercero.RequisitosFaltantes).ShouldBe(("EnRevision", 0));
        delTercero.Requisitos!.Single(r => r.TipoDocumento.Codigo == "CAMARA_COMERCIO").Estado.ShouldBe("Eximido");

        // Las áreas deciden solo lo que tienen por decidir: Compras el RUT y Cumplimiento también el RUT; la Cámara eximida no se les pide.
        var rut = Requisito(eximido, "RUT");
        foreach (var (area, persona, codigo) in new[] { (e.Compras, e.Laura, "COMPRAS"), (e.Cumplimiento, e.Carlos, "CUMPLIMIENTO") })
        {
            var leido = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Delegado(e.Norte, persona), null, 200);
            var porDecidir = Area(leido, codigo).DocumentosPorDecidir!;
            porDecidir.ShouldBe([new DocumentoPorDecidirDto(rut.Id, 1)]);
            var resultado = await AreaAsync<ExpedienteDto>(e, expedienteId, area, persona,
                new VeredictoDto("Aprobado", Versiones: porDecidir.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
            resultado.Estado.ShouldBe(codigo == "CUMPLIMIENTO" ? "Aprobado" : "EnRevision");
        }

        // El vínculo queda activo con su certificado, que cuenta la Cámara como eximida con su justificación; el tercero lo ve aprobado.
        (await VinculoDeAsync(e.Norte, vinculo.Id)).Estado.ShouldBe("Activo");
        var certificado = (await ApiAsync<CertificadoDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/certificado", Admin(e.Norte), null, 200)).Actual!;
        certificado.Estado.ShouldBe("Vigente");
        certificado.Requisitos.Select(r => (r.Codigo, r.Eximido)).ShouldBe([("RUT", false), ("CAMARA_COMERCIO", true)], ignoreOrder: true);
        var publico = await VinculoPublicoAsync(sesion, vinculo.Id);
        (publico.Estado, publico.EnRevision).ShouldBe(("Activo", false));
        (await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200))
            .ShouldSatisfyAllConditions(x => x.Estado.ShouldBe("Aprobado"), x => x.Requisitos!.Single(r => r.TipoDocumento.Codigo == "CAMARA_COMERCIO").Estado.ShouldBe("Eximido"));
    }

    [Fact]
    public async Task Aprobar_en_lote_dos_documentos_sin_cambios_de_una_misma_actualizacion_deja_un_veredicto_por_documento_y_reemite_el_certificado()
    {
        var e = await PrepararAsync();
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "PROVEEDOR", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v1"));
        await AceptarAsync(sesion, vinculo.Id);

        // Las dos áreas aprueban el expediente inicial con lo que leen.
        var inicial = await AbiertoEnAsync(e.Norte, vinculo.Id);
        await EsperarAsync(e.Norte, inicial, x => x.Estado == "EnRevision");
        foreach (var (area, persona, codigo) in new[] { (e.Compras, e.Laura, "COMPRAS"), (e.Cumplimiento, e.Carlos, "CUMPLIMIENTO") })
        {
            var porDecidir = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Delegado(e.Norte, persona), null, 200), codigo).DocumentosPorDecidir!;
            await AreaAsync<ExpedienteDto>(e, inicial, area, persona,
                new VeredictoDto("Aprobado", Versiones: porDecidir.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
        }

        var emitido = await CertificadoActualAsync(e.Norte, vinculo.Id);

        // El tercero sube versiones nuevas de los dos documentos desde su bóveda: una sola actualización con los dos.
        await SubirAsync(sesion, "RUT", Pdf("RUT v2"));
        var actualizacion = await AbiertoEnAsync(e.Norte, vinculo.Id, inicial);
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v2"));
        var revision = await EsperarAsync(e.Norte, actualizacion, x => x.Requisitos!.Count == 2 && x.Requisitos.All(r => r.VersionActual?.N == 2));
        var rut = Requisito(revision, "RUT");
        var camara = Requisito(revision, "CAMARA_COMERCIO");

        // La revisión automática concluye que los campos clave de los dos documentos no cambiaron.
        foreach (var requisito in new[] { rut, camara })
        {
            var documentoId = requisito.VersionActual!.DocumentoId;
            await using var boveda = Host.Services.GetRequiredService<IDocumentStore>().LightweightSession(TenantsTecnicos.Boveda);
            var hechos = (await boveda.LoadAsync<Documento>(documentoId))!.Buscar(2)!.Hechos!;
            boveda.Events.Append(documentoId, new HechosDeVersionRegistrados(2, hechos with { Comparacion = Comparacion.SinCambios, ConIa = true }, DateTimeOffset.UtcNow));
            await boveda.SaveChangesAsync();
        }

        async Task<List<RevalidacionDto>> FilasAsync(Persona persona) =>
            [.. (await ApiAsync<PaginaDto<RevalidacionDto>>("GET", "/api/v1/revalidaciones", Delegado(e.Norte, persona), null, 200)).Datos.Where(r => r.VinculoId == vinculo.Id)];

        // Cumplimiento revisa los dos documentos: los dos salen en su bandeja como aprobables y los aprueba con un solo lote.
        var deCarlos = await FilasAsync(e.Carlos);
        deCarlos.Select(r => (r.TipoDocumentoCodigo, r.VersionAceptada!.Numero, r.VersionActual.Numero, r.AprobableEnLote))
            .ShouldBe([("RUT", 1, 2, true), ("CAMARA_COMERCIO", 1, 2, true)], ignoreOrder: true);
        var lote = new AprobarRevalidacionesDto([new RevalidacionAAprobarDto(actualizacion, rut.Id, 2), new RevalidacionAAprobarDto(actualizacion, camara.Id, 2)]);
        var resultado = await ApiAsync<ResultadoDeLoteDto>("POST", "/api/v1/revalidaciones/aprobar", Delegado(e.Norte, e.Carlos), lote, 200);
        resultado.Aprobadas.ShouldBe(2);
        resultado.Fallidas.ShouldBeEmpty();

        // Cada documento queda con su propio veredicto en el historial del expediente, aunque se aprobaron juntos.
        var historial = await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/expedientes/{actualizacion}/historial", Admin(e.Norte), null, 200);
        var veredictos = historial.Where(h => h.Tipo == "veredicto_de_requisito_emitido").Select(h => h.Datos).ToList();
        veredictos.Count.ShouldBe(2);
        veredictos.Select(v => v.GetProperty("requisitoId").GetGuid()).ShouldBe([rut.Id, camara.Id], ignoreOrder: true);
        veredictos.ShouldAllBe(v => v.GetProperty("veredicto").GetString() == "Aprobado" && v.GetProperty("sobreVersion").GetInt32() == 2);
        // La Cámara solo la revisa Cumplimiento y sale de la bandeja; el RUT sigue ahí hasta que Compras también lo apruebe.
        (await FilasAsync(e.Carlos)).ShouldHaveSingleItem().TipoDocumentoCodigo.ShouldBe("RUT");
        (await FilasAsync(e.Laura)).ShouldHaveSingleItem().TipoDocumentoCodigo.ShouldBe("RUT");

        // En la línea de tiempo del vínculo: dos expedientes abiertos (el de ingreso y el de la actualización) y solo el de ingreso cerrado.
        async Task<(int Abiertos, int Cerrados)> ExpedientesEnLaLineaDeTiempoAsync()
        {
            var eventos = await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/vinculos/{vinculo.Id}/historial", Admin(e.Norte), null, 200);
            return (eventos.Count(h => h.Tipo == "expediente_vinculado"), eventos.Count(h => h.Tipo == "expediente_cerrado"));
        }

        (await ExpedientesEnLaLineaDeTiempoAsync()).ShouldBe((2, 1));

        // Con el RUT de Compras la actualización se aprueba y el certificado se reemite sobre ella.
        (await ApiAsync<ResultadoDeLoteDto>("POST", "/api/v1/revalidaciones/aprobar", Delegado(e.Norte, e.Laura),
            new AprobarRevalidacionesDto([new RevalidacionAAprobarDto(actualizacion, rut.Id, 2)]), 200)).Aprobadas.ShouldBe(1);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{actualizacion}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Aprobado");
        var reemitido = await CertificadoActualAsync(e.Norte, vinculo.Id);
        (reemitido.Estado, reemitido.Emision).ShouldBe(("Vigente", emitido.Emision + 1));
        (await VinculoDeAsync(e.Norte, vinculo.Id)).ShouldSatisfyAllConditions(v => v.Estado.ShouldBe("Activo"), v => v.EnRevision.ShouldBeFalse());
        (await ExpedientesEnLaLineaDeTiempoAsync()).ShouldBe((2, 2)); // la actualización también quedó cerrada
    }
}
