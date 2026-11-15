using Validasoft.Dominio.Identidad;

namespace Validasoft.Aplicacion.Comun;

/// <summary>Permisos (scopes) de docs/07 §3.2 usados en esta entrega. Cada uno es una política de autorización.</summary>
public static class Permisos
{
    public const string PlataformaTenants = "plataforma:tenants";
    public const string EmpresasAdministrar = "empresas:administrar";
    public const string ApiKeysAdministrar = "api-keys:administrar";
    public const string SistemasAdministrar = "sistemas:administrar";
    public const string UsuariosAdministrar = "usuarios:administrar";
    public const string ConfiguracionLeer = "configuracion:leer";
    public const string ConfiguracionEscribir = "configuracion:escribir";
    public const string TercerosLeer = "terceros:leer";
    public const string TercerosEscribir = "terceros:escribir";
    public const string VinculosLeer = "vinculos:leer";
    public const string VinculosEscribir = "vinculos:escribir";
    public const string VinculosBloquear = "vinculos:bloquear";

    /// <summary>
    /// Eximir a un vínculo de requisitos (y revocarlo): la empresa decide no perseguir su renovación (EX-5). Lo tiene el administrador (de todo el grupo o de la
    /// empresa) y cualquier llave de API a la que se le marque; ningún otro rol, porque es una decisión que deja sin vigilancia a un tercero.
    /// </summary>
    public const string VinculosEximir = "vinculos:eximir";

    /// <summary>Aprobar o rechazar la cuenta bancaria que designa el tercero (cuatro ojos, CB-2).</summary>
    public const string CuentasAprobar = "cuentas:aprobar";
    public const string AuditoriaLeer = "auditoria:leer";

    /// <summary>Exportar la auditoría a Excel con los filtros de la pantalla (IF-4; docs/07 §3.2: Administrador y Auditor).</summary>
    public const string AuditoriaExportar = "auditoria:exportar";
    public const string FlujosLeer = "flujos:leer";
    public const string FlujosEscribir = "flujos:escribir";
    public const string ExpedientesLeer = "expedientes:leer";

    /// <summary>Emitir veredictos y rechazar (además hay que ser miembro activo del área).</summary>
    public const string ExpedientesRevisar = "expedientes:revisar";

    /// <summary>Abrir, anular, reenviar como integrador, aprobar en nombre de un área y anular veredictos.</summary>
    public const string ExpedientesAdministrar = "expedientes:administrar";

    /// <summary>
    /// Descargar el expediente completo en ZIP (documentos aceptados, resumen PDF y línea de tiempo, IF-5). Además pide
    /// <c>documentos:descargar</c>; cada documento incluido queda como <c>DocumentoAccedido</c> y la exportación, en la auditoría.
    /// </summary>
    public const string ExpedientesExportar = "expedientes:exportar";

    /// <summary>Ver los documentos compartidos con un vínculo de la empresa (versiones, hechos).</summary>
    public const string DocumentosLeer = "documentos:leer";

    /// <summary>Emitir URLs prefirmadas de descarga; cada emisión queda como <c>DocumentoAccedido</c>.</summary>
    public const string DocumentosDescargar = "documentos:descargar";

    /// <summary>Ver los certificados de la empresa y descargar su PDF (cada descarga se audita). Revocar pide <c>expedientes:administrar</c>.</summary>
    public const string CertificadosLeer = "certificados:leer";

    /// <summary>Leer los eventos públicos en modo pull y por SSE (<c>GET /eventos</c>, NW-1).</summary>
    public const string EventosLeer = "eventos:leer";

    /// <summary>Crear y gestionar suscripciones de webhooks y sus entregas (NW-4).</summary>
    public const string WebhooksAdministrar = "webhooks:administrar";

    /// <summary>
    /// Consulta rápida del estado de certificación de un tercero (<c>GET /consultas/certificacion</c>, H9): la usa Marco al
    /// pagar o contratar. Solo devuelve el resumen (sin documentos ni datos personales); por eso va aparte de los demás.
    /// </summary>
    public const string ConsultasLeer = "consultas:leer";

