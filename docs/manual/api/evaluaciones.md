# API · Evaluaciones

28 operaciones en 5 recursos.

## Cuestionarios

Cuestionarios de evaluación del proveedor de la empresa activa (`X-Empresa`, CE-1): versionados como los flujos (el borrador se edita, publicar congela la versión), con secciones, preguntas de siete tipos, pesos, puntajes, eliminatorias, umbral de aprobación, quién responde y la reevaluación periódica. Privados de la empresa, también dentro de un grupo. Todo cambio deja registro de auditoría (R-1).

### `GET /api/v1/cuestionarios`

**Listar cuestionarios.**

**Permiso cuestionarios:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarCuestionarios`**

**Respuestas**

- `200` OK — lista de CuestionarioDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de CuestionarioDto | sí |  |
| `[].id` | uuid | sí |  |
| `[].empresaId` | uuid | sí |  |
| `[].codigo` | texto | sí |  |
| `[].nombre` | texto | sí |  |
| `[].publicada` | CuestionarioVersionDto o null | no |  |
| `[].publicada.id` | uuid | sí |  |
| `[].publicada.version` | entero | sí |  |
| `[].publicada.estado` | EstadoCuestionarioVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `[].publicada.definicion` | DefinicionDeCuestionarioDto | sí |  |
| `[].publicada.definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `[].publicada.definicion.secciones[].codigo` | texto o null | no |  |
| `[].publicada.definicion.secciones[].nombre` | texto | sí |  |
| `[].publicada.definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `[].publicada.definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `[].publicada.definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `[].publicada.definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `[].publicada.definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `[].publicada.definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `[].publicada.definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `[].publicada.definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `[].publicada.definicion.secciones[].preguntas[].condicion` |
| `[].publicada.definicion.secciones[].descripcion` | texto o null | no |  |
| `[].publicada.definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].publicada.definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `[].publicada.definicion.reevaluarCadaMeses` | entero o null | no |  |
| `[].publicada.definicion.descripcion` | texto o null | no |  |
| `[].publicada.creadaEn` | fecha y hora | sí |  |
| `[].publicada.publicadaEn` | fecha y hora o null | no |  |
| `[].publicada.retiradaEn` | fecha y hora o null | no |  |
| `[].borrador` | CuestionarioVersionDto o null | no | mismos campos que `[].publicada` |
| `[].creadoEn` | fecha y hora | sí |  |
| `[].actualizadoEn` | fecha y hora | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/cuestionarios" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S.",
    "publicada": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "version": 1,
      "estado": "Borrador",
      "definicion": {
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "preguntas": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "descripcion": "Texto de ejemplo."
          }
        ],
        "umbralDeAprobacion": 1,
        "responde": "Tercero",
        "reevaluarCadaMeses": 1,
        "descripcion": "Texto de ejemplo."
      },
      "creadaEn": "2026-11-12T15:00:00Z",
      "publicadaEn": "2026-11-12T15:00:00Z",
      "retiradaEn": "2026-11-12T15:00:00Z"
    },
    "borrador": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "version": 1,
      "estado": "Borrador",
      "definicion": {
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "preguntas": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "descripcion": "Texto de ejemplo."
          }
        ],
        "umbralDeAprobacion": 1,
        "responde": "Tercero",
        "reevaluarCadaMeses": 1,
        "descripcion": "Texto de ejemplo."
      },
      "creadaEn": "2026-11-12T15:00:00Z",
      "publicadaEn": "2026-11-12T15:00:00Z",
      "retiradaEn": "2026-11-12T15:00:00Z"
    },
    "creadoEn": "2026-11-12T15:00:00Z",
    "actualizadoEn": "2026-11-12T15:00:00Z"
  }
]
```

</details>

### `POST /api/v1/cuestionarios`

**Crear cuestionario.** Crea el cuestionario con su primera versión en borrador. 422: `codigo-invalido`, `nombre-requerido` y los de la definición; 409 `cuestionario-duplicado`.

**Permiso cuestionarios:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `crearCuestionario`**

