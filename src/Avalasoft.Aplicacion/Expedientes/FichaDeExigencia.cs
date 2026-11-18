using System.Text.Json;
using Marten;
using Avalasoft.Dominio.Comun;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.Flujos;
using Avalasoft.Dominio.Vinculos;

namespace Avalasoft.Aplicacion.Expedientes;

/// <summary>
/// La ficha del tercero como dato del motor de exigencia (EF-2, EF-4): carga lo que el tercero declaró, lo amplía con la jerarquía de los catálogos y lo
/// entrega al contexto de las condiciones. Solo se carga cuando alguna condición del flujo mira la ficha, así los flujos que no la usan no pagan nada, y solo
/// cuando la empresa ya puede verla (B-1: desde que el tercero acepta la invitación y no con acceso aislado pendiente).
/// </summary>
public static class FichaDeExigencia
{
    /// <summary>
    /// ¿La ficha del tercero está disponible para la empresa de este vínculo? Desde la aceptación (<paramref name="aceptandose"/>: la que ocurre en esta misma
    /// transacción, que aún no se refleja en el vínculo) y con la bóveda disponible (un acceso aislado pendiente o rechazado no la comparte).
    /// </summary>
    public static bool Disponible(Vinculo vinculo, bool aceptandose = false) => vinculo.BovedaDisponible && (aceptandose || vinculo.InvitacionAceptada);

    /// <summary>¿Alguna condición de los requisitos de esta versión del flujo mira la ficha?</summary>
    public static bool LaMira(FlujoVersion? version) => version is not null && version.Requisitos.Any(r => AtributosDeExigencia.MencionaFicha(r.Condicion));

    /// <summary>¿Alguna regla de selección de estos flujos mira la ficha?</summary>
    public static bool LaMiraLaSeleccion(IEnumerable<Flujo> flujos) => EvaluadorDeSeleccion.Reglas(flujos).Any(r => AtributosDeExigencia.MencionaFicha(r.Condicion));

    /// <summary>
    /// El contexto con la ficha del tercero si la <paramref name="version"/> la mira (o sin ella, si el llamador ya sabe que hace falta) y la empresa puede verla;
    /// si no, el mismo contexto.
    /// </summary>
    public static async Task<ContextoDeExigencia> CompletarAsync(IQuerySession sesion, ContextoDeExigencia contexto, Vinculo vinculo, FlujoVersion? version,
        bool aceptandose, CancellationToken ct, bool forzar = false)
    {
        if (!Disponible(vinculo, aceptandose) || (!forzar && !LaMira(version)))
            return contexto;
        var fichas = await CargarDeAsync(sesion, [vinculo.TerceroId], ct);
        return contexto.ConFicha(fichas.GetValueOrDefault(vinculo.TerceroId));
    }

    /// <summary>
    /// La ficha de cada tercero para el motor, de una sola vez (consultas entre tenants): una consulta de secciones y las cargas de catálogo que haga falta.
    /// Un tercero sin nada declarado no aparece.
    /// </summary>
    public static async Task<IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, JsonElement>>> CargarDeAsync(IQuerySession sesion,
        IReadOnlyCollection<Guid> terceroIds, CancellationToken ct)
    {
        var resultado = new Dictionary<Guid, IReadOnlyDictionary<string, JsonElement>>();
        if (terceroIds.Count == 0)
            return resultado;

        var ids = terceroIds.Distinct().ToArray();
        var secciones = await sesion.Query<SeccionDeFicha>().Where(s => s.AnyTenant() && s.TerceroId.IsOneOf(ids)).ToListAsync(ct);
        // Solo la versión vigente de las secciones sin periodo: lo que el tercero declara hoy. Una versión incompleta también cuenta: declarar es declarar.
        var datos = secciones
            .Where(s => s.Periodo is null && s.Vigente is not null)
            .GroupBy(s => s.TerceroId)
            .ToDictionary(g => g.Key,
                g => (IReadOnlyDictionary<string, JsonElement>)g.GroupBy(s => s.Seccion).ToDictionary(x => x.Key, x => x.First().Vigente!.Datos));
        if (datos.Count == 0)
            return resultado;

        var declarados = datos.ToDictionary(d => d.Key, d => FichaParaExigencia.Declarados(d.Value));
        var referencias = declarados.Values.SelectMany(FichaParaExigencia.Referencias).Distinct().ToList();
        var catalogos = await CatalogosAsync(sesion, referencias, ct);
        foreach (var (terceroId, delTercero) in declarados)
        {
            var ficha = FichaParaExigencia.Construir(delTercero, catalogos);
            if (ficha.Count > 0)
                resultado[terceroId] = ficha;
        }

        return resultado;
    }

