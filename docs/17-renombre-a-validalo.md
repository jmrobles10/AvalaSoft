# 17 — Renombre a Valídalo y migración de los datos locales (2026-11-18)

> **Para qué sirve:** dejar escrito qué cambió cuando el nombre anterior desapareció de todo el repositorio (código, rutas,
> paquetes, configuración, contrato de la API, documentos y CI) y cómo se llevan al nombre nuevo los datos que cada
> desarrollador tiene en su máquina (PostgreSQL, MinIO, Docker). El nombre anterior no se escribe en este documento a
> propósito (para que una búsqueda del nombre anterior en el repositorio dé cero resultados): se lo llama «el nombre anterior» o `<anterior>`.
> Es el segundo renombre del día: el nombre de trabajo original pasó al nombre anterior en la mañana, y este lo reemplaza. Lo que se explica
> aquí vale igual para cualquiera de los dos; los scripts de datos se probaron en el primero y se reescriben para este.

## 1. Qué cambió

El mapa es mecánico, respetando la forma de cada caso:

| Antes (`<anterior>`) | Ahora | Dónde |
|---|---|---|
| `<Anterior>` en PascalCase | `Validalo` | Proyectos y carpetas .NET (`src/Validalo.Api`, `Validalo.Aplicacion`, `Validalo.slnx`…), espacios de nombres, clases (`ClienteValidalo`, `ExcepcionValidalo`, `OpcionesValidalo`), componentes del tema (`createValidaloTheme`) |
| `<anterior>` en minúsculas | `validalo` | Paquetes npm (`@validalo/web`, `@validalo/sdk`…), sección de configuración, base de datos, usuarios, `aud`, ids, rutas (`/.well-known/validalo-certificados.json`), esquema del contenido canónico de los certificados nuevos (`validalo.certificado.v1`), tipos de `postMessage` (`validalo:sesion`, `validalo:ready`) |
| `<ANTERIOR>` en mayúsculas | `VALIDALO` | Variables de entorno de scripts y SDK (`VALIDALO_API_KEY`, `VALIDALO_API_URL`…) |
| Cabeceras HTTP | `Validalo-Signature`, `Validalo-Event-Id`, `Validalo-Event-Type`, `Validalo-Timestamp`, `Validalo-Delivery`, `X-Validalo-Cliente`… | API y webhooks |
| Nombre del producto en prosa | **Valídalo** (con tilde) | Documentos, comentarios, textos de pantalla, correos, PDF, Excel, títulos y manifiestos |
| Dominios de ejemplo y de pruebas | `validalo.co`, `validalo.local`, `validalo.test` | Correos de las pruebas, orígenes de los ejemplos |
| Carpeta de trabajo | `C:\Fuentes_Git\Validalo` | Documentos y scripts que citan la ruta |
| Prefijos cortos (`vs-`, `Vs`) | sin cambio | Son abreviaturas internas |

Variables de entorno de configuración: `Validalo__Grupo__Nombre` y `ConnectionStrings__Validalo` (antes, con el nombre anterior en
ambos casos). **Quien las tenga fijadas en su máquina o en un despliegue debe renombrarlas**; si no, la API arranca con los valores por omisión
y falla al pedir la cadena de conexión. Lo mismo vale para las demás variables `<Anterior>__…` y `<ANTERIOR>_…`.

### Contrato de la API (cambio visible para los integradores)

El renombre toca el contrato publicado: cabeceras de webhooks y de cliente, la ruta de claves públicas de los certificados, la
audiencia (`aud`) de la aserción de identidad delegada, los reclamos de la sesión directa (`validalo:sesion-id`, `validalo:metodo`) y
los tipos de mensaje del puente embebido. Los sistemas integrados (SRM, Marco, Portal, sistemas de clientes) tienen que
actualizarse con el SDK nuevo (`Validalo.Contratos`, `Validalo.Sdk`, `@validalo/sdk`). Las sesiones cortas emitidas antes del renombre dejan de
valer (el reclamo cambió de nombre): las personas vuelven a iniciar sesión.

### Lo que NO se reescribe

- **Certificados ya emitidos.** Su contenido canónico está sellado (hash y firma Ed25519) y dice `esquema` con el valor del nombre
  anterior. No se toca: reescribirlo invalidaría la firma. La verificación pública recalcula el hash sobre lo guardado y no compara el
  esquema contra una lista, así que siguen verificándose. Los certificados nuevos salen con `validalo.certificado.v1`, y la lista `esquemas` de
  `/.well-known/validalo-certificados.json` publica solo ese. El **vector dorado** de la prueba de contrato entre la API y el navegador
  (`apps/public/src/pruebas/vector-dorado/`) sí se regeneró: se recalculó el JSON canónico (RFC 8785), su SHA-256, la huella y la URL de verificación, y se
  volvió a sellar con la clave de desarrollo («solo local»). El procedimiento se validó antes reproduciendo **idénticos** el hash y la firma del vector anterior.