**Cuerpo de la petición** (`application/json`, CrearCuestionarioDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `codigo` | texto | sí |  |
| `nombre` | texto | sí |  |
| `definicion` | DefinicionDeCuestionarioDto | sí |  |
| `definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `definicion.secciones[].codigo` | texto o null | no |  |
| `definicion.secciones[].nombre` | texto | sí |  |
| `definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `definicion.secciones[].preguntas[].condicion` |
| `definicion.secciones[].descripcion` | texto o null | no |  |
| `definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `definicion.reevaluarCadaMeses` | entero o null | no |  |
| `definicion.descripcion` | texto o null | no |  |

**Respuestas**

- `201` Creado — CuestionarioDto

Campos de la respuesta `201`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `empresaId` | uuid | sí |  |
| `codigo` | texto | sí |  |
| `nombre` | texto | sí |  |
| `publicada` | CuestionarioVersionDto o null | no |  |
| `publicada.id` | uuid | sí |  |
| `publicada.version` | entero | sí |  |
| `publicada.estado` | EstadoCuestionarioVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `publicada.definicion` | DefinicionDeCuestionarioDto | sí |  |
| `publicada.definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `publicada.definicion.secciones[].codigo` | texto o null | no |  |
| `publicada.definicion.secciones[].nombre` | texto | sí |  |
| `publicada.definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `publicada.definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `publicada.definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `publicada.definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `publicada.definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `publicada.definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `publicada.definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `publicada.definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `publicada.definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `publicada.definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `publicada.definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `publicada.definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `publicada.definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `publicada.definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `publicada.definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `publicada.definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `publicada.definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `publicada.definicion.secciones[].preguntas[].condicion` |
| `publicada.definicion.secciones[].descripcion` | texto o null | no |  |
| `publicada.definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `publicada.definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `publicada.definicion.reevaluarCadaMeses` | entero o null | no |  |
| `publicada.definicion.descripcion` | texto o null | no |  |
| `publicada.creadaEn` | fecha y hora | sí |  |
| `publicada.publicadaEn` | fecha y hora o null | no |  |
| `publicada.retiradaEn` | fecha y hora o null | no |  |
| `borrador` | CuestionarioVersionDto o null | no | mismos campos que `publicada` |
| `creadoEn` | fecha y hora | sí |  |
| `actualizadoEn` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `cuestionario-duplicado`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/cuestionarios" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"CODIGO_EJEMPLO","nombre":"Constructora Norte S.A.S.","definicion":{"secciones":[{"codigo":"CODIGO_EJEMPLO","nombre":"Constructora Norte S.A.S.","peso":1,"preguntas":[{"codigo":"CODIGO_EJEMPLO","texto":"Texto de ejemplo.","tipo":"SiNo","obligatoria":true,"peso":1,"eliminatoria":true,"opciones":[null],"escala":{"minimo":null,"maximo":null,"minimoAceptable":null},"rangos":[null],"condicion":{"tipo":null,"nodos":null,"atributo":null,"operador":null,"valores":null},"ayuda":"texto","permiteComentario":false}],"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"descripcion":"Texto de ejemplo."}],"umbralDeAprobacion":1,"responde":"Tercero","reevaluarCadaMeses":1,"descripcion":"Texto de ejemplo."}}'
```

Respuesta `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `GET /api/v1/cuestionarios/{id}`

**Obtener cuestionario.**

**Permiso cuestionarios:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — CuestionarioDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `CuestionarioDto` que se detallan en `POST /api/v1/cuestionarios`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `PUT /api/v1/cuestionarios/{id}`

**Editar cuestionario.** Edita el borrador (o abre uno nuevo con la versión siguiente); la versión publicada no cambia. Lo nulo conserva lo de la última versión.

**Permiso cuestionarios:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `editarCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, EditarCuestionarioDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombre` | texto o null | no |  |
| `definicion` | DefinicionDeCuestionarioDto o null | no |  |
| `definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `definicion.secciones[].codigo` | texto o null | no |  |
| `definicion.secciones[].nombre` | texto | sí |  |
| `definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `definicion.secciones[].preguntas[].condicion` |
| `definicion.secciones[].descripcion` | texto o null | no |  |
| `definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `definicion.reevaluarCadaMeses` | entero o null | no |  |
| `definicion.descripcion` | texto o null | no |  |

**Respuestas**

- `200` OK — CuestionarioDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `CuestionarioDto` que se detallan en `POST /api/v1/cuestionarios`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Constructora Norte S.A.S.","definicion":{"secciones":[{"codigo":"CODIGO_EJEMPLO","nombre":"Constructora Norte S.A.S.","peso":1,"preguntas":[{"codigo":"CODIGO_EJEMPLO","texto":"Texto de ejemplo.","tipo":"SiNo","obligatoria":true,"peso":1,"eliminatoria":true,"opciones":[null],"escala":{"minimo":null,"maximo":null,"minimoAceptable":null},"rangos":[null],"condicion":{"tipo":null,"nodos":null,"atributo":null,"operador":null,"valores":null},"ayuda":"texto","permiteComentario":false}],"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"descripcion":"Texto de ejemplo."}],"umbralDeAprobacion":1,"responde":"Tercero","reevaluarCadaMeses":1,"descripcion":"Texto de ejemplo."}}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /api/v1/cuestionarios/{id}/publicar`

**Publicar cuestionario.** Publica el borrador y retira la versión anterior (las evaluaciones ya asignadas conservan la que copiaron). 409 `sin-borrador`.

**Permiso cuestionarios:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `publicarCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — CuestionarioDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `CuestionarioDto` que se detallan en `POST /api/v1/cuestionarios`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6/publicar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /api/v1/cuestionarios/{id}/simular`

**Simular cuestionario.** Prueba la última versión (el borrador, si lo hay) con respuestas inventadas, sin guardar nada: el puntaje de cada sección y el total, las eliminatorias y el veredicto. Sirve para ajustar pesos y umbral antes de publicar. 422 con los mismos códigos que al responder (`pregunta-obligatoria`, `respuesta-invalida`…).

**Permiso cuestionarios:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `simularCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, SimularCuestionarioDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |
| `tipoPersona` | texto o null | no |  |
| `pais` | texto o null | no |  |
| `tipoVinculo` | texto o null | no |  |

**Respuestas**

- `200` OK — SimulacionDeCuestionarioDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `version` | entero | sí |  |
| `estado` | texto | sí |  |
| `resultado` | ResultadoDeEvaluacionDto | sí |  |
| `resultado.puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.umbral` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.aprobada` | booleano | sí |  |
| `resultado.calculada` | booleano | sí |  |
| `resultado.motivos` | lista de texto | sí |  |
| `resultado.eliminatorias` | lista de texto | sí |  |
| `resultado.secciones` | lista de PuntajeDeSeccionDto | sí |  |
| `resultado.secciones[].codigo` | texto | sí |  |
| `resultado.secciones[].nombre` | texto | sí |  |
| `resultado.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.secciones[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.secciones[].aplica` | booleano | sí |  |
| `resultado.preguntas` | lista de PreguntaCalificadaDto | sí |  |
| `resultado.preguntas[].codigo` | texto | sí |  |
| `resultado.preguntas[].visible` | booleano | sí |  |
| `resultado.preguntas[].respondida` | booleano | sí |  |
| `resultado.preguntas[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.preguntas[].elimina` | booleano | sí |  |
| `resultado.preguntas[].ajustada` | booleano | sí |  |

**Errores de negocio que lanza**

- `422` `tipo-persona-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6/simular" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"respuestas":[{"pregunta":"texto","opciones":["texto"],"numero":1,"texto":"Texto de ejemplo.","adjuntos":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"comentario":"Texto de ejemplo."}],"tipoPersona":"texto","pais":"CO","tipoVinculo":"texto"}'
```

Respuesta `200`:

```json
{
  "version": 1,
  "estado": "texto",
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  }
}
```

</details>

### `GET /api/v1/cuestionarios/{id}/versiones`

**Listar versiones cuestionario.**

**Permiso cuestionarios:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarVersionesCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — lista de CuestionarioVersionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de CuestionarioVersionDto | sí |  |
| `[].id` | uuid | sí |  |
| `[].version` | entero | sí |  |
| `[].estado` | EstadoCuestionarioVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `[].definicion` | DefinicionDeCuestionarioDto | sí |  |
| `[].definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `[].definicion.secciones[].codigo` | texto o null | no |  |
| `[].definicion.secciones[].nombre` | texto | sí |  |
| `[].definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `[].definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `[].definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `[].definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `[].definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `[].definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `[].definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `[].definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `[].definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `[].definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `[].definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `[].definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `[].definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `[].definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `[].definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `[].definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `[].definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `[].definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `[].definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `[].definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `[].definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `[].definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `[].definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `[].definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `[].definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `[].definicion.secciones[].preguntas[].condicion` |
| `[].definicion.secciones[].descripcion` | texto o null | no |  |
| `[].definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `[].definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `[].definicion.reevaluarCadaMeses` | entero o null | no |  |
| `[].definicion.descripcion` | texto o null | no |  |
| `[].creadaEn` | fecha y hora | sí |  |
| `[].publicadaEn` | fecha y hora o null | no |  |
| `[].retiradaEn` | fecha y hora o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6/versiones" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "definicion": {
      "secciones": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "peso": 1,
          "preguntas": [
            {
              "codigo": null,
              "texto": null,
              "tipo": null,
              "obligatoria": null,
              "peso": null,
              "eliminatoria": null,
              "opciones": null,
              "escala": null,
              "rangos": null,
              "condicion": null,
              "ayuda": null,
              "permiteComentario": null
            }
          ],
          "condicion": {
            "tipo": "texto",
            "nodos": [
              null
            ],
            "atributo": "texto",
            "operador": "texto",
            "valores": [
              null
            ]
          },
          "descripcion": "Texto de ejemplo."
        }
      ],
      "umbralDeAprobacion": 1,
      "responde": "Tercero",
      "reevaluarCadaMeses": 1,
      "descripcion": "Texto de ejemplo."
    },
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z"
  }
]
```

</details>

### `GET /api/v1/cuestionarios/{id}/versiones/{n}`

**Obtener version cuestionario.**

**Permiso cuestionarios:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerVersionCuestionario`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `n` | path | entero | sí |  |

**Respuestas**

- `200` OK — CuestionarioVersionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `version` | entero | sí |  |
| `estado` | EstadoCuestionarioVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `definicion` | DefinicionDeCuestionarioDto | sí |  |
| `definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `definicion.secciones[].codigo` | texto o null | no |  |
| `definicion.secciones[].nombre` | texto | sí |  |
| `definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `definicion.secciones[].preguntas[].condicion` |
| `definicion.secciones[].descripcion` | texto o null | no |  |
| `definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `definicion.reevaluarCadaMeses` | entero o null | no |  |
| `definicion.descripcion` | texto o null | no |  |
| `creadaEn` | fecha y hora | sí |  |
| `publicadaEn` | fecha y hora o null | no |  |
| `retiradaEn` | fecha y hora o null | no |  |

**Errores de negocio que lanza**

- `404` `version-no-encontrada`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/cuestionarios/3fa85f64-5717-4562-b3fc-2c963f66afa6/versiones/1" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "version": 1,
  "estado": "Borrador",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "creadaEn": "2026-11-12T15:00:00Z",
  "publicadaEn": "2026-11-12T15:00:00Z",
  "retiradaEn": "2026-11-12T15:00:00Z"
}
```

</details>

## Evaluaciones

Evaluaciones de proveedores de la empresa activa (CE-3…CE-12): las que pidió el flujo al abrir el expediente inicial, las que repite la reevaluación periódica y las que una persona asignó a mano. **Son privadas de la empresa**: otra empresa, del mismo grupo o de otro, recibe 404, y el tercero nunca ve el resultado. Quien responde es lo que dice el cuestionario (`Tercero` en `/public/v1`, `Evaluador` aquí); cada respuesta, recalificación, reapertura o anulación se guarda como evento con su actor.

### `GET /api/v1/evaluaciones`

**Listar evaluaciones.** Lista las evaluaciones de la empresa, las más recientes primero, con los filtros opcionales (`estado`: Pendiente|Calificada|Vencida|Anulada; `responde`: Tercero|Evaluador).

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarEvaluaciones`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | query | uuid | no |  |
| `expedienteId` | query | uuid | no |  |
| `cuestionarioId` | query | uuid | no |  |
| `estado` | query | texto | no |  |
| `responde` | query | texto | no |  |
| `limite` | query | entero | no |  |
| `cursor` | query | texto | no |  |

**Respuestas**