    /// <summary>
    /// Crear, sincronizar y reiniciar el sandbox del grupo y leer su buzón de correo de pruebas (SB-6). Se obtiene como los demás
    /// de administración del tenant; una API key de prueba con este permiso puede reiniciar su propio sandbox.
    /// </summary>
    public const string SandboxAdministrar = "sandbox:administrar";

    /// <summary>
    /// Abrir una sesión corta del tercero para embeber su bóveda, su expediente o su ficha en el iframe de un sistema integrador
    /// (<c>POST /sesiones-tercero</c>, IO-5). Solo la API key de un sistema integrador la usa.
    /// </summary>
    public const string SesionesTerceroCrear = "sesiones-tercero:crear";

    /// <summary>Consultar o reconsultar las listas restrictivas de un expediente (VE-15).</summary>
    public const string VerificacionesEscribir = "verificaciones:escribir";

    /// <summary>Decidir como Cumplimiento: resolver coincidencias en listas y registrar el estudio SAGRILAFT (VE-15).</summary>
    public const string CumplimientoDecidir = "cumplimiento:decidir";

    /// <summary>
    /// Atender las solicitudes de habeas data (consulta, corrección y supresión) que los terceros dirigen a la empresa (OD-3, docs/07 §3.2):
    /// el Administrador y el Oficial de cumplimiento. Las de la bóveda global las atiende la Plataforma.
    /// </summary>
    public const string SupresionesResolver = "supresiones:resolver";

    /// <summary>Ver los cuestionarios de evaluación de la empresa y sus versiones (CE-1). Los edita y publica <see cref="CuestionariosEscribir"/>; solo el administrador.</summary>
    public const string CuestionariosLeer = "cuestionarios:leer";

    /// <summary>Crear, editar y publicar cuestionarios de evaluación (CE-1).</summary>
    public const string CuestionariosEscribir = "cuestionarios:escribir";

    /// <summary>Ver las evaluaciones de proveedores de la empresa, su resultado y el informe (CE-3, CE-12). Privadas de la empresa.</summary>
    public const string EvaluacionesLeer = "evaluaciones:leer";

    /// <summary>Responder como evaluador interno las evaluaciones cuyo cuestionario lo pide (CE-4): una persona de la empresa, nunca una llave sin usuario delegado.</summary>
    public const string EvaluacionesResponder = "evaluaciones:responder";

    /// <summary>Recalificar, reabrir y anular una evaluación con justificación (CE-10).</summary>
    public const string EvaluacionesRecalificar = "evaluaciones:recalificar";

    /// <summary>Todo lo que puede tener una credencial de tenant (la de Plataforma no entra aquí).</summary>
    public static readonly IReadOnlyList<string> DelTenant =
    [
        EmpresasAdministrar, ApiKeysAdministrar, SistemasAdministrar, UsuariosAdministrar, ConfiguracionLeer, ConfiguracionEscribir,
        TercerosLeer, TercerosEscribir, VinculosLeer, VinculosEscribir, VinculosBloquear, VinculosEximir, CuentasAprobar, AuditoriaLeer, AuditoriaExportar,
        FlujosLeer, FlujosEscribir, ExpedientesLeer, ExpedientesRevisar, ExpedientesAdministrar, ExpedientesExportar, DocumentosLeer, DocumentosDescargar,
        CertificadosLeer, EventosLeer, WebhooksAdministrar, ConsultasLeer, SesionesTerceroCrear, VerificacionesEscribir, CumplimientoDecidir, SandboxAdministrar,
        SupresionesResolver, CuestionariosLeer, CuestionariosEscribir, EvaluacionesLeer, EvaluacionesResponder, EvaluacionesRecalificar
    ];

