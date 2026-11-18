---
id: "configuracion/documento-segun-la-ficha"
titulo: "Pide un documento según lo que el tercero declara en su ficha"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "La administradora agrega al flujo de proveedores el certificado de seguridad y salud en el trabajo y elige «Según la ficha del tercero»: solo se le pide a quien declara la especialidad de concreto premezclado. El documento se pide por lo que el tercero declara, y el tercero ve por qué se le pide."
pasos: 3
---

# Pide un documento según lo que el tercero declara en su ficha

**Actor:** Administrador de empresa · **Dominio:** Configuración

La administradora agrega al flujo de proveedores el certificado de seguridad y salud en el trabajo y elige «Según la ficha del tercero»: solo se le pide a quien declara la especialidad de concreto premezclado. El documento se pide por lo que el tercero declara, y el tercero ve por qué se le pide.

**Antes de empezar**

- Un grupo empresarial con la empresa «Constructora Sur S.A.S.», su área «Revisión» y el certificado de seguridad y salud en el trabajo en los tipos de documento.
- Una persona con el rol Administrador que entra a AvalaSoft desde el sistema integrado.

**Pasos**

1. Elige «Según la ficha del tercero» en «Se pide a»
2. Elige la especialidad que activa el documento
3. Guarda el flujo como borrador

## Paso 1. Elige «Según la ficha del tercero» en «Se pide a»

Además de «Todos» y de los dos tipos de persona, «Se pide a» ofrece «Según la ficha del tercero»: el documento se pide según lo que el tercero declara en su ficha, no según su tipo de persona. El atajo arma la condición sobre las especialidades del tercero; si quieres otro dato de la ficha, cambias el «Campo de la ficha».

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 1: Elige «Según la ficha del tercero» en «Se pide a» (escritorio)](../../../salida/manual/img/configuracion/documento-segun-la-ficha/01-elige-segun-la-ficha-del-tercero-en-se-pide-a-claro.webp)

**Variantes**

- **Cambias el campo a la actividad económica (CIIU):** Se elige un código de la actividad y, si quieres, también una división (2 dígitos) o un grupo (3).

**Configuración que lo afecta**

- **Se pide a (por documento del flujo)** (`Configuración › Flujos aprobatorios (/flujos)`): El documento solo aparece en la lista de los terceros que declaran lo que la condición pide.

## Paso 2. Elige la especialidad que activa el documento

Con «incluye alguno de» y la especialidad «Concreto premezclado», el certificado se pide a quien la declara en «Mi información». «Busca por código o por nombre» trae las especialidades del catálogo; un valor de nivel superior, como un grupo, cubre las especialidades que están debajo.

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 2: Elige la especialidad que activa el documento (escritorio)](../../../salida/manual/img/configuracion/documento-segun-la-ficha/02-elige-la-especialidad-que-activa-el-documento-claro.webp)

**Variantes**

- **El tercero no declara la especialidad:** El certificado no le aparece: la condición no se cumple y no hay nada que entregar.
- **El valor de la condición es «no incluye ninguno de»:** Se pide a quien no declara esa especialidad.

## Paso 3. Guarda el flujo como borrador

Con «Crear borrador» la condición queda guardada en el borrador v1. Al publicar, un tercero que aún no ha declarado su especialidad no ve el certificado; cuando la declara, aparece con el motivo: «Te lo pide Constructora Sur S.A.S. porque en tu ficha declaraste» la especialidad. Si después cambia lo que declara con el expediente abierto, el documento se suma o deja de aplicar solo.

> **Pantalla:** `/e/{empresa}/flujos/{id}`

![Paso 3: Guarda el flujo como borrador (escritorio)](../../../salida/manual/img/configuracion/documento-segun-la-ficha/03-guarda-el-flujo-como-borrador-claro.webp)

## Recorridos relacionados

- [Pide cada documento según el tipo de persona](flujo-condiciones-por-tipo-de-persona.md)
- [Asigna un responsable por sector para las actualizaciones](responsable-por-sector.md)