- `200` OK — PaginaDtoOfEvaluacionResumenDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `datos` | lista de EvaluacionResumenDto | sí |  |
| `datos[].id` | uuid | sí |  |
| `datos[].vinculoId` | uuid | sí |  |
| `datos[].expedienteId` | uuid o null | no |  |
| `datos[].folio` | texto o null | no |  |
| `datos[].tercero` | TerceroResumenDto | sí |  |
| `datos[].tercero.id` | uuid | sí |  |
| `datos[].tercero.nombre` | texto | sí |  |
| `datos[].tercero.identificacion` | texto | sí |  |
| `datos[].cuestionario` | texto | sí |  |
| `datos[].versionCuestionario` | entero | sí |  |
| `datos[].estado` | EstadoDeEvaluacion (texto) | sí | valores: Pendiente · Calificada · Vencida · Anulada |
| `datos[].responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `datos[].efecto` | EfectoDeLaEvaluacion (texto) | sí | valores: Observar · Bloquear |
| `datos[].motivo` | MotivoDeEvaluacion (texto) | sí | valores: Expediente · Reevaluacion · Manual |
| `datos[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `datos[].aprobada` | booleano o null | no |  |
| `datos[].asignadaEn` | fecha y hora | sí |  |
| `datos[].respondidaEn` | fecha y hora o null | no |  |
| `datos[].vigenteHasta` | fecha y hora o null | no |  |
| `siguienteCursor` | texto o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/evaluaciones" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "datos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "folio": "texto",
      "tercero": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "nombre": "Constructora Norte S.A.S.",
        "identificacion": "900123456"
      },
      "cuestionario": "texto",
      "versionCuestionario": 1,
      "estado": "Pendiente",
      "responde": "Tercero",
      "efecto": "Observar",
      "motivo": "Expediente",
      "puntaje": 1,
      "aprobada": true,
      "asignadaEn": "2026-11-12T15:00:00Z",
      "respondidaEn": "2026-11-12T15:00:00Z",
      "vigenteHasta": "2026-11-12T15:00:00Z"
    }
  ],
  "siguienteCursor": "texto"
}
```

</details>

### `GET /api/v1/evaluaciones/{id}`

**Obtener evaluacion.**

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — EvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `empresaId` | uuid | sí |  |
| `vinculoId` | uuid | sí |  |
| `expedienteId` | uuid o null | no |  |
| `folio` | texto o null | no |  |
| `tercero` | TerceroResumenDto | sí |  |
| `tercero.id` | uuid | sí |  |
| `tercero.nombre` | texto | sí |  |
| `tercero.identificacion` | texto | sí |  |
| `motivo` | MotivoDeEvaluacion (texto) | sí | valores: Expediente · Reevaluacion · Manual |
| `cuestionario` | CuestionarioDeEvaluacionDto | sí |  |
| `cuestionario.id` | uuid | sí |  |
| `cuestionario.versionId` | uuid | sí |  |
| `cuestionario.version` | entero | sí |  |
| `cuestionario.codigo` | texto | sí |  |
| `cuestionario.nombre` | texto | sí |  |
| `responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `efecto` | EfectoDeLaEvaluacion (texto) | sí | valores: Observar · Bloquear |
| `estado` | EstadoDeEvaluacion (texto) | sí | valores: Pendiente · Calificada · Vencida · Anulada |
| `definicion` | DefinicionDeCuestionarioDto | sí |  |
| `definicion.secciones` | lista de SeccionDeCuestionarioDto | sí |  |
| `definicion.secciones[].codigo` | texto o null | no |  |
| `definicion.secciones[].nombre` | texto | sí |  |
| `definicion.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas` | lista de PreguntaDeCuestionarioDto | sí |  |
| `definicion.secciones[].preguntas[].codigo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `definicion.secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].eliminatoria` | booleano | sí |  |
| `definicion.secciones[].preguntas[].opciones` | lista de OpcionDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `definicion.secciones[].preguntas[].opciones[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].opciones[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].escala` | EscalaDePreguntaDto o null | no |  |
| `definicion.secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `definicion.secciones[].preguntas[].escala.minimoAceptable` | entero o null | no |  |
| `definicion.secciones[].preguntas[].rangos` | lista de RangoDeNumeroDto o null | no |  |
| `definicion.secciones[].preguntas[].rangos[].desde` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].hasta` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.secciones[].preguntas[].rangos[].elimina` | booleano | no | por omisión false |
| `definicion.secciones[].preguntas[].condicion` | CondicionDto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.tipo` | texto | sí |  |
| `definicion.secciones[].preguntas[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `definicion.secciones[].preguntas[].condicion.atributo` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.operador` | texto o null | no |  |
| `definicion.secciones[].preguntas[].condicion.valores` | lista de texto o null | no |  |
| `definicion.secciones[].preguntas[].ayuda` | texto o null | no |  |
| `definicion.secciones[].preguntas[].permiteComentario` | booleano | no | por omisión false |
| `definicion.secciones[].condicion` | CondicionDto o null | no | mismos campos que `definicion.secciones[].preguntas[].condicion` |
| `definicion.secciones[].descripcion` | texto o null | no |  |
| `definicion.umbralDeAprobacion` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `definicion.responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `definicion.reevaluarCadaMeses` | entero o null | no |  |
| `definicion.descripcion` | texto o null | no |  |
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |
| `resultado` | ResultadoDeEvaluacionDto o null | no |  |
| `resultado.puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.umbral` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.aprobada` | booleano | sí |  |
| `resultado.calculada` | booleano | sí |  |
| `resultado.motivos` | lista de texto | sí |  |
| `resultado.eliminatorias` | lista de texto | sí |  |
| `resultado.secciones` | lista de PuntajeDeSeccionDto | sí |  |
| `resultado.secciones[].codigo` | texto | sí |  |
| `resultado.secciones[].nombre` | texto | sí |  |
| `resultado.secciones[].peso` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.secciones[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.secciones[].aplica` | booleano | sí |  |
| `resultado.preguntas` | lista de PreguntaCalificadaDto | sí |  |
| `resultado.preguntas[].codigo` | texto | sí |  |
| `resultado.preguntas[].visible` | booleano | sí |  |
| `resultado.preguntas[].respondida` | booleano | sí |  |
| `resultado.preguntas[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `resultado.preguntas[].elimina` | booleano | sí |  |
| `resultado.preguntas[].ajustada` | booleano | sí |  |
| `calificaciones` | lista de CalificacionDto | sí |  |
| `calificaciones[].numero` | entero | sí |  |
| `calificaciones[].origen` | texto | sí |  |
| `calificaciones[].resultado` | ResultadoDeEvaluacionDto | sí | mismos campos que `resultado` |
| `calificaciones[].justificacion` | texto o null | no |  |
| `calificaciones[].por` | ActorDeEvaluacionDto | sí |  |
| `calificaciones[].por.tipo` | texto | sí |  |
| `calificaciones[].por.id` | texto | sí |  |
| `calificaciones[].por.nombre` | texto o null | no |  |
| `calificaciones[].fecha` | fecha y hora | sí |  |
| `ajustes` | lista de AjusteDto | sí |  |
| `ajustes[].pregunta` | texto | sí |  |
| `ajustes[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `ajustes[].levantaEliminatoria` | booleano | no | por omisión false |
| `respondidaPor` | ActorDeEvaluacionDto o null | no | mismos campos que `calificaciones[].por` |
| `respondidaEn` | fecha y hora o null | no |  |
| `vigenteHasta` | fecha y hora o null | no |  |
| `intentos` | entero | sí |  |
| `recalificaciones` | entero | sí |  |
| `justificacion` | texto o null | no |  |
| `adjuntos` | lista de AdjuntoDeEvaluacionDto | sí |  |
| `adjuntos[].id` | uuid | sí |  |
| `adjuntos[].nombre` | texto | sí |  |
| `adjuntos[].tipoContenido` | texto | sí |  |
| `adjuntos[].tamano` | entero | sí |  |
| `adjuntos[].fecha` | fecha y hora | sí |  |
| `anterior` | uuid o null | no |  |
| `asignadaEn` | fecha y hora | sí |  |
| `actualizadaEn` | fecha y hora | sí |  |
| `version` | entero | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

### `PUT /api/v1/evaluaciones/{id}/adjuntos`

**Iniciar adjunto de evaluacion.** Paso 1 de la subida de un archivo de evidencia (PDF o imagen de hasta 15 MB). 422 `adjunto-invalido`; 409 `evaluacion-no-pendiente`.

**Permiso evaluaciones:responder · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `iniciarAdjuntoDeEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, IniciarAdjuntoDeEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombreArchivo` | texto | sí |  |
| `tamanoBytes` | entero | sí |  |
| `tipoMime` | texto | sí |  |

**Respuestas**

- `200` OK — CargaDeAdjuntoDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `cargaId` | uuid | sí |  |
| `carga` | InstruccionCargaDto | sí |  |
| `carga.metodo` | texto | sí |  |
| `carga.url` | texto | sí |  |
| `carga.cabeceras` | mapa de texto → texto | sí |  |
| `carga.expira` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `evaluacion-no-pendiente`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/adjuntos" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Content-Type: application/json" \
  -d '{"nombreArchivo":"Nombre de ejemplo","tamanoBytes":1,"tipoMime":"texto"}'
```

Respuesta `200`:

```json
{
  "cargaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "carga": {
    "metodo": "texto",
    "url": "https://ejemplo.co/recurso",
    "cabeceras": {
      "clave": "vsk_prueba_ejemplo"
    },
    "expira": "2026-11-12T15:00:00Z"
  }
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/adjuntos/{adjuntoId}/descarga`

**Descargar adjunto de evaluacion.** URL prefirmada (5 min) de un archivo de evidencia; la descarga queda en la auditoría. 404 `adjunto-no-encontrado`.

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `descargarAdjuntoDeEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `adjuntoId` | path | uuid | sí |  |

**Respuestas**

- `200` OK — DescargaEvidenciaDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `url` | texto | sí |  |
| `expira` | fecha y hora | sí |  |
| `nombreArchivo` | texto | sí |  |

**Errores de negocio que lanza**

- `404` `adjunto-no-encontrado`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/adjuntos/3fa85f64-5717-4562-b3fc-2c963f66afa6/descarga" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)"
```

Respuesta `200`:

```json
{
  "url": "https://ejemplo.co/recurso",
  "expira": "2026-11-12T15:00:00Z",
  "nombreArchivo": "Nombre de ejemplo"
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/adjuntos/{cargaId}/confirmar`

**Confirmar adjunto de evaluacion.** Paso 2: verifica el archivo y lo registra en la evaluación; se cita después en la respuesta de una pregunta de adjunto. 409 `archivo-no-cargado`; 422 `adjunto-invalido`.

**Permiso evaluaciones:responder · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `confirmarAdjuntoDeEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `cargaId` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ConfirmarAdjuntoDeEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombreArchivo` | texto | sí |  |

**Respuestas**

- `200` OK — AdjuntoDeEvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `nombre` | texto | sí |  |
| `tipoContenido` | texto | sí |  |
| `tamano` | entero | sí |  |
| `fecha` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `evaluacion-no-pendiente`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/adjuntos/3fa85f64-5717-4562-b3fc-2c963f66afa6/confirmar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"nombreArchivo":"Nombre de ejemplo"}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "tipoContenido": "Texto de ejemplo.",
  "tamano": 1,
  "fecha": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/anular`

**Anular evaluacion.** Anula la evaluación (el expediente deja de esperarla). 409 `evaluacion-cerrada`; 422 `justificacion-requerida`.

**Permiso evaluaciones:recalificar · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `anularEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, JustificacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `justificacion` | texto | sí |  |

**Respuestas**

- `200` OK — EvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `EvaluacionDto` que se detallan en `GET /api/v1/evaluaciones/{id}`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/anular" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"justificacion":"Texto de ejemplo."}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/reabrir`

**Reabrir evaluacion.** Devuelve la evaluación a pendiente para que se responda de nuevo (el resultado anterior queda en el historial). 409 `evaluacion-no-calificada`; 422 `justificacion-requerida`.

**Permiso evaluaciones:recalificar · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `reabrirEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, JustificacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `justificacion` | texto | sí |  |

**Respuestas**

- `200` OK — EvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `EvaluacionDto` que se detallan en `GET /api/v1/evaluaciones/{id}`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/reabrir" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"justificacion":"Texto de ejemplo."}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/recalificar`

**Recalificar evaluacion.** Recalifica con justificación (obligatoria): ajusta el puntaje de preguntas, levanta eliminatorias y/o fija el veredicto a mano. Deja una calificación nueva en el historial; la anterior no se borra. Si el veredicto cambia, el expediente que la esperaba se entera en la misma transacción. 409 `evaluacion-no-calificada`; 422 `justificacion-requerida`, `sin-cambios`, `ajuste-invalido`, `pregunta-desconocida`.

**Permiso evaluaciones:recalificar · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `recalificarEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, RecalificarEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `justificacion` | texto | sí |  |
| `ajustes` | lista de AjusteDto o null | no |  |
| `ajustes[].pregunta` | texto | sí |  |
| `ajustes[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `ajustes[].levantaEliminatoria` | booleano | no | por omisión false |
| `aprobada` | booleano o null | no |  |

**Respuestas**

- `200` OK — EvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `EvaluacionDto` que se detallan en `GET /api/v1/evaluaciones/{id}`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/recalificar" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"justificacion":"Texto de ejemplo.","ajustes":[{"pregunta":"texto","puntaje":1,"levantaEliminatoria":false}],"aprobada":true}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/responder`

**Responder evaluacion.** Responde como evaluador interno (solo una persona de la empresa con `evaluaciones:responder`, no una llave sin usuario delegado) y califica. El expediente que la esperaba se entera en la misma transacción: si era lo último que lo frenaba, se aprueba. 403 `responde-otro` (el cuestionario lo responde el tercero), `conflicto-de-intereses`; 409 `evaluacion-no-pendiente`; 422 `pregunta-obligatoria`, `respuesta-invalida`, `pregunta-no-visible`, `adjunto-invalido`…

**Permiso evaluaciones:responder · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `responderEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResponderEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |

**Respuestas**

- `200` OK — EvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `EvaluacionDto` que se detallan en `GET /api/v1/evaluaciones/{id}`.

**Errores de negocio que lanza**

- `403` `conflicto-de-intereses`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/responder" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"respuestas":[{"pregunta":"texto","opciones":["texto"],"numero":1,"texto":"Texto de ejemplo.","adjuntos":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"comentario":"Texto de ejemplo."}]}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

### `POST /api/v1/evaluaciones/{id}/visibilidad`

**Calcular visibilidad de evaluacion.** Qué secciones y preguntas se muestran con las respuestas que hay hasta ahora (las condiciones de visibilidad con las respuestas anteriores y los datos del tercero), sin guardar nada. Es lo que consulta la pantalla mientras se responde.

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `calcularVisibilidadDeEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResponderEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |

**Respuestas**

- `200` OK — VisibilidadDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `preguntas` | lista de texto | sí |  |
| `secciones` | lista de texto | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/visibilidad" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"respuestas":[{"pregunta":"texto","opciones":["texto"],"numero":1,"texto":"Texto de ejemplo.","adjuntos":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"comentario":"Texto de ejemplo."}]}'
```

Respuesta `200`:

```json
{
  "preguntas": [
    "texto"
  ],
  "secciones": [
    "texto"
  ]
}
```

</details>

### `POST /api/v1/vinculos/{vinculoId}/evaluaciones`

**Asignar evaluacion.** Asigna a mano un cuestionario publicado a un vínculo (por ejemplo, para evaluar a un proveedor que ya existía). Sin expediente al que frenar, su efecto es `Observar`. 409 `estado-terminal` (vínculo anulado o desvinculado), `evaluacion-pendiente` (ya hay una sin responder de ese cuestionario); 422 `cuestionario-sin-publicar`.

**Permiso vinculos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `asignarEvaluacion`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, AsignarEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `cuestionarioId` | uuid | sí |  |

**Respuestas**

- `201` Creado — EvaluacionDto

Campos de la respuesta `201`:

Mismos campos de `EvaluacionDto` que se detallan en `GET /api/v1/evaluaciones/{id}`.

**Errores de negocio que lanza**

- `404` `tercero-no-encontrado`
- `409` `estado-terminal`
- `409` `evaluacion-pendiente`
- `422` `cuestionario-sin-publicar`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"cuestionarioId":"3fa85f64-5717-4562-b3fc-2c963f66afa6"}'
```

Respuesta `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "motivo": "Expediente",
  "cuestionario": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "responde": "Tercero",
  "efecto": "Observar",
  "estado": "Pendiente",
  "definicion": {
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "texto": "Texto de ejemplo.",
            "tipo": "SiNo",
            "obligatoria": true,
            "peso": 1,
            "eliminatoria": true,
            "opciones": [
              null
            ],
            "escala": {
              "minimo": null,
              "maximo": null,
              "minimoAceptable": null
            },
            "rangos": [
              null
            ],
            "condicion": {
              "tipo": null,
              "nodos": null,
              "atributo": null,
              "operador": null,
              "valores": null
            },
            "ayuda": "texto",
            "permiteComentario": false
          }
        ],
        "condicion": {
          "tipo": "texto",
          "nodos": [
            {}
          ],
          "atributo": "texto",
          "operador": "texto",
          "valores": [
            "texto"
          ]
        },
        "descripcion": "Texto de ejemplo."
      }
    ],
    "umbralDeAprobacion": 1,
    "responde": "Tercero",
    "reevaluarCadaMeses": 1,
    "descripcion": "Texto de ejemplo."
  },
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "resultado": {
    "puntaje": 1,
    "umbral": 1,
    "aprobada": true,
    "calculada": true,
    "motivos": [
      "Texto de ejemplo."
    ],
    "eliminatorias": [
      "texto"
    ],
    "secciones": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "peso": 1,
        "puntaje": 1,
        "aplica": true
      }
    ],
    "preguntas": [
      {
        "codigo": "CODIGO_EJEMPLO",
        "visible": true,
        "respondida": true,
        "puntaje": 1,
        "elimina": true,
        "ajustada": true
      }
    ]
  },
  "calificaciones": [
    {
      "numero": 1,
      "origen": "texto",
      "resultado": {
        "puntaje": 1,
        "umbral": 1,
        "aprobada": true,
        "calculada": true,
        "motivos": [
          "Texto de ejemplo."
        ],
        "eliminatorias": [
          "texto"
        ],
        "secciones": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "nombre": "Constructora Norte S.A.S.",
            "peso": 1,
            "puntaje": 1,
            "aplica": true
          }
        ],
        "preguntas": [
          {
            "codigo": "CODIGO_EJEMPLO",
            "visible": true,
            "respondida": true,
            "puntaje": 1,
            "elimina": true,
            "ajustada": true
          }
        ]
      },
      "justificacion": "Texto de ejemplo.",
      "por": {
        "tipo": "texto",
        "id": "texto",
        "nombre": "Constructora Norte S.A.S."
      },
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "ajustes": [
    {
      "pregunta": "texto",
      "puntaje": 1,
      "levantaEliminatoria": false
    }
  ],
  "respondidaPor": {
    "tipo": "texto",
    "id": "texto",
    "nombre": "Constructora Norte S.A.S."
  },
  "respondidaEn": "2026-11-12T15:00:00Z",
  "vigenteHasta": "2026-11-12T15:00:00Z",
  "intentos": 1,
  "recalificaciones": 1,
  "justificacion": "Texto de ejemplo.",
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "anterior": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "asignadaEn": "2026-11-12T15:00:00Z",
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "version": 1
}
```

</details>

## Evaluaciones públicas

El tercero responde la autoevaluación (CE-4, `QuienResponde.Tercero`) dentro de su vínculo con la empresa: solo las evaluaciones de los vínculos de su sesión y cuyo cuestionario lo pide a él. Ve las preguntas con sus opciones, **nunca** puntajes, pesos, eliminatorias ni el umbral, y tras enviar solo ve sus respuestas y que quedó enviada: el resultado es privado de la empresa. 404 con cualquier evaluación que no sea suya.

### `GET /public/v1/vinculos/{vinculoId}/evaluaciones`

**Listar evaluaciones del tercero.** Las evaluaciones del vínculo que le tocan responder al tercero (pendientes y enviadas; no las anuladas).

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `listarEvaluacionesDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |

**Respuestas**

- `200` OK — lista de EvaluacionPublicaResumenDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de EvaluacionPublicaResumenDto | sí |  |
| `[].id` | uuid | sí |  |
| `[].cuestionario` | texto | sí |  |
| `[].estado` | texto | sí |  |
| `[].asignadaEn` | fecha y hora | sí |  |
| `[].respondidaEn` | fecha y hora o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO"
```

Respuesta `200`:

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "cuestionario": "texto",
    "estado": "texto",
    "asignadaEn": "2026-11-12T15:00:00Z",
    "respondidaEn": "2026-11-12T15:00:00Z"
  }
]
```

</details>

### `GET /public/v1/vinculos/{vinculoId}/evaluaciones/{id}`

**Obtener evaluacion del tercero.**

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `obtenerEvaluacionDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — EvaluacionPublicaDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `vinculoId` | uuid | sí |  |
| `cuestionario` | texto | sí |  |
| `descripcion` | texto o null | no |  |
| `estado` | texto | sí |  |
| `secciones` | lista de SeccionPublicaDto | sí |  |
| `secciones[].codigo` | texto | sí |  |
| `secciones[].nombre` | texto | sí |  |
| `secciones[].descripcion` | texto o null | no |  |
| `secciones[].preguntas` | lista de PreguntaPublicaDto | sí |  |
| `secciones[].preguntas[].codigo` | texto | sí |  |
| `secciones[].preguntas[].texto` | texto | sí |  |
| `secciones[].preguntas[].tipo` | TipoDePregunta (texto) | sí | valores: SiNo · OpcionUnica · OpcionMultiple · Escala · Numero · Texto · Adjunto |
| `secciones[].preguntas[].obligatoria` | booleano | sí |  |
| `secciones[].preguntas[].ayuda` | texto o null | no |  |
| `secciones[].preguntas[].permiteComentario` | booleano | sí |  |
| `secciones[].preguntas[].opciones` | lista de OpcionPublicaDto o null | no |  |
| `secciones[].preguntas[].opciones[].codigo` | texto | sí |  |
| `secciones[].preguntas[].opciones[].texto` | texto | sí |  |
| `secciones[].preguntas[].escala` | EscalaPublicaDto o null | no |  |
| `secciones[].preguntas[].escala.minimo` | entero | sí |  |
| `secciones[].preguntas[].escala.maximo` | entero | sí |  |
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |
| `adjuntos` | lista de AdjuntoDeEvaluacionDto | sí |  |
| `adjuntos[].id` | uuid | sí |  |
| `adjuntos[].nombre` | texto | sí |  |
| `adjuntos[].tipoContenido` | texto | sí |  |
| `adjuntos[].tamano` | entero | sí |  |
| `adjuntos[].fecha` | fecha y hora | sí |  |
| `asignadaEn` | fecha y hora | sí |  |
| `respondidaEn` | fecha y hora o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cuestionario": "texto",
  "descripcion": "Texto de ejemplo.",
  "estado": "texto",
  "secciones": [
    {
      "codigo": "CODIGO_EJEMPLO",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "preguntas": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "texto": "Texto de ejemplo.",
          "tipo": "SiNo",
          "obligatoria": true,
          "ayuda": "texto",
          "permiteComentario": true,
          "opciones": [
            {
              "codigo": null,
              "texto": null
            }
          ],
          "escala": {
            "minimo": 1,
            "maximo": 1
          }
        }
      ]
    }
  ],
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "asignadaEn": "2026-11-12T15:00:00Z",
  "respondidaEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `PUT /public/v1/vinculos/{vinculoId}/evaluaciones/{id}/adjuntos`

