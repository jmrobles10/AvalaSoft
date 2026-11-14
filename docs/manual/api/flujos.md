# API · Flujos

10 operaciones en 1 recurso.

## Flujos

Flujos aprobatorios versionados de la empresa activa (`X-Empresa`): etapas en secuencia, áreas en paralelo, aprobadores por área, áreas automáticas, política de devolución y los documentos que pide (requisitos, RQ-1: se editan en el borrador y se congelan al publicar) y, opcionalmente, la regla con la que se escoge solo (condición y prioridad, FR-1). Todo cambio deja registro de auditoría (R-1).

### `GET /api/v1/flujos`

**Listar flujos.**

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarFlujos`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `tipoVinculo` | query | texto | no |  |

**Respuestas**

- `200` OK — lista de FlujoDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de FlujoDto | sí |  |
| `[].id` | uuid | sí |  |
| `[].empresaId` | uuid | sí |  |
| `[].codigo` | texto | sí |  |
| `[].nombre` | texto | sí |  |
| `[].tipoVinculo` | TipoVinculoResumenDto | sí |  |
| `[].tipoVinculo.id` | uuid | sí |  |
| `[].tipoVinculo.codigo` | texto | sí |  |
| `[].tipoVinculo.nombre` | texto | sí |  |
| `[].esPorDefecto` | booleano | sí |  |
| `[].publicada` | FlujoVersionDto o null | no |  |
| `[].publicada.id` | uuid | sí |  |
| `[].publicada.version` | entero | sí |  |
| `[].publicada.estado` | EstadoFlujoVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `[].publicada.etapas` | lista de EtapaDto | sí |  |
| `[].publicada.etapas[].orden` | entero | sí |  |
| `[].publicada.etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `[].publicada.etapas[].areas[].areaId` | uuid | sí |  |
| `[].publicada.etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `[].publicada.etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `[].publicada.etapas[].areas[].automatica` | booleano | no | por omisión false |
| `[].publicada.etapas[].areas[].slaHoras` | entero o null | no |  |
| `[].publicada.politicaDevolucion` | PoliticaDevolucion (texto) | sí | valores: Inmediata · AlCerrarArea |
| `[].publicada.separacionDeFunciones` | booleano | sí |  |
| `[].publicada.creadaEn` | fecha y hora | sí |  |
| `[].publicada.publicadaEn` | fecha y hora o null | no |  |
| `[].publicada.retiradaEn` | fecha y hora o null | no |  |
| `[].publicada.requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `[].publicada.requisitos[].id` | uuid o null | no |  |
| `[].publicada.requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `[].publicada.requisitos[].tipoDocumento` | texto o null | no |  |
| `[].publicada.requisitos[].obligatorio` | booleano | no | por omisión true |
| `[].publicada.requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `[].publicada.requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `[].publicada.requisitos[].condicion` | CondicionDto o null | no |  |
| `[].publicada.requisitos[].condicion.tipo` | texto | sí |  |
| `[].publicada.requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `[].publicada.requisitos[].condicion.atributo` | texto o null | no |  |
| `[].publicada.requisitos[].condicion.operador` | texto o null | no |  |
| `[].publicada.requisitos[].condicion.valores` | lista de texto o null | no |  |
| `[].publicada.requisitos[].seccion` | texto o null | no |  |
| `[].publicada.requisitos[].periodos` | entero o null | no |  |
| `[].publicada.requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `[].publicada.requisitos[].usarComoSoporte` | booleano o null | no |  |
| `[].publicada.requisitos[].vigenciaDias` | entero o null | no |  |
| `[].publicada.requisitos[].diasRevalidacion` | entero o null | no |  |
| `[].publicada.requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `[].publicada.requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `[].publicada.verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `[].publicada.verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `[].publicada.verificaciones[].bloqueante` | booleano | no | por omisión true |
| `[].publicada.verificaciones[].vigenciaDias` | entero o null | no |  |
| `[].publicada.verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `[].publicada.plazoCargue` | PlazoCargueDto o null | no |  |
| `[].publicada.plazoCargue.dias` | entero | sí |  |
| `[].publicada.plazoCargue.recordatorios` | lista de entero o null | no |  |
| `[].publicada.reintento` | ReintentoDto o null | no |  |
| `[].publicada.reintento.permitido` | booleano | sí |  |
| `[].publicada.reintento.diasEspera` | entero | no | por omisión 0 |
| `[].publicada.vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `[].publicada.vigenciaVinculo.dias` | entero | sí |  |
| `[].publicada.vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `[].publicada.vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `[].publicada.recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `[].publicada.recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `[].publicada.recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `[].publicada.seleccion` | SeleccionDeFlujoDto o null | no |  |
| `[].publicada.seleccion.condicion` | CondicionDto o null | no | mismos campos que `[].publicada.requisitos[].condicion` |
| `[].publicada.seleccion.prioridad` | entero o null | no |  |
| `[].publicada.evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `[].publicada.evaluaciones[].cuestionarioId` | uuid | sí |  |
| `[].publicada.evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |
| `[].borrador` | FlujoVersionDto o null | no | mismos campos que `[].publicada` |
| `[].creadoEn` | fecha y hora | sí |  |
| `[].actualizadoEn` | fecha y hora | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/flujos" \
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
    "tipoVinculo": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "codigo": "CODIGO_EJEMPLO",
      "nombre": "Constructora Norte S.A.S."
    },
    "esPorDefecto": true,
    "publicada": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "version": 1,
      "estado": "Borrador",
      "etapas": [
        {
          "orden": 1,
          "areas": [
            {
              "areaId": null,
              "aprobadoresRequeridos": null,
              "puedeRechazarExpediente": null,
              "automatica": null,
              "slaHoras": null
            }
          ]
        }
      ],
      "politicaDevolucion": "Inmediata",
      "separacionDeFunciones": true,
      "creadaEn": "2026-11-12T15:00:00Z",
      "publicadaEn": "2026-11-12T15:00:00Z",
      "retiradaEn": "2026-11-12T15:00:00Z",
      "requisitos": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "tipoDocumento": "texto",
          "obligatorio": true,
          "areasQueRevisan": [
            "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          ],
          "aprobadoresRequeridos": 1,
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
          "seccion": "texto",
          "periodos": 1,
          "exigeSoporte": false,
          "usarComoSoporte": true,
          "vigenciaDias": 1,
          "diasRevalidacion": 1,
          "dePersonaRelacionada": "texto",
          "todasLasRelaciones": false
        }
      ],
      "verificaciones": [
        {
          "tipo": "ListasRestrictivas",
          "bloqueante": true,
          "vigenciaDias": 1,
          "frecuenciaReconsultaMeses": 1
        }
      ],
      "plazoCargue": {
        "dias": 1,
        "recordatorios": [
          1
        ]
      },
      "reintento": {
        "permitido": true,
        "diasEspera": 0
      },
      "vigenciaVinculo": {
        "dias": 1,
        "diasAviso": [
          1
        ],
        "diasGracia": 0
      },
      "recordatorioObservaciones": {
        "modo": "Empresa",
        "cadaDias": 1
      },
      "seleccion": {
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
        "prioridad": 1
      },
      "evaluaciones": [
        {
          "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "efecto": "Observar"
        }
      ]
    },
    "borrador": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "version": 1,
      "estado": "Borrador",
      "etapas": [
        {
          "orden": 1,
          "areas": [
            {
              "areaId": null,
              "aprobadoresRequeridos": null,
              "puedeRechazarExpediente": null,
              "automatica": null,
              "slaHoras": null
            }
          ]
        }
      ],
      "politicaDevolucion": "Inmediata",
      "separacionDeFunciones": true,
      "creadaEn": "2026-11-12T15:00:00Z",
      "publicadaEn": "2026-11-12T15:00:00Z",
      "retiradaEn": "2026-11-12T15:00:00Z",
      "requisitos": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "tipoDocumento": "texto",
          "obligatorio": true,
          "areasQueRevisan": [
            "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          ],
          "aprobadoresRequeridos": 1,
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
          "seccion": "texto",
          "periodos": 1,
          "exigeSoporte": false,
          "usarComoSoporte": true,
          "vigenciaDias": 1,
          "diasRevalidacion": 1,
          "dePersonaRelacionada": "texto",
          "todasLasRelaciones": false
        }
      ],
      "verificaciones": [
        {
          "tipo": "ListasRestrictivas",
          "bloqueante": true,
          "vigenciaDias": 1,
          "frecuenciaReconsultaMeses": 1
        }
      ],
      "plazoCargue": {
        "dias": 1,
        "recordatorios": [
          1
        ]
      },
      "reintento": {
        "permitido": true,
        "diasEspera": 0
      },
      "vigenciaVinculo": {
        "dias": 1,
        "diasAviso": [
          1
        ],
        "diasGracia": 0
      },
      "recordatorioObservaciones": {
        "modo": "Empresa",
        "cadaDias": 1
      },
      "seleccion": {
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
        "prioridad": 1
      },
      "evaluaciones": [
        {
          "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "efecto": "Observar"
        }
      ]
    },
    "creadoEn": "2026-11-12T15:00:00Z",
    "actualizadoEn": "2026-11-12T15:00:00Z"
  }
]
```

