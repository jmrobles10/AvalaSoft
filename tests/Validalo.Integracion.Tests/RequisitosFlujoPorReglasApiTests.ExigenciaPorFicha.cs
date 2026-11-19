using System.Text.Json;
using Validalo.Aplicacion.Expedientes;
using Validalo.Contratos;
using Validalo.Dominio.Expedientes;
using Xunit.Abstractions;

namespace Validalo.Integracion.Tests;

public sealed partial class RequisitosFlujoPorReglasApiTests
{
    // ---------- exigencia según la ficha del tercero (EF-1…EF-6): la especialidad declarada decide qué documentos se piden ----------

    private const string CampoEspecialidades = "ficha.especialidades.especialidades";

    private static CondicionDto Declara(params string[] codigos) => new("Predicado", Atributo: CampoEspecialidades, Operador: "ContieneAlguno", Valores: codigos);

    private static Dictionary<string, JsonElement> FichaDeEspecialidades(params string[] codigos) =>
        new() { [CampoEspecialidades] = JsonSerializer.SerializeToElement(codigos) };

    private sealed record Especialidades(string GrupoA, string EspecialidadA, string GrupoB, string EspecialidadB);

    /// <summary>Dos ramas del catálogo de especialidades (grupo → categoría → especialidad), con un prefijo único para no pisar a otras pruebas.</summary>
    private async Task<Especialidades> CatalogoDeEspecialidadesAsync()
    {
        var p = "T" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var filas = new[]
        {
            new FilaCatalogoDto($"{p}A", "Obra gris de prueba", Nivel: 1),
            new FilaCatalogoDto($"{p}A.CON", "Concretos de prueba", Padre: $"{p}A", Nivel: 2),
            new FilaCatalogoDto($"{p}A.CON.PRE", "Concreto premezclado de prueba", Padre: $"{p}A.CON", Nivel: 3),
            new FilaCatalogoDto($"{p}B", "Acabados de prueba", Nivel: 1),
            new FilaCatalogoDto($"{p}B.PIS", "Pisos de prueba", Padre: $"{p}B", Nivel: 2),
            new FilaCatalogoDto($"{p}B.PIS.CER", "Cerámica de prueba", Padre: $"{p}B.PIS", Nivel: 3)
        };
        var resultado = await ApiAsync<ResultadoImportacionCatalogoDto>("POST", "/api/v1/plataforma/catalogos/especialidades/importar",
            new Credencial(ApiFixture.ClavePlataforma), new ImportarCatalogoDto(filas), 200);
        resultado.Creados.ShouldBe(6);
        return new Especialidades($"{p}A", $"{p}A.CON.PRE", $"{p}B", $"{p}B.PIS.CER");
    }

    private Task GuardarEspecialidadesAsync(SesionTerceroDto sesion, params string[] codigos) =>
        GuardarSeccionAsync(sesion, "FICHA_ESPECIALIDADES", JsonSerializer.Serialize(new { especialidades = codigos.Select(c => c.ToLowerInvariant()) }));

    private async Task<int> ResolucionesPorFichaAsync(Empresa empresa, Guid expedienteId) =>
        (await EventosAsync(empresa.Datos.TenantId, expedienteId)).OfType<RequisitosSegunFichaResueltos>().Count();

