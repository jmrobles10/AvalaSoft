# Trazabilidad de las pruebas e2e retiradas

Cada prueba de punta a punta que se retiró del conjunto (`e2e/pruebas/`) tiene aquí una fila: **qué verificaba** y **qué prueba normal
(dominio, API o Vitest) lo cubre ahora**. Decisión PC-1 en `docs/decisiones/registro.md`. Una prueba de guardia
(`infra/ci-local/trazabilidad-e2e.test.mjs`, corre con `pnpm test`) falla si una fila no cita un reemplazo que exista, si la e2e retirada
sigue en su `.spec.ts` o si falta la mutación.

## Formato de cada archivo

Un archivo por grupo de pruebas (`<grupo>.md`) con una o varias tablas de cuatro columnas:

```markdown
| e2e retirada | Qué verificaba | Lo cubre | Mutación |
|---|---|---|---|
| `actualizaciones.spec.ts` › una versión nueva del RUT durante la revisión invalida lo que Compras ya había aprobado sobre él | El voto de Compras sobre v1 deja de contar al llegar v2 | `tests/Validalo.Integracion.Tests/RequisitosApiTests.cs` › Proveedor_con_rut_y_camara_compartidos_observacion_version_nueva_reenvio_y_aprobacion_por_requisito<br>`apps/web/src/features/expedientes/requisitos.test.ts` › un voto sobre una versión anterior | Sí: quitar la invalidación del voto en `Expediente.Apply(VersionNueva)` → la prueba de API falla en «Compras debe volver a decidir» |
```

- **Columna 1**: `` `archivo.spec.ts` `` + ` › ` + el título **literal** de la prueba como estaba en el `.spec.ts`.
- **Columna 2**: una frase con lo que comprobaba (las aserciones relevantes, no el andamiaje).
- **Columna 3**: una o más citas, separadas por `<br>`: `` `ruta/relativa/al/repositorio` `` + ` › ` + el nombre literal de la prueba (el método de C# o el título del `it(...)` o un
  fragmento suyo de al menos 15 caracteres). **Sin puntos suspensivos**: la guardia busca ese texto tal cual dentro del archivo.
- **Columna 4**: `Sí: <qué se rompió en el código de producción> → <qué prueba falló y con qué mensaje>` si se hizo la mutación (obligatoria
  para toda prueba o aserción nueva, y por muestreo en las que ya existían), o `No aplica: <motivo>` (p. ej. «equivalente existente sin
  cambios, aserciones ya cubiertas»).

Las pruebas que no se pueden cubrir en un nivel normal (geometría real del navegador) no se retiran: se listan en `descartables.md` para que
decida el dueño.
