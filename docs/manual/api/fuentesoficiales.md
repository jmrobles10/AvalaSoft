# API · Fuentes oficiales

8 operaciones en 2 recursos.

## Fuentes oficiales

### `GET /api/v1/configuracion/fuentes-oficiales`

**Obtener fuentes oficiales.** Fuentes oficiales de la empresa: proveedor elegido y efectivo por fuente, qué proveedores hay y están disponibles, y la reconsulta periódica.

**Permiso configuracion:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerFuentesOficiales`**

**Respuestas**

- `200` OK — FuentesOficialesConfigDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `fuentes` | lista de FuenteOficialConfigDto | sí |  |
| `fuentes[].fuente` | texto | sí |  |
| `fuentes[].nombre` | texto | sí |  |
| `fuentes[].descripcion` | texto | sí |  |
| `fuentes[].proveedor` | texto o null | no |  |
| `fuentes[].proveedorEfectivo` | texto o null | no |  |
| `fuentes[].proveedores` | lista de ProveedorDeFuenteDto | sí |  |
| `fuentes[].proveedores[].nombre` | texto | sí |  |
| `fuentes[].proveedores[].real` | booleano | sí |  |
| `fuentes[].proveedores[].habilitadoEnInstalacion` | booleano | sí |  |
| `fuentes[].proveedores[].credencialesPropias` | booleano | sí |  |
| `fuentes[].proveedores[].credencialesDeLaPlataforma` | booleano | sí |  |
| `fuentes[].proveedores[].usuario` | texto o null | no |  |
| `fuentes[].proveedores[].ultimosCuatroClave` | texto o null | no |  |
| `fuentes[].proveedores[].urlBase` | texto o null | no |  |
| `fuentes[].proveedores[].notas` | texto o null | no |  |
| `fuentes[].proveedores[].disponible` | booleano | sí |  |
| `diasMonitoreo` | entero | sí |  |
| `vigenciaDias` | entero | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/configuracion/fuentes-oficiales" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "fuentes": [
    {
      "fuente": "texto",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "proveedor": "texto",
      "proveedorEfectivo": "texto",
      "proveedores": [
        {
          "nombre": "Constructora Norte S.A.S.",
          "real": true,
          "habilitadoEnInstalacion": true,
          "credencialesPropias": true,
          "credencialesDeLaPlataforma": true,
          "usuario": "texto",
          "ultimosCuatroClave": "texto",
          "urlBase": "https://ejemplo.co/recurso",
          "notas": "Texto de ejemplo.",
          "disponible": true
        }
      ]
    }
  ],
  "diasMonitoreo": 1,
  "vigenciaDias": 1
}
```

</details>

### `PUT /api/v1/configuracion/fuentes-oficiales`

**Actualizar fuentes oficiales.** Elige el proveedor de una o más fuentes (`proveedor: ""` = el predeterminado), cambia las credenciales propias de uno real y/o fija cada cuántos días se reconsultan los vínculos activos (0 la apaga). Las credenciales se cifran con la clave del grupo y la clave es de solo escritura. 422 `fuente-oficial-invalida`, `proveedor-invalido`, `proveedor-no-habilitado` (la instalación no lo habilitó), `usuario-de-fuente-invalido`, `clave-invalida`, `url-invalida`, `notas-invalidas`, `credenciales-vacias`, `monitoreo-invalido`. Queda en la auditoría, sin la clave.

**Permiso configuracion:escribir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `actualizarFuentesOficiales`**