- **Eventos y textos legales ya guardados** (por ejemplo la versión 1 del aviso de la plataforma, sembrada con el nombre anterior en su
  texto): son historia. Una aceptación apunta a un texto concreto; si se quiere el nombre nuevo, se publica una versión nueva del texto.
- **Datos de personas** (correos, dominios) que casualmente contengan la cadena: son datos, no configuración.

### El logotipo

El nombre nuevo trae un logotipo nuevo (la «V» del check seguida de «alídalo», sin círculo): ver [marca](marca.md) y NV-1 a NV-4 en el
[registro de decisiones](decisiones/registro.md). Los recursos (SVG, PNG, favicon, íconos, GIF y los del correo) se regeneraron con `pnpm --filter @validalo/marca generar`.

### URL del repositorio de GitHub

El repositorio remoto se renombra a `Validalo` en GitHub (Settings → General → Repository name): es un paso manual que no es contenido del repositorio, y
GitHub redirige el nombre anterior. Ningún archivo versionado escribe la URL:

- `src/Empaquetado.props` arma `RepositoryUrl` y `PackageProjectUrl` con `GITHUB_REPOSITORY` cuando el paquete se empaqueta en GitHub Actions.
- `packages/sdk/package.json` no trae `homepage`, `bugs` ni `repository`; el workflow `sdk-publicar.yml` los fija antes de empaquetar con
  `npm pkg set` y el mismo `GITHUB_REPOSITORY` (la procedencia de npm sigue coincidiendo con el repositorio real).
- Los README de los paquetes apuntan a `docs/integracion.md` sin enlace absoluto.

Cada clon local actualiza su remoto con `git remote set-url origin <url nueva>` (opcional mientras GitHub redirija). Renombrar la **carpeta** local
(`C:\Fuentes_Git\<anterior>` → `C:\Fuentes_Git\Validalo`) rompe las rutas absolutas de los *worktrees* de `.claude/worktrees`: se cierran antes los editores y las sesiones
y se corre `git worktree repair` desde la carpeta principal.

## 2. Migración de los datos locales

> **Estado.** Estos pasos **no se han ejecutado** en ninguna máquina para este renombre: el renombre se hizo en un *worktree* aparte y no tocó las bases ni los contenedores
> existentes. Quien quiera conservar sus datos locales los hace una vez, con la API y las apps detenidas; el orden importa. Quien no los necesite
> deja que Docker cree volúmenes nuevos (la API siembra el catálogo al arrancar). Los scripts son los del renombre anterior, que sí se ejecutó y verificó, con los nombres cambiados.

### 2.1 PostgreSQL y MinIO en Docker

El nombre del proyecto de Compose (`name:` de `infra/compose/compose.yaml`) pasó de `<anterior>` a `validalo`, así que Docker crea volúmenes,
red y contenedores nuevos (`validalo_postgres-datos`, `validalo_minio-datos`, `validalo-postgres-1`…) y no ve los viejos. Para conservar los datos:

```bash
# 1. Detener el entorno viejo SIN -v (los volúmenes se conservan).
docker compose -p <anterior> -f infra/compose/compose.yaml --profile e2e --profile app down

# 2. Crear contenedores y volúmenes nuevos sin arrancarlos.
docker compose -f infra/compose/compose.yaml --profile e2e up --no-start

# 3. Copiar los datos (cp -a conserva dueños y permisos; los volúmenes viejos quedan intactos).
docker run --rm -v <anterior>_postgres-datos:/desde:ro -v validalo_postgres-datos:/hacia alpine sh -c 'cp -a /desde/. /hacia/'
docker run --rm -v <anterior>_minio-datos:/desde:ro    -v validalo_minio-datos:/hacia    alpine sh -c 'cp -a /desde/. /hacia/'

# 4. Levantar PostgreSQL y renombrar la base y el rol (la imagen de PostgreSQL solo usa POSTGRES_DB/USER al crear el
#    clúster; con datos copiados hay que renombrarlos a mano). Un rol no puede renombrarse a sí mismo: se usa uno temporal.
docker compose -f infra/compose/compose.yaml up -d postgres
docker exec validalo-postgres-1 psql -U <anterior> -d postgres -c "CREATE ROLE tmp_renombre SUPERUSER LOGIN"
docker exec validalo-postgres-1 psql -U tmp_renombre -d postgres \
  -c 'ALTER DATABASE "<anterior>" RENAME TO validalo' -c 'ALTER ROLE "<anterior>" RENAME TO validalo' -c "ALTER ROLE validalo PASSWORD 'validalo'"
docker exec validalo-postgres-1 psql -U validalo -d postgres -c "DROP ROLE tmp_renombre"

# 5. Migrar los tipos persistidos (sección 2.2) y levantar el resto.
docker compose -f infra/compose/compose.yaml --profile e2e up -d
```

