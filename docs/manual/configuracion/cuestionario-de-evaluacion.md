---
id: "configuracion/cuestionario-de-evaluacion"
titulo: "Crea y publica un cuestionario de evaluación de proveedores"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "Ana, administradora de Constructora Norte, crea un cuestionario para evaluar a los proveedores nuevos: define el umbral de aprobación, quién responde, y una pregunta eliminatoria. Al publicarlo, la versión queda congelada y las evaluaciones nuevas la usan."
pasos: 6
---

# Crea y publica un cuestionario de evaluación de proveedores

**Actor:** Administrador de empresa · **Dominio:** Configuración

Ana, administradora de Constructora Norte, crea un cuestionario para evaluar a los proveedores nuevos: define el umbral de aprobación, quién responde, y una pregunta eliminatoria. Al publicarlo, la versión queda congelada y las evaluaciones nuevas la usan.

**Antes de empezar**

- Un grupo con Constructora Norte y Ana como administradora, sin cuestionarios previos.

**Pasos**

1. Abre la lista de cuestionarios
2. Crea el cuestionario con su código
3. Define el umbral y quién responde
4. Marca una pregunta eliminatoria
5. Publica la versión
6. Comprueba que la versión está publicada

## Paso 1. Abre la lista de cuestionarios

Un cuestionario evalúa a un proveedor con preguntas que pesan, puntúan y pueden eliminar. Se edita como borrador y, al publicarlo, queda congelado: las evaluaciones ya hechas conservan su versión. Un flujo de validación lo pide, o se asigna a un proveedor a mano.

> **Pantalla:** `/e/{empresa}/cuestionarios`

![Paso 1: Abre la lista de cuestionarios (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/01-abre-la-lista-de-cuestionarios-claro.webp)

**Configuración que lo afecta**

- **Cuestionarios de evaluación** (`Configuración › Cuestionarios (/cuestionarios)`): Ver o crear cuestionarios depende del permiso «cuestionarios:escribir» del rol.

## Paso 2. Crea el cuestionario con su código

El código identifica el cuestionario dentro de la empresa: solo letras, números y guiones, y no se reutiliza después. El nombre es el que verás en la lista y en los flujos. El cuestionario nace con una sección y una pregunta de ejemplo que reescribes en el editor.

> **Pantalla:** `/e/{empresa}/cuestionarios`

![Paso 2: Crea el cuestionario con su código (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/02-crea-el-cuestionario-con-su-codigo-claro.webp)

## Paso 3. Define el umbral y quién responde

«Umbral de aprobación» es el puntaje mínimo: con menos, la evaluación sale reprobada. «Quién responde» decide quién contesta. Si lo responde el tercero, es una autoevaluación desde su portal, y él no ve puntajes, pesos ni el resultado. Si lo responde una persona de la empresa, la contesta en esta consola.

> **Pantalla:** `/e/{empresa}/cuestionarios/{id}`

![Paso 3: Define el umbral y quién responde (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/03-define-el-umbral-y-quien-responde-claro.webp)

**Variantes**

- **Eliges «Una persona de la empresa (evaluador)»:** La evaluación se responde aquí y solo la ven quienes tienen permiso para responderla.
- **Activas «Repetir la evaluación periódicamente»:** Cada cierto número de meses la evaluación vigente vence y se pide una nueva.

## Paso 4. Marca una pregunta eliminatoria

Una pregunta eliminatoria reprueba la evaluación cuando la respuesta cae en lo que elimina, sin importar el puntaje. Por eso exige decir qué respuesta elimina: una eliminatoria sin criterio no se puede publicar. Las preguntas que no puntúan sirven para recoger información o evidencia.

> **Pantalla:** `/e/{empresa}/cuestionarios/{id}`

![Paso 4: Marca una pregunta eliminatoria (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/04-marca-una-pregunta-eliminatoria-claro.webp)

**Variantes**

- **La pregunta no tiene criterio de eliminación:** Publicar falla con «Indica qué respuesta elimina».

## Paso 5. Publica la versión

Al publicar, la versión queda congelada: no se puede modificar, y las evaluaciones nuevas la usan. Las evaluaciones que ya existen conservan la versión con la que se hicieron. Para cambiarla después, se edita y se crea una versión nueva.

> **Pantalla:** `/e/{empresa}/cuestionarios/{id}`

![Paso 5: Publica la versión (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/05-publica-la-version-claro.webp)

## Paso 6. Comprueba que la versión está publicada

El encabezado muestra la versión publicada y ya no hay borrador pendiente. Desde ahora un flujo de validación puede pedir este cuestionario y asignarse a un proveedor.

> **Pantalla:** `/e/{empresa}/cuestionarios/{id}`

![Paso 6: Comprueba que la versión está publicada (escritorio)](../../../salida/manual/img/configuracion/cuestionario-de-evaluacion/06-comprueba-que-la-version-esta-publicada-claro.webp)

## Recorridos relacionados

- [Pide listas restrictivas y el estudio SAGRILAFT en el flujo](flujo-verificaciones-de-cumplimiento.md)