    /// <summary>
    /// Permisos que un grupo de acceso puede llevar: el catálogo del tenant sin <see cref="SesionesTerceroCrear"/> (solo la usa la API key de un sistema integrador, no una
    /// persona). Todos los demás los aplica el backend en sus endpoints; un grupo no inventa permisos.
    /// </summary>
    public static readonly IReadOnlyList<string> DeGrupo = [.. DelTenant.Where(p => p != SesionesTerceroCrear)];

    /// <summary>
    /// Los permisos que miran la ficha por secciones y por eso se acotan por sector: ver lo que el tercero declaró (<see cref="TercerosLeer"/>, <see cref="ExpedientesLeer"/>) y
    /// actuar sobre ello (<see cref="ExpedientesRevisar"/>, <see cref="ExpedientesAdministrar"/>: veredictos, observaciones y exenciones de una sección).
    /// </summary>
    public static readonly IReadOnlyList<string> AcotablesPorSector = [TercerosLeer, ExpedientesLeer, ExpedientesRevisar, ExpedientesAdministrar];

    /// <summary>Lo que hace con las evaluaciones quien revisa: ver, responder como evaluador interno y recalificar con justificación (CE-4, CE-10).</summary>
    private static readonly string[] DeEvaluador = [EvaluacionesLeer, EvaluacionesResponder, EvaluacionesRecalificar];

    public static readonly IReadOnlyList<string> Todos = [PlataformaTenants, .. DelTenant];

    /// <summary>
    /// Lo que puede la Plataforma con un acceso de soporte vigente (B-6): leer configuración, flujos, vínculos, terceros,
    /// expedientes, certificados y auditoría de esa empresa. Nunca documentos (ni verlos ni descargarlos) ni escribir.
    /// </summary>
    public static readonly IReadOnlyList<string> DeSoporte =
        [ConfiguracionLeer, FlujosLeer, VinculosLeer, TercerosLeer, ExpedientesLeer, CertificadosLeer, AuditoriaLeer];

    /// <summary>
    /// Administración del tenant: solo se obtiene con un rol de todo el tenant. Un administrador de una empresa no
    /// gestiona usuarios, sistemas, llaves ni empresas (evita que se otorgue alcance de tenant a sí mismo).
    /// </summary>
    public static readonly IReadOnlySet<string> SoloDeTenant =
        new HashSet<string> { EmpresasAdministrar, ApiKeysAdministrar, SistemasAdministrar, UsuariosAdministrar, SandboxAdministrar };

    /// <summary>
    /// Lo que todo rol lee; los documentos compartidos y los certificados se leen y descargan con cualquier rol, y la consulta
    /// de certificación la hace cualquiera (docs/07 §3.2, CN-1).
    /// </summary>
    private static readonly string[] Lecturas =
        [ConfiguracionLeer, TercerosLeer, VinculosLeer, FlujosLeer, ExpedientesLeer, DocumentosLeer, DocumentosDescargar, CertificadosLeer, ConsultasLeer];

    /// <summary>Mapeo rol → scopes (docs/07 §3.1).</summary>
    public static IReadOnlyList<string> DeRol(Rol rol) => rol switch
    {
        Rol.Administrador => DelTenant,
        Rol.Revisor => [.. Lecturas, VinculosEscribir, ExpedientesRevisar, .. DeEvaluador],
        Rol.OficialCumplimiento =>
            [.. Lecturas, VinculosEscribir, VinculosBloquear, CuentasAprobar, ExpedientesRevisar, ExpedientesExportar, VerificacionesEscribir,
                CumplimientoDecidir, AuditoriaLeer, SupresionesResolver, .. DeEvaluador],
        Rol.Auditor => [.. Lecturas, AuditoriaLeer, AuditoriaExportar, ExpedientesExportar, EvaluacionesLeer],
        _ => []
    };

