using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Configuration;
using Validalo.Aplicacion.FuentesOficiales;
using Validalo.Aplicacion.Verificaciones;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Expedientes;
using Validalo.Dominio.FuentesOficiales;
using Validalo.Infraestructura.FuentesOficiales;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Adaptadores de las fuentes oficiales (FO-2, FO-3) con HTTP simulado: un manejador de guion hace de datos.gov.co o de la API contratada, y no se llama a
/// nadie. Cubre el mapeo de las respuestas, la elección de la matrícula, los reintentos transitorios, el cortacircuito, la resolución del proveedor de
/// cada empresa (sandbox, credenciales de la empresa sobre las de la plataforma) y el simulado determinista.
/// </summary>
public sealed class FuentesOficialesAdaptadoresTests
{
    private sealed class ManejadorDeGuion(Func<HttpRequestMessage, HttpResponseMessage> responder) : HttpMessageHandler
    {
        public List<(HttpMethod Metodo, Uri Uri, AuthenticationHeaderValue? Autorizacion, IReadOnlyDictionary<string, string> Encabezados)> Peticiones { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage peticion, CancellationToken ct)
        {
            Peticiones.Add((peticion.Method, peticion.RequestUri!, peticion.Headers.Authorization,
                peticion.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase)));
            return Task.FromResult(responder(peticion));
        }
    }

    private sealed class FabricaDeClientes(HttpMessageHandler manejador) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(manejador, disposeHandler: false);
    }

    private static HttpResponseMessage Json(string json, HttpStatusCode estado = HttpStatusCode.OK) =>
        new(estado) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static OpcionesDeFuentesOficiales Opciones(Dictionary<string, string?>? valores = null) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(valores ?? []).Build());

    private static OpcionesDeFuente DeProveedor(TipoVerificacion fuente, string proveedor, Dictionary<string, string?>? extra = null)
    {
        var valores = new Dictionary<string, string?>
        {
            [$"Validalo:Verificadores:FuentesOficiales:{fuente}:Proveedores:{proveedor}:Habilitado"] = "true",
            [$"Validalo:Verificadores:FuentesOficiales:{fuente}:Proveedores:{proveedor}:EsperaEntreReintentosMs"] = "0",
            ["Validalo:Verificadores:FuentesOficiales:PermitirSimulado"] = "true"
        };
        foreach (var (clave, valor) in extra ?? [])
            valores[$"Validalo:Verificadores:FuentesOficiales:{fuente}:Proveedores:{proveedor}:{clave}"] = valor;
        return Opciones(valores).Proveedor(fuente, proveedor);
    }

    private static SolicitudOficial Solicitud(TipoVerificacion fuente, OpcionesDeFuente opciones, CredencialesOficialesEnClaro? credenciales = null, string numero = "900123456",
        string nombre = "Aceros del Norte S.A.S.") =>
        new(Guid.NewGuid(), fuente, "CO", "NIT", numero, "7", nombre, credenciales, opciones);

    // ---------- RUES · datos abiertos ----------

    private const string FilaActiva = """
        { "codigo_camara": "04", "camara_comercio": "BOGOTA", "matricula": "1291197", "razon_social": "ACEROS DEL NORTE S A", "numero_identificacion": "900123456",
          "nit": "900123456", "digito_verificacion": "7", "cod_ciiu_act_econ_pri": "2410", "fecha_matricula": "20030718", "fecha_renovacion": "20260330",
          "ultimo_ano_renovado": "2026", "fecha_vigencia": "21030707", "organizacion_juridica": "SOCIEDAD ANONIMA",
          "categoria_matricula": "SOCIEDAD ó PERSONA JURIDICA PRINCIPAL ó ESAL", "estado_matricula": "ACTIVA", "clase_identificacion_rl": "CEDULA DE CIUDADANIA",
          "num_identificacion_representante_legal": "1020304050", "representante_legal": "ANA MARIA PEREZ", "fecha_actualizacion": "2026/10/16 17:35:14.227000000" }
        """;

    [Fact]
    public async Task Los_datos_abiertos_se_consultan_por_nit_con_el_token_de_la_aplicacion_y_se_mapean_al_modelo_normalizado()
    {
        var manejador = new ManejadorDeGuion(_ => Json($"[{FilaActiva}]"));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos"),
            new CredencialesOficialesEnClaro(null, "token-de-datos-gov", null)), CancellationToken.None);

        var peticion = manejador.Peticiones.ShouldHaveSingleItem();
        peticion.Metodo.ShouldBe(HttpMethod.Get);
        peticion.Uri.Host.ShouldBe("www.datos.gov.co");
        peticion.Uri.AbsolutePath.ShouldBe("/resource/c82u-588k.json");
        Uri.UnescapeDataString(peticion.Uri.Query).ShouldBe("?$where=nit='900123456' OR numero_identificacion='900123456'&$limit=20");
        peticion.Encabezados["X-App-Token"].ShouldBe("token-de-datos-gov");
        peticion.Autorizacion.ShouldBeNull();

        var d = respuesta.Datos;
        (d.Encontrado, d.Nit, d.Dv, d.RazonSocial, d.Estado, d.EstadoNormalizado).ShouldBe((true, "900123456", "7", "ACEROS DEL NORTE S A", "ACTIVA", EstadoOficial.Vigente));
        (d.Matricula, d.Camara, d.TipoOrganizacion, d.UltimoAnoRenovado, d.ActividadPrincipal).ShouldBe(("1291197", "BOGOTA", "SOCIEDAD ANONIMA", 2026, "2410"));
        (d.FechaMatricula, d.FechaRenovacion, d.FechaCancelacion, d.ActualizadoEnLaFuente).ShouldBe(
            (new DateOnly(2003, 7, 18), new DateOnly(2026, 3, 30), null, new DateOnly(2026, 10, 16)));
        d.Representantes.ShouldHaveSingleItem().ShouldBe(new RepresentanteOficial("ANA MARIA PEREZ", "1020304050", "Representante legal"));
        respuesta.RespuestaCruda.ShouldContain("1291197");
        respuesta.Criterio.ShouldContain("cada mes");
    }

    [Fact]
    public async Task Sin_token_no_se_manda_el_encabezado_y_una_URL_propia_manda_sobre_la_de_la_instalacion()
    {
        var manejador = new ManejadorDeGuion(_ => Json("[]"));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos"),
            new CredencialesOficialesEnClaro(null, null, "https://espejo.datos.example/")), CancellationToken.None);

        var peticion = manejador.Peticiones.ShouldHaveSingleItem();
        peticion.Uri.Host.ShouldBe("espejo.datos.example");
        peticion.Encabezados.ShouldNotContainKey("X-App-Token");
        respuesta.Datos.Encontrado.ShouldBeFalse();
    }

    [Fact]
    public async Task Con_varias_matriculas_se_toma_la_principal_activa_y_la_renovada_mas_recientemente()
    {
        var filas = $$"""
            [
              { "matricula": "1", "razon_social": "VIEJA", "nit": "900123456", "categoria_matricula": "SUCURSAL", "estado_matricula": "ACTIVA", "ultimo_ano_renovado": "2026" },
              { "matricula": "2", "razon_social": "CANCELADA", "nit": "900123456", "categoria_matricula": "SOCIEDAD ó PERSONA JURIDICA PRINCIPAL ó ESAL", "estado_matricula": "CANCELADA", "ultimo_ano_renovado": "2019" },
              {{FilaActiva}},
              { "matricula": "3", "razon_social": "OTRA ACTIVA", "nit": "900123456", "categoria_matricula": "SOCIEDAD ó PERSONA JURIDICA PRINCIPAL ó ESAL", "estado_matricula": "ACTIVA", "ultimo_ano_renovado": "2024" }
            ]
            """;
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorDeGuion(_ => Json(filas))));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos")), CancellationToken.None);

        respuesta.Datos.Matricula.ShouldBe("1291197");
    }

    [Fact]
    public async Task Una_matricula_cancelada_trae_su_fecha_y_queda_no_vigente()
    {
        const string fila = """{ "matricula": "9", "razon_social": "X", "nit": "900123456", "estado_matricula": "CANCELADA", "fecha_cancelacion": "20111229", "ultimo_ano_renovado": "0" }""";
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorDeGuion(_ => Json($"[{fila}]"))));

        var d = (await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos")), CancellationToken.None)).Datos;

        (d.EstadoNormalizado, d.FechaCancelacion, d.UltimoAnoRenovado).ShouldBe((EstadoOficial.NoVigente, new DateOnly(2011, 12, 29), 0));
    }

    [Theory]
    [InlineData("12")]
    [InlineData("")]
    [InlineData("ABC")]
    [InlineData("1234567890123456")]
    public async Task Un_numero_que_no_es_de_3_a_15_digitos_no_sale_a_la_red_y_queda_no_encontrado(string numero)
    {
        var manejador = new ManejadorDeGuion(_ => Json("[]"));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos"), numero: numero), CancellationToken.None);

        manejador.Peticiones.ShouldBeEmpty();
        respuesta.Datos.Encontrado.ShouldBeFalse();
    }

    [Fact]
    public async Task El_filtro_solo_lleva_digitos_nada_del_tercero_se_arma_como_texto_libre()
    {
        var manejador = new ManejadorDeGuion(_ => Json("[]"));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));

        await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos"), numero: "900.123.456' OR '1'='1"), CancellationToken.None);

        Uri.UnescapeDataString(manejador.Peticiones.Single().Uri.Query).ShouldContain("nit='90012345611' OR");
        Uri.UnescapeDataString(manejador.Peticiones.Single().Uri.Query).ShouldNotContain("'1'='1");
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, "límite")]
    [InlineData(HttpStatusCode.Unauthorized, "token")]
    [InlineData(HttpStatusCode.NotFound, "HTTP 404")]
    [InlineData(HttpStatusCode.InternalServerError, "HTTP 500")]
    public async Task Un_fallo_de_la_fuente_es_no_disponible_y_nunca_un_resultado(HttpStatusCode estado, string texto)
    {
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorDeGuion(_ => Json("{}", estado))));

        var error = await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
            fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos")), CancellationToken.None));

        error.Message.ShouldContain(texto);
    }

    [Theory]
    [InlineData("esto no es json")]
    [InlineData("""{ "error": "x" }""")]
    public async Task Una_respuesta_que_no_es_una_lista_json_es_no_disponible(string texto)
    {
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorDeGuion(_ => Json(texto))));

        await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
            fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos")), CancellationToken.None));
    }

    [Fact]
    public async Task Los_fallos_transitorios_se_reintentan_en_el_acto_y_al_agotarse_la_fuente_no_esta_disponible()
    {
        var llamadas = 0;
        var manejador = new ManejadorDeGuion(_ => ++llamadas < 3 ? Json("{}", HttpStatusCode.ServiceUnavailable) : Json($"[{FilaActiva}]"));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos")), CancellationToken.None);
        respuesta.Datos.Encontrado.ShouldBeTrue();
        manejador.Peticiones.Count.ShouldBe(3); // 2 reintentos por omisión

        var siempreCaida = new ManejadorDeGuion(_ => Json("{}", HttpStatusCode.BadGateway));
        var error = await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() => new ConsultaRuesDatosAbiertos(new FabricaDeClientes(siempreCaida))
            .ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos", new() { ["Reintentos"] = "1" })), CancellationToken.None));
        error.Message.ShouldContain("HTTP 502");
        siempreCaida.Peticiones.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Un_error_de_red_se_reintenta_y_luego_es_no_disponible()
    {
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorQueFalla()));

        var error = await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
            fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "DatosAbiertos", new() { ["Reintentos"] = "1" })), CancellationToken.None));

        error.Message.ShouldContain("no respondió");
    }

    private sealed class ManejadorQueFalla : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            throw new HttpRequestException("sin red");
    }

    // ---------- Fuente por contrato (RUES completo o DIAN) ----------

    private static readonly CredencialesOficialesEnClaro Contrato = new("convenio", "clave-del-contrato", "https://api.proveedor.example/v2");

    [Fact]
    public async Task El_contrato_se_consulta_con_la_ruta_los_parametros_y_la_autenticacion_de_la_configuracion()
    {
        var manejador = new ManejadorDeGuion(_ => Json("""{ "estado": "REGISTRO ACTIVO" , "razonSocial": "ACEROS DEL NORTE SAS" }"""));
        var fuente = new ConsultaPorContrato(TipoVerificacion.Dian, new FabricaDeClientes(manejador));

        await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Dian, DeProveedor(TipoVerificacion.Dian, "Contrato",
            new() { ["Ruta"] = "rut/estado", ["ParametroNit"] = "identificacion", ["ParametroTipoDocumento"] = "tipo", ["ParametrosFijos"] = "category=RM" }), Contrato), CancellationToken.None);

        var peticion = manejador.Peticiones.ShouldHaveSingleItem();
        peticion.Uri.AbsoluteUri.ShouldBe("https://api.proveedor.example/v2/rut/estado?identificacion=900123456&tipo=NIT&category=RM");
        (peticion.Autorizacion!.Scheme, peticion.Autorizacion.Parameter).ShouldBe(("Bearer", "clave-del-contrato"));
    }

    [Fact]
    public async Task El_contrato_puede_autenticar_con_Basic_o_con_un_encabezado()
    {
        var basic = new ManejadorDeGuion(_ => Json("""{ "estado": "ACTIVA" }"""));
        await new ConsultaPorContrato(TipoVerificacion.Rues, new FabricaDeClientes(basic)).ConsultarAsync(
            Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "Contrato", new() { ["Autenticacion"] = "Basic" }), Contrato), CancellationToken.None);
        Encoding.UTF8.GetString(Convert.FromBase64String(basic.Peticiones.Single().Autorizacion!.Parameter!)).ShouldBe("convenio:clave-del-contrato");

        var encabezado = new ManejadorDeGuion(_ => Json("""{ "estado": "ACTIVA" }"""));
        await new ConsultaPorContrato(TipoVerificacion.Rues, new FabricaDeClientes(encabezado)).ConsultarAsync(
            Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "Contrato", new() { ["Autenticacion"] = "Encabezado", ["Encabezado"] = "X-Clave-Rues" }), Contrato),
            CancellationToken.None);
        encabezado.Peticiones.Single().Encabezados["X-Clave-Rues"].ShouldBe("clave-del-contrato");
        encabezado.Peticiones.Single().Autorizacion.ShouldBeNull();
    }

    [Fact]
    public async Task El_contrato_sin_credenciales_o_sin_url_no_llama_a_nadie()
    {
        var manejador = new ManejadorDeGuion(_ => Json("{}"));
        var fuente = new ConsultaPorContrato(TipoVerificacion.Rues, new FabricaDeClientes(manejador));
        var opciones = DeProveedor(TipoVerificacion.Rues, "Contrato");

        await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() => fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, opciones), CancellationToken.None));
        await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() => fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, opciones, new CredencialesOficialesEnClaro("u", "clave", null)),
            CancellationToken.None));
        manejador.Peticiones.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "rechazó las credenciales")]
    [InlineData(HttpStatusCode.Forbidden, "rechazó las credenciales")]
    [InlineData(HttpStatusCode.TooManyRequests, "límite")]
    [InlineData(HttpStatusCode.BadRequest, "HTTP 400")]
    public async Task El_contrato_distingue_credenciales_limite_y_otros_fallos(HttpStatusCode estado, string texto)
    {
        var fuente = new ConsultaPorContrato(TipoVerificacion.Dian, new FabricaDeClientes(new ManejadorDeGuion(_ => Json("{}", estado))));

        var error = await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
            fuente.ConsultarAsync(Solicitud(TipoVerificacion.Dian, DeProveedor(TipoVerificacion.Dian, "Contrato"), Contrato), CancellationToken.None));

        error.Message.ShouldContain(texto);
    }

    [Fact]
    public async Task El_contrato_con_404_es_no_encontrado_no_un_fallo()
    {
        var fuente = new ConsultaPorContrato(TipoVerificacion.Rues, new FabricaDeClientes(new ManejadorDeGuion(_ => Json("""{ "error": "NotFound" }""", HttpStatusCode.NotFound))));

        var respuesta = await fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "Contrato"), Contrato), CancellationToken.None);

        respuesta.Datos.Encontrado.ShouldBeFalse();
    }

    [Fact]
    public void El_lector_tolerante_entiende_una_respuesta_estilo_rues_con_los_nombres_en_ingles_y_el_registro_anidado()
    {
        const string json = """
            { "data": { "commercialRegistry": { "businessName": "ACEROS DEL NORTE SAS", "NIT": "900123456", "registrationStatus": "ACTIVA", "lastRenewedYear": 2026,
                "renewalDate": "2026-03-28", "chamberCommerce": "BOGOTA", "registrationNumber": "0123456",
                "legalRepresentatives": [ { "name": "ANA PEREZ", "documentNumber": "1020304050", "role": "Principal" }, { "name": "" } ],
                "commercialAddress": "CL 1 2 3" } } }
            """;

        var d = LectorDeRespuestaOficial.Leer(json, TipoVerificacion.Rues);

        (d.Encontrado, d.RazonSocial, d.Nit, d.EstadoNormalizado, d.UltimoAnoRenovado, d.Camara, d.Matricula, d.Direccion).ShouldBe(
            (true, "ACEROS DEL NORTE SAS", "900123456", EstadoOficial.Vigente, 2026, "BOGOTA", "0123456", "CL 1 2 3"));
        d.FechaRenovacion.ShouldBe(new DateOnly(2026, 3, 28));
        d.Representantes.ShouldHaveSingleItem().ShouldBe(new RepresentanteOficial("ANA PEREZ", "1020304050", "Principal"));
    }

    [Fact]
    public void El_lector_tolerante_entiende_una_respuesta_estilo_dian_y_el_ano_sale_de_la_fecha_si_no_viene()
    {
        const string json = """
            [ { "estadoRut": "SUSPENDIDO", "razon_social": "ACEROS DEL NORTE SAS", "nit": 900123456, "dv": 7, "direccion": "KR 10 20 30", "codigoMunicipio": "05001",
                "responsabilidades": [ "05", { "codigo": "48" }, 7 ], "actividadEconomicaPrincipal": "2410", "fechaRenovacion": "20260328" } ]
            """;

        var d = LectorDeRespuestaOficial.Leer(json, TipoVerificacion.Dian);

        (d.EstadoNormalizado, d.Nit, d.Dv, d.Municipio, d.UltimoAnoRenovado, d.Matricula).ShouldBe((EstadoOficial.NoVigente, "900123456", "7", "05001", 2026, null));
        d.Responsabilidades.ShouldBe(["05", "48", "7"]);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("""{ "data": [] }""")]
    [InlineData("""{ "mensaje": "sin datos" }""")]
    [InlineData("42")]
    public void Un_registro_sin_razon_social_ni_estado_es_no_encontrado_y_no_se_inventa_nada(string json)
    {
        LectorDeRespuestaOficial.Leer(json, TipoVerificacion.Rues).Encontrado.ShouldBeFalse();
    }

    // ---------- Simulado ----------

    private static FuenteOficialSimulada Simulada(TipoVerificacion fuente) => new(fuente, new RelojFijo(new DateTimeOffset(2026, 11, 10, 12, 0, 0, TimeSpan.Zero)));

    private sealed class RelojFijo(DateTimeOffset ahora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => ahora;
    }

    [Fact]
    public async Task El_simulado_devuelve_lo_declarado_conforme_para_los_dos_proveedores()
    {
        var rues = (await Simulada(TipoVerificacion.Rues).ConsultarAsync(Solicitud(TipoVerificacion.Rues, DeProveedor(TipoVerificacion.Rues, "Simulado")), CancellationToken.None)).Datos;
        (rues.Encontrado, rues.RazonSocial, rues.EstadoNormalizado, rues.UltimoAnoRenovado, rues.Representantes.Count).ShouldBe((true, "ACEROS DEL NORTE S.A.S.", EstadoOficial.Vigente, 2026, 0));

        var dian = (await Simulada(TipoVerificacion.Dian).ConsultarAsync(Solicitud(TipoVerificacion.Dian, DeProveedor(TipoVerificacion.Dian, "Simulado")), CancellationToken.None)).Datos;
        (dian.Estado, dian.EstadoNormalizado, dian.Matricula, dian.Direccion).ShouldBe(("REGISTRO ACTIVO", EstadoOficial.Vigente, null, null));
    }

    [Theory]
    [InlineData(TipoVerificacion.Rues, "Aceros Cancelada S.A.S.", "CANCELADA")]
    [InlineData(TipoVerificacion.Dian, "Aceros Suspendido S.A.S.", "SUSPENDIDO")]
    [InlineData(TipoVerificacion.Dian, "Aceros Cancelada S.A.S.", "CANCELADO")]
    public async Task El_simulado_cambia_el_estado_segun_el_nombre_de_prueba(TipoVerificacion fuente, string nombre, string estado)
    {
        var datos = (await Simulada(fuente).ConsultarAsync(Solicitud(fuente, DeProveedor(fuente, "Simulado"), nombre: nombre), CancellationToken.None)).Datos;

        (datos.Estado, datos.EstadoNormalizado).ShouldBe((estado, EstadoOficial.NoVigente));
    }

    [Fact]
    public async Task El_simulado_tiene_palabras_de_prueba_para_cada_diferencia_y_para_el_fallo()
    {
        async Task<DatosOficiales> Datos(TipoVerificacion fuente, string nombre) =>
            (await Simulada(fuente).ConsultarAsync(Solicitud(fuente, DeProveedor(fuente, "Simulado"), nombre: nombre), CancellationToken.None)).Datos;

        (await Datos(TipoVerificacion.Rues, "Aceros Sin Renovar")).UltimoAnoRenovado.ShouldBe(2024);
        (await Datos(TipoVerificacion.Rues, "Aceros OtraNombre")).RazonSocial.ShouldBe("EMPRESA DISTINTA S.A.S.");
        (await Datos(TipoVerificacion.Rues, "Aceros Otro Representante")).Representantes.ShouldHaveSingleItem().Nombre.ShouldBe("Persona Distinta");
        (await Datos(TipoVerificacion.Dian, "Aceros Otra Dirección")).Direccion.ShouldBe("CL 1 2 3 OTRA");
        (await Datos(TipoVerificacion.Rues, "Aceros No Registrados")).Encontrado.ShouldBeFalse();

        var caida = await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() => Datos(TipoVerificacion.Dian, "Aceros Caída S.A.S."));
        caida.Message.ShouldContain("no responde");
    }

    // ---------- Cortacircuito (el mismo de las listas, por empresa y proveedor) ----------

    [Fact]
    public async Task Tras_varios_fallos_seguidos_se_corta_la_fuente_de_esa_empresa_sin_llamar_y_las_demas_siguen()
    {
        var manejador = new ManejadorDeGuion(_ => Json("{}", HttpStatusCode.TooManyRequests));
        var fuente = new ConsultaRuesDatosAbiertos(new FabricaDeClientes(manejador));
        var opciones = DeProveedor(TipoVerificacion.Rues, "DatosAbiertos", new() { ["FallosParaAbrir"] = "2", ["SegundosAbierto"] = "600" });
        var control = new ControlDeProveedores(TimeProvider.System);
        var vencida = Guid.NewGuid();
        var sana = Guid.NewGuid();

        for (var n = 0; n < 2; n++)
            await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
                control.EjecutarAsync(vencida, opciones.ParaElControl(), t => fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, opciones), t), CancellationToken.None));
        var antes = manejador.Peticiones.Count;

        var corte = await Should.ThrowAsync<ProveedorDeListasNoDisponibleException>(() =>
            control.EjecutarAsync(vencida, opciones.ParaElControl(), t => fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, opciones), t), CancellationToken.None));
        corte.Message.ShouldContain("falló varias veces seguidas");
        manejador.Peticiones.Count.ShouldBe(antes);

        // Otra empresa con el mismo proveedor sigue llamando (y aquí vuelve a fallar por el 429, pero llama).
        await Should.ThrowAsync<FuenteOficialNoDisponibleException>(() =>
            control.EjecutarAsync(sana, opciones.ParaElControl(), t => fuente.ConsultarAsync(Solicitud(TipoVerificacion.Rues, opciones), t), CancellationToken.None));
        manejador.Peticiones.Count.ShouldBe(antes + 1);
        // La fuente de la DIAN lleva otro cortacircuito aunque sea de la misma empresa.
        control.Estado(vencida, ProveedoresDeFuentes.Clave(TipoVerificacion.Rues, "DatosAbiertos")).AbiertoHasta.ShouldNotBeNull();
        control.Estado(vencida, ProveedoresDeFuentes.Clave(TipoVerificacion.Dian, "Contrato")).AbiertoHasta.ShouldBeNull();
    }

    // ---------- Resolución del proveedor de la empresa ----------

    private static ConsultaDeFuentesOficiales Consulta(Dictionary<string, string?>? valores = null)
    {
        var opciones = Opciones(valores);
        IFuenteOficial[] adaptadores =
        [
            new ConsultaRuesDatosAbiertos(new FabricaDeClientes(new ManejadorDeGuion(_ => Json("[]")))),
            new ConsultaPorContrato(TipoVerificacion.Rues, new FabricaDeClientes(new ManejadorDeGuion(_ => Json("{}")))),
            new ConsultaPorContrato(TipoVerificacion.Dian, new FabricaDeClientes(new ManejadorDeGuion(_ => Json("{}")))),
            Simulada(TipoVerificacion.Rues), Simulada(TipoVerificacion.Dian)
        ];
        // El almacén, el protector, el repositorio y el entorno no se tocan al resolver el proveedor.
        return new ConsultaDeFuentesOficiales(adaptadores, opciones, new ControlDeProveedores(TimeProvider.System), null!, null!, null!, null!, TimeProvider.System);
    }

    private static Dictionary<string, string?> Habilitados(params string[] claves) =>
        claves.ToDictionary(c => $"Validalo:Verificadores:FuentesOficiales:{c.Split(':')[0]}:Proveedores:{c.Split(':')[1]}:Habilitado", _ => (string?)"true");

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    private static CredencialesDeFuenteOficial ConClave(string usuario = "u") => new() { Usuario = usuario, ClaveProtegida = "cifrada", UltimosCuatroClave = "1234" };

    [Fact]
    public void El_proveedor_sale_de_la_empresa_luego_de_la_plataforma_luego_de_la_instalacion_y_sin_ninguno_no_hay_consulta()
    {
        var consulta = Consulta(Habilitados("Rues:DatosAbiertos", "Rues:Contrato").Concat(new Dictionary<string, string?>
        {
            ["Validalo:Verificadores:FuentesOficiales:Rues:ProveedorPorDefecto"] = "DatosAbiertos"
        }).ToDictionary());
        var plataforma = new FuentesOficialesDePlataforma { Credenciales = { ["Rues:Contrato"] = ConClave("plataforma") }, Predeterminados = { ["Rues"] = "Contrato" } };
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());

        consulta.Resolver(TipoVerificacion.Rues, null, null).Nombre.ShouldBe("DatosAbiertos"); // la instalación
        consulta.Resolver(TipoVerificacion.Rues, empresa, plataforma).Nombre.ShouldBe("Contrato"); // el predeterminado de la plataforma
        empresa.ElegirProveedor("Rues", "DatosAbiertos", DateTimeOffset.UtcNow);
        consulta.Resolver(TipoVerificacion.Rues, empresa, plataforma).Nombre.ShouldBe("DatosAbiertos"); // la elección de la empresa

        Codigo(() => consulta.Resolver(TipoVerificacion.Dian, empresa, plataforma)).ShouldBe("verificacion-no-disponible");
    }

    [Fact]
    public void Un_proveedor_que_la_instalacion_no_habilito_o_sin_credenciales_de_contrato_no_se_resuelve()
    {
        var consulta = Consulta(Habilitados("Dian:Contrato"));
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());
        empresa.ElegirProveedor("Rues", "DatosAbiertos", DateTimeOffset.UtcNow);
        empresa.ElegirProveedor("Dian", "Contrato", DateTimeOffset.UtcNow);

        Should.Throw<ReglaDeNegocioException>(() => consulta.Resolver(TipoVerificacion.Rues, empresa, null)).Message.ShouldContain("no está habilitado");
        Should.Throw<ReglaDeNegocioException>(() => consulta.Resolver(TipoVerificacion.Dian, empresa, null)).Message.ShouldContain("no tiene credenciales");
        consulta.Efectivo(TipoVerificacion.Dian, empresa, null).ShouldBeNull();
        consulta.Efectivo(TipoVerificacion.Dian, empresa, new FuentesOficialesDePlataforma { Credenciales = { ["Dian:Contrato"] = ConClave() } }).ShouldBe("Contrato");
    }

    [Fact]
    public void Las_credenciales_de_la_empresa_mandan_sobre_las_de_la_plataforma_y_los_datos_abiertos_no_las_exigen()
    {
        var consulta = Consulta(Habilitados("Rues:DatosAbiertos", "Rues:Contrato"));
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());
        empresa.ElegirProveedor("Rues", "Contrato", DateTimeOffset.UtcNow);
        var plataforma = new FuentesOficialesDePlataforma { Credenciales = { ["Rues:Contrato"] = ConClave("plataforma") } };

        var deLaPlataforma = consulta.Resolver(TipoVerificacion.Rues, empresa, plataforma);
        (deLaPlataforma.CuentaDeLaPlataforma, deLaPlataforma.Credenciales!.Usuario).ShouldBe((true, "plataforma"));

        empresa.Credenciales["Rues:Contrato"] = ConClave("empresa");
        var propias = consulta.Resolver(TipoVerificacion.Rues, empresa, plataforma);
        (propias.CuentaDeLaPlataforma, propias.Credenciales!.Usuario).ShouldBe((false, "empresa"));

        empresa.ElegirProveedor("Rues", "DatosAbiertos", DateTimeOffset.UtcNow);
        consulta.Resolver(TipoVerificacion.Rues, empresa, null).Credenciales.ShouldBeNull();
    }

    [Fact]
    public void En_el_sandbox_siempre_el_simulado_aunque_la_instalacion_no_lo_permita_y_nunca_el_real()
    {
        var consulta = Consulta(Habilitados("Rues:DatosAbiertos"));
        var empresa = FuentesOficialesEmpresa.Nueva(Guid.NewGuid());
        empresa.ElegirProveedor("Rues", "DatosAbiertos", DateTimeOffset.UtcNow);

        var resuelto = consulta.Resolver(TipoVerificacion.Rues, empresa, null, sandbox: true);

        resuelto.Nombre.ShouldBe(ProveedoresDeFuentes.Simulado);
        resuelto.Adaptador.ShouldBeOfType<FuenteOficialSimulada>();
        // Fuera del sandbox, con el simulado sin permitir, no se resuelve.
        empresa.ElegirProveedor("Rues", "Simulado", DateTimeOffset.UtcNow);
        Codigo(() => consulta.Resolver(TipoVerificacion.Rues, empresa, null)).ShouldBe("verificacion-no-disponible");
    }
}
