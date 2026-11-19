using System.Text;
using System.Text.Json;
using Validalo.Contratos;
using Validalo.Dominio.Vinculos;
using Xunit.Abstractions;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Los atributos del vínculo al invitar (decisión IM): la invitación a mano los valida contra los permitidos de su tipo, los guarda en el vínculo y, si el vínculo ya existía
/// y se reinvita, solo aplica los que vienen; y el lote los lee de las columnas «Atributo: clave» y los valida contra el tipo de cada fila.
/// </summary>
public sealed partial class RequisitosInvitacionesApiTests
{
    private static IReadOnlyList<(string? Campo, string? Codigo)> ErroresDe(JsonElement problema) =>
        [.. problema.GetProperty("errores").EnumerateArray().Select(x => (Campo: x.GetProperty("campo").GetString(), Codigo: x.GetProperty("codigo").GetString()))];

    /// <summary>Un tipo con un atributo obligatorio, uno de fecha y uno de sí/no, además de los atributos de la semilla de PROVEEDOR (nivelRiesgo, categorias, montoEstimado).</summary>
    private async Task CrearTipoContratistaAsync(Empresa empresa) =>
        await ApiAsync<TipoVinculoDto>("POST", "/api/v1/tipos-vinculo", new Credencial(empresa.Admin), new CrearTipoVinculoDto("CONTRATISTA", "Contratista de obra",
        [
            new AtributoPermitidoDto("obra", "Texto", true, null),
            new AtributoPermitidoDto("inicio", "Fecha", false, null),
            new AtributoPermitidoDto("critico", "Booleano", false, null)
        ], false), 201);