**Iniciar adjunto de evaluacion del tercero.** Paso 1 de la subida de un archivo de evidencia de la autoevaluación (PDF o imagen de hasta 15 MB). 422 `adjunto-invalido`; 409 `evaluacion-no-pendiente`.

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `iniciarAdjuntoDeEvaluacionDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, IniciarAdjuntoDeEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombreArchivo` | texto | sí |  |
| `tamanoBytes` | entero | sí |  |
| `tipoMime` | texto | sí |  |

**Respuestas**

- `200` OK — CargaDeAdjuntoDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `cargaId` | uuid | sí |  |
| `carga` | InstruccionCargaDto | sí |  |
| `carga.metodo` | texto | sí |  |
| `carga.url` | texto | sí |  |
| `carga.cabeceras` | mapa de texto → texto | sí |  |
| `carga.expira` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `evaluacion-no-pendiente`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/adjuntos" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO" \
  -H "Content-Type: application/json" \
  -d '{"nombreArchivo":"Nombre de ejemplo","tamanoBytes":1,"tipoMime":"texto"}'
```

Respuesta `200`:

```json
{
  "cargaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "carga": {
    "metodo": "texto",
    "url": "https://ejemplo.co/recurso",
    "cabeceras": {
      "clave": "vsk_prueba_ejemplo"
    },
    "expira": "2026-11-12T15:00:00Z"
  }
}
```

</details>

### `POST /public/v1/vinculos/{vinculoId}/evaluaciones/{id}/adjuntos/{cargaId}/confirmar`

**Confirmar adjunto de evaluacion del tercero.** Paso 2: verifica el archivo y lo registra en la evaluación; se cita después en la respuesta de la pregunta de adjunto. 409 `archivo-no-cargado`; 422 `adjunto-invalido`.

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `confirmarAdjuntoDeEvaluacionDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |
| `id` | path | uuid | sí |  |
| `cargaId` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ConfirmarAdjuntoDeEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombreArchivo` | texto | sí |  |

**Respuestas**

- `200` OK — AdjuntoDeEvaluacionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `nombre` | texto | sí |  |
| `tipoContenido` | texto | sí |  |
| `tamano` | entero | sí |  |
| `fecha` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `evaluacion-no-pendiente`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/adjuntos/3fa85f64-5717-4562-b3fc-2c963f66afa6/confirmar" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO" \
  -H "Content-Type: application/json" \
  -d '{"nombreArchivo":"Nombre de ejemplo"}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "nombre": "Constructora Norte S.A.S.",
  "tipoContenido": "Texto de ejemplo.",
  "tamano": 1,
  "fecha": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /public/v1/vinculos/{vinculoId}/evaluaciones/{id}/responder`

