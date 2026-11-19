using System.Globalization;
using Npgsql;
using Testcontainers.Minio;
using Testcontainers.PostgreSql;

namespace Validalo.Integracion.Tests;

/// <summary>
/// Un solo PostgreSQL 17 y un solo MinIO para todas las colecciones de pruebas que corren a la vez (decisión PV-1): cada
/// <see cref="ApiFixture"/> pide una base nueva en el mismo servidor (<see cref="CrearBaseAsync"/>) y arranca su propio host de la API.
/// Los contenedores se levantan con el primer uso y se detienen cuando el último fixture los suelta; si una colección termina antes de que
/// empiece otra, se vuelven a levantar. Ryuk (Testcontainers) los retira de todos modos si el proceso muere.
/// </summary>
/// <remarks>
/// PostgreSQL arranca sin <c>fsync</c> ni escrituras síncronas: las bases son desechables y el event sourcing de Marten es intensivo en
/// escrituras pequeñas, así que esto es lo que más acorta cada prueba. Las conexiones máximas suben para varios hosts a la vez.
/// </remarks>
internal sealed class ServiciosCompartidos
{
    /// <summary>Fork comunitario de MinIO (misma línea de comandos; minio/minio ya no se publica en Docker Hub).</summary>
    public const string ImagenMinio = "pgsty/minio:RELEASE.2026-08-04T00-00-00Z";

    private static readonly SemaphoreSlim Candado = new(1, 1);
    private static ServiciosCompartidos? _actual;
    private static int _usos;

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17")
        .WithCommand("-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off", "-c", "max_connections=400")
        .Build();

    private readonly MinioContainer _minio = new MinioBuilder(ImagenMinio).Build();
    private int _bases;

    public string EndpointMinio => _minio.GetConnectionString();

    public string ClaveDeAccesoMinio => _minio.GetAccessKey();

    public string ClaveSecretaMinio => _minio.GetSecretKey();

    /// <summary>Pide los servicios compartidos (los levanta si nadie los usa). Cada llamada debe terminar con <see cref="LiberarAsync"/>.</summary>
    public static async Task<ServiciosCompartidos> AdquirirAsync()
    {
        await Candado.WaitAsync();
        try
        {
            if (_actual is null)
            {
                var nuevos = new ServiciosCompartidos();
                await Task.WhenAll(nuevos._postgres.StartAsync(), nuevos._minio.StartAsync());
                _actual = nuevos;
            }

            _usos++;
            return _actual;
        }
        finally
        {
            Candado.Release();
        }
    }

    public static async Task LiberarAsync()
    {
        await Candado.WaitAsync();
        try
        {
            if (--_usos > 0 || _actual is null)
                return;
            var cierre = _actual;
            _actual = null;
            await Task.WhenAll(cierre._postgres.DisposeAsync().AsTask(), cierre._minio.DisposeAsync().AsTask());
        }
        finally
        {
            Candado.Release();
        }
    }

    /// <summary>Crea una base de datos vacía en el servidor compartido y devuelve su cadena de conexión (cada host de la API usa la suya).</summary>
    public async Task<string> CrearBaseAsync()
    {
        var nombre = "validalo_g" + Interlocked.Increment(ref _bases).ToString(CultureInfo.InvariantCulture);
        await using (var conexion = new NpgsqlConnection(_postgres.GetConnectionString()))
        {
            await conexion.OpenAsync();
            await using var comando = new NpgsqlCommand($"create database {nombre}", conexion);
            await comando.ExecuteNonQueryAsync();
        }

        return new NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = nombre }.ConnectionString;
    }
}
