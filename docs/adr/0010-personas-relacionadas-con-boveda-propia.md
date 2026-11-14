# ADR-0010 — Personas relacionadas (representantes, socios, beneficiarios finales, miembros) son terceros con bóveda propia

| Estado | Fecha | Reemplaza |
|---|---|---|
| Implementado | 2026-10-28 (auditoría externa de negocio, B-3); implementado el 2026-11-14 | Precisa ADR-0004 |

## Contexto
La clave del documento global es `(tercero, tipo canónico)` y Producto decidió N representantes legales con uno principal (P-1-6). Con eso, la cédula del representante —el documento más básico de una vinculación— no tenía sitio: una segunda cédula sería "versión duplicada" o superaría a la primera, y la IA la devolvería porque su número no es el NIT del tercero. Lo mismo ocurría con antecedentes, cédulas de socios/UBO y miembros de consorcio.

## Decisión
1. El representante legal, los suplentes, los socios/beneficiarios finales y los miembros de un consorcio son **terceros persona natural** (clave `(país, tipo, número)`), con **bóveda propia**.
2. Se unen al tercero jurídico por `RelacionEntreTerceros { origen, destino, tipo: RepresentanteLegal | Suplente | Socio | BeneficiarioFinal | MiembroDe, principal, vigencia, fuente, confirmación }`.
3. Los documentos de la persona (`CEDULA`, `PASAPORTE`, `CERTIFICADO_ANTECEDENTES`, `BENEFICIARIO_FINAL`) se validan **una vez** y sirven a todas las empresas y a todos los terceros jurídicos donde figura. `IdentidadCoincide` compara contra la persona.
4. Un requisito del flujo puede exigir "documento X de la persona relacionada con rol Y" (`DePersonaRelacionada`, con `TodasLasRelaciones` opcional); se resuelve contra la relación principal vigente al abrir o recalcular el expediente.
5. **Reconciliación de fuentes**: una relación la declara el tercero (`DATOS_MAESTROS`) o la extrae la IA de la Cámara de comercio. Un cambio detectado por la IA no modifica la relación por sí solo: emite `CambioDeRelacionDetectado(confianza)` y la relación cambia cuando el tercero lo confirma, un revisor lo confirma al revalidar, o la confianza es ≥ 0,98 y la Cámara nueva fue aprobada por alguna empresa. Solo entonces expiran las verificaciones del saliente en los vínculos.
6. `FORMULARIO_SARLAFT` (PorVinculo) **referencia** el `BENEFICIARIO_FINAL` global de la persona en lugar de duplicarlos.

## Alternativas descartadas
- **Documento con sub-dueño `(tercero, persona)`** sin bóveda propia: más simple, pero no reutiliza la cédula cuando la misma persona representa a dos empresas y obliga a repetir listas restrictivas.
- **Cédula como adjunto `PorVinculo`**: repite el legado.

## Consecuencias
- `boveda.tercero` contiene personas naturales que no tienen vínculos propios; la retención y el habeas data aplican a ellas con base legal derivada de la relación.
- La semilla canónica marca `dePersonaRelacionada` en los tipos que corresponden (03 Anexo A).
- Las listas restrictivas cubren al tercero y a sus personas relacionadas vigentes.
- La importación crea personas desde `TerCamaraComercio`/contactos del Portal y normaliza su identificación.

## Implementación (2026-11-14)
Implementado en el [registro](../decisiones/registro.md), sección `5-septiessexagies` (PR-1 a PR-10). Cómo quedó cada punto de la decisión:

1. **Personas como terceros** (puntos 1 y 3): `Tercero` persona natural por `(país, tipo, número)`, sin contactos ni vínculos propios; su `CEDULA`, `PASAPORTE` y `CERTIFICADO_ANTECEDENTES` viven en su bóveda y se comparten con los vínculos cuyo flujo los pide por una relación vigente (PR-8). `IdentidadCoincide` compara contra la persona porque ella es la dueña del documento.
2. **`RelacionEntreTerceros`** (punto 2): agregado event-sourced en la bóveda con tipo, principal, vigencia, fuente (`Declarada`, `ExtraidaIa`, `Importacion`, `Plataforma`; los nombres de la decisión original se ajustaron) y confirmación; la ficha legal la mantiene sola (PR-1, PR-2).
3. **`DePersonaRelacionada`** (punto 4): rol y `TodasLasRelaciones` en el requisito del flujo; se resuelve al abrir y al recalcular el expediente contra la relación principal vigente (PR-3).
4. **Reconciliación** (punto 5): la IA que lee otros representantes en la Cámara deja una propuesta (`CambioDeRelacionDetectado(confianza)`) que no cambia nada hasta que el **tercero** la confirma o la descarta. La confirmación por un revisor y la automática (confianza ≥ 0,98 con la Cámara aprobada) quedan **pendientes** (PR-4, PR-10).
5. **`FORMULARIO_SARLAFT` referencia `BENEFICIARIO_FINAL`** (punto 6): **pendiente**; `BENEFICIARIO_FINAL` aún no tiene esquema de formulario canónico (PR-10).
6. **Listas, retención y habeas data** (consecuencias): las listas cubren a las personas relacionadas vigentes (PR-5); el plan de supresión de una persona conserva lo que el tercero relacionado sigue usando (PR-6). La importación del Portal crea las personas por la sincronización de la ficha legal importada.

## Cómo se revierte
Las relaciones pueden aplanarse a atributos del tercero jurídico exportando la bóveda de cada persona; es costoso y se descarta salvo exigencia legal.
