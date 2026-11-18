import { ThemeProvider } from '@mui/material';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SesionAvalasoft } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSesion } from '../../sesion/sesionStore';
import { ShellPlataforma } from './ShellPlataforma';

const SECCIONES = [
  { nombre: 'Grupos y empresas', ruta: '/plataforma/grupos' },
  { nombre: 'Habeas data', ruta: '/plataforma/habeas' },
  { nombre: 'Accesos a terceros', ruta: '/plataforma/accesos-a-terceros' },
  { nombre: 'Uso de IA', ruta: '/plataforma/uso-ia' },
  { nombre: 'Operadores', ruta: '/plataforma/operadores' },
  { nombre: 'Ingresos', ruta: '/plataforma/ingresos' },
  { nombre: 'Secretos', ruta: '/plataforma/secretos' },
  { nombre: 'Listas restrictivas', ruta: '/plataforma/listas' },
  { nombre: 'Fuentes oficiales', ruta: '/plataforma/fuentes' },
];
const NOMBRES = SECCIONES.map((s) => s.nombre);

function sesionDeOperador(cambios: Partial<SesionAvalasoft> = {}): SesionAvalasoft {
  return {
    token: 'token',
    expira: new Date(Date.now() + 3_600_000),
    usuarioId: 'op-1',
    tenantId: null,
    nombre: 'Paula Plataforma',
    sistema: 'Backoffice',
    sesionId: null,
    metodoIngreso: null,
    actorTipo: 'Plataforma',
    scopesDeTenant: new Set(['plataforma:tenants']),
    scopesPorEmpresa: new Map(),
    empresas: new Set(),
    ...cambios,
  };
}

