---
id: "configuracion/flujo-por-reglas"
titulo: "Escoge el flujo solo según el tercero"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "Ana, administradora de Constructora Sur, agrega a un flujo de proveedores una regla de selección automática: si el tercero es persona jurídica, su expediente usa el flujo de jurídicas en vez del flujo por defecto. Cuando se abre un expediente nuevo, el sistema aplica la regla y lo deja registrado."
pasos: 4
---

# Escoge el flujo solo según el tercero

**Actor:** Administrador de empresa · **Dominio:** Configuración

Ana, administradora de Constructora Sur, agrega a un flujo de proveedores una regla de selección automática: si el tercero es persona jurídica, su expediente usa el flujo de jurídicas en vez del flujo por defecto. Cuando se abre un expediente nuevo, el sistema aplica la regla y lo deja registrado.

**Antes de empezar**

- Un grupo con Constructora Sur, su área «Revisión» con miembros y un flujo por defecto de proveedores que pide el RUT.
- Una persona con el rol Administrador que entra a Validasoft desde el sistema integrado.

**Pasos**

1. Abre la selección automática del flujo
2. Elige cuándo se escoge este flujo y su prioridad
3. Publica la versión con su regla
4. Comprueba qué flujo y por qué lo escogió

## Paso 1. Abre la selección automática del flujo

La tarjeta «Selección automática» decide cuándo el sistema usa este flujo sin que nadie lo elija a mano. Al abrir un expediente sin flujo indicado, Validasoft revisa los flujos publicados del tipo de vínculo por prioridad (la menor primero) y usa el primero cuya condición cumpla el tercero. Si ninguno cumple, usa el flujo por defecto del tipo de vínculo.

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 1: Abre la selección automática del flujo (escritorio)](../../../salida/manual/img/configuracion/flujo-por-reglas/01-abre-la-seleccion-automatica-del-flujo-claro.webp)

**Configuración que lo afecta**

- **Selección automática del flujo** (`Configuración › Flujos aprobatorios (/flujos)`): Sin regla, el flujo solo se usa si alguien lo elige al abrir el expediente o si es el flujo por defecto.

## Paso 2. Elige cuándo se escoge este flujo y su prioridad

Con «El tercero es persona jurídica», el flujo se escoge solo para proveedores jurídicos. La prioridad es un número de 1 a 999 y no se puede repetir entre los flujos publicados del mismo tipo: la menor se evalúa primero. Una condición sin prioridad no se guarda, y una prioridad sin condición no tiene sentido, porque sería un flujo que siempre gana.

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 2: Elige cuándo se escoge este flujo y su prioridad (escritorio)](../../../salida/manual/img/configuracion/flujo-por-reglas/02-elige-cuando-se-escoge-este-flujo-y-su-prioridad-claro.webp)

**Variantes**

- **Eliges «Sin condición»:** El campo de prioridad desaparece y el flujo solo se usa si se elige a mano o es el flujo por defecto.
- **Eliges «Condición personalizada»:** Se conserva la condición de la versión y se describe debajo; se edita con la API o la vista previa.

## Paso 3. Publica la versión con su regla

La regla se guarda en el borrador y se congela al publicar, junto con los documentos del flujo: la regla y el flujo que escoge quedan versionados juntos. Publicar no cambia el flujo por defecto: los expedientes nuevos de jurídicas ya lo usan, y los demás siguen con el suyo.

> **Pantalla:** `/e/{empresa}/flujos/{id}`

![Paso 3: Publica la versión con su regla (escritorio)](../../../salida/manual/img/configuracion/flujo-por-reglas/03-publica-la-version-con-su-regla-claro.webp)

## Paso 4. Comprueba qué flujo y por qué lo escogió

El detalle del expediente dice que se escogió por regla, con la condición tal como quedó publicada, la prioridad y cuántas reglas se evaluaron hasta la que cumplió. Si el tercero hubiera sido persona natural, la regla no se habría cumplido y el expediente usaría el flujo por defecto, y lo diría así.

> **Pantalla:** `/e/{empresa}/expedientes/{id}`

![Paso 4: Comprueba qué flujo y por qué lo escogió (escritorio)](../../../salida/manual/img/configuracion/flujo-por-reglas/04-comprueba-que-flujo-y-por-que-lo-escogio-claro.webp)

## Recorridos relacionados

- [Cambia el flujo por defecto de un tipo de vínculo](flujo-por-defecto.md)
- [Pide cada documento según el tipo de persona](flujo-condiciones-por-tipo-de-persona.md)