    [Fact]
    public async Task La_especialidad_declarada_suma_el_documento_al_expediente_abierto_quitarla_lo_deja_en_NoAplica_y_lo_aprobado_de_un_expediente_cerrado_no_se_toca()
    {
        var e = await PrepararAsync();
        var especialidades = await CatalogoDeEspecialidadesAsync();
        await FlujoConAsync(e.Norte, "CLIENTE",
        [
            new RequisitoDelFlujoDto(TipoDocumento: "RUT", AreasQueRevisan: [e.Compras.Id, e.Cumplimiento.Id]),
            new RequisitoDelFlujoDto(TipoDocumento: "CAMARA_COMERCIO", AreasQueRevisan: [e.Cumplimiento.Id], Condicion: Declara(especialidades.GrupoA)),
            new RequisitoDelFlujoDto(TipoDocumento: "CERTIFICACION_BANCARIA", AreasQueRevisan: [e.Cumplimiento.Id], Condicion: Declara(especialidades.GrupoB))
        ]);
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "CLIENTE", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v1")); // ya está en la bóveda, pero este flujo aún no la pide
        await AceptarAsync(sesion, vinculo.Id);

        // Sin especialidades declaradas el expediente abre solo con lo que se pide siempre.
        var expedienteId = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var abierto = await EsperarAsync(e.Norte, expedienteId, x => x.Estado == "EnRevision");
        abierto.Requisitos!.Select(r => r.TipoDocumento.Codigo).ShouldBe(["RUT"]);

        // El tercero declara una especialidad de obra gris: la Cámara entra, ya cubierta con la que tenía, con el porqué.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadA);
        var conCamara = await EsperarAsync(e.Norte, expedienteId, x => x.Requisitos!.Count == 2);
        var camara = Requisito(conCamara, "CAMARA_COMERCIO");
        (camara.Estado, camara.VersionActual!.N).ShouldBe(("EnRevision", 1));
        camara.Areas.Select(a => a.Codigo).ShouldBe(["CUMPLIMIENTO"]);
        var porQue = camara.PorQue.ShouldNotBeNull().ShouldHaveSingleItem();
        (porQue.Campo, porQue.Etiqueta).ShouldBe((CampoEspecialidades, "Especialidades"));
        porQue.Valores.ShouldBe(["Obra gris de prueba"]); // el grupo de la condición que cubre la especialidad declarada
        Requisito(conCamara, "RUT").PorQue.ShouldBeNull(); // lo que se pide siempre no necesita explicación
        (await ResolucionesPorFichaAsync(e.Norte, expedienteId)).ShouldBe(1);

        // Cambia de especialidad: la de obra gris ya no aplica (NoAplica, sigue ahí) y entra lo de acabados, pendiente del tercero.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadB);
        var cambiado = await EsperarAsync(e.Norte, expedienteId, x => Requisito(x, "CAMARA_COMERCIO").Estado == "NoAplica");
        cambiado.Requisitos!.Count.ShouldBe(3);
        Requisito(cambiado, "CAMARA_COMERCIO").Exencion.ShouldBeNull(); // no es una exención: lo dice el estado
        Requisito(cambiado, "CAMARA_COMERCIO").Areas.Single().Estado.ShouldBe("NoAplica");
        var bancaria = Requisito(cambiado, "CERTIFICACION_BANCARIA");
        (bancaria.Estado, bancaria.VersionActual).ShouldBe(("Pendiente", null));
        bancaria.PorQue!.Single().Valores.ShouldBe(["Acabados de prueba"]);

        // Lo que no aplica no recibe versiones nuevas: una Cámara nueva queda en la bóveda del tercero y no se comparte con esta empresa.
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v2"));
        var documentos = await ApiAsync<List<DocumentoVistaEmpresaDto>>("GET", $"/api/v1/vinculos/{vinculo.Id}/documentos", Admin(e.Norte), null, 200);
        documentos.Single(d => d.Tipo.Codigo == "CAMARA_COMERCIO").VersionesCompartidas.Select(v => v.N).ShouldBe([1]);

        // El tercero ve solo lo que le piden y por qué: la Cámara que ya no aplica desaparece de su lista.
        var publico = await TerceroAsync<ExpedientePublicoDto>("GET", $"/public/v1/expedientes/{expedienteId}", sesion.AccessToken, null, 200);
        publico.Requisitos!.Select(r => r.TipoDocumento.Codigo).Order().ShouldBe(["CERTIFICACION_BANCARIA", "RUT"]);
        publico.RequisitosFaltantes.ShouldBe(1);
        publico.Requisitos!.Single(r => r.TipoDocumento.Codigo == "CERTIFICACION_BANCARIA").PorQue!.Single().Valores.ShouldBe(["Acabados de prueba"]);

        // Declara las dos: la Cámara vuelve a exigirse y, como ya aplica, recibe la versión nueva que había subido mientras no aplicaba; la bancaria sigue.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadA, especialidades.EspecialidadB);
        var ambas = await EsperarAsync(e.Norte, expedienteId, x => Requisito(x, "CAMARA_COMERCIO") is { Estado: not "NoAplica", VersionActual.N: 2 });
        Requisito(ambas, "CAMARA_COMERCIO").Estado.ShouldBe("EnRevision");
        Requisito(ambas, "CERTIFICACION_BANCARIA").Estado.ShouldBe("Pendiente");
        (await ResolucionesPorFichaAsync(e.Norte, expedienteId)).ShouldBe(3);

        // Repetir el mensaje (o cualquier otro aviso de la ficha) no cambia nada: el recálculo es idempotente.
        await InvocarAsync(new SincronizarRequisitosDelVinculo(e.Norte.Datos.TenantId, vinculo.Id, "Tercero", sesion.TerceroId.ToString()));
        await InvocarAsync(new SincronizarRequisitosDelVinculo(e.Norte.Datos.TenantId, vinculo.Id, "Tercero", sesion.TerceroId.ToString()));
        (await ResolucionesPorFichaAsync(e.Norte, expedienteId)).ShouldBe(3);
        (await ApiAsync<List<EventoHistorialDto>>("GET", $"/api/v1/expedientes/{expedienteId}/historial", Admin(e.Norte), null, 200))
            .Select(h => h.Tipo).ShouldContain("requisitos_segun_ficha_resueltos");

        // Se completa la bancaria y se aprueba todo: el expediente se cierra aprobado.
        await SubirAsync(sesion, "CERTIFICACION_BANCARIA", Pdf("Certificación v1"));
        var listo = await EsperarAsync(e.Norte, expedienteId, x => Requisito(x, "CERTIFICACION_BANCARIA").VersionActual is not null);
        foreach (var (area, persona, codigo) in new[] { (e.Compras, e.Laura, "COMPRAS"), (e.Cumplimiento, e.Carlos, "CUMPLIMIENTO") })
        {
            var porDecidir = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Delegado(e.Norte, persona), null, 200), codigo)
                .DocumentosPorDecidir ?? [];
            if (porDecidir.Count > 0)
                await AreaAsync<ExpedienteDto>(e, expedienteId, area, persona, new VeredictoDto("Aprobado", Versiones: porDecidir.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
        }

        var aprobado = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Admin(e.Norte), null, 200);
        aprobado.Estado.ShouldBe("Aprobado");
        listo.Requisitos!.Count.ShouldBe(3);