    [Fact]
    public async Task Invitar_a_mano_con_atributos_los_valida_contra_el_tipo_los_guarda_y_al_reinvitar_solo_aplica_los_que_vienen()
    {
        var e = await PrepararAsync();
        await CrearTipoContratistaAsync(e.Norte);
        var (nit, correo) = (Nit(), CorreoNuevo());
        var proveedor = InvitacionDe(nit, correo);

        // Cada atributo con su error por campo: uno que el tipo no tiene, un valor que no es de su tipo y un obligatorio que falta al crear el vínculo.
        var malos = await (await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), proveedor with
        {
            Atributos = new Dictionary<string, JsonElement>
            {
                ["obra"] = JsonSerializer.SerializeToElement("Torre 3"),
                ["nivelRiesgo"] = JsonSerializer.SerializeToElement("Altísimo"),
                ["montoEstimado"] = JsonSerializer.SerializeToElement("mucho")
            }
        }, 422)).ReadAsJsonAsync<JsonElement>();
        ErroresDe(malos).ShouldBe([("atributos.obra", "atributo-no-permitido"), ("atributos.nivelRiesgo", "atributo-invalido"), ("atributos.montoEstimado", "atributo-invalido")], ignoreOrder: true);
        var faltaObra = await (await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte), InvitacionDe(nit, correo, "CONTRATISTA"), 422)).ReadAsJsonAsync<JsonElement>();
        ErroresDe(faltaObra).ShouldBe([("atributos.obra", "atributo-requerido")]);
        await ApiAsync("GET", $"/api/v1/terceros/por-identificacion?pais=CO&tipo=NIT&numero={nit}", Admin(e.Norte), null, 404); // nada a medias

        // Con valores válidos (también en el tipo que cuenta, con la opción sin importar mayúsculas ni tildes) el vínculo nace con ellos.
        var creada = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), proveedor with
        {
            Atributos = new Dictionary<string, JsonElement>
            {
                ["nivelRiesgo"] = JsonSerializer.SerializeToElement("alto"),
                ["montoEstimado"] = JsonSerializer.SerializeToElement(1500000),
                ["categorias"] = JsonSerializer.SerializeToElement(new[] { "Servicios", "Equipos" })
            }
        }, 201);
        var vinculo = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{creada.VinculoId}", Admin(e.Norte), null, 200);
        vinculo.Atributos["nivelRiesgo"].GetString().ShouldBe("Alto");
        vinculo.Atributos["montoEstimado"].GetDecimal().ShouldBe(1500000m);
        vinculo.Atributos["categorias"].EnumerateArray().Select(x => x.GetString()).ShouldBe(["Servicios", "Equipos"]);

        // Reinvitar con otro atributo: se aplica el que viene y se conserva lo que ya tenía (no se borra nada).
        var reinvitada = await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), proveedor with
        {
            Correo = CorreoNuevo(),
            Atributos = new Dictionary<string, JsonElement> { ["montoEstimado"] = JsonSerializer.SerializeToElement(2000000) }
        }, 200);
        (reinvitada.Accion, reinvitada.VinculoId).ShouldBe(("Reinvitado", creada.VinculoId));
        vinculo = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{creada.VinculoId}", Admin(e.Norte), null, 200);
        vinculo.Atributos["montoEstimado"].GetDecimal().ShouldBe(2000000m);
        vinculo.Atributos["nivelRiesgo"].GetString().ShouldBe("Alto");
        vinculo.Atributos.ContainsKey("categorias").ShouldBeTrue();
        (await EventosAsync(e.Norte.Datos.TenantId, creada.VinculoId)).OfType<AtributosDeVinculoActualizados>().ShouldHaveSingleItem();

        // Sin atributos no se toca ninguno; y uno inválido al reinvitar no reenvía nada.
        await ApiAsync<InvitacionDeTerceroDto>("POST", "/api/v1/invitaciones", Admin(e.Norte), proveedor with { Correo = CorreoNuevo() }, 200);
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{creada.VinculoId}", Admin(e.Norte), null, 200)).Atributos.Keys.ShouldBe(["nivelRiesgo", "montoEstimado", "categorias"], ignoreOrder: true);
        var invalido = await ApiAsync("POST", "/api/v1/invitaciones", Admin(e.Norte),
            proveedor with { Correo = CorreoNuevo(), Atributos = new Dictionary<string, JsonElement> { ["nivelRiesgo"] = JsonSerializer.SerializeToElement("Nunca") } }, 422);
        ErroresDe(await invalido.ReadAsJsonAsync<JsonElement>()).ShouldBe([("atributos.nivelRiesgo", "atributo-invalido")]);
    }

    [Fact]
    public async Task El_lote_lee_las_columnas_de_atributo_las_valida_contra_el_tipo_de_cada_fila_y_las_guarda_en_el_vinculo()
    {
        var e = await PrepararAsync();
        await CrearTipoContratistaAsync(e.Norte);
        var (nit1, nit2, nit3, nit4) = (Nit(), Nit(), Nit(), Nit());

        // La plantilla de la empresa trae una columna por atributo (una sola por clave) con su lista cuando es de opciones.
        var plantilla = await ApiAsync("GET", "/api/v1/invitaciones/lotes/plantilla", Admin(e.Norte), null, 200);
        var encabezados = CeldasDe(await BytesAsync(plantilla), "sheet1").Where(c => c.Key.EndsWith('1') && c.Key.Length <= 3).Select(c => c.Value).ToList();
        encabezados.ShouldContain("Atributo: nivelRiesgo");
        encabezados.ShouldContain("Atributo: obra");
        encabezados.Count(h => h == "Atributo: nivelRiesgo").ShouldBe(1);

        var csv = string.Join("\r\n",
            "Tipo de identificación;Número de identificación;Razón social o nombres;Correo;Tipo de vínculo;Atributo: nivelRiesgo;Atributo: categorias;Atributo: montoEstimado;Atributo: obra;Atributo: critico",
            $"NIT;{nit1};Aceros del Norte;{CorreoNuevo()};PROVEEDOR;Alto;Servicios, Equipos;1500000;;",
            $"NIT;{nit2};Constructora Sur;{CorreoNuevo()};CONTRATISTA;;;;Torre 3;sí",
            $"NIT;{nit3};Obras sin obra;{CorreoNuevo()};CONTRATISTA;;;;;",
            $"NIT;{nit4};Proveedor con obra;{CorreoNuevo()};PROVEEDOR;;;;Torre 4;") + "\r\n";
        var archivo = new ArchivoDeLoteDto("lote.csv", Convert.ToBase64String(Encoding.UTF8.GetBytes(csv)));

        // La vista previa dice por fila qué atributo falla: uno obligatorio que falta y uno que el tipo de la fila no tiene.
        var vista = await ApiAsync<VistaPreviaLoteDto>("POST", "/api/v1/invitaciones/lotes/vista-previa", Admin(e.Norte), new CrearLoteDto(Archivo: archivo), 200);
        (vista.Total, vista.Validas, vista.Invalidas).ShouldBe((4, 2, 2));
        vista.Filas[0].Datos.Atributos.ShouldNotBeNull().Keys.ShouldBe(["nivelRiesgo", "categorias", "montoEstimado"], ignoreOrder: true);
        vista.Filas[2].Errores.Select(x => (x.Campo, x.Codigo)).ShouldBe([("atributos.obra", "atributo-requerido")]);
        vista.Filas[3].Errores.Select(x => (x.Campo, x.Codigo)).ShouldBe([("atributos.obra", "atributo-no-permitido")]);

        // Las filas válidas crean su vínculo con los atributos convertidos a su tipo; las inválidas quedan en el informe sin procesarse.
        var creado = await ApiAsync<LoteDto>("POST", "/api/v1/invitaciones/lotes", Admin(e.Norte), new CrearLoteDto("Con atributos", archivo), 202);
        await EsperarLoteAsync(e.Norte, creado.Id, l => l.Estado is "Completado" or "CompletadoConErrores");
        var filas = await FilasAsync(e.Norte, creado.Id, "Exitosa");
        filas.Count.ShouldBe(2);
        var proveedor = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{filas[0].VinculoId}", Admin(e.Norte), null, 200);
        proveedor.Atributos["nivelRiesgo"].GetString().ShouldBe("Alto");
        proveedor.Atributos["montoEstimado"].GetDecimal().ShouldBe(1500000m);
        proveedor.Atributos["categorias"].EnumerateArray().Select(x => x.GetString()).ShouldBe(["Servicios", "Equipos"]);
        var contratista = await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{filas[1].VinculoId}", Admin(e.Norte), null, 200);
        contratista.Atributos["obra"].GetString().ShouldBe("Torre 3");
        contratista.Atributos["critico"].GetBoolean().ShouldBeTrue();
    }
}
