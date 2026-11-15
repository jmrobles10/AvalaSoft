using System.Security.Cryptography;
using Alba;
using Validasoft.Contratos;

namespace Validasoft.Integracion.Tests;

public sealed partial class RequisitosApiTests
{
    // ---------- grupos de acceso por empresa, acotados por sector (GA) y actualizaciones por sector con responsable ----------

    private static readonly string[] ScopesDeLecturaDelGrupo = ["expedientes:leer", "vinculos:leer", "configuracion:leer"];

    private Task<GrupoDeAccesoDto> GrupoAsync(Empresa empresa, string codigo, string[] permisos, params SectorDeGrupoDto[] sectores) =>
        ApiAsync<GrupoDeAccesoDto>("POST", "/api/v1/grupos-de-acceso", new Credencial(empresa.Admin),
            new CrearGrupoDeAccesoDto(codigo, "Grupo " + codigo, null, permisos, sectores), 201);

    private async Task<Persona> PersonaConGruposAsync(Empresa empresa, string nombre, params AsignacionDeGrupoDto[] grupos)
    {
        var correo = $"{nombre.ToLowerInvariant()}.{Guid.NewGuid():N}@constructora.co";
        var usuario = await ApiAsync<UsuarioDto>("POST", "/api/v1/usuarios", new Credencial(empresa.Admin),
            new CrearUsuarioDto(nombre, correo, null, null, null, Grupos: grupos), 201);
        return new Persona(usuario, "srm-" + Guid.NewGuid().ToString("N")[..8]);
    }

    /// <summary>La llave del SRM con más permisos (ver la ficha y administrar expedientes): la intersección con los grupos de cada persona la limita igual.</summary>
    private async Task<Empresa> ConLlaveAmpliaAsync(Empresa empresa)
    {
        var sistema = (await ApiAsync<List<SistemaIntegradoDto>>("GET", "/api/v1/sistemas", new Credencial(empresa.Admin), null, 200)).Single(s => s.Codigo == "SRM");
        var llave = await ApiAsync<ApiKeyDto>("POST", "/api/v1/api-keys", new Credencial(empresa.Admin),
            new CrearApiKeyDto("SRM amplia", [.. ScopesDeSistema, "terceros:leer", "expedientes:administrar"], null, null, SistemaId: sistema.Id), 201);
        return empresa with { LlaveSrm = llave.Valor! };
    }

    private Task<IScenarioResult> ConBearerAsync(string metodo, string url, string token, Guid empresaId, object? cuerpo, int esperado) =>
        Host.Scenario(s =>
        {
            Preparar(s, metodo, url, cuerpo);
            s.WithRequestHeader("Authorization", "Bearer " + token);
            s.WithRequestHeader("X-Empresa", empresaId.ToString());
            if (metodo == "POST")
                s.WithRequestHeader("Idempotency-Key", Guid.NewGuid().ToString());
            s.StatusCodeShouldBe(esperado);
        });

    /// <summary>Flujo CLIENTE publicado donde solo Compras revisa (con requisitos, cada área del flujo debe revisar alguno).</summary>
    private async Task<FlujoDto> FlujoSoloComprasAsync(Escenario e, params RequisitoDelFlujoDto[] requisitos)
    {
        var flujo = await ApiAsync<FlujoDto>("POST", "/api/v1/flujos", Admin(e.Norte), new CrearFlujoDto("HAB_CLIENTE", "Habilitación CLIENTE", "CLIENTE",
            Etapas: [new EtapaDto(1, [new AreaDeEtapaDto(e.Compras.Id)])], Requisitos: requisitos), 201);
        return await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{flujo.Id}/publicar", Admin(e.Norte), new { }, 200);
    }

    private Task SoloComprasAsync(Escenario e, params Persona[] personas) =>
        ApiAsync<AreaDto>("PUT", $"/api/v1/areas/{e.Compras.Id}/miembros", Admin(e.Norte), new MiembrosAreaDto([.. personas.Select(p => p.Usuario.Id)]), 200);

