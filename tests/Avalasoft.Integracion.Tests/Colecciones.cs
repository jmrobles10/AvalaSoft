namespace Avalasoft.Integracion.Tests;

/// <summary>
/// Colecciones de xUnit de las pruebas que usan la API (decisión PV-1). Cada colección tiene su propio <see cref="ApiFixture"/>: su host de la API y
/// su base de datos en el PostgreSQL compartido (un solo contenedor de PostgreSQL y uno de MinIO para todas). Las colecciones corren en paralelo;
/// dentro de una colección las pruebas siguen en serie, así que lo que comparte un host (el reloj de las pruebas, los límites de peticiones por IP,
/// la cola de correos capturados, el archivo del Portal) sigue siendo seguro mientras la clase esté en UNA sola colección.
/// </summary>
/// <remarks>
/// El reparto de clases entre colecciones busca que cada una dure lo mismo (las pruebas más largas, juntas, serían el cuello de botella): el
/// tiempo de la corrida es el de la colección más lenta. Una clase nueva va a la colección que tenga menos carga; no hace falta que sea exacto.
/// </remarks>
public static class Colecciones
{
    public const string Api1 = "api-1";
    public const string Api2 = "api-2";
    public const string Api3 = "api-3";
    public const string Api4 = "api-4";

    /// <summary>
    /// Una colección que corre SOLA, cuando ninguna otra está corriendo (xUnit la deja para el final): la prueba de rendimiento de la invitación
    /// masiva mide con un <c>Meter</c>, el conjunto de trabajo y el montón de TODO el proceso, así que cualquier otro host trabajando a la vez
    /// le contaría filas fallidas y memoria que no son suyas.
    /// </summary>
    public const string Rendimiento = "api-rendimiento";
}

[CollectionDefinition(Colecciones.Api1)]
public sealed class ColeccionApi1 : ICollectionFixture<ApiFixture>;

[CollectionDefinition(Colecciones.Api2)]
public sealed class ColeccionApi2 : ICollectionFixture<ApiFixture>;

[CollectionDefinition(Colecciones.Api3)]
public sealed class ColeccionApi3 : ICollectionFixture<ApiFixture>;

[CollectionDefinition(Colecciones.Api4)]
public sealed class ColeccionApi4 : ICollectionFixture<ApiFixture>;

[CollectionDefinition(Colecciones.Rendimiento, DisableParallelization = true)]
public sealed class ColeccionRendimiento : ICollectionFixture<ApiFixture>;