</details>

### `POST /api/v1/flujos`

**Crear flujo.**

**Permiso flujos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `crearFlujo`**

**Cuerpo de la petición** (`application/json`, CrearFlujoDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `codigo` | texto | sí |  |
| `nombre` | texto | sí |  |
| `tipoVinculo` | texto | sí |  |
| `etapas` | lista de EtapaDto o null | no |  |
| `etapas[].orden` | entero | sí |  |
| `etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `etapas[].areas[].areaId` | uuid | sí |  |
| `etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `etapas[].areas[].automatica` | booleano | no | por omisión false |
| `etapas[].areas[].slaHoras` | entero o null | no |  |
| `politicaDevolucion` | texto o null | no |  |
| `separacionDeFunciones` | booleano | no | por omisión false |
| `requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `requisitos[].id` | uuid o null | no |  |
| `requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `requisitos[].tipoDocumento` | texto o null | no |  |
| `requisitos[].obligatorio` | booleano | no | por omisión true |
| `requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `requisitos[].condicion` | CondicionDto o null | no |  |
| `requisitos[].condicion.tipo` | texto | sí |  |
| `requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `requisitos[].condicion.atributo` | texto o null | no |  |
| `requisitos[].condicion.operador` | texto o null | no |  |
| `requisitos[].condicion.valores` | lista de texto o null | no |  |
| `requisitos[].seccion` | texto o null | no |  |
| `requisitos[].periodos` | entero o null | no |  |
| `requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `requisitos[].usarComoSoporte` | booleano o null | no |  |
| `requisitos[].vigenciaDias` | entero o null | no |  |
| `requisitos[].diasRevalidacion` | entero o null | no |  |
| `requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `verificaciones[].bloqueante` | booleano | no | por omisión true |
| `verificaciones[].vigenciaDias` | entero o null | no |  |
| `verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `plazoCargue` | PlazoCargueDto o null | no |  |
| `plazoCargue.dias` | entero | sí |  |
| `plazoCargue.recordatorios` | lista de entero o null | no |  |
| `reintento` | ReintentoDto o null | no |  |
| `reintento.permitido` | booleano | sí |  |
| `reintento.diasEspera` | entero | no | por omisión 0 |
| `vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `vigenciaVinculo.dias` | entero | sí |  |
| `vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `seleccion` | SeleccionDeFlujoDto o null | no |  |
| `seleccion.condicion` | CondicionDto o null | no | mismos campos que `requisitos[].condicion` |
| `seleccion.prioridad` | entero o null | no |  |
| `evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `evaluaciones[].cuestionarioId` | uuid | sí |  |
| `evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |

**Respuestas**

- `201` Creado — FlujoDto

Campos de la respuesta `201`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `empresaId` | uuid | sí |  |
| `codigo` | texto | sí |  |
| `nombre` | texto | sí |  |
| `tipoVinculo` | TipoVinculoResumenDto | sí |  |
| `tipoVinculo.id` | uuid | sí |  |
| `tipoVinculo.codigo` | texto | sí |  |
| `tipoVinculo.nombre` | texto | sí |  |
| `esPorDefecto` | booleano | sí |  |
| `publicada` | FlujoVersionDto o null | no |  |
| `publicada.id` | uuid | sí |  |
| `publicada.version` | entero | sí |  |
| `publicada.estado` | EstadoFlujoVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `publicada.etapas` | lista de EtapaDto | sí |  |
| `publicada.etapas[].orden` | entero | sí |  |
| `publicada.etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `publicada.etapas[].areas[].areaId` | uuid | sí |  |
| `publicada.etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `publicada.etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `publicada.etapas[].areas[].automatica` | booleano | no | por omisión false |
| `publicada.etapas[].areas[].slaHoras` | entero o null | no |  |
| `publicada.politicaDevolucion` | PoliticaDevolucion (texto) | sí | valores: Inmediata · AlCerrarArea |
| `publicada.separacionDeFunciones` | booleano | sí |  |
| `publicada.creadaEn` | fecha y hora | sí |  |
| `publicada.publicadaEn` | fecha y hora o null | no |  |
| `publicada.retiradaEn` | fecha y hora o null | no |  |
| `publicada.requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `publicada.requisitos[].id` | uuid o null | no |  |
| `publicada.requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `publicada.requisitos[].tipoDocumento` | texto o null | no |  |
| `publicada.requisitos[].obligatorio` | booleano | no | por omisión true |
| `publicada.requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `publicada.requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `publicada.requisitos[].condicion` | CondicionDto o null | no |  |
| `publicada.requisitos[].condicion.tipo` | texto | sí |  |
| `publicada.requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `publicada.requisitos[].condicion.atributo` | texto o null | no |  |
| `publicada.requisitos[].condicion.operador` | texto o null | no |  |
| `publicada.requisitos[].condicion.valores` | lista de texto o null | no |  |
| `publicada.requisitos[].seccion` | texto o null | no |  |
| `publicada.requisitos[].periodos` | entero o null | no |  |
| `publicada.requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `publicada.requisitos[].usarComoSoporte` | booleano o null | no |  |
| `publicada.requisitos[].vigenciaDias` | entero o null | no |  |
| `publicada.requisitos[].diasRevalidacion` | entero o null | no |  |
| `publicada.requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `publicada.requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `publicada.verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `publicada.verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `publicada.verificaciones[].bloqueante` | booleano | no | por omisión true |
| `publicada.verificaciones[].vigenciaDias` | entero o null | no |  |
| `publicada.verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `publicada.plazoCargue` | PlazoCargueDto o null | no |  |
| `publicada.plazoCargue.dias` | entero | sí |  |
| `publicada.plazoCargue.recordatorios` | lista de entero o null | no |  |
| `publicada.reintento` | ReintentoDto o null | no |  |
| `publicada.reintento.permitido` | booleano | sí |  |
| `publicada.reintento.diasEspera` | entero | no | por omisión 0 |
| `publicada.vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `publicada.vigenciaVinculo.dias` | entero | sí |  |
| `publicada.vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `publicada.vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `publicada.recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `publicada.recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `publicada.recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `publicada.seleccion` | SeleccionDeFlujoDto o null | no |  |
| `publicada.seleccion.condicion` | CondicionDto o null | no | mismos campos que `publicada.requisitos[].condicion` |
| `publicada.seleccion.prioridad` | entero o null | no |  |
| `publicada.evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `publicada.evaluaciones[].cuestionarioId` | uuid | sí |  |
| `publicada.evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |
| `borrador` | FlujoVersionDto o null | no | mismos campos que `publicada` |
| `creadoEn` | fecha y hora | sí |  |
| `actualizadoEn` | fecha y hora | sí |  |

**Errores de negocio que lanza**

- `409` `flujo-duplicado`
- `422` `tipo-vinculo-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/flujos" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"codigo":"CODIGO_EJEMPLO","nombre":"Constructora Norte S.A.S.","tipoVinculo":"texto","etapas":[{"orden":1,"areas":[{"areaId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","aprobadoresRequeridos":1,"puedeRechazarExpediente":false,"automatica":false,"slaHoras":1}]}],"politicaDevolucion":"texto","separacionDeFunciones":false,"requisitos":[{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","tipoDocumentoTenantId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","tipoDocumento":"texto","obligatorio":true,"areasQueRevisan":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"aprobadoresRequeridos":1,"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"seccion":"texto","periodos":1,"exigeSoporte":false,"usarComoSoporte":true,"vigenciaDias":1,"diasRevalidacion":1,"dePersonaRelacionada":"texto","todasLasRelaciones":false}],"verificaciones":[{"tipo":"ListasRestrictivas","bloqueante":true,"vigenciaDias":1,"frecuenciaReconsultaMeses":1}],"plazoCargue":{"dias":1,"recordatorios":[1]},"reintento":{"permitido":true,"diasEspera":0},"vigenciaVinculo":{"dias":1,"diasAviso":[1],"diasGracia":0},"recordatorioObservaciones":{"modo":"Empresa","cadaDias":1},"seleccion":{"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"prioridad":1},"evaluaciones":[{"cuestionarioId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","efecto":"Observar"}]}'
```

Respuesta `201`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "tipoVinculo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "esPorDefecto": true,
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `GET /api/v1/flujos/{id}`

**Obtener flujo.**

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerFlujo`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — FlujoDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `FlujoDto` que se detallan en `POST /api/v1/flujos`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/flujos/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
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
  "tipoVinculo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "esPorDefecto": true,
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `PUT /api/v1/flujos/{id}`

