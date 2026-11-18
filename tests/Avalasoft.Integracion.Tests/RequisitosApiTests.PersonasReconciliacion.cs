using System.Text.Json;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Avalasoft.Aplicacion.Comun;
using Avalasoft.Aplicacion.Habeas;
using Avalasoft.Aplicacion.Personas;
using Avalasoft.Aplicacion.Verificaciones;
using Avalasoft.Contratos;
using Avalasoft.Dominio.Documentos;
using Avalasoft.Dominio.Terceros;
using Wolverine;

namespace Avalasoft.Integracion.Tests;

/// <summary>
/// Personas relacionadas (ADR-0010) frente a las verificaciones, la IA y el habeas data: las listas restrictivas cubren a las personas vigentes (y dejan de cubrir a las
/// terminadas), lo que la IA lee de la Cámara es una propuesta que el tercero confirma o descarta y no cambia nada por sí sola, y el plan de supresión de una persona conserva
/// lo que el tercero al que se relaciona sigue usando.
/// </summary>
public sealed partial class RequisitosApiTests
{
    private async Task<IReadOnlyList<PersonaAConsultar>> PersonasDeListasAsync(Empresa empresa, Guid terceroId)
    {
        await using var sesion = Host.Services.GetRequiredService<IDocumentStore>().LightweightSession(empresa.Datos.TenantId.ToString("N"));
        return await ConsultaDeListas.PersonasAsync(sesion, terceroId, DateOnly.FromDateTime(DateTime.UtcNow), CancellationToken.None);
    }

    [Fact]
    public async Task Las_listas_restrictivas_cubren_a_las_personas_relacionadas_vigentes_una_sola_vez_y_no_a_las_terminadas()
    {
        var empresa = await EmpresaQuePideLaCedulaDelRepresentanteAsync("Cubre listas S.A.S.", "CLIS");
        var (vinculo, sesion, _) = await ProveedorAceptadoAsync(empresa);
        var (juan, ana) = (Cedula(), Cedula());

        // Juan figura en la ficha (y por eso tiene su relación); Ana, beneficiaria final, solo la declaró el tercero por su cuenta.
        await GuardarSeccionAsync(sesion, "FICHA_LEGAL", LegalCon(FilaLegal("RepresentanteLegal", juan, "Juan", "Principal")));
        var beneficiaria = await (await TerceroAsync("POST", "/public/v1/tercero/relaciones", sesion.AccessToken,
            new DeclararRelacionDto(new IdentificacionDto("CO", "CC", ana), "Ana Beneficiaria", "BeneficiarioFinal", false, 30), 201)).ReadAsJsonAsync<RelacionEntreTercerosDto>();
        await EsperarRelacionesAsync(vinculo.TerceroId, r => r.Count == 2);

        var personas = await PersonasDeListasAsync(empresa, vinculo.TerceroId);
        personas.Select(p => p.Rol).ShouldBe(["Tercero", "RepresentanteLegal", "BeneficiarioFinal"]); // Juan está en la ficha y en su relación: una sola vez
        personas.Single(p => p.Rol == "BeneficiarioFinal").Numero.ShouldBe(ana);

        // Terminada la relación de Ana, deja de consultarse; Juan sigue.
        await TerceroAsync("DELETE", $"/public/v1/tercero/relaciones/{beneficiaria!.Id}", sesion.AccessToken, null, 204);
        (await PersonasDeListasAsync(empresa, vinculo.TerceroId)).Select(p => p.Rol).ShouldBe(["Tercero", "RepresentanteLegal"]);
    }

    private async Task RegistrarLecturaDeCamaraAsync(Guid documentoId, IReadOnlyList<(string Nombre, string Identificacion, string Cargo)> representantes, decimal confianza)
    {
        var campos = new Dictionary<string, JsonElement>
        {
            ["representantesLegales"] = JsonSerializer.SerializeToElement(representantes.Select(r => new { nombre = r.Nombre, identificacion = r.Identificacion, cargo = r.Cargo }))
        };
        await using var sesion = Host.Services.GetRequiredService<IDocumentStore>().LightweightSession(TenantsTecnicos.Boveda);
        var stream = await sesion.Events.FetchForWriting<Documento>(documentoId);
        stream.AppendOne(stream.Aggregate!.RegistrarAnalisisDeIa(new Avalasoft.Dominio.Documentos.AnalisisDeIaRegistrado(1, "modelo-de-prueba", false, confianza, true,
            "CAMARA_COMERCIO", campos, [], 3, 0, 100, 50, 0m, Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UtcNow, PendienteRevisionHumana: false))!);
        await sesion.SaveChangesAsync();
    }

