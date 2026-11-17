using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validasoft.Aplicacion.Comun;
using Validasoft.Aplicacion.Identidad;
using Validasoft.Contratos;
using Validasoft.Dominio.Auditoria;
using Validasoft.Dominio.Comun;
using Validasoft.Dominio.Identidad;
using Validasoft.Dominio.Plataforma;
using Wolverine;
using Wolverine.Http;

namespace Validasoft.Aplicacion.Plataforma;

/// <summary>
/// Lo que la ficha del grupo de la consola de Plataforma corrige del alta (decisión FG): el nombre, la región y la zona horaria del grupo, y el nombre,
/// el correo y las identidades externas de las personas que lo administran. El slug no se corrige (va en las API keys).
/// </summary>
public static class CorreccionDeGrupoEndpoints
{
    /// <summary>
    /// Corrige el nombre, la región y la zona horaria del grupo (con su auditoría antes/después, a nombre de Plataforma). Siempre se puede: también con el
    /// grupo desactivado. Mismas reglas que el alta (<c>Tenant.Crear</c>); enviar lo mismo no escribe ni audita nada. El sandbox del grupo, si lo hay, se
    /// alinea en la misma transacción (su nombre lleva « (sandbox)»). Los folios, certificados y correos ya emitidos conservan el nombre con que salieron.
    /// 404 <c>tenant-no-encontrado</c> (un sandbox no es un grupo de la consola); 422 <c>nombre-requerido</c>, <c>zona-horaria-invalida</c>.
    /// </summary>
    [WolverinePut("/api/v1/plataforma/tenants/{id}")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<TenantDto> Corregir(Guid id, CorregirGrupoDto dto, ISesiones sesiones, IContextoSolicitud contexto, PoliticaDeIngreso politica,
        TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        await using var sesion = sesiones.ParaTenant(id);
        var tenant = await sesion.LoadAsync<Tenant>(id, ct);
        if (tenant is null || tenant.EsSandbox)
            throw ReglaDeNegocioException.NoEncontrado("tenant-no-encontrado", "No existe ese tenant.");

        var antes = tenant.ADto();
        if (!tenant.CorregirDatos(dto.Nombre, dto.Region, dto.ZonaHoraria))
            return tenant.ADto();

        sesion.Store(tenant);
        var sandbox = await sesion.Query<Tenant>().Where(t => t.TenantDeProduccionId == id).FirstOrDefaultAsync(ct);
        if (sandbox is not null && sandbox.AlinearConProduccion(tenant))
            sesion.Store(sandbox);

        Auditoria.Registrar(sesion, contexto, "Tenant", tenant.Id.ToString(), AccionConfiguracion.Modificado, antes, tenant.ADto(), ahora);
        await sesion.SaveChangesAsync(ct);

        // El nombre, la región y la zona los leen todas las peticiones de la base; solo la política de ingreso guarda el grupo en memoria (30 s).
        politica.Olvidar(id);
        if (sandbox is not null)
            politica.Olvidar(sandbox.Id);
        return tenant.ADto();
    }
}

/// <summary>Las personas administradoras de un grupo, vistas y corregidas desde la consola de Plataforma, y su invitación a entrar directo.</summary>
public static class UsuariosDeGrupoEndpoints
{
    /// <summary>
    /// Las personas con el rol Administrador del grupo (de todo el grupo o de alguna empresa), por nombre, con su correo, el id con que las reconoce cada
    /// sistema integrado, si están activas, su último ingreso, si exigen passkey y cuántas tienen. 404 <c>tenant-no-encontrado</c>.
    /// </summary>
    [WolverineGet("/api/v1/plataforma/tenants/{tenantId}/administradores")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<IReadOnlyList<UsuarioDto>> Administradores(Guid tenantId, ISesiones sesiones, CancellationToken ct)
    {
        var tenant = await CargarGrupoAsync(sesiones, tenantId, ct);
        await using var sesion = sesiones.ParaTenant(tenantId);
        var usuarios = await sesion.Query<Usuario>().Where(u => u.Roles.Any(r => r.Rol == Rol.Administrador)).OrderBy(u => u.Nombre).ToListAsync(ct);
        await using var global = sesiones.ConsultaGlobal();
        var activas = await UsuariosEndpoints.PasskeysActivasAsync(global, usuarios, ct);
        return [.. usuarios.Select(u => u.ADto(tenant.PasskeyParaTodos, activas.GetValueOrDefault(u.Id.ToString())))];
    }

    /// <summary>
    /// Corrige el nombre, el correo y las identidades externas de una persona del grupo (con su auditoría antes/después, a nombre de Plataforma). Siempre se
    /// puede: también con el grupo o la cuenta desactivados. Mismas reglas que el alta (<c>Usuario.Crear</c>); el correo sigue único en el grupo contra las
    /// demás personas (enviar el propio no choca consigo mismo) y cada <c>sub</c> sigue único por sistema; enviar lo mismo no escribe ni audita nada.
    /// <para>
    /// <b>Cambiar el correo cambia con quién entra la cuenta</b>, así que en la misma transacción se cierran sus sesiones directas abiertas, se revocan
    /// sus passkeys (quien tuvo el correo anterior —un error de digitación que cayó en otro buzón— no se queda dentro; la persona entra con el código del
    /// correo nuevo y registra otra) y se anulan los ingresos que estaban a medias con el correo anterior. Con <c>invitar</c> en <c>true</c> y el ingreso
    /// directo activo, el correo nuevo recibe además la invitación. Los registros de identidad de lo que se cerró y revocó quedan a nombre de Plataforma.
    /// </para>
    /// <para>
    /// Cambiar el correo o el usuario del sistema decide quién entra como esa persona, así que quien opera con una sesión directa vuelve a confirmar con su passkey
    /// (403 <c>reautenticacion-requerida</c>, PI-13); el nombre solo no lo pide y la clave de arranque ni las API keys nunca.
    /// </para>
    /// <para>
    /// Si la persona entra desde un sistema integrado, ese sistema manda su nombre y su correo en cada ingreso y los pone al día aquí (siempre que el correo
    /// no sea de otra persona del grupo): corrige también en el sistema, o lo corregido se deshace en el siguiente ingreso.
    /// </para>
    /// 404 <c>tenant-no-encontrado</c>, <c>usuario-no-encontrado</c>; 409 <c>usuario-duplicado</c>, <c>identidad-duplicada</c>, <c>usuario-inactivo</c> (con
    /// <c>invitar</c>); 422 <c>nombre-requerido</c>, <c>correo-invalido</c>, <c>identidad-externa-invalida</c>, <c>identidades-repetidas</c>,
    /// <c>sistema-invalido</c>, <c>ingreso-directo-apagado</c> (con <c>invitar</c>).
    /// </summary>
    [WolverinePut("/api/v1/plataforma/tenants/{tenantId}/usuarios/{usuarioId}")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<UsuarioDto> Corregir(Guid tenantId, Guid usuarioId, CorregirUsuarioDto dto, HttpContext http, ISesiones sesiones,
        IContextoSolicitud contexto, IMessageBus mensajes, IProtectorDeSecretos protector, ICacheDeSesionesDirectas cache, ServicioDeIngreso servicio, TimeProvider reloj,
        CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var tenant = await CargarGrupoAsync(sesiones, tenantId, ct);

        await using var sesion = sesiones.ParaTenant(tenantId, mensajes);
        var usuario = await sesion.LoadAsync<Usuario>(usuarioId, ct)
                      ?? throw ReglaDeNegocioException.NoEncontrado("usuario-no-encontrado", "No existe ese usuario.");
        var antes = usuario.ADto();
        var identidadesAntes = usuario.Identidades.ToList();
        var correoAnterior = usuario.Correo;

        var cambioDatos = usuario.CorregirDatos(dto.Nombre, dto.Correo);
        var cambioCorreo = usuario.Correo != correoAnterior;
        if (cambioCorreo)
        {
            var correo = usuario.Correo;
            if (await sesion.Query<Usuario>().AnyAsync(u => u.Correo == correo && u.Id != usuarioId, ct))
                throw ReglaDeNegocioException.Conflicto("usuario-duplicado", $"Ya existe un usuario con el correo {correo}.");
        }

        var cambioIdentidades = dto.Identidades is not null && usuario.ReemplazarIdentidades(dto.Identidades.Select(i => new IdentidadExterna(i.SistemaId, i.IdExterno)));
        if (cambioIdentidades)
            await ActualizarIndiceDeIdentidadesAsync(sesion, usuario, identidadesAntes, ct);

        var invitar = dto.Invitar == true && cambioCorreo;
        if (invitar)
        {
            if (!tenant.ModosDeIngreso.HasFlag(ModoDeIngreso.Directo))
                throw ReglaDeNegocioException.Validacion("ingreso-directo-apagado", "Este grupo no admite el ingreso directo: no hay a qué invitar. Actívalo en el ingreso del grupo.");
            if (!usuario.Activo)
                throw ReglaDeNegocioException.Conflicto("usuario-inactivo", "No se invita a un usuario desactivado.");
        }

        if (!cambioDatos && !cambioIdentidades)
        {
            await using var consulta = sesiones.ConsultaGlobal();
            var existentes = await UsuariosEndpoints.PasskeysActivasAsync(consulta, [usuario], ct);
            return usuario.ADto(tenant.PasskeyParaTodos, existentes.GetValueOrDefault(usuario.Id.ToString()));
        }

        // Cambiar el correo o el usuario del sistema decide quién entra como esa persona: quien opera con su passkey la vuelve a confirmar (PI-13), como al revocar una passkey o
        // cambiar roles. El nombre solo no lo pide, y la clave de arranque y las API keys nunca (no hay persona delante de un navegador).
        if (cambioCorreo || cambioIdentidades)
            await servicio.ExigirReautenticacionAsync(http.User, "corregir-usuario-de-grupo", ct);

        var cerradas = cambioCorreo ? await CortarElAccesoDelCorreoAnteriorAsync(sesion, usuario, correoAnterior, http, contexto, ahora, ct) : [];
        if (invitar)
        {
            usuario.TenantId ??= tenantId;
            await InvitacionesDeUsuarios.EnviarAsync(mensajes, protector, tenant, usuario, ahora);
            RegistroDeIngresos.Agregar(sesion, RegistroDeIngresos.Crear(EventoDeIngreso.UsuarioInvitado, true, ContextoDeCliente.De(http, contexto.CorrelationId), ahora, tenantId,
                TipoDePropietario.Usuario, usuario.Id.ToString(), usuario.Correo, actorTipo: contexto.ActorTipo, actorId: contexto.ActorId));
        }

        sesion.Store(usuario);
        Auditoria.Registrar(sesion, contexto, "Usuario", usuario.Id.ToString(), AccionConfiguracion.Modificado, antes, usuario.ADto(), ahora);
        await sesion.SaveChangesAsync(ct);
        foreach (var cerrada in cerradas)
            cache.Olvidar(cerrada);

        await using var global = sesiones.ConsultaGlobal();
        var activas = await UsuariosEndpoints.PasskeysActivasAsync(global, [usuario], ct);
        return usuario.ADto(tenant.PasskeyParaTodos, activas.GetValueOrDefault(usuario.Id.ToString()));
    }

    /// <summary>
    /// «Reenviar invitación»: el correo con la dirección de la app, donde la persona pide un código con su correo (el mismo de <c>POST /usuarios/{id}/invitar</c>
    /// del grupo, pero desde la consola). 404 <c>tenant-no-encontrado</c>, <c>usuario-no-encontrado</c>; 409 <c>ingreso-directo-apagado</c>, <c>usuario-inactivo</c>.
    /// </summary>
    [WolverinePost("/api/v1/plataforma/tenants/{tenantId}/usuarios/{usuarioId}/invitar")]
    [Authorize(Policy = Permisos.PlataformaTenants)]
    public static async Task<UsuarioDto> Invitar(Guid tenantId, Guid usuarioId, HttpContext http, ISesiones sesiones, IContextoSolicitud contexto, IMessageBus mensajes,
        IProtectorDeSecretos protector, RegistroDeIngresos registro, TimeProvider reloj, CancellationToken ct)
    {
        var ahora = reloj.GetUtcNow();
        var tenant = await CargarGrupoAsync(sesiones, tenantId, ct);
        if (!tenant.ModosDeIngreso.HasFlag(ModoDeIngreso.Directo))
            throw ReglaDeNegocioException.Conflicto("ingreso-directo-apagado", "Este grupo no admite el ingreso directo: no hay a qué invitar. Actívalo en el ingreso del grupo.");

        await using var sesion = sesiones.ParaTenant(tenantId, mensajes);
        var usuario = await sesion.LoadAsync<Usuario>(usuarioId, ct) ?? throw ReglaDeNegocioException.NoEncontrado("usuario-no-encontrado", "No existe ese usuario.");
        if (!usuario.Activo)
            throw ReglaDeNegocioException.Conflicto("usuario-inactivo", "No se invita a un usuario desactivado.");

        usuario.TenantId ??= tenantId;
        await InvitacionesDeUsuarios.EnviarAsync(mensajes, protector, tenant, usuario, ahora);
        sesion.Store(usuario);
        await sesion.SaveChangesAsync(ct);
        await registro.RegistrarAsync(EventoDeIngreso.UsuarioInvitado, true, ContextoDeCliente.De(http, contexto.CorrelationId), tenantId, TipoDePropietario.Usuario,
            usuario.Id.ToString(), usuario.Correo, actorTipo: contexto.ActorTipo, actorId: contexto.ActorId, ct: ct);
        return usuario.ADto(tenant.PasskeyParaTodos);
    }

    /// <summary>
    /// El correo es con lo que se entra: al cambiarlo se cierran las sesiones directas abiertas de la cuenta, se revocan sus passkeys y se anulan los ingresos
    /// a medias del correo anterior. Todo se escribe en la sesión de la corrección (una sola transacción); devuelve las sesiones cerradas para olvidarlas en
    /// la caché una vez guardado.
    /// </summary>
    private static async Task<IReadOnlyList<Guid>> CortarElAccesoDelCorreoAnteriorAsync(IDocumentSession sesion, Usuario usuario, string correoAnterior, HttpContext http,
        IContextoSolicitud contexto, DateTimeOffset ahora, CancellationToken ct)
    {
        var sujeto = usuario.Id.ToString();
        var por = $"{contexto.ActorTipo}:{contexto.ActorId}";
        var cliente = ContextoDeCliente.De(http, contexto.CorrelationId);
        var cerradas = await GestionDeSesiones.CerrarTodasAsync(sesion, TipoDePropietario.Usuario, sujeto, SesionDeUsuario.MotivoCorreoCambiado, por, cliente,
            contexto.ActorTipo, contexto.ActorId, ahora, ct);

        var passkeys = await sesion.Query<Passkey>().Where(p => p.Propietario == TipoDePropietario.Usuario && p.SujetoId == sujeto && p.RevocadaEn == null).ToListAsync(ct);
        foreach (var passkey in passkeys)
        {
            passkey.Revocar(por, SesionDeUsuario.MotivoCorreoCambiado, ahora);
            sesion.Store(passkey);
            RegistroDeIngresos.Agregar(sesion, RegistroDeIngresos.Crear(EventoDeIngreso.PasskeyRevocada, true, cliente, ahora, usuario.TenantId, TipoDePropietario.Usuario, sujeto,
                correoAnterior, actorTipo: contexto.ActorTipo, actorId: contexto.ActorId, passkeyId: passkey.Id, motivo: SesionDeUsuario.MotivoCorreoCambiado, detalle: passkey.Nombre));
        }

        // Un código que ya se verificó con el correo anterior aún puede completar un ingreso (10 minutos): se anula, y los que esperan su código, también.
        var enCurso = await sesion.Query<DesafioDeIngreso>()
            .Where(d => d.Etapa != EtapaDeIngreso.Consumido && (d.Correo == correoAnterior || (d.Cuenta != null && d.Cuenta.SujetoId == sujeto)))
            .ToListAsync(ct);
        foreach (var desafio in enCurso)
        {
            desafio.Anular();
            sesion.Store(desafio);
        }

        return cerradas;
    }

    /// <summary>
    /// Pone el índice <c>(sistema, sub) → persona</c> al día con las identidades que quedaron: quita las que ya no están y agrega las nuevas, que deben ser de un
    /// sistema del grupo y de nadie más (409 <c>identidad-duplicada</c>).
    /// </summary>
    private static async Task ActualizarIndiceDeIdentidadesAsync(IDocumentSession sesion, Usuario usuario, IReadOnlyList<IdentidadExterna> antes, CancellationToken ct)
    {
        foreach (var quitada in antes.Except(usuario.Identidades))
        {
            var clave = IndiceIdentidadExterna.Clave(quitada.SistemaId, quitada.IdExterno);
            if (await sesion.LoadAsync<IndiceIdentidadExterna>(clave, ct) is { } indice && indice.UsuarioId == usuario.Id)
                sesion.Delete(indice);
        }

        foreach (var nueva in usuario.Identidades.Except(antes))
        {
            if (await sesion.LoadAsync<SistemaIntegrado>(nueva.SistemaId, ct) is null)
                throw ReglaDeNegocioException.Validacion("sistema-invalido", $"El sistema {nueva.SistemaId} no existe en el grupo.");

            var clave = IndiceIdentidadExterna.Clave(nueva.SistemaId, nueva.IdExterno);
            if (await sesion.LoadAsync<IndiceIdentidadExterna>(clave, ct) is { } existente && existente.UsuarioId != usuario.Id)
                throw ReglaDeNegocioException.Conflicto("identidad-duplicada", "Esa identidad externa ya pertenece a otro usuario.");
            sesion.Store(new IndiceIdentidadExterna { Id = clave, UsuarioId = usuario.Id });
        }
    }

    /// <summary>El grupo de la consola (404 <c>tenant-no-encontrado</c> si no existe; un sandbox no es un grupo de la consola).</summary>
    private static async Task<Tenant> CargarGrupoAsync(ISesiones sesiones, Guid tenantId, CancellationToken ct)
    {
        await using var consulta = sesiones.ConsultaGlobal();
        var tenant = await consulta.LoadAsync<Tenant>(tenantId, ct);
        return tenant is null || tenant.EsSandbox ? throw ReglaDeNegocioException.NoEncontrado("tenant-no-encontrado", "No existe ese tenant.") : tenant;
    }
}
