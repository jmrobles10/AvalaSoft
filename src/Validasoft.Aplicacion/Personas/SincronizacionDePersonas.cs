using Marten;
using Validasoft.Aplicacion.Comun;
using Validasoft.Aplicacion.Documentos;
using Validasoft.Aplicacion.Ficha;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Documentos;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.Identidad;
using Validasoft.Dominio.Plataforma;
using Validasoft.Dominio.Terceros;
using Wolverine;

namespace Validasoft.Aplicacion.Personas;

/// <summary>
/// La sección legal de la ficha de un tercero tiene una versión nueva (o hay que ponerla al día): sus representantes, suplentes y socios se vuelven terceros persona natural
/// con bóveda propia y sus relaciones (ADR-0010, PR-2). Lo publica el guardado de la sección en el outbox de la bóveda; el manejador es idempotente.
/// </summary>
public sealed record SincronizarPersonasDeFicha(Guid TerceroId);

public static class SincronizarPersonasDeFichaHandler
{
    public static async Task Handle(SincronizarPersonasDeFicha mensaje, IDocumentStore store, TimeProvider reloj, IMessageBus mensajes, CancellationToken ct) =>
        await SincronizacionDePersonas.SincronizarAsync(store, reloj, mensaje.TerceroId, mensajes, ct);
}

/// <summary>Cuántas personas y relaciones tocó una sincronización.</summary>
public sealed record ResultadoDeSincronizacionDePersonas(int PersonasNuevas, int RelacionesNuevas, int RelacionesAjustadas, int RelacionesTerminadas)
{
    public bool HuboCambios => PersonasNuevas + RelacionesNuevas + RelacionesAjustadas + RelacionesTerminadas > 0;

    public static readonly ResultadoDeSincronizacionDePersonas SinCambios = new(0, 0, 0, 0);
}

/// <summary>
/// Sincroniza las personas relacionadas desde la sección legal de la ficha (PR-2): cada representante legal, suplente y socio con una identificación de persona natural
/// válida es un <see cref="Tercero"/> (único por país, tipo y número: si ya existía, por ser otro tercero o la misma persona en otra empresa, se reutiliza y con ella su
/// bóveda) y queda unida al tercero por una <see cref="RelacionEntreTerceros"/> vigente; la de quien deja de figurar termina. La ficha sigue funcionando igual: nada de
/// esto cambia lo que el tercero diligencia ni lo que ven las empresas. Idempotente (sin diferencias no escribe) y a prueba de carreras (la clave única del tercero y el id
/// determinista de la relación se reintentan).
/// </summary>
public static class SincronizacionDePersonas
{
    public const string Actor = "sincronizacion-de-personas";

    /// <summary>
    /// Pone al día las personas del tercero con su ficha legal vigente. Si algo cambió y hay <paramref name="mensajes"/>, pide a cada vínculo aceptado del tercero que ponga al
    /// día los requisitos de persona de su expediente abierto (las personas ahora existen) y reevalúa las listas restrictivas de lo consultado.
    /// </summary>
    public static async Task<ResultadoDeSincronizacionDePersonas> SincronizarAsync(IDocumentStore store, TimeProvider reloj, Guid terceroId, IMessageBus? mensajes,
        CancellationToken ct)
    {
        var resultado = await Peticiones.ConReintentosAsync(async () =>
        {
            var ahora = reloj.GetUtcNow();
            var hoy = CalculadoraDeVigencia.Fecha(ahora);
            await using var sesion = store.LightweightSession(TenantsTecnicos.Boveda);
            sesion.SetHeader("actorTipo", ActorTipo.Sistema.ToString());
            sesion.SetHeader("actorId", Actor);

            var tercero = await sesion.LoadAsync<Tercero>(terceroId, ct);
            if (tercero is null)
                return ResultadoDeSincronizacionDePersonas.SinCambios;

            var legal = await sesion.LoadAsync<SeccionDeFicha>(SeccionDeFicha.IdPara(terceroId, CodigosDeSeccion.Legal, null), ct);
            var datos = legal?.Vigente is { } version ? JsonDeFicha.Deserializar<DatosLegales>(version.Datos) : null;
            var declaradas = PersonasDeLaFicha.Leer(datos, tercero.Identificacion);
            var existentes = await sesion.Query<RelacionEntreTerceros>().Where(r => r.DestinoId == terceroId).ToListAsync(ct);
            if (declaradas.Count == 0 && !existentes.Any(r => r.DeFicha && r.Estado == EstadoDeRelacion.Confirmada))
                return ResultadoDeSincronizacionDePersonas.SinCambios;

            var (personaDe, nuevas) = await AsegurarPersonasAsync(sesion, tercero, declaradas, ahora, ct);
            // De dónde vienen las personas: la ficha que diligenció el tercero es una declaración suya; la que trajo un importador o un sistema de origen, una importación.
            var fuente = legal?.Vigente?.Origen is null or OrigenDeSeccion.Tercero ? FuenteDeRelacion.Declarada : FuenteDeRelacion.Importacion;
            var cambios = ConciliacionDeRelaciones.Calcular(terceroId, declaradas, personaDe, existentes, hoy, ahora, terceroId.ToString(), fuente);
            foreach (var cambio in cambios)
            {
                if (cambio.EsNueva)
                    sesion.Events.StartStream<RelacionEntreTerceros>(cambio.RelacionId, cambio.Eventos.ToArray());
                else
                    (await sesion.Events.FetchForWriting<RelacionEntreTerceros>(cambio.RelacionId, ct)).AppendMany(cambio.Eventos.ToArray());
            }

            if (nuevas == 0 && cambios.Count == 0)
                return ResultadoDeSincronizacionDePersonas.SinCambios;
            await sesion.SaveChangesAsync(ct);
            return new ResultadoDeSincronizacionDePersonas(nuevas, cambios.Count(c => c.EsNueva),
                cambios.Count(c => !c.EsNueva && !c.Eventos.OfType<RelacionTerminada>().Any()), cambios.Count(c => c.Eventos.OfType<RelacionTerminada>().Any()));
        });

        if (resultado.HuboCambios && mensajes is not null)
            await AvisarDeCambiosAsync(store, mensajes, terceroId, ct);
        return resultado;
    }