**Responder evaluacion del tercero.** Envía la autoevaluación. Se califica en el acto y el expediente que la esperaba se entera en la misma transacción (si era lo último que lo frenaba, se aprueba), pero el tercero no ve el resultado: responde la evaluación ya `Enviada`. 409 `evaluacion-no-pendiente`, `vinculo-bloqueado`; 422 `pregunta-obligatoria`, `respuesta-invalida`, `pregunta-no-visible`, `adjunto-invalido`…

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `responderEvaluacionDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResponderEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |

**Respuestas**

- `200` OK — EvaluacionPublicaDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `EvaluacionPublicaDto` que se detallan en `GET /public/v1/vinculos/{vinculoId}/evaluaciones/{id}`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/responder" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO" \
  -H "Content-Type: application/json" \
  -d '{"respuestas":[{"pregunta":"texto","opciones":["texto"],"numero":1,"texto":"Texto de ejemplo.","adjuntos":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"comentario":"Texto de ejemplo."}]}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "cuestionario": "texto",
  "descripcion": "Texto de ejemplo.",
  "estado": "texto",
  "secciones": [
    {
      "codigo": "CODIGO_EJEMPLO",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "preguntas": [
        {
          "codigo": "CODIGO_EJEMPLO",
          "texto": "Texto de ejemplo.",
          "tipo": "SiNo",
          "obligatoria": true,
          "ayuda": "texto",
          "permiteComentario": true,
          "opciones": [
            {
              "codigo": null,
              "texto": null
            }
          ],
          "escala": {
            "minimo": 1,
            "maximo": 1
          }
        }
      ]
    }
  ],
  "respuestas": [
    {
      "pregunta": "texto",
      "opciones": [
        "texto"
      ],
      "numero": 1,
      "texto": "Texto de ejemplo.",
      "adjuntos": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "comentario": "Texto de ejemplo."
    }
  ],
  "adjuntos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "asignadaEn": "2026-11-12T15:00:00Z",
  "respondidaEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /public/v1/vinculos/{vinculoId}/evaluaciones/{id}/visibilidad`

