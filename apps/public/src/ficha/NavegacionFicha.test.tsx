import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente } from '@validalo/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { estadoFicha, filaEstado, guardada, json, montarFicha, ORDEN_JURIDICA } from './pruebas/montar';
import { filaActual } from './secciones';

afterEach(() => reiniciarCliente());

const estado = () =>
  estadoFicha({
    siguienteSeccion: 'FICHA_TRIBUTARIA',
    secciones: [
      filaEstado('FICHA_GENERAL', { version: 2, completa: true }),
      filaEstado('FICHA_TRIBUTARIA', { version: 1, faltantes: [{ campo: 'responsable_ica', regla: null, mensaje: 'Falta «ICA».' }] }),
      filaEstado('FICHA_LEGAL'),
      filaEstado('FICHA_FINANCIERA', { periodo: 2025, version: 1, completa: true }),
      filaEstado('FICHA_SST'),
      filaEstado('FICHA_ESPECIALIDADES'),
    ],
  });

describe('Mi información: panel de secciones', () => {
  it('acompaña la sección con el avance y todas las secciones con su estado, marcando la abierta', async () => {
    const usuario = userEvent.setup();
    montarFicha('/ficha/tributaria', { estado: estado() });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    expect(within(panel).getByText('2 de 6 secciones completas')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Mi información' })).toHaveAttribute('href', '/ficha');
    // En el celular el panel es una barra con el paso actual que se despliega.
    const barra = within(panel).getByRole('button', { name: /Paso 2 de 6/ });
    expect(barra).toHaveAttribute('aria-expanded', 'false');
    await usuario.click(barra);

    const secciones = within(panel).getAllByRole('link').filter((a) => a.getAttribute('href') !== '/ficha');
    expect(secciones.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Información general: Completa',
      'Información tributaria: Falta 1 dato',
      'Información legal: Sin diligenciar',
      'Información financiera · 2025: Completa',
      'Seguridad y salud en el trabajo: Sin diligenciar',
      'Especialidades: Sin diligenciar',
    ]);
    expect(within(panel).getByRole('link', { name: 'Información tributaria: Falta 1 dato' })).toHaveAttribute('aria-current', 'step');
    expect(within(panel).getByRole('link', { name: 'Información financiera · 2025: Completa' })).toHaveAttribute('href', '/ficha/financiera?periodo=2025');

    await usuario.click(within(panel).getByRole('link', { name: 'Información legal: Sin diligenciar' }));
    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/ficha/legal');
    // Al elegir, la barra del celular se pliega y dice la sección nueva.
    expect(await screen.findByRole('button', { name: /Paso 3 de 6\s*Información legal/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('cada ítem es una píldora de una línea: el texto de estado solo sale para lo que pide acción («Falta 1 dato»), no para «Completa» ni «Sin diligenciar»', async () => {
    const usuario = userEvent.setup();
    montarFicha('/ficha/tributaria', { estado: estado() });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    await usuario.click(within(panel).getByRole('button', { name: /Paso 2 de 6/ }));
    // El estado completo sigue en el nombre accesible, pero a la vista solo la fila incompleta lo dice.
    expect(within(panel).getByText('Falta 1 dato')).toBeInTheDocument();
    expect(within(panel).queryByText('Completa')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Sin diligenciar')).not.toBeInTheDocument();
    // La barra de avance es delgada (3 px).
    expect(within(panel).getByRole('progressbar')).toHaveStyle({ height: '3px' });
  });

  it('con cambios sin guardar pregunta antes de salir; «Guardar y continuar» avanza sin preguntar', async () => {
    const usuario = userEvent.setup();
    const guardados = montarFicha('/ficha/tributaria', {
      estado: estado(),
      alGuardar: () => json(200, guardada('FICHA_TRIBUTARIA', [], 'FICHA_LEGAL', { responsable_ica: false })),
    });

    const ica = await screen.findByRole('radiogroup', { name: '¿Eres contribuyente del impuesto de industria y comercio (ICA)?' });
    await usuario.click(within(ica).getByRole('radio', { name: 'No' }));
    const panel = screen.getByRole('navigation', { name: 'Secciones de mi información' });
    await usuario.click(within(panel).getByRole('link', { name: 'Mi información' }));

    const dialogo = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' });
    expect(dialogo).toHaveTextContent('Tienes cambios en Información tributaria que no has guardado.');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/ficha/tributaria');

    // Al cerrar, el diálogo devuelve la página (mientras sale, el resto queda oculto a la accesibilidad).
    await usuario.click(await screen.findByRole('button', { name: 'Guardar y continuar' }));
    await vi.waitFor(() => expect(guardados).toHaveLength(1));
    await vi.waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/ficha/legal'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('es un panel flotante propio, separado del panel del formulario (no va dentro de él)', async () => {
    montarFicha('/ficha/tributaria', { estado: estado() });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    const formulario = await screen.findByRole('form', { name: 'Información tributaria' });
    // Cada uno es su panel: el mismo radio grande y borde, y ninguno contiene al otro.
    expect(getComputedStyle(panel).borderRadius).toBe('16px');
    const panelDelFormulario = panelDe(formulario);
    expect(panelDelFormulario).not.toBe(panel);
    expect(panel).not.toContainElement(formulario);
    expect(panelDelFormulario).not.toContainElement(panel);
    expect(getComputedStyle(panelDelFormulario).borderRadius).toBe('16px');
    // La rejilla que los junta los separa con un espacio (no se tocan) y la navegación se pega bajo la barra superior.
    expect(panel.parentElement).toBe(panelDelFormulario.parentElement);
    expect(getComputedStyle(panel).position).toBe('sticky');
    expect(getComputedStyle(panel.parentElement!).columnGap).not.toBe('0px');
  });

  it('el encabezado junta volver, el avance y su barra; con todas las secciones completas la barra y el texto pasan a verde', async () => {
    const completas = estadoFicha({
      siguienteSeccion: null,
      completa: true,
      secciones: ORDEN_JURIDICA.map((s) => filaEstado(s, { version: 1, completa: true })),
    });
    montarFicha('/ficha/general', { estado: completas });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    expect(within(panel).getByRole('link', { name: 'Mi información' })).toHaveAttribute('href', '/ficha');
    expect(within(panel).getByText('6 de 6 secciones completas')).toBeInTheDocument();
    const barra = within(panel).getByRole('progressbar', { name: '6 de 6 secciones completas' });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
    expect(barra).toHaveClass('MuiLinearProgress-colorSuccess');
  });

  it('el estado de cada sección sigue siendo un ícono: completa (check), pendiente (alerta) y sin diligenciar (círculo vacío)', async () => {
    const usuario = userEvent.setup();
    montarFicha('/ficha/tributaria', { estado: estado() });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    await usuario.click(within(panel).getByRole('button', { name: /Paso 2 de 6/ }));
    const icono = (nombre: string) => within(panel).getByRole('link', { name: nombre }).querySelector('svg');
    expect(icono('Información general: Completa')).toHaveClass('lucide-circle-check');
    expect(icono('Información tributaria: Falta 1 dato')).toHaveClass('lucide-circle-alert');
    expect(icono('Información legal: Sin diligenciar')).toHaveClass('lucide-circle');
    // La abierta es una píldora blanca con sombra suave; las demás, sin caja.
    expect(getComputedStyle(within(panel).getByRole('link', { name: 'Información tributaria: Falta 1 dato' })).boxShadow).not.toMatch(/none$/);
    expect(getComputedStyle(within(panel).getByRole('link', { name: 'Información legal: Sin diligenciar' })).boxShadow).toMatch(/none$/);
  });

  it('la financiera abierta en un periodo nuevo marca la fila de la financiera que hay', () => {
    const filas = [filaEstado('FICHA_GENERAL'), filaEstado('FICHA_FINANCIERA', { periodo: 2025 }), filaEstado('FICHA_FINANCIERA', { periodo: 2024 })];
    expect(filaActual(filas, 'FICHA_FINANCIERA', 2024)).toBe(filas[2]);
    expect(filaActual(filas, 'FICHA_FINANCIERA', 2023)).toBe(filas[1]);
    expect(filaActual(filas, 'FICHA_GENERAL', null)).toBe(filas[0]);
  });
});

describe('Mi información: panel de secciones en escritorio', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** jsdom no trae `matchMedia`: con `matches` verdadero el tema ve una pantalla ancha (desde `md`). */
  function pantallaAncha() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((consulta: string) => ({
        matches: true,
        media: consulta,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  it('las secciones van siempre a la vista bajo el título «Secciones», sin el botón del paso del celular', async () => {
    pantallaAncha();
    montarFicha('/ficha/tributaria', { estado: estado() });

    const panel = await screen.findByRole('navigation', { name: 'Secciones de mi información' });
    expect(within(panel).queryByRole('button', { name: /Paso 2 de 6/ })).not.toBeInTheDocument();
    const lista = within(panel).getByRole('list', { name: 'Secciones' });
    expect(within(lista).getAllByRole('link')).toHaveLength(6);
    expect(within(lista).getByRole('link', { name: 'Información tributaria: Falta 1 dato' })).toHaveAttribute('aria-current', 'step');
    // El encabezado se queda arriba y la lista es la que desplaza si no cabe.
    expect(within(panel).getByText('2 de 6 secciones completas')).toBeInTheDocument();
    expect(getComputedStyle(lista.parentElement!).overflowY).toBe('auto');
  });
});

/** El panel flotante que contiene un elemento: su ancestro más cercano con el radio grande de los paneles. */
function panelDe(elemento: HTMLElement): HTMLElement {
  for (let p = elemento.parentElement; p; p = p.parentElement) if (getComputedStyle(p).borderRadius === '16px') return p;
  throw new Error('El elemento no está dentro de un panel flotante');
}
