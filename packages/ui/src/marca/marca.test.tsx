import { ThemeProvider } from '@mui/material';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createValidaloTheme } from '../tema';
import { COLOR } from '../tokens';
import { AnimacionExito, AnimacionExitoUnaVez } from './AnimacionExito';
import { Cargando } from './Cargando';
import {
  ARCO_DE_CARGA,
  ARO_ABIERTO,
  CAJA_ICONO,
  CAJA_LOGOTIPO,
  CHECK_RELLENO,
  coloresDeLogo,
  ESPACIO_SIMBOLO,
  FAVICON,
  GUIA_CHECK,
  LONGITUD_ARO,
  LONGITUD_GUIA,
  PROPORCION_SIMBOLO,
  SIMBOLO_LOGOTIPO,
  TIEMPOS_CARGA,
  TIEMPOS_EXITO,
  TRANSFORMACION_CHECK_ICONO,
  TRANSFORMACION_PALABRA,
  TRANSFORMACION_SIMBOLO,
} from './geometria';
import { PALABRA } from './palabra';
import { Logo } from './Logo';
import { usePrimeraVez } from './movimiento';

const conTema = (nodo: ReactNode, modo: 'light' | 'dark' = 'light', colorEmpresa?: string) =>
  render(<ThemeProvider theme={createValidaloTheme(modo, { app: 'public', ...(colorEmpresa ? { colorEmpresa } : {}) })}>{nodo}</ThemeProvider>);