**Cuerpo de la petición** (`application/json`, ActualizarFuentesOficialesDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `elecciones` | lista de EleccionDeProveedorDto o null | no |  |
| `elecciones[].fuente` | texto | sí |  |
| `elecciones[].proveedor` | texto o null | no |  |
| `credenciales` | CredencialesFuenteDto o null | no |  |
| `credenciales.fuente` | texto | sí |  |
| `credenciales.proveedor` | texto | sí |  |
| `credenciales.usuario` | texto o null | no |  |
| `credenciales.clave` | texto o null | no |  |
| `credenciales.urlBase` | texto o null | no |  |
| `credenciales.notas` | texto o null | no |  |
| `diasMonitoreo` | entero o null | no |  |

**Respuestas**

- `200` OK — FuentesOficialesConfigDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `FuentesOficialesConfigDto` que se detallan en `GET /api/v1/configuracion/fuentes-oficiales`.

**Errores de negocio que lanza**

- `422` `proveedor-no-habilitado`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/configuracion/fuentes-oficiales" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Content-Type: application/json" \
  -d '{"elecciones":[{"fuente":"texto","proveedor":"texto"}],"credenciales":{"fuente":"texto","proveedor":"texto","usuario":"texto","clave":"texto","urlBase":"https://ejemplo.co/recurso","notas":"Texto de ejemplo."},"diasMonitoreo":1}'
```

Respuesta `200`:

```json
{
  "fuentes": [
    {
      "fuente": "texto",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "proveedor": "texto",
      "proveedorEfectivo": "texto",
      "proveedores": [
        {
          "nombre": "Constructora Norte S.A.S.",
          "real": true,
          "habilitadoEnInstalacion": true,
          "credencialesPropias": true,
          "credencialesDeLaPlataforma": true,
          "usuario": "texto",
          "ultimosCuatroClave": "texto",
          "urlBase": "https://ejemplo.co/recurso",
          "notas": "Texto de ejemplo.",
          "disponible": true
        }
      ]
    }
  ],
  "diasMonitoreo": 1,
  "vigenciaDias": 1
}
```

</details>

### `POST /api/v1/expedientes/{id}/verificaciones/{tipo}/diferencias/{campoId}/resolver`

**Resolver diferencia de fuente.** Un revisor acepta (`Descartada`) o confirma (`Confirmada`) una diferencia con la fuente, siempre con justificación. Confirmada ⇒ la verificación queda `Fallida` y el expediente no cierra (nunca automático). 404 `diferencia-no-encontrada`; 409 `diferencia-ya-resuelta`; 403 `conflicto-de-intereses`; 422 `justificacion-requerida`, `decision-invalida`, `tipo-no-consultable`.

**Permiso cumplimiento:decidir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `resolverDiferenciaDeFuente`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `tipo` | path | texto | sí |  |
| `campoId` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResolverCoincidenciaDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `decision` | DecisionCoincidencia (texto) | sí | valores: Descartada · Confirmada |
| `justificacion` | texto | sí |  |

**Respuestas**

- `200` OK — ExpedienteDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `id` | uuid | sí |  |
| `folio` | texto | sí |  |
| `empresaId` | uuid | sí |  |
| `vinculoId` | uuid | sí |  |
| `tercero` | TerceroResumenDto | sí |  |
| `tercero.id` | uuid | sí |  |
| `tercero.nombre` | texto | sí |  |
| `tercero.identificacion` | texto | sí |  |
| `tipoVinculo` | TipoVinculoResumenDto | sí |  |
| `tipoVinculo.id` | uuid | sí |  |
| `tipoVinculo.codigo` | texto | sí |  |
| `tipoVinculo.nombre` | texto | sí |  |
| `tipo` | TipoExpediente (texto) | sí | valores: Inicial · Renovacion · Actualizacion |
| `estado` | EstadoExpediente (texto) | sí | valores: Abierto · EnRevision · Observado · Aprobado · Rechazado · Anulado · Caducado |
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
| `politicaDevolucion` | PoliticaDevolucion (texto) | sí | valores: Inmediata · AlCerrarArea |
| `separacionDeFunciones` | booleano | sí |  |
| `etapaActual` | entero o null | no |  |
| `etapas` | lista de EtapaExpedienteDto | sí |  |
| `etapas[].orden` | entero | sí |  |
| `etapas[].estado` | EstadoEtapa (texto) | sí | valores: Esperando · Activa · Aprobada |
| `etapas[].activadaEn` | fecha y hora o null | no |  |
| `etapas[].aprobadaEn` | fecha y hora o null | no |  |
| `etapas[].areas` | lista de AreaExpedienteDto | sí |  |
| `etapas[].areas[].areaId` | uuid | sí |  |
| `etapas[].areas[].codigo` | texto | sí |  |
| `etapas[].areas[].nombre` | texto | sí |  |
| `etapas[].areas[].estado` | EstadoAreaExpediente (texto) | sí | valores: Esperando · Pendiente · Aprobada · Observada |
| `etapas[].areas[].aprobadoresRequeridos` | entero | sí |  |
| `etapas[].areas[].aprobaciones` | entero | sí |  |
| `etapas[].areas[].aprobacionesFaltantes` | entero | sí |  |
| `etapas[].areas[].miembrosPendientes` | lista de uuid | sí |  |
| `etapas[].areas[].puedeRechazarExpediente` | booleano | sí |  |
| `etapas[].areas[].automatica` | booleano | sí |  |
| `etapas[].areas[].pendienteDesde` | fecha y hora o null | no |  |
| `etapas[].areas[].slaVence` | fecha y hora o null | no |  |
| `etapas[].areas[].veredictos` | lista de VeredictoEmitidoDto | sí |  |
| `etapas[].areas[].veredictos[].id` | uuid | sí |  |
| `etapas[].areas[].veredictos[].veredicto` | Veredicto (texto) | sí | valores: Aprobado · Observado |
| `etapas[].areas[].veredictos[].origen` | OrigenVeredicto (texto) | sí | valores: Humano · Sistema · Administrador |
| `etapas[].areas[].veredictos[].usuario` | texto o null | no |  |
| `etapas[].areas[].veredictos[].fecha` | fecha y hora | sí |  |
| `etapas[].areas[].veredictos[].motivos` | lista de texto | sí |  |
| `etapas[].areas[].veredictos[].observacion` | texto o null | no |  |
| `etapas[].areas[].veredictos[].justificacion` | texto o null | no |  |
| `etapas[].areas[].veredictos[].vigente` | booleano | sí |  |
| `etapas[].areas[].veredictos[].superado` | booleano | sí |  |
| `etapas[].areas[].veredictos[].anulado` | booleano | sí |  |
| `etapas[].areas[].veredictos[].anuladoPor` | texto o null | no |  |
| `etapas[].areas[].veredictos[].sobreVersion` | entero o null | no |  |
| `etapas[].areas[].veredictos[].invalidado` | booleano | no | por omisión false |
| `etapas[].areas[].veredictos[].derivado` | booleano | no | por omisión false |
| `etapas[].areas[].veredictos[].campos` | lista de texto o null | no |  |
| `etapas[].areas[].veredictos[].revertido` | booleano | no | por omisión false |
| `etapas[].areas[].requisitosPorDecidir` | entero | no | por omisión 0 |
| `etapas[].areas[].documentosPorDecidir` | lista de DocumentoPorDecidirDto o null | no |  |
| `etapas[].areas[].documentosPorDecidir[].requisitoId` | uuid | sí |  |
| `etapas[].areas[].documentosPorDecidir[].versionVigente` | entero | sí |  |
| `etapas[].areas[].documentosPorDecidir[].tipoRequisito` | TipoRequisito (texto) | no | valores: Documento · Seccion |
| `etapas[].areas[].documentosPorDecidir[].seccion` | texto o null | no |  |
| `etapas[].areas[].documentosPorDecidir[].periodo` | entero o null | no |  |
| `reenvios` | entero | sí |  |
| `ultimaRespuesta` | texto o null | no |  |
| `rechazo` | RechazoDto o null | no |  |
| `rechazo.areaId` | uuid | sí |  |
| `rechazo.usuario` | texto | sí |  |
| `rechazo.motivos` | lista de texto | sí |  |
| `rechazo.justificacion` | texto | sí |  |
| `rechazo.fecha` | fecha y hora | sí |  |
| `rechazo.origen` | texto o null | no |  |
| `motivoAnulacion` | texto o null | no |  |
| `abiertoEn` | fecha y hora | sí |  |
| `cerradoEn` | fecha y hora o null | no |  |
| `actualizadoEn` | fecha y hora | sí |  |
| `version` | entero | sí |  |
| `requisitos` | lista de RequisitoExpedienteDto o null | no |  |
| `requisitos[].id` | uuid | sí |  |
| `requisitos[].tipoDocumento` | TipoDocumentoRequisitoDto | sí |  |
| `requisitos[].tipoDocumento.id` | uuid | sí |  |
| `requisitos[].tipoDocumento.codigo` | texto | sí |  |
| `requisitos[].tipoDocumento.nombre` | texto | sí |  |
| `requisitos[].tipoDocumento.tipoCanonico` | texto o null | no |  |
| `requisitos[].tipoDocumento.ambito` | AmbitoDocumento (texto) | sí | valores: Global · PorVinculo |
| `requisitos[].tipoDocumento.modo` | texto o null | no |  |
| `requisitos[].tipoDocumento.campos` | lista de CampoFormularioDto o null | no |  |
| `requisitos[].tipoDocumento.campos[].clave` | texto | sí |  |
| `requisitos[].tipoDocumento.campos[].etiqueta` | texto | sí |  |
| `requisitos[].tipoDocumento.campos[].tipo` | texto | sí |  |
| `requisitos[].tipoDocumento.campos[].obligatorio` | booleano | no | por omisión false |
| `requisitos[].tipoDocumento.campos[].opciones` | lista de texto o null | no |  |
| `requisitos[].tipoDocumento.campos[].ayuda` | texto o null | no |  |
| `requisitos[].tipoDocumento.archivo` | ReglasArchivoDto o null | no |  |
| `requisitos[].tipoDocumento.archivo.formatos` | lista de texto | sí |  |
| `requisitos[].tipoDocumento.archivo.tamanoMaximoBytes` | entero | sí |  |
| `requisitos[].tipoDocumento.archivo.paginasMaximas` | entero | sí |  |
| `requisitos[].tipoDocumento.archivo.descripcion` | texto | sí |  |
| `requisitos[].tipoDocumento.tienePlantilla` | booleano | no | por omisión false |
| `requisitos[].tipoDocumento.textoAyuda` | texto o null | no |  |
| `requisitos[].obligatorio` | booleano | sí |  |
| `requisitos[].estado` | EstadoRequisito (texto) | sí | valores: Pendiente · Cargado · EnRevision · Observado · Aprobado · Eximido · NoAplica |
| `requisitos[].versionActual` | VersionRequisitoDto o null | no |  |
| `requisitos[].versionActual.documentoId` | uuid | sí |  |
| `requisitos[].versionActual.n` | entero | sí |  |
| `requisitos[].versionActual.sha256` | texto | sí |  |
| `requisitos[].versionActual.cargadaEn` | fecha y hora | sí |  |
| `requisitos[].versionActual.datosDeclarados` | lista de DatoDeclaradoDto o null | no |  |
| `requisitos[].versionActual.datosDeclarados[].clave` | texto | sí |  |
| `requisitos[].versionActual.datosDeclarados[].etiqueta` | texto | sí |  |
| `requisitos[].versionActual.datosDeclarados[].tipo` | texto | sí |  |
| `requisitos[].versionActual.datosDeclarados[].valor` | texto | sí |  |
| `requisitos[].versionActual.vigencia` | VigenciaDto o null | no |  |
| `requisitos[].versionActual.vigencia.vigenteHasta` | fecha o null | no |  |
| `requisitos[].versionActual.vigencia.base` | texto | sí |  |
| `requisitos[].versionActual.vigencia.estado` | texto | sí |  |
| `requisitos[].versionActual.vigencia.diasAviso` | lista de entero | sí |  |
| `requisitos[].versionActual.vigencia.diasGracia` | entero | sí |  |
| `requisitos[].versionActual.vigencia.finDeGracia` | fecha o null | no |  |
| `requisitos[].versionActual.vigencia.vencidaEn` | fecha y hora o null | no |  |
| `requisitos[].versionActual.estado` | texto o null | no |  |
| `requisitos[].versionActual.clase` | texto o null | no |  |
| `requisitos[].reenvios` | entero | sí |  |
| `requisitos[].exencion` | ExencionDto o null | no |  |
| `requisitos[].exencion.por` | texto | sí |  |
| `requisitos[].exencion.justificacion` | texto | sí |  |
| `requisitos[].exencion.fecha` | fecha y hora | sí |  |
| `requisitos[].exencion.exencionDeVinculoId` | uuid o null | no |  |
| `requisitos[].areas` | lista de AreaDeRequisitoDto | sí |  |
| `requisitos[].areas[].areaId` | uuid | sí |  |
| `requisitos[].areas[].codigo` | texto | sí |  |
| `requisitos[].areas[].estado` | EstadoAreaRequisito (texto) | sí | valores: Esperando · Pendiente · Aprobado · Observado · Eximido · NoAplica |
| `requisitos[].areas[].aprobadoresRequeridos` | entero | sí |  |
| `requisitos[].areas[].aprobaciones` | entero | sí |  |
| `requisitos[].areas[].veredictos` | lista de VeredictoEmitidoDto | sí | mismos campos que `etapas[].areas[].veredictos[]` |
| `requisitos[].tipoRequisito` | TipoRequisito (texto) | no | valores: Documento · Seccion |
| `requisitos[].seccion` | SeccionDeRequisitoDto o null | no |  |
| `requisitos[].seccion.seccion` | texto | sí |  |
| `requisitos[].seccion.nombre` | texto | sí |  |
| `requisitos[].seccion.periodo` | entero o null | no |  |
| `requisitos[].seccion.exigeSoporte` | booleano | sí |  |
| `requisitos[].seccion.completitud` | CompletitudSeccionDto o null | no |  |
| `requisitos[].seccion.completitud.completa` | booleano | sí |  |
| `requisitos[].seccion.completitud.faltantes` | lista de FaltanteSeccionDto | sí |  |
| `requisitos[].seccion.completitud.faltantes[].campo` | texto o null | no |  |
| `requisitos[].seccion.completitud.faltantes[].regla` | texto o null | no |  |
| `requisitos[].seccion.completitud.faltantes[].mensaje` | texto | sí |  |
| `requisitos[].seccion.completitud.reglaVersion` | entero | sí |  |
| `requisitos[].seccion.versionEvaluada` | entero o null | no |  |
| `requisitos[].seccion.datos` | JsonElement o null | no |  |
| `requisitos[].seccion.soportes` | lista de SoporteSeccionDto | sí |  |
| `requisitos[].seccion.soportes[].documentoId` | uuid | sí |  |
| `requisitos[].seccion.soportes[].version` | entero | sí |  |
| `requisitos[].seccion.soportes[].tipoDocumento` | texto o null | no |  |
| `requisitos[].seccion.soportes[].retirado` | booleano | no | por omisión false |
| `requisitos[].seccion.soportes[].nombre` | texto o null | no |  |
| `requisitos[].seccion.versionAceptada` | entero o null | no |  |
| `requisitos[].seccion.cambios` | lista de CambioDeCampoDto | sí |  |
| `requisitos[].seccion.cambios[].campo` | texto | sí |  |
| `requisitos[].seccion.cambios[].etiqueta` | texto | sí |  |
| `requisitos[].seccion.cambios[].anterior` | texto o null | no |  |
| `requisitos[].seccion.cambios[].nuevo` | texto o null | no |  |
| `requisitos[].seccion.cambios[].tipoCambio` | TipoCambio (texto) | sí | valores: Agregado · Quitado · Modificado |
| `requisitos[].seccion.cruce` | CruceDeRequisitoDto o null | no |  |
| `requisitos[].seccion.cruce.estado` | texto | sí |  |
| `requisitos[].seccion.cruce.discrepanciaCritica` | booleano | sí |  |
| `requisitos[].seccion.cruce.cruces` | lista de CruceDeSeccionDto | sí |  |
| `requisitos[].seccion.cruce.cruces[].documentoId` | uuid | sí |  |
| `requisitos[].seccion.cruce.cruces[].versionDocumento` | entero | sí |  |
| `requisitos[].seccion.cruce.cruces[].tipoDocumento` | texto | sí |  |
| `requisitos[].seccion.cruce.cruces[].nombreDocumento` | texto | sí |  |
| `requisitos[].seccion.cruce.cruces[].confianza` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `requisitos[].seccion.cruce.cruces[].legible` | booleano | sí |  |
| `requisitos[].seccion.cruce.cruces[].fecha` | fecha y hora | sí |  |
| `requisitos[].seccion.cruce.cruces[].coincidencias` | entero | sí |  |
| `requisitos[].seccion.cruce.cruces[].discrepancias` | entero | sí |  |
| `requisitos[].seccion.cruce.cruces[].noVerificables` | entero | sí |  |
| `requisitos[].seccion.cruce.cruces[].discrepanciaCritica` | booleano | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos` | lista de CampoCruzadoDto | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos[].campo` | texto | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos[].etiqueta` | texto | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos[].declarado` | texto o null | no |  |
| `requisitos[].seccion.cruce.cruces[].campos[].extraido` | texto o null | no |  |
| `requisitos[].seccion.cruce.cruces[].campos[].resultado` | texto | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos[].critico` | booleano | sí |  |
| `requisitos[].seccion.cruce.cruces[].campos[].detalle` | texto o null | no |  |
| `requisitos[].seccion.cruce.sinCruce` | lista de DocumentoSinCruceDto | sí |  |
| `requisitos[].seccion.cruce.sinCruce[].documentoId` | uuid | sí |  |
| `requisitos[].seccion.cruce.sinCruce[].version` | entero | sí |  |
| `requisitos[].seccion.cruce.sinCruce[].tipoDocumento` | texto | sí |  |
| `requisitos[].seccion.cruce.sinCruce[].nombreDocumento` | texto | sí |  |
| `requisitos[].seccion.cruce.sinCruce[].motivo` | texto | sí |  |
| `requisitos[].seccion.sinSoporte` | SinSoporteDto o null | no |  |
| `requisitos[].seccion.sinSoporte.critico` | booleano | sí |  |
| `requisitos[].seccion.sinSoporte.cambios` | lista de CambioDeCampoDto | sí | mismos campos que `requisitos[].seccion.cambios[]` |
| `requisitos[].soporteDeSecciones` | SoporteDeSeccionesDto o null | no |  |
| `requisitos[].soporteDeSecciones.sinAnalisis` | booleano | sí |  |
| `requisitos[].soporteDeSecciones.discrepanciaCritica` | booleano | sí |  |
| `requisitos[].soporteDeSecciones.secciones` | lista de SeccionRespaldadaDto | sí |  |
| `requisitos[].soporteDeSecciones.secciones[].seccion` | texto | sí |  |
| `requisitos[].soporteDeSecciones.secciones[].nombre` | texto | sí |  |
| `requisitos[].soporteDeSecciones.secciones[].periodo` | entero o null | no |  |
| `requisitos[].soporteDeSecciones.secciones[].version` | entero o null | no |  |
| `requisitos[].soporteDeSecciones.secciones[].cruce` | CruceDeSeccionDto o null | no | mismos campos que `requisitos[].seccion.cruce.cruces[]` |
| `requisitos[].retiro` | RetiroDeVersionDto o null | no |  |
| `requisitos[].retiro.numero` | entero | sí |  |
| `requisitos[].retiro.motivo` | texto | sí |  |
| `requisitos[].retiro.fecha` | fecha y hora | sí |  |
| `requisitos[].revisionesAutomaticas` | lista de RevisionAutomaticaDto o null | no |  |
| `requisitos[].revisionesAutomaticas[].areaId` | uuid | sí |  |
| `requisitos[].revisionesAutomaticas[].areaCodigo` | texto | sí |  |
| `requisitos[].revisionesAutomaticas[].sobreVersion` | entero | sí |  |
| `requisitos[].revisionesAutomaticas[].nivel` | texto | sí |  |
| `requisitos[].revisionesAutomaticas[].resultado` | texto | sí |  |
| `requisitos[].revisionesAutomaticas[].sugerencia` | texto o null | no |  |
| `requisitos[].revisionesAutomaticas[].motivos` | lista de MotivoDeRevisionDto | sí |  |
| `requisitos[].revisionesAutomaticas[].motivos[].codigo` | texto | sí |  |
| `requisitos[].revisionesAutomaticas[].motivos[].texto` | texto | sí |  |
| `requisitos[].revisionesAutomaticas[].confianza` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `requisitos[].revisionesAutomaticas[].fecha` | fecha y hora | sí |  |
| `requisitos[].revisionesAutomaticas[].pendienteDeAtencion` | booleano | sí |  |
| `requisitos[].revisionesAutomaticas[].resolucion` | texto o null | no |  |
| `requisitos[].revisionesAutomaticas[].resueltaPor` | texto o null | no |  |
| `requisitos[].revisionesAutomaticas[].resueltaEn` | fecha y hora o null | no |  |
| `requisitos[].revisionesAutomaticas[].justificacionResolucion` | texto o null | no |  |
| `requisitos[].persona` | PersonaDelRequisitoDto o null | no |  |
| `requisitos[].persona.rol` | texto | sí |  |
| `requisitos[].persona.todasLasRelaciones` | booleano | sí |  |
| `requisitos[].persona.sinPersona` | booleano | sí |  |
| `requisitos[].persona.personaId` | uuid o null | no |  |
| `requisitos[].persona.relacionId` | uuid o null | no |  |
| `requisitos[].persona.nombre` | texto o null | no |  |
| `requisitos[].persona.identificacion` | texto o null | no |  |
| `requisitos[].porQue` | lista de MotivoDeExigenciaDto o null | no |  |
| `requisitos[].porQue[].campo` | texto | sí |  |
| `requisitos[].porQue[].etiqueta` | texto | sí |  |
| `requisitos[].porQue[].valores` | lista de texto | sí |  |
| `verificaciones` | lista de VerificacionDto o null | no |  |
| `verificaciones[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `verificaciones[].estado` | EstadoVerificacion (texto) | sí | valores: Pendiente · CoincidenciaPorAnalizar · Satisfecha · Fallida · Expirada |
| `verificaciones[].bloqueante` | booleano | sí |  |
| `verificaciones[].requeridaPorElFlujo` | booleano | sí |  |
| `verificaciones[].proveedor` | texto o null | no |  |
| `verificaciones[].resultado` | texto o null | no |  |
| `verificaciones[].referenciaExterna` | texto o null | no |  |
| `verificaciones[].registradaEn` | fecha y hora o null | no |  |
| `verificaciones[].registradaPor` | texto o null | no |  |
| `verificaciones[].vigenteHasta` | fecha y hora o null | no |  |
| `verificaciones[].evidencia` | EvidenciaVerificacionDto o null | no |  |
| `verificaciones[].evidencia.nombreArchivo` | texto | sí |  |
| `verificaciones[].evidencia.tipoContenido` | texto | sí |  |
| `verificaciones[].evidencia.tamano` | entero | sí |  |
| `verificaciones[].evidencia.sha256` | texto | sí |  |
| `verificaciones[].evidencia.delProveedor` | booleano | sí |  |
| `verificaciones[].evidencia.sha256Respuesta` | texto o null | no |  |
| `verificaciones[].personas` | lista de PersonaConsultadaDto | sí |  |
| `verificaciones[].personas[].rol` | texto | sí |  |
| `verificaciones[].personas[].nombre` | texto | sí |  |
| `verificaciones[].personas[].identificacion` | texto | sí |  |
| `verificaciones[].coincidencias` | lista de CoincidenciaDto | sí |  |
| `verificaciones[].coincidencias[].id` | uuid | sí |  |
| `verificaciones[].coincidencias[].persona` | texto | sí |  |
| `verificaciones[].coincidencias[].rol` | texto | sí |  |
| `verificaciones[].coincidencias[].identificacion` | texto | sí |  |
| `verificaciones[].coincidencias[].lista` | texto | sí |  |
| `verificaciones[].coincidencias[].nombreEncontrado` | texto | sí |  |
| `verificaciones[].coincidencias[].detalle` | texto o null | no |  |
| `verificaciones[].coincidencias[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `verificaciones[].coincidencias[].decision` | texto o null | no |  |
| `verificaciones[].coincidencias[].justificacion` | texto o null | no |  |
| `verificaciones[].coincidencias[].resueltaPor` | texto o null | no |  |
| `verificaciones[].coincidencias[].resueltaEn` | fecha y hora o null | no |  |
| `verificaciones[].coincidencias[].vigenteHasta` | fecha y hora o null | no |  |
| `verificaciones[].coincidencias[].heredada` | booleano | sí |  |
| `verificaciones[].estudio` | EstudioCumplimientoDto o null | no |  |
| `verificaciones[].estudio.verificadoEnListas` | booleano | sí |  |
| `verificaciones[].estudio.conflictoDeInteres` | booleano | sí |  |
| `verificaciones[].estudio.debidaDiligencia` | DebidaDiligencia (texto) | sí | valores: Simple · Ordinaria · Ampliada |
| `verificaciones[].estudio.nivelRiesgo` | entero | sí |  |
| `verificaciones[].estudio.observaciones` | texto o null | no |  |
| `verificaciones[].estudio.evidencias` | lista de EvidenciaEstudioDto | sí |  |
| `verificaciones[].estudio.evidencias[].documentoId` | uuid | sí |  |
| `verificaciones[].estudio.evidencias[].version` | entero | sí |  |
| `verificaciones[].estudio.evidencias[].nombre` | texto o null | no |  |
| `verificaciones[].estudio.concepto` | ConceptoCumplimiento (texto) | sí | valores: Favorable · Desfavorable |
| `verificaciones[].estudio.oficial` | texto | sí |  |
| `verificaciones[].estudio.fecha` | fecha y hora | sí |  |
| `…` |  | no | Se omiten los campos restantes: el esquema es muy extenso. |
| `…` |  | no | Se omiten los campos restantes: el esquema es muy extenso. |
| `…` |  | no | Se omiten los campos restantes: el esquema es muy extenso. |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/expedientes/3fa85f64-5717-4562-b3fc-2c963f66afa6/verificaciones/texto/diferencias/3fa85f64-5717-4562-b3fc-2c963f66afa6/resolver" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"decision":"Descartada","justificacion":"Texto de ejemplo."}'
```

Respuesta `200`:

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "empresaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tercero": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "nombre": "Constructora Norte S.A.S.",
    "identificacion": "900123456"
  },
  "tipoVinculo": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "codigo": "CODIGO_EJEMPLO",
    "nombre": "Constructora Norte S.A.S."
  },
  "tipo": "Inicial",
  "estado": "Abierto",
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
  "politicaDevolucion": "Inmediata",
  "separacionDeFunciones": true,
  "etapaActual": 1,
  "etapas": [
    {
      "orden": 1,
      "estado": "Esperando",
      "activadaEn": "2026-11-12T15:00:00Z",
      "aprobadaEn": "2026-11-12T15:00:00Z",
      "areas": [
        {
          "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "codigo": "CODIGO_EJEMPLO",
          "nombre": "Constructora Norte S.A.S.",
          "estado": "Esperando",
          "aprobadoresRequeridos": 1,
          "aprobaciones": 1,
          "aprobacionesFaltantes": 1,
          "miembrosPendientes": [
            "3fa85f64-5717-4562-b3fc-2c963f66afa6"
          ],
          "puedeRechazarExpediente": true,
          "automatica": true,
          "pendienteDesde": "2026-11-12T15:00:00Z",
          "slaVence": "2026-11-12T15:00:00Z",
          "veredictos": [
            {
              "id": null,
              "veredicto": null,
              "origen": null,
              "usuario": null,
              "fecha": null,
              "motivos": null,
              "observacion": null,
              "justificacion": null,
              "vigente": null,
              "superado": null,
              "anulado": null,
              "anuladoPor": null,
              "sobreVersion": null,
              "invalidado": null,
              "derivado": null,
              "campos": null,
              "revertido": null
            }
          ],
          "requisitosPorDecidir": 0,
          "documentosPorDecidir": [
            {
              "requisitoId": null,
              "versionVigente": null,
              "tipoRequisito": null,
              "seccion": null,
              "periodo": null
            }
          ]
        }
      ]
    }
  ],
  "reenvios": 1,
  "ultimaRespuesta": "texto",
  "rechazo": {
    "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "usuario": "texto",
    "motivos": [
      "Texto de ejemplo."
    ],
    "justificacion": "Texto de ejemplo.",
    "fecha": "2026-11-12T15:00:00Z",
    "origen": "texto"
  },
  "motivoAnulacion": "Texto de ejemplo.",
  "abiertoEn": "2026-11-12T15:00:00Z",
  "cerradoEn": "2026-11-12T15:00:00Z",
  "actualizadoEn": "2026-11-12T15:00:00Z",
  "version": 1,
  "requisitos": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tipoDocumento": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "codigo": "CODIGO_EJEMPLO",
        "nombre": "Constructora Norte S.A.S.",
        "tipoCanonico": "texto",
        "ambito": "Global",
        "modo": "texto",
        "campos": [
          {
            "clave": "texto",
            "etiqueta": "texto",
            "tipo": "texto",
            "obligatorio": false,
            "opciones": [
              null
            ],
            "ayuda": "texto"
          }
        ],
        "archivo": {
          "formatos": [
            "texto"
          ],
          "tamanoMaximoBytes": 1,
          "paginasMaximas": 1,
          "descripcion": "Texto de ejemplo."
        },
        "tienePlantilla": false,
        "textoAyuda": "Texto de ejemplo."
      },
      "obligatorio": true,
      "estado": "Pendiente",
      "versionActual": {
        "documentoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "n": 1,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "cargadaEn": "2026-11-12T15:00:00Z",
        "datosDeclarados": [
          {
            "clave": "texto",
            "etiqueta": "texto",
            "tipo": "texto",
            "valor": "vsk_prueba_ejemplo"
          }
        ],
        "vigencia": {
          "vigenteHasta": "2026-11-12",
          "base": "texto",
          "estado": "texto",
          "diasAviso": [
            1
          ],
          "diasGracia": 1,
          "finDeGracia": "2026-11-12",
          "vencidaEn": "2026-11-12T15:00:00Z"
        },
        "estado": "texto",
        "clase": "texto"
      },
      "reenvios": 1,
      "exencion": {
        "por": "texto",
        "justificacion": "Texto de ejemplo.",
        "fecha": "2026-11-12T15:00:00Z",
        "exencionDeVinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
      },
      "areas": [
        {
          "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "codigo": "CODIGO_EJEMPLO",
          "estado": "Esperando",
          "aprobadoresRequeridos": 1,
          "aprobaciones": 1,
          "veredictos": [
            {
              "id": null,
              "veredicto": null,
              "origen": null,
              "usuario": null,
              "fecha": null,
              "motivos": null,
              "observacion": null,
              "justificacion": null,
              "vigente": null,
              "superado": null,
              "anulado": null,
              "anuladoPor": null,
              "sobreVersion": null,
              "invalidado": null,
              "derivado": null,
              "campos": null,
              "revertido": null
            }
          ]
        }
      ],
      "tipoRequisito": "Documento",
      "seccion": {
        "seccion": "texto",
        "nombre": "Constructora Norte S.A.S.",
        "periodo": 1,
        "exigeSoporte": true,
        "completitud": {
          "completa": true,
          "faltantes": [
            {
              "campo": null,
              "regla": null,
              "mensaje": null
            }
          ],
          "reglaVersion": 1
        },
        "versionEvaluada": 1,
        "datos": {},
        "soportes": [
          {
            "documentoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "version": 1,
            "tipoDocumento": "texto",
            "retirado": false,
            "nombre": "Constructora Norte S.A.S."
          }
        ],
        "versionAceptada": 1,
        "cambios": [
          {
            "campo": "texto",
            "etiqueta": "texto",
            "anterior": "texto",
            "nuevo": "texto",
            "tipoCambio": "Agregado"
          }
        ],
        "cruce": {
          "estado": "texto",
          "discrepanciaCritica": true,
          "cruces": [
            {
              "documentoId": null,
              "versionDocumento": null,
              "tipoDocumento": null,
              "nombreDocumento": null,
              "confianza": null,
              "legible": null,
              "fecha": null,
              "coincidencias": null,
              "discrepancias": null,
              "noVerificables": null,
              "discrepanciaCritica": null,
              "campos": null
            }
          ],
          "sinCruce": [
            {
              "documentoId": null,
              "version": null,
              "tipoDocumento": null,
              "nombreDocumento": null,
              "motivo": null
            }
          ]
        },
        "sinSoporte": {
          "critico": true,
          "cambios": [
            {
              "campo": null,
              "etiqueta": null,
              "anterior": null,
              "nuevo": null,
              "tipoCambio": null
            }
          ]
        }
      },
      "soporteDeSecciones": {
        "sinAnalisis": true,
        "discrepanciaCritica": true,
        "secciones": [
          {
            "seccion": "texto",
            "nombre": "Constructora Norte S.A.S.",
            "periodo": 1,
            "version": 1,
            "cruce": {
              "documentoId": null,
              "versionDocumento": null,
              "tipoDocumento": null,
              "nombreDocumento": null,
              "confianza": null,
              "legible": null,
              "fecha": null,
              "coincidencias": null,
              "discrepancias": null,
              "noVerificables": null,
              "discrepanciaCritica": null,
              "campos": null
            }
          }
        ]
      },
      "retiro": {
        "numero": 1,
        "motivo": "Texto de ejemplo.",
        "fecha": "2026-11-12T15:00:00Z"
      },
      "revisionesAutomaticas": [
        {
          "areaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "areaCodigo": "codigo-de-ejemplo",
          "sobreVersion": 1,
          "nivel": "texto",
          "resultado": "texto",
          "sugerencia": "texto",
          "motivos": [
            {
              "codigo": null,
              "texto": null
            }
          ],
          "confianza": 1,
          "fecha": "2026-11-12T15:00:00Z",
          "pendienteDeAtencion": true,
          "resolucion": "texto",
          "resueltaPor": "texto",
          "resueltaEn": "2026-11-12T15:00:00Z",
          "justificacionResolucion": "Texto de ejemplo."
        }
      ],
      "persona": {
        "rol": "texto",
        "todasLasRelaciones": true,
        "sinPersona": true,
        "personaId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "relacionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "nombre": "Constructora Norte S.A.S.",
        "identificacion": "900123456"
      },
      "porQue": [
        {
          "campo": "texto",
          "etiqueta": "texto",
          "valores": [
            "texto"
          ]
        }
      ]
    }
  ],
  "verificaciones": [
    {
      "tipo": "ListasRestrictivas",
      "estado": "Pendiente",
      "bloqueante": true,
      "requeridaPorElFlujo": true,
      "proveedor": "texto",
      "resultado": "texto",
      "referenciaExterna": "REF-0001",
      "registradaEn": "2026-11-12T15:00:00Z",
      "registradaPor": "texto",
      "vigenteHasta": "2026-11-12T15:00:00Z",
      "evidencia": {
        "nombreArchivo": "Nombre de ejemplo",
        "tipoContenido": "Texto de ejemplo.",
        "tamano": 1,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "delProveedor": true,
        "sha256Respuesta": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      "personas": [
        {
          "rol": "texto",
          "nombre": "Constructora Norte S.A.S.",
          "identificacion": "900123456"
        }
      ],
      "coincidencias": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "persona": "texto",
          "rol": "texto",
          "identificacion": "900123456",
          "lista": "texto",
          "nombreEncontrado": "Nombre de ejemplo",
          "detalle": "Texto de ejemplo.",
          "puntaje": 1,
          "decision": "texto",
          "justificacion": "Texto de ejemplo.",
          "resueltaPor": "texto",
          "resueltaEn": "2026-11-12T15:00:00Z",
          "vigenteHasta": "2026-11-12T15:00:00Z",
          "heredada": true
        }
      ],
      "estudio": {
        "verificadoEnListas": true,
        "conflictoDeInteres": true,
        "debidaDiligencia": "Simple",
        "nivelRiesgo": 1,
        "observaciones": "Texto de ejemplo.",
        "evidencias": [
          {
            "documentoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "version": 1,
            "nombre": "Constructora Norte S.A.S."
          }
        ],
        "concepto": "Favorable",
        "oficial": "texto",
        "fecha": "2026-11-12T15:00:00Z",
        "vigenteHasta": "2026-11-12T15:00:00Z",
        "matriz": {
          "puntaje": 1,
          "nivel": 1,
          "nivelPorPuntaje": 1,
          "forzadoPor": "texto",
          "debidaDiligencia": "Simple",
          "mesesRevision": 1,
          "versionMatriz": 1,
          "desglose": [
            {
              "factor": null,
              "factorNombre": null,
              "origen": null,
              "peso": null,
              "opcion": null,
              "opcionNombre": null,
              "puntaje": null,
              "nivelMinimo": null
            }
          ]
        },
        "justificacionDeNivel": "Texto de ejemplo.",
        "adjuntos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "nombre": "Constructora Norte S.A.S.",
            "tipoContenido": "Texto de ejemplo.",
            "tamano": 1,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "proposito": "Estudio",
            "subidoPor": "texto",
            "fecha": "2026-11-12T15:00:00Z"
          }
        ]
      },
      "anteriores": [
        {
          "proveedor": "texto",
          "referenciaExterna": "REF-0001",
          "resultado": "texto",
          "fecha": "2026-11-12T15:00:00Z",
          "coincidencias": 1,
          "conEvidencia": true
        }
      ],
      "ultimoError": "texto",
      "reintentarDesde": "2026-11-12T15:00:00Z",
      "vigenciaDias": 1,
      "frecuenciaReconsultaMeses": 1,
      "fuenteOficial": {
        "datos": {
          "encontrado": true,
          "nit": "900123456",
          "dv": "texto",
          "razonSocial": "Constructora Norte S.A.S.",
          "estado": "texto",
          "estadoNormalizado": "Desconocido",
          "matricula": "texto",
          "camara": "texto",
          "tipoOrganizacion": "texto",
          "ultimoAnoRenovado": 1,
          "fechaMatricula": "2026-11-12",
          "fechaRenovacion": "2026-11-12",
          "fechaCancelacion": "2026-11-12",
          "representantes": [
            {
              "nombre": null,
              "identificacion": null,
              "cargo": null
            }
          ],
          "direccion": "Calle 45 # 12-08",
          "municipio": "texto",
          "actividadPrincipal": "texto",
          "responsabilidades": [
            "texto"
          ],
          "actualizadoEnLaFuente": "2026-11-12"
        },
        "campos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "campo": "texto",
            "etiqueta": "texto",
            "contra": "Fuente",
            "referencia": "REF-0001",
            "oficial": "texto",
            "comparado": "texto",
            "resultado": "Coincide",
            "critico": true,
            "detalle": "Texto de ejemplo.",
            "decision": "texto",
            "justificacion": "Texto de ejemplo.",
            "resueltaPor": "texto",
            "resueltaEn": "2026-11-12T15:00:00Z",
            "vigenteHasta": "2026-11-12T15:00:00Z",
            "heredada": true
          }
        ]
      }
    }
  ],
  "esperandoVerificaciones": false,
  "plazoCargue": {
    "dias": 1,
    "recordatorios": [
      1
    ],
    "hasta": "2026-11-12T15:00:00Z",
    "recordatoriosEnviados": [
      1
    ],
    "caducadoEn": "2026-11-12T15:00:00Z",
    "estadoAlReabrir": "texto",
    "reaperturas": 1
  },
  "desaprobaciones": 0,
  "ultimaDesaprobacion": {
    "etapa": 1,
    "alcance": "texto",
    "usuario": "texto",
    "justificacion": "Texto de ejemplo.",
    "fecha": "2026-11-12T15:00:00Z"
  },
  "recordatorioObservaciones": {
    "ultimoEn": "2026-11-12T15:00:00Z",
    "total": 1
  },
  "adjuntosDeCumplimiento": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "nombre": "Constructora Norte S.A.S.",
      "tipoContenido": "Texto de ejemplo.",
      "tamano": 1,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "proposito": "Estudio",
      "subidoPor": "texto",
      "fecha": "2026-11-12T15:00:00Z"
    }
  ],
  "esperandoCuentaDesignada": false,
  "evaluaciones": [
    {
      "evaluacionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "codigo": "CODIGO_EJEMPLO",
      "nombre": "Constructora Norte S.A.S.",
      "responde": "Tercero",
      "efecto": "Observar",
      "estado": "Pendiente",
      "puntaje": 1,
      "actualizadaEn": "2026-11-12T15:00:00Z"
    }
  ],
  "esperandoEvaluaciones": false
}
```

</details>

### `GET /api/v1/vinculos/{id}/monitoreo-fuentes-oficiales`

**Obtener monitoreo fuentes oficiales.** Monitoreo de las fuentes oficiales del vínculo (FO-7): la última reconsulta de cada fuente y la próxima. 404 `monitoreo-no-encontrado`.

**Permiso expedientes:leer · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `obtenerMonitoreoFuentesOficiales`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |

**Respuestas**

- `200` OK — MonitoreoFuentesOficialesDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `vinculoId` | uuid | sí |  |
| `expedienteId` | uuid | sí |  |
| `folio` | texto | sí |  |
| `frecuenciaDias` | entero | sí |  |
| `proximaConsulta` | fecha y hora o null | no |  |
| `fuentes` | lista de VerificacionDto | sí |  |
| `fuentes[].tipo` | TipoVerificacion (texto) | sí | valores: ListasRestrictivas · EstudioDeCumplimiento · Rues · Dian |
| `fuentes[].estado` | EstadoVerificacion (texto) | sí | valores: Pendiente · CoincidenciaPorAnalizar · Satisfecha · Fallida · Expirada |
| `fuentes[].bloqueante` | booleano | sí |  |
| `fuentes[].requeridaPorElFlujo` | booleano | sí |  |
| `fuentes[].proveedor` | texto o null | no |  |
| `fuentes[].resultado` | texto o null | no |  |
| `fuentes[].referenciaExterna` | texto o null | no |  |
| `fuentes[].registradaEn` | fecha y hora o null | no |  |
| `fuentes[].registradaPor` | texto o null | no |  |
| `fuentes[].vigenteHasta` | fecha y hora o null | no |  |
| `fuentes[].evidencia` | EvidenciaVerificacionDto o null | no |  |
| `fuentes[].evidencia.nombreArchivo` | texto | sí |  |
| `fuentes[].evidencia.tipoContenido` | texto | sí |  |
| `fuentes[].evidencia.tamano` | entero | sí |  |
| `fuentes[].evidencia.sha256` | texto | sí |  |
| `fuentes[].evidencia.delProveedor` | booleano | sí |  |
| `fuentes[].evidencia.sha256Respuesta` | texto o null | no |  |
| `fuentes[].personas` | lista de PersonaConsultadaDto | sí |  |
| `fuentes[].personas[].rol` | texto | sí |  |
| `fuentes[].personas[].nombre` | texto | sí |  |
| `fuentes[].personas[].identificacion` | texto | sí |  |
| `fuentes[].coincidencias` | lista de CoincidenciaDto | sí |  |
| `fuentes[].coincidencias[].id` | uuid | sí |  |
| `fuentes[].coincidencias[].persona` | texto | sí |  |
| `fuentes[].coincidencias[].rol` | texto | sí |  |
| `fuentes[].coincidencias[].identificacion` | texto | sí |  |
| `fuentes[].coincidencias[].lista` | texto | sí |  |
| `fuentes[].coincidencias[].nombreEncontrado` | texto | sí |  |
| `fuentes[].coincidencias[].detalle` | texto o null | no |  |
| `fuentes[].coincidencias[].puntaje` | number \| string o null | no | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `fuentes[].coincidencias[].decision` | texto o null | no |  |
| `fuentes[].coincidencias[].justificacion` | texto o null | no |  |
| `fuentes[].coincidencias[].resueltaPor` | texto o null | no |  |
| `fuentes[].coincidencias[].resueltaEn` | fecha y hora o null | no |  |
| `fuentes[].coincidencias[].vigenteHasta` | fecha y hora o null | no |  |
| `fuentes[].coincidencias[].heredada` | booleano | sí |  |
| `fuentes[].estudio` | EstudioCumplimientoDto o null | no |  |
| `fuentes[].estudio.verificadoEnListas` | booleano | sí |  |
| `fuentes[].estudio.conflictoDeInteres` | booleano | sí |  |
| `fuentes[].estudio.debidaDiligencia` | DebidaDiligencia (texto) | sí | valores: Simple · Ordinaria · Ampliada |
| `fuentes[].estudio.nivelRiesgo` | entero | sí |  |
| `fuentes[].estudio.observaciones` | texto o null | no |  |
| `fuentes[].estudio.evidencias` | lista de EvidenciaEstudioDto | sí |  |
| `fuentes[].estudio.evidencias[].documentoId` | uuid | sí |  |
| `fuentes[].estudio.evidencias[].version` | entero | sí |  |
| `fuentes[].estudio.evidencias[].nombre` | texto o null | no |  |
| `fuentes[].estudio.concepto` | ConceptoCumplimiento (texto) | sí | valores: Favorable · Desfavorable |
| `fuentes[].estudio.oficial` | texto | sí |  |
| `fuentes[].estudio.fecha` | fecha y hora | sí |  |
| `fuentes[].estudio.vigenteHasta` | fecha y hora | sí |  |
| `fuentes[].estudio.matriz` | ResultadoDeMatrizDto o null | no |  |
| `fuentes[].estudio.matriz.puntaje` | number \| string | sí | patrón ^-?(?:0\|[1-9]\d*)(?:\.\d+)?$ |
| `fuentes[].estudio.matriz.nivel` | entero | sí |  |
| `fuentes[].estudio.matriz.nivelPorPuntaje` | entero | sí |  |
| `fuentes[].estudio.matriz.forzadoPor` | texto o null | no |  |
| `fuentes[].estudio.matriz.debidaDiligencia` | DebidaDiligencia (texto) | sí | valores: Simple · Ordinaria · Ampliada |
| `fuentes[].estudio.matriz.mesesRevision` | entero | sí |  |
| `fuentes[].estudio.matriz.versionMatriz` | entero | sí |  |
| `fuentes[].estudio.matriz.desglose` | lista de DesgloseDeMatrizDto | sí |  |
| `fuentes[].estudio.matriz.desglose[].factor` | texto | sí |  |
| `fuentes[].estudio.matriz.desglose[].factorNombre` | texto | sí |  |
| `fuentes[].estudio.matriz.desglose[].origen` | OrigenDelFactor (texto) | sí | valores: Manual · Automatico |
| `fuentes[].estudio.matriz.desglose[].peso` | entero | sí |  |
| `fuentes[].estudio.matriz.desglose[].opcion` | texto | sí |  |
| `fuentes[].estudio.matriz.desglose[].opcionNombre` | texto | sí |  |
| `fuentes[].estudio.matriz.desglose[].puntaje` | entero | sí |  |
| `fuentes[].estudio.matriz.desglose[].nivelMinimo` | entero o null | no |  |
| `fuentes[].estudio.justificacionDeNivel` | texto o null | no |  |
| `fuentes[].estudio.adjuntos` | lista de AdjuntoDeCumplimientoDto o null | no |  |
| `fuentes[].estudio.adjuntos[].id` | uuid | sí |  |
| `fuentes[].estudio.adjuntos[].nombre` | texto | sí |  |
| `fuentes[].estudio.adjuntos[].tipoContenido` | texto | sí |  |
| `fuentes[].estudio.adjuntos[].tamano` | entero | sí |  |
| `fuentes[].estudio.adjuntos[].sha256` | texto | sí |  |
| `fuentes[].estudio.adjuntos[].proposito` | PropositoDeAdjunto (texto) | sí | valores: Estudio · ConsultaManual |
| `fuentes[].estudio.adjuntos[].subidoPor` | texto | sí |  |
| `fuentes[].estudio.adjuntos[].fecha` | fecha y hora | sí |  |
| `fuentes[].anteriores` | lista de ConsultaAnteriorDto | sí |  |
| `fuentes[].anteriores[].proveedor` | texto | sí |  |
| `fuentes[].anteriores[].referenciaExterna` | texto | sí |  |
| `fuentes[].anteriores[].resultado` | texto | sí |  |
| `fuentes[].anteriores[].fecha` | fecha y hora | sí |  |
| `fuentes[].anteriores[].coincidencias` | entero | sí |  |
| `fuentes[].anteriores[].conEvidencia` | booleano | sí |  |
| `fuentes[].ultimoError` | texto o null | no |  |
| `fuentes[].reintentarDesde` | fecha y hora o null | no |  |
| `fuentes[].vigenciaDias` | entero o null | no |  |
| `fuentes[].frecuenciaReconsultaMeses` | entero o null | no |  |
| `fuentes[].fuenteOficial` | FuenteOficialDto o null | no |  |
| `fuentes[].fuenteOficial.datos` | DatosOficialesDto | sí |  |
| `fuentes[].fuenteOficial.datos.encontrado` | booleano | sí |  |
| `fuentes[].fuenteOficial.datos.nit` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.dv` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.razonSocial` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.estado` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.estadoNormalizado` | EstadoOficial (texto) | sí | valores: Desconocido · Vigente · NoVigente |
| `fuentes[].fuenteOficial.datos.matricula` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.camara` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.tipoOrganizacion` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.ultimoAnoRenovado` | entero o null | no |  |
| `fuentes[].fuenteOficial.datos.fechaMatricula` | fecha o null | no |  |
| `fuentes[].fuenteOficial.datos.fechaRenovacion` | fecha o null | no |  |
| `fuentes[].fuenteOficial.datos.fechaCancelacion` | fecha o null | no |  |
| `fuentes[].fuenteOficial.datos.representantes` | lista de RepresentanteOficialDto | sí |  |
| `fuentes[].fuenteOficial.datos.representantes[].nombre` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.representantes[].identificacion` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.representantes[].cargo` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.direccion` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.municipio` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.actividadPrincipal` | texto o null | no |  |
| `fuentes[].fuenteOficial.datos.responsabilidades` | lista de texto | sí |  |
| `fuentes[].fuenteOficial.datos.actualizadoEnLaFuente` | fecha o null | no |  |
| `fuentes[].fuenteOficial.campos` | lista de CampoCotejadoDto | sí |  |
| `fuentes[].fuenteOficial.campos[].id` | uuid | sí |  |
| `fuentes[].fuenteOficial.campos[].campo` | texto | sí |  |
| `fuentes[].fuenteOficial.campos[].etiqueta` | texto | sí |  |
| `fuentes[].fuenteOficial.campos[].contra` | OrigenDelCotejo (texto) | sí | valores: Fuente · Ficha · Documento |
| `fuentes[].fuenteOficial.campos[].referencia` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].oficial` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].comparado` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].resultado` | ResultadoDeCotejo (texto) | sí | valores: Coincide · Discrepa · NoVerificable |
| `fuentes[].fuenteOficial.campos[].critico` | booleano | sí |  |
| `fuentes[].fuenteOficial.campos[].detalle` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].decision` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].justificacion` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].resueltaPor` | texto o null | no |  |
| `fuentes[].fuenteOficial.campos[].resueltaEn` | fecha y hora o null | no |  |
| `fuentes[].fuenteOficial.campos[].vigenteHasta` | fecha y hora o null | no |  |
| `fuentes[].fuenteOficial.campos[].heredada` | booleano | sí |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/monitoreo-fuentes-oficiales" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID"
```

Respuesta `200`:

```json
{
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "frecuenciaDias": 1,
  "proximaConsulta": "2026-11-12T15:00:00Z",
  "fuentes": [
    {
      "tipo": "ListasRestrictivas",
      "estado": "Pendiente",
      "bloqueante": true,
      "requeridaPorElFlujo": true,
      "proveedor": "texto",
      "resultado": "texto",
      "referenciaExterna": "REF-0001",
      "registradaEn": "2026-11-12T15:00:00Z",
      "registradaPor": "texto",
      "vigenteHasta": "2026-11-12T15:00:00Z",
      "evidencia": {
        "nombreArchivo": "Nombre de ejemplo",
        "tipoContenido": "Texto de ejemplo.",
        "tamano": 1,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "delProveedor": true,
        "sha256Respuesta": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      "personas": [
        {
          "rol": "texto",
          "nombre": "Constructora Norte S.A.S.",
          "identificacion": "900123456"
        }
      ],
      "coincidencias": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "persona": "texto",
          "rol": "texto",
          "identificacion": "900123456",
          "lista": "texto",
          "nombreEncontrado": "Nombre de ejemplo",
          "detalle": "Texto de ejemplo.",
          "puntaje": 1,
          "decision": "texto",
          "justificacion": "Texto de ejemplo.",
          "resueltaPor": "texto",
          "resueltaEn": "2026-11-12T15:00:00Z",
          "vigenteHasta": "2026-11-12T15:00:00Z",
          "heredada": true
        }
      ],
      "estudio": {
        "verificadoEnListas": true,
        "conflictoDeInteres": true,
        "debidaDiligencia": "Simple",
        "nivelRiesgo": 1,
        "observaciones": "Texto de ejemplo.",
        "evidencias": [
          {
            "documentoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "version": 1,
            "nombre": "Constructora Norte S.A.S."
          }
        ],
        "concepto": "Favorable",
        "oficial": "texto",
        "fecha": "2026-11-12T15:00:00Z",
        "vigenteHasta": "2026-11-12T15:00:00Z",
        "matriz": {
          "puntaje": 1,
          "nivel": 1,
          "nivelPorPuntaje": 1,
          "forzadoPor": "texto",
          "debidaDiligencia": "Simple",
          "mesesRevision": 1,
          "versionMatriz": 1,
          "desglose": [
            {
              "factor": null,
              "factorNombre": null,
              "origen": null,
              "peso": null,
              "opcion": null,
              "opcionNombre": null,
              "puntaje": null,
              "nivelMinimo": null
            }
          ]
        },
        "justificacionDeNivel": "Texto de ejemplo.",
        "adjuntos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "nombre": "Constructora Norte S.A.S.",
            "tipoContenido": "Texto de ejemplo.",
            "tamano": 1,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "proposito": "Estudio",
            "subidoPor": "texto",
            "fecha": "2026-11-12T15:00:00Z"
          }
        ]
      },
      "anteriores": [
        {
          "proveedor": "texto",
          "referenciaExterna": "REF-0001",
          "resultado": "texto",
          "fecha": "2026-11-12T15:00:00Z",
          "coincidencias": 1,
          "conEvidencia": true
        }
      ],
      "ultimoError": "texto",
      "reintentarDesde": "2026-11-12T15:00:00Z",
      "vigenciaDias": 1,
      "frecuenciaReconsultaMeses": 1,
      "fuenteOficial": {
        "datos": {
          "encontrado": true,
          "nit": "900123456",
          "dv": "texto",
          "razonSocial": "Constructora Norte S.A.S.",
          "estado": "texto",
          "estadoNormalizado": "Desconocido",
          "matricula": "texto",
          "camara": "texto",
          "tipoOrganizacion": "texto",
          "ultimoAnoRenovado": 1,
          "fechaMatricula": "2026-11-12",
          "fechaRenovacion": "2026-11-12",
          "fechaCancelacion": "2026-11-12",
          "representantes": [
            {
              "nombre": null,
              "identificacion": null,
              "cargo": null
            }
          ],
          "direccion": "Calle 45 # 12-08",
          "municipio": "texto",
          "actividadPrincipal": "texto",
          "responsabilidades": [
            "texto"
          ],
          "actualizadoEnLaFuente": "2026-11-12"
        },
        "campos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "campo": "texto",
            "etiqueta": "texto",
            "contra": "Fuente",
            "referencia": "REF-0001",
            "oficial": "texto",
            "comparado": "texto",
            "resultado": "Coincide",
            "critico": true,
            "detalle": "Texto de ejemplo.",
            "decision": "texto",
            "justificacion": "Texto de ejemplo.",
            "resueltaPor": "texto",
            "resueltaEn": "2026-11-12T15:00:00Z",
            "vigenteHasta": "2026-11-12T15:00:00Z",
            "heredada": true
          }
        ]
      }
    }
  ]
}
```

</details>

### `POST /api/v1/vinculos/{id}/monitoreo-fuentes-oficiales/{tipo}/diferencias/{campoId}/resolver`

**Resolver diferencia monitoreo de fuente.** Resuelve una diferencia del monitoreo con las mismas reglas que en el expediente; queda en la auditoría (`MonitoreoDeFuentesOficiales`). Confirmada: el administrador decide bloquear o desvincular (nunca automático).

**Permiso cumplimiento:decidir · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `resolverDiferenciaMonitoreoDeFuente`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `tipo` | path | texto | sí |  |
| `campoId` | path | uuid | sí |  |

**Cuerpo de la petición** (`application/json`, ResolverCoincidenciaDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `decision` | DecisionCoincidencia (texto) | sí | valores: Descartada · Confirmada |
| `justificacion` | texto | sí |  |

**Respuestas**

- `200` OK — MonitoreoFuentesOficialesDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `MonitoreoFuentesOficialesDto` que se detallan en `GET /api/v1/vinculos/{id}/monitoreo-fuentes-oficiales`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/monitoreo-fuentes-oficiales/texto/diferencias/3fa85f64-5717-4562-b3fc-2c963f66afa6/resolver" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Empresa: $EMPRESA_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"decision":"Descartada","justificacion":"Texto de ejemplo."}'
```

