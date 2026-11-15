---
id: "revision/cotejo-con-fuentes-oficiales"
titulo: "Resuelve una diferencia con el registro mercantil (RUES)"
actor: "Revisor/área"
dominio: "revision"
resumen: "Un proveedor cuya matrícula figura cancelada en el RUES llega a revisión. El oficial de cumplimiento lee lo que dijo el registro, revisa el cotejo campo por campo, acepta la diferencia con su justificación y guarda la constancia con la respuesta de la fuente."
pasos: 5
---

# Resuelve una diferencia con el registro mercantil (RUES)

**Actor:** Revisor/área · **Dominio:** Revisión de expedientes

Un proveedor cuya matrícula figura cancelada en el RUES llega a revisión. El oficial de cumplimiento lee lo que dijo el registro, revisa el cotejo campo por campo, acepta la diferencia con su justificación y guarda la constancia con la respuesta de la fuente.

**Antes de empezar**

- Un grupo con Constructora Norte y el flujo de proveedores que pide el RUES como bloqueante.
- Un proveedor cuya matrícula el registro figura cancelada (con el proveedor simulado).
- Rubén (Compras) y Olga (Cumplimiento) como miembros de sus áreas.

**Pasos**

1. Lee lo que dice el registro mercantil
2. Revisa el cotejo campo por campo
3. Acepta la diferencia con tu justificación
4. La fuente queda conforme y guardas la constancia
5. Aprueba tu área y el expediente cierra

## Paso 1. Lee lo que dice el registro mercantil

La sección del RUES muestra la fuente consultada, la fecha y el proveedor, y lo que dijo el registro: el estado de la matrícula, la razón social y los representantes. El estado «Diferencias por revisar» quiere decir que hay un dato que no coincide con la ficha o con el certificado de Cámara: lo decides tú. La verificación es bloqueante, así que el expediente no cierra hasta resolverla.

![Paso 1: Lee lo que dice el registro mercantil (escritorio)](../../../salida/manual/img/revision/cotejo-con-fuentes-oficiales/01-lee-lo-que-dice-el-registro-mercantil-claro.webp)

**Variantes**

- **El RUES coincide con la ficha:** La sección dice «Conforme» y no hay nada que decidir: el expediente sigue su curso.
- **El tercero no figura en el registro:** La fuente dice «La fuente no tiene al tercero» y es una diferencia crítica.

## Paso 2. Revisa el cotejo campo por campo

El cotejo compara cada campo de la fuente con la ficha maestra y con lo que extrajo la IA del certificado de Cámara. Cada fila dice qué dice la fuente, contra qué se compara y el resultado: «Coincide», «Diferencia» o «No verificable». Una diferencia en el estado de la matrícula es crítica. Lo que la fuente no trae o la ficha no tiene se marca como «No verificable» y no te pide decisión.

![Paso 2: Revisa el cotejo campo por campo (escritorio)](../../../salida/manual/img/revision/cotejo-con-fuentes-oficiales/02-revisa-el-cotejo-campo-por-campo-claro.webp)

**Configuración que lo afecta**

- **Campos que se cotejan** (`Configuración › Flujos aprobatorios (/flujos)`): Se coteja la matrícula, la renovación, la razón social, el NIT y los representantes del RUES contra la ficha y el certificado de Cámara.

## Paso 3. Acepta la diferencia con tu justificación

Aceptar una diferencia quiere decir que el dato de la fuente no impide aprobar, por una razón que tú documentas. La justificación es obligatoria y queda en el historial y en la auditoría. Vale 12 meses: una reconsulta que encuentre la misma diferencia no la vuelve a pedir. Si en cambio es un hallazgo real, eliges «Confirmar hallazgo»: el expediente no se aprueba y Cumplimiento puede rechazarlo.

![Paso 3: Acepta la diferencia con tu justificación (escritorio)](../../../salida/manual/img/revision/cotejo-con-fuentes-oficiales/03-acepta-la-diferencia-con-tu-justificacion-claro.webp)

**Variantes**

- **Confirmar hallazgo:** La verificación queda fallida y el expediente no se aprueba. Nunca se hereda a otra consulta ni rechaza el expediente sola.

## Paso 4. La fuente queda conforme y guardas la constancia

Con la diferencia aceptada, el RUES queda «Conforme» y vigente hasta la fecha que muestra. «Constancia» descarga la evidencia: la respuesta cruda del registro, la fecha, quién consultó y su huella SHA-256, para que el registro pueda verificarse después. Las consultas anteriores quedan debajo, cada una con su constancia.

![Paso 4: La fuente queda conforme y guardas la constancia (escritorio)](../../../salida/manual/img/revision/cotejo-con-fuentes-oficiales/04-la-fuente-queda-conforme-y-guardas-la-constancia-claro.webp)

## Paso 5. Aprueba tu área y el expediente cierra

Con la diferencia resuelta y el resto de las áreas aprobadas, el expediente se aprueba y el tercero lo ve en su portal. Si una diferencia siguiera sin decidir, el expediente quedaría en revisión y la bandeja de Cumplimiento lo mostraría.

![Paso 5: Aprueba tu área y el expediente cierra (escritorio)](../../../salida/manual/img/revision/cotejo-con-fuentes-oficiales/05-aprueba-tu-area-y-el-expediente-cierra-claro.webp)

## Recorridos relacionados

- [Aprueba el área de Compras](aprobar-un-area.md)
