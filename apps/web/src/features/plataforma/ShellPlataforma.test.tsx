import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SesionAvalasoft } from '@avalasoft/api-client';
import { createAvalasoftTheme } from '@avalasoft/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSesion } from '../../sesion/sesionStore';
import { ShellPlataforma } from './ShellPlataforma';

const GRUPOS = [
  { titulo: 'Inicio', secciones: [{ nombre: 'Grupos y empresas', ruta: '/plataforma/grupos' }] },
  {
    titulo: 'Cumplimiento',
    secciones: [
      { nombre: 'Habeas data', ruta: '/plataforma/habeas' },
      { nombre: 'Accesos a terceros', ruta: '/plataforma/accesos-a-terceros' },
      { nombre: 'Listas restrictivas', ruta: '/plataforma/listas' },
      { nombre: 'Fuentes oficiales', ruta: '/plataforma/fuentes' },
    ],
  },
  {
    titulo: 'Operación',
    secciones: [
      { nombre: 'Uso de IA', ruta: '/plataforma/uso-ia' },
      { nombre: 'Operadores', ruta: '/plataforma/operadores' },
      { nombre: 'Ingresos', ruta: '/plataforma/ingresos' },
      { nombre: 'Secretos', ruta: '/plataforma/secretos' },
    ],
  },
];
const SECCIONES = GRUPOS.flatMap((g) => g.secciones);
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

const navegacion = () => screen.getByRole('navigation', { name: 'Secciones' });
const enlaces = () => within(navegacion()).queryAllByRole('link');

beforeEach(() => {
  window.localStorage.clear();
  useSesion.setState({ sesion: sesionDeOperador(), estado: 'activa' });
});

afterEach(() => {
  useSesion.setState({ sesion: null, estado: 'sin-sesion' });
  window.localStorage.clear();
});

describe('ShellPlataforma', () => {
  it('la barra lateral lista las nueve secciones agrupadas (Inicio, Cumplimiento, Operación), cada una con su ruta', () => {
    montar('/plataforma/operadores');
    expect(enlaces().map((e) => e.textContent)).toEqual(NOMBRES);
    for (const { nombre, ruta } of SECCIONES) expect(screen.getByRole('link', { name: nombre })).toHaveAttribute('href', ruta);
    for (const { titulo } of GRUPOS) expect(within(navegacion()).getByText(titulo)).toBeInTheDocument();
    expect(within(navegacion()).getByText('Navegación')).toBeInTheDocument();
  });

  it('marca como activa la sección de la ruta, también en una pantalla que cuelga de ella', () => {
    montar('/plataforma/grupos/t-1/empresas/e-1/plan-ia');
    expect(screen.getByRole('link', { name: 'Grupos y empresas' })).toHaveAttribute('aria-current', 'page');
    for (const enlace of enlaces().filter((e) => e.textContent !== 'Grupos y empresas')) expect(enlace).not.toHaveAttribute('aria-current');
  });

  it('con una ruta fuera de las secciones (Mi cuenta) ninguna queda activa', () => {
    montar('/plataforma/mi-cuenta');
    for (const enlace of enlaces()) expect(enlace).not.toHaveAttribute('aria-current');
  });

  it('el contenido va en el panel principal (`main`), no en la barra', () => {
    montar('/plataforma/grupos');
    expect(within(screen.getByRole('main')).getByText('Contenido de la sección')).toBeInTheDocument();
    expect(within(navegacion()).queryByText('Contenido de la sección')).not.toBeInTheDocument();
  });

  it('la barra superior lleva el logotipo, la píldora «Plataforma» y el chip del operador con su nombre y el sistema desde el que opera', () => {
    montar('/plataforma/grupos');
    const barra = screen.getByRole('banner');
    expect(within(barra).getByRole('img', { name: 'AvalaSoft' })).toBeInTheDocument();
    expect(within(barra).getByText('Plataforma')).toBeInTheDocument();
    expect(within(barra).getByText('Paula Plataforma')).toBeInTheDocument();
    expect(within(barra).getByText('Backoffice')).toBeInTheDocument();
    // El texto completo («persona · operador de Plataforma desde sistema») es el nombre accesible del chip.
    expect(screen.getByLabelText('Paula Plataforma · operador de Plataforma desde Backoffice')).toBeInTheDocument();
  });

  it('sin el sistema desde el que se abrió la sesión, el rol del chip dice «Operador de Plataforma»', () => {
    useSesion.setState({ sesion: sesionDeOperador({ sistema: null }) });
    montar('/plataforma/grupos');
    expect(screen.queryByText(/operador de Plataforma desde/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Operador de Plataforma')).toBeInTheDocument();
  });

  it('usa el identificador cuando la sesión no trae el nombre de la persona', () => {
    useSesion.setState({ sesion: sesionDeOperador({ nombre: null }) });
    montar('/plataforma/grupos');
    expect(within(screen.getByRole('banner')).getByText('op-1')).toBeInTheDocument();
  });

  it('sin la sesión de un operador de Plataforma va a la raíz', () => {
    useSesion.setState({ sesion: sesionDeOperador({ tenantId: 'tenant-1', actorTipo: null }) });
    montar('/plataforma/grupos');
    expect(screen.getByText('Inicio de la empresa')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });
});

describe('ShellPlataforma: colapsar la barra lateral', () => {
  it('colapsar no cambia la estructura: los mismos enlaces y títulos siguen montados (solo cambia el ancho y la opacidad del texto)', async () => {
    const usuario = userEvent.setup();
    montar('/plataforma/grupos');
    const antes = enlaces();
    const boton = screen.getByRole('button', { name: 'Colapsar la navegación' });
    expect(boton).toHaveAttribute('aria-expanded', 'true');

    await usuario.click(boton);
    const colapsar = screen.getByRole('button', { name: 'Expandir la navegación' });
    expect(colapsar).toHaveAttribute('aria-expanded', 'false');
    expect(enlaces()).toHaveLength(antes.length);
    expect(enlaces().map((e) => e.textContent)).toEqual(NOMBRES);
    expect(navegacion()).toHaveStyle({ width: '58px' });
    // El texto de cada ítem sigue en el DOM y solo se desvanece.
    expect(within(navegacion()).getByText('Grupos y empresas')).toHaveStyle({ opacity: '0', whiteSpace: 'nowrap' });
    expect(within(navegacion()).getByText('Cumplimiento')).toHaveStyle({ opacity: '0' });
    expect(window.localStorage.getItem('avalasoft:plataforma:navegacion-colapsada')).toBe('1');

    await usuario.click(colapsar);
    expect(navegacion()).toHaveStyle({ width: '244px' });
    expect(within(navegacion()).getByText('Grupos y empresas')).toHaveStyle({ opacity: '1' });
  });

  it('recuerda que la barra estaba colapsada', () => {
    window.localStorage.setItem('avalasoft:plataforma:navegacion-colapsada', '1');
    montar('/plataforma/grupos');
    expect(screen.getByRole('button', { name: 'Expandir la navegación' })).toBeInTheDocument();
    expect(navegacion()).toHaveStyle({ width: '58px' });
  });

  it('el ancho se anima y los íconos van en una caja fija de 40 px que no cambia entre estados', () => {
    montar('/plataforma/grupos');
    expect(getComputedStyle(navegacion()).transition).toContain('width 0.18s');
    expect(navegacion()).toHaveStyle({ overflow: 'hidden' });
    const enlace = screen.getByRole('link', { name: 'Grupos y empresas' });
    const caja = enlace.querySelector('span[aria-hidden], div[aria-hidden]');
    expect(caja).toHaveStyle({ width: '40px', height: '40px' });
  });
});
