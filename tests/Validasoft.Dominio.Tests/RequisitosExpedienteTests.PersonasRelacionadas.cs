using Validasoft.Dominio.Documentos;
using Validasoft.Dominio.Expedientes;
using Validasoft.Dominio.Flujos;
using Validasoft.Dominio.Terceros;

namespace Validasoft.Dominio.Tests;

// Requisitos de persona relacionada (ADR-0010, PR-3): el documento que pide el flujo es de la persona que cumple el rol ante el tercero. Se resuelve al abrir y se
// recalcula con el expediente abierto: una persona nueva, un representante que cambió, un rol que nadie cumple todavía.
public partial class RequisitosExpedienteTests
{
    private readonly Guid _cedulaDelFlujo = Guid.NewGuid();
    private readonly Guid _juan = Guid.NewGuid();
    private readonly Guid _maria = Guid.NewGuid();
    private readonly Guid _docCedulaJuan = Guid.NewGuid();

    private RequisitoCalculado CedulaDe(Guid? persona, VersionDeRequisito? version = null, bool todas = false,
        TipoRelacionTerceros rol = TipoRelacionTerceros.RepresentanteLegal)
    {
        var delRequisito = persona is { } id
            ? new PersonaDelRequisito(_cedulaDelFlujo, rol, todas, id, Guid.NewGuid(), id == _juan ? "Juan Pérez" : "María Gómez", "CO CC 1000")
            : new PersonaDelRequisito(_cedulaDelFlujo, rol, todas);
        return new RequisitoCalculado(persona is { } p ? PersonaDelRequisito.IdDeRequisito(_cedulaDelFlujo, p) : _cedulaDelFlujo, Guid.NewGuid(), "CEDULA", "Cédula",
            "CEDULA", AmbitoDocumento.Global, true, [], null, version, Persona: delRequisito);
    }

    private Guid IdDe(Guid persona) => PersonaDelRequisito.IdDeRequisito(_cedulaDelFlujo, persona);