Respuesta `200`:

```json
{
  "vinculoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "expedienteId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "folio": "texto",
  "frecuenciaDias": 1,
  "proximaConsulta": "2026-11-12T15:00:00Z",
  "fuentes": [
    {
      "tipo": "ListasRestrictivas",
      "estado": "Pendiente",
      "bloqueante": true,
      "requeridaPorElFlujo": true,
      "proveedor": "texto",
      "resultado": "texto",
      "referenciaExterna": "REF-0001",
      "registradaEn": "2026-11-12T15:00:00Z",
      "registradaPor": "texto",
      "vigenteHasta": "2026-11-12T15:00:00Z",
      "evidencia": {
        "nombreArchivo": "Nombre de ejemplo",
        "tipoContenido": "Texto de ejemplo.",
        "tamano": 1,
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "delProveedor": true,
        "sha256Respuesta": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      "personas": [
        {
          "rol": "texto",
          "nombre": "Constructora Norte S.A.S.",
          "identificacion": "900123456"
        }
      ],
      "coincidencias": [
        {
          "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "persona": "texto",
          "rol": "texto",
          "identificacion": "900123456",
          "lista": "texto",
          "nombreEncontrado": "Nombre de ejemplo",
          "detalle": "Texto de ejemplo.",
          "puntaje": 1,
          "decision": "texto",
          "justificacion": "Texto de ejemplo.",
          "resueltaPor": "texto",
          "resueltaEn": "2026-11-12T15:00:00Z",
          "vigenteHasta": "2026-11-12T15:00:00Z",
          "heredada": true
        }
      ],
      "estudio": {
        "verificadoEnListas": true,
        "conflictoDeInteres": true,
        "debidaDiligencia": "Simple",
        "nivelRiesgo": 1,
        "observaciones": "Texto de ejemplo.",
        "evidencias": [
          {
            "documentoId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "version": 1,
            "nombre": "Constructora Norte S.A.S."
          }
        ],
        "concepto": "Favorable",
        "oficial": "texto",
        "fecha": "2026-11-12T15:00:00Z",
        "vigenteHasta": "2026-11-12T15:00:00Z",
        "matriz": {
          "puntaje": 1,
          "nivel": 1,
          "nivelPorPuntaje": 1,
          "forzadoPor": "texto",
          "debidaDiligencia": "Simple",
          "mesesRevision": 1,
          "versionMatriz": 1,
          "desglose": [
            {
              "factor": null,
              "factorNombre": null,
              "origen": null,
              "peso": null,
              "opcion": null,
              "opcionNombre": null,
              "puntaje": null,
              "nivelMinimo": null
            }
          ]
        },
        "justificacionDeNivel": "Texto de ejemplo.",
        "adjuntos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "nombre": "Constructora Norte S.A.S.",
            "tipoContenido": "Texto de ejemplo.",
            "tamano": 1,
            "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "proposito": "Estudio",
            "subidoPor": "texto",
            "fecha": "2026-11-12T15:00:00Z"
          }
        ]
      },
      "anteriores": [
        {
          "proveedor": "texto",
          "referenciaExterna": "REF-0001",
          "resultado": "texto",
          "fecha": "2026-11-12T15:00:00Z",
          "coincidencias": 1,
          "conEvidencia": true
        }
      ],
      "ultimoError": "texto",
      "reintentarDesde": "2026-11-12T15:00:00Z",
      "vigenciaDias": 1,
      "frecuenciaReconsultaMeses": 1,
      "fuenteOficial": {
        "datos": {
          "encontrado": true,
          "nit": "900123456",
          "dv": "texto",
          "razonSocial": "Constructora Norte S.A.S.",
          "estado": "texto",
          "estadoNormalizado": "Desconocido",
          "matricula": "texto",
          "camara": "texto",
          "tipoOrganizacion": "texto",
          "ultimoAnoRenovado": 1,
          "fechaMatricula": "2026-11-12",
          "fechaRenovacion": "2026-11-12",
          "fechaCancelacion": "2026-11-12",
          "representantes": [
            {
              "nombre": null,
              "identificacion": null,
              "cargo": null
            }
          ],
          "direccion": "Calle 45 # 12-08",
          "municipio": "texto",
          "actividadPrincipal": "texto",
          "responsabilidades": [
            "texto"
          ],
          "actualizadoEnLaFuente": "2026-11-12"
        },
        "campos": [
          {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "campo": "texto",
            "etiqueta": "texto",
            "contra": "Fuente",
            "referencia": "REF-0001",
            "oficial": "texto",
            "comparado": "texto",
            "resultado": "Coincide",
            "critico": true,
            "detalle": "Texto de ejemplo.",
            "decision": "texto",
            "justificacion": "Texto de ejemplo.",
            "resueltaPor": "texto",
            "resueltaEn": "2026-11-12T15:00:00Z",
            "vigenteHasta": "2026-11-12T15:00:00Z",
            "heredada": true
          }
        ]
      }
    }
  ]
}
```

