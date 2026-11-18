using Avalasoft.Dominio.Documentos;
using Avalasoft.Dominio.Expedientes;

namespace Avalasoft.Dominio.Tests;

// Recálculo según la ficha del tercero (EF-5): el expediente abierto suma los documentos que su especialidad (u otro campo de la ficha) hace aplicar, deja en NoAplica
// los que ya no, los vuelve a exigir si lo declarado vuelve, y nunca toca lo aprobado, lo eximido a mano ni un expediente cerrado.
public partial class RequisitosExpedienteTests
{
    private readonly Guid _licencia = Guid.NewGuid();
    private readonly Guid _docLicencia = Guid.NewGuid();

    private static readonly IReadOnlyList<MotivoDeExigencia> PorObraGris = [new("ficha.especialidades.especialidades", "Especialidades", ["Obra gris"])];
    private static readonly IReadOnlyList<MotivoDeExigencia> PorObraGrisYAcabados =
        [new("ficha.especialidades.especialidades", "Especialidades", ["Obra gris", "Acabados"])];

    private static readonly IReadOnlySet<Guid> Ninguno = new HashSet<Guid>();

    private RequisitoCalculado Licencia(VersionDeRequisito? version = null, IReadOnlyList<MotivoDeExigencia>? porQue = null) =>
        new(_licencia, Guid.NewGuid(), "LICENCIA_DE_CONSTRUCCION", "Licencia de construcción", null, AmbitoDocumento.PorVinculo, true, [_cumplimiento], null, version,
            PorQue: porQue);

    private IReadOnlySet<Guid> Solo(Guid id) => new HashSet<Guid> { id };

    /// <summary>Los motivos como texto: el expediente se clona entre eventos y las listas de valores no se comparan por referencia.</summary>
    private static IEnumerable<string> Texto(IEnumerable<MotivoDeExigencia>? motivos) => (motivos ?? []).Select(m => $"{m.Campo}|{m.Etiqueta}|{string.Join(",", m.Valores)}");

    [Fact]
    public void Una_especialidad_nueva_suma_el_documento_con_su_porque_y_frena_la_revision()
    {
        var e = EnRevision();

        var eventos = e.ResolverSegunFicha([Licencia(porQue: PorObraGris)], Ninguno, Ninguno, [], Ahora);

        var resuelto = eventos.ShouldHaveSingleItem().ShouldBeOfType<RequisitosSegunFichaResueltos>();
        var agregado = resuelto.Agregados.ShouldHaveSingleItem();
        agregado.RequisitoId.ShouldBe(_licencia);
        agregado.AreasQueRevisan.ShouldBe([_cumplimiento]);
        var despues = Aplicar(e, eventos);
        var licencia = despues.BuscarRequisito(_licencia)!;
        licencia.Estado.ShouldBe(EstadoRequisito.Pendiente);
        Texto(licencia.PorQue).ShouldBe(Texto(PorObraGris));
        licencia.NoAplica.ShouldBeFalse();
        despues.Requisitos.Count.ShouldBe(3);
        despues.ListoParaRevision.ShouldBeFalse(); // falta el documento de la especialidad
    }

    [Fact]
    public void Lo_nuevo_reabre_la_etapa_de_las_areas_que_ya_habian_aprobado_y_repetir_el_recalculo_no_agrega_dos_veces()
    {
        var e = EnRevision();
        e = Aprobar(e, _rut, _compras, _ana);
        e = Aprobar(e, _rut, _cumplimiento, _beto);
        e = Aprobar(e, _camara, _cumplimiento, _beto);
        e.Estado.ShouldBe(EstadoExpediente.Aprobado);

        // Un expediente ya aprobado no se toca (la especialidad declarada después es de la siguiente actualización).
        e.ResolverSegunFicha([Licencia(porQue: PorObraGris)], Ninguno, Ninguno, [], Ahora).ShouldBeEmpty();

        var abierto = EnRevision();
        abierto = Aprobar(abierto, _rut, _compras, _ana);
        abierto = Aprobar(abierto, _camara, _cumplimiento, _beto);
        var eventos = abierto.ResolverSegunFicha([Licencia(porQue: PorObraGris)], Ninguno, Ninguno, [], Ahora);
        var despues = Aplicar(abierto, eventos);
        despues.Estado.ShouldNotBe(EstadoExpediente.Aprobado);
        despues.BuscarRequisito(_licencia)!.Estado.ShouldBe(EstadoRequisito.Pendiente);

        despues.ResolverSegunFicha([Licencia(porQue: PorObraGris)], Ninguno, Ninguno, [], Ahora).ShouldBeEmpty(); // idempotente
    }

