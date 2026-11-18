import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { contraste } from './marcaEmpresa';
import { ChipUsuario, NavegacionLateral, PanelFlotante, PildoraContexto, type GrupoNavegacion } from './marco';
import { AvatarIniciales, FilaAtencion, MiniBarra, TarjetaBloque, TarjetaKpi, TotalDestacado } from './tarjetas';
import { createAvalasoftTheme } from './tema';
import { COLOR, RADIO } from './tokens';

const conTema = (nodo: ReactNode, modo: 'light' | 'dark' = 'light') => render(<ThemeProvider theme={createAvalasoftTheme(modo)}>{nodo}</ThemeProvider>);

describe('paleta del rework: acento verde azulado y lienzo gris', () => {
  it.each(['light', 'dark'] as const)('el acento, el rótulo gris y los bordes de los controles pequeños pasan su contraste en %s', (modo) => {
    const c = COLOR[modo];
    // El botón primario lleva texto blanco sobre el acento.
    expect(contraste(c.textoSobreAccion, c.accionPrimaria)).toBeGreaterThanOrEqual(4.5);
    // El acento como texto (enlaces, íconos, botón secundario) sobre la tarjeta, el panel, el lienzo y su propio tinte.
    for (const fondo of [c.superficieNivel1, c.superficiePanel, c.fondo, c.acentoTinte, c.encabezadoTabla]) expect(contraste(c.acento, fondo)).toBeGreaterThanOrEqual(4.5);
    // Texto secundario (ayudas, rótulos, encabezados de tabla) sobre cada capa.
    for (const fondo of [c.superficieNivel1, c.superficiePanel, c.fondo, c.encabezadoTabla]) expect(contraste(c.textoSecundario, fondo)).toBeGreaterThanOrEqual(4.5);
    // Casillas, radios y pistas del interruptor: su borde es su único indicador (no textual, 3:1).
    expect(contraste(c.bordeControlFuerte, c.superficieNivel1)).toBeGreaterThanOrEqual(3);
    // El cuarto color del tablero cumple lo mismo que los tonos de estado.
    expect(contraste(c.violetaTexto, c.violetaFondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.violetaTexto, c.superficieNivel1)).toBeGreaterThanOrEqual(4.5);
  });

  it('el lienzo es gris claro, los paneles son una capa más clara y los radios son grandes', () => {
    expect(COLOR.light.fondo).toBe('#EEF1F4');
    expect(contraste(COLOR.light.superficiePanel, COLOR.light.fondo)).toBeLessThan(1.2);
    expect(COLOR.light.superficieNivel1).toBe('#FFFFFF');
    expect([RADIO.lg, RADIO.md, RADIO.sm]).toEqual([16, 14, 8]);
    const tema = createAvalasoftTheme('light');
    expect(tema.palette.superficie.panel).toBe(COLOR.light.superficiePanel);
    expect(tema.palette.acento.main).toBe(COLOR.light.acento);
  });

  it('el logotipo no cambia con la paleta: los tokens de marca siguen siendo los del logo', () => {
    expect([COLOR.light.marcaAzul, COLOR.light.marcaVerde, COLOR.dark.marcaAzul, COLOR.dark.marcaVerde]).toEqual(['#3D6BFF', '#22D38A', '#6E8FFF', '#2BE29A']);
  });
});

