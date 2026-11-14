---
id: "operacion/invitaciones-por-aprobar"
titulo: "Aprueba o rechaza las invitaciones retenidas"
actor: "Oficial de cumplimiento"
dominio: "operacion"
resumen: "Constructora Norte exige que otra persona apruebe cada invitación a proveedores antes de que salga el correo. Olga, oficial de cumplimiento, abre la bandeja de invitaciones por aprobar, aprueba una: el correo sale al tercero. A otra la rechaza con un motivo, y el vínculo queda anulado sin escribirle al tercero."
pasos: 4
---

# Aprueba o rechaza las invitaciones retenidas

**Actor:** Oficial de cumplimiento · **Dominio:** Operación masiva y continua

Constructora Norte exige que otra persona apruebe cada invitación a proveedores antes de que salga el correo. Olga, oficial de cumplimiento, abre la bandeja de invitaciones por aprobar, aprueba una: el correo sale al tercero. A otra la rechaza con un motivo, y el vínculo queda anulado sin escribirle al tercero.

**Antes de empezar**

- Un grupo con Constructora Norte. El tipo de vínculo Proveedor exige aprobación antes de invitar y la aprueba el rol Oficial de cumplimiento.
- Dos invitaciones a proveedores retenidas, pedidas por una integración (no por una persona de la empresa).

**Pasos**

1. Abre la bandeja de invitaciones por aprobar
2. Aprueba una invitación
3. Rechaza con un motivo
4. Comprueba que la bandeja quedó vacía

## Paso 1. Abre la bandeja de invitaciones por aprobar

Aquí están las invitaciones que esperan a otra persona antes de salir: el tercero, el tipo, a qué correo se enviará, quién la pidió y desde cuándo. Quien la pidió no puede aprobarla, y la columna «Decisión» dice si la decides tú o la decide otra persona. «Solo las que puedo decidir» filtra la lista.

> **Pantalla:** `/e/{empresa}/invitaciones/por-aprobar`

![Paso 1: Abre la bandeja de invitaciones por aprobar (escritorio)](../../../salida/manual/img/operacion/invitaciones-por-aprobar/01-abre-la-bandeja-de-invitaciones-por-aprobar-claro.webp)

**Variantes**

- **Tu rol no es de los que aprueban este tipo de vínculo:** Ves la lista pero no los botones de decisión: la decide otra persona.
- **Eres quien pidió la invitación:** Ves «La pediste tú» y no puedes aprobarla ni rechazarla.

**Configuración que lo afecta**

- **Quién aprueba las invitaciones del tipo de vínculo** (`Configuración › Tipos de vínculo (/tipos-vinculo)`): Un rol o un área de la empresa: solo sus miembros ven los botones para decidir.

## Paso 2. Aprueba una invitación

Al aprobar, el sistema envía el correo al tercero con el enlace y la vigencia que se pidieron, en la misma operación que registra tu aprobación. La invitación sale de la lista y el vínculo pasa a «Invitado», como cualquier otra invitación enviada.

> **Pantalla:** `/e/{empresa}/invitaciones/por-aprobar`

![Paso 2: Aprueba una invitación (escritorio)](../../../salida/manual/img/operacion/invitaciones-por-aprobar/02-aprueba-una-invitacion-claro.webp)

## Paso 3. Rechaza con un motivo

El rechazo anula el vínculo con el motivo que escribes, y ese motivo lo ve quien pidió la invitación. Nunca se escribe al tercero: no sale ningún correo.

> **Pantalla:** `/e/{empresa}/invitaciones/por-aprobar`

![Paso 3: Rechaza con un motivo (escritorio)](../../../salida/manual/img/operacion/invitaciones-por-aprobar/03-rechaza-con-un-motivo-claro.webp)

## Paso 4. Comprueba que la bandeja quedó vacía

La invitación rechazada sale de la bandeja y su vínculo queda anulado en la lista de vínculos. Si alguien la pidió de nuevo, vuelve a la bandeja como una invitación nueva. Apaga «Solo las que puedo decidir» para ver las que decide otra persona.

> **Pantalla:** `/e/{empresa}/invitaciones/por-aprobar`

![Paso 4: Comprueba que la bandeja quedó vacía (escritorio)](../../../salida/manual/img/operacion/invitaciones-por-aprobar/04-comprueba-que-la-bandeja-quedo-vacia-claro.webp)

## Recorridos relacionados

- [Crea un tipo de vínculo y lo desactiva](../configuracion/tipos-de-vinculo.md)
- [Revisa la lista de vínculos y filtra por estado y tipo](../vinculos/lista-y-filtros.md)
