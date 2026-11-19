using Validalo.Dominio.Comun;
using Validalo.Dominio.Identificaciones;
using Validalo.Dominio.Plataforma;

namespace Validalo.Dominio.Tests;

/// <summary>Datos y marca de la empresa (P2ConfigEmpresa): contacto de soporte, color de marca y logo.</summary>
public class EmpresaTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 9, 9, 0, 0, TimeSpan.FromHours(-5));

    private static Empresa Nueva() =>
        Empresa.Crear(Guid.NewGuid(), Identificacion.Crear("CO", "NIT", "800197268", "4"), "Constructora Norte S.A.S.", "norte", null, null, Ahora);

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    [Fact]
    public void Actualiza_soporte_color_y_logo_y_nulo_conserva_lo_que_habia()
    {
        var empresa = Nueva();
        var png = "data:image/png;base64," + Convert.ToBase64String(new byte[1024]);

        empresa.ActualizarMarca(" proveedores@norte.example ", "#e07a1f", png);
        empresa.ReplyTo.ShouldBe("proveedores@norte.example");
        empresa.ColorMarca.ShouldBe("#E07A1F");
        empresa.LogoUrl.ShouldBe(png);

        empresa.ActualizarMarca(null, null, null);
        empresa.ColorMarca.ShouldBe("#E07A1F");

        // Cadena vacía quita.
        empresa.ActualizarMarca("", "", "");
        empresa.ReplyTo.ShouldBeNull();
        empresa.ColorMarca.ShouldBeNull();
        empresa.LogoUrl.ShouldBeNull();

        empresa.ActualizarMarca(null, null, "https://cdn.norte.example/logo.svg");
        empresa.LogoUrl.ShouldBe("https://cdn.norte.example/logo.svg");
    }

    [Fact]
    public void Rechaza_correo_color_y_logo_invalidos()
    {
        var empresa = Nueva();
        Codigo(() => empresa.ActualizarMarca("no-es-correo", null, null)).ShouldBe("contacto-soporte-invalido");
        Codigo(() => empresa.ActualizarMarca(null, "naranja", null)).ShouldBe("color-marca-invalido");
        Codigo(() => empresa.ActualizarMarca(null, "#FFF", null)).ShouldBe("color-marca-invalido");
        Codigo(() => empresa.ActualizarMarca(null, null, "http://inseguro.example/logo.png")).ShouldBe("logo-invalido");
        Codigo(() => empresa.ActualizarMarca(null, null, "data:image/jpeg;base64,AAAA")).ShouldBe("logo-invalido");
        var grande = "data:image/png;base64," + Convert.ToBase64String(new byte[Empresa.TamanoMaximoLogo + 3]);
        Codigo(() => empresa.ActualizarMarca(null, null, grande)).ShouldBe("logo-demasiado-grande");
    }

    // ---------- corregir los datos de alta (consola de Plataforma) ----------

    [Fact]
    public void Corrige_identificacion_razon_social_y_prefijo_y_recalcula_la_clave_de_identificacion()
    {
        var empresa = Nueva();
        var id = empresa.Id;
        empresa.ActualizarMarca("soporte@norte.example", "#E07A1F", null);

        var cambio = empresa.CorregirDatosDeAlta(Identificacion.Crear("CO", "NIT", "900123456", "8"), "  Constructora Sur S.A.S. ", "sur");

        cambio.ShouldBeTrue();
        empresa.Id.ShouldBe(id);
        (empresa.Nombre, empresa.PrefijoFolio).ShouldBe(("Constructora Sur S.A.S.", "SUR"));
        (empresa.Identificacion.Numero, empresa.Identificacion.DigitoVerificacion).ShouldBe(("900123456", "8"));
        empresa.ClaveIdentificacion.ShouldBe("CO|NIT|900123456");
        // La marca no se toca.
        (empresa.ReplyTo, empresa.ColorMarca).ShouldBe(("soporte@norte.example", "#E07A1F"));
    }

    [Fact]
    public void Corregir_con_los_mismos_datos_no_cambia_nada_y_lo_dice()
    {
        var empresa = Nueva();

        empresa.CorregirDatosDeAlta(Identificacion.Crear("CO", "NIT", "800.197.268-4"), "Constructora Norte S.A.S.", " NORTE ").ShouldBeFalse();

        (empresa.Nombre, empresa.PrefijoFolio, empresa.ClaveIdentificacion).ShouldBe(("Constructora Norte S.A.S.", "NORTE", "CO|NIT|800197268"));
    }

    [Fact]
    public void Una_correccion_invalida_se_rechaza_entera_y_deja_la_empresa_como_estaba()
    {
        var empresa = Nueva();
        var nueva = Identificacion.Crear("CO", "NIT", "900123456", "8");

        // Con el mismo patrón que el alta: prefijo de 2 a 10 letras mayúsculas o números, razón social obligatoria.
        Codigo(() => empresa.CorregirDatosDeAlta(nueva, "Sur S.A.S.", "S")).ShouldBe("prefijo-folio-invalido");
        Codigo(() => empresa.CorregirDatosDeAlta(nueva, "Sur S.A.S.", "ABCDEFGHIJK")).ShouldBe("prefijo-folio-invalido");
        Codigo(() => empresa.CorregirDatosDeAlta(nueva, "Sur S.A.S.", "SU-R")).ShouldBe("prefijo-folio-invalido");
        Codigo(() => empresa.CorregirDatosDeAlta(nueva, "  ", "SUR")).ShouldBe("nombre-requerido");
        // Una identificación inválida ni siquiera llega a existir (la API la construye con las reglas del catálogo).
        Codigo(() => Identificacion.Crear("CO", "NIT", "800197268", "9")).ShouldBe("digito-verificacion-invalido");
        Codigo(() => Identificacion.Crear("CO", "NIT", "12")).ShouldBe("numero-identificacion-invalido");

        (empresa.Nombre, empresa.PrefijoFolio, empresa.ClaveIdentificacion).ShouldBe(("Constructora Norte S.A.S.", "NORTE", "CO|NIT|800197268"));
        empresa.Identificacion.Numero.ShouldBe("800197268");
    }

    [Fact]
    public void La_copia_de_pruebas_no_se_corrige_por_su_cuenta_sigue_a_su_empresa_real()
    {
        var real = Nueva();
        var copia = Empresa.CrearCopiaDeSandbox(real, Guid.NewGuid(), "TNORTE", Ahora);

        Codigo(() => copia.CorregirDatosDeAlta(real.Identificacion, "Otra", "OTRA")).ShouldBe("copia-de-sandbox");

        copia.PrefijoFolio.ShouldBe("TNORTE");
    }
}