**Calcular visibilidad de evaluacion del tercero.** Qué preguntas y secciones se muestran con las respuestas que lleva (las condiciones se evalúan en el servidor); no guarda nada.

**Sesión del tercero · Portal del tercero (`/public/v1`) · SDK: `calcularVisibilidadDeEvaluacionDelTercero`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `vinculoId` | path | uuid | sí |  |
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResponderEvaluacionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `respuestas` | lista de RespuestaDto | sí |  |
| `respuestas[].pregunta` | texto | sí |  |
| `respuestas[].opciones` | lista de texto o null | no |  |
| `respuestas[].numero` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `respuestas[].texto` | texto o null | no |  |
| `respuestas[].adjuntos` | lista de uuid o null | no |  |
| `respuestas[].comentario` | texto o null | no |  |

**Respuestas**

- `200` OK — VisibilidadDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `preguntas` | lista de texto | sí |  |
| `secciones` | lista de texto | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/public/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/evaluaciones/3fa85f64-5717-4562-b3fc-2c963f66afa6/visibilidad" \
  -H "Authorization: Bearer $TOKEN_DE_LA_SESION_DEL_TERCERO" \
  -H "Content-Type: application/json" \
  -d '{"respuestas":[{"pregunta":"texto","opciones":["texto"],"numero":1,"texto":"Texto de ejemplo.","adjuntos":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"comentario":"Texto de ejemplo."}]}'
