using System.Text.Json;
using Avalasoft.Contratos;
using Xunit.Abstractions;

namespace Avalasoft.Integracion.Tests;

[Collection(Colecciones.Api1)]
[Trait("Requiere", "Docker")]
public sealed class RequisitosMultiempresaFichaApiTests(ApiFixture fixture, ITestOutputHelper salida) : RequisitosApiBase(fixture, salida)
{
    // ---------- dos empresas del mismo grupo exigen lo mismo del mismo tercero (M-8, FM-3, G-1) ----------

    private Task<FichaAceptadaDelVinculoDto> FichaAceptadaAsync(Empresa empresa, Guid vinculoId) =>
        ApiAsync<FichaAceptadaDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculoId}/ficha-aceptada", Admin(empresa), null, 200);

    private async Task AprobarComoAdministradorAsync(Empresa empresa, Guid expedienteId, string justificacion)
    {
        var expediente = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Admin(empresa), null, 200);
        var area = expediente.Etapas.Single().Areas.Single().AreaId;
        (await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/areas/{area}/aprobar-como-administrador", Admin(empresa),
            new JustificacionDto(justificacion), 200)).Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task Dos_empresas_del_mismo_grupo_validan_el_mismo_RUT_y_la_misma_informacion_y_con_una_version_nueva_cada_una_revalida_por_su_cuenta_sin_ver_la_decision_de_la_otra()
    {
        var e = await PrepararAsync();
        var norte = e.Norte;
        var sur = await OtraEmpresaDelTenantAsync(norte, "Sur S.A.S.", "SUR", "899999068");
        await FlujoConAsync(norte, "CLIENTE",
        [
            new RequisitoDelFlujoDto(TipoDocumento: "RUT", AreasQueRevisan: [e.Compras.Id, e.Cumplimiento.Id]),
            new RequisitoDelFlujoDto(Seccion: "FICHA_GENERAL", AreasQueRevisan: [e.Compras.Id])
        ]);
        await FlujoConAsync(sur, "CLIENTE", [new RequisitoDelFlujoDto(TipoDocumento: "RUT"), new RequisitoDelFlujoDto(Seccion: "FICHA_GENERAL")]);
        var correo = CorreoNuevo();
        var nit = Nit();
        var enNorte = await CrearVinculoAsync(norte, "CLIENTE", correo, nit);
        var enSur = await CrearVinculoAsync(sur, "CLIENTE", correo, nit);
        enSur.TerceroId.ShouldBe(enNorte.TerceroId);
        var sesion = await SesionAsync(correo, norte.Datos.Nombre);

        // El tercero diligencia su información general y sube su RUT una sola vez; al aceptar a cada empresa le llegan completos y las dos pasan a revisión.
        await GuardarSeccionAsync(sesion, "FICHA_GENERAL", GeneralCompleta);
        var rut1 = (await SubirAsync(sesion, "RUT", Pdf("RUT compartido v1"))).Version;
        await AceptarAsync(sesion, enNorte.Id);
        await AceptarAsync(sesion, enSur.Id);
        var inicialNorte = await AbiertoEnAsync(norte, enNorte.Id);
        var inicialSur = await AbiertoEnAsync(sur, enSur.Id);
        var revisionNorte = await EsperarAsync(norte, inicialNorte, x => x.Estado == "EnRevision");
        var revisionSur = await EsperarAsync(sur, inicialSur, x => x.Estado == "EnRevision");
        foreach (var revision in new[] { revisionNorte, revisionSur })
        {
            Requisito(revision, "RUT").VersionActual!.ShouldSatisfyAllConditions(v => v.DocumentoId.ShouldBe(rut1.DocumentoId), v => v.N.ShouldBe(1));
            Requisito(revision, "FICHA_GENERAL").VersionActual!.N.ShouldBe(1);
        }

        // Cada empresa valida en su área, por su cuenta: las dos aceptan la versión 1 de la información.
        (await AreasApruebanAsync(e, inicialNorte)).Estado.ShouldBe("Aprobado");
        await AprobarComoAdministradorAsync(sur, inicialSur, "Revisada.");
        foreach (var (empresa, vinculo) in new[] { (norte, enNorte), (sur, enSur) })
        {
            (await VinculoDeAsync(empresa, vinculo.Id)).Estado.ShouldBe("Activo");
            var aceptada = (await FichaAceptadaAsync(empresa, vinculo.Id)).Secciones.ShouldHaveSingleItem();
            (aceptada.Seccion, aceptada.Aceptada.Version, aceptada.CambioPosterior).ShouldBe(("FICHA_GENERAL", 1, (CambioPosteriorDelTerceroDto?)null));
        }

        // El tercero sube un RUT nuevo y cambia su dirección (con el RUT nuevo como soporte): cada empresa recibe su revalidación con las dos novedades.
        var rut2 = (await SubirAsync(sesion, "RUT", Pdf("RUT compartido v2"))).Version;
        var actualizacionNorte = await AbiertoEnAsync(norte, enNorte.Id, inicialNorte);
        var actualizacionSur = await AbiertoEnAsync(sur, enSur.Id, inicialSur);
        await GuardarSeccionAsync(sesion, "FICHA_GENERAL", GeneralCompleta.Replace("Calle 45 # 12-08", "Calle 100 # 19-54"), new SoporteSeccionDto(rut2.DocumentoId, rut2.N));
        var porDecidirNorte = await EsperarAsync(norte, actualizacionNorte, x => x.Requisitos!.Count == 2);
        var porDecidirSur = await EsperarAsync(sur, actualizacionSur, x => x.Requisitos!.Count == 2);
        foreach (var revalidacion in new[] { porDecidirNorte, porDecidirSur })
        {
            revalidacion.Tipo.ShouldBe("Actualizacion");
            (Requisito(revalidacion, "RUT").VersionActual!.N, Requisito(revalidacion, "FICHA_GENERAL").VersionActual!.N).ShouldBe((2, 2));
        }

        // Norte la resuelve; Sur todavía no: sigue con lo que aceptó (versión 1) y ve la versión nueva como pendiente, con lo que cambió.
        (await AreasApruebanAsync(e, actualizacionNorte)).Estado.ShouldBe("Aprobado");
        var deNorte = (await FichaAceptadaAsync(norte, enNorte.Id)).Secciones.ShouldHaveSingleItem();
        (deNorte.Aceptada.Version, deNorte.Aceptada.ExpedienteId, deNorte.CambioPosterior).ShouldBe((2, (Guid?)actualizacionNorte, (CambioPosteriorDelTerceroDto?)null));
        var deSur = (await FichaAceptadaAsync(sur, enSur.Id)).Secciones.ShouldHaveSingleItem();
        deSur.Aceptada.Version.ShouldBe(1);
        var posterior = deSur.CambioPosterior.ShouldNotBeNull();
        posterior.Version.ShouldBe(2);
        posterior.Cambios.ShouldBe([new CambioDeCampoDto("direccion", "Dirección", "Calle 45 # 12-08", "Calle 100 # 19-54", "Modificado")]);
        (posterior.Revalidacion!.ExpedienteId, posterior.Revalidacion.Estado).ShouldBe((actualizacionSur, "EnRevision"));

        // La revalidación de Sur sigue abierta y no dice nada de lo que decidió Norte: ni su empresa, ni su área, ni su decisión, ni quien la tomó.
        var revalidacionSur = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{actualizacionSur}", Admin(sur), null, 200);
        revalidacionSur.Estado.ShouldBe("EnRevision");
        var texto = JsonSerializer.Serialize(revalidacionSur) + JsonSerializer.Serialize(await FichaAceptadaAsync(sur, enSur.Id));
        foreach (var privado in new[] { norte.Datos.Id.ToString(), "NORTE-E-", e.Compras.Id.ToString(), e.Cumplimiento.Id.ToString(), e.Laura.Usuario.Nombre, e.Carlos.Usuario.Nombre, e.Laura.Usuario.Id.ToString(), e.Carlos.Usuario.Id.ToString(), actualizacionNorte.ToString() })
            texto.ShouldNotContain(privado);
        revalidacionSur.Etapas.Single().Areas.Single().Veredictos.ShouldBeEmpty();
        // Y no puede consultar lo de Norte: ni su revalidación ni su ficha aceptada.
        await ApiAsync("GET", $"/api/v1/expedientes/{actualizacionNorte}", Admin(sur), null, 404);
        await ApiAsync("GET", $"/api/v1/vinculos/{enNorte.Id}/ficha-aceptada", Admin(sur), null, 404);

        // El tercero ve un estado distinto con cada empresa: con Norte sus dos novedades aprobadas y con Sur todavía en revisión.
        var publicoNorte = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{actualizacionNorte}", sesion.AccessToken, null, 200);
        publicoNorte.Requisitos!.Select(r => (r.TipoDocumento.Codigo, r.Estado)).ShouldBe([("RUT", "Aprobado"), ("FICHA_GENERAL", "Aprobado")], ignoreOrder: true);
        var publicoSur = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{actualizacionSur}", sesion.AccessToken, null, 200);
        publicoSur.Requisitos!.Select(r => (r.TipoDocumento.Codigo, r.Estado)).ShouldBe([("RUT", "EnRevision"), ("FICHA_GENERAL", "EnRevision")], ignoreOrder: true);
        (await VinculoPublicoAsync(sesion, enNorte.Id)).EnRevision.ShouldBeFalse();
        (await VinculoPublicoAsync(sesion, enSur.Id)).EnRevision.ShouldBeTrue();

        // Sur resuelve la suya y acepta la versión 2: cada una llegó a lo mismo por su cuenta.
        await AprobarComoAdministradorAsync(sur, actualizacionSur, "Revisada la versión nueva.");
        var surAlDia = (await FichaAceptadaAsync(sur, enSur.Id)).Secciones.ShouldHaveSingleItem();
        (surAlDia.Aceptada.Version, surAlDia.CambioPosterior).ShouldBe((2, (CambioPosteriorDelTerceroDto?)null));
        (await VinculoPublicoAsync(sesion, enSur.Id)).EnRevision.ShouldBeFalse();
    }
}
