---
id: "vinculos/ficha-por-sectores"
titulo: "Recorre la ficha del vínculo por sectores"
actor: "Administrador de empresa"
dominio: "vinculos"
resumen: "La administradora abre la ficha de un proveedor que ya aceptó la invitación y tiene su expediente abierto. Recorre la barra de sectores: lo que pide el expediente y lo que declaró el tercero, sus contactos, lo que aceptó con el texto exacto, el cumplimiento y el historial."
pasos: 8
---

# Recorre la ficha del vínculo por sectores

**Actor:** Administrador de empresa · **Dominio:** Vínculos y terceros

La administradora abre la ficha de un proveedor que ya aceptó la invitación y tiene su expediente abierto. Recorre la barra de sectores: lo que pide el expediente y lo que declaró el tercero, sus contactos, lo que aceptó con el texto exacto, el cumplimiento y el historial.

**Antes de empezar**

- Un grupo con Constructora Norte, su flujo de Proveedor por defecto y una administradora.
- Un proveedor que aceptó la invitación, subió su RUT y su Cámara, y tiene el expediente abierto.

**Pasos**

1. Lee la barra de sectores de la ficha
2. Revisa lo que pide el expediente en Información tributaria
3. Revisa los datos de contacto del tercero
4. Revisa lo que aceptó el tercero
5. Abre el texto que aceptó el tercero
6. Revisa las verificaciones de cumplimiento
7. Abre el historial desde el encabezado
8. Lee el historial como sector de la ficha

## Paso 1. Lee la barra de sectores de la ficha

La ficha del vínculo se recorre por sectores, como la ficha del tercero del SRM. La barra tiene tres grupos: «Proceso» con las aprobaciones, «Información» con lo que pide el expediente y lo que declaró el tercero, y «Registro» con los documentos, la evaluación, el certificado y el historial. El número junto a cada sector son los requisitos que siguen pendientes; en rojo o en ámbar, si alguno está observado o rechazado. El sector abierto va marcado a la izquierda.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 1: Lee la barra de sectores de la ficha (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/01-lee-la-barra-de-sectores-de-la-ficha-claro.webp)

**Configuración que lo afecta**

- **Requisitos del flujo de cada tipo de vínculo** (`Configuración › Flujos aprobatorios (/flujos)`): Cada requisito aparece en el sector que le corresponde y suma en su contador.

## Paso 2. Revisa lo que pide el expediente en Información tributaria

Cada requisito aparece en el sector al que pertenece: el RUT va en «Información tributaria», no en la lista general. La tarjeta «Lo que pide el expediente» dice qué falta, qué está en revisión y qué respalda cada requisito. Debajo, «Lo que declaró el tercero» muestra lo que llenó en esta sección; si no ha llenado nada, lo dice.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 2: Revisa lo que pide el expediente en Información tributaria (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/02-revisa-lo-que-pide-el-expediente-en-informacion-claro.webp)

**Variantes**

- **El requisito está observado o rechazado:** La tarjeta del requisito muestra un solo aviso con lo que corregir, y el sector se marca en advertencia.

## Paso 3. Revisa los datos de contacto del tercero

En «Contacto del tercero» está el correo del vínculo, al que llegan las invitaciones y los avisos, con su verificación, y los datos de contacto que declaró el tercero: correo, teléfono y dirección. Debajo están los contactos de la empresa para esta relación. Si el correo del vínculo no está verificado, lo dice: nada prueba todavía que sea del tercero.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 3: Revisa los datos de contacto del tercero (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/03-revisa-los-datos-de-contacto-del-tercero-claro.webp)

## Paso 4. Revisa lo que aceptó el tercero

«Lo que aceptó el tercero» lista los textos que aceptó al entrar: la autorización de tratamiento de datos, los términos de la empresa y el aviso de la plataforma. Cada uno dice su versión y la fecha, y si lo confirmó con un código enviado a su correo. El botón «Ver» abre el texto exacto que aceptó, aunque ya exista una versión más nueva.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 4: Revisa lo que aceptó el tercero (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/04-revisa-lo-que-acepto-el-tercero-claro.webp)

**Variantes**

- **El tercero aún no aceptó los textos legales:** La tarjeta dice que el tercero no ha aceptado nada y explica dónde quedará lo que acepte.

## Paso 5. Abre el texto que aceptó el tercero

El diálogo muestra el texto tal como lo aceptó el tercero, con su versión y la fecha de publicación. Sirve como evidencia de qué se autorizó, aunque después se haya publicado otra versión del texto. Ciérralo con «Cerrar»; no cambia nada del vínculo.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 5: Abre el texto que aceptó el tercero (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/05-abre-el-texto-que-acepto-el-tercero-claro.webp)

## Paso 6. Revisa las verificaciones de cumplimiento

El sector «Oficial de cumplimiento» reúne las verificaciones de listas restrictivas y el estudio de cumplimiento del expediente, o las del último expediente que las tuvo. Más abajo, lo que el tercero declaró sobre cumplimiento (por ejemplo, el beneficiario final o el formulario SARLAFT). Las coincidencias se analizan en el módulo de cumplimiento, no aquí.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 6: Revisa las verificaciones de cumplimiento (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/06-revisa-las-verificaciones-de-cumplimiento-claro.webp)

## Paso 7. Abre el historial desde el encabezado

El botón «Historial» del encabezado abre un panel a la derecha, desde cualquier sector. Tiene dos pestañas: la del expediente que se revisa, con su folio, y la del vínculo. Así no tienes que cambiar de sector para ver qué pasó mientras estabas en otra parte de la ficha.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 7: Abre el historial desde el encabezado (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/07-abre-el-historial-desde-el-encabezado-claro.webp)

## Paso 8. Lee el historial como sector de la ficha

El sector «Historial» de la barra (en el grupo «Registro») muestra la misma línea de tiempo en la página completa, con las mismas pestañas. Ahí se lee cuando hace falta revisar muchos eventos seguidos, y el botón del encabezado no aparece porque ya está abierto.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 8: Lee el historial como sector de la ficha (escritorio)](../../../salida/manual/img/vinculos/ficha-por-sectores/08-lee-el-historial-como-sector-de-la-ficha-claro.webp)

## Recorridos relacionados

- [Revisa el detalle de un vínculo](detalle-del-vinculo.md)
- [Lee el historial de un expediente](../revision/historial-del-expediente.md)
