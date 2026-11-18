---
titulo: "Variables de entorno del despliegue"
seccion: "Configuración y glosario"
orden: 34
resumen: "Toda la configuración de servidor de AvalaSoft: qué clave es obligatoria, qué hace cada una y su valor por defecto. Se leen del entorno, de appsettings o de ambos."
---

AvalaSoft usa la configuración estándar de .NET: cada clave `Avalasoft:Grupo:Nombre` de `appsettings.json` se puede fijar con una variable de entorno que usa dos guiones bajos como separador, por ejemplo `Avalasoft__Almacen__Endpoint`. Las listas se numeran (`Avalasoft__Webhooks__Reintentos__0=00:01:00`). Lo de **esta página se cambia por despliegue**, no desde la app; lo que se cambia desde la app está en [Configuración del grupo](guia:configuracion-del-grupo), [de la empresa](guia:configuracion-de-la-empresa) y [de Plataforma](guia:configuracion-de-plataforma). Cómo se despliega está en [Despliegue](guia:arquitectura-despliegue).

> **Importante:** nunca pongas secretos reales en el repositorio, en una imagen ni en un `appsettings` versionado. Las claves y contraseñas de `appsettings.Development.json` y de `infra/compose/compose.yaml` son solo para desarrollo local y llevan «solo local» en su valor. **Fuera de `Development` la API no arranca con ellas**: ver «Claves propias del entorno».

## Claves propias del entorno

Cuatro claves están publicadas en el repositorio con valores de desarrollo (`appsettings.Development.json` e `infra/compose/compose.yaml`). **Fuera de `Development` la API no arranca** si alguna conserva ese valor, si su valor lleva el rótulo «solo local» o si falta una obligatoria: el error nombra la clave de configuración y nunca muestra el valor. Cada entorno (pruebas, preproducción, producción) necesita las suyas, distintas entre sí.

| Clave | Formato | Cómo generarla |
|---|---|---|
| `Avalasoft__Secretos__ClaveMaestra` | 32 bytes aleatorios en base64 | `openssl rand -base64 32` |
| `Avalasoft__Certificados__ClavePrivada` | Semilla Ed25519: 32 bytes aleatorios en base64 | `openssl rand -base64 32` |
| `Avalasoft__Sesiones__ClaveFirma` | Texto de al menos 32 bytes | `openssl rand -hex 32` (64 caracteres) |
| `Avalasoft__Plataforma__ClaveBootstrap` | Texto de al menos 32 caracteres; es opcional | `openssl rand -hex 32` |

Sin `openssl`, en PowerShell: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` da una clave en base64 y `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()` una en texto hexadecimal.

Se entregan como secretos de configuración (variables de entorno del orquestador, archivo `_FILE` o Key Vault), nunca en la imagen ni en el repositorio. Perder la maestra o la semilla del sello no tiene vuelta atrás ([Despliegue](guia:arquitectura-despliegue)): respáldalas en el gestor de secretos. Cómo se rotan está en `ClavesAnteriores` (secretos) y en «Rotar la clave de sellado» (certificados), más abajo.

## Obligatorias

Sin estas la API no arranca o parte de ella no funciona.

| Variable | Para qué sirve | Qué pasa sin ella |
|---|---|---|
| `ConnectionStrings__Avalasoft` | Cadena de conexión de PostgreSQL 17 (`Host=…;Port=5432;Database=…;Username=…;Password=…`). | La API no arranca. |
| `Avalasoft__Secretos__ClaveMaestra` | 32 bytes aleatorios en base64. Cifra los secretos en reposo (llaves de OpenAI, secretos de webhook, números de cuenta, credenciales de listas) y deriva la clave de datos de cada grupo y de cada tercero. | La API no arranca (tampoco con la de desarrollo fuera de `Development`). |
| `Avalasoft__Certificados__ClavePrivada` | Semilla Ed25519 de 32 bytes en base64 con la que se sellan los certificados. | La API no arranca (tampoco con la de desarrollo fuera de `Development`). |
| `Avalasoft__Sesiones__ClaveFirma` | Clave (al menos 32 bytes) con la que se firman las sesiones de las personas, del tercero y de Plataforma. | La API no arranca fuera de `Development` (tampoco con la de desarrollo ni con menos de 32 bytes). |
| `Avalasoft__Almacen__Endpoint`, `__AccessKey` y `__SecretKey` | Almacén S3 compatible (MinIO u otro) de los documentos. | No se pueden subir ni descargar archivos. |
| `Avalasoft__Correo__Host` (y `__Puerto`, `__Seguridad`, `__Usuario`, `__Clave`) | Servidor SMTP de salida. | No salen correos. |
| `Avalasoft__Correo__UrlPublica` | URL pública con la que se arman los enlaces de los correos (`/e/{token}`, `/verificar/{folio}`). | Usa `http://localhost:5173`. |

