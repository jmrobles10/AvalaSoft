using System.Security.Cryptography;
using System.Text.Json;
using Alba;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Validalo.Contratos;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Fuentes oficiales, RUES y DIAN (FO-1…FO-8), de punta a punta con el proveedor simulado (sin llamar a nadie): el flujo las pide por tipo de vínculo
/// como bloqueantes o informativas, se consultan solas al pasar a revisión, las diferencias son para el revisor, la evidencia queda guardada y se descarga con su
/// hash, un fallo del proveedor deja la verificación pendiente (nunca satisfecha), la configuración de la empresa y la de la plataforma cifran los secretos, y la
/// reconsulta periódica de los vínculos activos es opcional.
/// </summary>
public sealed partial class ExpedientesApiTests
{
    private static readonly VerificacionRequeridaDto RuesRequerida = new("Rues");
    private static readonly VerificacionRequeridaDto DianInformativa = new("Dian", Bloqueante: false);

    private IDocumentStore Store => Host.Services.GetRequiredService<IDocumentStore>();

    private async Task<ExpedienteDto> AbrirConFuentesAsync(Escenario e, string nombre, params VerificacionRequeridaDto[] verificaciones)
    {
        await CrearFlujoConVerificacionesAsync(e, "CLIENTE", verificaciones);
        var vinculo = await CrearVinculoConNombreAsync(e, "CLIENTE", nombre);
        return await ApiAsync<ExpedienteDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/expedientes", Admin(e), new AbrirExpedienteDto(), 201);
    }

    private async Task AprobarAreasAsync(Escenario e, Guid expedienteId)
    {
        await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/areas/{e.Aprobador.Id}/veredicto", Delegado(e, e.Laura), new VeredictoDto("Aprobado"), 200);
        await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/areas/{e.Cumplimiento.Id}/veredicto", Delegado(e, e.Carlos), new VeredictoDto("Aprobado"), 200);
    }

