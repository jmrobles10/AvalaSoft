using Marten;
using Validasoft.Aplicacion.Comun;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Documentos;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.Identidad;
using Validasoft.Dominio.Plataforma;
using Validasoft.Dominio.Terceros;

namespace Validasoft.Aplicacion.Personas;

/// <summary>
/// La IA terminó de analizar una versión de la Cámara de comercio de un tercero (ADR-0010, PR-4): hay que comparar los representantes que leyó con los que el tercero tiene
/// vigentes. Lo publica el análisis en el outbox de la bóveda; el manejador es idempotente.
/// </summary>
public sealed record ReconciliarRelacionesConCamara(Guid TerceroId, Guid DocumentoId, int Numero);

public static class ReconciliarRelacionesConCamaraHandler
{
    public static async Task Handle(ReconciliarRelacionesConCamara mensaje, IDocumentStore store, TimeProvider reloj, CancellationToken ct) =>
        await ReconciliacionDeRelaciones.ReconciliarAsync(store, reloj, mensaje, ct);
}

/// <summary>
/// Reconciliación de fuentes (ADR-0010, regla 5): la relación la declara el tercero o la lee la IA de la Cámara de comercio, y las dos pueden discrepar. Un representante o
/// suplente de la Cámara que no es el que el tercero tiene vigente <b>no cambia nada</b>: queda como una relación <see cref="EstadoDeRelacion.Propuesta"/>
/// (<see cref="CambioDeRelacionDetectado"/>, con la confianza del análisis y la versión del documento) hasta que el tercero la confirme o la descarte desde sus personas
/// relacionadas. Pendiente (documentado): la confirmación de un revisor al revalidar la Cámara y la automática con confianza de 0,98 o más con la Cámara aprobada.
/// </summary>
public static class ReconciliacionDeRelaciones
{
    /// <summary>Crea las propuestas que falten; devuelve cuántas. Solo si la versión es la actual de la Cámara del tercero y la IA la leyó (legible, con representantes).</summary>
    public static async Task<int> ReconciliarAsync(IDocumentStore store, TimeProvider reloj, ReconciliarRelacionesConCamara mensaje, CancellationToken ct)
    {
        var creadas = await Peticiones.ConReintentosAsync(async () =>
        {
            var ahora = reloj.GetUtcNow();
            var hoy = CalculadoraDeVigencia.Fecha(ahora);
            await using var sesion = store.LightweightSession(TenantsTecnicos.Boveda);
            sesion.SetHeader("actorTipo", ActorTipo.Sistema.ToString());
            sesion.SetHeader("actorId", "reconciliacion-de-relaciones");

            var documento = await sesion.LoadAsync<Documento>(mensaje.DocumentoId, ct);
            if (documento is not { Ambito: AmbitoDocumento.Global, TipoCanonico: "CAMARA_COMERCIO" } || documento.TerceroId != mensaje.TerceroId ||
                documento.VersionActual != mensaje.Numero || documento.Buscar(mensaje.Numero)?.Ia is not { Legible: true } analisis)
                return 0;
            var tercero = await sesion.LoadAsync<Tercero>(mensaje.TerceroId, ct);
            var extraidas = LecturaDeHechos.Personas(analisis.Campos, "representantesLegales");
            if (tercero is null || extraidas is not { Count: > 0 })
                return 0;

            var relaciones = await sesion.Query<RelacionEntreTerceros>().Where(r => r.DestinoId == tercero.Id).ToListAsync(ct);
            var personas = relaciones.Count == 0
                ? new Dictionary<Guid, Tercero>()
                : (await sesion.Query<Tercero>().Where(t => t.Id.IsOneOf(relaciones.Select(r => r.OrigenId).Distinct().ToArray())).ToListAsync(ct)).ToDictionary(t => t.Id);
            var delTercero = relaciones.Where(r => personas.ContainsKey(r.OrigenId)).Select(r => new RelacionConPersona(r, personas[r.OrigenId].Nombre, personas[r.OrigenId].Identificacion)).ToList();

            var distintas = DeteccionDeRelaciones.Distintas(extraidas, delTercero, hoy, documento.Id, mensaje.Numero);
            if (distintas.Count == 0)
                return 0;

            var (personaDe, _) = await SincronizacionDePersonas.AsegurarPersonasAsync(sesion, tercero, distintas, ahora, ct);
            foreach (var persona in distintas)
            {
                var id = RelacionEntreTerceros.IdPara(tercero.Id, personaDe[persona.Clave], persona.Tipo);
                var existente = relaciones.FirstOrDefault(r => r.Id == id);
                if (existente is null)
                {
                    sesion.Events.StartStream<RelacionEntreTerceros>(id, RelacionEntreTerceros.Detectar(personaDe[persona.Clave], tercero.Id, persona.Tipo, persona.Principal, null,
                        persona.Cargo, analisis.Confianza, documento.Id, mensaje.Numero, ahora));
                }
                else if (existente.Redetectar(persona.Principal, null, persona.Cargo, analisis.Confianza, documento.Id, mensaje.Numero, ahora) is { } nueva)
                {
                    (await sesion.Events.FetchForWriting<RelacionEntreTerceros>(id, ct)).AppendOne(nueva);
                }
            }

            await sesion.SaveChangesAsync(ct);
            return distintas.Count;
        });

        return creadas;
    }
}
