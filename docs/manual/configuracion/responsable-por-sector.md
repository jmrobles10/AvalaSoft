---
id: "configuracion/responsable-por-sector"
titulo: "Asigna un responsable por sector para las actualizaciones"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "La administradora arma un flujo de proveedores con la información tributaria y la general, y asigna el área Revisión como responsable de la sección tributaria. Cuando el tercero cambie su tributaria después de aprobada, la actualización llega solo a esa área y no a todas las del flujo."
pasos: 3
---

# Asigna un responsable por sector para las actualizaciones

**Actor:** Administrador de empresa · **Dominio:** Configuración

La administradora arma un flujo de proveedores con la información tributaria y la general, y asigna el área Revisión como responsable de la sección tributaria. Cuando el tercero cambie su tributaria después de aprobada, la actualización llega solo a esa área y no a todas las del flujo.

**Antes de empezar**

- Un grupo empresarial con la empresa «Constructora Sur S.A.S.» y su área «Revisión» con miembros.
- Una persona con el rol Administrador que entra a Valídalo desde el sistema integrado.

**Pasos**

1. Abre la tarjeta «Responsable por sector en las actualizaciones»
2. Asigna el área responsable de la tributaria
3. Guarda el flujo con sus responsables

## Paso 1. Abre la tarjeta «Responsable por sector en las actualizaciones»

Cuando el tercero cambia una sección después de aprobada, la actualización va al responsable de esa sección y no a todas las áreas del flujo. La tarjeta tiene una casilla por cada sección de «Mi información»; el responsable es un área del flujo, nunca una persona. La revisión inicial no cambia.

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 1: Abre la tarjeta «Responsable por sector en las actualizaciones» (escritorio)](../../../salida/manual/img/configuracion/responsable-por-sector/01-abre-la-tarjeta-responsable-por-sector-en-las-ac-claro.webp)

**Configuración que lo afecta**

- **Responsable por sector en las actualizaciones** (`Configuración › Flujos aprobatorios (/flujos)`): Una sección con responsable se revisa solo por esa área en sus actualizaciones.

## Paso 2. Asigna el área responsable de la tributaria

Elige «Revisión» en «Área responsable de Información tributaria». Las áreas que aparecen son solo las que ya participan en las etapas del flujo; la sección general queda en «Sin responsable (como siempre)», así que su actualización sigue yendo a las áreas de su requisito.

> **Pantalla:** `/e/{empresa}/flujos/nuevo`

![Paso 2: Asigna el área responsable de la tributaria (escritorio)](../../../salida/manual/img/configuracion/responsable-por-sector/02-asigna-el-area-responsable-de-la-tributaria-claro.webp)

**Variantes**

- **El flujo no tiene áreas:** La tarjeta dice «Agrega áreas al flujo para elegir un responsable» y las casillas quedan deshabilitadas.
- **Quitas el área del flujo:** Sus responsabilidades se quitan con ella.

## Paso 3. Guarda el flujo con sus responsables

Con «Crear borrador» el responsable queda en la versión v1. Como toda configuración de flujo, se congela al publicar: los expedientes que ya se abrieron conservan la versión con la que empezaron, y las actualizaciones nuevas usan la versión publicada.

> **Pantalla:** `/e/{empresa}/flujos/{id}`

![Paso 3: Guarda el flujo con sus responsables (escritorio)](../../../salida/manual/img/configuracion/responsable-por-sector/03-guarda-el-flujo-con-sus-responsables-claro.webp)

## Recorridos relacionados

- [Pide secciones de «Mi información» como requisito del flujo](flujo-secciones-de-la-ficha.md)
