# API · Invitaciones

14 operaciones en 2 recursos.

## Invitaciones

Invitar a un tercero a mano desde la app (decisión IM): el formulario de «Invitar tercero» hace **exactamente lo que hace una fila del lote**, sin esperar a un archivo. Comparte las dos mitades del lote: la validación por fila (`ValidacionDeLote`: la misma identificación multipaís, el mismo tipo de vínculo activo, el mismo flujo, el mismo correo) y el procesamiento (`ProcesarTandaDeLoteHandler.InvitarAsync`: crea o reutiliza el tercero, crea el vínculo e invita, o reenvía la invitación del vínculo que aún no acepta), sin duplicar ni una regla.

### `POST /api/v1/invitaciones`

**Invitar tercero.** Invita a un tercero (`vinculos:escribir`, con `Idempotency-Key`): 201 con `Accion = Invitado` si el vínculo es nuevo; 200 con `Reinvitado` (el vínculo ya existía y aún no aceptaba: se reenvió al correo indicado) o `SinCambios` (el tercero ya aceptó: no se reenvía). Con un tipo de vínculo que exige aprobación antes de invitar (decisión AI) la invitación queda retenida (`PorAprobar = true`) hasta que otra persona la apruebe: no sale ningún correo. Si el tercero no existía en la plataforma se registra con estos datos; si ya existe no se tocan sus datos maestros (P-1-7). 422 con el primer error en `codigo` y todos por campo en `errores` (`campo`, `codigo`, `mensaje`: los mismos de la vista previa de un lote), 422 `sin-aprobadores-de-invitacion` y `vigencia-invalida`; 409 `vinculo-no-invitable` (bloqueado o terminado) e `invitacion-por-aprobar` (ya espera a quien apruebe) con el `vinculoId` existente.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `invitarTercero`**

**Cuerpo de la petición** (`application/json`, InvitarTerceroDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `pais` | texto o null | no |  |
| `tipoIdentificacion` | texto o null | no |  |
| `numeroIdentificacion` | texto o null | no |  |
| `digitoVerificacion` | texto o null | no |  |
| `tipoPersona` | texto o null | no |  |
| `nombre` | texto o null | no |  |
| `nombreComercial` | texto o null | no |  |
| `correo` | texto o null | no |  |
| `tipoVinculo` | texto o null | no |  |
| `flujo` | texto o null | no |  |
| `contacto` | texto o null | no |  |
| `telefono` | texto o null | no |  |
| `vigenciaHoras` | entero | no | por omisión 168 |

**Respuestas**

- `200` OK — InvitacionDeTerceroDto
- `201` Creado — InvitacionDeTerceroDto

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `accion` | texto | sí |  |
| `terceroId` | uuid | sí |  |
| `vinculoId` | uuid | sí |  |
| `terceroCreado` | booleano | sí |  |
| `porAprobar` | booleano | sí |  |
| `detalle` | texto o null | no |  |

Campos de la respuesta `201`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `accion` | texto | sí |  |
| `terceroId` | uuid | sí |  |
| `vinculoId` | uuid | sí |  |
| `terceroCreado` | booleano | sí |  |
| `porAprobar` | booleano | sí |  |
| `detalle` | texto o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"pais":"CO","tipoIdentificacion":"900123456","numeroIdentificacion":"900123456","digitoVerificacion":"texto","tipoPersona":"texto","nombre":"Constructora Norte S.A.S.","nombreComercial":"Constructora Norte S.A.S.","correo":"contacto@empresa.co","tipoVinculo":"texto","flujo":"texto","contacto":"texto","telefono":"+57 601 555 1234","vigenciaHoras":168}'
```

Respuesta `200`:

```json
{
  "accion": "texto",
  "terceroId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "terceroCreado": true,
  "porAprobar": true,
  "detalle": "Texto de ejemplo."
}
```

</details>

## Lotes

Invitación masiva por lote de la empresa activa (H8, paridad con `Features/InvitacionLote` del SRM; LT-5…LT-10): plantilla descargable, vista previa con la validación por fila, creación (202, se procesa por tandas en segundo plano), consulta con su avance y sus filas, pausa, reanudación, cancelación, reintento de las fallidas e informe en Excel. Leer pide `vinculos:leer`; todo lo demás, `vinculos:escribir` (como la invitación individual).

### `GET /api/v1/invitaciones/lotes`

**Listar lotes.** Lotes de la empresa, del más reciente al más antiguo; cursor opaco. `estado` filtra por el estado del lote (`PorAprobar` es la bandeja de quienes aprueban lotes, decisión AI); cada lote por aprobar dice `puedesDecidir`.

**Permiso vinculos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarLotes`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `estado` | query | texto | no |  |
| `limite` | query | entero | no |  |
| `cursor` | query | texto | no |  |