**Editar flujo.** Edita el borrador (o crea uno nuevo con la versión siguiente); la versión publicada no cambia.

**Permiso flujos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `editarFlujo`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, EditarFlujoDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `nombre` | texto o null | no |  |
| `etapas` | lista de EtapaDto o null | no |  |
| `etapas[].orden` | entero | sí |  |
| `etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `etapas[].areas[].areaId` | uuid | sí |  |
| `etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `etapas[].areas[].automatica` | booleano | no | por omisión false |
| `etapas[].areas[].slaHoras` | entero o null | no |  |
| `politicaDevolucion` | texto o null | no |  |
| `separacionDeFunciones` | booleano o null | no |  |
| `requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `requisitos[].id` | uuid o null | no |  |
| `requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `requisitos[].tipoDocumento` | texto o null | no |  |
| `requisitos[].obligatorio` | booleano | no | por omisión true |
| `requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `requisitos[].condicion` | CondicionDto o null | no |  |
| `requisitos[].condicion.tipo` | texto | sí |  |
| `requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `requisitos[].condicion.atributo` | texto o null | no |  |
| `requisitos[].condicion.operador` | texto o null | no |  |
| `requisitos[].condicion.valores` | lista de texto o null | no |  |
| `requisitos[].seccion` | texto o null | no |  |
| `requisitos[].periodos` | entero o null | no |  |
| `requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `requisitos[].usarComoSoporte` | booleano o null | no |  |
| `requisitos[].vigenciaDias` | entero o null | no |  |
| `requisitos[].diasRevalidacion` | entero o null | no |  |
| `requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `verificaciones[].bloqueante` | booleano | no | por omisión true |
| `verificaciones[].vigenciaDias` | entero o null | no |  |
| `verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `plazoCargue` | PlazoCargueDto o null | no |  |
| `plazoCargue.dias` | entero | sí |  |
| `plazoCargue.recordatorios` | lista de entero o null | no |  |
| `reintento` | ReintentoDto o null | no |  |
| `reintento.permitido` | booleano | sí |  |
| `reintento.diasEspera` | entero | no | por omisión 0 |
| `vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `vigenciaVinculo.dias` | entero | sí |  |
| `vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `seleccion` | SeleccionDeFlujoDto o null | no |  |
| `seleccion.condicion` | CondicionDto o null | no | mismos campos que `requisitos[].condicion` |
| `seleccion.prioridad` | entero o null | no |  |
| `evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `evaluaciones[].cuestionarioId` | uuid | sí |  |
| `evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |

**Respuestas**

- `200` OK — FlujoDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `FlujoDto` que se detallan en `POST /api/v1/flujos`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/flujos/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Constructora Norte S.A.S.","etapas":[{"orden":1,"areas":[{"areaId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","aprobadoresRequeridos":1,"puedeRechazarExpediente":false,"automatica":false,"slaHoras":1}]}],"politicaDevolucion":"texto","separacionDeFunciones":true,"requisitos":[{"id":"3fa85f64-5717-4562-b3fc-2c963f66afa6","tipoDocumentoTenantId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","tipoDocumento":"texto","obligatorio":true,"areasQueRevisan":["3fa85f64-5717-4562-b3fc-2c963f66afa6"],"aprobadoresRequeridos":1,"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"seccion":"texto","periodos":1,"exigeSoporte":false,"usarComoSoporte":true,"vigenciaDias":1,"diasRevalidacion":1,"dePersonaRelacionada":"texto","todasLasRelaciones":false}],"verificaciones":[{"tipo":"ListasRestrictivas","bloqueante":true,"vigenciaDias":1,"frecuenciaReconsultaMeses":1}],"plazoCargue":{"dias":1,"recordatorios":[1]},"reintento":{"permitido":true,"diasEspera":0},"vigenciaVinculo":{"dias":1,"diasAviso":[1],"diasGracia":0},"recordatorioObservaciones":{"modo":"Empresa","cadaDias":1},"seleccion":{"condicion":{"tipo":"texto","nodos":[{}],"atributo":"texto","operador":"texto","valores":["texto"]},"prioridad":1},"evaluaciones":[{"cuestionarioId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","efecto":"Observar"}]}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "codigo": "CODIGO_EJEMPLO",
  "nombre": "Constructora Norte S.A.S.",
  "tipoVinculo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "esPorDefecto": true,
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `POST /api/v1/flujos/{id}/publicar`

**Publicar flujo.** Publica el borrador y retira la versión anterior. Si el tipo de vínculo no tenía flujo por defecto, este lo es.

**Permiso flujos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `publicarFlujo`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — FlujoDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `FlujoDto` que se detallan en `POST /api/v1/flujos`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/flujos/3fa85f64-5717-4562-b3fc-2c963f66afa6/publicar" \
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
  "tipoVinculo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "esPorDefecto": true,
  "publicada": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "borrador": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "version": 1,
    "estado": "Borrador",
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  },
  "creadoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z"
}
```

