using Marten;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Validalo.Aplicacion.Comun;
using Validalo.Aplicacion.Informes;
using Validalo.Contratos;
using Validalo.Dominio.Comun;
using Validalo.Dominio.Configuracion;
using Validalo.Dominio.Evaluaciones;
using Validalo.Dominio.Plataforma;
using Wolverine.Http;

namespace Validalo.Aplicacion.Evaluaciones;

/// <summary>
/// Informe de evaluaciones por proveedor (CE-12): una fila por evaluación con el puntaje, el veredicto, quién respondió y cuándo, y un Excel con tres hojas: las evaluaciones, el detalle
/// pregunta por pregunta (la respuesta, su puntaje, si eliminó y si un revisor la ajustó) y el resumen. Es privado de la empresa; cada descarga queda en la auditoría de accesos como las
/// demás exportaciones (IF-6).
/// </summary>
public static class InformeDeEvaluacionesEndpoints
{
    public const int MaximoEvaluaciones = 5000;

    /// <summary>Filtra por estado, cuestionario, vínculo, tercero y rango de fechas de asignación (inclusive, zona del negocio).</summary>
    [WolverineGet("/api/v1/informes/evaluaciones")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<InformeEvaluacionesDto> Consultar(SesionDeEmpresa empresa, DateOnly? desde, DateOnly? hasta, string? estado, Guid? cuestionarioId, Guid? vinculoId,
        Guid? terceroId, int? limite, string? cursor, CancellationToken ct)
    {
        var tamano = Math.Clamp(limite ?? 50, 1, 500);
        var salto = Peticiones.LeerDesplazamiento(cursor);
        var evaluaciones = await CalcularAsync(empresa, desde, hasta, estado, cuestionarioId, vinculoId, terceroId, ct);
        var folios = await EvaluacionesEndpoints.FoliosAsync(empresa, evaluaciones, ct);
        return new InformeEvaluacionesDto(Resumir(evaluaciones),
            [.. evaluaciones.Skip(salto).Take(tamano).Select(e => Fila(e, EvaluacionesEndpoints.Folio(folios, e)))],
            evaluaciones.Count > salto + tamano ? Peticiones.EscribirDesplazamiento(salto + tamano) : null);
    }

    [WolverineGet("/api/v1/informes/evaluaciones/excel")]
    [Authorize(Policy = Permisos.EvaluacionesLeer)]
    public static async Task<IResult> Excel(SesionDeEmpresa empresa, IContextoSolicitud contexto, HttpContext http, TimeProvider reloj, DateOnly? desde, DateOnly? hasta, string? estado,
        Guid? cuestionarioId, Guid? vinculoId, Guid? terceroId, CancellationToken ct)
    {
        var evaluaciones = await CalcularAsync(empresa, desde, hasta, estado, cuestionarioId, vinculoId, terceroId, ct);
        var folios = await EvaluacionesEndpoints.FoliosAsync(empresa, evaluaciones, ct);
        var filas = evaluaciones.Select(e => Fila(e, EvaluacionesEndpoints.Folio(folios, e))).ToList();
        var resumen = Resumir(evaluaciones);

        var hojaEvaluaciones = new Hoja("Evaluaciones",
            ["Tercero", "Identificación", "Folio del expediente", "Cuestionario", "Versión", "Estado", "Responde", "Efecto", "Origen", "Puntaje", "Aprobada", "Motivos",
                "Eliminatorias", "Respondida por", "Asignada", "Respondida", "Vigente hasta", "Recalificaciones"],
            filas.Select(f => (IReadOnlyList<object?>)
            [
                f.Tercero.Nombre, InformeEstadoExpedientesEndpoints.Identificacion(f.Tercero.Identificacion), f.Folio, f.Cuestionario, f.VersionCuestionario, f.Estado, f.Responde,
                f.Efecto, f.Motivo, f.Puntaje, f.Aprobada is { } a ? (a ? "Sí" : "No") : null, string.Join(", ", f.Motivos.Select(TextoMotivo)),
                string.Join(", ", f.Eliminatorias), f.RespondidaPor, Exportaciones.Local(f.AsignadaEn), f.RespondidaEn is { } r ? Exportaciones.Local(r) : null,
                f.VigenteHasta is { } v ? Exportaciones.Local(v) : null, f.Recalificaciones
            ]));

        var hojaDetalle = new Hoja("Detalle",
            ["Tercero", "Folio del expediente", "Cuestionario", "Versión", "Sección", "Código", "Pregunta", "Respuesta", "Puntaje de la pregunta", "Elimina", "Ajustada"],
            evaluaciones.Where(e => e.Resultado is not null).SelectMany(e => Detalle(e, EvaluacionesEndpoints.Folio(folios, e))));

        var hojaResumen = new Hoja("Resumen", ["Indicador", "Valor"],
        [
            ["Evaluaciones", resumen.Total], ["Pendientes", resumen.Pendientes], ["Aprobadas", resumen.Aprobadas], ["Reprobadas", resumen.Reprobadas],
            ["Vencidas", resumen.Vencidas], ["Anuladas", resumen.Anuladas], ["Puntaje promedio de las calificadas", resumen.PuntajePromedio]
        ]);

        var ahora = reloj.GetUtcNow();
        var nombreEmpresa = (await empresa.Sesion.LoadAsync<Empresa>(empresa.EmpresaId, ct))?.Nombre ?? "empresa";
        var nombre = $"evaluaciones-{Exportaciones.Slug(nombreEmpresa)}-{InformeEstadoExpedientesEndpoints.CalculadoraDeVigenciaFecha(ahora)}.xlsx";
        return await Exportaciones.EntregarAsync(empresa, contexto, http, reloj,
            new ArchivoExportado("InformeEvaluaciones", "Excel", HojaDeCalculo.CrearLibro(hojaEvaluaciones, hojaDetalle, hojaResumen), HojaDeCalculo.TipoContenido, nombre, filas.Count), ct);
    }

    internal static async Task<IReadOnlyList<EvaluacionDeProveedor>> CalcularAsync(SesionDeEmpresa empresa, DateOnly? desde, DateOnly? hasta, string? estado, Guid? cuestionarioId,
        Guid? vinculoId, Guid? terceroId, CancellationToken ct)
    {
        if (desde is not null && hasta is not null && desde > hasta)
            throw ReglaDeNegocioException.Validacion("rango-invalido", "La fecha inicial no puede ser posterior a la final.");

        var consulta = empresa.Evaluaciones();
        if (desde is { } d)
        {
            var inicio = Exportaciones.InicioDelDia(d);
            consulta = consulta.Where(e => e.AsignadaEn >= inicio);
        }

        if (hasta is { } h)
        {
            var fin = Exportaciones.InicioDelDia(h.AddDays(1));
            consulta = consulta.Where(e => e.AsignadaEn < fin);
        }

        if (!string.IsNullOrWhiteSpace(estado))
        {
            var buscado = EvaluacionesEndpoints.Leer<EstadoDeEvaluacion>(estado, "estado-invalido", "El estado de una evaluación");
            consulta = consulta.Where(e => e.Estado == buscado);
        }

        if (cuestionarioId is { } cuestionario)
            consulta = consulta.Where(e => e.Cuestionario.Id == cuestionario);
        if (vinculoId is { } vinculo)
            consulta = consulta.Where(e => e.VinculoId == vinculo);
        if (terceroId is { } tercero)
            consulta = consulta.Where(e => e.TerceroId == tercero);

        var lista = await consulta.OrderByDescending(e => e.AsignadaEn).ThenBy(e => e.Id).Take(MaximoEvaluaciones + 1).ToListAsync(ct);
        return lista.Count > MaximoEvaluaciones
            ? throw ReglaDeNegocioException.Validacion("informe-demasiado-grande", $"El informe admite hasta {MaximoEvaluaciones} evaluaciones: agrega filtros.")
            : lista;
    }

    internal static ResumenEvaluacionesDto Resumir(IReadOnlyList<EvaluacionDeProveedor> evaluaciones)
    {
        var calificadas = evaluaciones.Where(e => e.Estado == EstadoDeEvaluacion.Calificada && e.Resultado?.Puntaje is not null).Select(e => e.Resultado!.Puntaje!.Value).ToList();
        return new ResumenEvaluacionesDto(evaluaciones.Count, evaluaciones.Count(e => e.Estado == EstadoDeEvaluacion.Pendiente),
            evaluaciones.Count(e => e.Estado == EstadoDeEvaluacion.Calificada && e.Resultado is { Aprobada: true }),
            evaluaciones.Count(e => e.Estado == EstadoDeEvaluacion.Calificada && e.Resultado is { Aprobada: false }),
            evaluaciones.Count(e => e.Estado == EstadoDeEvaluacion.Vencida), evaluaciones.Count(e => e.Estado == EstadoDeEvaluacion.Anulada),
            calificadas.Count == 0 ? null : CalculadoraDePuntaje.Redondear(calificadas.Average()));
    }

    internal static FilaInformeEvaluacionDto Fila(EvaluacionDeProveedor e, string? folio) =>
        new(e.Id, e.VinculoId, e.ExpedienteId, folio, new TerceroResumenDto(e.TerceroId, e.TerceroNombre, e.TerceroIdentificacion), e.Cuestionario.Nombre, e.Cuestionario.Version,
            e.Estado.ToString(), e.Definicion.Responde.ToString(), e.Efecto.ToString(), e.Motivo.ToString(), e.Resultado?.Puntaje, e.Resultado?.Aprobada,
            [.. e.Resultado?.Motivos ?? []], [.. e.Resultado?.Eliminatorias ?? []], e.RespondidaPor?.Nombre ?? e.RespondidaPor?.Id, e.AsignadaEn, e.RespondidaEn, e.VigenteHasta,
            e.Recalificaciones);

    private static string TextoMotivo(string motivo) => motivo switch
    {
        ResultadoDeEvaluacion.BajoElUmbral => "Bajo el umbral",
        ResultadoDeEvaluacion.EliminatoriaFallida => "Eliminatoria",
        _ => motivo
    };

    /// <summary>Una fila por pregunta visible: lo que se respondió en palabras, su puntaje de 0 a 100 (vacío si no puntúa), si eliminó y si un revisor la ajustó.</summary>
    private static IEnumerable<IReadOnlyList<object?>> Detalle(EvaluacionDeProveedor e, string? folio)
    {
        foreach (var seccion in e.Definicion.Secciones)
            foreach (var pregunta in seccion.Preguntas)
            {
                var calificada = e.Resultado!.Preguntas.FirstOrDefault(p => p.Codigo == pregunta.Codigo);
                if (calificada is not { Visible: true })
                    continue;
                var respuesta = e.Respuestas.FirstOrDefault(r => r.Pregunta == pregunta.Codigo);
                yield return
                [
                    e.TerceroNombre, folio, e.Cuestionario.Nombre, e.Cuestionario.Version, seccion.Nombre, pregunta.Codigo, pregunta.Texto, TextoDeRespuesta(e, pregunta, respuesta),
                    calificada.Puntaje, calificada.Elimina ? "Sí" : "No", calificada.Ajustada ? "Sí" : "No"
                ];
            }
    }

    private static string? TextoDeRespuesta(EvaluacionDeProveedor e, PreguntaDeCuestionario pregunta, RespuestaDePregunta? respuesta)
    {
        if (respuesta is null)
            return null;
        var partes = new List<string>();
        if (respuesta.Opciones is { Count: > 0 } codigos)
            partes.Add(string.Join(", ", codigos.Select(c => pregunta.Opciones?.FirstOrDefault(o => o.Codigo == c)?.Texto ?? c)));
        if (respuesta.Numero is { } numero)
            partes.Add(numero.ToString(System.Globalization.CultureInfo.InvariantCulture));
        if (!string.IsNullOrWhiteSpace(respuesta.Texto))
            partes.Add(respuesta.Texto);
        if (respuesta.Adjuntos is { Count: > 0 } adjuntos)
            partes.Add(string.Join(", ", adjuntos.Select(a => e.BuscarAdjunto(a)?.Nombre ?? a.ToString("N"))));
        if (!string.IsNullOrWhiteSpace(respuesta.Comentario))
            partes.Add($"Comentario: {respuesta.Comentario}");
        return partes.Count == 0 ? null : string.Join(" · ", partes);
    }
}
