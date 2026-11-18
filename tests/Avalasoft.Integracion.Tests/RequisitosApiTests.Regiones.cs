using Avalasoft.Contratos;

namespace Avalasoft.Integracion.Tests;

public sealed partial class RequisitosApiTests
{
    // ---------- Panamá y República Dominicana (RG-1…RG-11, registro 5-septuagies) ----------

    private Task<VinculoDto> CrearVinculoDeAsync(Empresa empresa, string correo, IdentificacionDto identificacion) =>
        ApiAsync<VinculoDto>("POST", "/api/v1/vinculos", Admin(empresa), new CrearVinculoDto(
            TerceroId: null,
            Tercero: new CrearTerceroDto(identificacion, "Juridica", "Tercero " + identificacion.Numero, null, [new ContactoDto("Ana Pérez", correo, null, "Comercial")]),
            TipoVinculo: "PROVEEDOR",
            Atributos: null,
            CorreoInvitacion: correo,
            ReferenciaExterna: null), 201);

    [Fact]
    public async Task Los_catalogos_traen_Panama_y_Republica_Dominicana_y_los_documentos_equivalentes_por_pais()
    {
        var e = await PrepararAsync();

        var paises = await ApiAsync<List<PaisDto>>("GET", "/api/v1/catalogos/paises", Admin(e.Norte), null, 200);
        var panama = paises.Single(p => p.Codigo == "PA");
        panama.TiposIdentificacion.Select(t => (t.Codigo, t.TieneDv)).ShouldBe([("RUC", false), ("CIP", false), ("PASAPORTE", false), ("ID_FISCAL", false)]);
        paises.Single(p => p.Codigo == "DO").TiposIdentificacion.Select(t => t.Codigo).ShouldBe(["RNC", "CED", "PASAPORTE", "ID_FISCAL"]);
        paises.Single(p => p.Codigo == "CO").TiposIdentificacion.Single(t => t.Codigo == "NIT").TieneDv.ShouldBeTrue();

        var tipos = await ApiAsync<List<TipoIdentificacionDto>>("GET", "/api/v1/catalogos/tipos-identificacion?pais=DO", Admin(e.Norte), null, 200);
        tipos.Select(t => t.Codigo).ShouldBe(["RNC", "CED", "PASAPORTE", "ID_FISCAL"]);

        var documentos = await ApiAsync<List<TipoDocumentoCanonicoDto>>("GET", "/api/v1/catalogos/tipos-documento", Admin(e.Norte), null, 200);
        documentos.Single(d => d.Codigo == "RUT").Paises.ShouldBe(["CO"]);
        documentos.Single(d => d.Codigo == "CEDULA").Paises.ShouldBeNull();
        foreach (var (codigo, pais, equivalente) in new[] { ("CERTIFICADO_RUC", "PA", "RUT"), ("REGISTRO_PUBLICO", "PA", "CAMARA_COMERCIO"), ("CONSTANCIA_RNC", "DO", "RUT"), ("REGISTRO_MERCANTIL", "DO", "CAMARA_COMERCIO") })
        {
            var tipo = documentos.Single(d => d.Codigo == codigo);
            tipo.Paises.ShouldBe([pais]);
            (tipo.EquivalenteA, tipo.CargaSoportada).ShouldBe((equivalente, true));
        }
    }