</details>

### `POST /api/v1/vinculos/{id}/monitoreo-fuentes-oficiales/{tipo}/evidencia/descarga`

**Descargar evidencia monitoreo de fuente.** URL prefirmada de la constancia de la última reconsulta de una fuente del monitoreo (la entrega queda en la auditoría).

**Permiso documentos:descargar · Empresa activa (`X-Empresa`) · API (`/api/v1`) · SDK: `descargarEvidenciaMonitoreoDeFuente`**

**Parámetros**

| Nombre | En | Tipo | Requerido | Detalle |
|---|---|---|---|---|
| `id` | path | uuid | sí |  |
| `tipo` | path | texto | sí |  |

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

- `404` `evidencia-no-encontrada`

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X POST "https://{host}/api/v1/vinculos/3fa85f64-5717-4562-b3fc-2c963f66afa6/monitoreo-fuentes-oficiales/texto/evidencia/descarga" \
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

## Fuentes oficiales de plataforma

Cuenta de la plataforma con los proveedores de las fuentes oficiales (FO-5): el token de datos.gov.co, la API contratada con Confecámaras o con quien consulte el RUT de la DIAN, y el proveedor predeterminado de cada fuente. La configura Plataforma desde su consola; la clave es de solo escritura (vuelve «configurada · …1234») y se cifra con la clave maestra, como las demás credenciales de la plataforma. Las empresas consultan con ella sin verla; una empresa puede traer las suyas. Todo cambio queda en la auditoría, sin la clave.