/** Simula `prefers-reduced-motion` (jsdom no trae matchMedia). */
function menosMovimiento(reducido: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((consulta: string) => ({
      matches: reducido && consulta.includes('prefers-reduced-motion'),
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

/**
 * Termina una animación CSS. Sin `AnimationEvent` en la ventana (jsdom) React escucha el nombre con prefijo, así que se dispara con los dos:
 * el que no escucha se ignora y `onAnimationEnd` se llama una sola vez por cada fin.
 */
function terminarAnimacion(elemento: Element) {
  fireEvent(elemento, new Event('animationend', { bubbles: true }));
  fireEvent(elemento, new Event('webkitAnimationEnd', { bubbles: true }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('colores del logo (MA-1)', () => {
  it('son los del encargo: aro y círculo del design system y la palabra en verde azulado y azul muy oscuro (en oscuro, más claros)', () => {
    expect(coloresDeLogo('light')).toMatchObject({ aro: '#3D6BFF', check: '#22D38A', avala: '#0E8C9A', soft: '#0B1F3A', blanco: '#FFFFFF' });
    expect(coloresDeLogo('dark')).toMatchObject({ aro: '#6E8FFF', check: '#2BE29A', avala: '#3FC1CE', soft: '#EEF3FA', blanco: '#FFFFFF' });
  });

  it('el aro y el círculo salen de los tokens del design system, que siguen llegando a la paleta del tema', () => {
    for (const modo of ['light', 'dark'] as const) {
      const c = COLOR[modo];
      expect(coloresDeLogo(modo)).toMatchObject({ aro: c.marcaAzul, check: c.marcaVerde });
      const { marca } = createValidaloTheme(modo).palette;
      expect([marca.azul, marca.verde, marca.texto, marca.soft]).toEqual([c.marcaAzul, c.marcaVerde, c.marcaTexto, c.marcaSoft]);
    }
  });

  it('la palabra cumple contraste AA de texto grande (3:1) sobre los fondos de cada modo, y «soft» también el de texto normal (4,5:1)', () => {
    const luminancia = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const contraste = (a: string, b: string) => {
      const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
      return ((claro ?? 0) + 0.05) / ((oscuro ?? 0) + 0.05);
    };
    for (const fondo of ['#FFFFFF', '#FAFBFD']) {
      expect(contraste(coloresDeLogo('light').avala, fondo)).toBeGreaterThanOrEqual(3);
      expect(contraste(coloresDeLogo('light').soft, fondo)).toBeGreaterThanOrEqual(4.5);
    }
    for (const fondo of ['0B1120', '060A14'].map((f) => `#${f}`)) {
      expect(contraste(coloresDeLogo('dark').avala, fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(coloresDeLogo('dark').soft, fondo)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('geometría del logo', () => {
  it('el aro completo mide 2πr y la guía del check cabe en su largo de trazo', () => {
    expect(LONGITUD_ARO).toBeCloseTo(282.74, 1);
    const largoGuia = Math.hypot(46 - 28, 68 - 37) + Math.hypot(82 - 46, 20 - 68);
    expect(LONGITUD_GUIA).toBeGreaterThanOrEqual(largoGuia);
    expect(LONGITUD_GUIA - largoGuia).toBeLessThan(1);
    expect(GUIA_CHECK).toBe('M28 37 L46 68 L82 20');
  });

  it('el check y el aro abierto son los aprobados', () => {
    expect(CHECK_RELLENO).toBe('M24 38 C26 34 30 34 32 37 L47 61 C56 45 66 32 80 19 C82 17 85 19 83 22 C70 37 60 52 51 71 C49 75 44 75 42 71 Z');
    expect(ARO_ABIERTO).toBe('M71.1 10.3 A45 45 0 1 0 89 27.5');
    expect(TRANSFORMACION_CHECK_ICONO).toBe('translate(47 70) scale(1.15) translate(-47 -70)');
    expect(CAJA_ICONO).toEqual({ x: -3, y: -6, ancho: 110, alto: 110 });
  });

  it('los tiempos del éxito suman 1,45 s y los de la carga son 1 s de vuelta y 1,4 s de check', () => {
    expect(Object.values(TIEMPOS_EXITO).reduce((a, b) => a + b, 0)).toBe(1450);
    expect(TIEMPOS_CARGA).toEqual({ vuelta: 1000, check: 1400 });
    expect(ARCO_DE_CARGA).toEqual({ visible: 80, hueco: 210 });
  });
});

describe('Logo', () => {
  it('el logotipo se anuncia como «Valídalo» y es un dibujo: no hay texto que se lea suelto', () => {
    const { container } = conTema(<Logo />);
    const logo = screen.getByRole('img', { name: 'Valídalo' });
    expect(logo.tagName.toLowerCase()).toBe('svg');
    expect(logo).toHaveTextContent('');
    expect(container.querySelector('text')).toBeNull();
  });

  it('es el círculo verde con el check blanco y la palabra «validalo» en contornos, en dos tonos (claro)', () => {
    const { container } = conTema(<Logo tamano={40} />);
    const svg = screen.getByRole('img', { name: 'Valídalo' });
    expect(svg).toHaveAttribute('viewBox', `0 0 ${String(CAJA_LOGOTIPO.ancho)} ${String(CAJA_LOGOTIPO.alto)}`);
    expect(svg).toHaveAttribute('height', String(CAJA_LOGOTIPO.alto * 0.4));
    const simbolo = container.querySelector('[data-parte="simbolo"]');
    expect(simbolo).toHaveAttribute('transform', TRANSFORMACION_SIMBOLO);
    expect(simbolo?.querySelector('circle')).toHaveAttribute('fill', '#22D38A');
    expect(simbolo?.querySelector('circle')).toHaveAttribute('r', String(FAVICON.radio));
    const check = simbolo?.querySelector('path');
    expect(check).toHaveAttribute('d', CHECK_RELLENO);
    expect(check).toHaveAttribute('fill', '#FFFFFF');
    expect(container.querySelector('[data-parte="palabra"]')).toHaveAttribute('transform', TRANSFORMACION_PALABRA);
    expect(container.querySelector('[data-parte="avala"]')).toHaveAttribute('d', PALABRA.avala);
    expect(container.querySelector('[data-parte="avala"]')).toHaveAttribute('fill', '#0E8C9A');
    expect(container.querySelector('[data-parte="soft"]')).toHaveAttribute('d', PALABRA.soft);
    expect(container.querySelector('[data-parte="soft"]')).toHaveAttribute('fill', '#0B1F3A');
  });

  it('el círculo mide ≈ 1,05 veces las ascendentes, está centrado entre la línea base y su altura y deja un quinto de su diámetro hasta la palabra', () => {
    const d = SIMBOLO_LOGOTIPO.diametro;
    expect(PROPORCION_SIMBOLO).toBe(1.05);
    expect(d / PALABRA.altoAscendente).toBeCloseTo(1.05, 2);
    // Centro del círculo a la altura de la caja: arriba + radio; el de las ascendentes: la línea base menos la mitad de su altura.
    const centroDelCirculo = SIMBOLO_LOGOTIPO.arriba + d / 2;
    const centroDeLasAscendentes = CAJA_LOGOTIPO.base - PALABRA.altoAscendente / 2;
    expect(Math.abs(centroDelCirculo - centroDeLasAscendentes)).toBeLessThan(0.05);
    // Su borde inferior cae bajo la línea base y el superior sobre las ascendentes.
    expect(centroDelCirculo + d / 2).toBeGreaterThan(CAJA_LOGOTIPO.base);
    expect(centroDelCirculo - d / 2).toBeLessThanOrEqual(CAJA_LOGOTIPO.base - PALABRA.altoAscendente);
    expect(SIMBOLO_LOGOTIPO.separacion / d).toBeCloseTo(ESPACIO_SIMBOLO, 2);
    // El punto más a la izquierda de la palabra queda a `separacion` del borde derecho del círculo.
    expect(CAJA_LOGOTIPO.inicioPalabra + PALABRA.limites.x0 - d).toBeCloseTo(SIMBOLO_LOGOTIPO.separacion, 1);
    // La caja envuelve el círculo y la palabra sin recortarlos.
    expect(SIMBOLO_LOGOTIPO.arriba).toBeGreaterThanOrEqual(0);
    expect(CAJA_LOGOTIPO.base + PALABRA.limites.y1).toBeLessThanOrEqual(CAJA_LOGOTIPO.alto + 0.01);
    expect(CAJA_LOGOTIPO.inicioPalabra + PALABRA.limites.x1).toBeLessThanOrEqual(CAJA_LOGOTIPO.ancho + 0.01);
  });

  it('la palabra va inclinada 10° y toda en minúsculas: su dibujo no trae más letras que «validalo»', () => {
    expect(PALABRA.inclinacion).toBe(10);
    expect(PALABRA.fuente).toContain('Quicksand Bold');
    // Nueve letras en dos trazados: «avala» (a, v, a, l, a) y «soft» (s, o, f, t); cada contorno empieza con una «M» (la «a» y la «o» traen uno más, el de su hueco).
    const contornos = (d: string) => (d.match(/M/g) ?? []).length;
    expect(contornos(PALABRA.avala)).toBe(8);
    expect(contornos(PALABRA.soft)).toBe(5);
  });

  it('cambia con el tema: en oscuro usa los colores del modo oscuro', () => {
    const { container } = conTema(<Logo />, 'dark');
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#2BE29A');
    expect(container.querySelector('[data-parte="avala"]')).toHaveAttribute('fill', '#3FC1CE');
    expect(container.querySelector('[data-parte="soft"]')).toHaveAttribute('fill', '#EEF3FA');
  });

  it('`modo` fuerza los colores aunque el tema sea otro', () => {
    const { container } = conTema(<Logo modo="dark" />, 'light');
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#2BE29A');
  });

  it('no toma el color de la empresa aunque la página use su paleta', () => {
    const { container } = conTema(<Logo />, 'light', '#C2410C');
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#22D38A');
    expect(container.querySelector('[data-parte="avala"]')).toHaveAttribute('fill', '#0E8C9A');
  });

  it('el ícono es el aro abierto y el check escalado desde su vértice, en los colores del modo', () => {
    const { container, rerender } = conTema(<Logo variante="icono" tamano={48} />);
    const svg = screen.getByRole('img', { name: 'Valídalo' });
    expect(svg).toHaveAttribute('viewBox', '-3 -6 110 110');
    expect(svg).toHaveAttribute('width', '48');
    const [aro, check] = Array.from(container.querySelectorAll('path'));
    expect(aro).toHaveAttribute('d', ARO_ABIERTO);
    expect(aro).toHaveAttribute('stroke', '#3D6BFF');
    expect(aro).toHaveAttribute('stroke-width', '5');
    expect(aro).toHaveAttribute('stroke-linecap', 'round');
    expect(check).toHaveAttribute('fill', '#22D38A');
    expect(check).toHaveAttribute('transform', TRANSFORMACION_CHECK_ICONO);
    rerender(
      <ThemeProvider theme={createValidaloTheme('dark')}>
        <Logo variante="icono" tamano={48} />
      </ThemeProvider>,
    );
    expect(container.querySelector('path')).toHaveAttribute('stroke', '#6E8FFF');
  });

  it('el favicon es el círculo verde lleno con el check blanco (y contorno solo ahí)', () => {
    const { container } = conTema(<Logo variante="favicon" tamano={16} />);
    expect(container.querySelector('circle')).toHaveAttribute('fill', '#22D38A');
    expect(container.querySelector('circle')).toHaveAttribute('r', String(FAVICON.radio));
    const check = container.querySelector('path');
    expect(check).toHaveAttribute('fill', '#FFFFFF');
    expect(check).toHaveAttribute('stroke-width', String(FAVICON.contorno));
  });

  it('decorativo no se anuncia', () => {
    const { container } = conTema(
      <>
        <Logo decorativo />
        <Logo variante="icono" decorativo />
      </>,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('el nombre accesible se puede cambiar', () => {
    conTema(<Logo titulo="Valídalo, inicio" />);
    expect(screen.getByRole('img', { name: 'Valídalo, inicio' })).toBeInTheDocument();
  });
});

describe('AnimacionExito', () => {
  beforeEach(() => menosMovimiento(false));

  it('se anuncia como imagen «Listo» (o con la etiqueta pedida) y dibuja aro, relleno y el check blanco con máscara', () => {
    const { container } = conTema(<AnimacionExito etiqueta="Expediente aprobado" tamano={64} />);
    const svg = screen.getByRole('img', { name: 'Expediente aprobado' });
    expect(svg).toHaveAttribute('width', '64');
    expect(container.querySelector('circle.relleno')).toHaveAttribute('fill', '#22D38A');
    expect(container.querySelector('circle.aro')).toHaveAttribute('stroke', '#22D38A');
    const check = container.querySelector('g.check path');
    expect(check).toHaveAttribute('fill', '#FFFFFF');
    const mascara = container.querySelector('mask');
    expect(check?.getAttribute('mask')).toBe(`url(#${mascara?.id ?? ''})`);
    expect(mascara?.querySelector('path')).toHaveAttribute('d', GUIA_CHECK);
  });

  it('en oscuro usa el verde del modo oscuro y el check sigue blanco', () => {
    const { container } = conTema(<AnimacionExito />, 'dark');
    expect(container.querySelector('circle.relleno')).toHaveAttribute('fill', '#2BE29A');
    expect(container.querySelector('g.check path')).toHaveAttribute('fill', '#FFFFFF');
  });

  it('las animaciones siguen el orden del encargo: aro 0,45 s, relleno 0,3 s, check 0,4 s y pop 0,3 s', () => {
    conTema(<AnimacionExito />);
    const css = Array.from(document.querySelectorAll('style'))
      .map((estilo) => estilo.textContent)
      .join('\n');
    expect(css).toMatch(/450ms cubic-bezier\(0\.4, 0, 0\.2, 1\) both/);
    expect(css).toMatch(/300ms ease-out 450ms both/);
    expect(css).toMatch(/400ms cubic-bezier\(0\.22, 1, 0\.36, 1\) 750ms both/);
    expect(css).toMatch(/300ms ease-in-out 1150ms both/);
  });

  it('avisa una sola vez cuando termina el «pop»', () => {
    const alTerminar = vi.fn();
    const { container } = conTema(<AnimacionExito onFin={alTerminar} />);
    const pop = container.querySelector('g.pop');
    expect(pop).not.toBeNull();
    expect(alTerminar).not.toHaveBeenCalled();
    terminarAnimacion(pop!);
    terminarAnimacion(pop!);
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('con menos movimiento no anima y avisa enseguida', () => {
    menosMovimiento(true);
    vi.useFakeTimers();
    const alTerminar = vi.fn();
    conTema(<AnimacionExito onFin={alTerminar} />);
    expect(alTerminar).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(alTerminar).toHaveBeenCalledTimes(1);
    const css = Array.from(document.querySelectorAll('style'))
      .map((estilo) => estilo.textContent)
      .join('\n');
    expect(css).toMatch(/animation:\s*none\s*!important/);
  });

  it('decorativa no se anuncia', () => {
    conTema(<AnimacionExito decorativa />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('con `animar` en falso se ve terminada, sin animaciones, y no cambia el dibujo', () => {
    const { container } = conTema(<AnimacionExito animar={false} />);
    const css = Array.from(document.querySelectorAll('style'))
      .map((estilo) => estilo.textContent)
      .join('\n');
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(container.querySelector('g.check path')).toHaveAttribute('fill', '#FFFFFF');
    expect(container.querySelector('circle.relleno')).toHaveAttribute('fill', '#22D38A');
  });
});

describe('AnimacionExitoUnaVez', () => {
  /** La animación corre cuando su estilo no la anula: se mira la clase de emoción del svg, que cambia con `animar`. */
  const anima = (contenedor: HTMLElement) => {
    const svg = contenedor.querySelector('svg');
    const clase = Array.from(svg?.classList ?? []).find((c) => c.startsWith('css-')) ?? '';
    const reglas = Array.from(document.styleSheets).flatMap((hoja) => Array.from(hoja.cssRules).map((regla) => regla.cssText));
    return !reglas.some((regla) => regla.includes(clase) && /animation:\s*none\s*!important/.test(regla));
  };

  beforeEach(() => menosMovimiento(false));

  it('anima la primera vez que se ve su clave y las siguientes la muestra quieta', () => {
    const primera = conTema(<AnimacionExitoUnaVez clave="ficha-1" decorativa />);
    expect(anima(primera.container)).toBe(true);
    primera.unmount();
    const segunda = conTema(<AnimacionExitoUnaVez clave="ficha-1" decorativa />);
    expect(anima(segunda.container)).toBe(false);
    // Otra clave vuelve a celebrar.
    segunda.unmount();
    expect(anima(conTema(<AnimacionExitoUnaVez clave="ficha-2" decorativa />).container)).toBe(true);
  });
});

describe('Cargando', () => {
  it('es un estado accesible con nombre «Cargando» (o el pedido)', () => {
    conTema(<Cargando />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    conTema(<Cargando etiqueta="Abriendo el documento" />);
    expect(screen.getByRole('status', { name: 'Abriendo el documento' })).toBeInTheDocument();
  });

  it('dibuja el aro tenue (opacidad 0,2), el arco que gira (80 de 210) y el check verde con máscara', () => {
    const { container } = conTema(<Cargando tamano={64} />);
    const [tenue, arco] = Array.from(container.querySelectorAll('circle'));
    expect(tenue).toHaveAttribute('opacity', '0.2');
    expect(tenue).toHaveAttribute('stroke', '#3D6BFF');
    expect(arco).toHaveAttribute('stroke', '#3D6BFF');
    expect(arco).toHaveAttribute('stroke-dasharray', '80 210');
    expect(arco).toHaveClass('giro');
    const check = container.querySelector('g[transform] path');
    expect(check).toHaveAttribute('fill', '#22D38A');
    expect(check?.getAttribute('mask')).toMatch(/^url\(#.+\)$/);
  });

  it('gira 1 s lineal sin fin, traza el check en 1,4 s y con menos movimiento queda estática con un pulso suave', () => {
    conTema(<Cargando />);
    const css = Array.from(document.querySelectorAll('style'))
      .map((estilo) => estilo.textContent)
      .join('\n');
    expect(css).toMatch(/1000ms linear infinite/);
    expect(css).toMatch(/1400ms ease-in-out infinite/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/2s ease-in-out infinite/);
  });

  it('decorativa no es un estado: la región que la contiene ya dice qué se espera', () => {
    const { container } = conTema(<Cargando decorativa />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('en oscuro usa el aro y el check del modo oscuro', () => {
    const { container } = conTema(<Cargando />, 'dark');
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#6E8FFF');
    expect(container.querySelector('g[transform] path')).toHaveAttribute('fill', '#2BE29A');
  });
});

describe('usePrimeraVez', () => {
  it('es verdadero la primera vez que se pide una clave y falso después', () => {
    expect(renderHook(() => usePrimeraVez('expediente-1')).result.current).toBe(true);
    expect(renderHook(() => usePrimeraVez('expediente-1')).result.current).toBe(false);
    expect(renderHook(() => usePrimeraVez('expediente-2')).result.current).toBe(true);
  });

  it('sin almacenamiento celebra siempre', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(renderHook(() => usePrimeraVez('x')).result.current).toBe(true);
    vi.restoreAllMocks();
  });
});
