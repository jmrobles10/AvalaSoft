using System.Globalization;
using System.Text.Json;
using Avalasoft.Dominio.Expedientes;
using Avalasoft.Dominio.Ficha;
using Avalasoft.Dominio.Terceros;

namespace Avalasoft.Dominio.FuentesOficiales;

/// <summary>La ficha maestra vigente del tercero, lo que se coteja contra la fuente (FO-4). Las secciones que no existen van nulas.</summary>
/// <param name="Nombre">El nombre con el que se registró al tercero (respaldo si la ficha no tiene razón social).</param>
/// <param name="Identificacion">El número de identificación del tercero (respaldo si la ficha no lo tiene).</param>
public sealed record FichaParaCotejo(TipoPersona TipoPersona, string Nombre, string Identificacion, DatosGenerales? General, DatosTributarios? Tributaria,
    DatosLegales? Legal);

/// <summary>Un documento del tercero (RUT, certificado de Cámara) con lo que la IA extrajo de él. Solo los que la empresa recibió (IA-11).</summary>
public sealed record DocumentoParaCotejo(string TipoCanonico, Guid DocumentoId, int Version, IReadOnlyDictionary<string, JsonElement> Campos, bool Legible);

/// <summary>
/// Cotejo de lo que dice una fuente oficial con la ficha maestra y con lo que la IA extrajo del certificado de Cámara y del RUT (FO-4). Mismas
/// reglas de normalización que el cruce de la ficha (<see cref="CruceConDocumento"/>: identificación exacta, nombres sin tildes ni puntuación ni
/// orden, direcciones abreviadas como la DIAN, códigos completados). Función pura: no decide nada, deja <b>diferencias para el revisor</b>.
/// Lo que la fuente no trae o la ficha no tiene diligenciado queda «no verificable» (sin decisión); lo que no coincide, «discrepa».
/// </summary>
public static class CruceConFuenteOficial
{
    public const string DocumentoCamara = "CAMARA_COMERCIO";
    public const string DocumentoRut = "RUT";

    public static List<CampoCotejado> Cotejar(TipoVerificacion fuente, DatosOficiales datos, FichaParaCotejo ficha, IReadOnlyList<DocumentoParaCotejo> documentos,
        DateOnly hoy)
    {
        var nombreFuente = CatalogoDeFuentes.Nombre(fuente);
        var campos = new List<CampoCotejado>();
        if (!datos.Encontrado)
        {
            campos.Add(new CampoCotejado(Guid.Empty, "registro", $"Registro en {nombreFuente}", ContraQue.Fuente, null, $"No figura en {nombreFuente}", "Debe figurar",
                ResultadoDeCruce.Discrepa, true, fuente == TipoVerificacion.Rues
                    ? "El NIT no tiene matrícula mercantil en el RUES (puede ser una entidad sin matrícula, una persona no comerciante o un extranjero)."
                    : "La DIAN no devolvió el RUT del tercero."));
            return campos;
        }

        Estado(campos, fuente, datos, hoy);
        var general = ficha.General;
        var natural = ficha.TipoPersona == TipoPersona.Natural;
        var nombreDeFicha = natural ? CruceConDocumento.NombreCompleto(general?.Nombres, general?.Apellidos) ?? ficha.Nombre : general?.RazonSocial ?? ficha.Nombre;
        Agregar(campos, "razon_social", natural ? "Nombres y apellidos" : "Razón social", ContraQue.Ficha, CodigosDeSeccion.General, datos.RazonSocial, nombreDeFicha,
            CruceConDocumento.Comparador.Nombre, true);
        Agregar(campos, "numero", "Número de identificación", ContraQue.Ficha, CodigosDeSeccion.General, datos.Nit, general?.Numero ?? ficha.Identificacion,
            CruceConDocumento.Comparador.Identificacion, true);
        Agregar(campos, "ciiu_principal", "Actividad económica principal (CIIU)", ContraQue.Ficha, CodigosDeSeccion.General, datos.ActividadPrincipal,
            general?.CiiuPrincipal, CruceConDocumento.Comparador.Codigo, false);

        if (fuente == TipoVerificacion.Rues)
            RepresentantesContraFicha(campos, datos, ficha, natural);
        else
        {
            Agregar(campos, "dv", "DV", ContraQue.Ficha, CodigosDeSeccion.General, datos.Dv, general?.Dv, CruceConDocumento.Comparador.Identificacion, false);
            Agregar(campos, "direccion", "Dirección", ContraQue.Ficha, CodigosDeSeccion.General, datos.Direccion, general?.Direccion,
                CruceConDocumento.Comparador.Direccion, false);
            if (datos.Municipio is { Length: 5 } municipio && municipio.All(char.IsDigit))
                Agregar(campos, "ciudad", "Ciudad (código DANE)", ContraQue.Ficha, CodigosDeSeccion.General, municipio, general?.Ciudad, CruceConDocumento.Comparador.Codigo,
                    false);
            Conjunto(campos, "responsabilidades", "Responsabilidades (casilla 53 del RUT)", ContraQue.Ficha, CodigosDeSeccion.Tributaria, datos.Responsabilidades,
                ficha.Tributaria?.Responsabilidades, 2);
        }

        foreach (var documento in documentos.Where(d => d.Legible))
            ContraDocumento(campos, fuente, datos, documento);
        return campos;
    }

