---
id: "configuracion/aprobacion-antes-de-invitar"
titulo: "Exige aprobar cada invitación antes de que salga el correo"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "Ana, administradora de Constructora Norte, activa en el tipo Proveedor que cada invitación espere la aprobación de otra persona. Luego invita a un lote: el lote queda «Por aprobar» y el correo no sale hasta que el oficial de cumplimiento lo apruebe."
pasos: 4
---

# Exige aprobar cada invitación antes de que salga el correo

**Actor:** Administrador de empresa · **Dominio:** Configuración

Ana, administradora de Constructora Norte, activa en el tipo Proveedor que cada invitación espere la aprobación de otra persona. Luego invita a un lote: el lote queda «Por aprobar» y el correo no sale hasta que el oficial de cumplimiento lo apruebe.

**Antes de empezar**

- Un grupo con Constructora Norte, el tipo de vínculo Proveedor y el rol Oficial de cumplimiento con una persona asignada (Olga).
- Una administradora (Ana) que entra desde el sistema integrado.

**Pasos**

1. Activa la aprobación antes de invitar
2. Elige quién aprueba
3. Invita a un lote con el tipo que exige aprobación
4. Comprueba que el lote espera aprobación

## Paso 1. Activa la aprobación antes de invitar

Con «Exige aprobación antes de invitar», cada invitación a un tercero de este tipo se retiene: el correo y el enlace no salen hasta que otra persona la apruebe. Quien la pidió no puede aprobarla, y el tercero no ve el vínculo mientras tanto.

> **Pantalla:** `/e/{empresa}/tipos-vinculo`

![Paso 1: Activa la aprobación antes de invitar (escritorio)](../../../salida/manual/img/configuracion/aprobacion-antes-de-invitar/01-activa-la-aprobacion-antes-de-invitar-claro.webp)

**Configuración que lo afecta**

- **Exige aprobación antes de invitar (por tipo de vínculo)** (`Configuración › Tipos de vínculo (/tipos-vinculo)`): Las invitaciones nuevas de este tipo esperan una aprobación; las ya enviadas no cambian.

## Paso 2. Elige quién aprueba

«Quién aprueba» puede ser un rol de la empresa o un área. Con un rol, cualquier persona con ese rol que no haya pedido la invitación puede aprobarla. Con un área, se busca el área con ese código en la empresa de cada vínculo: si una empresa no la tiene, no podrá invitar con este tipo.

> **Pantalla:** `/e/{empresa}/tipos-vinculo`

![Paso 2: Elige quién aprueba (escritorio)](../../../salida/manual/img/configuracion/aprobacion-antes-de-invitar/02-elige-quien-aprueba-claro.webp)

**Variantes**

- **Eliges «Un área»:** Aparecen las áreas de la empresa activa; si no hay ninguna, se pide crearlas en Configuración › Áreas.
- **No eliges quién aprueba:** No se puede guardar: «Indica quién aprueba las invitaciones».

## Paso 3. Invita a un lote con el tipo que exige aprobación

El lote se crea, pero ninguna fila se procesa todavía. Como el tipo PROVEEDOR exige aprobación, el lote nace «Por aprobar»: el aviso dice que no se envía ninguna invitación hasta que otra persona lo apruebe o lo rechace. Quien crea el lote no puede aprobarlo.

> **Pantalla:** `/e/{empresa}/invitaciones/lotes/nuevo`

![Paso 3: Invita a un lote con el tipo que exige aprobación (escritorio)](../../../salida/manual/img/configuracion/aprobacion-antes-de-invitar/03-invita-a-un-lote-con-el-tipo-que-exige-aprobacio-claro.webp)

**Variantes**

- **El lote solo tiene tipos que no exigen aprobación:** El lote empieza a enviar las invitaciones de inmediato, como siempre.

## Paso 4. Comprueba que el lote espera aprobación

El lote aparece como «Por aprobar» y el correo no ha salido a ningún tercero. La decisión la toma otra persona de las que aprueban este tipo, desde «Invitaciones por aprobar».

> **Pantalla:** `/e/{empresa}/invitaciones/lotes/{id}`

![Paso 4: Comprueba que el lote espera aprobación (escritorio)](../../../salida/manual/img/configuracion/aprobacion-antes-de-invitar/04-comprueba-que-el-lote-espera-aprobacion-claro.webp)

## Recorridos relacionados

- [Aprueba o rechaza las invitaciones retenidas](../operacion/invitaciones-por-aprobar.md)
- [Invita a varios terceros con un archivo](../operacion/invitacion-por-lotes.md)