    [Fact]
    public async Task Un_tercero_dominicano_diligencia_su_ficha_sin_la_casilla_53_y_sin_lectura_de_documentos_colombianos()
    {
        var e = await PrepararAsync();
        var correo = CorreoNuevo();
        await CrearVinculoDeAsync(e.Norte, correo, new IdentificacionDto("DO", "RNC", "1-01-85004-3"));
        var sesion = await SesionAsync(correo);

        // Un RNC con el dígito de control equivocado no se registra.
        var malo = await ApiAsync("POST", "/api/v1/vinculos", Admin(e.Norte), new CrearVinculoDto(null,
            new CrearTerceroDto(new IdentificacionDto("DO", "RNC", "101850042"), "Juridica", "Mal RNC", null, [new ContactoDto("Ana Pérez", CorreoNuevo(), null, "Comercial")]),
            "PROVEEDOR", null, CorreoNuevo(), null), 422);
        (await CodigoAsync(malo)).ShouldBe("digito-verificacion-invalido");

        var estado = await TerceroAsync<EstadoFichaDto>("GET", RutaFicha, sesion.AccessToken, null, 200);
        var perfil = estado.Perfil.ShouldNotBeNull();
        (perfil.Pais, perfil.TipoIdentificacion, perfil.DvDeclarado, perfil.ModeloTributario, perfil.AutoridadTributaria, perfil.ImpuestoVentas)
            .ShouldBe(("DO", "RNC", false, "Generico", "DGII", "ITBIS"));
        perfil.Regimenes.Select(r => r.Codigo).ShouldBe(["ORDINARIO", "RST", "ZONA_FRANCA", "SIN_FINES_DE_LUCRO", "OTRO"]);
        perfil.TiposDePersona.ShouldContain("CED");

        // La casilla 53 y el ICA no son de la República Dominicana; el régimen es uno de la lista de ese país.
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_TRIBUTARIA", """{ "responsabilidades": ["48"] }""")).ShouldBe(("campo-no-aplica", "responsabilidades"));
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_TRIBUTARIA", """{ "responsable_ica": false }""")).ShouldBe(("campo-no-aplica", "responsable_ica"));
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_TRIBUTARIA", """{ "regimen": "ZONA_LIBRE" }""")).ShouldBe(("codigo-invalido", "regimen"));

        var parcial = await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA", """{ "regimen": "rst", "contribuyente_impuesto_ventas": true }""");
        parcial.Completitud.Completa.ShouldBeFalse();
        parcial.Completitud.Faltantes.Select(f => f.Campo).ShouldBe(["agente_de_retencion", "exento_de_retenciones"]);
        parcial.Seccion.Datos!.Value.GetProperty("regimen").GetString().ShouldBe("RST");

        var completa = await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA",
            """{ "regimen": "RST", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": true, "certificado_exencion": { "numero": "DGII-123", "fecha": "2025-03-01" }, "emisor_comprobantes_electronicos": true }""");
        completa.Completitud.Completa.ShouldBeTrue();
        completa.Completitud.ReglaVersion.ShouldBe(2);

        // Ni el DV se declara (el RNC lleva su dígito de control dentro del número), ni hay propuesta ni cruce desde documentos colombianos.
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_GENERAL", """{ "dv": "5" }""")).ShouldBe(("dv-no-editable", "dv"));
        (await TerceroAsync<List<PropuestaDeSeccionDto>>("GET", $"{RutaFicha}/propuestas", sesion.AccessToken, null, 200)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Un_tercero_panameno_declara_el_dv_de_su_RUC_y_su_legal_admite_cedula_y_RUC_con_DV()
    {
        var e = await PrepararAsync();
        var correo = CorreoNuevo();
        await CrearVinculoDeAsync(e.Norte, correo, new IdentificacionDto("PA", "RUC", "155612345-2-2019"));
        var sesion = await SesionAsync(correo);

        var perfil = (await TerceroAsync<EstadoFichaDto>("GET", RutaFicha, sesion.AccessToken, null, 200)).Perfil.ShouldNotBeNull();
        (perfil.Pais, perfil.DvDeclarado, perfil.ImpuestoVentas).ShouldBe(("PA", true, "ITBMS"));
        perfil.TiposConDvDeclarado.ShouldBe(["RUC"]);

        // El DV son 2 dígitos y es obligatorio; sin él la general queda incompleta con su faltante exacto.
        const string General = """{ "razon_social": "Inversiones Istmo S.A.", "correo": "compras@istmo.pa", "telefono": "+507 300 1234", "pais": "PA", "direccion": "Calle 50, Ciudad de Panamá", "ciiu_principal": "4663" """;
        var sinDv = await GuardarSeccionAsync(sesion, "FICHA_GENERAL", General + "}");
        sinDv.Completitud.Faltantes.Select(f => f.Campo).ShouldBe(["dv"]);
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_GENERAL", General + """, "dv": "5" }""")).ShouldBe(("valor-invalido", "dv"));
        var conDv = await GuardarSeccionAsync(sesion, "FICHA_GENERAL", General + """, "dv": "56" }""");
        conDv.Completitud.Completa.ShouldBeTrue();
        conDv.Seccion.Datos!.Value.GetProperty("dv").GetString().ShouldBe("56");
        conDv.Seccion.Datos.Value.GetProperty("numero").GetString().ShouldBe("15561234522019");

        // Legal: la cédula panameña (CIP) y el RUC de la sociedad, con su DV; la cédula dominicana no es de un tercero panameño.
        const string Rep = """{ "rol": "RepresentanteLegal", "tipo_identificacion": "CIP", "numero": "PE-12-345", "nombres": "Ana", "apellidos": "Pérez", "pep": false, "vinculo_pep": false }""";
        const string Socio = """{ "rol": "Socio", "tipo_identificacion": "RUC", "numero": "155612345-2-2019", "dv": "56", "nombres": "Inversiones Istmo S.A.", "porcentaje": 100, "pep": false, "vinculo_pep": false }""";
        var legal = await GuardarSeccionAsync(sesion, "FICHA_LEGAL", $$"""{ "personas": [{{Rep}}, {{Socio}}] }""");
        legal.Completitud.Completa.ShouldBeTrue();
        var cedulaDominicana = """{ "personas": [ { "rol": "RepresentanteLegal", "tipo_identificacion": "CED", "numero": "00113918205", "nombres": "Ana", "apellidos": "Pérez" } ] }""";
        (await ErrorDeSeccionAsync(sesion, $"{RutaFicha}/FICHA_LEGAL", cedulaDominicana)).ShouldBe(("valor-invalido", "personas[0].tipo_identificacion"));

        // Tributaria: el modelo genérico con ITBMS y los regímenes de Panamá.
        var tributaria = await GuardarSeccionAsync(sesion, "FICHA_TRIBUTARIA",
            """{ "regimen": "ZONA_LIBRE", "contribuyente_impuesto_ventas": true, "agente_de_retencion": false, "exento_de_retenciones": false }""");
        tributaria.Completitud.Completa.ShouldBeTrue();
    }
}