### `GET /api/v1/plataforma/fuentes-oficiales`

**Obtener fuentes de plataforma.**

**Operador de Plataforma · API (`/api/v1`) · SDK: `obtenerFuentesDePlataforma`**

**Respuestas**

- `200` OK — FuentesDePlataformaDto
- `404` No encontrado

Campos de la respuesta `200`:

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `fuentes` | lista de FuentePlataformaDto | sí |  |
| `fuentes[].fuente` | texto | sí |  |
| `fuentes[].nombre` | texto | sí |  |
| `fuentes[].descripcion` | texto | sí |  |
| `fuentes[].predeterminado` | texto o null | no |  |
| `fuentes[].proveedores` | lista de ProveedorDePlataformaFuenteDto | sí |  |
| `fuentes[].proveedores[].nombre` | texto | sí |  |
| `fuentes[].proveedores[].habilitadoEnInstalacion` | booleano | sí |  |
| `fuentes[].proveedores[].configurado` | booleano | sí |  |
| `fuentes[].proveedores[].usuario` | texto o null | no |  |
| `fuentes[].proveedores[].ultimosCuatroClave` | texto o null | no |  |
| `fuentes[].proveedores[].urlBase` | texto o null | no |  |
| `fuentes[].proveedores[].notas` | texto o null | no |  |
| `fuentes[].proveedores[].actualizadasEn` | fecha y hora o null | no |  |
| `actualizadaEn` | fecha y hora o null | no |  |
| `actualizadaPor` | texto o null | no |  |

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X GET "https://{host}/api/v1/plataforma/fuentes-oficiales" \
  -H "X-Api-Key: $CLAVE_DE_PLATAFORMA"