```

Respuesta `200`:

```json
{
  "preguntas": [
    "texto"
  ],
  "secciones": [
    "texto"
  ]
}
```

</details>

## Informe de evaluaciones

Informe de evaluaciones por proveedor (CE-12): una fila por evaluación con el puntaje, el veredicto, quién respondió y cuándo, y un Excel con tres hojas: las evaluaciones, el detalle pregunta por pregunta (la respuesta, su puntaje, si eliminó y si un revisor la ajustó) y el resumen. Es privado de la empresa; cada descarga queda en la auditoría de accesos como las demás exportaciones (IF-6).

### `GET /api/v1/informes/evaluaciones`

**Obtener informe evaluaciones.** Filtra por estado, cuestionario, vínculo, tercero y rango de fechas de asignación (inclusive, zona del negocio).

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerInformeEvaluaciones`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `desde` | query | fecha | no |  |
| `hasta` | query | fecha | no |  |
| `estado` | query | texto | no |  |
| `cuestionarioId` | query | uuid | no |  |
| `vinculoId` | query | uuid | no |  |
| `terceroId` | query | uuid | no |  |
| `limite` | query | entero | no |  |
| `cursor` | query | texto | no |  |

**Respuestas**

- `200` OK — InformeEvaluacionesDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `resumen` | ResumenEvaluacionesDto | sí |  |
| `resumen.total` | entero | sí |  |
| `resumen.pendientes` | entero | sí |  |
| `resumen.aprobadas` | entero | sí |  |
| `resumen.reprobadas` | entero | sí |  |
| `resumen.vencidas` | entero | sí |  |
| `resumen.anuladas` | entero | sí |  |
| `resumen.puntajePromedio` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `filas` | lista de FilaInformeEvaluacionDto | sí |  |
| `filas[].id` | uuid | sí |  |
| `filas[].vinculoId` | uuid | sí |  |
| `filas[].expedienteId` | uuid o null | no |  |
| `filas[].folio` | texto o null | no |  |
| `filas[].tercero` | TerceroResumenDto | sí |  |
| `filas[].tercero.id` | uuid | sí |  |
| `filas[].tercero.nombre` | texto | sí |  |
| `filas[].tercero.identificacion` | texto | sí |  |
| `filas[].cuestionario` | texto | sí |  |
| `filas[].versionCuestionario` | entero | sí |  |
| `filas[].estado` | EstadoDeEvaluacion (texto) | sí | valores: Pendiente · Calificada · Vencida · Anulada |
| `filas[].responde` | QuienResponde (texto) | sí | valores: Tercero · Evaluador |
| `filas[].efecto` | EfectoDeLaEvaluacion (texto) | sí | valores: Observar · Bloquear |
| `filas[].motivo` | MotivoDeEvaluacion (texto) | sí | valores: Expediente · Reevaluacion · Manual |
| `filas[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `filas[].aprobada` | booleano o null | no |  |
| `filas[].motivos` | lista de texto | sí |  |
| `filas[].eliminatorias` | lista de texto | sí |  |
| `filas[].respondidaPor` | texto o null | no |  |
| `filas[].asignadaEn` | fecha y hora | sí |  |
| `filas[].respondidaEn` | fecha y hora o null | no |  |
| `filas[].vigenteHasta` | fecha y hora o null | no |  |
| `filas[].recalificaciones` | entero | sí |  |
| `siguienteCursor` | texto o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/informes/evaluaciones" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "resumen": {
    "total": 1,
    "pendientes": 1,
    "aprobadas": 1,
    "reprobadas": 1,
    "vencidas": 1,
    "anuladas": 1,
    "puntajePromedio": 1
  },
  "filas": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "folio": "texto",
      "tercero": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "nombre": "Constructora Norte S.A.S.",
        "identificacion": "900123456"
      },
      "cuestionario": "texto",
      "versionCuestionario": 1,
      "estado": "Pendiente",
      "responde": "Tercero",
      "efecto": "Observar",
      "motivo": "Expediente",
      "puntaje": 1,
      "aprobada": true,
      "motivos": [
        "Texto de ejemplo."
      ],
      "eliminatorias": [
        "texto"
      ],
      "respondidaPor": "texto",
      "asignadaEn": "2026-11-12T15:00:00Z",
      "respondidaEn": "2026-11-12T15:00:00Z",
      "vigenteHasta": "2026-11-12T15:00:00Z",
      "recalificaciones": 1
    }
  ],
  "siguienteCursor": "texto"
}
```

</details>

### `GET /api/v1/informes/evaluaciones/excel`

**Descargar informe evaluaciones excel.**

**Permiso evaluaciones:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `descargarInformeEvaluacionesExcel`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `desde` | query | fecha | no |  |
| `hasta` | query | fecha | no |  |
| `estado` | query | texto | no |  |
| `cuestionarioId` | query | uuid | no |  |
| `vinculoId` | query | uuid | no |  |
| `terceroId` | query | uuid | no |  |

**Respuestas**

- `200` OK — el contrato publica esta respuesta sin esquema (`IResult`)
- `404` No encontrado

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/informes/evaluaciones/excel" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

</details>

## Reevaluaciones

Ejecución inmediata del barrido de reevaluaciones (Plataforma).

### `POST /api/v1/plataforma/reevaluaciones/revisar`

**Revisar reevaluaciones.** Corre ya el barrido de reevaluaciones (Plataforma) y espera su resultado: de un tenant o de todos. `fecha` simula «ahora» y solo se admite en Development (pruebas de punta a punta; 422 `fecha-simulada-no-permitida` en otro entorno). Cada llamada vence y reasigna cada evaluación vencida una sola vez.

**Operador de Plataforma · API (`/api/v1`) · SDK: `revisarReevaluaciones`**

**Cuerpo de la petición** (`application/json`, RevisarReevaluacionesDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `tenantId` | uuid o null | no |  |
| `fecha` | fecha y hora o null | no |  |

**Respuestas**

- `200` OK — ResultadoRevisionReevaluacionesDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `revisadas` | entero | sí |  |
| `vencidas` | entero | sí |  |
| `asignadas` | entero | sí |  |

**Errores de negocio que lanza**

- `422` `fecha-simulada-no-permitida`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/plataforma/reevaluaciones/revisar" \
  -H "X-Api-Key: $CLAVE_DE_PLATAFORMA" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","fecha":"2026-11-12T15:00:00Z"}'
```

Respuesta `200`:

```json
{
  "revisadas": 1,
  "vencidas": 1,
  "asignadas": 1
}
```

</details>
