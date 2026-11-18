---
id: "configuracion/grupos-de-acceso"
titulo: "Crea un grupo de acceso y asígnalo a una persona"
actor: "Administrador de empresa"
dominio: "configuracion"
resumen: "La administradora crea el grupo «Revisores de tributaria» con tres permisos de revisión y un solo sector de la ficha, la información tributaria, y se lo asigna a Rubén desde Usuarios y roles. Así Rubén revisa la tributaria de los terceros y no puede decidir sobre el resto de la ficha."
pasos: 6
---

# Crea un grupo de acceso y asígnalo a una persona

**Actor:** Administrador de empresa · **Dominio:** Configuración

La administradora crea el grupo «Revisores de tributaria» con tres permisos de revisión y un solo sector de la ficha, la información tributaria, y se lo asigna a Rubén desde Usuarios y roles. Así Rubén revisa la tributaria de los terceros y no puede decidir sobre el resto de la ficha.

**Antes de empezar**

- Un grupo empresarial con Constructora Sur S.A.S., su área «Revisión» y las personas Ana (administradora), Rubén y Sofía.
- Una persona con el rol Administrador que entra a AvalaSoft desde el sistema integrado.

**Pasos**

1. Abre Configuración › Grupos de acceso
2. Dale un código, un nombre y los permisos que necesita
3. Acota el grupo a un sector de la ficha
4. Revisa el grupo en la lista
5. Asigna el grupo a una persona
6. Confirma que la persona tiene el grupo

## Paso 1. Abre Configuración › Grupos de acceso

Un grupo de acceso reúne permisos y, si quieres, los sectores de la ficha que puede ver o decidir. La lista muestra los cuatro roles de siempre —Administrador, Revisor, Oficial de cumplimiento y Auditor— como grupos predefinidos: con su candado no se editan ni se desactivan. Los grupos propios aparecen debajo, con sus permisos, sus sectores y cuántas personas los tienen.

> **Pantalla:** `/e/{empresa}/grupos-de-acceso`

![Paso 1: Abre Configuración › Grupos de acceso (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/01-abre-configuracion-grupos-de-acceso-claro.webp)

**Variantes**

- **Aún no hay grupos propios:** La lista muestra solo los predefinidos y la invitación a crear el primer grupo.

**Configuración que lo afecta**

- **Grupos de acceso** (`Configuración › Grupos de acceso (/grupos-de-acceso)`): Lo que puede una persona es la suma de sus roles y de sus grupos activos.

## Paso 2. Dale un código, un nombre y los permisos que necesita

El código identifica al grupo, empieza con una letra, usa solo mayúsculas, números y guion bajo, y no se puede cambiar después. Los permisos están agrupados por módulo, igual que en las API keys: marca solo lo que el grupo necesita. Aquí «Leer terceros», «Leer expedientes» y «Revisar expedientes» (veredictos) bastan para revisar.

> **Pantalla:** `/e/{empresa}/grupos-de-acceso`

![Paso 2: Dale un código, un nombre y los permisos que necesita (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/02-dale-un-codigo-un-nombre-y-los-permisos-que-nece-claro.webp)

**Variantes**

- **No marcas ningún permiso:** El botón «Crear grupo» no deja guardar: pide elegir al menos un permiso.
- **El código ya existe:** El campo se marca en rojo con la razón.

## Paso 3. Acota el grupo a un sector de la ficha

Sin sectores marcados, el grupo vale para todos. Al marcar «Información tributaria», los permisos que miran la ficha por secciones solo valen para esa sección: el grupo ve y decide sobre la tributaria y no sobre la general, la financiera o las demás. «Ver» solo lee la sección; «Ver y decidir» además permite el veredicto, la observación o la exención.

> **Pantalla:** `/e/{empresa}/grupos-de-acceso`

![Paso 3: Acota el grupo a un sector de la ficha (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/03-acota-el-grupo-a-un-sector-de-la-ficha-claro.webp)

**Configuración que lo afecta**

- **Sectores de la ficha del grupo** (`Configuración › Grupos de acceso (/grupos-de-acceso)`): Un grupo acotado no ve ni decide sobre las secciones que no marcó; el servidor lo exige en cada consulta.

## Paso 4. Revisa el grupo en la lista

El grupo aparece en la lista con sus tres permisos, el sector «Información tributaria» y «0» personas. Queda en la auditoría de configuración. Desactivarlo después no quita las asignaciones: quienes lo tienen dejan de recibir sus permisos desde su siguiente ingreso, y se conservan por si lo reactivas.

> **Pantalla:** `/e/{empresa}/grupos-de-acceso`

![Paso 4: Revisa el grupo en la lista (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/04-revisa-el-grupo-en-la-lista-claro.webp)

## Paso 5. Asigna el grupo a una persona

En el panel «Editar roles» de la persona, «Grupos de acceso» lista los grupos propios del grupo empresarial. Agregar un grupo y elegirlo lo suma a sus roles: no reemplaza los que ya tiene. Un grupo puede darse para todo el grupo o para una empresa; aquí Rubén lo recibe en la empresa por omisión.

> **Pantalla:** `/e/{empresa}/usuarios`

![Paso 5: Asigna el grupo a una persona (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/05-asigna-el-grupo-a-una-persona-claro.webp)

**Variantes**

- **El grupo está desactivado:** Aparece marcado «(desactivado)» y no se puede asignar de nuevo.
- **Quieres quitar el grupo:** La X de la fila lo quita sin tocar sus roles.

## Paso 6. Confirma que la persona tiene el grupo

En la tabla, la fila de Rubén muestra el grupo «Revisores de tributaria» junto a sus roles. Desde su siguiente ingreso puede revisar la información tributaria de los expedientes y no el resto de la ficha.

> **Pantalla:** `/e/{empresa}/usuarios`

![Paso 6: Confirma que la persona tiene el grupo (escritorio)](../../../salida/manual/img/configuracion/grupos-de-acceso/06-confirma-que-la-persona-tiene-el-grupo-claro.webp)

## Recorridos relacionados

- [Agrega una persona, dale roles y desactívala](usuarios-y-roles.md)
- [Asigna un responsable por sector para las actualizaciones](responsable-por-sector.md)
