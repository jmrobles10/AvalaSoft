using System.IO.Compression;
using System.Security;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Alba;
using Microsoft.AspNetCore.Http;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Invitaciones;
using Avalasoft.Dominio.Vinculos;

namespace Avalasoft.Integracion.Tests;

/// <summary>
/// Invitar a un tercero a mano (decisión IM) con PostgreSQL y la mensajería real: <c>POST /invitaciones</c> hace exactamente lo que una fila del lote (crea o reutiliza el tercero, crea el
/// vínculo e invita; reenvía si el vínculo aún no acepta; no toca nada si ya aceptó; no invita a un vínculo bloqueado) con la validación por campo de la vista previa, la aprobación
/// previa a invitar y la idempotencia; y la plantilla Excel de la empresa ofrece sus tipos de vínculo activos y sus flujos publicados, y se importa sin cambios.
/// </summary>
public sealed partial class RequisitosApiTests
{
    private static readonly XNamespace HojaXml = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    /// <summary>El texto de cada celda de una hoja del libro, por referencia («A2» → «Proveedor (PROVEEDOR)»).</summary>
    private static Dictionary<string, string> CeldasDe(byte[] libro, string hoja)
    {
        using var zip = new ZipArchive(new MemoryStream(libro), ZipArchiveMode.Read);
        using var flujo = zip.GetEntry($"xl/worksheets/{hoja}.xml")!.Open();
        return XDocument.Load(flujo).Descendants(HojaXml + "c").ToDictionary(c => c.Attribute("r")!.Value, c => string.Concat(c.Descendants(HojaXml + "t").Select(t => t.Value)));
    }

    /// <summary>Los valores de una columna de la hoja oculta «Listas» (sin el encabezado), en orden.</summary>
    private static List<string> ColumnaDeListas(byte[] libro, string columna) =>
        [.. CeldasDe(libro, "sheet3").Where(c => c.Key.StartsWith(columna, StringComparison.Ordinal) && c.Key != $"{columna}1" && c.Value.Length > 0)
            .OrderBy(c => int.Parse(c.Key[columna.Length..], System.Globalization.CultureInfo.InvariantCulture)).Select(c => c.Value)];

    /// <summary>Agrega filas debajo del encabezado de la hoja de datos, como las dejaría quien llena la plantilla en Excel.</summary>
    private static byte[] LlenarPlantilla(byte[] plantilla, params string?[][] filas)
    {
        using var memoria = new MemoryStream();
        memoria.Write(plantilla);
        using (var zip = new ZipArchive(memoria, ZipArchiveMode.Update, leaveOpen: true))
        {
            var entrada = zip.GetEntry("xl/worksheets/sheet1.xml")!;
            string xml;
            using (var lector = new StreamReader(entrada.Open(), Encoding.UTF8))
                xml = lector.ReadToEnd();
            entrada.Delete();

            var nuevas = new StringBuilder();
            for (var i = 0; i < filas.Length; i++)
            {
                nuevas.Append($"<row r=\"{i + 2}\">");
                for (var j = 0; j < filas[i].Length; j++)
                    if (filas[i][j] is { } valor)
                        nuevas.Append($"<c r=\"{HojaDeCalculo.Columna(j)}{i + 2}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{SecurityElement.Escape(valor)}</t></is></c>");
                nuevas.Append("</row>");
            }

            using var escritor = new StreamWriter(zip.CreateEntry("xl/worksheets/sheet1.xml").Open(), new UTF8Encoding(false));
            escritor.Write(xml.Replace("</sheetData>", $"{nuevas}</sheetData>", StringComparison.Ordinal));
        }

        return memoria.ToArray();
    }

    private static InvitarTerceroDto InvitacionDe(string nit, string correo, string tipo = "PROVEEDOR", string? flujo = null) =>
        new(TipoIdentificacion: "NIT", NumeroIdentificacion: nit, Nombre: "Aceros del Norte S.A.S.", NombreComercial: "Aceros", Correo: correo, TipoVinculo: tipo, Flujo: flujo,
            Contacto: "Laura Gómez", Telefono: "3001234567");

    /// <summary>El POST con la clave de idempotencia que se le diga (<c>null</c> = sin cabecera).</summary>
    private Task<IScenarioResult> InvitarConClaveAsync(Empresa empresa, InvitarTerceroDto dto, string? clave, int esperado) =>
        Host.Scenario(s =>
        {
            s.Post.Json(dto).ToUrl("/api/v1/invitaciones");
            s.WithRequestHeader("X-Api-Key", empresa.Admin);
            s.WithRequestHeader("X-Empresa", empresa.Datos.Id.ToString());
            if (clave is not null)
                s.WithRequestHeader("Idempotency-Key", clave);
            s.StatusCodeShouldBe(esperado);
        });