    /// <summary>
    /// Permiso efectivo de una petición delegada (ADR-0011): <b>intersección</b> de lo que permite la API key del
    /// sistema y lo que dan los roles del usuario. Los scopes de roles por empresa solo valen en esa empresa
    /// (<see cref="PermisosEfectivos.PorEmpresa"/>); las empresas efectivas son las del usuario (<c>*</c> si tiene un
    /// rol de todo el tenant) recortadas por las de la llave.
    /// </summary>
    public static PermisosEfectivos ParaUsuario(IEnumerable<RolAsignado> roles, IEnumerable<string> scopesLlave, IEnumerable<string> empresasLlave) =>
        ParaUsuario(roles, [], scopesLlave, empresasLlave);

    /// <summary>
    /// Igual que la anterior con los grupos de acceso propios del tenant (<see cref="ConcesionDeAcceso.DeGrupo"/>): lo que puede la persona es la <b>unión</b> de lo que dan sus
    /// roles (los grupos predefinidos) y sus grupos activos, siempre intersecado con la llave. Cada permiso lleva además su acotación por sector: la unión de las de los grupos que
    /// lo otorgan (<see cref="PermisosEfectivos.Sectores"/>); si algún grupo que lo da no acota, vale para todos los sectores.
    /// </summary>
    public static PermisosEfectivos ParaUsuario(IEnumerable<RolAsignado> roles, IEnumerable<ConcesionDeAcceso> gruposDelUsuario, IEnumerable<string> scopesLlave,
        IEnumerable<string> empresasLlave)
    {
        var llave = scopesLlave.ToHashSet();
        var empresasDeLlave = empresasLlave.ToHashSet();
        var lista = roles.Select(ConcesionDeAcceso.DeRol).Concat(gruposDelUsuario).ToList();

        var deTenant = lista.Where(c => c.EmpresaId is null).SelectMany(c => c.Scopes).Where(llave.Contains).ToHashSet();

        var porEmpresa = new Dictionary<Guid, IReadOnlySet<string>>();
        foreach (var grupo in lista.Where(c => c.EmpresaId is not null).GroupBy(c => c.EmpresaId!.Value))
        {
            if (!PermiteEmpresa(empresasDeLlave, grupo.Key))
                continue;

            var scopes = grupo.SelectMany(c => c.Scopes)
                .Where(s => llave.Contains(s) && !SoloDeTenant.Contains(s) && !deTenant.Contains(s))
                .ToHashSet();
            if (scopes.Count > 0)
                porEmpresa[grupo.Key] = scopes;
        }

        HashSet<string> empresasUsuario = lista.Any(c => c.EmpresaId is null)
            ? ["*"]
            : [.. lista.Select(c => c.EmpresaId!.Value.ToString())];
        var empresas = Intersectar(empresasDeLlave, empresasUsuario);

        return new PermisosEfectivos(deTenant, porEmpresa, empresas, SectoresRestringidos(lista, deTenant, porEmpresa, empresasDeLlave));
    }