```

Respuesta `200`:

```json
{
  "fuentes": [
    {
      "fuente": "texto",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "predeterminado": "texto",
      "proveedores": [
        {
          "nombre": "Constructora Norte S.A.S.",
          "habilitadoEnInstalacion": true,
          "configurado": true,
          "usuario": "texto",
          "ultimosCuatroClave": "texto",
          "urlBase": "https://ejemplo.co/recurso",
          "notas": "Texto de ejemplo.",
          "actualizadasEn": "2026-11-12T15:00:00Z"
        }
      ]
    }
  ],
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "actualizadaPor": "texto"
}
```

</details>

### `PUT /api/v1/plataforma/fuentes-oficiales`

**Actualizar fuentes de plataforma.** Crea, cambia o quita (`clave: ""`) las credenciales de un proveedor real de una fuente y/o fija el proveedor predeterminado (`proveedor` vacío = ninguno: manda el de la instalación). Exige confirmar con la passkey (la clave es de todos los clientes). 422 `fuente-oficial-invalida`, `proveedor-invalido`, `usuario-de-fuente-invalido`, `clave-invalida`, `url-invalida`, `notas-invalidas`, `credenciales-vacias`.

**Operador de Plataforma · API (`/api/v1`) · SDK: `actualizarFuentesDePlataforma`**

**Cuerpo de la petición** (`application/json`, ActualizarFuentesDePlataformaDto)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `credenciales` | CredencialesFuenteDto o null | no |  |
| `credenciales.fuente` | texto | sí |  |
| `credenciales.proveedor` | texto | sí |  |
| `credenciales.usuario` | texto o null | no |  |
| `credenciales.clave` | texto o null | no |  |
| `credenciales.urlBase` | texto o null | no |  |
| `credenciales.notas` | texto o null | no |  |
| `predeterminados` | lista de EleccionDeProveedorDto o null | no |  |
| `predeterminados[].fuente` | texto | sí |  |
| `predeterminados[].proveedor` | texto o null | no |  |

**Respuestas**

- `200` OK — FuentesDePlataformaDto
- `404` No encontrado

Campos de la respuesta `200`:

Mismos campos de `FuentesDePlataformaDto` que se detallan en `GET /api/v1/plataforma/fuentes-oficiales`.

<details><summary>Ejemplo de petición y respuesta</summary>

```bash
curl -X PUT "https://{host}/api/v1/plataforma/fuentes-oficiales" \
  -H "X-Api-Key: $CLAVE_DE_PLATAFORMA" \
  -H "Content-Type: application/json" \
  -d '{"credenciales":{"fuente":"texto","proveedor":"texto","usuario":"texto","clave":"texto","urlBase":"https://ejemplo.co/recurso","notas":"Texto de ejemplo."},"predeterminados":[{"fuente":"texto","proveedor":"texto"}]}'
```

Respuesta `200`:

```json
{
  "fuentes": [
    {
      "fuente": "texto",
      "nombre": "Constructora Norte S.A.S.",
      "descripcion": "Texto de ejemplo.",
      "predeterminado": "texto",
      "proveedores": [
        {
          "nombre": "Constructora Norte S.A.S.",
          "habilitadoEnInstalacion": true,
          "configurado": true,
          "usuario": "texto",
          "ultimosCuatroClave": "texto",
          "urlBase": "https://ejemplo.co/recurso",
          "notas": "Texto de ejemplo.",
          "actualizadasEn": "2026-11-12T15:00:00Z"
        }
      ]
    }
  ],
  "actualizadaEn": "2026-11-12T15:00:00Z",
  "actualizadaPor": "texto"
}
```

</details>
