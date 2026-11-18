# 17 — Renombre a AvalaSoft y migración de los datos locales (2026-11-18)

> **Para qué sirve:** dejar escrito qué cambió cuando el nombre anterior desapareció de todo el repositorio (código, rutas,
> paquetes, configuración, contrato de la API, documentos y CI) y cómo se llevan al nombre nuevo los datos que cada
> desarrollador tiene en su máquina (PostgreSQL, MinIO, Docker). El nombre anterior no se escribe en este documento a
> propósito: se lo llama «el nombre anterior» o `<anterior>`.

## 1. Qué cambió

El mapa es mecánico, respetando la forma de cada caso:

| Antes (`<anterior>`) | Ahora | Dónde |
|---|---|---|
| `<Anterior>` en PascalCase | `Avalasoft` | Proyectos y carpetas .NET (`src/Avalasoft.Api`, `Avalasoft.Aplicacion`, `Avalasoft.slnx`…), espacios de nombres, clases (`ClienteAvalasoft`, `ExcepcionAvalasoft`, `OpcionesAvalasoft`), componentes del tema (`createAvalasoftTheme`) |
| `<anterior>` en minúsculas | `avalasoft` | Paquetes npm (`@avalasoft/web`, `@avalasoft/sdk`…), sección de configuración, base de datos, usuarios, `aud`, ids, rutas (`/.well-known/avalasoft-certificados.json`), esquema del contenido canónico de los certificados nuevos (`avalasoft.certificado.v1`), tipos de `postMessage` (`avalasoft:sesion`, `avalasoft:ready`) |
| `<ANTERIOR>` en mayúsculas | `AVALASOFT` | Variables de entorno de scripts y SDK (`AVALASOFT_API_KEY`, `AVALASOFT_API_URL`…) |
| Cabeceras HTTP | `Avalasoft-Signature`, `Avalasoft-Event-Id`, `Avalasoft-Event-Type`, `Avalasoft-Timestamp`, `Avalasoft-Delivery`, `X-Avalasoft-Cliente`… | API y webhooks |
| Nombre del producto en prosa | **AvalaSoft** | Documentos, comentarios, textos de pantalla |
| Prefijos cortos (`vs-`, `Vs`) | sin cambio | Son abreviaturas internas |

Variables de entorno de configuración: `Avalasoft__Grupo__Nombre` y `ConnectionStrings__Avalasoft` (antes, con el nombre anterior en
ambos casos). **Quien las tenga fijadas en su máquina o en un despliegue debe renombrarlas**; si no, la API arranca con los valores por omisión
y falla al pedir la cadena de conexión.

### Contrato de la API (cambio visible para los integradores)

El renombre toca el contrato publicado: cabeceras de webhooks y de cliente, la ruta de claves públicas de los certificados, la
audiencia (`aud`) de la aserción de identidad delegada, los reclamos de la sesión directa (`avalasoft:sesion-id`, `avalasoft:metodo`) y
los tipos de mensaje del puente embebido. Los sistemas integrados (SRM, Marco, Portal, sistemas de clientes) tienen que
actualizarse con el SDK nuevo (`Avalasoft.Contratos`, `Avalasoft.Sdk`, `@avalasoft/sdk`). Las sesiones cortas emitidas antes del renombre dejan de
valer (el reclamo cambió de nombre): las personas vuelven a iniciar sesión.

### Lo que NO se reescribe

- **Certificados ya emitidos.** Su contenido canónico está sellado (hash y firma Ed25519) y dice `esquema` con el valor del nombre
  anterior. No se toca: reescribirlo invalidaría la firma. La verificación pública recalcula el hash sobre lo guardado y no compara el
  esquema contra una lista, así que siguen verificándose. Los certificados nuevos salen con `avalasoft.certificado.v1`.
- **Eventos y textos legales ya guardados** (por ejemplo la versión 1 del aviso de la plataforma, sembrada con el nombre anterior en su
  texto): son historia. Una aceptación apunta a un texto concreto; si se quiere el nombre nuevo, se publica una versión nueva del texto.
- **Datos de personas** (correos, dominios) que casualmente contengan la cadena: son datos, no configuración.

### URL del repositorio de GitHub

El repositorio remoto conserva su nombre actual (renombrarlo es un paso manual en GitHub y no es contenido del repositorio). Por eso
ningún archivo versionado escribe esa URL:

- `src/Empaquetado.props` arma `RepositoryUrl` y `PackageProjectUrl` con `GITHUB_REPOSITORY` cuando el paquete se empaqueta en GitHub Actions.
- `packages/sdk/package.json` ya no trae `homepage`, `bugs` ni `repository`; el workflow `sdk-publicar.yml` los fija antes de empaquetar con
  `npm pkg set` y el mismo `GITHUB_REPOSITORY` (la procedencia de npm sigue coincidiendo con el repositorio real).
- Los README de los paquetes apuntan a `docs/integracion.md` sin enlace absoluto.