</details>

### `GET /api/v1/flujos/{id}/versiones`

**Listar versiones flujo.**

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarVersionesFlujo`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — lista de FlujoVersionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de FlujoVersionDto | sí |  |
| `[].id` | uuid | sí |  |
| `[].version` | entero | sí |  |
| `[].estado` | EstadoFlujoVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `[].etapas` | lista de EtapaDto | sí |  |
| `[].etapas[].orden` | entero | sí |  |
| `[].etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `[].etapas[].areas[].areaId` | uuid | sí |  |
| `[].etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `[].etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `[].etapas[].areas[].automatica` | booleano | no | por omisión false |
| `[].etapas[].areas[].slaHoras` | entero o null | no |  |
| `[].politicaDevolucion` | PoliticaDevolucion (texto) | sí | valores: Inmediata · AlCerrarArea |
| `[].separacionDeFunciones` | booleano | sí |  |
| `[].creadaEn` | fecha y hora | sí |  |
| `[].publicadaEn` | fecha y hora o null | no |  |
| `[].retiradaEn` | fecha y hora o null | no |  |
| `[].requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `[].requisitos[].id` | uuid o null | no |  |
| `[].requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `[].requisitos[].tipoDocumento` | texto o null | no |  |
| `[].requisitos[].obligatorio` | booleano | no | por omisión true |
| `[].requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `[].requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `[].requisitos[].condicion` | CondicionDto o null | no |  |
| `[].requisitos[].condicion.tipo` | texto | sí |  |
| `[].requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `[].requisitos[].condicion.atributo` | texto o null | no |  |
| `[].requisitos[].condicion.operador` | texto o null | no |  |
| `[].requisitos[].condicion.valores` | lista de texto o null | no |  |
| `[].requisitos[].seccion` | texto o null | no |  |
| `[].requisitos[].periodos` | entero o null | no |  |
| `[].requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `[].requisitos[].usarComoSoporte` | booleano o null | no |  |
| `[].requisitos[].vigenciaDias` | entero o null | no |  |
| `[].requisitos[].diasRevalidacion` | entero o null | no |  |
| `[].requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `[].requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `[].verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `[].verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `[].verificaciones[].bloqueante` | booleano | no | por omisión true |
| `[].verificaciones[].vigenciaDias` | entero o null | no |  |
| `[].verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `[].plazoCargue` | PlazoCargueDto o null | no |  |
| `[].plazoCargue.dias` | entero | sí |  |
| `[].plazoCargue.recordatorios` | lista de entero o null | no |  |
| `[].reintento` | ReintentoDto o null | no |  |
| `[].reintento.permitido` | booleano | sí |  |
| `[].reintento.diasEspera` | entero | no | por omisión 0 |
| `[].vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `[].vigenciaVinculo.dias` | entero | sí |  |
| `[].vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `[].vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `[].recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `[].recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `[].recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `[].seleccion` | SeleccionDeFlujoDto o null | no |  |
| `[].seleccion.condicion` | CondicionDto o null | no | mismos campos que `[].requisitos[].condicion` |
| `[].seleccion.prioridad` | entero o null | no |  |
| `[].evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `[].evaluaciones[].cuestionarioId` | uuid | sí |  |
| `[].evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/flujos/3fa85f64-5717-4562-b3fc-2c963f66afa6/versiones" \
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
    "etapas": [
      {
        "orden": 1,
        "areas": [
          {
            "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "aprobadoresRequeridos": 1,
            "puedeRechazarExpediente": false,
            "automatica": false,
            "slaHoras": 1
          }
        ]
      }
    ],
    "politicaDevolucion": "Inmediata",
    "separacionDeFunciones": true,
    "creadaEn": "2026-11-12T15:00:00Z",
    "publicadaEn": "2026-11-12T15:00:00Z",
    "retiradaEn": "2026-11-12T15:00:00Z",
    "requisitos": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tipoDocumento": "texto",
        "obligatorio": true,
        "areasQueRevisan": [
          "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        ],
        "aprobadoresRequeridos": 1,
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
        "seccion": "texto",
        "periodos": 1,
        "exigeSoporte": false,
        "usarComoSoporte": true,
        "vigenciaDias": 1,
        "diasRevalidacion": 1,
        "dePersonaRelacionada": "texto",
        "todasLasRelaciones": false
      }
    ],
    "verificaciones": [
      {
        "tipo": "ListasRestrictivas",
        "bloqueante": true,
        "vigenciaDias": 1,
        "frecuenciaReconsultaMeses": 1
      }
    ],
    "plazoCargue": {
      "dias": 1,
      "recordatorios": [
        1
      ]
    },
    "reintento": {
      "permitido": true,
      "diasEspera": 0
    },
    "vigenciaVinculo": {
      "dias": 1,
      "diasAviso": [
        1
      ],
      "diasGracia": 0
    },
    "recordatorioObservaciones": {
      "modo": "Empresa",
      "cadaDias": 1
    },
    "seleccion": {
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
      "prioridad": 1
    },
    "evaluaciones": [
      {
        "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "efecto": "Observar"
      }
    ]
  }
]
```