    [Fact]
    public async Task La_plantilla_ofrece_los_tipos_de_vinculo_activos_y_los_flujos_publicados_de_la_empresa_y_se_importa_sin_cambios()
    {
        var e = await PrepararAsync();
        var admin = new Credencial(e.Norte.Admin);
        await ApiAsync<TipoVinculoDto>("POST", "/api/v1/tipos-vinculo", admin, new CrearTipoVinculoDto("CONTRATISTA", "Contratista de obra", null, false), 201);
        var obsoleto = await ApiAsync<TipoVinculoDto>("POST", "/api/v1/tipos-vinculo", admin, new CrearTipoVinculoDto("OBSOLETO", "Tipo obsoleto", null, false), 201);
        await Host.Scenario(s =>
        {
            s.Put.Json(new CrearTipoVinculoDto("OBSOLETO", "Tipo obsoleto", null, false)).ToUrl($"/api/v1/tipos-vinculo/{obsoleto.Id}");
            s.ConfigureHttpContext(c => c.Request.QueryString = new QueryString("?activo=false"));
            s.WithRequestHeader("X-Api-Key", e.Norte.Admin);
            s.StatusCodeShouldBe(200);
        });

        // Un flujo en borrador (sin publicar) y el de otra empresa del grupo no se ofrecen; el publicado de esta, sí.
        await ApiAsync<FlujoDto>("POST", "/api/v1/flujos", Admin(e.Norte), new CrearFlujoDto("BORRADOR_CON", "Borrador de contratista", "CONTRATISTA"), 201);
        var clientes = await FlujoConAsync(e.Norte, "CLIENTE", [new RequisitoDelFlujoDto(TipoDocumento: "RUT")]);
        var otraDatos = await ApiAsync<EmpresaDto>("POST", "/api/v1/empresas", admin,
            new CrearEmpresaDto(new IdentificacionDto("CO", "NIT", Nit()), "Norte Inmobiliaria S.A.S.", "NINMO", null, null), 201);
        var deLaOtra = await FlujoConAsync(e.Norte with { Datos = otraDatos }, "CLIENTE", [new RequisitoDelFlujoDto(TipoDocumento: "RUT")]);

        var plantilla = await ApiAsync("GET", "/api/v1/invitaciones/lotes/plantilla", Admin(e.Norte), null, 200);
        plantilla.Context.Response.ContentType.ShouldBe(HojaDeCalculo.TipoContenido);
        var libro = await BytesAsync(plantilla);

        // Lo que la empresa tiene configurado, no lo que está inactivo ni lo que es de otra.
        ColumnaDeListas(libro, "A").ShouldBe(["Cliente (CLIENTE)", "Contratista de obra (CONTRATISTA)", "Empleado (EMPLEADO)", "Proveedor (PROVEEDOR)", "Usuario (USUARIO)"]);
        var flujos = ColumnaDeListas(libro, "G");
        // Exactamente dos: el flujo de CLIENTE de esta empresa (no el de la otra, que tiene el mismo código) y el de PROVEEDOR; ni el borrador.
        flujos.ShouldBe([$"{clientes.Nombre} ({clientes.Codigo})", $"{e.Flujo.Nombre} ({e.Flujo.Codigo})"]);
        deLaOtra.EmpresaId.ShouldBe(otraDatos.Id);
        ColumnaDeListas(libro, "F").ShouldBe(["Cliente (CLIENTE)", "Proveedor (PROVEEDOR)"]);
        CeldasDe(libro, "sheet2").Values.ShouldContain(v => v.Contains("Norte S.A.S."));

        // El importador y la vista previa la leen igual: lo que se elige de las listas («Nombre (CÓDIGO)») llega como código.
        var (nit1, nit2) = (Nit(), Nit());
        var llena = LlenarPlantilla(libro,
            ["Número de Identificación Tributaria (NIT)", nit1, "Aceros del Norte S.A.S.", CorreoNuevo(), "Proveedor (PROVEEDOR)", "Colombia (CO)", null, "Jurídica",
                "Aceros", $"{e.Flujo.Nombre} ({e.Flujo.Codigo})", "Laura Gómez", "3001234567"],
            ["Cédula de ciudadanía (CC)", "0" + nit2, "Ana Gómez", CorreoNuevo(), "Cliente (CLIENTE)"]);
        var archivo = new ArchivoDeLoteDto("plantilla-invitacion-masiva.xlsx", Convert.ToBase64String(llena));
        var vista = await ApiAsync<VistaPreviaLoteDto>("POST", "/api/v1/invitaciones/lotes/vista-previa", Admin(e.Norte), new CrearLoteDto(Archivo: archivo), 200);
        (vista.Total, vista.Validas, vista.Invalidas).ShouldBe((2, 2, 0));
        vista.Filas.Select(f => f.AccionPrevista).ShouldBe(["Invitado", "Invitado"]);
        (vista.Filas[0].Datos.TipoIdentificacion, vista.Filas[0].Datos.TipoVinculo, vista.Filas[0].Datos.Flujo, vista.Filas[0].Datos.Pais).ShouldBe(("NIT", "PROVEEDOR", e.Flujo.Codigo, "CO"));
        (vista.Filas[1].Datos.TipoIdentificacion, vista.Filas[1].Datos.TipoVinculo).ShouldBe(("CC", "CLIENTE"));

        var creado = await ApiAsync<LoteDto>("POST", "/api/v1/invitaciones/lotes", Admin(e.Norte), new CrearLoteDto("Desde la plantilla", archivo), 202);
        var lote = await EsperarLoteAsync(e.Norte, creado.Id, l => l.Estado is "Completado" or "CompletadoConErrores");
        lote.Estado.ShouldBe("Completado");
        var filas = await FilasAsync(e.Norte, creado.Id);
        filas.Select(f => f.Accion).ShouldBe(["Invitado", "Invitado"]);
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{filas[0].VinculoId}", Admin(e.Norte), null, 200)).FlujoId.ShouldBe(e.Flujo.Id);
    }