    [Fact]
    public void Un_documento_ya_cubierto_por_la_boveda_entra_con_su_version_y_las_areas_lo_revisan()
    {
        var e = EnRevision();

        var despues = Aplicar(e, e.ResolverSegunFicha([Licencia(V(_docLicencia, 2), PorObraGris)], Ninguno, Ninguno, [], Ahora));

        var licencia = despues.BuscarRequisito(_licencia)!;
        (licencia.Estado, licencia.VersionActual!.Numero).ShouldBe((EstadoRequisito.EnRevision, 2));
        despues.Estado.ShouldBe(EstadoExpediente.EnRevision);
    }

    [Fact]
    public void Si_el_tercero_quita_la_especialidad_el_documento_pendiente_pasa_a_NoAplica_y_el_expediente_ya_puede_revisarse()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(porQue: PorObraGris));
        e.Estado.ShouldBe(EstadoExpediente.Abierto); // espera la licencia
        e.ListoParaRevision.ShouldBeFalse();

        var eventos = e.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora);

        eventos.OfType<RequisitosSegunFichaResueltos>().ShouldHaveSingleItem().NoAplican.ShouldBe([_licencia]);
        var despues = Aplicar(e, eventos);
        var licencia = despues.BuscarRequisito(_licencia)!;
        licencia.Estado.ShouldBe(EstadoRequisito.NoAplica);
        (licencia.NoAplica, licencia.Eximido, licencia.EximidoPor).ShouldBe((true, true, Expediente.NoAplicaPorFicha.Por));
        licencia.Cuenta.ShouldBeFalse();
        despues.RequisitosDelArea(_cumplimiento).Select(r => r.Id).ShouldBe([_rut, _camara], ignoreOrder: true);
        despues.ListoParaRevision.ShouldBeTrue();
        despues.Estado.ShouldBe(EstadoExpediente.EnRevision); // ya no espera un documento que no le toca
        despues.Requisitos.Count.ShouldBe(3); // sigue en el expediente, solo que sin exigirse
    }

    [Fact]
    public void Un_requisito_que_ya_no_aplica_invalida_sus_decisiones_y_su_documento_no_cuenta_para_las_areas()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(V(_docLicencia, 1), PorObraGris));
        e = Observar(e, _licencia, _cumplimiento, _beto);
        e.BuscarRequisito(_licencia)!.Veredictos.ShouldContain(v => v.Vigente);

        var despues = Aplicar(e, e.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora));

        var licencia = despues.BuscarRequisito(_licencia)!;
        licencia.Veredictos.ShouldNotContain(v => v.Vigente);
        licencia.Estado.ShouldBe(EstadoRequisito.NoAplica);
        despues.RequisitosConObservacion().ShouldBeEmpty();
        despues.RequisitosDelArea(_cumplimiento).ShouldNotContain(r => r.Id == _licencia);
    }

    [Fact]
    public void Lo_ya_aprobado_y_lo_eximido_a_mano_no_pasan_a_NoAplica()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(V(_docLicencia, 1), PorObraGris));
        var aprobado = Aprobar(e, _licencia, _cumplimiento, _beto);
        aprobado.BuscarRequisito(_licencia)!.Estado.ShouldBe(EstadoRequisito.Aprobado);

        aprobado.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora).ShouldBeEmpty(); // es lo que la empresa aceptó

        var eximido = Aplicar(e, e.EximirRequisito(_licencia, "administrador", "La empresa no la persigue.", Ahora));
        eximido.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora).ShouldBeEmpty();
        eximido.BuscarRequisito(_licencia)!.Estado.ShouldBe(EstadoRequisito.Eximido); // sigue siendo una exención y no un «no aplica»
    }

    [Fact]
    public void Si_el_tercero_vuelve_a_declarar_la_especialidad_el_documento_se_vuelve_a_exigir_y_sus_areas_lo_revisan_de_nuevo()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(V(_docLicencia, 1), PorObraGris));
        e = Aplicar(e, e.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora));
        e.BuscarRequisito(_licencia)!.Estado.ShouldBe(EstadoRequisito.NoAplica);

        var eventos = e.ResolverSegunFicha([], Ninguno, Solo(_licencia), [new MotivosDelRequisito(_licencia, PorObraGris)], Ahora);

        eventos.OfType<RequisitosSegunFichaResueltos>().ShouldHaveSingleItem().VuelvenAAplicar.ShouldBe([_licencia]);
        var despues = Aplicar(e, eventos);
        var licencia = despues.BuscarRequisito(_licencia)!;
        (licencia.NoAplica, licencia.Eximido, licencia.EximidoPor, licencia.JustificacionExencion).ShouldBe((false, false, null, null));
        licencia.Estado.ShouldBe(EstadoRequisito.EnRevision); // conserva el documento que ya tenía
        Texto(licencia.PorQue).ShouldBe(Texto(PorObraGris));
        despues.RequisitosDelArea(_cumplimiento).Select(r => r.Id).ShouldContain(_licencia);
        despues.ResolverSegunFicha([], Ninguno, Solo(_licencia), [], Ahora).ShouldBeEmpty(); // idempotente: ya no está en NoAplica
    }

    [Fact]
    public void El_porque_se_actualiza_solo_cuando_cambia_y_no_se_toca_en_el_que_sale()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(porQue: PorObraGris));

        e.ResolverSegunFicha([], Ninguno, Ninguno, [new MotivosDelRequisito(_licencia, PorObraGris)], Ahora).ShouldBeEmpty(); // lo mismo: nada

        var eventos = e.ResolverSegunFicha([], Ninguno, Ninguno, [new MotivosDelRequisito(_licencia, PorObraGrisYAcabados)], Ahora);
        var resuelto = eventos.ShouldHaveSingleItem().ShouldBeOfType<RequisitosSegunFichaResueltos>();
        Texto(resuelto.Motivos.ShouldHaveSingleItem().Motivos).ShouldBe(Texto(PorObraGrisYAcabados));
        Texto(Aplicar(e, eventos).BuscarRequisito(_licencia)!.PorQue).ShouldBe(Texto(PorObraGrisYAcabados));

        // Si deja de aplicar, no se discute su porqué: pasa a NoAplica.
        var sale = e.ResolverSegunFicha([], Solo(_licencia), Ninguno, [new MotivosDelRequisito(_licencia, PorObraGrisYAcabados)], Ahora);
        sale.OfType<RequisitosSegunFichaResueltos>().ShouldHaveSingleItem().Motivos.ShouldBeEmpty();
    }

    [Fact]
    public void Un_requisito_de_la_ficha_que_ya_no_aplica_no_se_puede_eximir_a_mano_y_no_adjunta_versiones()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(V(_docLicencia, 1), PorObraGris));
        e = Aplicar(e, e.ResolverSegunFicha([], Solo(_licencia), Ninguno, [], Ahora));

        Codigo(() => e.EximirRequisito(_licencia, "administrador", "x", Ahora)).ShouldBe("requisito-no-aplica");
        Aplicar(e, e.SincronizarVersiones(new Dictionary<Guid, VersionDeRequisito> { [_licencia] = V(_docLicencia, 2) }, Ahora))
            .BuscarRequisito(_licencia)!.VersionActual!.Numero.ShouldBe(1); // una versión nueva no reactiva lo que no aplica
    }

    [Fact]
    public void Si_no_hay_diferencias_o_el_requisito_ya_existe_no_emite_nada()
    {
        var e = Abrir(Flujo(), Rut(V(_docRut, 1)), Camara(V(_docCamara, 1)), Licencia(porQue: PorObraGris));

        e.ResolverSegunFicha([], Ninguno, Ninguno, [], Ahora).ShouldBeEmpty();
        e.ResolverSegunFicha([Licencia(porQue: PorObraGris)], Ninguno, Ninguno, [], Ahora).ShouldBeEmpty(); // ya lo tiene
        e.ResolverSegunFicha([], Solo(Guid.NewGuid()), Solo(_licencia), [], Ahora).ShouldBeEmpty(); // un id que no está y uno que no estaba en NoAplica
    }
}