## Opcionales de arranque y acceso

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Development` activa la documentación interactiva `/docs` (Scalar), la semilla de catálogos de la ficha y los valores de `appsettings.Development.json`. Es el único entorno que admite las claves de desarrollo del repositorio; en cualquier otro la API se niega a arrancar con ellas. | Producción |
| `ASPNETCORE_HTTP_PORTS` | Puerto HTTP del proceso. | `8080` en la imagen |
| `Avalasoft__Plataforma__ClaveBootstrap` | Clave de arranque de Plataforma (al menos 32 caracteres): sirve para dar de alta al primer operador, canjear sesiones del backoffice y entrar con soporte. Se puede desactivar desde la consola. Fuera de `Development` no puede ser la de desarrollo del repositorio. | Vacío: sin acceso por clave de arranque |
| `Avalasoft__Secretos__ClavesAnteriores` y `__ClavesFirmaHeredadas` | Claves maestras y de firma anteriores, para descifrar lo viejo mientras se rota. | Vacío |
| `Avalasoft__Persistencia__CrearEsquemaAlIniciar` | `true` crea y actualiza el esquema de la base al arrancar (solo desarrollo); en producción se aplica antes con `dotnet Avalasoft.Api.dll db-apply`. | `false` |
| `Avalasoft__Apps__Web` y `Avalasoft__Apps__Publica` | Carpetas de las apps estáticas que sirve la API (`/app/` y `/`). La imagen las fija en `frontend/web` y `frontend/public`. | Vacío: la API no las sirve |
| `Avalasoft__ZonaHoraria` | Zona IANA del calendario del negocio (vencimientos y «hoy»). | `America/Bogota` |
| `Avalasoft__Lider__Habilitado` | Elección del nodo líder de los procesos periódicos con un bloqueo consultivo de PostgreSQL. `false` hace que cada nodo corra todos los procesos (una sola réplica). Con `__SegundosEspera` (10) cada cuánto reintenta una réplica que no es líder. | `true` |
| `Avalasoft__Invalidaciones__Activo` | Aviso entre servidores por `LISTEN/NOTIFY` de PostgreSQL (cachés de llaves, sistemas, ingreso y SSO). | `true` |

## Sesiones, ingreso y SSO

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__SesionTercero__CookieSegura` | Cookie de la sesión del tercero con `Secure`. | `true` (en desarrollo por http se apaga) |
| `Avalasoft__Ingreso__CookieSegura` | Lo mismo para las personas del grupo; si falta usa la del tercero. | La del tercero |
| `Avalasoft__Ingreso__MinutosAcceso` | Vida del token de acceso de una sesión directa. | `15` |
| `Avalasoft__Ingreso__MinutosLimpieza` | Cada cuántos minutos se limpian ingresos vencidos. | `10` |
| `Avalasoft__Ingreso__Passkeys__Nombre`, `__RpId` y `__Origenes` | Nombre, dominio (Relying Party) y orígenes permitidos de las passkeys (WebAuthn). El `RpId` debe ser el dominio desde el que se sirve la app. | `AvalaSoft`, vacío y vacío |
| `Avalasoft__Ingreso__Plataforma__SesionHoras` y `__InactividadMinutos` | Duración y cierre por inactividad de la sesión de un operador de Plataforma. | `8` y `30` |
| `Avalasoft__Ingreso__Sso__PermitirHttpLocal` | Permite `http` a localhost en el emisor del SSO (solo desarrollo). | `false` |
| `Avalasoft__Ingreso__Sso__UrlDeRetorno` | URL de retorno que se registra en el proveedor de identidad. | La de la instalación |
| `Avalasoft__Ingreso__Sso__WorkOs__ApiKey`, `__ClientId` y `__UrlBase` | Credenciales de la integración con WorkOS; sin ellas el proveedor `workos` queda deshabilitado. | Vacío y `https://api.workos.com` |
| `Avalasoft__AsercionesUsadas__MinutosLimpieza` | Cada cuántos minutos se borran las aserciones delegadas ya vencidas. | `10` |

