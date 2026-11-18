using System.Buffers.Binary;
using System.Text;
using Microsoft.Extensions.Configuration;
using Validasoft.Aplicacion.Comun;

namespace Validasoft.Dominio.Tests;

/// <summary>El marco de marca de los correos (MA-1): logotipo arriba, GIF de éxito donde se pide, imágenes dentro del mensaje.</summary>
public class MarcoDeCorreoTests
{
    private static RedactorDeCorreos Redactor() =>
        new(new ConfigurationBuilder().AddInMemoryCollection([new("Validasoft:Correo:UrlPublica", "https://valida.test")]).Build());

    [Fact]
    public void El_marco_deja_el_contenido_tal_cual_debajo_del_logotipo_y_pide_sus_imagenes_por_cid()
    {
        var html = MarcoDeCorreo.Envolver("<p>Hola, <b>Ana</b>.</p>");

        html.ShouldContain("<p>Hola, <b>Ana</b>.</p>");
        html.ShouldContain($"src=\"cid:{MarcoDeCorreo.IdLogotipo}\"");
        html.ShouldContain("alt=\"Validasoft\"");
        html.IndexOf("cid:validasoft-logotipo", StringComparison.Ordinal).ShouldBeLessThan(html.IndexOf("<p>Hola", StringComparison.Ordinal));
        // Sin colores que dependan del modo del cliente de correo: la tarjeta es blanca con el texto de marca.
        html.ShouldContain("#FFFFFF");
        html.ShouldContain("#0A0F1C");
    }

    [Fact]
    public void El_logotipo_se_muestra_a_la_mitad_de_sus_pixeles_para_verse_nitido_en_pantallas_densas()
    {
        var logotipo = MarcoDeCorreo.RecursosUsados(MarcoDeCorreo.Envolver("<p>x</p>")).ShouldHaveSingleItem();
        logotipo.ContentId.ShouldBe(MarcoDeCorreo.IdLogotipo);
        logotipo.TipoMime.ShouldBe("image/png");
        logotipo.Contenido.Take(8).ShouldBe(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a });
        var ancho = BinaryPrimitives.ReadUInt32BigEndian(logotipo.Contenido.AsSpan(16, 4));
        var alto = BinaryPrimitives.ReadUInt32BigEndian(logotipo.Contenido.AsSpan(20, 4));

        var html = MarcoDeCorreo.Envolver("<p>x</p>");
        html.ShouldContain($"width=\"{ancho / 2}\" height=\"{alto / 2}\"");
    }

    [Fact]
    public void El_gif_de_exito_solo_viaja_en_los_correos_que_lo_piden()
    {
        MarcoDeCorreo.RecursosUsados(MarcoDeCorreo.Envolver("<p>sin imagen</p>")).Select(r => r.ContentId).ShouldBe([MarcoDeCorreo.IdLogotipo]);

        var conExito = MarcoDeCorreo.Envolver(MarcoDeCorreo.ImagenDeExito("Listo") + "<p>con imagen</p>");
        var recursos = MarcoDeCorreo.RecursosUsados(conExito);
        recursos.Select(r => r.ContentId).ShouldBe([MarcoDeCorreo.IdLogotipo, MarcoDeCorreo.IdExito], ignoreOrder: true);
        var gif = recursos.Single(r => r.ContentId == MarcoDeCorreo.IdExito);
        gif.TipoMime.ShouldBe("image/gif");
        Encoding.ASCII.GetString(gif.Contenido, 0, 6).ShouldBe("GIF89a");
        gif.Contenido.Length.ShouldBeLessThan(150_000);   // peso razonable para un correo
        conExito.ShouldContain("width=\"96\" height=\"96\"");
    }

    [Fact]
    public void La_descripcion_de_la_imagen_sale_escapada()
    {
        MarcoDeCorreo.ImagenDeExito("<script>").ShouldContain("alt=\"&lt;script&gt;\"");
    }

    [Fact]
    public void En_linea_cambia_cada_cid_por_la_imagen_incrustada_para_verla_fuera_del_correo()
    {
        var html = MarcoDeCorreo.EnLinea(MarcoDeCorreo.Envolver(MarcoDeCorreo.ImagenDeExito()));
        html.ShouldNotContain("cid:");
        html.ShouldContain("src=\"data:image/png;base64,iVBOR");
        html.ShouldContain("src=\"data:image/gif;base64,R0lGOD");
        MarcoDeCorreo.EnLinea("<p>nada</p>").ShouldBe("<p>nada</p>");
    }

    [Fact]
    public void El_boton_es_el_enlace_con_el_color_de_la_accion_principal_de_la_marca_y_texto_blanco_sin_subrayado()
    {
        var boton = MarcoDeCorreo.Boton("https://valida.test/e/tok", "Abrir Validasoft");

        boton.ShouldContain("href=\"https://valida.test/e/tok\"");
        boton.ShouldContain(">Abrir Validasoft</a>");
        // El azul de acción de packages/ui/src/tokens.ts, en la celda (Outlook) y en el enlace, y el texto en blanco: ningún color depende del cliente de correo.
        boton.ShouldContain($"bgcolor=\"{MarcoDeCorreo.ColorDeAccion}\"");
        boton.ShouldContain($"background-color:{MarcoDeCorreo.ColorDeAccion}");
        MarcoDeCorreo.ColorDeAccion.ShouldBe("#2F55D9");
        boton.ShouldContain("color:#FFFFFF");
        boton.ShouldContain("text-decoration:none");
        boton.ShouldContain("border-radius:8px");
        // Sin imágenes ni recursos: solo el enlace.
        MarcoDeCorreo.RecursosUsados(boton).ShouldBeEmpty();
    }

    [Fact]
    public void El_boton_escapa_la_direccion_y_el_texto()
    {
        var boton = MarcoDeCorreo.Boton("https://valida.test/e/a\"b?x=1&y=2", "<Abrir>");

        boton.ShouldContain("href=\"https://valida.test/e/a&quot;b?x=1&amp;y=2\"");
        boton.ShouldContain("&lt;Abrir&gt;");
        boton.ShouldNotContain("<Abrir>");
    }

    [Fact]
    public void La_aprobacion_abre_con_el_gif_de_exito_y_el_rechazo_no()
    {
        var aprobado = Redactor().RedactarResultado(new CorreoDeResultadoPendiente("ana@aceros.co", "Constructora Norte S.A.S.", "NORTE-E-2026-000001", true, []));
        aprobado.Html.ShouldStartWith("<p style=\"margin:0 0 16px 0;\"><img src=\"cid:validasoft-exito\"");
        aprobado.Html.ShouldContain("aprobó tu validación");
        // El texto plano no cambia: la imagen es solo del HTML.
        aprobado.Texto.ShouldNotContain("cid:");

        var rechazado = Redactor().RedactarResultado(new CorreoDeResultadoPendiente("ana@aceros.co", "Constructora Norte S.A.S.", "NORTE-E-2026-000001", false, ["Ilegible"]));
        rechazado.Html.ShouldNotContain("cid:");
    }
}
