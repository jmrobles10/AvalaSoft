using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Avalasoft.Aplicacion.Interesado;
using Avalasoft.Infraestructura.Http;

namespace Avalasoft.Integracion.Tests;

/// <summary>
/// Partición del límite de <c>/public/v1</c> (sin base ni red): lo anónimo cuenta por IP con el cupo bajo; quien trae la sesión de un
/// tercero ya autenticada cuenta por tercero con el cupo mayor, aunque comparta la IP de una oficina con otros.
/// </summary>
public sealed class LimiteDePeticionesPublicasTests
{
    private static readonly CuposDeLimitePublico Cupos = new(PorIp: 3, PorSesion: 6, TimeSpan.FromMinutes(1), Ingreso: 2, VentanaIngreso: TimeSpan.FromMinutes(1));

    private static DefaultHttpContext Peticion(string ruta, string ip, Guid? terceroId = null, bool autenticada = true, string tipo = ReclamosTercero.ValorTipo)
    {
        var http = new DefaultHttpContext();
        http.Request.Path = ruta;
        http.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        if (terceroId is { } id)
        {
            Claim[] reclamos = [new(ReclamosTercero.Tipo, tipo), new(ReclamosTercero.TerceroId, id.ToString())];
            // Sin tipo de autenticación la identidad no cuenta como autenticada: es un token que la autenticación no validó.
            http.User = new ClaimsPrincipal(autenticada ? new ClaimsIdentity(reclamos, "Bearer") : new ClaimsIdentity(reclamos));
        }

        return http;
    }

    private static int Aceptadas(PartitionedRateLimiter<HttpContext> limitador, int intentos, Func<DefaultHttpContext> peticion)
    {
        var aceptadas = 0;
        for (var i = 0; i < intentos; i++)
        {
            using var permiso = limitador.AttemptAcquire(peticion());
            if (permiso.IsAcquired)
                aceptadas++;
        }

        return aceptadas;
    }

    [Fact]
    public void Lo_anonimo_cuenta_por_ip_con_el_cupo_bajo()
    {
        using var limitador = LimiteDePeticionesPublicas.CrearLimitador(Cupos);

        Aceptadas(limitador, 10, () => Peticion("/public/v1/enlaces/x/canjear", "203.0.113.10")).ShouldBe(Cupos.PorIp);
        // Otra IP no comparte el cupo.
        Aceptadas(limitador, 10, () => Peticion("/public/v1/enlaces/x/canjear", "203.0.113.11")).ShouldBe(Cupos.PorIp);
    }

    [Fact]
    public void La_sesion_del_tercero_cuenta_por_tercero_con_el_cupo_mayor_aunque_comparta_la_ip()
    {
        using var limitador = LimiteDePeticionesPublicas.CrearLimitador(Cupos);
        var oficina = "198.51.100.20";
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        Aceptadas(limitador, 20, () => Peticion("/public/v1/expedientes/1", oficina, a)).ShouldBe(Cupos.PorSesion);
        // El compañero de la misma oficina y quien llega sin sesión tienen cupo propio: el de A no los agota.
        Aceptadas(limitador, 20, () => Peticion("/public/v1/expedientes/1", oficina, b)).ShouldBe(Cupos.PorSesion);
        Aceptadas(limitador, 20, () => Peticion("/public/v1/certificados/verificar", oficina)).ShouldBe(Cupos.PorIp);
    }

    [Fact]
    public void El_mismo_tercero_comparte_el_cupo_desde_otra_ip()
    {
        using var limitador = LimiteDePeticionesPublicas.CrearLimitador(Cupos);
        var tercero = Guid.NewGuid();

        Aceptadas(limitador, 4, () => Peticion("/public/v1/vinculos", "198.51.100.30", tercero)).ShouldBe(4);
        Aceptadas(limitador, 20, () => Peticion("/public/v1/vinculos", "198.51.100.31", tercero)).ShouldBe(Cupos.PorSesion - 4);
    }

    [Fact]
    public void Un_token_que_no_se_autentico_o_que_no_es_de_tercero_cae_por_ip()
    {
        // Reclamos inventados sin que la autenticación los haya validado: no abren una partición propia.
        var sinAutenticar = Peticion("/public/v1/vinculos", "203.0.113.40", Guid.NewGuid(), autenticada: false);
        LimiteDePeticionesPublicas.ParticionPublica(sinAutenticar, Cupos).ShouldBe(("ip:203.0.113.40", Cupos.PorIp));

        var deUsuario = Peticion("/public/v1/vinculos", "203.0.113.41", Guid.NewGuid(), tipo: "usuario");
        LimiteDePeticionesPublicas.ParticionPublica(deUsuario, Cupos).ShouldBe(("ip:203.0.113.41", Cupos.PorIp));
    }

    [Fact]
    public void La_evaluacion_va_en_su_propia_particion_con_cuatro_veces_el_cupo_que_le_toca()
    {
        var tercero = Guid.NewGuid();

        var (claveSesion, cupoSesion) = LimiteDePeticionesPublicas.ParticionPublica(Peticion("/public/v1/ficha/secciones/x/evaluacion", "203.0.113.50", tercero), Cupos);
        claveSesion.ShouldBe($"evaluacion:tercero:{tercero:N}");
        cupoSesion.ShouldBe(Cupos.PorSesion * 4);

        var (claveIp, cupoIp) = LimiteDePeticionesPublicas.ParticionPublica(Peticion("/public/v1/ficha/secciones/x/evaluacion", "203.0.113.50"), Cupos);
        claveIp.ShouldBe("evaluacion:ip:203.0.113.50");
        cupoIp.ShouldBe(Cupos.PorIp * 4);

        using var limitador = LimiteDePeticionesPublicas.CrearLimitador(Cupos);
        Aceptadas(limitador, 50, () => Peticion("/public/v1/ficha/secciones/x/evaluacion", "203.0.113.50", tercero)).ShouldBe(Cupos.PorSesion * 4);
        // Agotar la evaluación no toca el cupo de las demás consultas.
        Aceptadas(limitador, 50, () => Peticion("/public/v1/ficha", "203.0.113.50", tercero)).ShouldBe(Cupos.PorSesion);
    }

    [Fact]
    public void El_ingreso_sigue_por_ip_y_lo_que_no_es_publico_no_se_limita()
    {
        using var limitador = LimiteDePeticionesPublicas.CrearLimitador(Cupos);

        // Aunque traiga sesión de tercero, el ingreso se cuenta por IP con su cupo propio.
        Aceptadas(limitador, 10, () => Peticion("/api/v1/ingreso/sso", "203.0.113.60", Guid.NewGuid())).ShouldBe(Cupos.Ingreso);
        Aceptadas(limitador, 10, () => Peticion("/api/v1/vinculos", "203.0.113.61")).ShouldBe(10);
    }

    [Fact]
    public void Los_cupos_salen_de_la_configuracion_con_300_por_sesion_por_omision()
    {
        var vacia = CuposDeLimitePublico.De(new ConfigurationBuilder().Build());
        vacia.PorIp.ShouldBe(60);
        vacia.PorSesion.ShouldBe(300);
        vacia.Ventana.ShouldBe(TimeSpan.FromSeconds(60));
        vacia.Ingreso.ShouldBe(30);

        var configurada = CuposDeLimitePublico.De(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Avalasoft:LimitePublico:PeticionesPorSesion"] = "500" }).Build());
        configurada.PorSesion.ShouldBe(500);
        configurada.PorIp.ShouldBe(60);
    }
}