    [Fact]
    public void Un_requisito_de_un_rol_que_nadie_cumple_nace_pendiente_sin_persona_y_frena_la_revision()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(null));

        var cedula = e.BuscarRequisito(_cedulaDelFlujo)!;
        cedula.EsDePersona.ShouldBeTrue();
        cedula.Persona!.SinPersona.ShouldBeTrue();
        cedula.Estado.ShouldBe(EstadoRequisito.Pendiente);
        e.ListoParaRevision.ShouldBeFalse();
        e.Estado.ShouldBe(EstadoExpediente.Abierto);
        e.BuscarRequisito(_rut)!.EsDePersona.ShouldBeFalse();
    }

    [Fact]
    public void Cuando_el_tercero_declara_a_la_persona_el_requisito_sin_persona_la_recibe_y_conserva_su_id()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(null));

        var eventos = e.ResolverPersonas([CedulaDe(_juan)], Ahora);

        var resuelta = eventos.ShouldHaveSingleItem().ShouldBeOfType<PersonaDeRequisitoResuelta>();
        resuelta.RequisitoId.ShouldBe(_cedulaDelFlujo);
        resuelta.Persona.PersonaId.ShouldBe(_juan);
        var resuelto = Aplicar(e, eventos);
        resuelto.Requisitos.Count.ShouldBe(3);
        resuelto.BuscarRequisito(_cedulaDelFlujo)!.Persona!.Nombre.ShouldBe("Juan Pérez");
        // Idempotente: lo mismo otra vez no cambia nada.
        resuelto.ResolverPersonas([CedulaDe(_juan)], Ahora).ShouldBeEmpty();
    }

    [Fact]
    public void El_documento_de_la_persona_cubre_su_requisito_y_el_expediente_pasa_a_revision()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(null));
        e = Aplicar(e, e.ResolverPersonas([CedulaDe(_juan)], Ahora));

        e = Adjuntar(e, _cedulaDelFlujo, V(_docCedulaJuan, 1));

        e.BuscarRequisito(_cedulaDelFlujo)!.VersionActual!.DocumentoId.ShouldBe(_docCedulaJuan);
        e.Estado.ShouldBe(EstadoExpediente.EnRevision);
    }

    [Fact]
    public void Con_todas_las_relaciones_cada_persona_de_mas_entra_como_un_requisito_ya_cubierto_si_tiene_su_documento()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(_juan, todas: true));

        var eventos = e.ResolverPersonas([CedulaDe(_juan, todas: true), CedulaDe(_maria, V(Guid.NewGuid(), 3), todas: true)], Ahora);

        var agregados = eventos.ShouldHaveSingleItem().ShouldBeOfType<RequisitosDePersonaAgregados>();
        var nuevo = agregados.Requisitos.ShouldHaveSingleItem();
        nuevo.RequisitoId.ShouldBe(IdDe(_maria));
        nuevo.AreasQueRevisan.ShouldBe([_compras, _cumplimiento], ignoreOrder: true); // las áreas del flujo, como al abrir
        var ampliado = Aplicar(e, eventos);
        ampliado.BuscarRequisito(IdDe(_maria))!.VersionActual!.Numero.ShouldBe(3);
        ampliado.BuscarRequisito(IdDe(_juan))!.Persona!.PersonaId.ShouldBe(_juan);
    }

    [Fact]
    public void Si_cambia_el_representante_el_de_la_persona_saliente_se_exime_y_se_pide_el_de_la_nueva()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(_juan));

        var eventos = e.ResolverPersonas([CedulaDe(_maria)], Ahora);

        eventos.OfType<RequisitosDePersonaAgregados>().ShouldHaveSingleItem().Requisitos.ShouldHaveSingleItem().RequisitoId.ShouldBe(IdDe(_maria));
        var exento = eventos.OfType<RequisitoEximido>().ShouldHaveSingleItem();
        (exento.RequisitoId, exento.Por).ShouldBe((IdDe(_juan), Expediente.ExencionPorCambioDePersona.Por));
        var despues = Aplicar(e, eventos);
        despues.BuscarRequisito(IdDe(_juan))!.Eximido.ShouldBeTrue();
        despues.BuscarRequisito(IdDe(_maria))!.Estado.ShouldBe(EstadoRequisito.Pendiente);
        despues.ListoParaRevision.ShouldBeFalse(); // falta la cédula de la nueva
    }

    [Fact]
    public void Lo_que_la_empresa_ya_aprobo_de_la_persona_saliente_se_conserva()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(_juan, V(_docCedulaJuan, 1)));
        e = Aprobar(e, IdDe(_juan), _compras, _ana);
        e = Aprobar(e, IdDe(_juan), _cumplimiento, _beto);
        e.BuscarRequisito(IdDe(_juan))!.Estado.ShouldBe(EstadoRequisito.Aprobado);

        var eventos = e.ResolverPersonas([CedulaDe(_maria)], Ahora);

        eventos.OfType<RequisitoEximido>().ShouldBeEmpty(); // ya estaba aprobado: es lo que la empresa aceptó
        eventos.OfType<RequisitosDePersonaAgregados>().ShouldHaveSingleItem();
    }

    [Fact]
    public void Sin_nadie_que_cumpla_el_rol_el_expediente_no_cambia_y_un_expediente_cerrado_tampoco()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), CedulaDe(_juan));

        e.ResolverPersonas([CedulaDe(null)], Ahora).ShouldBeEmpty(); // el requisito de Juan sigue ahí hasta que haya quien lo reemplace

        var aprobado = EnRevision();
        aprobado = Aprobar(aprobado, _rut, _compras, _ana);
        aprobado = Aprobar(aprobado, _rut, _cumplimiento, _beto);
        aprobado = Aprobar(aprobado, _camara, _cumplimiento, _beto);
        aprobado.Estado.ShouldBe(EstadoExpediente.Aprobado);
        aprobado.ResolverPersonas([CedulaDe(_juan)], Ahora).ShouldBeEmpty();
    }

    [Fact]
    public void Un_rol_que_el_expediente_no_tenia_se_agrega_aunque_nadie_lo_cumpla_todavia()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)));

        var eventos = e.ResolverPersonas([CedulaDe(null)], Ahora);

        var agregado = eventos.ShouldHaveSingleItem().ShouldBeOfType<RequisitosDePersonaAgregados>().Requisitos.ShouldHaveSingleItem();
        agregado.Persona!.SinPersona.ShouldBeTrue();
        Aplicar(e, eventos).BuscarRequisito(_cedulaDelFlujo)!.Estado.ShouldBe(EstadoRequisito.Pendiente);
    }
}