    [Fact]
    public async Task Los_grupos_se_crean_editan_y_desactivan_los_cuatro_roles_son_predefinidos_y_todo_queda_en_la_auditoria()
    {
        var e = await PrepararAsync();
        var admin = new Credencial(e.Norte.Admin);

        // Los cuatro roles fijos se listan como grupos predefinidos, con los permisos de siempre y sin acotar.
        var inicial = await ApiAsync<List<GrupoDeAccesoDto>>("GET", "/api/v1/grupos-de-acceso", admin, null, 200);
        inicial.Select(g => g.Codigo).ShouldBe(["ADMINISTRADOR", "REVISOR", "OFICIAL_CUMPLIMIENTO", "AUDITOR"]);
        inicial.ShouldAllBe(g => g.Predefinido && g.Activo && g.Sectores.Count == 0);
        var revisor = inicial.Single(g => g.Rol == "Revisor");
        revisor.Permisos.ShouldContain("expedientes:revisar");
        revisor.Usuarios.ShouldBe(1); // Laura
        inicial.Single(g => g.Rol == "Auditor").Permisos.ShouldNotContain("expedientes:revisar");

        // Se crea un grupo propio: solo permisos del catálogo, sectores válidos y código único.
        var tesoreria = await GrupoAsync(e.Norte, "TESORERIA", ["expedientes:leer", "cuentas:aprobar"],
            new SectorDeGrupoDto("FICHA_GENERAL", "Editar"), new SectorDeGrupoDto("FICHA_TRIBUTARIA", "Ver"));
        (tesoreria.Predefinido, tesoreria.Activo, tesoreria.Usuarios).ShouldBe((false, true, 0));
        tesoreria.Sectores.ShouldBe([new SectorDeGrupoDto("FICHA_GENERAL", "Editar"), new SectorDeGrupoDto("FICHA_TRIBUTARIA", "Ver")]);

        async Task<string?> Error(string metodo, string url, object cuerpo, int estado) => await CodigoAsync(await ApiAsync(metodo, url, admin, cuerpo, estado));
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("tesoreria", "Otra", null, ["expedientes:leer"]), 409)).ShouldBe("grupo-duplicado");
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("auditor", "Auditor propio", null, ["expedientes:leer"]), 409)).ShouldBe("codigo-reservado");
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("NUEVO", "Nuevo", null, ["sesiones-tercero:crear"]), 422)).ShouldBe("permisos-invalidos");
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("NUEVO", "Nuevo", null, ["expedientes:inventado"]), 422)).ShouldBe("permisos-invalidos");
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("NUEVO", "Nuevo", null, []), 422)).ShouldBe("permisos-requeridos");
        (await Error("POST", "/api/v1/grupos-de-acceso", new CrearGrupoDeAccesoDto("NUEVO", "Nuevo", null, ["expedientes:leer"],
            [new SectorDeGrupoDto("FICHA_BANCARIA", "Ver")]), 422)).ShouldBe("sector-invalido");

        // Un predefinido no se edita ni se desactiva.
        (await Error("PUT", $"/api/v1/grupos-de-acceso/{revisor.Id}", new ActualizarGrupoDeAccesoDto("Revisor", null, ["expedientes:leer"]), 409)).ShouldBe("grupo-predefinido");
        (await Error("POST", $"/api/v1/grupos-de-acceso/{revisor.Id}/desactivar", new { }, 409)).ShouldBe("grupo-predefinido");

        // Editar reemplaza permisos y sectores; las asignaciones quedan en la auditoría de la persona.
        var marta = await PersonaConGruposAsync(e.Norte, "Marta", new AsignacionDeGrupoDto(tesoreria.Id, e.Norte.Datos.Id));
        marta.Usuario.Grupos.ShouldBe([new AsignacionDeGrupoDto(tesoreria.Id, e.Norte.Datos.Id)]);
        var editado = await ApiAsync<GrupoDeAccesoDto>("PUT", $"/api/v1/grupos-de-acceso/{tesoreria.Id}", admin,
            new ActualizarGrupoDeAccesoDto("Tesorería y pagos", "Aprueba cuentas", ["expedientes:leer", "cuentas:aprobar", "documentos:leer"], []), 200);
        (editado.Nombre, editado.Usuarios, editado.Sectores.Count).ShouldBe(("Tesorería y pagos", 1, 0));
        editado.Permisos.ShouldBe(["expedientes:leer", "cuentas:aprobar", "documentos:leer"]);

        // Desactivado, no se asigna a nadie nuevo (409) pero las asignaciones que ya existían se conservan; reactivado vuelve a poderse.
        (await ApiAsync<GrupoDeAccesoDto>("POST", $"/api/v1/grupos-de-acceso/{tesoreria.Id}/desactivar", admin, new { }, 200)).Activo.ShouldBeFalse();
        (await Error("POST", $"/api/v1/grupos-de-acceso/{tesoreria.Id}/desactivar", new { }, 409)).ShouldBe("grupo-inactivo");
        var otra = await PersonaConGruposAsync(e.Norte, "Otra");
        (await Error("PUT", $"/api/v1/usuarios/{otra.Usuario.Id}/grupos", new AsignarGruposDto([new AsignacionDeGrupoDto(tesoreria.Id, null)]), 409)).ShouldBe("grupo-inactivo");
        (await ApiAsync<UsuarioDto>("GET", $"/api/v1/usuarios/{marta.Usuario.Id}", admin, null, 200)).Grupos!.ShouldHaveSingleItem().GrupoId.ShouldBe(tesoreria.Id);
        (await ApiAsync<GrupoDeAccesoDto>("POST", $"/api/v1/grupos-de-acceso/{tesoreria.Id}/reactivar", admin, new { }, 200)).Activo.ShouldBeTrue();

        // Se asignan predefinidos y propios de una vez: los predefinidos se guardan como roles de siempre y no se pierden con PUT /roles.
        var mezcla = await ApiAsync<UsuarioDto>("PUT", $"/api/v1/usuarios/{otra.Usuario.Id}/grupos", admin,
            new AsignarGruposDto([new AsignacionDeGrupoDto(revisor.Id, e.Norte.Datos.Id), new AsignacionDeGrupoDto(tesoreria.Id, null)]), 200);
        mezcla.Roles.ShouldBe([new RolAsignadoDto("Revisor", e.Norte.Datos.Id)]);
        mezcla.Grupos.ShouldBe([new AsignacionDeGrupoDto(tesoreria.Id, null)]);
        (await ApiAsync<UsuarioDto>("PUT", $"/api/v1/usuarios/{otra.Usuario.Id}/roles", admin, new AsignarRolesDto([new RolAsignadoDto("Auditor", null)]), 200))
            .Grupos.ShouldBe([new AsignacionDeGrupoDto(tesoreria.Id, null)]);
        (await Error("PUT", $"/api/v1/usuarios/{otra.Usuario.Id}/grupos", new AsignarGruposDto([new AsignacionDeGrupoDto(Guid.NewGuid(), null)]), 422)).ShouldBe("grupo-invalido");
        (await Error("PUT", $"/api/v1/usuarios/{otra.Usuario.Id}/grupos", new AsignarGruposDto([new AsignacionDeGrupoDto(tesoreria.Id, Guid.NewGuid())]), 422)).ShouldBe("empresas-invalidas");

        // Administrar grupos es administración del tenant: un revisor delegado no puede (403) aunque la llave tenga permisos.
        await ApiAsync("GET", "/api/v1/grupos-de-acceso", Delegado(e.Norte, e.Laura), null, 403);

        // Auditoría de cambios de grupos y de asignaciones.
        var auditoriaGrupo = await (await ApiAsync("GET", $"/api/v1/auditoria?entidad=GrupoDeAcceso&entidadId={tesoreria.Id}", Admin(e.Norte), null, 200)).ReadAsTextAsync();
        foreach (var accion in new[] { "Creado", "Modificado", "Desactivado", "Reactivado" })
            auditoriaGrupo.ShouldContain(accion);
        var auditoriaUsuario = await (await ApiAsync("GET", $"/api/v1/auditoria?entidad=Usuario&entidadId={otra.Usuario.Id}", Admin(e.Norte), null, 200)).ReadAsTextAsync();
        auditoriaUsuario.ShouldContain(tesoreria.Id.ToString());
    }

    [Fact]
    public async Task Los_permisos_de_una_persona_son_la_union_de_sus_grupos_por_el_mismo_camino_de_autorizacion_y_un_grupo_de_lectura_recibe_403_al_decidir()
    {
        var e = await PrepararAsync();
        await FlujoSoloComprasAsync(e, new RequisitoDelFlujoDto(TipoDocumento: "RUT"));
        var lectura = await GrupoAsync(e.Norte, "SOLO_LECTURA", ScopesDeLecturaDelGrupo);
        var revisa = await GrupoAsync(e.Norte, "REVISA", ["expedientes:revisar"]);
        var empresaId = e.Norte.Datos.Id;
        var marta = await PersonaConGruposAsync(e.Norte, "Marta", new AsignacionDeGrupoDto(lectura.Id, empresaId));
        await SoloComprasAsync(e, e.Laura, marta);

        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "CLIENTE", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await AceptarAsync(sesion, vinculo.Id);
        var expedienteId = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var revision = await EsperarAsync(e.Norte, expedienteId, x => x.Estado == "EnRevision" && x.Requisitos!.All(r => r.VersionActual is not null));
        var url = $"/api/v1/expedientes/{expedienteId}";
        var rut = Requisito(revision, "RUT");
        var veredicto = $"{url}/requisitos/{rut.Id}/areas/{e.Compras.Id}/veredicto";
        var aprobar = new VeredictoDto("Aprobado", SobreVersion: 1);

        // Con solo lectura: ve el expediente, no decide (403), tampoco con una sesión embebida (el token copia el permiso efectivo).
        await ApiAsync<ExpedienteDto>("GET", url, Delegado(e.Norte, marta), null, 200);
        await ApiAsync("POST", veredicto, Delegado(e.Norte, marta), aprobar, 403);
        var embebida = await ApiAsync<SesionUsuarioDto>("POST", "/api/v1/sesiones-usuario", Delegado(e.Norte, marta), new { }, 200);
        await ConBearerAsync("GET", url, embebida.Token, empresaId, null, 200);
        await ConBearerAsync("POST", veredicto, embebida.Token, empresaId, aprobar, 403);

        // Sumar un segundo grupo suma permisos: la unión de los dos deja decidir, con la llave y con la sesión embebida nueva.
        await ApiAsync<UsuarioDto>("PUT", $"/api/v1/usuarios/{marta.Usuario.Id}/grupos", new Credencial(e.Norte.Admin),
            new AsignarGruposDto([new AsignacionDeGrupoDto(lectura.Id, empresaId), new AsignacionDeGrupoDto(revisa.Id, empresaId)]), 200);
        var unida = await ApiAsync<SesionUsuarioDto>("POST", "/api/v1/sesiones-usuario", Delegado(e.Norte, marta), new { }, 200);
        var yo = await ApiAsync<YoDto>("GET", "/api/v1/yo", Delegado(e.Norte, marta), null, 200);
        yo.Permisos.ShouldContain("expedientes:revisar");
        yo.Permisos.ShouldContain("expedientes:leer");

        // Desactivar el grupo que revisa le quita el permiso en la siguiente petición con llave (y en la siguiente sesión embebida).
        await ApiAsync<GrupoDeAccesoDto>("POST", $"/api/v1/grupos-de-acceso/{revisa.Id}/desactivar", new Credencial(e.Norte.Admin), new { }, 200);
        await ApiAsync("POST", veredicto, Delegado(e.Norte, marta), aprobar, 403);
        await ApiAsync<GrupoDeAccesoDto>("POST", $"/api/v1/grupos-de-acceso/{revisa.Id}/reactivar", new Credencial(e.Norte.Admin), new { }, 200);

        // La API key sin persona no cambia: sigue con sus scopes. Reactivado el grupo, Marta decide y el expediente se aprueba.
        await ApiAsync<ExpedienteDto>("GET", url, Admin(e.Norte), null, 200);
        await ConBearerAsync("POST", veredicto, unida.Token, empresaId, aprobar, 200);
        (await ApiAsync<ExpedienteDto>("GET", url, Admin(e.Norte), null, 200)).Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task Un_grupo_acotado_por_sector_ve_y_decide_solo_sus_secciones_y_recibe_403_en_las_demas()
    {
        var e = await PrepararAsync();
        var amplia = await ConLlaveAmpliaAsync(e.Norte);
        await FlujoSoloComprasAsync(e, new RequisitoDelFlujoDto(Seccion: "FICHA_GENERAL"), new RequisitoDelFlujoDto(Seccion: "FICHA_TRIBUTARIA"));
        var empresaId = e.Norte.Datos.Id;
        var permisos = new[] { "expedientes:leer", "expedientes:revisar", "vinculos:leer", "terceros:leer", "configuracion:leer" };
        var general = await GrupoAsync(e.Norte, "SOLO_GENERAL", permisos, new SectorDeGrupoDto("FICHA_GENERAL", "Editar"));
        var generalYVeTributaria = await GrupoAsync(e.Norte, "GENERAL_Y_VE_TRIBUTARIA", permisos,
            new SectorDeGrupoDto("FICHA_GENERAL", "Editar"), new SectorDeGrupoDto("FICHA_TRIBUTARIA", "Ver"));
        var nora = await PersonaConGruposAsync(e.Norte, "Nora", new AsignacionDeGrupoDto(general.Id, empresaId));
        var marta = await PersonaConGruposAsync(e.Norte, "Marta", new AsignacionDeGrupoDto(generalYVeTributaria.Id, empresaId));
        await SoloComprasAsync(e, e.Laura, nora, marta);

        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "CLIENTE", correo);
        var sesion = await SesionAsync(correo);
        await AceptarAsync(sesion, vinculo.Id);
        await GuardarSeccionAsync(sesion, "FICHA_GENERAL", GeneralCompleta);
        await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA", TributariaCompleta);
        var expedienteId = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var revision = await EsperarAsync(e.Norte, expedienteId, x => x.Estado == "EnRevision" && x.Requisitos!.All(r => r.VersionActual is not null));
        var url = $"/api/v1/expedientes/{expedienteId}";
        var requisitoGeneral = Requisito(revision, "FICHA_GENERAL");
        var requisitoTributaria = Requisito(revision, "FICHA_TRIBUTARIA");

        // Ver: quien solo tiene el sector General ve su contenido y de la tributaria apenas el nombre y el estado; quien además la ve, todo; sin grupos, todo.
        var deNora = await ApiAsync<ExpedienteDto>("GET", url, Delegado(amplia, nora), null, 200);
        Requisito(deNora, "FICHA_GENERAL").Seccion!.Datos.ShouldNotBeNull();
        var tributariaDeNora = Requisito(deNora, "FICHA_TRIBUTARIA");
        (tributariaDeNora.Estado, tributariaDeNora.TipoDocumento.Nombre).ShouldBe((requisitoTributaria.Estado, requisitoTributaria.TipoDocumento.Nombre));
        tributariaDeNora.Seccion!.Datos.ShouldBeNull();
        tributariaDeNora.Seccion.Soportes.ShouldBeEmpty();
        tributariaDeNora.Seccion.Cambios.ShouldBeEmpty();
        Requisito(await ApiAsync<ExpedienteDto>("GET", url, Delegado(amplia, marta), null, 200), "FICHA_TRIBUTARIA").Seccion!.Datos.ShouldNotBeNull();
        Requisito(await ApiAsync<ExpedienteDto>("GET", url, Admin(e.Norte), null, 200), "FICHA_TRIBUTARIA").Seccion!.Datos.ShouldNotBeNull();

        // Decidir: la sección de otro sector (403 sector-no-permitido), también la que solo ve; aprobar toda el área mientras queda una ajena pendiente; y observarla.
        string Veredicto(Guid requisitoId) => $"{url}/requisitos/{requisitoId}/areas/{e.Compras.Id}/veredicto";
        (await CodigoAsync(await ApiAsync("POST", Veredicto(requisitoTributaria.Id), Delegado(amplia, nora), new VeredictoDto("Aprobado", SobreVersion: 1), 403)))
            .ShouldBe("sector-no-permitido");
        (await CodigoAsync(await ApiAsync("POST", Veredicto(requisitoTributaria.Id), Delegado(amplia, marta), new VeredictoDto("Aprobado", SobreVersion: 1), 403)))
            .ShouldBe("sector-no-permitido");
        (await CodigoAsync(await ApiAsync("POST", $"{url}/areas/{e.Compras.Id}/veredicto", Delegado(amplia, nora), new VeredictoDto("Aprobado",
            Versiones: new Dictionary<Guid, int> { [requisitoGeneral.Id] = 1, [requisitoTributaria.Id] = 1 }), 403))).ShouldBe("sector-no-permitido");
        (await CodigoAsync(await ApiAsync("POST", $"{url}/areas/{e.Compras.Id}/veredicto", Delegado(amplia, nora), new VeredictoDto("Observado", Requisitos:
            [new ObservacionDeRequisitoDto(requisitoTributaria.Id, 1, ["datos-no-coinciden"], "No coincide.", null)]), 403))).ShouldBe("sector-no-permitido");

        // Lo suyo sí: aprueba la general; el expediente sigue abierto porque falta la tributaria.
        var conGeneral = await ApiAsync<ExpedienteDto>("POST", Veredicto(requisitoGeneral.Id), Delegado(amplia, nora), new VeredictoDto("Aprobado", SobreVersion: 1), 200);
        (conGeneral.Estado, Requisito(conGeneral, "FICHA_GENERAL").Estado).ShouldBe(("EnRevision", "Aprobado"));

        // Quien revisa con el rol de siempre (sin grupos acotados) decide la tributaria y el expediente se aprueba.
        (await ApiAsync<ExpedienteDto>("POST", Veredicto(requisitoTributaria.Id), Delegado(amplia, e.Laura), new VeredictoDto("Aprobado", SobreVersion: 1), 200))
            .Estado.ShouldBe("Aprobado");

        // La ficha aceptada, la del vínculo (para el ERP) y Tercero 360 solo traen las secciones que el grupo ve.
        async Task<string[]> Aceptadas(Persona persona) =>
            [.. (await ApiAsync<FichaAceptadaDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/ficha-aceptada", Delegado(amplia, persona), null, 200)).Secciones
                .Select(s => s.Seccion)];
        async Task<string[]> DelVinculo(Persona persona) =>
            [.. (await ApiAsync<FichaDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/ficha", Delegado(amplia, persona), null, 200)).Secciones.Select(s => s.Seccion)];
        async Task<string[]> Tercero360(Persona persona) =>
            [.. (await ApiAsync<FichaTerceroDto>("GET", $"/api/v1/terceros/{vinculo.TerceroId}/ficha", Delegado(amplia, persona), null, 200)).Secciones!
                .Where(s => s.Datos is not null).Select(s => s.Seccion)];
        (await Aceptadas(nora)).ShouldBe(["FICHA_GENERAL"]);
        (await DelVinculo(nora)).ShouldBe(["FICHA_GENERAL"]);
        (await Tercero360(nora)).ShouldBe(["FICHA_GENERAL"]);
        (await Aceptadas(marta)).ShouldBe(["FICHA_GENERAL", "FICHA_TRIBUTARIA"]);
        (await Aceptadas(e.Laura)).ShouldBe(["FICHA_GENERAL", "FICHA_TRIBUTARIA"]);
        (await ApiAsync<FichaAceptadaDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/ficha-aceptada", Admin(amplia), null, 200)).Secciones.Count.ShouldBe(2);
        (await ApiAsync<FichaDelVinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/ficha", Admin(amplia), null, 200)).Secciones.Count.ShouldBe(2);
    }

    [Fact]
    public async Task La_actualizacion_envia_cada_seccion_cambiada_al_area_responsable_de_su_sector_y_un_sector_sin_responsable_conserva_el_comportamiento_de_hoy()
    {
        var e = await PrepararAsync();
        var empresaId = e.Norte.Datos.Id;

        // Cumplimiento es el responsable de la tributaria en las actualizaciones; la general no tiene responsable.
        var flujo = await ApiAsync<FlujoDto>("POST", "/api/v1/flujos", Admin(e.Norte), new CrearFlujoDto("HAB_CLIENTE", "Habilitación CLIENTE", "CLIENTE",
            Requisitos: [new RequisitoDelFlujoDto(Seccion: "FICHA_GENERAL"), new RequisitoDelFlujoDto(Seccion: "FICHA_TRIBUTARIA")],
            ResponsablesDeSector: [new ResponsableDeSectorDto("ficha_tributaria", e.Cumplimiento.Id)]), 201);
        flujo.Borrador!.ResponsablesDeSector.ShouldBe([new ResponsableDeSectorDto("FICHA_TRIBUTARIA", e.Cumplimiento.Id)]);
        (await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{flujo.Id}/publicar", Admin(e.Norte), new { }, 200)).Publicada!.ResponsablesDeSector
            .ShouldBe([new ResponsableDeSectorDto("FICHA_TRIBUTARIA", e.Cumplimiento.Id)]);

        // El flujo valida: sector que no es de la ficha, sector repetido y un área que no participa en el flujo (creada después).
        var sst = await ApiAsync<AreaDto>("POST", "/api/v1/areas", Admin(e.Norte), new CrearAreaDto("SST", "Seguridad y salud"), 201);
        async Task<string?> Editar(params ResponsableDeSectorDto[] responsables) =>
            await CodigoAsync(await ApiAsync("PUT", $"/api/v1/flujos/{flujo.Id}", Admin(e.Norte), new EditarFlujoDto(ResponsablesDeSector: responsables), 422));
        (await Editar(new ResponsableDeSectorDto("FICHA_BANCARIA", e.Compras.Id))).ShouldBe("sector-invalido");
        (await Editar(new ResponsableDeSectorDto("FICHA_GENERAL", e.Compras.Id), new ResponsableDeSectorDto("FICHA_GENERAL", e.Cumplimiento.Id))).ShouldBe("sector-duplicado");
        (await Editar(new ResponsableDeSectorDto("FICHA_GENERAL", sst.Id))).ShouldBe("responsable-area-invalida");

        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "CLIENTE", correo);
        var sesion = await SesionAsync(correo);
        await AceptarAsync(sesion, vinculo.Id);
        await GuardarSeccionAsync(sesion, "FICHA_GENERAL", GeneralCompleta);
        await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA", TributariaCompleta);

        // La revisión inicial no cambia: las dos áreas revisan las dos secciones.
        var inicial = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var revision = await EsperarAsync(e.Norte, inicial, x => x.Estado == "EnRevision" && x.Requisitos!.All(r => r.VersionActual is not null));
        foreach (var codigo in new[] { "FICHA_GENERAL", "FICHA_TRIBUTARIA" })
            Requisito(revision, codigo).Areas.Select(a => a.Codigo).ShouldBe(["COMPRAS", "CUMPLIMIENTO"], ignoreOrder: true);
        foreach (var (area, persona, codigo) in new[] { (e.Compras, e.Laura, "COMPRAS"), (e.Cumplimiento, e.Carlos, "CUMPLIMIENTO") })
        {
            var porDecidir = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Delegado(e.Norte, persona), null, 200), codigo).DocumentosPorDecidir ?? [];
            await AreaAsync<ExpedienteDto>(e, inicial, area, persona, new VeredictoDto("Aprobado", Versiones: porDecidir.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
        }

        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Aprobado");

        // Después de aprobada, el tercero cambia la general (sin responsable): la actualización la manda a las dos áreas, como hoy.
        var adhoc = (await SubirAsync(sesion, "SOPORTE_FICHA", Pdf("Soporte del cambio"))).Version;
        var soporte = new SoporteSeccionDto(adhoc.DocumentoId, adhoc.N);
        await GuardarSeccionAsync(sesion, "FICHA_GENERAL", GeneralCompleta.Replace("Calle 45 # 12-08", "Carrera 7 # 80-12"), soporte);
        var actualizacionId = await AbiertoEnAsync(e.Norte, vinculo.Id, inicial);
        var conLaGeneral = await EsperarAsync(e.Norte, actualizacionId, x => x.Tipo == "Actualizacion" && x.Estado == "EnRevision");
        conLaGeneral.Requisitos!.ShouldHaveSingleItem().Seccion!.Seccion.ShouldBe("FICHA_GENERAL");
        Requisito(conLaGeneral, "FICHA_GENERAL").Areas.Select(a => a.Codigo).ShouldBe(["COMPRAS", "CUMPLIMIENTO"], ignoreOrder: true);

        // Y cambia la tributaria (con responsable): entra a la misma actualización y va solo a Cumplimiento, el área responsable de ese sector.
        await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA", TributariaCompleta.Replace("4663", "4290"), soporte);
        var ampliada = await EsperarAsync(e.Norte, actualizacionId, x => x.Requisitos!.Count == 2);
        (await AbiertoEnAsync(e.Norte, vinculo.Id)).ShouldBe(actualizacionId);
        var tributaria = Requisito(ampliada, "FICHA_TRIBUTARIA");
        tributaria.Areas.ShouldHaveSingleItem().Codigo.ShouldBe("CUMPLIMIENTO");
        Requisito(ampliada, "FICHA_GENERAL").Areas.Count.ShouldBe(2);

        // Cada área ve por decidir solo lo suyo: Compras la general; Cumplimiento la general y la tributaria.
        var deCompras = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{actualizacionId}", Delegado(e.Norte, e.Laura), null, 200), "COMPRAS").DocumentosPorDecidir!;
        deCompras.Select(d => d.Seccion).ShouldBe(["FICHA_GENERAL"]);
        var deCumplimiento = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{actualizacionId}", Delegado(e.Norte, e.Carlos), null, 200), "CUMPLIMIENTO").DocumentosPorDecidir!;
        deCumplimiento.Select(d => d.Seccion).ShouldBe(["FICHA_GENERAL", "FICHA_TRIBUTARIA"], ignoreOrder: true);
        (await ApiAsync<PaginaDto<RevalidacionDto>>("GET", "/api/v1/revalidaciones", Delegado(e.Norte, e.Laura), null, 200)).Datos
            .Where(r => r.ExpedienteId == actualizacionId).Select(r => r.TipoDocumentoCodigo).ShouldBe(["FICHA_GENERAL"]);

        // Compras no puede decidir la tributaria (no es de su sector en la actualización); Cumplimiento sí, y con las dos decisiones se aprueba.
        (await CodigoAsync(await VeredictoAsync(e, actualizacionId, tributaria.Id, e.Compras, e.Laura, new VeredictoDto("Aprobado", SobreVersion: 2), 409))).ShouldBe("requisito-no-en-alcance");
        await AreaAsync<ExpedienteDto>(e, actualizacionId, e.Compras, e.Laura,
            new VeredictoDto("Aprobado", Versiones: deCompras.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
        (await AreaAsync<ExpedienteDto>(e, actualizacionId, e.Cumplimiento, e.Carlos,
            new VeredictoDto("Aprobado", Versiones: deCumplimiento.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)))).Estado.ShouldBe("Aprobado");
        Aceptacion(await ApiAsync<FichaTerceroDto>("GET", $"/api/v1/terceros/{vinculo.TerceroId}/ficha", Admin(e.Norte), null, 200), "FICHA_TRIBUTARIA").VersionAceptada.ShouldBe(2);
    }
}