Otra opción, sin copiar volúmenes: `pg_dump` de la base vieja y `pg_restore` en la nueva (con el rol `validalo` como dueño).

MinIO toma sus credenciales de las variables `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (ahora `validalo` / `validalo-minio-solo-local`) y lee sin
problema los datos copiados: los buckets (`boveda`, `tenant-<id>`) nunca llevaron el nombre anterior. Mailpit no guarda nada en disco: los correos
de la bandeja se pierden al recrear el contenedor.

Los puertos (5432, 9000, 9001, 1025, 8025) no cambian: **el entorno viejo y el nuevo no pueden estar levantados a la vez**.

Cuando todo funcione, los volúmenes viejos (`<anterior>_postgres-datos`, `<anterior>_minio-datos`) y los de CI local (`<anterior>-ci-*`,
`<anterior>-cilocal-*`, que pasan a llamarse `validalo-ci-*` y `validalo-cilocal-*`) se pueden borrar con `docker volume rm`. Hasta entonces sirven de respaldo.

### 2.2 Tipos persistidos por Marten y Wolverine

Marten guarda en `mt_dotnet_type` (documentos y eventos) el nombre completo de la clase y del ensamblado; Wolverine guarda en
`wolverine_*_envelopes.message_type` el nombre del mensaje y en `wolverine_node_assignments` la URI del agente, que lleva el nombre de la base de datos.
Todo eso incluía el nombre anterior. Las tablas y funciones de Marten se nombran por la clase (sin espacio de nombres), por eso no cambian. El SQL
siguiente arma el nombre anterior por concatenación (para no escribirlo en el repositorio), cuenta lo afectado y lo actualiza dentro de una
transacción; se corre una vez por base (`validalo` y, si existe, `vs_manual_ficha`):

```sql
begin;
create temp table _afectadas (tabla text, columna text, filas bigint);
do $$
declare
  viejo text := 'Ava' || 'lasoft';   nuevo text := 'Validalo';
  viejo_min text := lower(viejo);    nuevo_min text := lower(nuevo);
  r record; n bigint;
begin
  -- Marten: mt_dotnet_type de todas las tablas de documentos y de eventos.
  for r in select c.table_schema s, c.table_name t, c.column_name col
           from information_schema.columns c
           join information_schema.tables tt on tt.table_schema = c.table_schema and tt.table_name = c.table_name and tt.table_type = 'BASE TABLE'
           where c.column_name = 'mt_dotnet_type' and c.table_schema in ('boveda','eventos','identidad','plataforma','validacion')
  loop
    execute format('select count(*) from %I.%I where %I like %L', r.s, r.t, r.col, '%' || viejo || '%') into n;
    if n > 0 then
      insert into _afectadas values (r.s || '.' || r.t, r.col, n);
      execute format('update %I.%I set %I = replace(%I, %L, %L) where %I like %L', r.s, r.t, r.col, r.col, viejo, nuevo, r.col, '%' || viejo || '%');
    end if;
  end loop;
  -- Wolverine: tipo de mensaje de los envelopes y URI del agente (lleva el nombre de la base, en minúsculas).
  update validacion.wolverine_incoming_envelopes set message_type = replace(message_type, viejo, nuevo) where message_type like '%' || viejo || '%';
  update validacion.wolverine_outgoing_envelopes set message_type = replace(message_type, viejo, nuevo) where message_type like '%' || viejo || '%';
  update validacion.wolverine_dead_letters       set message_type = replace(message_type, viejo, nuevo) where message_type like '%' || viejo || '%';
  update validacion.wolverine_node_assignments   set id = replace(id, viejo_min, nuevo_min) where id like '%' || viejo_min || '%';
  update validacion.wolverine_node_records       set description = replace(description, viejo_min, nuevo_min) where description like '%' || viejo_min || '%';
