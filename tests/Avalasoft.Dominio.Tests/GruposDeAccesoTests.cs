using Avalasoft.Aplicacion.Comun;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Configuracion;
using Avalasoft.Dominio.Documentos;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.Flujos;
using Avalasoft.Dominio.Identidad;

namespace Avalasoft.Dominio.Tests;

/// <summary>Grupos de acceso (GA): unión de permisos entre roles y grupos, acotación por sector y la actualización ruteada al área responsable del sector.</summary>
public class GruposDeAccesoTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-5));
    private static readonly IReadOnlySet<string> Catalogo = Permisos.DeGrupo.ToHashSet();

    private static GrupoDePermisos Grupo(string codigo, string[] permisos, params SectorDeGrupo[] sectores) =>
        GrupoDePermisos.Crear(codigo, codigo, null, permisos, sectores, Catalogo, Ahora);

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    private static IReadOnlyList<ConcesionDeAcceso> Concesiones(Guid? empresa, params GrupoDePermisos[] grupos) =>
        [.. grupos.Select(g => ConcesionDeAcceso.DeGrupo(g, empresa)).OfType<ConcesionDeAcceso>()];

    // ---------- El grupo ----------

    [Fact]
    public void Un_grupo_se_crea_con_permisos_del_catalogo_y_sectores_opcionales()
    {
        var grupo = GrupoDePermisos.Crear(" tesoreria ", " Tesorería ", "  Revisa lo bancario ", [Permisos.ExpedientesLeer, Permisos.ExpedientesRevisar, Permisos.ExpedientesLeer],
            [new SectorDeGrupo("ficha_tributaria".ToUpperInvariant(), NivelDeSector.Editar)], Catalogo, Ahora);

        grupo.Codigo.ShouldBe("TESORERIA");
        grupo.Nombre.ShouldBe("Tesorería");
        grupo.Descripcion.ShouldBe("Revisa lo bancario");
        grupo.Permisos.ShouldBe([Permisos.ExpedientesLeer, Permisos.ExpedientesRevisar]);
        grupo.Activo.ShouldBeTrue();
        grupo.Sectores.ShouldHaveSingleItem().ShouldBe(new SectorDeGrupo(CodigosDeSeccion.Tributaria, NivelDeSector.Editar));
    }

    [Fact]
    public void Un_grupo_no_inventa_permisos_ni_acepta_datos_invalidos()
    {
        Codigo(() => GrupoDePermisos.Crear("1mal", "x", null, [Permisos.ExpedientesLeer], null, Catalogo, Ahora)).ShouldBe("codigo-invalido");
        Codigo(() => GrupoDePermisos.Crear("AUDITOR", "x", null, [Permisos.ExpedientesLeer], null, Catalogo, Ahora)).ShouldBe("codigo-reservado");
        Codigo(() => GrupoDePermisos.Crear("OK", " ", null, [Permisos.ExpedientesLeer], null, Catalogo, Ahora)).ShouldBe("nombre-requerido");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [], null, Catalogo, Ahora)).ShouldBe("permisos-requeridos");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, ["expedientes:inventado"], null, Catalogo, Ahora)).ShouldBe("permisos-invalidos");
        // Solo la API key de un sistema integrador abre sesiones del tercero: una persona no la lleva.
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [Permisos.SesionesTerceroCrear], null, Catalogo, Ahora)).ShouldBe("permisos-invalidos");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [Permisos.PlataformaTenants], null, Catalogo, Ahora)).ShouldBe("permisos-invalidos");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [Permisos.ExpedientesLeer], [new("FICHA_INVENTADA", NivelDeSector.Ver)], Catalogo, Ahora)).ShouldBe("sector-invalido");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [Permisos.ExpedientesLeer],
            [new(CodigosDeSeccion.General, NivelDeSector.Ver), new(CodigosDeSeccion.General, NivelDeSector.Editar)], Catalogo, Ahora)).ShouldBe("sector-duplicado");
        Codigo(() => GrupoDePermisos.Crear("OK", "x", null, [Permisos.ExpedientesLeer], [new(CodigosDeSeccion.General, (NivelDeSector)9)], Catalogo, Ahora)).ShouldBe("nivel-invalido");
    }

    [Fact]
    public void El_catalogo_de_un_grupo_es_el_del_tenant_sin_lo_que_solo_usa_una_llave()
    {
        Permisos.DeGrupo.ShouldAllBe(p => Permisos.DelTenant.Contains(p));
        Permisos.DeGrupo.ShouldNotContain(Permisos.SesionesTerceroCrear);
        Permisos.DeGrupo.ShouldNotContain(Permisos.PlataformaTenants);
        Permisos.DeGrupo.Count.ShouldBe(Permisos.DelTenant.Count - 1);
        Permisos.AcotablesPorSector.ShouldAllBe(p => Permisos.DeGrupo.Contains(p));
    }

    [Fact]
    public void Se_edita_se_desactiva_y_se_reactiva_sin_borrarse()
    {
        var grupo = Grupo("TESORERIA", [Permisos.ExpedientesLeer]);

        grupo.Actualizar("Tesorería y pagos", null, [Permisos.ExpedientesLeer, Permisos.CuentasAprobar], [new(CodigosDeSeccion.General, NivelDeSector.Ver)], Catalogo, Ahora.AddHours(1));
        grupo.Nombre.ShouldBe("Tesorería y pagos");
        grupo.Permisos.ShouldBe([Permisos.ExpedientesLeer, Permisos.CuentasAprobar]);
        grupo.ActualizadoEn.ShouldBe(Ahora.AddHours(1));
        Codigo(() => grupo.Reactivar(Ahora)).ShouldBe("grupo-activo");

        grupo.Desactivar(Ahora);
        grupo.Activo.ShouldBeFalse();
        Codigo(() => grupo.Desactivar(Ahora)).ShouldBe("grupo-inactivo");
        grupo.Reactivar(Ahora);
        grupo.Activo.ShouldBeTrue();
    }

    [Fact]
    public void Los_cuatro_roles_fijos_son_grupos_predefinidos_con_id_y_codigo_estables()
    {
        GruposPredefinidos.Roles.ShouldBe([Rol.Administrador, Rol.Revisor, Rol.OficialCumplimiento, Rol.Auditor]);
        GruposPredefinidos.Roles.Select(GruposPredefinidos.IdDe).Distinct().Count().ShouldBe(4);
        foreach (var rol in GruposPredefinidos.Roles)
        {
            GruposPredefinidos.RolDe(GruposPredefinidos.IdDe(rol)).ShouldBe(rol);
            GruposPredefinidos.EsCodigoReservado(GruposPredefinidos.CodigoDe(rol)).ShouldBeTrue();
        }

        GruposPredefinidos.RolDe(Guid.NewGuid()).ShouldBeNull();
    }

    [Fact]
    public void El_usuario_guarda_sus_grupos_sin_repetir_y_un_grupo_de_todo_el_tenant_hace_redundante_el_de_una_empresa()
    {
        var usuario = Usuario.Crear("Camila", "camila@norte.co", null, Ahora);
        var g = Guid.NewGuid();
        var empresa = Guid.NewGuid();

        usuario.AsignarGrupos([new(g, empresa), new(g, null), new(g, null)]);

        usuario.Grupos.ShouldBe([new AsignacionDeGrupo(g, null)]);
        usuario.TieneRolEn(empresa).ShouldBeTrue();
        usuario.TieneRolEn(Guid.NewGuid()).ShouldBeTrue();

        var otro = Usuario.Crear("Otro", "otro@norte.co", null, Ahora);
        otro.AsignarGrupos([new(g, empresa)]);
        otro.TieneRolEn(empresa).ShouldBeTrue();
        otro.TieneRolEn(Guid.NewGuid()).ShouldBeFalse();

        usuario.Desactivar();
        Codigo(() => usuario.AsignarGrupos([])).ShouldBe("usuario-inactivo");
    }

    // ---------- Unión de permisos ----------

    [Fact]
    public void Los_permisos_efectivos_son_la_union_de_los_roles_y_los_grupos()
    {
        var pagos = Grupo("PAGOS", [Permisos.CuentasAprobar, Permisos.VinculosLeer]);
        var lectura = Grupo("LECTURA", [Permisos.ExpedientesLeer, Permisos.VinculosLeer]);

        var efectivos = Permisos.ParaUsuario([new(Rol.Auditor, null)], Concesiones(null, pagos, lectura), Permisos.DelTenant, ["*"]);

        Permisos.DeRol(Rol.Auditor).ShouldAllBe(p => efectivos.DeTenant.Contains(p));
        efectivos.DeTenant.ShouldContain(Permisos.CuentasAprobar);
        efectivos.DeTenant.ShouldContain(Permisos.ExpedientesLeer);
        efectivos.DeTenant.ShouldNotContain(Permisos.ExpedientesRevisar);
        efectivos.Empresas.ShouldBe(["*"]);
    }

    [Fact]
    public void Una_persona_solo_con_grupos_tiene_sus_permisos_y_sus_empresas()
    {
        var empresa = Guid.NewGuid();
        var pagos = Grupo("PAGOS", [Permisos.CuentasAprobar]);

        var efectivos = Permisos.ParaUsuario([], Concesiones(empresa, pagos), Permisos.DelTenant, ["*"]);

        efectivos.DeTenant.ShouldBeEmpty();
        efectivos.EnEmpresa(empresa).ShouldBe([Permisos.CuentasAprobar]);
        efectivos.EnEmpresa(Guid.NewGuid()).ShouldBeEmpty();
        efectivos.Empresas.ShouldBe([empresa.ToString()]);
    }

    [Fact]
    public void Un_grupo_desactivado_no_da_nada_y_uno_que_ya_no_existe_tampoco()
    {
        var pagos = Grupo("PAGOS", [Permisos.CuentasAprobar]);
        var usuario = Usuario.Crear("Camila", "camila@norte.co", null, Ahora);
        usuario.AsignarGrupos([new(pagos.Id, null), new(Guid.NewGuid(), null)]);

        ConcesionDeAcceso.DeLosGruposDe(usuario, [pagos]).ShouldHaveSingleItem().Scopes.ShouldBe([Permisos.CuentasAprobar]);

        pagos.Desactivar(Ahora);
        ConcesionDeAcceso.DeLosGruposDe(usuario, [pagos]).ShouldBeEmpty();
        Permisos.ParaUsuario([], ConcesionDeAcceso.DeLosGruposDe(usuario, [pagos]), Permisos.DelTenant, ["*"]).DeTenant.ShouldBeEmpty();
    }

    [Fact]
    public void Lo_que_pasa_por_la_llave_se_interseca_con_los_grupos_y_la_administracion_del_tenant_solo_va_por_grupos_de_todo_el_tenant()
    {
        var empresa = Guid.NewGuid();
        var admin = Grupo("ADMINISTRACION", [Permisos.UsuariosAdministrar, Permisos.ApiKeysAdministrar, Permisos.ExpedientesLeer]);

        var porEmpresa = Permisos.ParaUsuario([], Concesiones(empresa, admin), Permisos.DelTenant, ["*"]);
        porEmpresa.EnEmpresa(empresa).ShouldBe([Permisos.ExpedientesLeer]);

        var deTenant = Permisos.ParaUsuario([], Concesiones(null, admin), [Permisos.UsuariosAdministrar, Permisos.ExpedientesRevisar], ["*"]);
        deTenant.DeTenant.ShouldBe([Permisos.UsuariosAdministrar]);

        var fuera = Permisos.ParaUsuario([], Concesiones(empresa, admin), Permisos.DelTenant, [Guid.NewGuid().ToString()]);
        fuera.PorEmpresa.ShouldBeEmpty();
        fuera.Empresas.ShouldBeEmpty();
    }

    [Fact]
    public void Sin_grupos_el_resultado_es_el_de_siempre_y_el_token_no_lleva_acotaciones()
    {
        var empresa = Guid.NewGuid();
        var roles = new RolAsignado[] { new(Rol.Revisor, null), new(Rol.Administrador, empresa) };

        var conGrupos = Permisos.ParaUsuario(roles, [], Permisos.DelTenant, ["*"]);
        var sin = Permisos.ParaUsuario(roles, Permisos.DelTenant, ["*"]);

        conGrupos.DeTenant.ShouldBe(sin.DeTenant, ignoreOrder: true);
        conGrupos.PorEmpresa.Keys.ShouldBe(sin.PorEmpresa.Keys);
        conGrupos.SectoresRestringidos.ShouldBeEmpty();
    }

    // ---------- Acotación por sector ----------

    [Fact]
    public void Un_grupo_acotado_ve_los_sectores_de_su_lista_y_solo_actua_sobre_los_de_nivel_Editar()
    {
        var bancaria = Grupo("TESORERIA", [Permisos.ExpedientesLeer, Permisos.ExpedientesRevisar, Permisos.FlujosLeer],
            new SectorDeGrupo(CodigosDeSeccion.General, NivelDeSector.Editar), new SectorDeGrupo(CodigosDeSeccion.Tributaria, NivelDeSector.Ver));

        var efectivos = Permisos.ParaUsuario([], Concesiones(null, bancaria), Permisos.DelTenant, ["*"]);

        var revisar = efectivos.SectoresRestringidos.Single(r => r.Scope == Permisos.ExpedientesRevisar);
        revisar.Ver.Sectores.ShouldBe([CodigosDeSeccion.General, CodigosDeSeccion.Tributaria], ignoreOrder: true);
        revisar.Editar.Sectores.ShouldBe([CodigosDeSeccion.General]);
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesRevisar, NivelDeSector.Editar, null).Permite(CodigosDeSeccion.General).ShouldBeTrue();
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesRevisar, NivelDeSector.Editar, null).Permite(CodigosDeSeccion.Tributaria).ShouldBeFalse();
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesLeer, NivelDeSector.Ver, null).Permite(CodigosDeSeccion.Tributaria).ShouldBeTrue();
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesLeer, NivelDeSector.Ver, null).Permite(CodigosDeSeccion.Legal).ShouldBeFalse();
        // Solo se acotan los permisos que miran la ficha: flujos:leer no lleva entrada.
        efectivos.SectoresRestringidos.ShouldNotContain(r => r.Scope == Permisos.FlujosLeer);
    }

    [Fact]
    public void Dos_grupos_acotados_se_suman_y_uno_sin_acotar_que_da_el_mismo_permiso_lo_libera()
    {
        var tributaria = Grupo("TRIBUTARIA", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.Tributaria, NivelDeSector.Editar));
        var legal = Grupo("LEGAL", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.Legal, NivelDeSector.Editar));
        var todo = Grupo("TODO", [Permisos.ExpedientesRevisar]);

        var suma = Permisos.ParaUsuario([], Concesiones(null, tributaria, legal), Permisos.DelTenant, ["*"]);
        suma.SectoresRestringidos.ShouldHaveSingleItem().Editar.Sectores.ShouldBe([CodigosDeSeccion.Tributaria, CodigosDeSeccion.Legal], ignoreOrder: true);

        Permisos.ParaUsuario([], Concesiones(null, tributaria, legal, todo), Permisos.DelTenant, ["*"]).SectoresRestringidos.ShouldBeEmpty();
        Permisos.ParaUsuario([new(Rol.Revisor, null)], Concesiones(null, tributaria), Permisos.DelTenant, ["*"]).SectoresRestringidos.ShouldBeEmpty();
    }

    [Fact]
    public void Un_grupo_sin_acotar_que_no_da_el_permiso_no_libera_la_acotacion_de_otro()
    {
        // La acotación es de cada permiso: quien revisa solo Tributaria y además tiene un grupo de lectura sin acotar no puede revisar Legal.
        var revisaTributaria = Grupo("REVISA", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.Tributaria, NivelDeSector.Editar));
        var lectura = Grupo("LECTURA", [Permisos.ExpedientesLeer]);

        var efectivos = Permisos.ParaUsuario([], Concesiones(null, revisaTributaria, lectura), Permisos.DelTenant, ["*"]);

        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesRevisar, NivelDeSector.Editar, null).Permite(CodigosDeSeccion.Legal).ShouldBeFalse();
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesLeer, NivelDeSector.Ver, null).Permite(CodigosDeSeccion.Legal).ShouldBeTrue();
    }

    [Fact]
    public void La_acotacion_de_una_empresa_se_suma_a_la_del_tenant_solo_en_esa_empresa()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var general = Grupo("GENERAL", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.General, NivelDeSector.Editar));
        var todoEnA = Grupo("TODO_A", [Permisos.ExpedientesRevisar]);
        var legalEnB = Grupo("LEGAL_B", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.Legal, NivelDeSector.Editar));

        var efectivos = Permisos.ParaUsuario([], [.. Concesiones(null, general), .. Concesiones(a, todoEnA), .. Concesiones(b, legalEnB)], Permisos.DelTenant, ["*"]);

        bool Edita(Guid? empresa, string sector) =>
            Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesRevisar, NivelDeSector.Editar, empresa).Permite(sector);
        Edita(null, CodigosDeSeccion.General).ShouldBeTrue();
        Edita(null, CodigosDeSeccion.Legal).ShouldBeFalse();
        Edita(a, CodigosDeSeccion.Legal).ShouldBeTrue(); // un grupo sin acotar en A libera A, no el resto
        Edita(b, CodigosDeSeccion.General).ShouldBeTrue();
        Edita(b, CodigosDeSeccion.Legal).ShouldBeTrue();
        Edita(b, CodigosDeSeccion.Tributaria).ShouldBeFalse();
        Edita(Guid.NewGuid(), CodigosDeSeccion.Legal).ShouldBeFalse();
    }

    [Fact]
    public void Un_grupo_acotado_solo_en_una_empresa_deja_el_resto_de_empresas_sin_ese_permiso()
    {
        var a = Guid.NewGuid();
        var solo = Grupo("SOLO_A", [Permisos.ExpedientesRevisar], new SectorDeGrupo(CodigosDeSeccion.Legal, NivelDeSector.Editar));

        var efectivos = Permisos.ParaUsuario([], Concesiones(a, solo), Permisos.DelTenant, ["*"]);

        efectivos.EnEmpresa(a).ShouldContain(Permisos.ExpedientesRevisar);
        efectivos.EnEmpresa(null).ShouldNotContain(Permisos.ExpedientesRevisar);
        var entrada = efectivos.SectoresRestringidos.ShouldHaveSingleItem();
        entrada.EmpresaId.ShouldBe(a);
        Permisos.AlcanceEn(efectivos.SectoresRestringidos, Permisos.ExpedientesRevisar, NivelDeSector.Editar, a).Permite(CodigosDeSeccion.General).ShouldBeFalse();
    }

    [Fact]
    public void La_acotacion_viaja_en_el_token_y_lo_ilegible_falla_cerrado()
    {
        var empresa = Guid.NewGuid();
        var original = new SectorRestringido(Permisos.ExpedientesRevisar, empresa, AlcanceDeSectores.Todo,
            AlcanceDeSectores.De([CodigosDeSeccion.General, CodigosDeSeccion.Legal]));

        var leido = SectorRestringido.Decodificar(original.Codificar()).ShouldNotBeNull();
        leido.Scope.ShouldBe(Permisos.ExpedientesRevisar);
        leido.EmpresaId.ShouldBe(empresa);
        leido.Ver.Todos.ShouldBeTrue();
        leido.Editar.Sectores.ShouldBe([CodigosDeSeccion.General, CodigosDeSeccion.Legal], ignoreOrder: true);

        var delTenant = SectorRestringido.Decodificar(new SectorRestringido(Permisos.TercerosLeer, null, AlcanceDeSectores.De([]), AlcanceDeSectores.De([])).Codificar()).ShouldNotBeNull();
        delTenant.EmpresaId.ShouldBeNull();
        delTenant.Ver.Todos.ShouldBeFalse();
        delTenant.Ver.Sectores.ShouldBeEmpty();

        // Un reclamo mal formado nunca libera: queda sin ningún sector. Sin siquiera el permiso, se ignora.
        SectorRestringido.Decodificar("expedientes:revisar|no-es-guid|*|*").ShouldNotBeNull().Editar.Permite(CodigosDeSeccion.General).ShouldBeFalse();
        SectorRestringido.Decodificar("expedientes:revisar|*").ShouldNotBeNull().Ver.Permite(CodigosDeSeccion.General).ShouldBeFalse();
        SectorRestringido.Decodificar("").ShouldBeNull();
    }

    [Fact]
    public void Sin_acotaciones_cualquier_credencial_alcanza_todos_los_sectores()
    {
        Permisos.AlcanceEn([], Permisos.ExpedientesRevisar, NivelDeSector.Editar, Guid.NewGuid()).Todos.ShouldBeTrue();
        AlcanceDeSectores.Todo.Permite(CodigosDeSeccion.Sst).ShouldBeTrue();
        AlcanceDeSectores.Todo.Permite(null).ShouldBeTrue();
        AlcanceDeSectores.De([CodigosDeSeccion.Sst]).Permite(null).ShouldBeFalse();
    }

    // ---------- Actualización por sector con responsable ----------

    private static readonly Guid Tesoreria = Guid.NewGuid();
    private static readonly Guid Contabilidad = Guid.NewGuid();
    private static readonly Guid Legal = Guid.NewGuid();

    private static RequisitoCalculado SeccionPedida(string codigo, params Guid[] areas) =>
        new(Guid.NewGuid(), Guid.Empty, codigo, codigo, codigo, AmbitoDocumento.Global, true, areas, null, null, TipoRequisito: TipoDeRequisito.Seccion, Seccion: codigo);

    private static RequisitoCalculado DocumentoPedido(params Guid[] areas) =>
        new(Guid.NewGuid(), Guid.NewGuid(), "RUT", "RUT", "RUT", AmbitoDocumento.Global, true, areas, null, null);

    [Fact]
    public void Cada_seccion_cambiada_va_solo_al_area_responsable_de_su_sector()
    {
        var general = SeccionPedida(CodigosDeSeccion.General);
        var tributaria = SeccionPedida(CodigosDeSeccion.Tributaria);
        IReadOnlyList<ResponsableDeSector> responsables =
            [new(CodigosDeSeccion.General, Contabilidad), new(CodigosDeSeccion.Tributaria, Tesoreria)];

        var ruteados = ResponsablesDeActualizacion.Enrutar([general, tributaria], responsables, [Tesoreria, Contabilidad, Legal]);

        ruteados[0].AreasQueRevisan.ShouldBe([Contabilidad]);
        ruteados[1].AreasQueRevisan.ShouldBe([Tesoreria]);
    }

    [Fact]
    public void Un_sector_sin_responsable_conserva_sus_areas_o_todas_y_los_documentos_no_se_tocan()
    {
        var sinAreas = SeccionPedida(CodigosDeSeccion.Legal);
        var conAreas = SeccionPedida(CodigosDeSeccion.Financiera, Legal, Contabilidad);
        var documento = DocumentoPedido(Legal);
        IReadOnlyList<ResponsableDeSector> responsables = [new(CodigosDeSeccion.General, Tesoreria)];

        var ruteados = ResponsablesDeActualizacion.Enrutar([sinAreas, conAreas, documento], responsables, [Tesoreria, Contabilidad, Legal]);

        ruteados[0].AreasQueRevisan.ShouldBeEmpty(); // vacío = todas, como hoy
        ruteados[1].AreasQueRevisan.ShouldBe([Legal, Contabilidad]);
        ruteados[2].AreasQueRevisan.ShouldBe([Legal]);
        ResponsablesDeActualizacion.Enrutar([sinAreas], null, [Tesoreria]).ShouldBe([sinAreas]);
        ResponsablesDeActualizacion.Enrutar([sinAreas], [], [Tesoreria]).ShouldBe([sinAreas]);
    }

    [Fact]
    public void El_responsable_de_la_actualizacion_manda_sobre_las_areas_del_requisito_de_la_revision_inicial()
    {
        var tributaria = SeccionPedida(CodigosDeSeccion.Tributaria, Legal, Contabilidad, Tesoreria);

        var ruteadas = ResponsablesDeActualizacion.Enrutar([tributaria], [new(CodigosDeSeccion.Tributaria, Tesoreria)], [Legal, Contabilidad, Tesoreria]);

        ruteadas.ShouldHaveSingleItem().AreasQueRevisan.ShouldBe([Tesoreria]);
    }

    [Fact]
    public void Un_responsable_que_ya_no_participa_en_el_flujo_no_deja_la_seccion_sin_revisor()
    {
        var general = SeccionPedida(CodigosDeSeccion.General);

        var ruteadas = ResponsablesDeActualizacion.Enrutar([general], [new(CodigosDeSeccion.General, Tesoreria)], [Legal, Contabilidad]);

        ruteadas.ShouldHaveSingleItem().AreasQueRevisan.ShouldBeEmpty();
    }

    // ---------- El flujo guarda los responsables ----------

    private readonly Guid _empresa = Guid.NewGuid();

    private (Area Tesoreria, Area Contabilidad, Area Fuera, DefinicionDeFlujo Definicion) Flujo()
    {
        var tesoreria = Area.Crear(_empresa, "TESORERIA", "Tesorería");
        var contabilidad = Area.Crear(_empresa, "CONTABILIDAD", "Contabilidad");
        var fuera = Area.Crear(_empresa, "SST", "Seguridad y salud");
        var definicion = DefinicionDeFlujo.TodasEnParalelo([tesoreria, contabilidad]);
        return (tesoreria, contabilidad, fuera, definicion);
    }

    [Fact]
    public void El_flujo_valida_y_normaliza_los_responsables_por_sector()
    {
        var (tesoreria, contabilidad, fuera, definicion) = Flujo();
        IReadOnlyCollection<Area> areas = [tesoreria, contabilidad, fuera];

        var valida = (definicion with { ResponsablesDeSector = [new("ficha_tributaria", tesoreria.Id), new(CodigosDeSeccion.General, contabilidad.Id)] })
            .Validar(_empresa, areas);
        valida.ResponsablesDeSector.ShouldBe([new ResponsableDeSector(CodigosDeSeccion.Tributaria, tesoreria.Id), new(CodigosDeSeccion.General, contabilidad.Id)]);

        Codigo(() => (definicion with { ResponsablesDeSector = [new("FICHA_INVENTADA", tesoreria.Id)] }).Validar(_empresa, areas)).ShouldBe("sector-invalido");
        Codigo(() => (definicion with { ResponsablesDeSector = [new(CodigosDeSeccion.General, tesoreria.Id), new(CodigosDeSeccion.General, contabilidad.Id)] })
            .Validar(_empresa, areas)).ShouldBe("sector-duplicado");
        Codigo(() => (definicion with { ResponsablesDeSector = [new(CodigosDeSeccion.General, fuera.Id)] }).Validar(_empresa, areas)).ShouldBe("responsable-area-invalida");
        definicion.Validar(_empresa, areas).ResponsablesDeSector.ShouldBeEmpty();
    }

    [Fact]
    public void Los_responsables_se_congelan_con_la_version_publicada_y_una_edicion_nueva_no_cambia_lo_publicado()
    {
        var (tesoreria, contabilidad, _, definicion) = Flujo();
        IReadOnlyCollection<Area> areas = [tesoreria, contabilidad];
        var flujo = Dominio.Flujos.Flujo.Crear(_empresa, "HAB", "Habilitación", Guid.NewGuid(),
            definicion with { ResponsablesDeSector = [new(CodigosDeSeccion.Tributaria, tesoreria.Id)] }, areas, Ahora);

        var publicada = flujo.Publicar(areas, Ahora);
        publicada.ResponsablesDeSector.ShouldBe([new ResponsableDeSector(CodigosDeSeccion.Tributaria, tesoreria.Id)]);

        var borrador = flujo.EditarBorrador(null, flujo.Ultima.Definicion() with { ResponsablesDeSector = [new(CodigosDeSeccion.General, contabilidad.Id)] }, areas, Ahora);
        borrador.ResponsablesDeSector.ShouldBe([new ResponsableDeSector(CodigosDeSeccion.General, contabilidad.Id)]);
        flujo.VersionPublicada!.ResponsablesDeSector.ShouldBe([new ResponsableDeSector(CodigosDeSeccion.Tributaria, tesoreria.Id)]);

        flujo.EditarBorrador(null, borrador.Definicion() with { ResponsablesDeSector = [] }, areas, Ahora).ResponsablesDeSector.ShouldBeEmpty();
    }
}