    private async Task ReconciliarAsync(Guid terceroId, Guid documentoId)
    {
        using var alcance = Host.Services.CreateScope();
        await alcance.ServiceProvider.GetRequiredService<IMessageBus>().InvokeAsync(new ReconciliarRelacionesConCamara(terceroId, documentoId, 1));
    }

    [Fact]
    public async Task Otro_representante_en_la_camara_es_una_propuesta_que_el_tercero_confirma_y_no_cambia_nada_hasta_entonces()
    {
        var empresa = await EmpresaQuePideLaCedulaDelRepresentanteAsync("Reconcilia S.A.S.", "RECO");
        var (vinculo, sesion, expedienteId) = await ProveedorAceptadoAsync(empresa);
        var (juan, maria) = (Cedula(), Cedula());
        await GuardarSeccionAsync(sesion, "FICHA_LEGAL", LegalCon(FilaLegal("RepresentanteLegal", juan, "Juan", "Principal")));
        await EsperarAsync(empresa, expedienteId, x => !Requisito(x, "CEDULA").Persona!.SinPersona);
        var camara = await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara de comercio"));
        var documentoId = camara.Version.DocumentoId;

        // La IA lee de la Cámara a otra persona como representante legal: queda una propuesta con su confianza; lo vigente no cambia.
        await RegistrarLecturaDeCamaraAsync(documentoId, [("María Gómez Nueva", $"CC {maria}", "Representante legal principal")], 0.93m);
        await ReconciliarAsync(vinculo.TerceroId, documentoId);
        var relaciones = await EsperarRelacionesAsync(vinculo.TerceroId, r => r.Count == 2);
        var propuesta = relaciones.Single(r => r.Estado == EstadoDeRelacion.Propuesta);
        (propuesta.Tipo, propuesta.Fuente, propuesta.Confianza, propuesta.DocumentoId, propuesta.Principal).ShouldBe(
            (TipoRelacionTerceros.RepresentanteLegal, FuenteDeRelacion.ExtraidaIa, 0.93m, documentoId, true));
        relaciones.Single(r => r.Estado == EstadoDeRelacion.Confirmada).Principal.ShouldBeTrue();
        await ReconciliarAsync(vinculo.TerceroId, documentoId); // idempotente: no propone otra vez lo ya propuesto
        (await EsperarRelacionesAsync(vinculo.TerceroId, r => r.Count == 2)).Count(r => r.Estado == EstadoDeRelacion.Propuesta).ShouldBe(1);

        var lista = await RelacionesAsync(sesion);
        var visible = lista.Single(r => r.Estado == "Propuesta");
        (visible.Nombre, visible.Confianza, visible.Fuente, visible.Reemplaza!.Nombre).ShouldBe(("María Gómez Nueva", 0.93m, "ExtraidaIa", "Juan Prueba"));
        var intacto = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Admin(empresa), null, 200);
        Requisito(intacto, "CEDULA").Persona!.Nombre.ShouldBe("Juan Prueba"); // la propuesta no movió el requisito
        (await PersonasDeListasAsync(empresa, vinculo.TerceroId)).Select(p => p.Rol).ShouldBe(["Tercero", "RepresentanteLegal"]);