## Red y límites

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Proxies__Confiables` y `__Saltos` | Proxies de los que se acepta `X-Forwarded-For` para saber la IP real (límite por IP y auditoría), y cuántos saltos. | Ninguno y `1` |
| `Avalasoft__Cors__OrigenesPermitidos` y `__PermitirCredenciales` | Lista explícita de orígenes con CORS. | Vacío y `false` |
| `Avalasoft__Embebido__PermitirHttpLocal` | Permite orígenes `http` de localhost en los sistemas embebidos (solo desarrollo). | `false` |
| `Avalasoft__LimiteIngreso__Peticiones` y `__VentanaSegundos` | Límite por IP de las rutas de ingreso. | `30` por `60` s |
| `Avalasoft__LimitePublico__Peticiones`, `__PeticionesPorSesion` y `__VentanaSegundos` | Límite de `/public/v1`: por IP lo anónimo (la verificación pública, abrir el enlace) y por tercero lo que trae su sesión. | `60` por IP, `300` por sesión, por `60` s |

## Documentos y almacén

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Almacen__EndpointPublico` | URL del almacén que ve el navegador para las URLs prefirmadas, si difiere de `Endpoint` (por ejemplo dentro de Docker). | Vacío |
| `Avalasoft__Almacen__Region` | Región S3. | `us-east-1` |
| `Avalasoft__Almacen__CrearBucketsAlIniciar` | Crea el bucket global `boveda` al arrancar. | `false` |
| `Avalasoft__Boveda__TamanoMaximoBytes` | Tamaño máximo por archivo (los tipos de documento pueden ser más estrictos). | `20971520` (20 MB) |
| `Avalasoft__Boveda__MaximoPaginas` | Páginas máximas de un PDF. | `50` |
| `Avalasoft__Boveda__MinutosSubida` y `__MinutosDescarga` | Vida de las URLs prefirmadas (entre 1 y 15). | `15` y `5` |
| `Avalasoft__Boveda__ExigirAntivirus` | Si es `true`, una versión no pasa a vigente sin antivirus que la declare limpia (hoy no hay ClamAV conectado: queda esperando). | `false` |

## Correo

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Correo__Puerto` y `__Seguridad` | Puerto y seguridad del SMTP (`None`, `StartTls` o SSL). | `587` y `StartTls` |
| `Avalasoft__Correo__Usuario` y `__Clave` | Credenciales del SMTP. | Vacío |
| `Avalasoft__Correo__Remitente` | Remitente de la plataforma, que usan las empresas sin dominio propio verificado. | `AvalaSoft <no-responder@avalasoft.co>` |
| `Avalasoft__Correo__UrlApp` | URL de la app de la empresa en los correos. | `{UrlPublica}/app/` |
| `Avalasoft__Correo__Dominios__Proveedor` | Proveedor de dominios de correo propios por empresa; hoy solo existe el `Simulado`. | `Simulado` |
| `Avalasoft__Correo__Dominios__Simulado__IncluirSpf` | Host que incluye el registro SPF del proveedor simulado. | `spf.simulado.avalasoft.test` |

## Webhooks y notificaciones

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Webhooks__TimeoutSegundos` | Tiempo máximo de cada intento (de 1 a 30). | `5` |
| `Avalasoft__Webhooks__Reintentos__0 … n` | Esperas entre intentos, en `hh:mm:ss`. | 1 min, 5 min, 30 min, 2 h y 6 h |
| `Avalasoft__Webhooks__FallosParaDeshabilitar` | Intentos fallidos seguidos que deshabilitan una suscripción. | `20` |
| `Avalasoft__Webhooks__HorasSolapamientoRotacion` | Cuánto sigue firmando el secreto anterior tras rotar (de 0 a 168). | `24` |
| `Avalasoft__Webhooks__PermitirHttpLocal` y `__PermitirDestinosPrivados` | Permiten destinos `http` a localhost y a redes privadas (solo desarrollo u on-premise controlado). | `false` y `false` |
| `Avalasoft__Notificaciones__HorasAntiguedadMaxima` | Los hechos más viejos que esto no generan notificaciones a personas (al encender la suscripción sobre una base con historia). | `24` |

