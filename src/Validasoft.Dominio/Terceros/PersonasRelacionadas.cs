using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Ficha;
using Validasoft.Dominio.Identificaciones;

namespace Validasoft.Dominio.Terceros;

/// <summary>
/// Quién cuenta hoy en las relaciones de un tercero y quién es «la» persona de un rol (ADR-0010, regla 4). Funciones puras: la aplicación les pasa las relaciones que leyó.
/// </summary>
public static class RelacionesDeTercero
{
    /// <summary>Las relaciones que cuentan hoy: confirmadas, ya iniciadas y sin terminar.</summary>
    public static IReadOnlyList<RelacionEntreTerceros> Vigentes(IEnumerable<RelacionEntreTerceros> relaciones, DateOnly hoy) =>
    [
        .. relaciones.Where(r => r.EsVigente(hoy)).OrderBy(r => r.Tipo).ThenByDescending(r => r.Principal).ThenBy(r => r.VigenteDesde).ThenBy(r => r.Id)
    ];

    /// <summary>
    /// Las personas que debe cubrir un requisito <c>DePersonaRelacionada</c>: la relación <b>principal vigente</b> del rol o, con <paramref name="todas"/>, todas las
    /// vigentes del rol (la principal primero). Si ninguna se marcó principal (o hay dos marcadas por una carrera), la principal es la confirmada más
    /// reciente de las marcadas, y a falta de marca la más antigua. Sin relaciones vigentes del rol ⇒ vacío (el requisito queda sin persona hasta que se declare).
    /// </summary>
    public static IReadOnlyList<RelacionEntreTerceros> Resolver(IEnumerable<RelacionEntreTerceros> relaciones, TipoRelacionTerceros rol, bool todas, DateOnly hoy)
    {
        var delRol = relaciones.Where(r => r.Tipo == rol && r.EsVigente(hoy)).ToList();
        if (delRol.Count == 0)
            return [];

        var ordenadas = delRol
            .OrderByDescending(r => r.Principal)
            .ThenByDescending(r => r.Principal ? r.VigenteDesde : DateOnly.MinValue)
            .ThenBy(r => r.VigenteDesde)
            .ThenBy(r => r.Id)
            .ToList();
        return todas ? ordenadas : [ordenadas[0]];
    }
}

/// <summary>
/// Persona natural que declara la ficha legal de un tercero y que ADR-0010 vuelve un tercero con bóveda propia: su identificación (país, tipo y número normalizado), su
/// nombre y cómo se relaciona (rol, si es la principal de su tipo, participación y cargo). <see cref="Clave"/> es la clave única global del tercero persona.
/// </summary>
public sealed record PersonaDeclarada(Identificacion Identificacion, string Nombre, TipoRelacionTerceros Tipo, bool Principal, decimal? Participacion, string? Cargo)
{
    public string Clave => Identificacion.Clave;
}

/// <summary>
/// Lee las personas relacionadas de la sección legal de la ficha (FM-7): representante legal, suplente y socio son relaciones del ADR-0010; el apoderado, la
/// junta directiva, el revisor fiscal y el contador quedan como datos de la ficha (no son un tipo de relación del ADR), y una persona jurídica socia (NIT) tampoco: el
/// ADR habla de personas naturales. Función pura.
/// </summary>
public static class PersonasDeLaFicha
{
    private static readonly HashSet<string> TiposColombianos = new(StringComparer.Ordinal) { "CC", "CE", "TI", "PPT", "PA" };