</details>

### `GET /api/v1/flujos/{id}/versiones/{n}`

**Obtener version flujo.**

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerVersionFlujo`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `n` | path | entero | sí |  |

**Respuestas**

- `200` OK — FlujoVersionDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `version` | entero | sí |  |
| `estado` | EstadoFlujoVersion (texto) | sí | valores: Borrador · Publicada · Retirada |
| `etapas` | lista de EtapaDto | sí |  |
| `etapas[].orden` | entero | sí |  |
| `etapas[].areas` | lista de AreaDeEtapaDto | sí |  |
| `etapas[].areas[].areaId` | uuid | sí |  |
| `etapas[].areas[].aprobadoresRequeridos` | entero | no | por omisión 1 |
| `etapas[].areas[].puedeRechazarExpediente` | booleano | no | por omisión false |
| `etapas[].areas[].automatica` | booleano | no | por omisión false |
| `etapas[].areas[].slaHoras` | entero o null | no |  |
| `politicaDevolucion` | PoliticaDevolucion (texto) | sí | valores: Inmediata · AlCerrarArea |
| `separacionDeFunciones` | booleano | sí |  |
| `creadaEn` | fecha y hora | sí |  |
| `publicadaEn` | fecha y hora o null | no |  |
| `retiradaEn` | fecha y hora o null | no |  |
| `requisitos` | lista de RequisitoDelFlujoDto o null | no |  |
| `requisitos[].id` | uuid o null | no |  |
| `requisitos[].tipoDocumentoTenantId` | uuid o null | no |  |
| `requisitos[].tipoDocumento` | texto o null | no |  |
| `requisitos[].obligatorio` | booleano | no | por omisión true |
| `requisitos[].areasQueRevisan` | lista de uuid o null | no |  |
| `requisitos[].aprobadoresRequeridos` | entero o null | no |  |
| `requisitos[].condicion` | CondicionDto o null | no |  |
| `requisitos[].condicion.tipo` | texto | sí |  |
| `requisitos[].condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `requisitos[].condicion.atributo` | texto o null | no |  |
| `requisitos[].condicion.operador` | texto o null | no |  |
| `requisitos[].condicion.valores` | lista de texto o null | no |  |
| `requisitos[].seccion` | texto o null | no |  |
| `requisitos[].periodos` | entero o null | no |  |
| `requisitos[].exigeSoporte` | booleano | no | por omisión false |
| `requisitos[].usarComoSoporte` | booleano o null | no |  |
| `requisitos[].vigenciaDias` | entero o null | no |  |
| `requisitos[].diasRevalidacion` | entero o null | no |  |
| `requisitos[].dePersonaRelacionada` | texto o null | no |  |
| `requisitos[].todasLasRelaciones` | booleano | no | por omisión false |
| `verificaciones` | lista de VerificacionRequeridaDto o null | no |  |
| `verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `verificaciones[].bloqueante` | booleano | no | por omisión true |
| `verificaciones[].vigenciaDias` | entero o null | no |  |
| `verificaciones[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `plazoCargue` | PlazoCargueDto o null | no |  |
| `plazoCargue.dias` | entero | sí |  |
| `plazoCargue.recordatorios` | lista de entero o null | no |  |
| `reintento` | ReintentoDto o null | no |  |
| `reintento.permitido` | booleano | sí |  |
| `reintento.diasEspera` | entero | no | por omisión 0 |
| `vigenciaVinculo` | VigenciaVinculoDto o null | no |  |
| `vigenciaVinculo.dias` | entero | sí |  |
| `vigenciaVinculo.diasAviso` | lista de entero o null | no |  |
| `vigenciaVinculo.diasGracia` | entero | no | por omisión 0 |
| `recordatorioObservaciones` | RecordatorioDeFlujoDto o null | no |  |
| `recordatorioObservaciones.modo` | texto | no | por omisión "Empresa" |
| `recordatorioObservaciones.cadaDias` | entero o null | no |  |
| `seleccion` | SeleccionDeFlujoDto o null | no |  |
| `seleccion.condicion` | CondicionDto o null | no | mismos campos que `requisitos[].condicion` |
| `seleccion.prioridad` | entero o null | no |  |
| `evaluaciones` | lista de EvaluacionRequeridaDto o null | no |  |
| `evaluaciones[].cuestionarioId` | uuid | sí |  |
| `evaluaciones[].efecto` | EfectoDeLaEvaluacion (texto) | no | valores: Observar · Bloquear |

**Errores de negocio que lanza**

- `404` `version-no-encontrada`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/flujos/3fa85f64-5717-4562-b3fc-2c963f66afa6/versiones/1" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "version": 1,
  "estado": "Borrador",
  "etapas": [
    {
      "orden": 1,
      "areas": [
        {
          "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "aprobadoresRequeridos": 1,
          "puedeRechazarExpediente": false,
          "automatica": false,
          "slaHoras": 1
        }
      ]
    }
  ],
  "politicaDevolucion": "Inmediata",
  "separacionDeFunciones": true,
  "creadaEn": "2026-11-12T15:00:00Z",
  "publicadaEn": "2026-11-12T15:00:00Z",
  "retiradaEn": "2026-11-12T15:00:00Z",
  "requisitos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tipoDocumentoTenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tipoDocumento": "texto",
      "obligatorio": true,
      "areasQueRevisan": [
        "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      ],
      "aprobadoresRequeridos": 1,
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
      "seccion": "texto",
      "periodos": 1,
      "exigeSoporte": false,
      "usarComoSoporte": true,
      "vigenciaDias": 1,
      "diasRevalidacion": 1,
      "dePersonaRelacionada": "texto",
      "todasLasRelaciones": false
    }
  ],
  "verificaciones": [
    {
      "tipo": "ListasRestrictivas",
      "bloqueante": true,
      "vigenciaDias": 1,
      "frecuenciaReconsultaMeses": 1
    }
  ],
  "plazoCargue": {
    "dias": 1,
    "recordatorios": [
      1
    ]
  },
  "reintento": {
    "permitido": true,
    "diasEspera": 0
  },
  "vigenciaVinculo": {
    "dias": 1,
    "diasAviso": [
      1
    ],
    "diasGracia": 0
  },
  "recordatorioObservaciones": {
    "modo": "Empresa",
    "cadaDias": 1
  },
  "seleccion": {
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
    "prioridad": 1
  },
  "evaluaciones": [
    {
      "cuestionarioId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "efecto": "Observar"
    }
  ]
}
```

</details>

### `GET /api/v1/flujos/por-defecto`

**Listar flujos por defecto.** Flujo por defecto de cada tipo de vínculo de la empresa.

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `listarFlujosPorDefecto`**

**Respuestas**

- `200` OK — lista de FlujoPorDefectoDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `[]` | lista de FlujoPorDefectoDto | sí |  |
| `[].tipoVinculoId` | uuid | sí |  |
| `[].flujoId` | uuid | sí |  |
| `[].empresaId` | uuid o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/flujos/por-defecto" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
[
  {
    "tipoVinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "flujoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
]
```