**Respuestas**

- `200` OK — PaginaDtoOfLoteDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `datos` | lista de LoteDto | sí |  |
| `datos[].id` | uuid | sí |  |
| `datos[].nombre` | texto | sí |  |
| `datos[].archivo` | texto o null | no |  |
| `datos[].estado` | EstadoLote (texto) | sí | valores: Procesando · Pausado · Completado · CompletadoConErrores · Cancelado · PorAprobar |
| `datos[].totales` | TotalesLoteDto | sí |  |
| `datos[].totales.filas` | entero | sí |  |
| `datos[].totales.procesadas` | entero | sí |  |
| `datos[].totales.pendientes` | entero | sí |  |
| `datos[].totales.exitosas` | entero | sí |  |
| `datos[].totales.fallidas` | entero | sí |  |
| `datos[].totales.duplicadas` | entero | sí |  |
| `datos[].totales.invalidas` | entero | sí |  |
| `datos[].vigenciaHoras` | entero | sí |  |
| `datos[].creadoPor` | texto | sí |  |
| `datos[].creadoEn` | fecha y hora | sí |  |
| `datos[].actualizadoEn` | fecha y hora | sí |  |
| `datos[].terminadoEn` | fecha y hora o null | no |  |
| `datos[].reintentos` | entero | sí |  |
| `datos[].version` | entero | sí |  |
| `datos[].tiposPorAprobar` | lista de texto o null | no |  |
| `datos[].aprobadoPor` | texto o null | no |  |
| `datos[].aprobadoEn` | fecha y hora o null | no |  |
| `datos[].motivoDeRechazo` | texto o null | no |  |
| `datos[].puedesDecidir` | booleano o null | no |  |
| `siguienteCursor` | texto o null | no |  |

**Errores de negocio que lanza**

- `422` `estado-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/invitaciones/lotes" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "datos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "archivo": "texto",
      "estado": "Procesando",
      "totales": {
        "filas": 1,
        "procesadas": 1,
        "pendientes": 1,
        "exitosas": 1,
        "fallidas": 1,
        "duplicadas": 1,
        "invalidas": 1
      },
      "vigenciaHoras": 1,
      "creadoPor": "texto",
      "creadoEn": "2026-11-12T15:00:00Z",
      "actualizadoEn": "2026-11-12T15:00:00Z",
      "terminadoEn": "2026-11-12T15:00:00Z",
      "reintentos": 1,
      "version": 1,
      "tiposPorAprobar": [
        "texto"
      ],
      "aprobadoPor": "texto",
      "aprobadoEn": "2026-11-12T15:00:00Z",
      "motivoDeRechazo": "Texto de ejemplo.",
      "puedesDecidir": true
    }
  ],
  "siguienteCursor": "texto"
}
```

</details>

### `POST /api/v1/invitaciones/lotes`

**Crear lote.** Crea el lote con todas sus filas (las inválidas y duplicadas quedan registradas sin procesarse) y encola la primera tanda en la misma transacción (202). 422 `lote-sin-filas-validas`, `lote-demasiado-grande`, `archivo-o-filas`.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `crearLote`**