        // Lo aprobado no se toca: con el expediente cerrado, cambiar la especialidad no deja la Cámara aprobada en NoAplica ni agrega nada.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadB);
        await InvocarAsync(new SincronizarRequisitosDelVinculo(e.Norte.Datos.TenantId, vinculo.Id, "Tercero", sesion.TerceroId.ToString()));
        var despues = await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteId}", Admin(e.Norte), null, 200);
        despues.Estado.ShouldBe("Aprobado");
        Requisito(despues, "CAMARA_COMERCIO").Estado.ShouldBe("Aprobado");
        despues.Requisitos!.Count.ShouldBe(3);
        (await ResolucionesPorFichaAsync(e.Norte, expedienteId)).ShouldBe(3);
        (await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{vinculo.Id}", Admin(e.Norte), null, 200)).ExpedienteAbiertoId.ShouldBeNull();
    }

    [Fact]
    public async Task En_una_actualizacion_abierta_lo_declarado_suma_solo_lo_que_la_empresa_nunca_habia_pedido_y_no_lo_que_ya_reviso_en_el_expediente_inicial()
    {
        var e = await PrepararAsync();
        var especialidades = await CatalogoDeEspecialidadesAsync();
        await FlujoConAsync(e.Norte, "CLIENTE",
        [
            new RequisitoDelFlujoDto(TipoDocumento: "RUT", AreasQueRevisan: [e.Compras.Id, e.Cumplimiento.Id]),
            new RequisitoDelFlujoDto(TipoDocumento: "CAMARA_COMERCIO", AreasQueRevisan: [e.Cumplimiento.Id], Condicion: Declara(especialidades.GrupoA)),
            new RequisitoDelFlujoDto(TipoDocumento: "CERTIFICACION_BANCARIA", AreasQueRevisan: [e.Cumplimiento.Id], Condicion: Declara(especialidades.GrupoB))
        ]);
        var correo = CorreoNuevo();
        var vinculo = await CrearVinculoAsync(e.Norte, "CLIENTE", correo);
        var sesion = await SesionAsync(correo);
        await SubirAsync(sesion, "RUT", Pdf("RUT v1"));
        await SubirAsync(sesion, "CAMARA_COMERCIO", Pdf("Cámara v1"));
        // Declara obra gris antes de aceptar: la empresa no ve la ficha hasta aceptar y, al aceptar, la condición ya la cumple.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadA);
        await AceptarAsync(sesion, vinculo.Id);

        var inicial = await AbiertoEnAsync(e.Norte, vinculo.Id);
        var abierto = await EsperarAsync(e.Norte, inicial, x => x.Estado == "EnRevision");
        abierto.Requisitos!.Select(r => r.TipoDocumento.Codigo).Order().ShouldBe(["CAMARA_COMERCIO", "RUT"]);
        Requisito(abierto, "CAMARA_COMERCIO").PorQue!.Single().Valores.ShouldBe(["Obra gris de prueba"]);

        foreach (var (area, persona, codigo) in new[] { (e.Compras, e.Laura, "COMPRAS"), (e.Cumplimiento, e.Carlos, "CUMPLIMIENTO") })
        {
            var porDecidir = Area(await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Delegado(e.Norte, persona), null, 200), codigo)
                .DocumentosPorDecidir ?? [];
            if (porDecidir.Count > 0)
                await AreaAsync<ExpedienteDto>(e, inicial, area, persona, new VeredictoDto("Aprobado", Versiones: porDecidir.ToDictionary(d => d.RequisitoId, d => d.VersionVigente)));
        }

        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Aprobado");

        // El RUT nuevo abre una actualización solo con el RUT.
        await SubirAsync(sesion, "RUT", Pdf("RUT v2"));
        var actualizacion = await AbiertoEnAsync(e.Norte, vinculo.Id, inicial);
        var soloElRut = await EsperarAsync(e.Norte, actualizacion, x => x.Estado == "EnRevision");
        soloElRut.Tipo.ShouldBe("Actualizacion");
        soloElRut.Requisitos!.Select(r => r.TipoDocumento.Codigo).ShouldBe(["RUT"]);

        // El tercero declara también acabados: lo nuevo para la empresa (la certificación bancaria) entra a la actualización; la Cámara, que ya revisó en el
        // expediente inicial y no cambió, no entra de nuevo.
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadA, especialidades.EspecialidadB);
        var ampliada = await EsperarAsync(e.Norte, actualizacion, x => x.Requisitos!.Count == 2);
        ampliada.Requisitos!.Select(r => r.TipoDocumento.Codigo).Order().ShouldBe(["CERTIFICACION_BANCARIA", "RUT"]);
        Requisito(ampliada, "CERTIFICACION_BANCARIA").PorQue!.Single().Valores.ShouldBe(["Acabados de prueba"]);
        (await ResolucionesPorFichaAsync(e.Norte, actualizacion)).ShouldBe(1);

        // Quitar acabados deja la certificación en NoAplica dentro de la actualización (sigue sin tocar la Cámara aprobada del inicial).
        await GuardarEspecialidadesAsync(sesion, especialidades.EspecialidadA);
        var sinAcabados = await EsperarAsync(e.Norte, actualizacion, x => Requisito(x, "CERTIFICACION_BANCARIA").Estado == "NoAplica");
        sinAcabados.Requisitos!.Count.ShouldBe(2);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{inicial}", Admin(e.Norte), null, 200)).Estado.ShouldBe("Aprobado");
    }

    [Fact]
    public async Task El_flujo_se_escoge_por_la_especialidad_declarada_desde_la_aceptacion_y_la_vista_previa_la_prueba_sin_leer_la_ficha_de_nadie()
    {
        var norte = await EmpresaNuevaAsync("Norte S.A.S.", "NORTE");
        var especialidades = await CatalogoDeEspecialidadesAsync();
        var defecto = await FlujoConAsync(norte, "PROVEEDOR", [new RequisitoDelFlujoDto(TipoDocumento: "RUT")]);
        var obra = await FlujoConReglaAsync(norte, "OBRA", Declara(especialidades.GrupoA), 1, "RUT", "CAMARA_COMERCIO");

        // El tercero ya declaró una especialidad de obra gris en su ficha, que la empresa no ve hasta que acepta: al aceptar, la regla la mira.
        var correoObra = CorreoNuevo();
        var deObra = await CrearVinculoConAtributosAsync(norte, "{}", correoObra);
        var sesionObra = await SesionAsync(correoObra);
        await GuardarEspecialidadesAsync(sesionObra, especialidades.EspecialidadA);
        await AceptarAsync(sesionObra, deObra.Id);
        var expedienteObra = await ApiAsync<ExpedienteDto>("GET",
            $"/api/v1/expedientes/{(await ApiAsync<VinculoDto>("GET", $"/api/v1/vinculos/{deObra.Id}", Admin(norte), null, 200)).ExpedienteAbiertoId}", Admin(norte), null, 200);
        (expedienteObra.Flujo!.Id, expedienteObra.Flujo.Origen).ShouldBe((obra.Id, "Regla"));
        expedienteObra.Flujo.Regla!.Condicion.Atributo.ShouldBe(CampoEspecialidades); // queda anotada la condición sobre la ficha tal como estaba publicada
        expedienteObra.Requisitos!.Select(r => r.TipoDocumento.Codigo).Order().ShouldBe(["CAMARA_COMERCIO", "RUT"]);

        // Otra especialidad, o ninguna: el por defecto.
        var correoAcabados = CorreoNuevo();
        var deAcabados = await CrearVinculoConAtributosAsync(norte, "{}", correoAcabados);
        var sesionAcabados = await SesionAsync(correoAcabados);
        await GuardarEspecialidadesAsync(sesionAcabados, especialidades.EspecialidadB);
        await AceptarAsync(sesionAcabados, deAcabados.Id);
        var expedienteAcabados = await AbiertoEnAsync(norte, deAcabados.Id);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{expedienteAcabados}", Admin(norte), null, 200)).Flujo!.Id.ShouldBe(defecto.Id);

        var correoSin = CorreoNuevo();
        var sinFicha = await CrearVinculoConAtributosAsync(norte, "{}", correoSin);
        await AceptarAsync(await SesionAsync(correoSin), sinFicha.Id);
        (await ApiAsync<ExpedienteDto>("GET", $"/api/v1/expedientes/{await AbiertoEnAsync(norte, sinFicha.Id)}", Admin(norte), null, 200)).Flujo!.Id.ShouldBe(defecto.Id);

        // Vista previa: «y si declarara…». La especialidad de nivel 3 cumple la regla del grupo; la ficha de un tercero real no se lee aquí.
        var conObra = await VistaPreviaAsync(norte, new VistaPreviaDeSeleccionDto("PROVEEDOR", Ficha: FichaDeEspecialidades(especialidades.EspecialidadA)));
        (conObra.Flujo!.Id, conObra.Flujo.Origen).ShouldBe((obra.Id, "Regla"));
        conObra.Reglas.ShouldHaveSingleItem().Cumple.ShouldBeTrue();
        (await VistaPreviaAsync(norte, new VistaPreviaDeSeleccionDto("PROVEEDOR", Ficha: FichaDeEspecialidades(especialidades.EspecialidadB)))).Flujo!.Id.ShouldBe(defecto.Id);
        (await VistaPreviaAsync(norte, new VistaPreviaDeSeleccionDto("PROVEEDOR", TerceroId: deObra.TerceroId))).Flujo!.Id.ShouldBe(defecto.Id);
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/flujos/seleccion/vista-previa", Admin(norte),
            new VistaPreviaDeSeleccionDto("PROVEEDOR", Ficha: new Dictionary<string, JsonElement> { ["ficha.general.razon_social"] = JsonSerializer.SerializeToElement("Aceros") }), 422)))
            .ShouldBe("campo-de-ficha-invalido");
        (await CodigoAsync(await ApiAsync("POST", "/api/v1/flujos/seleccion/vista-previa", Admin(norte),
            new VistaPreviaDeSeleccionDto("PROVEEDOR", Ficha: FichaDeEspecialidades("especialidad mal escrita")), 422))).ShouldBe("valor-de-ficha-invalido");
    }

    [Fact]
    public async Task Las_condiciones_sobre_la_ficha_se_validan_al_guardar_el_flujo_y_el_editor_conoce_los_campos_que_puede_mirar()
    {
        var e = await PrepararAsync();
        var especialidades = await CatalogoDeEspecialidadesAsync();
        RequisitoDelFlujoDto Camara(CondicionDto condicion) => new(TipoDocumento: "CAMARA_COMERCIO", Condicion: condicion);
        var rut = new RequisitoDelFlujoDto(TipoDocumento: "RUT");
        async Task<(string? Codigo, int? Requisito)> CrearMalAsync(CrearFlujoDto dto)
        {
            var resultado = await ApiAsync("POST", "/api/v1/flujos", Admin(e.Norte), dto, 422);
            var json = await resultado.ReadAsJsonAsync<JsonElement>();
            return (json.GetProperty("codigo").GetString(), json.TryGetProperty("requisito", out var r) ? r.GetInt32() : null);
        }

        // Un campo que no es exigible, un operador que no es de su tipo, un código mal formado y uno que no existe en el catálogo.
        (await CrearMalAsync(new CrearFlujoDto("MAL_1", "Mal", "CLIENTE", Requisitos: [rut, Camara(new CondicionDto("Predicado", Atributo: "ficha.general.razon_social", Operador: "Igual", Valores: ["Aceros"]))])))
            .ShouldBe(("condicion-invalida", 1));
        (await CrearMalAsync(new CrearFlujoDto("MAL_2", "Mal", "CLIENTE", Requisitos: [rut, Camara(new CondicionDto("Predicado", Atributo: CampoEspecialidades, Operador: "Igual", Valores: [especialidades.GrupoA]))])))
            .ShouldBe(("condicion-invalida", 1));
        (await CrearMalAsync(new CrearFlujoDto("MAL_3", "Mal", "CLIENTE", Requisitos: [rut, Camara(Declara("obra gris!"))]))).ShouldBe(("condicion-invalida", 1));
        (await CrearMalAsync(new CrearFlujoDto("MAL_4", "Mal", "CLIENTE", Requisitos: [rut, Camara(Declara(especialidades.GrupoA, "ZZ.NO.EXISTE"))]))).ShouldBe(("condicion-invalida", 1));
        (await CrearMalAsync(new CrearFlujoDto("MAL_5", "Mal", "CLIENTE", Requisitos: [rut], Seleccion: new SeleccionDeFlujoDto(Declara("ZZ.NO.EXISTE"), 1))))
            .ShouldBe(("condicion-invalida", null));

        // Con códigos que existen se guarda y se publica; la condición se conserva y los códigos quedan normalizados.
        var creado = await ApiAsync<FlujoDto>("POST", "/api/v1/flujos", Admin(e.Norte), new CrearFlujoDto("BIEN", "Bien", "CLIENTE",
            Requisitos: [rut, Camara(Declara(especialidades.GrupoA.ToLowerInvariant(), especialidades.EspecialidadB))]), 201);
        var condicion = creado.Borrador!.Requisitos![1].Condicion!;
        (condicion.Atributo, condicion.Operador).ShouldBe((CampoEspecialidades, "ContieneAlguno"));
        condicion.Valores.ShouldBe([especialidades.GrupoA, especialidades.EspecialidadB]);
        await ApiAsync<FlujoDto>("POST", $"/api/v1/flujos/{creado.Id}/publicar", Admin(e.Norte), new { }, 200);

        // Una especialidad retirada del catálogo después impide publicar la siguiente versión: la condición ya no se cumpliría nunca.
        await ApiAsync<ResultadoImportacionCatalogoDto>("POST", "/api/v1/plataforma/catalogos/especialidades/importar", new Credencial(ApiFixture.ClavePlataforma),
            new ImportarCatalogoDto([new FilaCatalogoDto(especialidades.EspecialidadB, "Cerámica de prueba", Padre: $"{especialidades.GrupoB}.PIS", Nivel: 3, Activo: false)]), 200);
        var editado = await ApiAsync("PUT", $"/api/v1/flujos/{creado.Id}", Admin(e.Norte), new EditarFlujoDto(Nombre: "Bien 2"), 422);
        (await CodigoAsync(editado)).ShouldBe("condicion-invalida");

        // Lo que ofrece el editor: cada campo con su tipo, sus operadores y el catálogo de sus valores.
        var campos = await ApiAsync<List<CampoDeFichaDto>>("GET", "/api/v1/flujos/campos-de-ficha", Admin(e.Norte), null, 200);
        var especialidad = campos.Single(c => c.Ruta == CampoEspecialidades);
        (especialidad.Tipo, especialidad.Catalogo, especialidad.Jerarquica, especialidad.Etiqueta).ShouldBe(("ListaOpciones", "especialidades", true, "Especialidades"));
        especialidad.Operadores.Order().ShouldBe(["ContieneAlguno", "ContieneTodos", "Existe"]);
        campos.Single(c => c.Ruta == "ficha.general.ciiu").Catalogo.ShouldBe("actividades-economicas");
        campos.Single(c => c.Ruta == "ficha.tributaria.responsabilidades").Catalogo.ShouldBe("responsabilidades-dian");
        campos.Single(c => c.Ruta == "ficha.tributaria.responsable_ica").Operadores.Order().ShouldBe(["Distinto", "Existe", "Igual"]);
        campos.ShouldNotContain(c => c.Ruta.Contains("razon_social") || c.Ruta.Contains("correo"));
    }
}