## 2. Migración de los datos locales

Todo lo de esta sección se hace una vez por máquina de desarrollo, con la API y las apps detenidas. Es lo que se hizo en la máquina
de Mateo; el orden importa.

### 2.1 PostgreSQL y MinIO en Docker

El nombre del proyecto de Compose (`name:` de `infra/compose/compose.yaml`) pasó de `<anterior>` a `avalasoft`, así que Docker crea volúmenes,
red y contenedores nuevos (`avalasoft_postgres-datos`, `avalasoft_minio-datos`, `avalasoft-postgres-1`…) y no ve los viejos. Para conservar los datos:

```bash
# 1. Detener el entorno viejo SIN -v (los volúmenes se conservan).
docker compose -p <anterior> -f infra/compose/compose.yaml --profile e2e --profile app down

# 2. Crear contenedores y volúmenes nuevos sin arrancarlos.
docker compose -f infra/compose/compose.yaml --profile e2e up --no-start

# 3. Copiar los datos (cp -a conserva dueños y permisos; los volúmenes viejos quedan intactos).
docker run --rm -v <anterior>_postgres-datos:/desde:ro -v avalasoft_postgres-datos:/hacia alpine sh -c 'cp -a /desde/. /hacia/'
docker run --rm -v <anterior>_minio-datos:/desde:ro    -v avalasoft_minio-datos:/hacia    alpine sh -c 'cp -a /desde/. /hacia/'

# 4. Levantar PostgreSQL y renombrar la base y el rol (la imagen de PostgreSQL solo usa POSTGRES_DB/USER al crear el
#    clúster; con datos copiados hay que renombrarlos a mano). Un rol no puede renombrarse a sí mismo: se usa uno temporal.
docker compose -f infra/compose/compose.yaml up -d postgres
docker exec avalasoft-postgres-1 psql -U <anterior> -d postgres -c "CREATE ROLE tmp_renombre SUPERUSER LOGIN"
docker exec avalasoft-postgres-1 psql -U tmp_renombre -d postgres \
  -c 'ALTER DATABASE "<anterior>" RENAME TO avalasoft' -c 'ALTER ROLE "<anterior>" RENAME TO avalasoft' -c "ALTER ROLE avalasoft PASSWORD 'avalasoft'"
docker exec avalasoft-postgres-1 psql -U avalasoft -d postgres -c "DROP ROLE tmp_renombre"

# 5. Migrar los tipos persistidos (sección 2.2) y levantar el resto.
docker compose -f infra/compose/compose.yaml --profile e2e up -d
```

MinIO toma sus credenciales de las variables `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (ahora `avalasoft` / `avalasoft-minio-solo-local`) y lee sin
problema los datos copiados: los buckets (`boveda`, `tenant-<id>`) nunca llevaron el nombre anterior. Mailpit no guarda nada en disco: los correos
de la bandeja se pierden al recrear el contenedor.

Cuando todo funcione, los volúmenes viejos (`<anterior>_postgres-datos`, `<anterior>_minio-datos`) y los de CI local (`<anterior>-ci-*`,
`<anterior>-cilocal-*`, que pasan a llamarse `avalasoft-ci-*` y `avalasoft-cilocal-*`) se pueden borrar con `docker volume rm`. Hasta entonces sirven de respaldo.

### 2.2 Tipos persistidos por Marten y Wolverine

Marten guarda en `mt_dotnet_type` (documentos y eventos) el nombre completo de la clase y del ensamblado; Wolverine guarda en
`wolverine_*_envelopes.message_type` el nombre del mensaje y en `wolverine_node_assignments` la URI del agente, que lleva el nombre de la base de datos.
Todo eso incluía el nombre anterior. Las tablas y funciones de Marten se nombran por la clase (sin espacio de nombres), por eso no cambian. El SQL
siguiente arma el nombre anterior por concatenación (para no escribirlo en el repositorio), cuenta lo afectado y lo actualiza dentro de una
transacción; se corre una vez por base (`avalasoft` y, si existe, `vs_manual_ficha`):

```sql
begin;
create temp table _afectadas (tabla text, columna text, filas bigint);
do $$
declare
  viejo text := 'Valida' || 'soft';   nuevo text := 'Avala' || 'soft';
  viejo_min text := lower(viejo);     nuevo_min text := lower(nuevo);
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

Resultado en la base local de Mateo (`avalasoft`): 44 columnas y 576 filas actualizadas (158 eventos, 173 entradas de catálogo, 20 mensajes programados de Wolverine…);
el total de filas del esquema de la aplicación quedó igual antes y después (655 filas en 99 tablas), y el objeto de MinIO también (579 objetos en 141 buckets).

Si la base trae operadores de desarrollo sembrados con un correo del dominio anterior (`paula@<anterior>.local`), el script `pnpm semilla:plataforma` ahora usa
`paula@avalasoft.local`; en la base local se actualizó ese correo del operador para que coincida con `apps/web/.semilla.local.json` (que se renombró en el lugar,
sin versionarse).