**Cuerpo de la petición** (`application/json`, CrearLoteDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombre` | texto o null | no |  |
| `archivo` | ArchivoDeLoteDto o null | no |  |
| `archivo.nombre` | texto | sí |  |
| `archivo.contenidoBase64` | texto | sí |  |
| `filas` | lista de FilaDeLoteEntradaDto o null | no |  |
| `filas[].pais` | texto o null | no |  |
| `filas[].tipoIdentificacion` | texto o null | no |  |
| `filas[].numeroIdentificacion` | texto o null | no |  |
| `filas[].digitoVerificacion` | texto o null | no |  |
| `filas[].tipoPersona` | texto o null | no |  |
| `filas[].nombre` | texto o null | no |  |
| `filas[].nombreComercial` | texto o null | no |  |
| `filas[].correo` | texto o null | no |  |
| `filas[].tipoVinculo` | texto o null | no |  |
| `filas[].flujo` | texto o null | no |  |
| `filas[].contacto` | texto o null | no |  |
| `filas[].telefono` | texto o null | no |  |
| `vigenciaHoras` | entero | no | por omisión 168 |

**Respuestas**

- `202` Aceptado — LoteDto

Campos de la respuesta `202`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `nombre` | texto | sí |  |
| `archivo` | texto o null | no |  |
| `estado` | EstadoLote (texto) | sí | valores: Procesando · Pausado · Completado · CompletadoConErrores · Cancelado · PorAprobar |
| `totales` | TotalesLoteDto | sí |  |
| `totales.filas` | entero | sí |  |
| `totales.procesadas` | entero | sí |  |
| `totales.pendientes` | entero | sí |  |
| `totales.exitosas` | entero | sí |  |
| `totales.fallidas` | entero | sí |  |
| `totales.duplicadas` | entero | sí |  |
| `totales.invalidas` | entero | sí |  |
| `vigenciaHoras` | entero | sí |  |
| `creadoPor` | texto | sí |  |
| `creadoEn` | fecha y hora | sí |  |
| `actualizadoEn` | fecha y hora | sí |  |
| `terminadoEn` | fecha y hora o null | no |  |
| `reintentos` | entero | sí |  |
| `version` | entero | sí |  |
| `tiposPorAprobar` | lista de texto o null | no |  |
| `aprobadoPor` | texto o null | no |  |
| `aprobadoEn` | fecha y hora o null | no |  |
| `motivoDeRechazo` | texto o null | no |  |
| `puedesDecidir` | booleano o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Constructora Norte S.A.S.","archivo":{"nombre":"Constructora Norte S.A.S.","contenidoBase64":"Texto de ejemplo."},"filas":[{"pais":"CO","tipoIdentificacion":"900123456","numeroIdentificacion":"900123456","digitoVerificacion":"texto","tipoPersona":"texto","nombre":"Constructora Norte S.A.S.","nombreComercial":"Constructora Norte S.A.S.","correo":"contacto@empresa.co","tipoVinculo":"texto","flujo":"texto","contacto":"texto","telefono":"+57 601 555 1234"}],"vigenciaHoras":168}'
```

Respuesta `202`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `GET /api/v1/invitaciones/lotes/{id}`

**Obtener lote.**

**Permiso vinculos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/aprobar`

**Aprobar lote.** Aprueba el lote completo (una sola decisión para todas sus filas, decisión AI): pasa a `Procesando` y se encola la primera tanda; las invitaciones de sus filas salen sin pedir una aprobación por vínculo. Quien aprueba debe ser de quienes designó **cada** tipo que exige aprobación (403 `no-es-aprobador-de-invitaciones`), una persona (422 `usuario-delegado-requerido`) y no quien creó el lote (403 `separacion-de-funciones`); 409 `sin-lote-por-aprobar`.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `aprobarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/aprobar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/cancelar`

**Cancelar lote.** Cancela el lote: lo pendiente ya no se procesa (en el informe queda `Cancelada`). Terminal.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `cancelarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/cancelar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `GET /api/v1/invitaciones/lotes/{id}/filas`

**Listar filas lote.** Filas en orden, con filtro opcional por estado (`Pendiente`, `Exitosa`, `Fallida`, `Duplicada`, `Invalida`); el cursor es el número de la última fila leída.

**Permiso vinculos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarFilasLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `estado` | query | texto | no |  |
| `limite` | query | entero | no |  |
| `cursor` | query | texto | no |  |

**Respuestas**

- `200` OK — PaginaDtoOfFilaLoteDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `datos` | lista de FilaLoteDto | sí |  |
| `datos[].n` | entero | sí |  |
| `datos[].identificacion` | texto | sí |  |
| `datos[].nombre` | texto o null | no |  |
| `datos[].correo` | texto o null | no |  |
| `datos[].tipoVinculo` | texto o null | no |  |
| `datos[].estado` | EstadoFilaLote (texto) | sí | valores: Pendiente · Exitosa · Fallida · Duplicada · Invalida · Cancelada |
| `datos[].accion` | texto o null | no |  |
| `datos[].detalle` | texto o null | no |  |
| `datos[].errores` | lista de ErrorDeFilaDto | sí |  |
| `datos[].errores[].campo` | texto o null | no |  |
| `datos[].errores[].codigo` | texto | sí |  |
| `datos[].errores[].mensaje` | texto | sí |  |
| `datos[].duplicadaDe` | entero o null | no |  |
| `datos[].terceroId` | uuid o null | no |  |
| `datos[].vinculoId` | uuid o null | no |  |
| `datos[].terceroCreado` | booleano | sí |  |
| `datos[].intentos` | entero | sí |  |
| `datos[].procesadaEn` | fecha y hora o null | no |  |
| `siguienteCursor` | texto o null | no |  |

**Errores de negocio que lanza**

- `422` `cursor-invalido`
- `422` `estado-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/filas" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "datos": [
    {
      "n": 1,
      "identificacion": "900123456",
      "nombre": "Constructora Norte S.A.S.",
      "correo": "contacto@empresa.co",
      "tipoVinculo": "texto",
      "estado": "Pendiente",
      "accion": "texto",
      "detalle": "Texto de ejemplo.",
      "errores": [
        {
          "campo": "texto",
          "codigo": "CODIGO_EJEMPLO",
          "mensaje": "Texto de ejemplo."
        }
      ],
      "duplicadaDe": 1,
      "terceroId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "terceroCreado": true,
      "intentos": 1,
      "procesadaEn": "2026-11-12T15:00:00Z"
    }
  ],
  "siguienteCursor": "texto"
}
```

</details>

### `GET /api/v1/invitaciones/lotes/{id}/informe`

**Descargar informe lote.** Informe por fila en Excel: identificación, datos, estado, acción, errores y el vínculo creado o reutilizado.

**Permiso vinculos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `descargarInformeLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — el contrato publica esta respuesta sin esquema (`IResult`)
- `404` No encontrado

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/informe" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/pausar`

**Pausar lote.** Pausa el procesamiento (la fila en curso termina). 409 `estado-invalido` o `lote-en-estado-terminal`.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `pausarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/pausar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/reanudar`

**Reanudar lote.** Reanuda un lote pausado: sigue con las filas pendientes.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `reanudarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/reanudar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/rechazar`

**Rechazar lote.** Rechaza el lote completo con un motivo (422 `motivo-requerido`): queda `Cancelado`, ninguna fila se procesa y nunca se le escribió a ningún tercero. Las mismas reglas de quién decide que al aprobarlo.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `rechazarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, MotivoDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `motivo` | texto | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/rechazar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"motivo":"Texto de ejemplo."}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `POST /api/v1/invitaciones/lotes/{id}/reintentar`

**Reintentar lote.** Vuelve a procesar las filas fallidas de un lote terminado (solo ellas). 409 `sin-filas-fallidas`, `estado-invalido` (aún en proceso) o `lote-en-estado-terminal` (cancelado).

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `reintentarLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — LoteDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `LoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/3fa85f64-5717-4562-b3fc-2c963f66afa6/reintentar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "archivo": "texto",
  "estado": "Procesando",
  "totales": {
    "filas": 1,
    "procesadas": 1,
    "pendientes": 1,
    "exitosas": 1,
    "fallidas": 1,
    "duplicadas": 1,
    "invalidas": 1
  },
  "vigenciaHoras": 1,
  "creadoPor": "texto",
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "terminadoEn": "2026-11-12T15:00:00Z",
  "reintentos": 1,
  "version": 1,
  "tiposPorAprobar": [
    "texto"
  ],
  "aprobadoPor": "texto",
  "aprobadoEn": "2026-11-12T15:00:00Z",
  "motivoDeRechazo": "Texto de ejemplo.",
  "puedesDecidir": true
}
```

</details>

### `GET /api/v1/invitaciones/lotes/plantilla`

**Descargar plantilla lote.** Plantilla vacía (`formato=xlsx` por omisión, o `csv` separado por punto y coma). El Excel es la **plantilla de la empresa activa**: hoja «Invitaciones» con el encabezado de marca (obligatorias con asterisco y nota de ayuda), listas desplegables con los países, los tipos de identificación del país elegido, el tipo de persona, los tipos de vínculo activos de la empresa y sus flujos publicados (como «Nombre (CÓDIGO)»; el importador entiende los dos), una hoja «Instrucciones» y la hoja oculta «Listas». El importador y la vista previa leen la primera hoja, igual que siempre.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `descargarPlantillaLote`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `formato` | query | texto | no |  |

**Respuestas**

- `200` OK — el contrato publica esta respuesta sin esquema (`IResult`)
- `404` No encontrado

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/invitaciones/lotes/plantilla" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

</details>

### `POST /api/v1/invitaciones/lotes/vista-previa`

**Previsualizar lote.** Valida el archivo o las filas sin crear nada: por fila, sus errores, si repite una anterior y qué se hará (invitar, reenviar o nada porque el tercero ya aceptó). 422 si el archivo no se puede leer o le faltan columnas.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `previsualizarLote`**

**Cuerpo de la petición** (`application/json`, CrearLoteDto)

Mismos campos de `CrearLoteDto` que se detallan en `POST /api/v1/invitaciones/lotes`.

**Respuestas**

- `200` OK — VistaPreviaLoteDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `archivo` | texto o null | no |  |
| `total` | entero | sí |  |
| `validas` | entero | sí |  |
| `invalidas` | entero | sí |  |
| `duplicadas` | entero | sí |  |
| `filas` | lista de FilaVistaPreviaDto | sí |  |
| `filas[].n` | entero | sí |  |
| `filas[].datos` | FilaDeLoteEntradaDto | sí |  |
| `filas[].datos.pais` | texto o null | no |  |
| `filas[].datos.tipoIdentificacion` | texto o null | no |  |
| `filas[].datos.numeroIdentificacion` | texto o null | no |  |
| `filas[].datos.digitoVerificacion` | texto o null | no |  |
| `filas[].datos.tipoPersona` | texto o null | no |  |
| `filas[].datos.nombre` | texto o null | no |  |
| `filas[].datos.nombreComercial` | texto o null | no |  |
| `filas[].datos.correo` | texto o null | no |  |
| `filas[].datos.tipoVinculo` | texto o null | no |  |
| `filas[].datos.flujo` | texto o null | no |  |
| `filas[].datos.contacto` | texto o null | no |  |
| `filas[].datos.telefono` | texto o null | no |  |
| `filas[].estado` | texto | sí |  |
| `filas[].errores` | lista de ErrorDeFilaDto | sí |  |
| `filas[].errores[].campo` | texto o null | no |  |
| `filas[].errores[].codigo` | texto | sí |  |
| `filas[].errores[].mensaje` | texto | sí |  |
| `filas[].duplicadaDe` | entero o null | no |  |
| `filas[].accionPrevista` | texto o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/invitaciones/lotes/vista-previa" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Constructora Norte S.A.S.","archivo":{"nombre":"Constructora Norte S.A.S.","contenidoBase64":"Texto de ejemplo."},"filas":[{"pais":"CO","tipoIdentificacion":"900123456","numeroIdentificacion":"900123456","digitoVerificacion":"texto","tipoPersona":"texto","nombre":"Constructora Norte S.A.S.","nombreComercial":"Constructora Norte S.A.S.","correo":"contacto@empresa.co","tipoVinculo":"texto","flujo":"texto","contacto":"texto","telefono":"+57 601 555 1234"}],"vigenciaHoras":168}'
```

Respuesta `200`:

```json
{
  "archivo": "texto",
  "total": 1,
  "validas": 1,
  "invalidas": 1,
  "duplicadas": 1,
  "filas": [
    {
      "n": 1,
      "datos": {
        "pais": "CO",
        "tipoIdentificacion": "900123456",
        "numeroIdentificacion": "900123456",
        "digitoVerificacion": "texto",
        "tipoPersona": "texto",
        "nombre": "Constructora Norte S.A.S.",
        "nombreComercial": "Constructora Norte S.A.S.",
        "correo": "contacto@empresa.co",
        "tipoVinculo": "texto",
        "flujo": "texto",
        "contacto": "texto",
        "telefono": "+57 601 555 1234"
      },
      "estado": "texto",
      "errores": [
        {
          "campo": "texto",
          "codigo": "CODIGO_EJEMPLO",
          "mensaje": "Texto de ejemplo."
        }
      ],
      "duplicadaDe": 1,
      "accionPrevista": "texto"
    }
  ]
}
```

</details>