    /// <summary>
    /// Las acotaciones por sector que hay que llevar en el token: solo las de los permisos <see cref="AcotablesPorSector"/> que no valen para todos los sectores, una por permiso para el
    /// tenant entero y otra por empresa donde la unión de lo que alcanza allí sea distinta de lo que alcanza en todo el tenant. Sin ninguna, el token no trae nada de sectores.
    /// </summary>
    private static List<SectorRestringido> SectoresRestringidos(IReadOnlyList<ConcesionDeAcceso> concesiones, IReadOnlySet<string> deTenant,
        IReadOnlyDictionary<Guid, IReadOnlySet<string>> porEmpresa, IReadOnlySet<string> empresasDeLlave)
    {
        static (AlcanceDeSectores Ver, AlcanceDeSectores Editar) Union(IEnumerable<ConcesionDeAcceso> concesiones) =>
            concesiones.Aggregate((Ver: AlcanceDeSectores.De([]), Editar: AlcanceDeSectores.De([])),
                (acumulado, c) => (acumulado.Ver.Union(c.Ver), acumulado.Editar.Union(c.Editar)));

        var resultado = new List<SectorRestringido>();
        foreach (var scope in AcotablesPorSector)
        {
            (AlcanceDeSectores Ver, AlcanceDeSectores Editar) deTodoElTenant = (AlcanceDeSectores.Todo, AlcanceDeSectores.Todo);
            if (deTenant.Contains(scope))
            {
                deTodoElTenant = Union(concesiones.Where(c => c.EmpresaId is null && c.Scopes.Contains(scope)));
                if (!deTodoElTenant.Ver.Todos || !deTodoElTenant.Editar.Todos)
                    resultado.Add(new SectorRestringido(scope, null, deTodoElTenant.Ver, deTodoElTenant.Editar));
            }

            foreach (var empresaId in concesiones.Where(c => c.EmpresaId is not null).Select(c => c.EmpresaId!.Value).Distinct())
            {
                if (!PermiteEmpresa(empresasDeLlave, empresaId) || (!deTenant.Contains(scope) && porEmpresa.GetValueOrDefault(empresaId)?.Contains(scope) != true))
                    continue;
                var enLaEmpresa = Union(concesiones.Where(c => (c.EmpresaId is null || c.EmpresaId == empresaId) && c.Scopes.Contains(scope)));
                if (!enLaEmpresa.Ver.Igual(deTodoElTenant.Ver) || !enLaEmpresa.Editar.Igual(deTodoElTenant.Editar))
                    resultado.Add(new SectorRestringido(scope, empresaId, enLaEmpresa.Ver, enLaEmpresa.Editar));
            }
        }

        return resultado;
    }

    /// <summary>
    /// Qué sectores de la ficha alcanza un permiso en una petición: la entrada de la empresa activa si la hay, si no la del tenant entero y, sin ninguna, todos. Una credencial sin
    /// acotaciones (API key sin usuario, rol sin grupos) alcanza todos.
    /// </summary>
    public static AlcanceDeSectores AlcanceEn(IEnumerable<SectorRestringido> restringidos, string scope, NivelDeSector nivel, Guid? empresaActiva)
    {
        var delScope = restringidos.Where(r => r.Scope == scope).ToList();
        var entrada = (empresaActiva is { } empresa ? delScope.FirstOrDefault(r => r.EmpresaId == empresa) : null) ?? delScope.FirstOrDefault(r => r.EmpresaId is null);
        return entrada is null ? AlcanceDeSectores.Todo : nivel == NivelDeSector.Editar ? entrada.Editar : entrada.Ver;
    }

    /// <summary>Intersección de alcances de empresa donde <c>*</c> significa "todas".</summary>
    public static IReadOnlySet<string> Intersectar(IReadOnlySet<string> a, IReadOnlySet<string> b)
    {
        if (a.Contains("*"))
            return b.ToHashSet();
        if (b.Contains("*"))
            return a.ToHashSet();
        return a.Where(b.Contains).ToHashSet();
    }

    private static bool PermiteEmpresa(IReadOnlySet<string> empresas, Guid empresaId) =>
        empresas.Contains("*") || empresas.Contains(empresaId.ToString());
}

/// <summary>Resultado de <see cref="Permisos.ParaUsuario"/>.</summary>
/// <param name="DeTenant">Scopes válidos en cualquier empresa efectiva y en las operaciones de tenant.</param>
/// <param name="PorEmpresa">Scopes adicionales que solo valen con <c>X-Empresa</c> igual a esa empresa.</param>
/// <param name="Empresas">Empresas efectivas; <c>*</c> = todas las del tenant.</param>
/// <param name="Sectores">Acotaciones por sector de los permisos que miran la ficha (solo los que no valen para todos los sectores); vacío = ninguna.</param>
public sealed record PermisosEfectivos(
    IReadOnlySet<string> DeTenant,
    IReadOnlyDictionary<Guid, IReadOnlySet<string>> PorEmpresa,
    IReadOnlySet<string> Empresas,
    IReadOnlyList<SectorRestringido>? Sectores = null)
{
    /// <summary>Las acotaciones por sector, nunca nulas.</summary>
    public IReadOnlyList<SectorRestringido> SectoresRestringidos => Sectores ?? [];

    /// <summary>Scopes que aplican en una petición con la empresa activa indicada (o sin empresa).</summary>
    public IReadOnlySet<string> EnEmpresa(Guid? empresaId) =>
        empresaId is { } id && PorEmpresa.TryGetValue(id, out var adicionales)
            ? DeTenant.Union(adicionales).ToHashSet()
            : DeTenant;
}

