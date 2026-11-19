using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Avalasoft.Aplicacion.Certificados;
using Avalasoft.Dominio.Certificados;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Vector dorado del certificado (contrato API ↔ navegador): una emisión real de la API, guardada en
/// <c>apps/public/src/pruebas/vector-dorado/</c>, que el verificador del navegador (Vitest, <c>verificacion.test.ts</c>) valida con WebCrypto. Aquí
/// la valida el código de la API (JCS, SHA-256, huella, Ed25519 y el modelo del contenido): si cambia cómo se canonicaliza, se calcula el hash,
/// se sella o qué lleva el contenido, esta prueba falla y hay que emitir un vector nuevo y comprobar que el navegador lo sigue validando.
/// </summary>
public class VectorDoradoDelCertificadoTests
{
    /// <summary>Lee un archivo del vector dorado; la ruta sale de este archivo fuente (no de la carpeta de salida, que puede estar en cualquier parte).</summary>
    private static JsonElement Leer(string archivo, [CallerFilePath] string origen = "")
    {
        var raiz = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(origen)!, "..", ".."));
        var ruta = Path.Combine(raiz, "apps", "public", "src", "pruebas", "vector-dorado", archivo);
        return JsonDocument.Parse(File.ReadAllText(ruta, Encoding.UTF8)).RootElement.Clone();
    }

    private static string ConClavesAlReves(JsonElement elemento)
    {
        using var memoria = new MemoryStream();
        using (var escritor = new Utf8JsonWriter(memoria))
            Escribir(elemento, escritor);
        return Encoding.UTF8.GetString(memoria.ToArray());
    }

    private static void Escribir(JsonElement elemento, Utf8JsonWriter escritor)
    {
        switch (elemento.ValueKind)
        {
            case JsonValueKind.Object:
                escritor.WriteStartObject();
                foreach (var propiedad in elemento.EnumerateObject().Reverse())
                {
                    escritor.WritePropertyName(propiedad.Name);
                    Escribir(propiedad.Value, escritor);
                }

                escritor.WriteEndObject();
                break;
            case JsonValueKind.Array:
                escritor.WriteStartArray();
                foreach (var item in elemento.EnumerateArray())
                    Escribir(item, escritor);
                escritor.WriteEndArray();
                break;
            default:
                elemento.WriteTo(escritor);
                break;
        }
    }

    [Fact]
    public void La_API_canonicaliza_hashea_y_sella_el_vector_dorado_como_lo_valida_el_navegador()
    {
        var certificado = Leer("certificado.json");
        var claves = Leer("claves.json");

        // El hash del JSON canónico (RFC 8785) y la huella que muestra el QR son los que trae la emisión. Se canonicaliza con las claves al revés
        // para comprobar que el orden de entrada no importa (el vector ya viene ordenado).
        var canonico = Jcs.Canonicalizar(ConClavesAlReves(certificado.GetProperty("contenidoCanonico")));
        var hash = HuellaDeCertificado.Hash(canonico);
        hash.ShouldBe(certificado.GetProperty("hashContenido").GetString());
        HuellaDeCertificado.Formatear(hash).ShouldBe(certificado.GetProperty("huella").GetString());
        certificado.GetProperty("urlVerificacion").GetString().ShouldEndWith($"/verificar/{certificado.GetProperty("folio").GetString()}?huella={hash[..12]}");

        // El sello Ed25519 es de los 32 bytes del hash (no de su texto hexadecimal) y verifica con la clave publicada para su kid.
        var firma = certificado.GetProperty("firma");
        var publicada = claves.GetProperty("claves").EnumerateArray().Single(c => c.GetProperty("kid").GetString() == firma.GetProperty("kid").GetString());
        var clavePublica = Convert.FromBase64String(publicada.GetProperty("clavePublica").GetString()!);
        var sello = Convert.FromBase64String(firma.GetProperty("valor").GetString()!);
        SelloEd25519.Verificar(clavePublica, Convert.FromHexString(hash), sello).ShouldBeTrue();
        SelloEd25519.Verificar(clavePublica, Encoding.ASCII.GetBytes(hash), sello).ShouldBeFalse();
        firma.GetProperty("algoritmo").GetString().ShouldBe(SelloEd25519.Algoritmo);
    }

    [Fact]
    public void El_contenido_del_vector_dorado_es_el_que_escribe_hoy_la_API_con_su_modelo()
    {
        var canonico = Jcs.Canonicalizar(Leer("certificado.json").GetProperty("contenidoCanonico"));

        // Leerlo con el modelo del contenido y volver a escribirlo da exactamente los mismos bytes: la API no cambió campos, nombres ni formatos.
        ContenidoDeCertificado.Leer(canonico).Canonico().ShouldBe(canonico);
    }
}