    /// <summary>
    /// Las personas con una relación del ADR que trae la sección legal, sin repetir (persona, tipo) y con la principal de cada tipo ya marcada: la del representante legal
    /// es la que regla el ERP (<see cref="RepresentanteLegalPrincipal"/>: la primera con representación «Principal», si no la primera); la del suplente, la primera; la del
    /// socio, la de mayor participación. Las filas sin nombre, con una identificación inválida o que son el propio tercero se omiten (la sección ya las rechaza o las
    /// marca incompletas).
    /// </summary>
    public static IReadOnlyList<PersonaDeclarada> Leer(DatosLegales? legal, Identificacion delTercero)
    {
        var filas = new List<(PersonaDeclarada Persona, bool EsPrincipal)>();
        foreach (var fila in legal?.Personas ?? [])
        {
            var tipo = fila.Rol switch
            {
                RolPersonaRelacionada.RepresentanteLegal => TipoRelacionTerceros.RepresentanteLegal,
                RolPersonaRelacionada.Suplente => TipoRelacionTerceros.Suplente,
                RolPersonaRelacionada.Socio => TipoRelacionTerceros.Socio,
                _ => (TipoRelacionTerceros?)null
            };
            if (tipo is null)
                continue;

            var nombre = string.Join(' ', new[] { fila.Nombres, fila.Apellidos }.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n!.Trim()));
            if (nombre.Length == 0 || Identificar(fila, delTercero) is not { } identificacion || identificacion.Clave == delTercero.Clave)
                continue;
            if (filas.Any(f => f.Persona.Clave == identificacion.Clave && f.Persona.Tipo == tipo))
                continue;

            var persona = new PersonaDeclarada(identificacion, nombre, tipo.Value, false, tipo == TipoRelacionTerceros.Socio ? fila.Porcentaje : null,
                string.IsNullOrWhiteSpace(fila.Cargo) ? null : fila.Cargo.Trim());
            filas.Add((persona, tipo == TipoRelacionTerceros.RepresentanteLegal && RepresentanteLegalPrincipal.EsPrincipal(fila.TipoRepresentacion)));
        }

        var resultado = new List<PersonaDeclarada>();
        foreach (var grupo in filas.GroupBy(f => f.Persona.Tipo))
        {
            var lista = grupo.ToList();
            var principal = grupo.Key switch
            {
                TipoRelacionTerceros.RepresentanteLegal => lista.FirstOrDefault(f => f.EsPrincipal).Persona ?? lista[0].Persona,
                TipoRelacionTerceros.Socio => lista.OrderByDescending(f => f.Persona.Participacion ?? -1).First().Persona,
                _ => lista[0].Persona
            };
            resultado.AddRange(lista.Select(f => f.Persona with { Principal = f.Persona.Clave == principal.Clave }));
        }

        return resultado;
    }

    /// <summary>
    /// Identificación de la persona natural de una fila: los tipos colombianos (cédula, extranjería, tarjeta, PPT, pasaporte «PA») van con país CO; el pasaporte y la
    /// identificación fiscal genéricos, con el país de la nacionalidad (o el del tercero). Un NIT no es una persona natural: nulo, como un número inválido.
    /// </summary>
    internal static Identificacion? Identificar(PersonaRelacionada fila, Identificacion delTercero)
    {
        var tipo = (fila.TipoIdentificacion ?? string.Empty).Trim().ToUpperInvariant();
        var numero = fila.Numero;
        if (tipo.Length == 0 || string.IsNullOrWhiteSpace(numero) || tipo == "NIT")
            return null;

        var pais = TiposColombianos.Contains(tipo) ? "CO"
            : !string.IsNullOrWhiteSpace(fila.Nacionalidad) ? fila.Nacionalidad.Trim().ToUpperInvariant()
            : delTercero.Pais;
        try
        {
            var identificacion = Identificacion.Crear(pais, tipo, numero);
            var tipoId = CatalogoIdentificacion.Buscar(identificacion.Pais, identificacion.Tipo);
            return tipoId is null || tipoId.AplicaA == AplicaA.Juridica ? null : identificacion;
        }
        catch (ReglaDeNegocioException)
        {
            return null;
        }
    }
}

/// <summary>Una relación de un tercero con los datos de la persona (nombre e identificación) para compararla con lo que lee la IA de un documento.</summary>
public sealed record RelacionConPersona(RelacionEntreTerceros Relacion, string Nombre, Identificacion Identificacion);

