using Validalo.Dominio.Comun;
using Validalo.Dominio.Identidad;
using Validalo.Dominio.Plataforma;

namespace Validalo.Dominio.Tests;

/// <summary>Lo que Plataforma corrige del alta de un grupo y de su administrador desde la ficha del grupo (decisión FG).</summary>
public sealed class FichaDelGrupoTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 17, 9, 0, 0, TimeSpan.FromHours(-5));

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    private static Tenant Grupo() => Tenant.Crear("grupo-andino", "Grupo Andino", "co", "America/Bogota", Ahora);

    // ---------- el grupo ----------

    [Fact]
    public void Corregir_el_grupo_cambia_nombre_region_y_zona_con_las_reglas_del_alta_y_no_toca_el_slug()
    {
        var grupo = Grupo();
        var id = grupo.Id;

        grupo.CorregirDatos("  Grupo Andino Constructores ", " PA ", "America/Panama").ShouldBeTrue();

        (grupo.Id, grupo.Slug, grupo.Nombre, grupo.Region, grupo.ZonaHoraria).ShouldBe((id, "grupo-andino", "Grupo Andino Constructores", "pa", "America/Panama"));
    }

    [Fact]
    public void Los_mismos_datos_no_cambian_nada_y_lo_dicen()
    {
        var grupo = Grupo();

        grupo.CorregirDatos("Grupo Andino", "co", "America/Bogota").ShouldBeFalse();
        grupo.CorregirDatos(" Grupo Andino ", "CO", " America/Bogota ").ShouldBeFalse();
        grupo.CorregirDatos("Grupo Andino", null, null).ShouldBeFalse();
    }

    [Fact]
    public void Una_region_o_zona_nulas_conservan_y_vacias_vuelven_a_las_del_alta()
    {
        var grupo = Grupo();
        grupo.CorregirDatos("Grupo Andino", "pa", "America/Panama");

        grupo.CorregirDatos("Grupo Andino", null, null).ShouldBeFalse();
        (grupo.Region, grupo.ZonaHoraria).ShouldBe(("pa", "America/Panama"));

        grupo.CorregirDatos("Grupo Andino", " ", "").ShouldBeTrue();
        (grupo.Region, grupo.ZonaHoraria).ShouldBe(("co", "America/Bogota"));
    }

    [Fact]
    public void Un_dato_invalido_se_rechaza_entero_y_deja_el_grupo_como_estaba()
    {
        var grupo = Grupo();

        Codigo(() => grupo.CorregirDatos(" ", "pa", "America/Panama")).ShouldBe("nombre-requerido");
        Codigo(() => grupo.CorregirDatos("Otro nombre", "pa", "Marte/Olimpo")).ShouldBe("zona-horaria-invalida");

        (grupo.Nombre, grupo.Region, grupo.ZonaHoraria).ShouldBe(("Grupo Andino", "co", "America/Bogota"));
    }

    [Fact]
    public void El_sandbox_no_se_corrige_por_su_cuenta_y_sigue_a_su_grupo()
    {
        var produccion = Grupo();
        var sandbox = Tenant.CrearSandbox(produccion, Ahora);

        Codigo(() => sandbox.CorregirDatos("Otro", "co", "America/Bogota")).ShouldBe("copia-de-sandbox");

        produccion.CorregirDatos("Grupo Andino Constructores", "pa", "America/Panama");
        sandbox.AlinearConProduccion(produccion).ShouldBeTrue();
        (sandbox.Nombre, sandbox.Region, sandbox.ZonaHoraria, sandbox.Slug).ShouldBe(("Grupo Andino Constructores (sandbox)", "pa", "America/Panama", "grupo-andino~sandbox"));
        sandbox.AlinearConProduccion(produccion).ShouldBeFalse();

        Codigo(() => sandbox.AlinearConProduccion(Grupo())).ShouldBe("sandbox-ajeno");
    }

    // ---------- la persona ----------

    private static Usuario Admin() => Usuario.Crear("Camila Admin", "camila@andina.co", null, Ahora, Guid.NewGuid());

    [Fact]
    public void Corregir_a_la_persona_normaliza_el_correo_como_en_el_alta()
    {
        var admin = Admin();

        admin.CorregirDatos("  Camila Rojas ", " Camila.Rojas@Andina.CO ").ShouldBeTrue();

        (admin.Nombre, admin.Correo).ShouldBe(("Camila Rojas", "camila.rojas@andina.co"));
    }

    [Fact]
    public void Los_mismos_datos_de_la_persona_no_cambian_nada()
    {
        var admin = Admin();

        admin.CorregirDatos("Camila Admin", "CAMILA@andina.co").ShouldBeFalse();
        admin.CorregirDatos(" Camila Admin ", " camila@andina.co ").ShouldBeFalse();
    }

    [Theory]
    [InlineData("Camila", "sin-arroba", "correo-invalido")]
    [InlineData("Camila", "dos@@andina.co", "correo-invalido")]
    [InlineData("Camila", "", "correo-invalido")]
    [InlineData(" ", "camila@andina.co", "nombre-requerido")]
    public void Un_dato_invalido_de_la_persona_se_rechaza_y_deja_la_cuenta_como_estaba(string nombre, string correo, string esperado)
    {
        var admin = Admin();

        Codigo(() => admin.CorregirDatos(nombre, correo)).ShouldBe(esperado);

        (admin.Nombre, admin.Correo).ShouldBe(("Camila Admin", "camila@andina.co"));
    }

    [Fact]
    public void Las_identidades_externas_se_reemplazan_por_las_indicadas_una_por_sistema()
    {
        var erp = Guid.NewGuid();
        var portal = Guid.NewGuid();
        var admin = Admin();
        admin.EnlazarIdentidad(erp, "camila");

        admin.ReemplazarIdentidades([new IdentidadExterna(erp, " camila.rojas "), new IdentidadExterna(portal, "c-77")]).ShouldBeTrue();
        admin.Identidades.ShouldBe([new IdentidadExterna(erp, "camila.rojas"), new IdentidadExterna(portal, "c-77")]);

        admin.ReemplazarIdentidades([new IdentidadExterna(portal, "c-77"), new IdentidadExterna(erp, "camila.rojas")]).ShouldBeFalse();
        admin.ReemplazarIdentidades([]).ShouldBeTrue();
        admin.Identidades.ShouldBeEmpty();
    }

    [Fact]
    public void Una_identidad_vacia_o_repetida_en_el_mismo_sistema_se_rechaza_y_no_cambia_nada()
    {
        var erp = Guid.NewGuid();
        var admin = Admin();
        admin.EnlazarIdentidad(erp, "camila");

        Codigo(() => admin.ReemplazarIdentidades([new IdentidadExterna(erp, " ")])).ShouldBe("identidad-externa-invalida");
        Codigo(() => admin.ReemplazarIdentidades([new IdentidadExterna(erp, "a"), new IdentidadExterna(erp, "b")])).ShouldBe("identidades-repetidas");

        admin.Identidades.ShouldBe([new IdentidadExterna(erp, "camila")]);
    }
}
