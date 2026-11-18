import type { FrameLocator, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { abrirDesdeBandeja } from '../../soporte/empresa';

/**
 * Ayudas para recorrer la ficha del vínculo (`/vinculos/:id`) y el expediente (`/expedientes/:id`), que son una sola pantalla con una
 * barra lateral de sectores. Los recorridos las usan en lugar de buscar tarjetas sueltas: el sector va en la URL (`?sector=`) y cada
 * sector muestra sus propias tarjetas.
 */

/** Pasa al sector de la barra lateral (por su nombre visible, p. ej. «Cuenta bancaria») y espera a que quede activo. */
export async function irASector(app: FrameLocator, nombre: string): Promise<void> {
  const boton = app.getByRole('navigation', { name: 'Sectores de la ficha' }).getByRole('button', { name: new RegExp(`^${nombre}`) });
  await boton.click();
  await expect(boton).toHaveAttribute('aria-current', 'page');
}

/** La tarjeta (sección) con ese título: el encabezado de la tarjeta y su sección contenedora. */
export function tarjeta(app: FrameLocator, titulo: string): Locator {
  return app.getByRole('heading', { name: titulo, exact: true }).locator('xpath=ancestor::section[1]');
}

/**
 * El chip de estado con ese estado canónico (`Activo`, `Invitado`, `Desvinculado`…). Su texto accesible incluye el detalle para
 * lectores de pantalla («Activo. Activo desde el …»), por eso se ubica por el estado y no por el texto exacto.
 */
export function chipDeEstado(app: FrameLocator, estado: string): Locator {
  return app.locator(`[data-estado="${estado}"]`).first();
}

/** Abre el panel del historial con «Ver historial» del encabezado (desde cualquier sector que no sea el de historial) y devuelve su título. */
export async function abrirHistorial(app: FrameLocator): Promise<Locator> {
  await app.getByRole('button', { name: 'Ver historial', exact: true }).click();
  const titulo = app.getByRole('heading', { name: 'Historial', exact: true, level: 2 });
  await expect(titulo).toBeVisible();
  return titulo;
}

/**
 * Abre el expediente desde la bandeja de un área y, en la ficha, va al sector «Oficial de cumplimiento», donde están las listas
 * restrictivas; espera a que muestren `estado`. Es `esperarListas` de `e2e/soporte`, que esperaba la sección en la vista única de antes.
 */
export async function esperarListasEnLaFicha(app: FrameLocator, tercero: string, area: string, estado: string): Promise<void> {
  await expect(async () => {
    await abrirDesdeBandeja(app, tercero, area);
    await irASector(app, 'Oficial de cumplimiento');
    await expect(app.getByRole('region', { name: 'Listas restrictivas' })).toContainText(estado, { timeout: 1500 });
  }).toPass({ timeout: 45_000 });
}
