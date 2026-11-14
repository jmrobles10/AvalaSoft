using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.Identificaciones;
using Validasoft.Dominio.Terceros;

namespace Validasoft.Dominio.Tests;

/// <summary>
/// Personas relacionadas con bóveda propia (ADR-0010, decisión PR): la relación entre terceros (estados, confirmación, principal), qué personas trae la sección legal de la
/// ficha, la conciliación idempotente de sus relaciones y quién es «la» persona de un rol.
/// </summary>
public sealed class RelacionesEntreTercerosTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 14, 9, 0, 0, TimeSpan.FromHours(-5));
    private static readonly DateOnly Hoy = new(2026, 11, 14);
    private static readonly Identificacion Empresa = Identificacion.Crear("CO", "NIT", "900123456");

    private readonly Guid _destino = Guid.NewGuid();
    private readonly Guid _juan = Guid.NewGuid();
    private readonly Guid _maria = Guid.NewGuid();

    private static string Codigo(Action accion) => Should.Throw<ReglaDeNegocioException>(accion).Codigo;

    private RelacionEntreTerceros Declarada(Guid persona, TipoRelacionTerceros tipo = TipoRelacionTerceros.RepresentanteLegal, bool principal = true,
        decimal? participacion = null, bool deFicha = true) =>
        RelacionEntreTerceros.Create(RelacionEntreTerceros.Registrar(persona, _destino, tipo, principal, participacion, null, Hoy, FuenteDeRelacion.Declarada, deFicha, "t", Ahora));

    private RelacionEntreTerceros Detectada(Guid persona, TipoRelacionTerceros tipo = TipoRelacionTerceros.RepresentanteLegal) =>
        RelacionEntreTerceros.Create(RelacionEntreTerceros.Detectar(persona, _destino, tipo, true, null, "Gerente", 0.93m, Guid.NewGuid(), 2, Ahora));

    // ---------- el agregado ----------

    [Fact]
    public void Una_relacion_declarada_nace_confirmada_y_vigente_con_un_id_que_no_cambia()
    {
        var r = Declarada(_juan);

        r.Estado.ShouldBe(EstadoDeRelacion.Confirmada);
        r.Id.ShouldBe(RelacionEntreTerceros.IdPara(_destino, _juan, TipoRelacionTerceros.RepresentanteLegal));
        r.Id.ShouldNotBe(RelacionEntreTerceros.IdPara(_destino, _juan, TipoRelacionTerceros.Suplente));
        r.EsVigente(Hoy).ShouldBeTrue();
        r.EsVigente(Hoy.AddDays(-1)).ShouldBeFalse(); // todavía no había empezado
        (r.ConfirmadaPor, r.ConfirmadaVia).ShouldBe(("t", ViaDeConfirmacionDeRelacion.Tercero));
    }

    [Fact]
    public void Lo_que_detecta_la_ia_nace_propuesto_y_no_cuenta_hasta_que_se_confirma()
    {
        var r = Detectada(_maria);

        r.Estado.ShouldBe(EstadoDeRelacion.Propuesta);
        r.Fuente.ShouldBe(FuenteDeRelacion.ExtraidaIa);
        r.Confianza.ShouldBe(0.93m);
        r.EsVigente(Hoy).ShouldBeFalse();
        r.EsVigente(Hoy.AddYears(1)).ShouldBeFalse();

        var confirmada = r.Confirmar("tercero", ViaDeConfirmacionDeRelacion.Tercero, Hoy, Ahora)!;
        var confirmadaYa = r.Proyectar([confirmada]);
        confirmadaYa.EsVigente(Hoy).ShouldBeTrue();
        confirmadaYa.ConfirmadaVia.ShouldBe(ViaDeConfirmacionDeRelacion.Tercero);
        confirmadaYa.Confirmar("tercero", ViaDeConfirmacionDeRelacion.Tercero, Hoy, Ahora).ShouldBeNull(); // idempotente
    }

    [Fact]
    public void Descartar_una_propuesta_la_deja_sin_efecto_y_una_vigente_no_se_descarta()
    {
        var propuesta = Detectada(_maria);
        var descartada = propuesta.Proyectar([propuesta.Descartar("tercero", Ahora)!]);

        descartada.Estado.ShouldBe(EstadoDeRelacion.Descartada);
        descartada.EsVigente(Hoy).ShouldBeFalse();
        descartada.Descartar("tercero", Ahora).ShouldBeNull();
        Codigo(() => descartada.Confirmar("tercero", ViaDeConfirmacionDeRelacion.Tercero, Hoy, Ahora)).ShouldBe("relacion-no-propuesta");
        Codigo(() => Declarada(_juan).Descartar("tercero", Ahora)).ShouldBe("relacion-no-propuesta");
    }

    [Fact]
    public void Terminar_una_relacion_la_saca_de_las_vigentes_y_deja_de_ser_principal()
    {
        var r = Declarada(_juan);
        var terminada = r.Proyectar([r.Terminar(Hoy, "Renunció.", "t", Ahora)!]);

        terminada.Estado.ShouldBe(EstadoDeRelacion.Finalizada);
        terminada.Principal.ShouldBeFalse();
        terminada.EsVigente(Hoy).ShouldBeFalse(); // deja de contar desde que termina; VigenteHasta registra el día
        terminada.VigenteHasta.ShouldBe(Hoy);
        terminada.Terminar(Hoy, null, "t", Ahora).ShouldBeNull();
        Codigo(() => Detectada(_maria).Terminar(Hoy, null, "t", Ahora)).ShouldBe("relacion-propuesta");
    }

    [Fact]
    public void Volver_a_declarar_una_relacion_terminada_la_restablece_con_los_datos_de_ahora()
    {
        var r = Declarada(_juan, TipoRelacionTerceros.Socio, principal: false, participacion: 10);
        var terminada = r.Proyectar([r.Terminar(Hoy, null, "t", Ahora)!]);
        var restablecida = terminada.Proyectar([terminada.Restablecer(Hoy.AddDays(10), true, 40, "Presidente", "t", Ahora)!]);

        restablecida.EsVigente(Hoy.AddDays(10)).ShouldBeTrue();
        (restablecida.Principal, restablecida.Participacion, restablecida.Cargo, restablecida.VigenteHasta).ShouldBe((true, 40m, "Presidente", (DateOnly?)null));
        r.Restablecer(Hoy, true, null, null, "t", Ahora).ShouldBeNull(); // una vigente no se restablece
    }

    [Theory]
    [InlineData(101)]
    [InlineData(-1)]
    public void La_participacion_va_de_0_a_100(int participacion) =>
        Codigo(() => RelacionEntreTerceros.Registrar(_juan, _destino, TipoRelacionTerceros.Socio, false, participacion, null, Hoy, FuenteDeRelacion.Declarada, false, "t", Ahora))
            .ShouldBe("participacion-invalida");

    [Fact]
    public void Nadie_se_relaciona_consigo_mismo()
    {
        Codigo(() => RelacionEntreTerceros.Registrar(_destino, _destino, TipoRelacionTerceros.Socio, false, null, null, Hoy, FuenteDeRelacion.Declarada, false, "t", Ahora))
            .ShouldBe("relacion-consigo-misma");
    }

    // ---------- «la» persona de un rol ----------

    [Fact]
    public void Un_requisito_de_rol_se_resuelve_contra_la_relacion_principal_vigente()
    {
        var principal = Declarada(_juan);
        var suplente = Declarada(_maria, TipoRelacionTerceros.Suplente);
        var otroRepresentante = Declarada(Guid.NewGuid(), principal: false);

        RelacionesDeTercero.Resolver([otroRepresentante, principal, suplente], TipoRelacionTerceros.RepresentanteLegal, false, Hoy).ShouldHaveSingleItem().ShouldBe(principal);
        RelacionesDeTercero.Resolver([otroRepresentante, principal, suplente], TipoRelacionTerceros.Suplente, false, Hoy).ShouldHaveSingleItem().ShouldBe(suplente);
        RelacionesDeTercero.Resolver([principal, suplente], TipoRelacionTerceros.Socio, false, Hoy).ShouldBeEmpty();
    }

    [Fact]
    public void Con_todas_las_relaciones_salen_todas_las_vigentes_del_rol_con_la_principal_primero()
    {
        var socioMayor = Declarada(_juan, TipoRelacionTerceros.Socio, principal: true, participacion: 60);
        var socioMenor = Declarada(_maria, TipoRelacionTerceros.Socio, principal: false, participacion: 40);
        var terminado = Declarada(Guid.NewGuid(), TipoRelacionTerceros.Socio, principal: false);
        terminado = terminado.Proyectar([terminado.Terminar(Hoy.AddDays(-1), null, "t", Ahora)!]);
        terminado.VigenteHasta.ShouldBe(Hoy.AddDays(-1) < terminado.VigenteDesde ? terminado.VigenteDesde : Hoy.AddDays(-1));

        var todas = RelacionesDeTercero.Resolver([socioMenor, terminado, socioMayor], TipoRelacionTerceros.Socio, true, Hoy.AddDays(2));

        todas.Select(r => r.OrigenId).ShouldBe([_juan, _maria]);
    }

    [Fact]
    public void Una_propuesta_no_se_resuelve_ni_cuenta_como_vigente()
    {
        var propuesta = Detectada(_maria);

        RelacionesDeTercero.Resolver([propuesta], TipoRelacionTerceros.RepresentanteLegal, false, Hoy).ShouldBeEmpty();
        RelacionesDeTercero.Vigentes([propuesta], Hoy).ShouldBeEmpty();
    }

    // ---------- lo que declara la ficha ----------

    private static PersonaRelacionada Fila(RolPersonaRelacionada rol, string tipo, string numero, string nombres, string? representacion = null, decimal? porcentaje = null,
        string? nacionalidad = null) =>
        new() { Rol = rol, TipoIdentificacion = tipo, Numero = numero, Nombres = nombres, Apellidos = "Prueba", TipoRepresentacion = representacion, Porcentaje = porcentaje,
            Nacionalidad = nacionalidad };

    [Fact]
    public void La_ficha_trae_representantes_suplentes_y_socios_con_la_principal_de_cada_tipo()
    {
        var legal = new DatosLegales
        {
            Personas =
            [
                Fila(RolPersonaRelacionada.RepresentanteLegal, "CC", "1000", "Ana", "Suplente de gerencia"),
                Fila(RolPersonaRelacionada.RepresentanteLegal, "CC", "2000", "Beto", "Principal"),
                Fila(RolPersonaRelacionada.Suplente, "CC", "3000", "Carla"),
                Fila(RolPersonaRelacionada.Socio, "CC", "4000", "Dani", porcentaje: 30),
                Fila(RolPersonaRelacionada.Socio, "CE", "5000", "Eli", porcentaje: 70)
            ]
        };

        var personas = PersonasDeLaFicha.Leer(legal, Empresa);

        personas.Count.ShouldBe(5);
        personas.Where(p => p.Principal).Select(p => (p.Tipo, p.Identificacion.Numero)).ShouldBe(
        [
            (TipoRelacionTerceros.RepresentanteLegal, "2000"), // la de representación «Principal», no la primera
            (TipoRelacionTerceros.Suplente, "3000"),
            (TipoRelacionTerceros.Socio, "5000") // el de mayor participación
        ], ignoreOrder: true);
        personas.Single(p => p.Identificacion.Numero == "5000").Participacion.ShouldBe(70m);
        personas.ShouldAllBe(p => p.Identificacion.Pais == "CO" && p.Nombre.EndsWith("Prueba", StringComparison.Ordinal));
    }

    [Fact]
    public void La_ficha_omite_lo_que_no_es_una_relacion_del_adr_o_no_es_una_persona_natural_valida()
    {
        var legal = new DatosLegales
        {
            Personas =
            [
                Fila(RolPersonaRelacionada.Apoderado, "CC", "1000", "Apoderado"),
                Fila(RolPersonaRelacionada.Contador, "CC", "1001", "Contador"),
                Fila(RolPersonaRelacionada.Socio, "NIT", "800197268", "Sociedad socia", porcentaje: 20), // una jurídica no es persona relacionada
                Fila(RolPersonaRelacionada.Socio, "CC", "ABC", "Mal número", porcentaje: 10),
                new PersonaRelacionada { Rol = RolPersonaRelacionada.Socio, TipoIdentificacion = "CC", Numero = "6000", Porcentaje = 5 }, // sin nombre
                Fila(RolPersonaRelacionada.RepresentanteLegal, "CC", "900123456", "Es el propio tercero"),
                Fila(RolPersonaRelacionada.RepresentanteLegal, "CC", "7000", "Gina"),
                Fila(RolPersonaRelacionada.RepresentanteLegal, "CC", "7000", "Gina otra vez") // repetida con el mismo rol
            ]
        };

        var personas = PersonasDeLaFicha.Leer(legal, Identificacion.Crear("CO", "CC", "900123456"));

        personas.ShouldHaveSingleItem().Identificacion.Numero.ShouldBe("7000");
        PersonasDeLaFicha.Leer(null, Empresa).ShouldBeEmpty();
    }

    [Fact]
    public void Un_pasaporte_sin_pais_colombiano_toma_el_pais_de_la_nacionalidad()
    {
        var legal = new DatosLegales { Personas = [Fila(RolPersonaRelacionada.RepresentanteLegal, "PASAPORTE", "AB123456", "Pedro", nacionalidad: "VE")] };

        PersonasDeLaFicha.Leer(legal, Empresa).ShouldHaveSingleItem().Identificacion.Clave.ShouldBe("VE|PASAPORTE|AB123456");
    }

    // ---------- conciliación idempotente ----------

    private IReadOnlyList<PersonaDeclarada> Declaradas(params (Guid Persona, string Numero, TipoRelacionTerceros Tipo, bool Principal, decimal? Participacion)[] filas) =>
        [.. filas.Select(f => new PersonaDeclarada(Identificacion.Crear("CO", "CC", f.Numero), "Persona " + f.Numero, f.Tipo, f.Principal, f.Participacion, null))];

    private static IReadOnlyDictionary<string, Guid> Mapa(params (string Numero, Guid Persona)[] filas) => filas.ToDictionary(f => $"CO|CC|{f.Numero}", f => f.Persona);

    private IReadOnlyList<RelacionEntreTerceros> Aplicar(IReadOnlyList<RelacionEntreTerceros> existentes, IReadOnlyList<CambioEnRelacion> cambios)
    {
        var resultado = existentes.ToDictionary(r => r.Id);
        foreach (var cambio in cambios)
        {
            if (cambio.EsNueva)
            {
                resultado[cambio.RelacionId] = cambio.Eventos[0] switch
                {
                    RelacionRegistrada registrada => RelacionEntreTerceros.Create(registrada),
                    _ => throw new InvalidOperationException()
                };
                resultado[cambio.RelacionId] = resultado[cambio.RelacionId].Proyectar(cambio.Eventos.Skip(1));
            }
            else
            {
                resultado[cambio.RelacionId] = resultado[cambio.RelacionId].Proyectar(cambio.Eventos);
            }
        }

        return [.. resultado.Values];
    }

    [Fact]
    public void Conciliar_crea_las_relaciones_de_lo_declarado_y_repetirlo_no_cambia_nada()
    {
        var declaradas = Declaradas((_juan, "1000", TipoRelacionTerceros.RepresentanteLegal, true, null), (_maria, "2000", TipoRelacionTerceros.Socio, true, 100m));
        var mapa = Mapa(("1000", _juan), ("2000", _maria));

        var primera = ConciliacionDeRelaciones.Calcular(_destino, declaradas, mapa, [], Hoy, Ahora, "t");
        primera.Count.ShouldBe(2);
        primera.ShouldAllBe(c => c.EsNueva && c.Eventos.Count == 1);

        var existentes = Aplicar([], primera);
        existentes.ShouldAllBe(r => r.DeFicha && r.EsVigente(Hoy) && r.Fuente == FuenteDeRelacion.Declarada);
        ConciliacionDeRelaciones.Calcular(_destino, declaradas, mapa, existentes, Hoy.AddDays(30), Ahora.AddDays(30), "t").ShouldBeEmpty();
    }

    [Fact]
    public void Conciliar_termina_la_relacion_de_quien_ya_no_figura_y_la_restablece_si_vuelve()
    {
        var mapa = Mapa(("1000", _juan), ("2000", _maria));
        var ambos = Declaradas((_juan, "1000", TipoRelacionTerceros.RepresentanteLegal, true, null), (_maria, "2000", TipoRelacionTerceros.Suplente, true, null));
        var existentes = Aplicar([], ConciliacionDeRelaciones.Calcular(_destino, ambos, mapa, [], Hoy, Ahora, "t"));

        // María sale de la ficha.
        var soloJuan = Declaradas((_juan, "1000", TipoRelacionTerceros.RepresentanteLegal, true, null));
        var salida = ConciliacionDeRelaciones.Calcular(_destino, soloJuan, mapa, existentes, Hoy.AddDays(5), Ahora.AddDays(5), "t");
        var terminada = salida.ShouldHaveSingleItem();
        terminada.Eventos.ShouldHaveSingleItem().ShouldBeOfType<RelacionTerminada>().Motivo.ShouldBe(ConciliacionDeRelaciones.MotivoDeSalida);
        existentes = Aplicar(existentes, salida);
        existentes.Single(r => r.OrigenId == _maria).Estado.ShouldBe(EstadoDeRelacion.Finalizada);

        // Una segunda conciliación no la termina otra vez; y si vuelve a figurar, se restablece.
        ConciliacionDeRelaciones.Calcular(_destino, soloJuan, mapa, existentes, Hoy.AddDays(6), Ahora, "t").ShouldBeEmpty();
        var regreso = ConciliacionDeRelaciones.Calcular(_destino, ambos, mapa, existentes, Hoy.AddDays(40), Ahora.AddDays(40), "t");
        regreso.ShouldHaveSingleItem().Eventos.ShouldHaveSingleItem().ShouldBeOfType<RelacionRestablecida>();
    }

    [Fact]
    public void Conciliar_ajusta_el_principal_la_participacion_y_no_toca_lo_que_no_es_de_la_ficha()
    {
        var mapa = Mapa(("1000", _juan), ("2000", _maria));
        var inicial = Declaradas((_juan, "1000", TipoRelacionTerceros.Socio, true, 60m), (_maria, "2000", TipoRelacionTerceros.Socio, false, 40m));
        var existentes = Aplicar([], ConciliacionDeRelaciones.Calcular(_destino, inicial, mapa, [], Hoy, Ahora, "t"));
        var aMano = Declarada(Guid.NewGuid(), TipoRelacionTerceros.BeneficiarioFinal, deFicha: false);

        // María pasa a ser la socia principal con el 70 %.
        var cambio = Declaradas((_juan, "1000", TipoRelacionTerceros.Socio, false, 30m), (_maria, "2000", TipoRelacionTerceros.Socio, true, 70m));
        var cambios = ConciliacionDeRelaciones.Calcular(_destino, cambio, mapa, [.. existentes, aMano], Hoy.AddDays(1), Ahora, "t");

        cambios.Count.ShouldBe(2); // lo declarado a mano, un beneficiario final, no entra
        existentes = Aplicar(existentes, cambios);
        var juan = existentes.Single(r => r.OrigenId == _juan);
        var maria = existentes.Single(r => r.OrigenId == _maria);
        (juan.Principal, juan.Participacion, maria.Principal, maria.Participacion).ShouldBe((false, 30m, true, 70m));
        ConciliacionDeRelaciones.Calcular(_destino, cambio, mapa, existentes, Hoy.AddDays(1), Ahora, "t").ShouldBeEmpty();
    }

    // ---------- lo que la IA lee de la Cámara ----------

    private RelacionConPersona Con(RelacionEntreTerceros relacion, string nombre, string numero) => new(relacion, nombre, Identificacion.Crear("CO", "CC", numero));

    [Fact]
    public void La_camara_con_otro_representante_propone_el_cambio_y_no_toca_lo_vigente()
    {
        var actual = Con(Declarada(_juan), "Juan Pérez", "1000");
        var extraidas = new[]
        {
            new PersonaExtraida("Juan Pérez", "CC 1.000", "Representante legal"),        // ya es el representante
            new PersonaExtraida("María Gómez", "CC 80.123.456", "Representante legal"),  // otro
            new PersonaExtraida("Luis Suárez", "90123456", "Suplente del representante") // otro suplente
        };

        var propuestas = DeteccionDeRelaciones.Distintas(extraidas, [actual], Hoy, Guid.NewGuid(), 1);

        propuestas.Select(p => (p.Nombre, p.Tipo, p.Principal, p.Identificacion.Numero)).ShouldBe(
        [
            ("María Gómez", TipoRelacionTerceros.RepresentanteLegal, true, "80123456"),
            ("Luis Suárez", TipoRelacionTerceros.Suplente, false, "90123456")
        ]);
    }

    [Fact]
    public void Sin_representante_vigente_la_camara_no_propone_nada_porque_eso_lo_cubre_la_propuesta_de_la_ficha()
    {
        DeteccionDeRelaciones.Distintas([new PersonaExtraida("María Gómez", "80123456", "Representante legal")], [], Hoy, null, null).ShouldBeEmpty();
    }

    [Fact]
    public void No_se_propone_lo_ya_propuesto_ni_lo_descartado_con_ese_mismo_documento_pero_si_con_uno_nuevo()
    {
        var documento = Guid.NewGuid();
        var vigente = Con(Declarada(_juan), "Juan Pérez", "1000");
        var detectada = RelacionEntreTerceros.Detectar(_maria, _destino, TipoRelacionTerceros.RepresentanteLegal, true, null, null, 0.9m, documento, 1, Ahora);
        var pendiente = Con(RelacionEntreTerceros.Create(detectada), "María Gómez", "80123456");
        var extraidas = new[] { new PersonaExtraida("María Gómez", "80123456", "Representante legal") };

        DeteccionDeRelaciones.Distintas(extraidas, [vigente, pendiente], Hoy, documento, 1).ShouldBeEmpty(); // ya hay una propuesta pendiente

        var descartada = pendiente.Relacion.Proyectar([pendiente.Relacion.Descartar("t", Ahora)!]);
        DeteccionDeRelaciones.Distintas(extraidas, [vigente, pendiente with { Relacion = descartada }], Hoy, documento, 1).ShouldBeEmpty();
        DeteccionDeRelaciones.Distintas(extraidas, [vigente, pendiente with { Relacion = descartada }], Hoy, Guid.NewGuid(), 1).ShouldHaveSingleItem();

        // Y la relación descartada vuelve a ser una propuesta, con lo que lee la IA del documento nuevo.
        var otra = Guid.NewGuid();
        var nueva = descartada.Redetectar(true, null, "Gerente", 0.97m, otra, 2, Ahora)!;
        var vuelta = descartada.Proyectar([nueva]);
        (vuelta.Estado, vuelta.Confianza, vuelta.DocumentoId, vuelta.VersionDelDocumento).ShouldBe((EstadoDeRelacion.Propuesta, 0.97m, otra, 2));
        descartada.Redetectar(true, null, null, 0.9m, documento, 1, Ahora).ShouldBeNull();
    }

    [Theory]
    [InlineData("CC 80.123.456", "CO|CC|80123456")]
    [InlineData("80123456", "CO|CC|80123456")]
    [InlineData("C.E. 3456789", "CO|CE|3456789")]
    [InlineData("CE 3456789", "CO|CE|3456789")]
    [InlineData("sin número", null)]
    public void La_identificacion_que_lee_la_ia_se_normaliza_o_se_descarta(string texto, string? clave) =>
        DeteccionDeRelaciones.Identificar(texto)?.Clave.ShouldBe(clave);

    [Fact]
    public void Conciliar_confirma_la_propuesta_que_la_ficha_ahora_declara()
    {
        var propuesta = Detectada(_maria);
        var mapa = Mapa(("2000", _maria));
        var declaradas = Declaradas((_maria, "2000", TipoRelacionTerceros.RepresentanteLegal, true, null));

        var cambios = ConciliacionDeRelaciones.Calcular(_destino, declaradas, mapa, [propuesta], Hoy, Ahora, "t");

        var eventos = cambios.ShouldHaveSingleItem().Eventos;
        eventos[0].ShouldBeOfType<RelacionConfirmada>();
        eventos.Skip(1).ShouldAllBe(e => e is RelacionActualizada); // el cargo y la participación son los de la ficha
    }

    [Fact]
    public void Lo_que_la_ficha_confirma_o_restablece_pasa_a_ser_de_la_ficha_y_termina_si_la_persona_sale_de_ella()
    {
        var mapa = Mapa(("2000", _maria));
        var declaradas = Declaradas((_maria, "2000", TipoRelacionTerceros.RepresentanteLegal, true, null));

        // La propuesta de la IA la confirma la ficha: desde ahora la mantiene la ficha.
        var propuesta = Detectada(_maria);
        propuesta.DeFicha.ShouldBeFalse();
        var existentes = Aplicar([propuesta], ConciliacionDeRelaciones.Calcular(_destino, declaradas, mapa, [propuesta], Hoy, Ahora, "t"));
        existentes.ShouldHaveSingleItem().DeFicha.ShouldBeTrue();

        // Sale de la ficha: la relación termina.
        var sinNadie = Declaradas();
        var salida = ConciliacionDeRelaciones.Calcular(_destino, sinNadie, mapa, existentes, Hoy.AddDays(3), Ahora.AddDays(3), "t");
        salida.ShouldHaveSingleItem().Eventos.ShouldHaveSingleItem().ShouldBeOfType<RelacionTerminada>();
        existentes = Aplicar(existentes, salida);
        existentes.Single().Estado.ShouldBe(EstadoDeRelacion.Finalizada);

        // Una propuesta descartada que la ficha vuelve a declarar se restablece como de la ficha.
        var descartada = Detectada(_maria);
        descartada = descartada.Proyectar([descartada.Descartar("t", Ahora)!]);
        var restablecida = ConciliacionDeRelaciones.Calcular(_destino, declaradas, mapa, [descartada], Hoy.AddDays(10), Ahora, "t");
        restablecida.ShouldHaveSingleItem().Eventos.ShouldContain(e => e is RelacionRestablecida);
        Aplicar([descartada], restablecida).ShouldHaveSingleItem().DeFicha.ShouldBeTrue();
    }
}