    /// <summary>Lo que la fuente dice de su propio estado, y de la renovación en la matrícula: no es un cotejo con la ficha, es el hallazgo de la fuente.</summary>
    private static void Estado(List<CampoCotejado> campos, TipoVerificacion fuente, DatosOficiales datos, DateOnly hoy)
    {
        var rues = fuente == TipoVerificacion.Rues;
        var etiqueta = rues ? "Estado de la matrícula mercantil" : "Estado del RUT";
        var esperado = rues ? "Activa" : "Activo";
        var resultado = datos.EstadoNormalizado switch
        {
            EstadoOficial.Vigente => ResultadoDeCruce.Coincide,
            EstadoOficial.NoVigente => ResultadoDeCruce.Discrepa,
            _ => ResultadoDeCruce.NoVerificable
        };
        var detalle = datos.EstadoNormalizado switch
        {
            EstadoOficial.NoVigente => rues ? "La matrícula no está activa en el RUES." : "El RUT no está activo en la DIAN.",
            EstadoOficial.Desconocido => "La fuente no trae un estado que se pueda interpretar.",
            _ => null
        };
        campos.Add(new CampoCotejado(Guid.Empty, rues ? "estado_matricula" : "estado_rut", etiqueta, ContraQue.Fuente, null, datos.Estado, esperado, resultado, true, detalle));

        if (!rues || datos.EstadoNormalizado == EstadoOficial.NoVigente || datos.UltimoAnoRenovado is null or <= 0)
            return;
        var anoEsperado = ReglasDeFuente.AnoDeRenovacionEsperado(hoy);
        var renovada = datos.UltimoAnoRenovado >= anoEsperado;
        var oficial = datos.FechaRenovacion is { } fecha ? $"{datos.UltimoAnoRenovado} (renovada el {ReglasDeFuente.Fecha(fecha)})" : datos.UltimoAnoRenovado?.ToString(CultureInfo.InvariantCulture);
        campos.Add(new CampoCotejado(Guid.Empty, "renovacion", "Renovación de la matrícula (último año renovado)", ContraQue.Fuente, null, oficial, $"Renovada al {anoEsperado}",
            renovada ? ResultadoDeCruce.Coincide : ResultadoDeCruce.Discrepa, false,
            renovada ? null : $"La matrícula se renovó por última vez para {datos.UltimoAnoRenovado}; debería estar renovada al {anoEsperado} (se renueva hasta el 31 de marzo)."));
    }

