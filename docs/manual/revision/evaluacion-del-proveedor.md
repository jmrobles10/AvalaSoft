---
id: "revision/evaluacion-del-proveedor"
titulo: "Califica una evaluación de proveedor que quedó bajo el umbral"
actor: "Revisor/área"
dominio: "revision"
resumen: "Olga, oficial de cumplimiento de Constructora Norte, responde como evaluadora interna la evaluación de un proveedor. Sus respuestas dan un puntaje bajo el umbral del cuestionario, así que la evaluación sale reprobada y el resultado queda registrado con su puntaje."
pasos: 3
---

# Califica una evaluación de proveedor que quedó bajo el umbral

**Actor:** Revisor/área · **Dominio:** Revisión de expedientes

Olga, oficial de cumplimiento de Constructora Norte, responde como evaluadora interna la evaluación de un proveedor. Sus respuestas dan un puntaje bajo el umbral del cuestionario, así que la evaluación sale reprobada y el resultado queda registrado con su puntaje.

**Antes de empezar**

- Un grupo con Constructora Norte. Hay un cuestionario publicado que responde una persona de la empresa (evaluador), con umbral 70.
- Un proveedor invitado a Norte con esa evaluación asignada y pendiente de responder.

**Pasos**

1. Abre la evaluación pendiente
2. Responde cada pregunta
3. Envía la evaluación y mira el resultado

## Paso 1. Abre la evaluación pendiente

En «Evaluaciones» aparecen las evaluaciones de los proveedores de la empresa: las que pide el flujo, las periódicas y las asignadas a mano. La columna «Quién responde» dice si la contesta el tercero o una persona de la empresa. Esta la responde una persona de la empresa, así que aparece con tu nombre para responderla.

> **Pantalla:** `/e/{empresa}/evaluaciones`

![Paso 1: Abre la evaluación pendiente (escritorio)](../../../salida/manual/img/revision/evaluacion-del-proveedor/01-abre-la-evaluacion-pendiente-claro.webp)

**Variantes**

- **El cuestionario lo responde el tercero:** La evaluación no se responde aquí: el proveedor la contesta desde su portal y tú ves el resultado cuando la envía.
- **Tu rol no tiene permiso para responder evaluaciones:** La evaluación se ve, pero no aparece el botón «Responder».

**Configuración que lo afecta**

- **Quién responde (del cuestionario)** (`Configuración › Cuestionarios (/cuestionarios)`): Un cuestionario de evaluador lo contesta una persona de la empresa; uno de tercero, el proveedor.

## Paso 2. Responde cada pregunta

Cada pregunta trae sus opciones con su puntaje: la mejor vale el 100 % de la pregunta. Las obligatorias no se pueden dejar sin responder, y si la pregunta permite comentario, puedes dejar una nota. Quien responde no ve el umbral mientras responde; el puntaje se calcula al enviar.

> **Pantalla:** `/e/{empresa}/evaluaciones/{id}`

![Paso 2: Responde cada pregunta (escritorio)](../../../salida/manual/img/revision/evaluacion-del-proveedor/02-responde-cada-pregunta-claro.webp)

**Variantes**

- **Hay preguntas obligatorias sin responder:** Enviar muestra «Faltan N preguntas obligatorias» y no envía nada.

## Paso 3. Envía la evaluación y mira el resultado

El puntaje se compara con el umbral del cuestionario (70 en este caso). Con 0 puntos la evaluación sale reprobada, y el detalle dice el puntaje, el umbral y el motivo. Una pregunta eliminatoria reprobaría sin importar el puntaje; esta no lo es.

> **Pantalla:** `/e/{empresa}/evaluaciones/{id}`

![Paso 3: Envía la evaluación y mira el resultado (escritorio)](../../../salida/manual/img/revision/evaluacion-del-proveedor/03-envia-la-evaluacion-y-mira-el-resultado-claro.webp)

## Recorridos relacionados

- [Revisa el detalle de un vínculo](../vinculos/detalle-del-vinculo.md)
