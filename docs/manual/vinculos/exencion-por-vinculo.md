---
id: "vinculos/exencion-por-vinculo"
titulo: "Exime a un vínculo aprobado de una renovación"
actor: "Administrador de empresa"
dominio: "vinculos"
resumen: "Ana, administradora de Constructora Norte, exime a un proveedor aprobado de la renovación de su Cámara de comercio. Lo eximido no se avisa ni vence el vínculo, el expediente nuevo lo trae ya eximido y la exención se puede revocar con una justificación."
pasos: 5
---

# Exime a un vínculo aprobado de una renovación

**Actor:** Administrador de empresa · **Dominio:** Vínculos y terceros

Ana, administradora de Constructora Norte, exime a un proveedor aprobado de la renovación de su Cámara de comercio. Lo eximido no se avisa ni vence el vínculo, el expediente nuevo lo trae ya eximido y la exención se puede revocar con una justificación.

**Antes de empezar**

- Un grupo con Constructora Norte, cuyo flujo de proveedores pide RUT y Cámara de comercio, y Ana como administradora.
- Un proveedor jurídico aprobado por las áreas de Norte (vínculo Activo).

**Pasos**

1. Abre las exenciones del vínculo aprobado
2. Elige de qué se exime y escribe la justificación
3. Comprueba la exención en el vínculo
4. Revoca la exención con una justificación
5. Confirma que la exención quedó revocada

## Paso 1. Abre las exenciones del vínculo aprobado

En el detalle del vínculo, la tarjeta «Exenciones» muestra las decisiones de la empresa para este tercero. Aquí no hay ninguna: el vínculo se rige por sus vigencias. La exención es privada de la empresa: el tercero y las demás empresas del grupo no la ven.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 1: Abre las exenciones del vínculo aprobado (escritorio)](../../../salida/manual/img/vinculos/exencion-por-vinculo/01-abre-las-exenciones-del-vinculo-aprobado-claro.webp)

**Variantes**

- **Tu rol solo puede leer vínculos:** El botón «Eximir» no aparece y la tarjeta es de solo lectura.
- **El vínculo no está aprobado:** No se puede eximir: solo se exime un vínculo que ya fue aprobado.

**Configuración que lo afecta**

- **Permiso «vinculos:eximir»** (`Configuración › Usuarios y roles (/usuarios)`): Lo tienen el administrador y las llaves de API a las que se les marque al crearlas; ningún otro rol.

## Paso 2. Elige de qué se exime y escribe la justificación

Puedes eximir de algunos requisitos (documentos o secciones de la ficha que elijas) o de todo, incluida la vigencia del vínculo. La justificación es obligatoria y es interna: no sale en el certificado ni la ve el tercero. «Hasta» es opcional: sin fecha, la exención rige hasta que la revoques.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 2: Elige de qué se exime y escribe la justificación (escritorio)](../../../salida/manual/img/vinculos/exencion-por-vinculo/02-elige-de-que-se-exime-y-escribe-la-justificacion-claro.webp)

**Variantes**

- **Eliges «De todo»:** La exención cubre todos los requisitos y la vigencia periódica, y el vínculo no vence mientras rija.

## Paso 3. Comprueba la exención en el vínculo

La tarjeta lista la exención como «Vigente» con quién la hizo y hasta cuándo rige. El detalle del vínculo muestra la insignia «Exento» junto a su estado. Mientras rija no sale ningún aviso de vencimiento de lo eximido, y los expedientes nuevos traen ese requisito ya eximido.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 3: Comprueba la exención en el vínculo (escritorio)](../../../salida/manual/img/vinculos/exencion-por-vinculo/03-comprueba-la-exencion-en-el-vinculo-claro.webp)

## Paso 4. Revoca la exención con una justificación

Revocar devuelve el vínculo a sus vigencias: a partir de ese momento el documento vuelve a vencer y a avisarse, y si ya venció mientras estuvo eximido, abre su renovación. Queda en el historial con tu nombre.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 4: Revoca la exención con una justificación (escritorio)](../../../salida/manual/img/vinculos/exencion-por-vinculo/04-revoca-la-exencion-con-una-justificacion-claro.webp)

## Paso 5. Confirma que la exención quedó revocada

La exención figura como «Revocada» con la justificación y la fecha. El historial del vínculo guarda la exención, su revocación y quién las hizo.

> **Pantalla:** `/e/{empresa}/vinculos/{id}`

![Paso 5: Confirma que la exención quedó revocada (escritorio)](../../../salida/manual/img/vinculos/exencion-por-vinculo/05-confirma-que-la-exencion-quedo-revocada-claro.webp)

## Recorridos relacionados

- [Exime a un tercero de un documento](../revision/eximir-un-documento.md)
- [Revisa el detalle de un vínculo](detalle-del-vinculo.md)
- [Revisa los documentos que vencen en la lista de vencimientos](../documentos/vencimientos.md)