/// <summary>
/// Reconciliación de fuentes (ADR-0010, regla 5): qué representantes y suplentes lee la IA en la Cámara de comercio que <b>no</b> son los que el tercero tiene vigentes. Lo que
/// devuelve es lo que se <b>propone</b> (nunca lo que se cambia): la relación cambia cuando el tercero lo confirma. Función pura.
/// </summary>
public static class DeteccionDeRelaciones
{
    private static readonly System.Text.RegularExpressions.Regex Documento =
        new(@"^(?<tipo>CC|CE|TI|PPT|PA)?(?<numero>[0-9]{3,15})$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    /// <summary>
    /// Las personas de la Cámara (<paramref name="extraidas"/>: nombre, identificación y cargo) que el tercero no tiene como representante legal o suplente vigente: cada una
    /// con su tipo (suplente si el cargo lo dice; si no, representante legal) y como principal si es un representante legal. Solo compara contra un tercero que <b>ya tiene</b> un
    /// representante legal vigente (sin ninguno, lo que la IA lee llega por la propuesta de la ficha, FM-13). Una persona sin un número de identificación válido no se propone
    /// (no se puede crear su bóveda); una que ya es una propuesta pendiente, o que el tercero ya descartó con este mismo documento, tampoco.
    /// </summary>
    public static IReadOnlyList<PersonaDeclarada> Distintas(IReadOnlyList<PersonaExtraida> extraidas, IReadOnlyList<RelacionConPersona> delTercero, DateOnly hoy,
        Guid? documentoId, int? version)
    {
        var vigentes = delTercero.Where(r => r.Relacion.EsVigente(hoy) && r.Relacion.Tipo is TipoRelacionTerceros.RepresentanteLegal or TipoRelacionTerceros.Suplente).ToList();
        if (!vigentes.Any(r => r.Relacion.Tipo == TipoRelacionTerceros.RepresentanteLegal))
            return [];

        var resultado = new List<PersonaDeclarada>();
        foreach (var persona in extraidas)
        {
            if (Identificar(persona.Identificacion) is not { } identificacion || string.IsNullOrWhiteSpace(persona.Nombre))
                continue;
            var suplente = Ficha.Normalizacion.Texto(persona.Cargo).Contains("SUPLENTE", StringComparison.Ordinal);
            var tipo = suplente ? TipoRelacionTerceros.Suplente : TipoRelacionTerceros.RepresentanteLegal;
            if (vigentes.Any(r => r.Relacion.Tipo == tipo && Ficha.CruceConDocumento.MismaPersona(persona.Nombre, identificacion.Numero, r.Nombre, r.Identificacion.Numero)))
                continue;
            if (resultado.Any(r => r.Tipo == tipo && r.Clave == identificacion.Clave))
                continue;

            var propia = delTercero.FirstOrDefault(r => r.Relacion.Tipo == tipo && r.Identificacion.Clave == identificacion.Clave);
            if (propia is { Relacion: { Estado: EstadoDeRelacion.Propuesta } })
                continue;
            if (propia is { Relacion: { Estado: EstadoDeRelacion.Descartada } descartada } && descartada.DocumentoId == documentoId && descartada.VersionDelDocumento == version)
                continue;

            resultado.Add(new PersonaDeclarada(identificacion, persona.Nombre.Trim(), tipo, !suplente, null, string.IsNullOrWhiteSpace(persona.Cargo) ? null : persona.Cargo.Trim()));
        }

        return resultado;
    }

    /// <summary>Cédula de ciudadanía (o extranjería, tarjeta, PPT, pasaporte) a partir del texto que lee la IA («CC 80.123.456», «80123456»); sin prefijo es una cédula.</summary>
    public static Identificacion? Identificar(string? texto)
    {
        var limpio = new string((texto ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        var coincidencia = Documento.Match(limpio);
        if (!coincidencia.Success)
            return null;
        try
        {
            return Identificacion.Crear("CO", coincidencia.Groups["tipo"].Success ? coincidencia.Groups["tipo"].Value : "CC", coincidencia.Groups["numero"].Value);
        }
        catch (ReglaDeNegocioException)
        {
            return null;
        }
    }
}

/// <summary>Lo que hay que escribir en el stream de una relación para que quede como lo declara la ficha: crear el stream o anexar eventos al existente.</summary>
public sealed record CambioEnRelacion(Guid RelacionId, bool EsNueva, IReadOnlyList<object> Eventos);

/// <summary>
/// Concilia las relaciones que mantiene la ficha con lo que declara hoy (ADR-0010, punto 2): cada persona declarada queda con una relación vigente (se crea, se
/// restablece si había terminado, se ajusta si cambió su principal, su participación o su cargo) y la relación de la ficha de quien ya no figura termina. Idempotente: si
/// todo está igual, no emite nada. No toca las relaciones que no son de la ficha (las declaradas a mano, las de un importador, las propuestas por la IA).
/// </summary>
public static class ConciliacionDeRelaciones
{
    public const string AutorDeLaFicha = "ficha";

    public const string MotivoDeSalida = "La persona ya no figura en la información legal del tercero.";

    /// <param name="destinoId">El tercero cuya ficha se concilia.</param>
    /// <param name="declaradas">Lo que declara su sección legal vigente.</param>
    /// <param name="personaDe">El id del tercero persona de cada clave declarada (el llamador ya lo creó si faltaba).</param>
    /// <param name="existentes">Las relaciones que ya tiene el tercero destino (de cualquier fuente y estado).</param>
    /// <param name="hoy">Día de negocio.</param>
    /// <param name="ahora">Instante del cambio.</param>
    /// <param name="por">Quién lo registra (el tercero o el importador).</param>
    /// <param name="fuente">De dónde vienen las personas (la ficha la llena el tercero, el importador o un sistema de origen).</param>
    public static IReadOnlyList<CambioEnRelacion> Calcular(Guid destinoId, IReadOnlyList<PersonaDeclarada> declaradas, IReadOnlyDictionary<string, Guid> personaDe,
        IReadOnlyList<RelacionEntreTerceros> existentes, DateOnly hoy, DateTimeOffset ahora, string por, FuenteDeRelacion fuente = FuenteDeRelacion.Declarada)
    {
        var porId = existentes.ToDictionary(r => r.Id);
        var cambios = new List<CambioEnRelacion>();
        var declaradasIds = new HashSet<Guid>();

        foreach (var persona in declaradas)
        {
            var origenId = personaDe[persona.Clave];
            var id = RelacionEntreTerceros.IdPara(destinoId, origenId, persona.Tipo);
            declaradasIds.Add(id);

            if (!porId.TryGetValue(id, out var relacion))
            {
                cambios.Add(new CambioEnRelacion(id, true,
                    [RelacionEntreTerceros.Registrar(origenId, destinoId, persona.Tipo, persona.Principal, persona.Participacion, persona.Cargo, hoy, fuente, true, por, ahora)]));
                continue;
            }

            var eventos = new List<object>();
            // Terminada por otra causa que salir de la ficha (el tercero confirmó a quien la reemplaza): la ficha, que puede seguir desactualizada, no la revive sola;
            // solo se restablece al volver a declararla de forma explícita.
            if (relacion.Estado == EstadoDeRelacion.Finalizada && relacion.MotivoDeTermino != MotivoDeSalida)
                continue;
            if (relacion.Estado == EstadoDeRelacion.Propuesta)
            {
                // Lo que la IA propuso y el tercero ahora declara en su ficha: la declaración es la confirmación.
                eventos.Add(relacion.Confirmar(por, ViaDeConfirmacionDeRelacion.Tercero, hoy, ahora, deFicha: true)!);
                var confirmada = relacion.Proyectar(eventos);
                AjustarDatos(confirmada, persona, ahora, eventos);
            }
            else if (relacion.Restablecer(hoy, persona.Principal, persona.Participacion, persona.Cargo, por, ahora, deFicha: true) is { } restablecida)
            {
                eventos.Add(restablecida);
            }
            else
            {
                AjustarDatos(relacion, persona, ahora, eventos);
            }

            if (eventos.Count > 0)
                cambios.Add(new CambioEnRelacion(id, false, eventos));
        }

        // Las de la ficha de quien ya no figura (o que figura con otro rol) terminan.
        foreach (var relacion in existentes.Where(r => r.DeFicha && r.Estado == EstadoDeRelacion.Confirmada && !declaradasIds.Contains(r.Id)))
        {
            if (relacion.Terminar(hoy, MotivoDeSalida, por, ahora) is { } terminada)
                cambios.Add(new CambioEnRelacion(relacion.Id, false, [terminada]));
        }

        return cambios;
    }

    private static void AjustarDatos(RelacionEntreTerceros relacion, PersonaDeclarada persona, DateTimeOffset ahora, List<object> eventos)
    {
        if (relacion.MarcarPrincipal(persona.Principal, ahora) is { } principal)
            eventos.Add(principal);
        if (relacion.Actualizar(persona.Participacion, persona.Cargo, ahora) is { } actualizada)
            eventos.Add(actualizada);
    }
}