describe('TarjetaBloque', () => {
  it('ícono, título y ayuda van en la misma línea del encabezado y el cuerpo queda debajo de un divisor', () => {
    const { container } = conTema(
      <TarjetaBloque titulo="Datos de la cotización" ayuda="Número, fecha y asesor" icono={Building2} etiqueta="Datos">
        <p>cuerpo</p>
      </TarjetaBloque>,
    );
    const region = screen.getByRole('region', { name: 'Datos' });
    const titulo = within(region).getByRole('heading', { level: 2, name: 'Datos de la cotización' });
    const ayuda = within(region).getByText('Número, fecha y asesor');
    // Mismo contenedor de fila: título y ayuda son hermanos.
    expect(titulo.parentElement).toBe(ayuda.parentElement);
    expect(titulo.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(region).getByText('cuerpo')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="filete"]')).toBeNull();
  });

  it('con `filete` lleva arriba una barra de 3 px del acento; con `nivel` h3 el título es un h3', () => {
    const { container } = conTema(
      <TarjetaBloque titulo="Resumen" nivel="h3" filete>
        <p>x</p>
      </TarjetaBloque>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Resumen' })).toBeInTheDocument();
    const filete = [...container.querySelectorAll('div[aria-hidden]')].find((n) => getComputedStyle(n).height === '3px');
    expect(filete).toBeDefined();
  });

  it('sin título ni acciones no dibuja encabezado y, sin cuerpo, tampoco divisor', () => {
    conTema(<TarjetaBloque titulo="Solo título" />);
    expect(screen.getByRole('heading', { name: 'Solo título' })).toBeInTheDocument();
    conTema(
      <TarjetaBloque etiqueta="Sin encabezado">
        <p>solo cuerpo</p>
      </TarjetaBloque>,
    );
    expect(within(screen.getByRole('region', { name: 'Sin encabezado' })).queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('piezas del tablero', () => {
  it('AvatarIniciales muestra las iniciales y es decorativo', () => {
    const { container } = conTema(<AvatarIniciales nombre="Paula Plataforma" solido />);
    expect(container.firstElementChild).toHaveTextContent('PP');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('TotalDestacado, TarjetaKpi y MiniBarra muestran sus textos; la barra dice su proporción', () => {
    conTema(
      <>
        <TotalDestacado etiqueta="Total" valor="$ 290.360" />
        <TarjetaKpi icono={Building2} tono="verde" titulo="Con plan" valor="3" detalle="De 8 empresas" grafica={<MiniBarra valor={3} total={8} tono="verde" etiqueta="3 de 8 con plan" />} />
      </>,
    );
    expect(screen.getByText('$ 290.360')).toBeInTheDocument();
    expect(screen.getByText('Con plan')).toBeInTheDocument();
    expect(screen.getByText('De 8 empresas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 de 8 con plan' })).toBeInTheDocument();
  });

  it('MiniBarra con total 0 no divide por cero', () => {
    conTema(<MiniBarra valor={0} total={0} etiqueta="Sin datos" />);
    expect(screen.getByRole('img', { name: 'Sin datos' })).toBeInTheDocument();
  });

  it('FilaAtencion es un botón con título, subtítulo y chip, y responde al clic', async () => {
    const alClic = vi.fn();
    conTema(<FilaAtencion icono={Settings} titulo="Constructora Norte" subtitulo="Sin plan de IA" chip={<span>Sin plan</span>} onClick={alClic} />);
    const fila = screen.getByRole('button', { name: /Constructora Norte/ });
    expect(within(fila).getByText('Sin plan de IA')).toBeInTheDocument();
    await userEvent.click(fila);
    expect(alClic).toHaveBeenCalledOnce();
  });
});

describe('marco de la app', () => {
  const GRUPOS: GrupoNavegacion[] = [
    { clave: 'a', titulo: 'Inicio', items: [{ clave: 'g', texto: 'Grupos', icono: Building2, a: '/grupos', activo: true }] },
    { clave: 'b', titulo: 'Operación', items: [{ clave: 's', texto: 'Secretos', icono: Settings, a: '/secretos', activo: false }] },
  ];

  it('PanelFlotante es un panel de radio grande sobre el lienzo', () => {
    const { container } = conTema(<PanelFlotante>contenido</PanelFlotante>);
    expect(container.firstElementChild).toHaveTextContent('contenido');
    const panel = container.firstElementChild;
    if (!panel) throw new Error('sin panel');
    expect(getComputedStyle(panel).borderRadius).toBe('16px');
  });

  it('PildoraContexto es un botón con ícono y texto cuando tiene `onClick`, y un recuadro sin acción si no', async () => {
    const alClic = vi.fn();
    conTema(
      <>
        <PildoraContexto icono={Building2} onClick={alClic}>
          Atlas Services
        </PildoraContexto>
        <PildoraContexto>mié, 18 nov 2026</PildoraContexto>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Atlas Services' }));
    expect(alClic).toHaveBeenCalledOnce();
    expect(screen.getByText('mié, 18 nov 2026').closest('button')).toBeNull();
  });

  it('ChipUsuario muestra nombre, rol y avatar de iniciales; con `onClick` es un botón', async () => {
    const alClic = vi.fn();
    conTema(<ChipUsuario nombre="Erika Atuesta" rol="Comercial" aria-label="Menú de la cuenta" onClick={alClic} />);
    const chip = screen.getByRole('button', { name: 'Menú de la cuenta' });
    expect(within(chip).getByText('Erika Atuesta')).toBeInTheDocument();
    expect(within(chip).getByText('Comercial')).toBeInTheDocument();
    expect(within(chip).getByText('EA')).toBeInTheDocument();
    await userEvent.click(chip);
    expect(alClic).toHaveBeenCalledOnce();
  });

  it('NavegacionLateral marca el ítem activo, no cambia de estructura al colapsar y avisa el cambio', async () => {
    const alAlternar = vi.fn();
    const { rerender } = conTema(
      <NavegacionLateral etiqueta="Secciones" rotulo="Navegación" grupos={GRUPOS} onAlternarColapso={alAlternar} textoColapsar="Colapsar" textoExpandir="Expandir" />,
    );
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('link', { name: 'Grupos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Secretos' })).not.toHaveAttribute('aria-current');
    const antes = within(nav).getAllByRole('link').map((l) => l.outerHTML.length);

    await userEvent.click(within(nav).getByRole('button', { name: 'Colapsar' }));
    expect(alAlternar).toHaveBeenCalledOnce();

    rerender(
      <ThemeProvider theme={createAvalasoftTheme('light')}>
        <NavegacionLateral etiqueta="Secciones" rotulo="Navegación" grupos={GRUPOS} colapsada onAlternarColapso={alAlternar} textoColapsar="Colapsar" textoExpandir="Expandir" />
      </ThemeProvider>,
    );
    // Mismos enlaces, mismo árbol: el nombre accesible no cambia (el texto sigue en el DOM, solo transparente).
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getAllByRole('link')).toHaveLength(antes.length);
    expect(screen.getByRole('link', { name: 'Grupos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir' })).toBeInTheDocument();
  });

  describe('navegación por estado con contadores (sin destino)', () => {
    const SECTORES: GrupoNavegacion[] = [
      {
        clave: 'p',
        titulo: 'Proceso',
        items: [{ clave: 'ap', texto: 'Aprobaciones', icono: Building2, onSeleccionar: vi.fn(), activo: true, contador: 3, tonoContador: 'advertencia', etiquetaAccesible: 'Aprobaciones: 3 pendientes' }],
      },
      {
        clave: 'i',
        titulo: 'Información',
        items: [{ clave: 'ge', texto: 'General', icono: Settings, onSeleccionar: vi.fn(), activo: false, contador: 0 }],
      },
    ];

    it('un ítem sin destino es un botón que avisa su elección y lleva aria-current si está activo', async () => {
      const alElegir = vi.fn();
      const grupos: GrupoNavegacion[] = [
        {
          clave: 'g',
          items: [
            { clave: 'a', texto: 'Aprobaciones', icono: Building2, onSeleccionar: alElegir, activo: true },
            { clave: 'b', texto: 'General', icono: Settings, onSeleccionar: alElegir, activo: false },
          ],
        },
      ];
      conTema(<NavegacionLateral etiqueta="Sectores" grupos={grupos} />);
      const nav = screen.getByRole('navigation', { name: 'Sectores' });
      expect(within(nav).queryByRole('link')).not.toBeInTheDocument();
      expect(within(nav).getByRole('button', { name: 'Aprobaciones' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('button', { name: 'General' })).not.toHaveAttribute('aria-current');
      await userEvent.click(within(nav).getByRole('button', { name: 'General' }));
      expect(alElegir).toHaveBeenCalledOnce();
    });

    it('el contador es decorativo (el nombre accesible lo dice), solo sale si es mayor que 0 y la advertencia lo pinta distinto', () => {
      conTema(<NavegacionLateral etiqueta="Sectores" grupos={SECTORES} />);
      const nav = screen.getByRole('navigation', { name: 'Sectores' });
      const aprobaciones = within(nav).getByRole('button', { name: 'Aprobaciones: 3 pendientes' });
      expect(within(aprobaciones).getByTestId('contador')).toHaveTextContent('3');
      expect(within(aprobaciones).getByTestId('contador')).toHaveAttribute('aria-hidden', 'true');
      expect(within(within(nav).getByRole('button', { name: 'General' })).queryByTestId('contador')).not.toBeInTheDocument();
    });

    it('sin rótulo ni control de colapsar no dibuja la fila superior; con la densidad compacta los ítems miden 34 px y los normales 40', () => {
      const { unmount } = conTema(<NavegacionLateral etiqueta="Sectores" grupos={SECTORES} densidad="compacta" />);
      expect(screen.queryByText('Navegación')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Colapsar|Expandir/ })).not.toBeInTheDocument();
      expect(getComputedStyle(screen.getByRole('button', { name: 'General' })).height).toBe('34px');
      unmount();
      conTema(<NavegacionLateral etiqueta="Sectores" grupos={SECTORES} />);
      expect(getComputedStyle(screen.getByRole('button', { name: 'General' })).height).toBe('40px');
    });

    it('colapsada, el contador se desvanece y queda un punto en la esquina del ícono', () => {
      conTema(<NavegacionLateral etiqueta="Sectores" rotulo="Sectores" grupos={SECTORES} colapsada />);
      const aprobaciones = screen.getByRole('button', { name: 'Aprobaciones: 3 pendientes' });
      expect(getComputedStyle(within(aprobaciones).getByTestId('punto-contador')).opacity).toBe('1');
      expect(getComputedStyle(within(aprobaciones).getByTestId('contador')).opacity).toBe('0');
    });
  });
});