    /// <summary>
    /// La ficha para el motor a partir de lo que alguien indica (la vista previa del editor: «y si declarara estas especialidades»), con la misma ampliación por
    /// catálogo que la de un tercero real. 422 <c>campo-de-ficha-invalido</c> si el campo no es exigible y <c>valor-de-ficha-invalido</c> si un valor no sirve.
    /// </summary>
    public static async Task<IReadOnlyDictionary<string, JsonElement>> DeValoresAsync(IQuerySession sesion, IReadOnlyDictionary<string, JsonElement> indicados,
        CancellationToken ct)
    {
        var declarados = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var (ruta, valor) in indicados)
        {
            var campo = CamposDeFicha.Buscar(ruta)
                        ?? throw ReglaDeNegocioException.Validacion("campo-de-ficha-invalido", $"«{ruta}» no es un campo de la ficha que se pueda usar en una condición.");
            var textos = valor.ValueKind switch
            {
                JsonValueKind.Array => valor.EnumerateArray().Select(e => e.ValueKind == JsonValueKind.String ? e.GetString() : null).ToList(),
                JsonValueKind.String => [valor.GetString()],
                JsonValueKind.True => ["true"],
                JsonValueKind.False => ["false"],
                _ => (List<string?>)[null]
            };
            var normalizados = textos.Select(t => campo.Normalizar((t ?? string.Empty).Trim())).ToList();
            if (normalizados.Any(n => n is null) || (!campo.EsLista && normalizados.Count != 1))
                throw ReglaDeNegocioException.Validacion("valor-de-ficha-invalido", $"El valor indicado para «{ruta}» no es válido.");
            declarados[ruta] = [.. normalizados.OfType<string>().Distinct(StringComparer.Ordinal)];
        }