/// <summary>
/// Lo que da una asignación de acceso a una persona: los permisos, dónde valen (todo el tenant o una empresa) y a qué sectores de la ficha alcanzan los que la miran.
/// Un rol (grupo predefinido) da sus permisos para todos los sectores; un grupo propio, los suyos acotados por los sectores que lo limitan.
/// </summary>
public sealed record ConcesionDeAcceso(IReadOnlyCollection<string> Scopes, Guid? EmpresaId, AlcanceDeSectores Ver, AlcanceDeSectores Editar)
{
    public static ConcesionDeAcceso DeRol(RolAsignado asignado) =>
        new(Permisos.DeRol(asignado.Rol), asignado.EmpresaId, AlcanceDeSectores.Todo, AlcanceDeSectores.Todo);

    /// <summary>Lo que da un grupo propio asignado en <paramref name="empresaId"/> (nulo = todo el tenant). Un grupo desactivado no da nada.</summary>
    public static ConcesionDeAcceso? DeGrupo(GrupoDePermisos grupo, Guid? empresaId) =>
        grupo.Activo
            ? new ConcesionDeAcceso([.. grupo.Permisos.Where(Permisos.DeGrupo.Contains)], empresaId, grupo.AlcanceParaVer(), grupo.AlcanceParaEditar())
            : null;

    /// <summary>Las concesiones de los grupos propios de una persona: las de los grupos activos que existen (los demás ya no dan nada).</summary>
    public static IReadOnlyList<ConcesionDeAcceso> DeLosGruposDe(Usuario usuario, IEnumerable<GrupoDePermisos> gruposDelTenant)
    {
        var porId = gruposDelTenant.ToDictionary(g => g.Id);
        return
        [
            .. usuario.Grupos.Select(a => porId.TryGetValue(a.GrupoId, out var grupo) ? DeGrupo(grupo, a.EmpresaId) : null).OfType<ConcesionDeAcceso>()
        ];
    }
}

/// <summary>
/// Acotación por sector de un permiso: a qué secciones de la ficha alcanza para ver y para actuar, en todo el tenant (<see cref="EmpresaId"/> nulo) o en una empresa. Viaja en
/// el token como <c>permiso|empresa|ver|editar</c> (<c>*</c> = todas las secciones).
/// </summary>
public sealed record SectorRestringido(string Scope, Guid? EmpresaId, AlcanceDeSectores Ver, AlcanceDeSectores Editar)
{
    public string Codificar() => $"{Scope}|{EmpresaId?.ToString() ?? "*"}|{Ver.Codificar()}|{Editar.Codificar()}";

    /// <summary>
    /// Lee un reclamo. Si no tiene la forma esperada falla cerrado: el permiso queda acotado a ningún sector (nunca a todos). Solo un texto sin ni siquiera el nombre del permiso
    /// se ignora (nulo): no hay a qué permiso aplicarlo.
    /// </summary>
    public static SectorRestringido? Decodificar(string texto)
    {
        var partes = texto.Split('|');
        if (partes.Length == 0 || partes[0].Length == 0)
            return null;
        var ninguno = new SectorRestringido(partes[0], null, AlcanceDeSectores.De([]), AlcanceDeSectores.De([]));
        if (partes.Length != 4)
            return ninguno;
        Guid? empresa = null;
        if (partes[1] != "*")
        {
            if (!Guid.TryParse(partes[1], out var id))
                return ninguno;
            empresa = id;
        }

        return new SectorRestringido(partes[0], empresa, AlcanceDeSectores.Decodificar(partes[2]), AlcanceDeSectores.Decodificar(partes[3]));
    }
}