    [Fact]
    public async Task Invitar_un_tercero_a_mano_hace_lo_que_una_fila_del_lote_crea_reenvia_no_toca_lo_aceptado_y_no_invita_a_un_bloqueado()
    {
        var e = await PrepararAsync();
        var (nit, correo) = (Nit(), CorreoNuevo());
        var dto = InvitacionDe(nit, correo, flujo: e.Flujo.Codigo);

        // Tercero y vínculo nuevos: 201 con el vínculo, la invitación sale al correo y el flujo queda elegido.
        var primera = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), dto, 201);
        var creada = (await primera.ReadAsJsonAsync<InvitacionDeTerceroDto>())!;
        (creada.Accion, creada.TerceroCreado, creada.PorAprobar).ShouldBe(("Invitado", true, false));
        primera.Context.Response.Headers.Location.ToString().ShouldEndWith($"/api/v1/vinculos/{creada.VinculoId}");
        var vinculo = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{creada.VinculoId}", Admin(e.Norte), null, 200);
        (vinculo.Estado, vinculo.TerceroId, vinculo.FlujoId, vinculo.Origen).ShouldBe(("Invitado", creada.TerceroId, e.Flujo.Id, "Invitacion"));
        vinculo.Invitacion.ShouldNotBeNull().CorreoDestino.ShouldBe(correo);
        await fixture.Correos.EsperarAsync(correo, m => m.Asunto.Contains("te invita"));
        var tercero = await ApiAsync<TerceroDto>("GET", $"/api/v1/terceros/{creada.TerceroId}", Admin(e.Norte), null, 200);
        (tercero.Nombre, tercero.NombreComercial, tercero.TipoPersona, tercero.Identificacion.Numero).ShouldBe(("Aceros del Norte S.A.S.", "Aceros", "Juridica", nit));
        tercero.Contactos.ShouldContain(c => c.Correo == correo);
        // Como la fila de un lote, pero sin lote: la invitación no lleva LoteId.
        (await EventosAsync(e.Norte.Datos.TenantId, creada.VinculoId)).OfType<InvitacionEnviada>().ShouldHaveSingleItem().LoteId.ShouldBeNull();

        // El mismo tercero y tipo mientras no acepta: se reenvía al correo indicado, sobre el mismo vínculo (200).
        var otroCorreo = CorreoNuevo();
        var reenviada = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), dto with { Correo = otroCorreo }, 200);
        (reenviada.Accion, reenviada.VinculoId, reenviada.TerceroId, reenviada.TerceroCreado).ShouldBe(("Reinvitado", creada.VinculoId, creada.TerceroId, false));
        await fixture.Correos.EsperarAsync(otroCorreo, m => m.Asunto.Contains("te invita"));
        (await EventosAsync(e.Norte.Datos.TenantId, creada.VinculoId)).OfType<VinculoCreado>().ShouldHaveSingleItem();

        // Otro tipo de vínculo con el mismo tercero es otro vínculo (el tercero ya existe: no se vuelve a crear).
        var cliente = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), InvitacionDe(nit, CorreoNuevo(), "CLIENTE"), 201);
        (cliente.TerceroId, cliente.TerceroCreado, cliente.VinculoId == creada.VinculoId).ShouldBe((creada.TerceroId, false, false));

        // Ya aceptó: no se le reenvía nada (200 con el detalle).
        await AceptarAsync(await SesionAsync(otroCorreo, "Norte"), creada.VinculoId);
        var aceptada = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), dto, 200);
        (aceptada.Accion, aceptada.VinculoId).ShouldBe(("SinCambios", creada.VinculoId));
        aceptada.Detalle.ShouldNotBeNull().ShouldContain("ya aceptó");

        // Bloqueado: no se puede invitar (409) y el error dice cuál es el vínculo para abrirlo.
        await ApiAsync("POST", $"/api/v1/vinculos/{creada.VinculoId}/bloquear", Admin(e.Norte), new BloquearVinculoDto("Lista restrictiva", null), 200);
        var bloqueado = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), dto, 409);
        var problema = await bloqueado.ReadAsJsonAsync<JsonElement>();
        problema.GetProperty("codigo").GetString().ShouldBe("vinculo-no-invitable");
        problema.GetProperty("vinculoId").GetGuid().ShouldBe(creada.VinculoId);
    }

    [Fact]
    public async Task Una_invitacion_a_mano_invalida_dice_todos_sus_errores_por_campo_y_no_crea_nada()
    {
        var e = await PrepararAsync();
        var nit = Nit();

        var rechazo = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte),
            new InvitarTerceroDto(TipoIdentificacion: "NIT", NumeroIdentificacion: "12", Nombre: null, Correo: "no-es-un-correo", TipoVinculo: "NO_EXISTE", Flujo: "OTRO"), 422);
        var problema = await rechazo.ReadAsJsonAsync<JsonElement>();
        problema.GetProperty("codigo").GetString().ShouldBe("tipo-vinculo-invalido"); // el primero de la vista previa de un lote
        var errores = problema.GetProperty("errores").EnumerateArray().Select(x => (Campo: x.GetProperty("campo").GetString(), Codigo: x.GetProperty("codigo").GetString())).ToList();
        errores.Select(x => x.Campo).ShouldBe(["tipoVinculo", "correo", "nombre", "numeroIdentificacion"], ignoreOrder: true);
        errores.ShouldContain(("correo", "correo-invalido"));
        errores.ShouldContain(("nombre", "nombre-requerido"));

        // Sin tipo de vínculo ni identificación: los obligatorios.
        var vacia = await (await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), new InvitarTerceroDto(), 422)).ReadAsJsonAsync<JsonElement>();
        vacia.GetProperty("errores").EnumerateArray().Select(x => x.GetProperty("campo").GetString())
            .ShouldBe(["tipoVinculo", "correo", "nombre", "tipoIdentificacion", "numeroIdentificacion"], ignoreOrder: true);

        // El flujo debe ser de la empresa y del tipo; el dígito de verificación, el que corresponde.
        var flujo = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), InvitacionDe(nit, CorreoNuevo(), "CLIENTE", e.Flujo.Codigo), 422);
        (await CodigoAsync(flujo)).ShouldBe("flujo-invalido");
        var dv = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), InvitacionDe(nit, CorreoNuevo()) with { DigitoVerificacion = "0123" }, 422);
        (await CodigoAsync(dv)).ShouldBe("digito-verificacion-invalido");

        // La vigencia del enlace (1 hora a 30 días) la valida el dominio, y nada se guarda a medias.
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), InvitacionDe(nit, CorreoNuevo()) with { VigenciaHoras = 0 }, 422))).ShouldBe("vigencia-invalida");
        await ApiAsync("GET", $"/api/v1/terceros/por-identificacion?pais=CO&tipo=NIT&numero={nit}", Admin(e.Norte), null, 404);
    }

    [Fact]
    public async Task Invitar_a_mano_pide_vinculos_escribir_y_la_clave_de_idempotencia_repite_la_respuesta_sin_duplicar()
    {
        var e = await PrepararAsync();
        var (nit, correo) = (Nit(), CorreoNuevo());
        var dto = InvitacionDe(nit, correo);

        // La llave del SRM de las demás pruebas solo lee: no invita.
        await ApiAsync("POST", "/api/v1/invitaciones", new Credencial(e.Norte.LlaveSrm, e.Norte.Datos.Id), dto, 403);
        (await CodigoAsync(await InvitarConClaveAsync(e.Norte, dto, null, 422))).ShouldBe("idempotency-key-requerida");

        var clave = Guid.NewGuid().ToString();
        var uno = await InvitarConClaveAsync(e.Norte, dto, clave, 201);
        var dos = await InvitarConClaveAsync(e.Norte, dto, clave, 201);
        dos.Context.Response.Headers["Idempotent-Replayed"].ToString().ShouldBe("true");
        (await dos.ReadAsJsonAsync<InvitacionDeTerceroDto>())!.VinculoId.ShouldBe((await uno.ReadAsJsonAsync<InvitacionDeTerceroDto>())!.VinculoId);
        (await ApiAsync<PaginaDto<VinculoDto>>("GET", "/api/v1/vinculos?tipoVinculo=PROVEEDOR", Admin(e.Norte), null, 200)).Datos
            .Count(v => v.CorreoTercero == correo).ShouldBe(1);
        fixture.Correos.Para(correo).Count(m => m.Asunto.Contains("te invita")).ShouldBe(1);

        // La misma clave con otro cuerpo es un error, no otra invitación.
        (await CodigoAsync(await InvitarConClaveAsync(e.Norte, dto with { Nombre = "Otro nombre" }, clave, 422))).ShouldBe("clave-idempotencia-reutilizada");
    }

    [Fact]
    public async Task Con_aprobacion_previa_invitar_a_mano_deja_la_invitacion_retenida_hasta_que_otra_persona_la_apruebe()
    {
        var e = await PrepararConEscrituraAsync();
        await ExigirAprobacionDeInvitacionAsync(e.Norte, "PROVEEDOR", ApruebaCumplimiento);
        Credencial laura() => Delegado(e.Norte, e.Laura);
        Credencial carlos() => Delegado(e.Norte, e.Carlos);
        var (nit, correo) = (Nit(), CorreoNuevo());

        // Laura invita: queda retenida (no sale correo ni enlace) y espera a Carlos.
        var retenida = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", laura(), InvitacionDe(nit, correo), 201);
        (retenida.Accion, retenida.PorAprobar, retenida.TerceroCreado).ShouldBe(("Invitado", true, true));
        var vinculo = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{retenida.VinculoId}", laura(), null, 200);
        vinculo.Invitacion.ShouldBeNull();
        vinculo.InvitacionPorAprobar.ShouldNotBeNull().Estado.ShouldBe("Pendiente");
        var eventos = await EventosAsync(e.Norte.Datos.TenantId, retenida.VinculoId);
        eventos.OfType<InvitacionPorAprobarSolicitada>().ShouldHaveSingleItem().SolicitadaPor.Id.ShouldBe(e.Laura.Usuario.Id.ToString());
        eventos.OfType<InvitacionEnviada>().ShouldBeEmpty();
        fixture.Correos.Para(correo).ShouldBeEmpty();

        // Repetirla mientras espera es un conflicto con el vínculo; Carlos la aprueba y sale la invitación de siempre.
        var repetida = await (await ApiAsync("POST", "/api/v1/invitaciones", laura(), InvitacionDe(nit, correo), 409)).ReadAsJsonAsync<JsonElement>();
        repetida.GetProperty("codigo").GetString().ShouldBe("invitacion-por-aprobar");
        repetida.GetProperty("vinculoId").GetGuid().ShouldBe(retenida.VinculoId);
        (await ApiAsync<VinculoDto>("POST", $"/api/v1/vinculos/{retenida.VinculoId}/invitacion/aprobar", carlos(), new { }, 200)).Invitacion.ShouldNotBeNull().CorreoDestino.ShouldBe(correo);
        await fixture.Correos.EsperarAsync(correo, m => m.Asunto.Contains("te invita"));

        // Si quien pide es el único que podría aprobar, no hay a quién pedírselo: 422 y no se crea nada.
        var otroNit = Nit();
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/invitaciones", carlos(), InvitacionDe(otroNit, CorreoNuevo()), 422))).ShouldBe("sin-aprobadores-de-invitacion");
        await ApiAsync("GET", $"/api/v1/terceros/por-identificacion?pais=CO&tipo=NIT&numero={otroNit}", Admin(e.Norte), null, 404);
    }
}