    /// <summary>Cada representante que reporta la fuente debe figurar entre los representantes (principal o suplente) de la ficha.</summary>
    private static void RepresentantesContraFicha(List<CampoCotejado> campos, DatosOficiales datos, FichaParaCotejo ficha, bool natural)
    {
        if (natural)
            return;
        var declarados = (ficha.Legal?.Personas ?? []).Where(p => p.Rol is RolPersonaRelacionada.RepresentanteLegal or RolPersonaRelacionada.Suplente).ToList();
        var indice = 0;
        foreach (var oficial in datos.Representantes)
        {
            var posicion = indice++;
            var campo = $"representante[{posicion}]";
            var resumen = CruceConDocumento.Resumen(oficial.Nombre, oficial.Identificacion, oficial.Cargo);
            if (declarados.Count == 0)
            {
                campos.Add(new CampoCotejado(Guid.Empty, campo, "Representante legal", ContraQue.Ficha, CodigosDeSeccion.Legal, resumen, null, ResultadoDeCruce.Discrepa, true,
                    "La ficha no tiene representante legal y el registro sí."));
                continue;
            }

            var encontrado = declarados.FirstOrDefault(p => CruceConDocumento.MismaPersona(CruceConDocumento.NombreCompleto(p.Nombres, p.Apellidos), p.Numero, oficial.Nombre,
                oficial.Identificacion));
            campos.Add(new CampoCotejado(Guid.Empty, campo, "Representante legal", ContraQue.Ficha, CodigosDeSeccion.Legal, resumen,
                encontrado is null ? null : CruceConDocumento.Resumen(CruceConDocumento.NombreCompleto(encontrado.Nombres, encontrado.Apellidos), encontrado.Numero),
                encontrado is null ? ResultadoDeCruce.Discrepa : ResultadoDeCruce.Coincide, true,
                encontrado is null ? "Figura en el registro y no entre los representantes de la ficha." : null));
        }
    }

    private static void ContraDocumento(List<CampoCotejado> campos, TipoVerificacion fuente, DatosOficiales datos, DocumentoParaCotejo documento)
    {
        var x = documento.Campos;
        var referencia = $"{documento.TipoCanonico} v{documento.Version}";
        var tipo = documento.TipoCanonico.ToUpperInvariant();
        if (fuente == TipoVerificacion.Rues && tipo == DocumentoCamara)
        {
            Agregar(campos, "razon_social", "Razón social", ContraQue.Documento, referencia, datos.RazonSocial, LecturaDeHechos.Texto(x, "razonSocial"),
                CruceConDocumento.Comparador.Nombre, true);
            Agregar(campos, "numero", "Número de identificación", ContraQue.Documento, referencia, datos.Nit, LecturaDeHechos.Texto(x, "nit"),
                CruceConDocumento.Comparador.Identificacion, true);
            Agregar(campos, "matricula", "Número de matrícula", ContraQue.Documento, referencia, datos.Matricula, LecturaDeHechos.Texto(x, "matricula"),
                CruceConDocumento.Comparador.Identificacion, false);
            var estadoDelDocumento = LecturaDeHechos.Texto(x, "estadoMatricula");
            if (estadoDelDocumento is not null && datos.EstadoNormalizado != EstadoOficial.Desconocido)
            {
                var delDocumento = EstadosOficiales.Normalizar(estadoDelDocumento);
                var igual = delDocumento == datos.EstadoNormalizado;
                if (delDocumento != EstadoOficial.Desconocido)
                    campos.Add(new CampoCotejado(Guid.Empty, "estado_matricula", "Estado de la matrícula", ContraQue.Documento, referencia, datos.Estado, estadoDelDocumento,
                        igual ? ResultadoDeCruce.Coincide : ResultadoDeCruce.Discrepa, true,
                        igual ? null : $"El certificado dice «{estadoDelDocumento}» y el RUES «{datos.Estado}»."));
            }

            var enDocumento = LecturaDeHechos.Personas(x, "representantesLegales");
            if (enDocumento is not null)
            {
                var indice = 0;
                foreach (var oficial in datos.Representantes)
                {
                    var encontrado = enDocumento.FirstOrDefault(p => CruceConDocumento.MismaPersona(p.Nombre, p.Identificacion, oficial.Nombre, oficial.Identificacion));
                    campos.Add(new CampoCotejado(Guid.Empty, $"representante[{indice++}]", "Representante legal", ContraQue.Documento, referencia,
                        CruceConDocumento.Resumen(oficial.Nombre, oficial.Identificacion, oficial.Cargo),
                        encontrado is null ? null : CruceConDocumento.Resumen(encontrado.Nombre, encontrado.Identificacion, encontrado.Cargo),
                        encontrado is null ? ResultadoDeCruce.Discrepa : ResultadoDeCruce.Coincide, true,
                        encontrado is null ? "Figura en el registro y no en el certificado de Cámara." : null));
                }
            }
        }
        else if (fuente == TipoVerificacion.Dian && tipo == DocumentoRut)
        {
            Agregar(campos, "razon_social", "Razón social", ContraQue.Documento, referencia, datos.RazonSocial, LecturaDeHechos.Texto(x, "razonSocial"),
                CruceConDocumento.Comparador.Nombre, true);
            Agregar(campos, "numero", "Número de identificación", ContraQue.Documento, referencia, datos.Nit, LecturaDeHechos.Texto(x, "nit"),
                CruceConDocumento.Comparador.Identificacion, true);
            Agregar(campos, "direccion", "Dirección", ContraQue.Documento, referencia, datos.Direccion, LecturaDeHechos.Texto(x, "direccion"),
                CruceConDocumento.Comparador.Direccion, false);
            Agregar(campos, "ciiu_principal", "Actividad económica principal (CIIU)", ContraQue.Documento, referencia, datos.ActividadPrincipal,
                LecturaDeHechos.Texto(x, "actividadEconomicaPrincipal"), CruceConDocumento.Comparador.Codigo, false);
            Conjunto(campos, "responsabilidades", "Responsabilidades (casilla 53 del RUT)", ContraQue.Documento, referencia, datos.Responsabilidades,
                LecturaDeHechos.Lista(x, "responsabilidades"), 2);
        }
    }