    [Fact]
    public async Task El_RUES_bloqueante_y_la_DIAN_informativa_se_consultan_solas_dejan_su_evidencia_con_hash_y_el_expediente_se_aprueba()
    {
        var e = await PrepararAsync();
        var abierto = await AbrirConFuentesAsync(e, "Aceros del Norte Oficial S.A.S.", RuesRequerida, DianInformativa);
        abierto.Verificaciones!.Select(v => (v.Tipo, v.Bloqueante, v.Estado)).ShouldBe([("Rues", true, "Pendiente"), ("Dian", false, "Pendiente")]);

        var consultado = await EsperarExpedienteAsync(e, abierto.Id, x => x.Verificaciones!.All(v => v.Estado == "Satisfecha"));
        var rues = consultado.Verificaciones!.Single(v => v.Tipo == "Rues");
        (rues.Proveedor, rues.Resultado).ShouldBe(("Simulado", "Conforme"));
        var datos = rues.FuenteOficial.ShouldNotBeNull().Datos;
        (datos.Encontrado, datos.RazonSocial, datos.Estado, datos.EstadoNormalizado).ShouldBe((true, "ACEROS DEL NORTE OFICIAL S.A.S.", "ACTIVA", "Vigente"));
        datos.UltimoAnoRenovado.ShouldNotBeNull();
        rues.FuenteOficial!.Campos.ShouldNotContain(c => c.Resultado == "Discrepa");
        rues.FuenteOficial.Campos.Select(c => c.Campo).ShouldContain("estado_matricula");
        rues.VigenteHasta!.Value.ShouldBe(rues.RegistradaEn!.Value.AddDays(30), TimeSpan.FromSeconds(2));
        consultado.Verificaciones!.Single(v => v.Tipo == "Dian").FuenteOficial!.Datos.Estado.ShouldBe("REGISTRO ACTIVO");

        // La evidencia es una constancia JSON con la fuente, la fecha y el hash de la respuesta; lo que se descarga es lo que se guardó.
        var evidencia = rues.Evidencia.ShouldNotBeNull();
        (evidencia.TipoContenido, evidencia.DelProveedor).ShouldBe(("application/json", false));
        evidencia.NombreArchivo.ShouldStartWith("constancia-rues-");
        evidencia.Sha256Respuesta.ShouldNotBeNullOrWhiteSpace();
        var descarga = await ApiAsync<DescargaEvidenciaDto>("POST", $"/api/v1/expedientes/{abierto.Id}/verificaciones/Rues/evidencia/descarga", Admin(e), null, 200);
        using var http = new HttpClient();
        var bytes = await http.GetByteArrayAsync(descarga.Url);
        Convert.ToHexStringLower(SHA256.HashData(bytes)).ShouldBe(evidencia.Sha256);
        using var constancia = JsonDocument.Parse(bytes);
        var raiz = constancia.RootElement;
        (raiz.GetProperty("fuente").GetString(), raiz.GetProperty("proveedor").GetString(), raiz.GetProperty("sha256Respuesta").GetString())
            .ShouldBe(("RUES", "Simulado", evidencia.Sha256Respuesta));
        raiz.GetProperty("consultadoPor").GetString().ShouldNotBeNull().ShouldContain("Sistema");
        raiz.GetProperty("respuesta").GetProperty("simulado").GetBoolean().ShouldBeTrue();

        // Las áreas aprueban y, con la fuente bloqueante satisfecha, se cierra; el vínculo queda activo.
        await AprobarAreasAsync(e, abierto.Id);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{abierto.Id}", Admin(e), null, 200)).Estado.ShouldBe("Aprobado");
        var historial = await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/expedientes/{abierto.Id}/historial", Admin(e), null, 200);
        historial.Select(h => h.Tipo).ShouldContain("fuente_oficial_consultada");
        historial.Select(h => h.Tipo).ShouldContain("evidencia_de_verificacion_descargada");

        // Los eventos públicos son los de siempre (verificacion_registrada) y no llevan el nombre del tercero.
        var eventos = await EsperarEventosAsync(e, "expediente.verificacion_registrada", 2);
        eventos.Select(x => x.GetProperty("datos").GetProperty("tipo").GetString()).ShouldBe(["Rues", "Dian"], ignoreOrder: true);
        eventos.ShouldAllBe(x => !x.GetRawText().Contains("Aceros del Norte Oficial", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Una_matricula_cancelada_deja_la_diferencia_para_el_revisor_bloquea_y_solo_cumplimiento_la_acepta_con_justificacion()
    {
        var e = await PrepararAsync();
        var abierto = await AbrirConFuentesAsync(e, "Aceros Cancelada Oficial S.A.S.", RuesRequerida);
        var consultado = await EsperarExpedienteAsync(e, abierto.Id, x => x.Verificaciones!.Single().Estado == "CoincidenciaPorAnalizar");
        var rues = consultado.Verificaciones!.Single();
        rues.Resultado.ShouldBe("ConDiferencias");
        var diferencia = rues.FuenteOficial!.Campos.Single(c => c.Resultado == "Discrepa");
        (diferencia.Campo, diferencia.Contra, diferencia.Critico, diferencia.Oficial, diferencia.Decision).ShouldBe(("estado_matricula", "Fuente", true, "CANCELADA", (string?)null));

        // Las áreas aprueban, pero la diferencia sin resolver impide cerrar y el oficial la ve en su bandeja.
        await AprobarAreasAsync(e, abierto.Id);
        var esperando = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{abierto.Id}", Admin(e), null, 200);
        (esperando.Estado, esperando.EsperandoVerificaciones).ShouldBe(("EnRevision", true));
        var fila = (await ApiAsync<List<FilaCumplimientoDto>>("GET", "/api/v1/cumplimiento/bandeja", Delegado(e, e.Carlos), null, 200)).ShouldHaveSingleItem();
        (fila.ExpedienteId, fila.CoincidenciasPorAnalizar, fila.EsperandoSoloVerificaciones).ShouldBe((abierto.Id, 1, true));
        fila.Pendientes.ShouldHaveSingleItem().Tipo.ShouldBe("Rues");
        await Correos.EsperarAsync(e.Carlos.Usuario.Correo, m => m.Asunto.Contains("Diferencias con RUES"));

        // Solo Cumplimiento resuelve, siempre con justificación y con una decisión válida.
        var ruta = $"/api/v1/expedientes/{abierto.Id}/verificaciones/Rues/diferencias/{diferencia.Id}/resolver";
        await ApiAsync("POST", ruta, Delegado(e, e.Laura), new ResolverCoincidenciaDto("Descartada", "La aceptamos"), 403);
        (await CodigoAsync(await ApiAsync("POST", ruta, Delegado(e, e.Carlos), new ResolverCoincidenciaDto("Descartada", " "), 422))).ShouldBe("justificacion-requerida");
        (await CodigoAsync(await ApiAsync("POST", ruta, Delegado(e, e.Carlos), new ResolverCoincidenciaDto("Quizás", "x"), 422))).ShouldBe("decision-invalida");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/expedientes/{abierto.Id}/verificaciones/Rues/diferencias/{Guid.NewGuid()}/resolver", Delegado(e, e.Carlos),
            new ResolverCoincidenciaDto("Descartada", "x"), 404))).ShouldBe("diferencia-no-encontrada");
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/expedientes/{abierto.Id}/verificaciones/ListasRestrictivas/diferencias/{diferencia.Id}/resolver", Delegado(e, e.Carlos),
            new ResolverCoincidenciaDto("Descartada", "x"), 422))).ShouldBe("tipo-no-consultable");

        var aprobado = await ApiAsync<ExpedienteDto>("POST", ruta, Delegado(e, e.Carlos),
            new ResolverCoincidenciaDto("Descartada", "En liquidación voluntaria: la empresa lo aceptó por escrito."), 200);
        aprobado.Estado.ShouldBe("Aprobado");
        var resuelta = aprobado.Verificaciones!.Single().FuenteOficial!.Campos.Single(c => c.Id == diferencia.Id);
        (resuelta.Decision, resuelta.ResueltaPor, resuelta.Heredada).ShouldBe(("Descartada", e.Carlos.Usuario.Id.ToString(), false));
        resuelta.VigenteHasta!.Value.ShouldBe(resuelta.ResueltaEn!.Value.AddMonths(12));
        (await CodigoAsync(await ApiAsync("POST", ruta, Delegado(e, e.Carlos), new ResolverCoincidenciaDto("Confirmada", "x"), 409))).ShouldBe("estado-invalido");
        // El informe de consultas y estudios las cuenta como las listas: una fila por fuente con sus diferencias y las que se aceptaron.
        var informe = await ApiAsync<InformeCumplimientoDto>("GET", "/api/v1/informes/cumplimiento", Delegado(e, e.Carlos), null, 200);
        var delInforme = informe.Filas.Single(f => f.Verificacion == "Rues");
        (delInforme.Proveedor, delInforme.Estado, delInforme.Resultado, delInforme.Coincidencias, delInforme.Descartadas, delInforme.Confirmadas).ShouldBe(("Simulado", "Satisfecha", "ConDiferencias", 1, 1, 0));
        informe.Verificaciones.Single(r => r.Tipo == "Rues").ConCoincidencias.ShouldBe(1);
        (await EsperarEventosAsync(e, "expediente.coincidencia_resuelta", 1)).Single().GetProperty("datos").GetProperty("tipo").GetString().ShouldBe("Rues");
    }

    [Fact]
    public async Task Una_diferencia_confirmada_deja_la_fuente_fallida_y_cumplimiento_puede_rechazar_el_expediente()
    {
        var e = await PrepararAsync();
        var abierto = await AbrirConFuentesAsync(e, "Aceros Suspendido Oficial S.A.S.", new VerificacionRequeridaDto("Dian"));
        var consultado = await EsperarExpedienteAsync(e, abierto.Id, x => x.Verificaciones!.Single().Estado == "CoincidenciaPorAnalizar");
        var diferencia = consultado.Verificaciones!.Single().FuenteOficial!.Campos.Single(c => c.Resultado == "Discrepa");
        diferencia.Campo.ShouldBe("estado_rut");

        var fallida = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{abierto.Id}/verificaciones/Dian/diferencias/{diferencia.Id}/resolver", Delegado(e, e.Carlos),
            new ResolverCoincidenciaDto("Confirmada", "El RUT figura suspendido en la DIAN."), 200);
        fallida.Verificaciones!.Single().Estado.ShouldBe("Fallida");
        fallida.Estado.ShouldNotBe("Aprobado");
        var rechazado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{abierto.Id}/cumplimiento/rechazar", Delegado(e, e.Carlos),
            new RechazarPorCumplimientoDto(["no-corresponde-al-tercero"], "RUT suspendido: hallazgo confirmado."), 200);
        rechazado.Estado.ShouldBe("Rechazado");
    }

    [Fact]
    public async Task Si_la_fuente_falla_la_verificacion_queda_pendiente_con_su_reintento_y_una_bloqueante_nunca_deja_cerrar()
    {
        var e = await PrepararAsync();
        var abierto = await AbrirConFuentesAsync(e, "Aceros Caída Oficial S.A.S.", RuesRequerida, DianInformativa);

        var fallo = await EsperarExpedienteAsync(e, abierto.Id, x => x.Verificaciones!.All(v => v.UltimoError is not null));
        foreach (var v in fallo.Verificaciones!)
        {
            (v.Estado, v.Resultado, v.FuenteOficial).ShouldBe(("Pendiente", (string?)null, (FuenteOficialDto?)null));
            v.UltimoError!.ShouldContain("no responde");
            v.ReintentarDesde!.Value.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddMinutes(2));
        }

        // Las áreas aprueban: sin la fuente bloqueante no se cierra, ni en silencio ni por defecto; la reconsulta a mano también falla con 503.
        await AprobarAreasAsync(e, abierto.Id);
        var esperando = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{abierto.Id}", Admin(e), null, 200);
        (esperando.Estado, esperando.EsperandoVerificaciones).ShouldBe(("EnRevision", true));
        (await ApiAsync<List<FilaCumplimientoDto>>("GET", "/api/v1/cumplimiento/bandeja", Delegado(e, e.Carlos), null, 200)).ShouldHaveSingleItem()
            .Pendientes.Select(p => (p.Tipo, p.Estado, p.Bloqueante)).ShouldBe([("Rues", "Pendiente", true), ("Dian", "Pendiente", false)], ignoreOrder: true);
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/expedientes/{abierto.Id}/verificaciones/Rues/consultar", Delegado(e, e.Carlos), null, 503))).ShouldBe("verificacion-no-disponible");

        // Una fuente solo informativa que falla no frena el cierre: se queda pendiente y reintentando.
        var otra = await PrepararAsync(); // otra empresa: la primera ya tiene su flujo por defecto con las dos fuentes
        var informativa = await AbrirConFuentesAsync(otra, "Aceros Caída Informativa S.A.S.", new VerificacionRequeridaDto("Rues", Bloqueante: false));
        await EsperarExpedienteAsync(otra, informativa.Id, x => x.Verificaciones!.Single().UltimoError is not null);
        await AprobarAreasAsync(otra, informativa.Id);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{informativa.Id}", Admin(otra), null, 200)).Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task Reconsultar_a_mano_guarda_la_anterior_y_el_cotejo_con_la_ficha_marca_el_representante_que_no_figura()
    {
        var e = await PrepararAsync();
        await PublicarTextosAsync(e);
        await CrearFlujoConVerificacionesAsync(e, "CLIENTE", new VerificacionRequeridaDto("Rues", Bloqueante: false));
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoConNombreAsync(e, "CLIENTE", "Aceros Otro Representante S.A.S.", correo);
        var sesion = await AceptarInvitacionAsync(vinculo, correo);
        var expedienteId = (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e), null, 200)).ExpedienteAbiertoId.ShouldNotBeNull();
        await EsperarExpedienteAsync(e, expedienteId, x => x.Verificaciones!.Single().Estado is "Satisfecha" or "CoincidenciaPorAnalizar");

        // La ficha legal del tercero declara a su representante; la fuente (simulada con «otro representante») reporta a otra persona.
        await TerceroAsync("PUT", "/public/v1/ficha/FICHA_LEGAL", sesion.AccessToken, new GuardarSeccionDto(JsonDocument.Parse("""
            { "personas": [ { "rol": "RepresentanteLegal", "tipo_identificacion": "CC", "numero": "1020304050", "nombres": "Ana", "apellidos": "Pérez",
                              "pep": false, "vinculo_pep": false } ] }
            """).RootElement.Clone()), 200);
        var reconsultado = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/expedientes/{expedienteId}/verificaciones/Rues/consultar", Delegado(e, e.Carlos), null, 200);

        var rues = reconsultado.Verificaciones!.Single();
        rues.Estado.ShouldBe("CoincidenciaPorAnalizar");
        rues.Anteriores.Count.ShouldBeGreaterThanOrEqualTo(1);
        rues.RegistradaPor.ShouldBe(e.Carlos.Usuario.Id.ToString());
        var campos = rues.FuenteOficial!.Campos;
        var representante = campos.Single(c => c.Campo == "representante[0]");
        (representante.Contra, representante.Referencia, representante.Resultado, representante.Critico).ShouldBe(("Ficha", "FICHA_LEGAL", "Discrepa", true));
        representante.Oficial.ShouldNotBeNull().ShouldContain("Persona Distinta");
        representante.Comparado.ShouldBeNull();
        // Lo demás coincide con lo que la ficha tiene (el nombre del tercero) y el resto de campos no se puede verificar sin pedir decisión.
        campos.Single(c => c.Campo == "razon_social" && c.Contra == "Ficha").Resultado.ShouldBe("Coincide");
        campos.Where(c => c.Resultado == "Discrepa").Select(c => c.Campo).ShouldBe(["representante[0]"]);

        // Solo el RUES y la DIAN se consultan por este camino.
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/expedientes/{expedienteId}/verificaciones/EstudioDeCumplimiento/consultar", Delegado(e, e.Carlos), null, 422)))
            .ShouldBe("tipo-no-consultable");
        await ApiAsync("POST", $"/api/v1/expedientes/{expedienteId}/verificaciones/Rues/consultar", Delegado(e, e.Laura), null, 403);
    }

    [Fact]
    public async Task La_empresa_elige_proveedor_por_fuente_guarda_credenciales_cifradas_y_la_reconsulta_periodica_se_valida_sin_exponer_secretos()
    {
        var e = await PrepararAsync();
        var inicial = await ApiAsync<FuentesOficialesConfigDto>("GET", "/api/v1/configuracion/fuentes-oficiales", Admin(e), null, 200);
        inicial.Fuentes.Select(f => (f.Fuente, f.Nombre, f.ProveedorEfectivo)).ShouldBe([("Rues", "RUES", "Simulado"), ("Dian", "DIAN", "Simulado")]);
        (inicial.DiasMonitoreo, inicial.VigenciaDias).ShouldBe((0, 30));
        inicial.Fuentes.Single(f => f.Fuente == "Rues").Proveedores.Select(p => (p.Nombre, p.Real, p.HabilitadoEnInstalacion, p.Disponible)).ShouldBe(
            [("DatosAbiertos", true, false, false), ("Contrato", true, false, false), ("Simulado", false, true, true)]);
        inicial.Fuentes.Single(f => f.Fuente == "Dian").Proveedores.Select(p => p.Nombre).ShouldBe(["Contrato", "Simulado"]);

        // Credenciales propias de un proveedor real: la clave solo se escribe (vuelve «…últimos 4») y se cifra con la del grupo.
        var conClave = await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto(Credenciales: new CredencialesFuenteDto("Rues", "Contrato", "convenio-norte", "token-secreto-del-contrato-4321",
                "https://api.confecamaras.example/v1/", "Plan anual"), DiasMonitoreo: 45), 200);
        var texto = await conClave.ReadAsTextAsync();
        texto.ShouldNotContain("token-secreto-del-contrato");
        var configurado = JsonSerializer.Deserialize<FuentesOficialesConfigDto>(texto, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        configurado.DiasMonitoreo.ShouldBe(45);
        var contrato = configurado.Fuentes.Single(f => f.Fuente == "Rues").Proveedores.Single(p => p.Nombre == "Contrato");
        (contrato.CredencialesPropias, contrato.Usuario, contrato.UltimosCuatroClave, contrato.UrlBase, contrato.Notas, contrato.Disponible)
            .ShouldBe((true, "convenio-norte", "4321", "https://api.confecamaras.example/v1/", "Plan anual", false)); // la instalación no lo habilitó
        await using (var consulta = Store.QuerySession(e.TenantId.ToString("N")))
        {
            var guardada = (await consulta.LoadAsync<Validalo.Dominio.FuentesOficiales.FuentesOficialesEmpresa>(e.Empresa.Id))!.Credenciales["Rues:Contrato"].ClaveProtegida!;
            guardada.ShouldStartWith("vs2.");
            guardada.ShouldNotContain("token-secreto");
        }

        // Validaciones: proveedor que la instalación no habilitó, inválido, fuente inexistente, clave corta, URL no https y reconsulta fuera de rango.
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto([new EleccionDeProveedorDto("Rues", "DatosAbiertos")]), 422))).ShouldBe("proveedor-no-habilitado");
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto([new EleccionDeProveedorDto("Dian", "DatosAbiertos")]), 422))).ShouldBe("proveedor-invalido");
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto([new EleccionDeProveedorDto("Sunat", "Contrato")]), 422))).ShouldBe("fuente-oficial-invalida");
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto(Credenciales: new CredencialesFuenteDto("Dian", "Contrato", "u", "abc")), 422))).ShouldBe("clave-invalida");
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto(Credenciales: new CredencialesFuenteDto("Dian", "Contrato", "u", "clave-valida", "http://inseguro.example")), 422))).ShouldBe("url-invalida");
        (await CodigoAsync(await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e), new ActualizarFuentesOficialesDto(DiasMonitoreo: 400), 422)))
            .ShouldBe("monitoreo-invalido");

        // El simulado sigue siendo elegible (esta instalación lo permite) y quitar la elección vuelve al predeterminado; solo el administrador cambia esto.
        var elegido = await ApiAsync<FuentesOficialesConfigDto>("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e),
            new ActualizarFuentesOficialesDto([new EleccionDeProveedorDto("Dian", "simulado"), new EleccionDeProveedorDto("Rues", null)], DiasMonitoreo: 0), 200);
        elegido.Fuentes.Single(f => f.Fuente == "Dian").Proveedor.ShouldBe("Simulado");
        elegido.Fuentes.Single(f => f.Fuente == "Rues").Proveedor.ShouldBeNull();
        elegido.DiasMonitoreo.ShouldBe(0);
        await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Delegado(e, e.Laura), new ActualizarFuentesOficialesDto(DiasMonitoreo: 10), 403);

        var auditoria = await ApiAsync("GET", "/api/v1/auditoria?entidad=FuentesOficialesEmpresa", Admin(e), null, 200);
        var textoDeAuditoria = await auditoria.ReadAsTextAsync();
        textoDeAuditoria.ShouldNotContain("token-secreto");
        textoDeAuditoria.ShouldContain("convenio-norte");
    }

    [Fact]
    public async Task Plataforma_configura_las_cuentas_de_los_proveedores_cifradas_con_la_clave_maestra_y_la_empresa_solo_ve_que_existen()
    {
        var e = await PrepararAsync();
        var plataforma = new Credencial(ApiFixture.ClavePlataforma);
        const string url = "/api/v1/plataforma/fuentes-oficiales";

        var inicial = await ApiAsync<FuentesDePlataformaDto>("GET", url, plataforma, null, 200);
        inicial.Fuentes.Select(f => f.Fuente).ShouldBe(["Rues", "Dian"]);
        inicial.Fuentes.Single(f => f.Fuente == "Rues").Proveedores.Select(p => p.Nombre).ShouldBe(["DatosAbiertos", "Contrato"]);

        var conCuenta = await ApiAsync("PUT", url, plataforma, new ActualizarFuentesDePlataformaDto(
            new CredencialesFuenteDto("Dian", "Contrato", "convenio-dian", "clave-de-la-plataforma-7788", "https://api.proveedor-dian.example/", "Contrato 2026"),
            [new EleccionDeProveedorDto("Dian", "Contrato"), new EleccionDeProveedorDto("Rues", "DatosAbiertos")]), 200);
        var texto = await conCuenta.ReadAsTextAsync();
        texto.ShouldNotContain("clave-de-la-plataforma");
        var configurada = JsonSerializer.Deserialize<FuentesDePlataformaDto>(texto, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var dian = configurada.Fuentes.Single(f => f.Fuente == "Dian");
        dian.Predeterminado.ShouldBe("Contrato");
        var cuenta = dian.Proveedores.Single();
        (cuenta.Configurado, cuenta.Usuario, cuenta.UltimosCuatroClave, cuenta.UrlBase, cuenta.HabilitadoEnInstalacion).ShouldBe((true, "convenio-dian", "7788", "https://api.proveedor-dian.example/", false));
        configurada.ActualizadaPor.ShouldNotBeNullOrWhiteSpace();

        await using (var consulta = Store.QuerySession())
        {
            var guardada = (await consulta.LoadAsync<Validalo.Dominio.FuentesOficiales.FuentesOficialesDePlataforma>(Validalo.Dominio.FuentesOficiales.FuentesOficialesDePlataforma.IdUnico))!
                .Credenciales["Dian:Contrato"].ClaveProtegida!;
            guardada.ShouldStartWith("vs1.");
            guardada.ShouldNotContain("plataforma");
        }

        // La empresa ve que la plataforma tiene una cuenta (y el proveedor que le toca) sin usuario, clave ni URL; la instalación aún no lo habilita.
        var deLaEmpresa = await ApiAsync("GET", "/api/v1/configuracion/fuentes-oficiales", Admin(e), null, 200);
        var textoDeLaEmpresa = await deLaEmpresa.ReadAsTextAsync();
        textoDeLaEmpresa.ShouldNotContain("convenio-dian");
        textoDeLaEmpresa.ShouldNotContain("7788");
        var visto = JsonSerializer.Deserialize<FuentesOficialesConfigDto>(textoDeLaEmpresa, new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Fuentes.Single(f => f.Fuente == "Dian")
            .Proveedores.Single(p => p.Nombre == "Contrato");
        (visto.CredencialesPropias, visto.CredencialesDeLaPlataforma, visto.Usuario, visto.UltimosCuatroClave, visto.Disponible).ShouldBe((false, true, (string?)null, (string?)null, false));

        // Solo Plataforma; las validaciones son las de siempre; quitar la cuenta con la clave vacía.
        await ApiAsync("GET", url, Admin(e), null, 403);
        await ApiAsync("PUT", url, Admin(e), new ActualizarFuentesDePlataformaDto(), 403);
        (await CodigoAsync(await ApiAsync("PUT", url, plataforma, new ActualizarFuentesDePlataformaDto(new CredencialesFuenteDto("Dian", "DatosAbiertos", "u", "clave-valida")), 422)))
            .ShouldBe("proveedor-invalido");
        (await CodigoAsync(await ApiAsync("PUT", url, plataforma, new ActualizarFuentesDePlataformaDto(new CredencialesFuenteDto("Rues", "Simulado", "u", "clave-valida")), 422)))
            .ShouldBe("proveedor-invalido");
        await using (var auditoria = Store.QuerySession())
        {
            var registros = await auditoria.Query<Validalo.Dominio.Auditoria.RegistroDeCambioDeConfiguracion>()
                .Where(r => r.Entidad == "FuentesOficialesDePlataforma").ToListAsync();
            registros.Count.ShouldBeGreaterThanOrEqualTo(1);
            JsonSerializer.Serialize(registros).ShouldNotContain("clave-de-la-plataforma");
        }

        var quitada = await ApiAsync<FuentesDePlataformaDto>("PUT", url, plataforma, new ActualizarFuentesDePlataformaDto(new CredencialesFuenteDto("Dian", "Contrato", Clave: ""),
            [new EleccionDeProveedorDto("Dian", null), new EleccionDeProveedorDto("Rues", null)]), 200);
        quitada.Fuentes.Single(f => f.Fuente == "Dian").Proveedores.Single().Configurado.ShouldBeFalse();
        quitada.Fuentes.Single(f => f.Fuente == "Dian").Predeterminado.ShouldBeNull();
    }

    [Fact]
    public async Task La_reconsulta_periodica_de_vinculos_activos_es_opcional_solo_se_inicia_si_la_empresa_la_enciende_y_no_pierde_lo_anterior()
    {
        var e = await PrepararAsync();
        await ApiAsync("PUT", "/api/v1/configuracion/fuentes-oficiales", Admin(e), new ActualizarFuentesOficialesDto(DiasMonitoreo: 30), 200);
        await CrearFlujoConVerificacionesAsync(e, "CLIENTE", RuesRequerida, DianInformativa);
        var vinculo = await CrearVinculoConNombreAsync(e, "CLIENTE", "Aceros del Seguimiento S.A.S.");
        var abierto = await ApiAsync<ExpedienteDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/expedientes", Admin(e), new AbrirExpedienteDto(), 201);
        await EsperarExpedienteAsync(e, abierto.Id, x => x.Verificaciones!.All(v => v.Estado == "Satisfecha"));
        await AprobarAreasAsync(e, abierto.Id);

        var monitoreo = await ApiAsync<MonitoreoFuentesOficialesDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/monitoreo-fuentes-oficiales", Delegado(e, e.Carlos), null, 200);
        (monitoreo.FrecuenciaDias, monitoreo.ExpedienteId).ShouldBe((30, abierto.Id));
        monitoreo.Fuentes.Select(f => (f.Tipo, f.Estado, f.Bloqueante)).ShouldBe([("Rues", "Satisfecha", false), ("Dian", "Satisfecha", false)]);
        monitoreo.ProximaConsulta!.Value.ShouldBe(DateTimeOffset.UtcNow.AddDays(30), TimeSpan.FromMinutes(5));
        var anterior = monitoreo.Fuentes.Single(f => f.Tipo == "Rues").ReferenciaExterna;

        // Pasan 31 días (fecha simulada): el barrido reconsulta las dos fuentes; el resultado anterior queda con su evidencia.
        var plataforma = new Credencial(ApiFixture.ClavePlataforma);
        var barrido = await ApiAsync<ResultadoRevisionVerificacionesDto>("POST", "/api/v1/plataforma/verificaciones/revisar", plataforma,
            new RevisarVerificacionesDto(e.TenantId, DateTimeOffset.UtcNow.AddDays(31)), 200);
        barrido.MonitoreosOficiales.ShouldBe(1);
        var despues = await ApiAsync<MonitoreoFuentesOficialesDto>("GET", $"/api/v1/vinculos/{vinculo.Id}/monitoreo-fuentes-oficiales", Admin(e), null, 200);
        var rues = despues.Fuentes.Single(f => f.Tipo == "Rues");
        rues.ReferenciaExterna.ShouldNotBe(anterior);
        rues.Anteriores.ShouldHaveSingleItem().ReferenciaExterna.ShouldBe(anterior);
        despues.Fuentes.ShouldAllBe(f => f.Anteriores.Count == 1 && f.Estado == "Satisfecha");
        despues.ProximaConsulta!.Value.ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddDays(50));
        var descarga = await ApiAsync<DescargaEvidenciaDto>("POST", $"/api/v1/vinculos/{vinculo.Id}/monitoreo-fuentes-oficiales/Rues/evidencia/descarga", Admin(e), null, 200);
        descarga.NombreArchivo.ShouldContain("monitoreo");

        // Sin diferencias no hay nada que resolver ni fila en la bandeja; los permisos y el tipo se respetan.
        (await ApiAsync<List<FilaCumplimientoDto>>("GET", "/api/v1/cumplimiento/bandeja", Delegado(e, e.Carlos), null, 200)).ShouldBeEmpty();
        (await CodigoAsync(await ApiAsync("POST", $"/api/v1/vinculos/{vinculo.Id}/monitoreo-fuentes-oficiales/Rues/diferencias/{Guid.NewGuid()}/resolver", Delegado(e, e.Carlos),
            new ResolverCoincidenciaDto("Descartada", "x"), 404))).ShouldBe("diferencia-no-encontrada");
        await ApiAsync("POST", $"/api/v1/vinculos/{vinculo.Id}/monitoreo-fuentes-oficiales/Rues/diferencias/{Guid.NewGuid()}/resolver", Delegado(e, e.Laura),
            new ResolverCoincidenciaDto("Descartada", "x"), 403);

        // Con la reconsulta apagada (el valor por omisión) un vínculo aprobado no queda en monitoreo.
        var sinMonitoreo = await PrepararAsync();
        (await ApiAsync<FuentesOficialesConfigDto>("GET", "/api/v1/configuracion/fuentes-oficiales", Admin(sinMonitoreo), null, 200)).DiasMonitoreo.ShouldBe(0);
        var otro = await AbrirConFuentesAsync(sinMonitoreo, "Aceros Sin Seguimiento S.A.S.", RuesRequerida);
        await EsperarExpedienteAsync(sinMonitoreo, otro.Id, x => x.Verificaciones!.Single().Estado == "Satisfecha");
        await AprobarAreasAsync(sinMonitoreo, otro.Id);
        var otroVinculo = (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{otro.Id}", Admin(sinMonitoreo), null, 200)).VinculoId;
        (await CodigoAsync(await ApiAsync("GET", $"/api/v1/vinculos/{otroVinculo}/monitoreo-fuentes-oficiales", Admin(sinMonitoreo), null, 404))).ShouldBe("monitoreo-no-encontrado");
    }
}