        // El tercero la confirma: María es la representante, Juan sale y el requisito pide la cédula de María (el de Juan, sin cargar, se exime).
        var confirmada = await TerceroAsync<RelacionEntreTercerosDto>("POST", $"/public/v1/tercero/relaciones/{visible.Id}/confirmar", sesion.AccessToken, null, 200);
        (confirmada.Estado, confirmada.Principal).ShouldBe(("Confirmada", true));
        (await EsperarRelacionesAsync(vinculo.TerceroId, r => r.Count(x => x.Estado == EstadoDeRelacion.Finalizada) == 1))
            .Single(r => r.Estado == EstadoDeRelacion.Finalizada).Principal.ShouldBeFalse();
        var recalculado = await EsperarAsync(empresa, expedienteId, x => x.Requisitos!.Any(r => r.Persona?.Nombre == "María Gómez Nueva"));
        recalculado.Requisitos!.Single(r => r.Persona?.Nombre == "María Gómez Nueva").Estado.ShouldBe("Pendiente");
        recalculado.Requisitos!.Single(r => r.Persona?.Nombre == "Juan Prueba").Estado.ShouldBe("Eximido");
        (await RelacionesAsync(sesion)).Select(r => r.Nombre).ShouldBe(["María Gómez Nueva"]); // la lista ya no sincroniza a Juan desde una ficha desactualizada
        (await PersonasDeListasAsync(empresa, vinculo.TerceroId)).Select(p => p.Rol).ShouldContain("RepresentanteLegal");
    }

    [Fact]
    public async Task Descartar_lo_que_detecto_la_ia_no_cambia_nada_y_no_se_vuelve_a_ofrecer_con_el_mismo_documento()
    {
        var empresa = await EmpresaQuePideLaCedulaDelRepresentanteAsync("Descarta S.A.S.", "DESC");
        var (vinculo, sesion, expedienteId) = await ProveedorAceptadoAsync(empresa);
        await GuardarSeccionAsync(sesion, "FICHA_LEGAL", LegalCon(FilaLegal("RepresentanteLegal", Cedula(), "Juan", "Principal")));
        await EsperarAsync(empresa, expedienteId, x => !Requisito(x, "CEDULA").Persona!.SinPersona);
        var documentoId = (await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara"))).Version.DocumentoId;
        await RegistrarLecturaDeCamaraAsync(documentoId, [("Otra Persona", $"CC {Cedula()}", "Representante legal")], 0.8m);
        await ReconciliarAsync(vinculo.TerceroId, documentoId);
        var propuesta = (await RelacionesAsync(sesion)).Single(r => r.Estado == "Propuesta");

        await TerceroAsync("POST", $"/public/v1/tercero/relaciones/{propuesta.Id}/descartar", sesion.AccessToken, null, 204);
        (await RelacionesAsync(sesion)).Select(r => r.Estado).ShouldBe(["Confirmada"]);
        await ReconciliarAsync(vinculo.TerceroId, documentoId);
        (await RelacionesAsync(sesion)).Count.ShouldBe(1);
        // Una propuesta descartada no se confirma, y confirmar o descartar lo que no existe responde 404.
        await TerceroAsync("POST", $"/public/v1/tercero/relaciones/{propuesta.Id}/confirmar", sesion.AccessToken, null, 409);
        await TerceroAsync("POST", $"/public/v1/tercero/relaciones/{Guid.NewGuid()}/confirmar", sesion.AccessToken, null, 404);
    }

    [Fact]
    public async Task El_plan_de_supresion_de_una_persona_conserva_lo_que_el_tercero_al_que_se_relaciona_sigue_usando()
    {
        var empresa = await EmpresaQuePideLaCedulaDelRepresentanteAsync("Habeas S.A.S.", "HABE");
        var (_, sesion, expedienteId) = await ProveedorAceptadoAsync(empresa);
        await GuardarSeccionAsync(sesion, "FICHA_LEGAL", LegalCon(FilaLegal("RepresentanteLegal", Cedula(), "Juan", "Principal")));
        await EsperarAsync(empresa, expedienteId, x => !Requisito(x, "CEDULA").Persona!.SinPersona);
        var juan = (await RelacionesAsync(sesion)).Single();
        await SubirDePersonaAsync(sesion, juan.PersonaId, "CEDULA", Pdf("Cédula de Juan"));
        await EsperarAsync(empresa, expedienteId, x => x.Estado == "EnRevision");
        var otra = await SubirDePersonaAsync(sesion, juan.PersonaId, "CERTIFICADO_ANTECEDENTES", Pdf("Antecedentes de Juan"));

        // La cédula la revisa una empresa en un trámite en curso: se conserva. Los antecedentes que nadie pidió se suprimen.
        using var alcance = Host.Services.CreateScope();
        var plan = await alcance.ServiceProvider.GetRequiredService<RetencionDelTercero>().PlanearAsync(juan.PersonaId, Avalasoft.Dominio.Habeas.AlcanceDeSupresion.Documentos, CancellationToken.None);
        var documentos = plan.Elementos.Where(e => e.Tipo == "documento-version").ToList();
        documentos.Count.ShouldBe(2);
        documentos.Single(e => e.Descripcion.StartsWith("Cédula", StringComparison.Ordinal)).Accion.ShouldBe(AccionDeSupresion.Retener);
        documentos.Single(e => e.DocumentoId == otra.Version.DocumentoId).Accion.ShouldBe(AccionDeSupresion.Suprimir);
    }
}