    /// <summary>
    /// Agrega el campo si hay algo que comparar. La fuente es lo oficial: si no lo trae, no se puede verificar; si la ficha o el documento no lo
    /// tienen, tampoco (la ficha incompleta es asunto de su propia revisión); con los dos, coincide o discrepa.
    /// </summary>
    private static void Agregar(List<CampoCotejado> campos, string campo, string etiqueta, ContraQue contra, string? referencia, string? oficial, string? comparado,
        CruceConDocumento.Comparador comparador, bool critico)
    {
        oficial = string.IsNullOrWhiteSpace(oficial) ? null : oficial.Trim();
        comparado = string.IsNullOrWhiteSpace(comparado) ? null : comparado.Trim();
        if (oficial is null && comparado is null)
            return;
        if (oficial is null || comparado is null)
        {
            campos.Add(new CampoCotejado(Guid.Empty, campo, etiqueta, contra, referencia, oficial, comparado, ResultadoDeCruce.NoVerificable, critico,
                oficial is null ? "La fuente no trae el dato." : contra == ContraQue.Ficha ? "La ficha no lo tiene diligenciado." : "El documento no trae el dato."));
            return;
        }

        var (coincide, detalle) = CruceConDocumento.Comparar(comparado, oficial, comparador);
        campos.Add(new CampoCotejado(Guid.Empty, campo, etiqueta, contra, referencia, oficial, comparado, coincide ? ResultadoDeCruce.Coincide : ResultadoDeCruce.Discrepa,
            critico, detalle));
    }

    private static void Conjunto(List<CampoCotejado> campos, string campo, string etiqueta, ContraQue contra, string? referencia, IReadOnlyList<string>? oficiales,
        IReadOnlyList<string>? comparados, int digitos)
    {
        var a = Normalizacion.Codigos(oficiales, digitos);
        var b = Normalizacion.Codigos(comparados, digitos);
        if (a.Count == 0 && b.Count == 0)
            return;
        var oficial = a.Count == 0 ? null : string.Join(", ", a.Order(StringComparer.Ordinal));
        var comparado = b.Count == 0 ? null : string.Join(", ", b.Order(StringComparer.Ordinal));
        if (a.Count == 0 || b.Count == 0)
        {
            campos.Add(new CampoCotejado(Guid.Empty, campo, etiqueta, contra, referencia, oficial, comparado, ResultadoDeCruce.NoVerificable, false,
                a.Count == 0 ? "La fuente no trae el dato." : "No hay con qué comparar."));
            return;
        }

        if (a.SetEquals(b))
        {
            campos.Add(new CampoCotejado(Guid.Empty, campo, etiqueta, contra, referencia, oficial, comparado, ResultadoDeCruce.Coincide, false));
            return;
        }

        var faltan = a.Except(b).Order(StringComparer.Ordinal).ToList();
        var sobran = b.Except(a).Order(StringComparer.Ordinal).ToList();
        var detalle = string.Join("; ", new[]
        {
            faltan.Count > 0 ? $"La fuente trae {string.Join(", ", faltan)} y no figura" : null,
            sobran.Count > 0 ? $"Figura {string.Join(", ", sobran)} y la fuente no lo trae" : null
        }.OfType<string>()) + ".";
        campos.Add(new CampoCotejado(Guid.Empty, campo, etiqueta, contra, referencia, oficial, comparado, ResultadoDeCruce.Discrepa, false, detalle));
    }
}