## Procesos periódicos

Cada proceso corre en el mismo host; `00:00:00` apaga los que lo admiten.

| Variable | Qué corre | Por defecto |
|---|---|---|
| `Avalasoft__PlazosDeCargue__Intervalo` | Barrido de plazos de cargue y caducidad de expedientes. | `01:00:00` |
| `Avalasoft__RecordatoriosDeObservaciones__Intervalo` | Recordatorios de observaciones pendientes. | `01:00:00` |
| `Avalasoft__SlaDeRevision__Intervalo` | Alertas del plazo de revisión de las áreas. | `00:15:00` |
| `Avalasoft__VigenciasDeVinculos__Intervalo` | Vigencia periódica del vínculo y fin de los bloqueos con fecha. | `01:00:00` |
| `Avalasoft__Habeas__Intervalo` | Plazos y avisos de habeas data. | `01:00:00` |
| `Avalasoft__Plan__Intervalo` | Revisión de los planes de los grupos y sus avisos. | `00:15:00` |
| `Avalasoft__Plan__SegundosDeVolcado` y `__MinutosMedicionAlmacenamiento` | Volcado del conteo de llamadas a la API (de 1 a 300) y medición del almacenamiento (de 0 a 1440). | `5` y `5` |
| `Avalasoft__Verificadores__SegundosProceso` | Consultas automáticas de listas, estudios y monitoreo. | `30` |
| `Avalasoft__Certificados__SegundosProceso` | PDF y vencimiento de certificados. | `10` |
| `Avalasoft__RevisionAutomatica__SegundosProceso` y `__MaximoPorPasada` | Revisión automática con IA y cuántos documentos por pasada (de 1 a 500); 0 segundos la apaga. | `30` y `20` |
| `Avalasoft__Lotes__MaxFilas` y `__TamanoTanda` | Invitación masiva: filas máximas por lote y filas por tanda (de 1 a 1000). | `10000` y `100` |
| `Avalasoft__Campanias__MaxFilas` y `__TamanoTanda` | Campañas de renovación: filas máximas y filas por tanda (de 1 a 500). | `5000` y `50` |

## Verificaciones de cumplimiento

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Verificadores__ListasRestrictivas__PermitirSimulado` | Permite el proveedor simulado de listas (desarrollo y pruebas). | `false` |
| `Avalasoft__Verificadores__ListasRestrictivas__ProveedorPorDefecto` | Proveedor de listas de las empresas que no eligieron uno. | Vacío |
| `Avalasoft__Verificadores__ListasRestrictivas__DiasMonitoreo` | Cada cuántos días se reconsultan los vínculos activos (de 0 a 365; 0 lo apaga). | `30` |
| `Avalasoft__Verificadores__ListasRestrictivas__MinutosReintento` | Espera base del reintento tras una consulta fallida (de 1 a 1440; se duplica con cada fallo, hasta 6 veces). | `5` |
| `Avalasoft__Verificadores__ListasRestrictivas__Proveedores__{Infolaft,Stradata,Compliance}__Habilitado` | Enciende cada proveedor real en la instalación; apagados por omisión. Cada uno tiene su `UrlBase` y, Infolaft, `TimeoutSegundos` (30), `MaximoConcurrencia` (4), `FallosParaAbrir` (5) y `SegundosAbierto` (60) del cortacircuitos. | `false` |
| `Avalasoft__Verificadores__EstudioCumplimiento__VigenciaDias` | Vigencia por omisión del estudio del oficial (de 1 a 3650). | `30` |

## IA

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__IA__Habilitada` | Interruptor global del análisis con IA. | `true` |
| `Avalasoft__IA__Proveedor` | `OpenAi` (con la llave de cada empresa) o `Simulado` (analizador determinista que lee marcas del propio archivo, sin red; desarrollo y e2e). | `OpenAi` |
| `Avalasoft__IA__UrlBase` | URL base de la API de OpenAI. | `https://api.openai.com/v1` |
| `Avalasoft__IA__TimeoutSegundos` | Tiempo máximo de cada análisis (de 5 a 600). | `60` |
| `Avalasoft__IA__Precios__{modelo}__Entrada`, `__EntradaEnCache` y `__Salida` | Precio en USD por millón de tokens de cada modelo, para medir el costo. | `gpt-6-luna`: 0,10 / 0,01 / 0,50 · `gpt-6.1-terra`: 1,00 / 0,05 / 5,00 |