    /// <summary>
    /// Después de cambiar las relaciones de un tercero: cada vínculo aceptado suyo pone al día los requisitos de persona de su expediente abierto y las listas restrictivas
    /// ya consultadas se reevalúan con las personas de ahora (CU-15).
    /// </summary>
    public static async Task AvisarDeCambiosAsync(IDocumentStore store, IMessageBus mensajes, Guid terceroId, CancellationToken ct)
    {
        await using (var sesion = store.LightweightSession(TenantsTecnicos.Boveda))
            await GuardadoDeSecciones.PedirSincronizacionAsync(sesion, terceroId, mensajes, ActorTipo.Sistema.ToString(), Actor, ct);
        await mensajes.PublishAsync(new Verificaciones.PersonasDeFichaCambiaron(terceroId));
    }

    /// <summary>
    /// El tercero persona de cada declarada: el que ya existe por su clave única o uno nuevo (persona natural, sin contactos, sin vínculos). Un tercero de pruebas (sandbox) solo
    /// tiene personas de pruebas, con la clave aislada. Devuelve el id por clave y cuántas creó.
    /// </summary>
    internal static async Task<(IReadOnlyDictionary<string, Guid> PersonaDe, int Nuevas)> AsegurarPersonasAsync(IDocumentSession sesion, Tercero tercero,
        IReadOnlyList<PersonaDeclarada> declaradas, DateTimeOffset ahora, CancellationToken ct)
    {
        var personaDe = new Dictionary<string, Guid>(StringComparer.Ordinal);
        if (declaradas.Count == 0)
            return (personaDe, 0);

        string Clave(PersonaDeclarada p) => AislamientoDeSandbox.ClaveDeTercero(p.Clave, tercero.SandboxTenantId);
        var claves = declaradas.Select(Clave).Distinct().ToArray();
        var existentes = (await sesion.Query<Tercero>().Where(t => t.ClaveIdentificacion.IsOneOf(claves)).ToListAsync(ct)).ToDictionary(t => t.ClaveIdentificacion);

        var nuevas = 0;
        foreach (var declarada in declaradas.DistinctBy(d => d.Clave))
        {
            if (existentes.TryGetValue(Clave(declarada), out var persona))
            {
                personaDe[declarada.Clave] = persona.Id;
                continue;
            }

            persona = Tercero.Crear(declarada.Identificacion, TipoPersona.Natural, declarada.Nombre, null, null, ahora);
            if (tercero.SandboxTenantId is { } sandbox)
                persona.AislarEnSandbox(sandbox);
            sesion.Store(persona);
            personaDe[declarada.Clave] = persona.Id;
            nuevas++;
        }

        return (personaDe, nuevas);
    }
}