end $$;
select * from _afectadas order by 1;
commit;
```

En el renombre anterior, en la base local de Mateo: 44 columnas y 576 filas actualizadas (158 eventos, 173 entradas de catálogo, 20 mensajes programados de Wolverine…);
el total de filas del esquema de la aplicación quedó igual antes y después, y el de objetos de MinIO también.

Si la base trae operadores de desarrollo sembrados con un correo del dominio anterior (`paula@<anterior>.local`), el script `pnpm semilla:plataforma` ahora usa
`paula@validalo.local`: se actualiza ese correo del operador en la base para que coincida con `apps/web/.semilla.local.json` (archivo local, sin versionar, que cada
quien renombra en su lugar).

### 2.3 Ids deterministas y secretos cifrados: el nombre anterior está dentro del hash

Hay dos familias de datos que se calculan a partir de una cadena fija que lleva el nombre. Renombrar el código sin migrarlas deja datos
huérfanos o ilegibles, así que hay que migrarlas en toda base que las tenga:

**Ids deterministas** (los 16 primeros bytes de un SHA-256 de `<rótulo>:<datos>`, como `new Guid(bytes)`): historial de contactos y relaciones entre
terceros (son agregados con su flujo de eventos y su instantánea), solicitudes de acceso, requisitos por persona, motivos base, operadores de plataforma y los ids de idempotencia de
notificaciones, entregas de webhooks y consumo de IA. Para los agregados con eventos cambian `eventos.mt_streams.id`, `eventos.mt_events.stream_id`, el `id` y el `data` del documento y el
`data` de los eventos que citan el id. El cálculo en SQL replica la forma de `new Guid(bytes)` de .NET (los tres primeros grupos en little-endian) y conviene validarlo recalculando primero los ids
viejos y comparándolos con los guardados. El esquema del SQL es este (el rótulo viejo se arma por concatenación):

```sql
create function pg_temp.g(b bytea) returns uuid language sql immutable as $$
  select encode(substring(b from 4 for 1)||substring(b from 3 for 1)||substring(b from 2 for 1)||substring(b from 1 for 1)||
                substring(b from 6 for 1)||substring(b from 5 for 1)||substring(b from 8 for 1)||substring(b from 7 for 1)||substring(b from 9 for 8), 'hex')::uuid $$;
-- Por cada agregado: viejo = g(sha256('ava' || 'lasoft' || ':historial-de-contactos:' || <terceroId sin guiones>)), nuevo = g(sha256('validalo:historial-de-contactos:' || ...)).
-- Luego: copiar la fila de mt_streams con el id nuevo, mover mt_events.stream_id, borrar la fila vieja y reemplazar el id en el documento y en los eventos.
```

Los ids de notificaciones, entregas y consumo de IA solo evitan duplicados al reprocesar un mismo evento; una base que los tenga y reprocese eventos viejos
generaría duplicados, no perdería datos. Los motivos base no se citan desde ningún dato guardado.

**Secretos cifrados con la clave maestra.** Los textos `vs1.`, `vs2.` (clave general y de grupo) y `vg1.` (campos del grupo) se cifran con AES-256-GCM usando el
nombre del producto como parte de los datos asociados (y, en `vg1`, también como rótulo del HKDF). Con el nombre nuevo, lo ya guardado no se puede descifrar: hay
que descifrarlo con los rótulos anteriores y volverlo a cifrar con los nuevos (mismo `kid`, nonce nuevo). Los rótulos vigentes son:

| Formato | Datos asociados (AAD) | Rótulo del HKDF |
|---|---|---|
| `vs1.{kid}.…` | `validalo:secretos:v1\|{kid}` | — (usa la clave maestra directa) |
| `vs2.{kid}.…` | `validalo:secretos:v2\|{kid}\|{grupo N}` | `validalo:secretos-grupo:v1\|` + id del grupo |
| `vg1.{kid}.…` | `validalo:campo:v1\|{kid}\|{tenant N}` | `validalo:campo-de-grupo:v1` (sal = bytes del tenant) |

Los rótulos anteriores son los mismos textos con el nombre anterior en lugar de `validalo`. Mientras no se haga el recifrado, la API reporta esos secretos como ilegibles
(«ninguna clave configurada puede leer…») sin perderlos. Una base de desarrollo sin secretos reales (la mayoría) no necesita nada: se vuelven a configurar.

### 2.4 Lo que queda con el nombre anterior a propósito

En una base migrada, y solo como datos: el contenido sellado de los certificados emitidos y sus eventos de emisión, las versiones de textos legales ya publicadas, y los correos
de las personas cuyo dominio lo contiene. No se reescriben (ver «Lo que NO se reescribe»). La base `vs_manual_ficha` (la del manual) es desechable: basta la migración de tipos
de la sección 2.2, o recrearla.

### 2.5 Datos del navegador

`localStorage` y `sessionStorage` usan claves con el nombre del producto (`validalo:preferencias`, `validalo:embebido`): al abrir la app tras el renombre las preferencias
guardadas (por ejemplo el tema) vuelven a sus valores por omisión.

## 3. Cómo se verificó

- `dotnet build Validalo.slnx`: 0 errores y 0 advertencias (`TreatWarningsAsErrors`); `dotnet test` de dominio, del SDK, del adaptador del Portal y de integración (PostgreSQL y MinIO con Testcontainers).
- `pnpm install`, `pnpm typecheck`, `pnpm lint` y `pnpm test` completos.
- Una búsqueda del nombre anterior, sin distinguir mayúsculas, en el contenido (`git grep -i`) y en los nombres de archivos y carpetas (`git ls-files`) no encuentra nada.