### 2.3 Ids deterministas y secretos cifrados: el nombre anterior estaba dentro del hash

Hay dos familias de datos que se calculan a partir de una cadena fija que llevaba el nombre anterior. Renombrar el código sin migrarlas habría dejado datos
huérfanos o ilegibles, así que también se migraron en la base local:

**Ids deterministas** (los 16 primeros bytes de un SHA-256 de `<rótulo>:<datos>`, como `new Guid(bytes)`): historial de contactos y relaciones entre
terceros (son agregados con su flujo de eventos y su instantánea), solicitudes de acceso, requisitos por persona, motivos base y los ids de idempotencia de
notificaciones, entregas de webhooks y consumo de IA. Solo los dos primeros tenían datos en la base local (1 historial y 2 relaciones); para cada uno
cambiaron `eventos.mt_streams.id`, `eventos.mt_events.stream_id`, el `id` y el `data` del documento y el `data` de los eventos que citan el id.
El cálculo en SQL replica la forma de `new Guid(bytes)` de .NET (los tres primeros grupos en little-endian) y se validó recalculando primero los ids
viejos y comparándolos con los guardados (coincidieron todos). El esquema del SQL es este (el rótulo viejo se arma por concatenación):

```sql
create function pg_temp.g(b bytea) returns uuid language sql immutable as $$
  select encode(substring(b from 4 for 1)||substring(b from 3 for 1)||substring(b from 2 for 1)||substring(b from 1 for 1)||
                substring(b from 6 for 1)||substring(b from 5 for 1)||substring(b from 8 for 1)||substring(b from 7 for 1)||substring(b from 9 for 8), 'hex')::uuid $$;
-- Por cada agregado: viejo = g(sha256('Valida' || 'soft' || ':historial-de-contactos:' || <terceroId sin guiones>)), nuevo = g(sha256('avalasoft:historial-de-contactos:' || ...)).
-- Luego: copiar la fila de mt_streams con el id nuevo, mover mt_events.stream_id, borrar la fila vieja y reemplazar el id en el documento y en los eventos.
```

Los ids de notificaciones, entregas y consumo de IA solo evitan duplicados al reprocesar un mismo evento; una base que los tenga y reprocese eventos viejos
generaría duplicados, no perdería datos. Los motivos base no se citan desde ningún dato guardado (se comprobó en la base local).

**Secretos cifrados con la clave maestra.** Los textos `vs1.`, `vs2.` (clave general y de grupo) y `vg1.` (campos del grupo) se cifran con AES-256-GCM usando el
nombre del producto como parte de los datos asociados (y, en `vg1`, también como rótulo del HKDF). Con el nombre nuevo, lo ya guardado no se podría descifrar. En
la base local había **un número de cuenta bancaria** en cuatro copias (el documento de la cuenta, el del vínculo y dos eventos de cuenta designada): se descifró con la clave
maestra de desarrollo y los rótulos anteriores y se volvió a cifrar con los nuevos (mismo `kid`, nonce nuevo), y se comprobó que `ProtectorDeSecretos` y
`ProtectorDeCamposDelGrupo` (el código real) lo descifran. Los rótulos vigentes son:

| Formato | Datos asociados (AAD) | Rótulo del HKDF |
|---|---|---|
| `vs1.{kid}.…` | `avalasoft:secretos:v1\|{kid}` | — (usa la clave maestra directa) |
| `vs2.{kid}.…` | `avalasoft:secretos:v2\|{kid}\|{grupo N}` | `avalasoft:secretos-grupo:v1\|` + id del grupo |
| `vg1.{kid}.…` | `avalasoft:campo:v1\|{kid}\|{tenant N}` | `avalasoft:campo-de-grupo:v1` (sal = bytes del tenant) |

Una base con otros secretos (llaves de IA, secretos de webhooks, SSO) necesita el mismo recifrado: descifrar con el rótulo anterior (el mismo texto con el nombre
anterior en lugar de `avalasoft`) y cifrar con el vigente, conservando el `kid`. Mientras no se haga, la API los reporta como ilegibles
(«ninguna clave configurada puede leer…») sin perderlos.

### 2.4 Lo que queda con el nombre anterior a propósito

En la base local, y solo como datos: el contenido sellado de un certificado y su evento de emisión, la versión 1 del texto legal de la plataforma, y los correos
de las personas cuyo dominio lo contiene. No se reescriben (ver «Lo que NO se reescribe»). La base `vs_manual_ficha` (la del manual) recibió solo la migración de tipos
de la sección 2.2: sus ids deterministas y sus secretos no se migraron porque es desechable.

### 2.5 Datos del navegador

`localStorage` y `sessionStorage` usan claves con el nombre del producto (`avalasoft:preferencias`, `avalasoft:embebido`): al abrir la app tras el renombre las preferencias
guardadas (por ejemplo el tema) vuelven a sus valores por omisión.