        var catalogos = await CatalogosAsync(sesion, FichaParaExigencia.Referencias(declarados), ct);
        return FichaParaExigencia.Construir(declarados, catalogos);
    }

    /// <summary>
    /// Las fichas de los terceros de estos vínculos, solo de los que la empresa ya puede ver y solo si alguno de los <paramref name="flujos"/> la mira (por
    /// sus requisitos o por su selección). Para las consultas masivas de «quién pide este documento» y la política de reintento.
    /// </summary>
    public static async Task<IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, JsonElement>>> CargarDeLosVinculosAsync(IQuerySession sesion,
        IReadOnlyCollection<Vinculo> vinculos, IReadOnlyCollection<Flujo> flujos, CancellationToken ct)
    {
        var lasMira = flujos.Any(f => f.VersionPublicada is { } v && (LaMira(v) || AtributosDeExigencia.MencionaFicha(v.Seleccion?.Condicion)));
        if (!lasMira)
            return new Dictionary<Guid, IReadOnlyDictionary<string, JsonElement>>();
        return await CargarDeAsync(sesion, [.. vinculos.Where(v => Disponible(v)).Select(v => v.TerceroId)], ct);
    }

    /// <summary>
    /// El porqué de cada requisito de la <paramref name="version"/> cuya condición mira la ficha y se cumple (EF-6), por id del requisito del flujo: qué campo y
    /// qué valores declarados lo hicieron aplicar, con el nombre que hoy tienen en el catálogo. Los que no miran la ficha no aparecen.
    /// </summary>
    public static async Task<IReadOnlyDictionary<Guid, IReadOnlyList<MotivoDeExigencia>>> MotivosAsync(IQuerySession sesion, FlujoVersion version,
        ContextoDeExigencia contexto, CancellationToken ct)
    {
        var motivos = new Dictionary<Guid, IReadOnlyList<MotivoDeExigencia>>();
        var condicionados = version.Requisitos.Where(r => AtributosDeExigencia.MencionaFicha(r.Condicion) && EvaluadorDeExigencia.Aplica(r.Condicion, contexto)).ToList();
        if (condicionados.Count == 0)
            return motivos;

        var coincidencias = condicionados.ToDictionary(r => r.Id, r => EvaluadorDeExigencia.Coincidencias(r.Condicion, contexto));
        var referencias = coincidencias.Values.SelectMany(c => c)
            .Where(c => c.Campo.Catalogo is not null)
            .SelectMany(c => c.Valores.Select(v => new ReferenciaACatalogo(c.Campo.Catalogo!.Value, v)))
            .Distinct()
            .ToList();
        var catalogos = await CatalogosAsync(sesion, referencias, ct, ancestros: false);
        foreach (var (id, lista) in coincidencias.Where(c => c.Value.Count > 0))
            motivos[id] = [.. lista.Select(c => new MotivoDeExigencia(c.Campo.Ruta, c.Campo.Etiqueta, [.. c.Valores.Select(v => Nombre(c, v, catalogos))]))];
        return motivos;
    }

    private static string Nombre(CoincidenciaDeFicha coincidencia, string valor, ICatalogosDeFicha catalogos) =>
        coincidencia.Campo.Tipo == Dominio.Configuracion.TipoAtributo.Booleano
            ? valor == "true" ? "Sí" : "No"
            : coincidencia.Campo.Catalogo is { } catalogo && catalogos.Buscar(catalogo, valor) is { } entrada ? entrada.Nombre : valor;

    /// <summary>
    /// Entradas de catálogo por código. Con <paramref name="ancestros"/> sigue la cadena de padres (hasta que no haya más), una carga por nivel, para ampliar
    /// lo declarado con su categoría y su grupo.
    /// </summary>
    private static async Task<ICatalogosDeFicha> CatalogosAsync(IQuerySession sesion, IReadOnlyList<ReferenciaACatalogo> referencias, CancellationToken ct,
        bool ancestros = true)
    {
        var cargadas = new Dictionary<string, EntradaDeCatalogo>(StringComparer.Ordinal);
        var pendientes = referencias;
        for (var ronda = 0; ronda < 5 && pendientes.Count > 0; ronda++)
        {
            var ids = pendientes.Select(r => EntradaDeCatalogo.IdPara(r.Catalogo, r.Codigo)).Where(id => !cargadas.ContainsKey(id)).Distinct().ToArray();
            if (ids.Length == 0)
                break;
            var entradas = await sesion.LoadManyAsync<EntradaDeCatalogo>(ct, ids);
            foreach (var entrada in entradas)
                cargadas[entrada.Id] = entrada;
            if (!ancestros)
                break;
            pendientes = FichaParaExigencia.Padres(entradas);
        }

        return new CatalogosEnMemoria(cargadas.Values);
    }

    /// <summary>
    /// Id del requisito del flujo que originó un requisito del expediente: el de la persona cuando es de una persona relacionada, el de la sección (todos sus
    /// periodos comparten requisito del flujo) y, si no, el mismo id del requisito.
    /// </summary>
    public static Guid? RequisitoDelFlujo(FlujoVersion version, Guid requisitoId, PersonaDelRequisito? persona, TipoDeRequisito tipo, string? seccion) =>
        persona is not null
            ? persona.RequisitoDelFlujoId
            : tipo == TipoDeRequisito.Seccion
                ? version.Requisitos.FirstOrDefault(r => r.EsSeccion && string.Equals(r.Seccion, seccion, StringComparison.OrdinalIgnoreCase))?.Id
                : requisitoId;

    /// <summary>Los requisitos calculados con su porqué (EF-6) cuando la versión del flujo mira la ficha; sin eso, tal cual.</summary>
    public static async Task<IReadOnlyList<RequisitoCalculado>> ConMotivosAsync(IQuerySession sesion, FlujoVersion version, ContextoDeExigencia contexto,
        IReadOnlyList<RequisitoCalculado> calculados, CancellationToken ct)
    {
        if (!LaMira(version) || calculados.Count == 0)
            return calculados;
        var motivos = await MotivosAsync(sesion, version, contexto, ct);
        if (motivos.Count == 0)
            return calculados;
        return
        [
            .. calculados.Select(c => RequisitoDelFlujo(version, c.RequisitoId, c.Persona, c.TipoRequisito, c.Seccion) is { } id && motivos.TryGetValue(id, out var porQue)
                ? c with { PorQue = porQue }
                : c)
        ];
    }
}