function montar(ruta: string) {
  render(
    <ThemeProvider theme={createAvalasoftTheme('light')}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/" element={<p>Inicio de la empresa</p>} />
          <Route path="/plataforma" element={<ShellPlataforma />}>
            <Route path="*" element={<p>Contenido de la sección</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const barra = () => screen.getByRole('navigation', { name: 'Secciones' });
const enlaces = () => within(barra()).queryAllByRole('link');

beforeEach(() => {
  useSesion.setState({ sesion: sesionDeOperador(), estado: 'activa' });
});

afterEach(() => {
  useSesion.setState({ sesion: null, estado: 'sin-sesion' });
});

describe('ShellPlataforma', () => {
  it('sin layout muestra las nueve secciones como enlaces de la barra «Secciones», sin «Más»', () => {
    montar('/plataforma/operadores');
    expect(enlaces().map((e) => e.textContent)).toEqual(NOMBRES);
    for (const { nombre, ruta } of SECCIONES) expect(screen.getByRole('link', { name: nombre })).toHaveAttribute('href', ruta);
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('marca como activa la sección de la ruta, también en una pantalla que cuelga de ella', () => {
    montar('/plataforma/grupos/t-1/empresas/e-1/plan-ia');
    expect(screen.getByRole('link', { name: 'Grupos y empresas' })).toHaveAttribute('aria-current', 'page');
    for (const enlace of enlaces().filter((e) => e.textContent !== 'Grupos y empresas')) expect(enlace).not.toHaveAttribute('aria-current');
  });

  it('la barra no se desplaza en horizontal: lo que no cabe pasa a «Más»', () => {
    montar('/plataforma/grupos');
    expect(barra()).toHaveStyle({ overflow: 'hidden' });
  });

  it('con una ruta fuera de las secciones (Mi cuenta) ninguna pestaña queda activa', () => {
    montar('/plataforma/mi-cuenta');
    for (const enlace of enlaces()) expect(enlace).not.toHaveAttribute('aria-current');
  });

  it('muestra quién opera desde qué sistema, acortado con puntos suspensivos si no cabe y con el texto completo en el tooltip', () => {
    montar('/plataforma/grupos');
    const texto = screen.getByText('Paula Plataforma · operador de Plataforma desde Backoffice');
    expect(texto).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' });
    expect(texto).toHaveAttribute('aria-label', 'Paula Plataforma · operador de Plataforma desde Backoffice');
    // Es un hijo directo del encabezado: comparte la fila con la barra (que toma lo que sobra) y no la desborda.
    expect(texto.parentElement).toBe(screen.getByRole('banner'));
  });

  it('sin el sistema desde el que se abrió la sesión no hay texto del operador', () => {
    useSesion.setState({ sesion: sesionDeOperador({ sistema: null }) });
    montar('/plataforma/grupos');
    expect(screen.queryByText(/operador de Plataforma desde/)).not.toBeInTheDocument();
  });

  it('usa el identificador cuando la sesión no trae el nombre de la persona', () => {
    useSesion.setState({ sesion: sesionDeOperador({ nombre: null }) });
    montar('/plataforma/grupos');
    expect(screen.getByText('op-1 · operador de Plataforma desde Backoffice')).toBeInTheDocument();
  });

  it('sin la sesión de un operador de Plataforma va a la raíz', () => {
    useSesion.setState({ sesion: sesionDeOperador({ tenantId: 'tenant-1', actorTipo: null }) });
    montar('/plataforma/grupos');
    expect(screen.getByText('Inicio de la empresa')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });
});

describe('ShellPlataforma midiendo el diseño real', () => {
  /** Un ResizeObserver y unas medidas de elemento simulados: en jsdom no hay layout. */
  const observadores = new Set<() => void>();
  let anchoBarra = 0;

  beforeEach(() => {
    class ResizeObserverSimulado {
      constructor(private readonly alCambiar: () => void) {}
      observe() {
        observadores.add(this.alCambiar);
      }
      disconnect() {
        observadores.delete(this.alCambiar);
      }
      unobserve() {
        observadores.delete(this.alCambiar);
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverSimulado);
    // Cada sección mide 100 px y el botón «Más» 60 (con 2 px de separación entre pestañas).
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const ancho = this.tagName === 'NAV' ? anchoBarra : this.hasAttribute('data-texto') ? (this.getAttribute('data-texto') === 'Más' ? 60 : 100) : 0;
      return { width: ancho, height: 0, top: 0, left: 0, right: ancho, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    observadores.clear();
  });

  const cambiarAncho = (ancho: number) => {
    anchoBarra = ancho;
    act(() => observadores.forEach((alCambiar) => alCambiar()));
  };

  it('las secciones que no caben pasan a «Más», que las lista como enlaces en su orden y las recupera al ensanchar', async () => {
    const usuario = userEvent.setup();
    anchoBarra = 1200;
    montar('/plataforma/grupos');
    expect(enlaces()).toHaveLength(9);
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();

    // 3 secciones y «Más» (3·100 + 2·2 + 2 + 60 = 366); la cuarta no cabe.
    cambiarAncho(370);
    expect(enlaces().map((e) => e.textContent)).toEqual(['Grupos y empresas', 'Habeas data', 'Accesos a terceros']);
    const mas = screen.getByRole('button', { name: 'Más' });
    expect(mas).toHaveAttribute('aria-haspopup', 'menu');
    expect(mas).not.toHaveAttribute('aria-current');

    await usuario.click(mas);
    const items = within(screen.getByRole('menu', { name: 'Más secciones' })).getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(NOMBRES.slice(3));
    expect(items.map((i) => i.getAttribute('href'))).toEqual(SECCIONES.slice(3).map((s) => s.ruta));
    await usuario.keyboard('{Escape}');

    cambiarAncho(1200);
    expect(enlaces()).toHaveLength(9);
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
  });

  it('con la sección activa dentro de «Más», el botón lleva su nombre y queda activo', async () => {
    const usuario = userEvent.setup();
    anchoBarra = 370;
    montar('/plataforma/fuentes');
    expect(screen.queryByRole('button', { name: 'Más' })).not.toBeInTheDocument();
    const boton = screen.getByRole('button', { name: 'Fuentes oficiales' });
    expect(boton).toHaveAttribute('aria-current', 'page');
    for (const enlace of enlaces()) expect(enlace).not.toHaveAttribute('aria-current');

    await usuario.click(boton);
    expect(screen.getByRole('menuitem', { name: 'Fuentes oficiales' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'Secretos' })).not.toHaveAttribute('aria-current');
  });
});