## Habeas data y certificados

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Habeas__CorreosPlataforma` | Correos (separados por coma) que reciben los avisos de plazo de las solicitudes dirigidas a la plataforma. | Vacío |
| `Avalasoft__Habeas__AniosRetencion` | Años de retención legal de los documentos (de 1 a 30). | `10` |
| `Avalasoft__Habeas__BaseLegalRetencion` | Texto de la base legal de la retención. | El texto por omisión de la plataforma |
| `Avalasoft__Habeas__ExportacionesPorDia` y `__DiasDeVigenciaDeExportaciones` | Exportaciones de la bóveda por tercero y por día, y días que vive el ZIP (de 1 a 30). | `5` y `7` |
| `Avalasoft__Certificados__Kid` | Identificador de la clave de sellado que aparece en cada certificado. | Derivado de la clave |
| `Avalasoft__Certificados__ClavesAnteriores__{n}__Kid`, `__ClavePublica`, `__RetiradaEn` y `__VerificableHasta` | Claves de sellado retiradas, para verificar emisiones viejas tras una rotación (se publican en `/.well-known/avalasoft-certificados.json` con su fecha). `Kid` y `ClavePublica` (base64, 32 bytes) identifican la clave; `RetiradaEn` (ISO 8601) es **obligatoria**: la clave solo valida certificados emitidos hasta esa fecha. `VerificableHasta` es opcional: la fecha después de la cual la clave deja de publicarse. | Vacío |
| `Avalasoft__Certificados__DiasDeVerificacionDeClavesRetiradas` | Días, desde su `RetiradaEn`, que una clave retirada sigue publicándose cuando no trae `VerificableHasta` (de 1 a 3650). | `730` |

**Rotar la clave de sellado.** Genera una semilla nueva (con otro `Kid`, o sin `Kid` para que se derive) y ponla en `ClavePrivada`; la clave pública de la anterior está en `/.well-known/avalasoft-certificados.json`. Muévela a `ClavesAnteriores` con la fecha en que dejó de sellar:

```
Avalasoft__Certificados__ClavePrivada=<semilla nueva en base64>
Avalasoft__Certificados__Kid=vs-2027
Avalasoft__Certificados__ClavesAnteriores__0__Kid=vs-2026
Avalasoft__Certificados__ClavesAnteriores__0__ClavePublica=<clave pública anterior en base64>
Avalasoft__Certificados__ClavesAnteriores__0__RetiradaEn=2027-01-15T00:00:00Z
```

Sin `RetiradaEn` la API no arranca, ni con una fecha futura (más de un día adelante). La clave retirada solo valida certificados con `emitidoEn` anterior o igual a `RetiradaEn` y, pasado su plazo (`VerificableHasta`, o `RetiradaEn` más `DiasDeVerificacionDeClavesRetiradas`), deja de publicarse: los certificados sellados con ella ya no se pueden verificar con las claves publicadas. Si necesitas seguir verificándolos, alarga el plazo a propósito con `VerificableHasta` (o el general) antes de que venza.

## Importador del Portal

| Variable | Para qué sirve | Por defecto |
|---|---|---|
| `Avalasoft__Importacion__Portal__CadenaDeConexion` | SQL Server del Portal de proveedores, solo lectura. Sin ella el importador del Portal responde 409 `origen-no-configurado`. | Vacío |
| `Avalasoft__Importacion__Portal__Archivo` | Alternativa: un archivo exportado del Portal. | Vacío |

Fuente: `src/Avalasoft.Api/appsettings.json`, `src/Avalasoft.Infraestructura/ServiciosInfraestructura.cs`, `src/Avalasoft.Aplicacion/Comun/Almacenamiento.cs`, `src/Avalasoft.Aplicacion/Notificaciones/Webhooks.cs`, `src/Avalasoft.Aplicacion/Verificaciones/ListasRestrictivas.cs`, `src/Avalasoft.Aplicacion/Ia/AnalizadorDeDocumentos.cs`, `infra/compose/compose.yaml`.