</details>

### `PUT /api/v1/flujos/por-defecto`

**Definir flujo por defecto.** Define el flujo por defecto de `(empresa, tipo de vínculo)`: debe ser de la empresa, de ese tipo y estar publicado.

**Permiso flujos:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `definirFlujoPorDefecto`**

**Cuerpo de la petición** (`application/json`, FlujoPorDefectoDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `tipoVinculoId` | uuid | sí |  |
| `flujoId` | uuid | sí |  |
| `empresaId` | uuid o null | no |  |

**Respuestas**

- `200` OK — FlujoPorDefectoDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `tipoVinculoId` | uuid | sí |  |
| `flujoId` | uuid | sí |  |
| `empresaId` | uuid o null | no |  |

**Errores de negocio que lanza**

- `422` `empresa-invalida`
- `422` `flujo-sin-version-publicada`
- `422` `tipo-vinculo-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/flujos/por-defecto" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Content-Type: application/json" \
  -d '{"tipoVinculoId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","flujoId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","empresaId":"3fa85f64-5717-4562-b3fc-2c963f66afa6"}'
```

Respuesta `200`:

```json
{
  "tipoVinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "flujoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

</details>

### `POST /api/v1/flujos/seleccion/vista-previa`

**Vista previa seleccion flujo.** «¿Qué flujo le tocaría a este tercero?» (FR-1): evalúa, sin abrir nada, las reglas de selección de los flujos publicados del tipo de vínculo con los datos del tercero (`terceroId`, visible para el tenant) y/o los indicados, y responde el flujo que escogería el sistema con su origen (`Regla` o `PorDefecto`) y todas las reglas con su resultado, en orden de evaluación. Es lo que usa el editor para probar una condición y lo que puede consultar el sistema integrado antes de crear el vínculo.

**Permiso flujos:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `vistaPreviaSeleccionFlujo`**

**Cuerpo de la petición** (`application/json`, VistaPreviaDeSeleccionDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `tipoVinculo` | texto | sí |  |
| `terceroId` | uuid o null | no |  |
| `tipoPersona` | texto o null | no |  |
| `pais` | texto o null | no |  |
| `tipoIdentificacion` | texto o null | no |  |
| `esExtranjero` | booleano o null | no |  |
| `atributos` | objeto libre o null | no |  |

**Respuestas**

- `200` OK — SeleccionPrevistaDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `flujo` | FlujoDeExpedienteDto o null | no |  |
| `flujo.id` | uuid | sí |  |
| `flujo.versionId` | uuid | sí |  |
| `flujo.codigo` | texto | sí |  |
| `flujo.nombre` | texto | sí |  |
| `flujo.version` | entero | sí |  |
| `flujo.origen` | OrigenFlujo (texto) | sí | valores: Explicito · Regla · PorDefecto |
| `flujo.regla` | SeleccionPorReglaDto o null | no |  |
| `flujo.regla.prioridad` | entero | sí |  |
| `flujo.regla.condicion` | CondicionDto | sí |  |
| `flujo.regla.condicion.tipo` | texto | sí |  |
| `flujo.regla.condicion.nodos` | lista de CondicionDto o null | no | recursivo: ver CondicionDto |
| `flujo.regla.condicion.atributo` | texto o null | no |  |
| `flujo.regla.condicion.operador` | texto o null | no |  |
| `flujo.regla.condicion.valores` | lista de texto o null | no |  |
| `flujo.regla.reglasEvaluadas` | entero | sí |  |
| `reglas` | lista de ReglaDeSeleccionDto | sí |  |
| `reglas[].flujoId` | uuid | sí |  |
| `reglas[].versionId` | uuid | sí |  |
| `reglas[].codigo` | texto | sí |  |
| `reglas[].nombre` | texto | sí |  |
| `reglas[].version` | entero | sí |  |
| `reglas[].prioridad` | entero | sí |  |
| `reglas[].condicion` | CondicionDto | sí | mismos campos que `flujo.regla.condicion` |
| `reglas[].cumple` | booleano | sí |  |

**Errores de negocio que lanza**

- `422` `tipo-persona-invalido`
- `422` `tipo-vinculo-invalido`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/flujos/seleccion/vista-previa" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"tipoVinculo":"texto","terceroId":"3fa85f64-5717-4562-b3fc-2c963f66afa6","tipoPersona":"texto","pais":"CO","tipoIdentificacion":"900123456","esExtranjero":true,"atributos":{}}'
```

Respuesta `200`:

```json
{
  "flujo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S.",
    "version": 1,
    "origen": "Explicito",
    "regla": {
      "prioridad": 1,
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
      "reglasEvaluadas": 1
    }
  },
  "reglas": [
    {
      "flujoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "versionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "codigo": "CODIGO_EJEMPLO",
      "nombre": "Constructora Norte S.A.S.",
      "version": 1,
      "prioridad": 1,
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
      "cumple": true
    }
  ]
}
```

</details>
