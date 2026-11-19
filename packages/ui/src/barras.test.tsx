import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CircleX } from 'lucide-react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BarraMedida, BarraSegmentada } from './barras';
import { EsqueletoFilas, EsqueletoKpis } from './esqueletos';
import { FiltroMenu } from './filtros';
import { columnasKpi, GrillaKpi, TarjetaKpi, tonoDeAlerta } from './tarjetas';
import { createValidaloTheme } from './tema';
import { COLOR } from './tokens';

const conTema = (nodo: ReactNode) => render(<ThemeProvider theme={createValidaloTheme('light')}>{nodo}</ThemeProvider>);

describe('BarraSegmentada', () => {
  it('es una imagen con su descripción y dibuja solo los segmentos con valor, cada uno proporcional', () => {
    const { container } = conTema(
      <BarraSegmentada
        etiqueta="Reparto: carga 1, tercero 3"
        segmentos={[
          { clave: 'carga', valor: 1, tono: 'cian' },
          { clave: 'tercero', valor: 3, tono: 'ambar' },
          { clave: 'revision', valor: 0, tono: 'violeta' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Reparto: carga 1, tercero 3' })).toBeInTheDocument();
    const segmentos = container.querySelectorAll('[data-segmento]');
    expect([...segmentos].map((s) => s.getAttribute('data-segmento'))).toEqual(['carga', 'tercero']);
    expect(getComputedStyle(segmentos[0]!).flexGrow).toBe('1');
    expect(getComputedStyle(segmentos[1]!).flexGrow).toBe('3');
  });

  it('sin nada que repartir queda la pista vacía', () => {
    const { container } = conTema(<BarraSegmentada etiqueta="Sin datos" segmentos={[{ clave: 'a', valor: 0, tono: 'cian' }]} />);
    expect(screen.getByRole('img', { name: 'Sin datos' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-segmento]')).toHaveLength(0);
  });
});

describe('BarraMedida', () => {
  it('el relleno es la medida sobre el tope común y la marca va en su punto del mismo eje', () => {
    const { container } = conTema(<BarraMedida valor={2} maximo={8} marca={6} etiqueta="Promedio de Compras: 2 días; máximo 6 días" />);
    const barra = screen.getByRole('img', { name: 'Promedio de Compras: 2 días; máximo 6 días' });
    expect(getComputedStyle(barra.firstElementChild!).width).toBe('25%');
    const marca = container.querySelector('[data-marca]');
    expect(marca).not.toBeNull();
    expect(getComputedStyle(marca!).left).toBe('calc(75% - 1px)');
  });

  it('sin marca no la dibuja; con tope 0 o valores fuera de rango no se sale de la pista ni divide por cero', () => {
    const { container, rerender } = conTema(<BarraMedida valor={5} maximo={0} etiqueta="Sin escala" />);
    expect(container.querySelector('[data-marca]')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sin escala' })).toBeInTheDocument();
    rerender(
      <ThemeProvider theme={createValidaloTheme('light')}>
        <BarraMedida valor={50} maximo={10} marca={-3} etiqueta="Fuera de rango" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('img', { name: 'Fuera de rango' })).toBeInTheDocument();
  });
});

describe('TarjetaKpi en rojo, GrillaKpi y EsqueletoKpis', () => {
  it('la tarjeta es un grupo con el nombre de su rótulo y, en rojo, lleva la cifra y el borde de alerta', () => {
    conTema(<TarjetaKpi icono={CircleX} tono="rojo" titulo="Vencidos ahora" valor="5" detalle="Siguen esperando" />);
    const grupo = screen.getByRole('group', { name: 'Vencidos ahora' });
    expect(grupo).toHaveTextContent('5');
    expect(grupo).toHaveTextContent('Siguen esperando');
    expect(getComputedStyle(within(grupo).getByText('5')).color).toBe(hexARgb(COLOR.light.estadoErrorTexto));
    expect(getComputedStyle(grupo).borderColor).toBe(hexARgb(COLOR.light.estadoErrorBorde));
  });

  it('una tarjeta que no es alerta conserva el borde y la cifra normales', () => {
    conTema(<TarjetaKpi icono={CircleX} tono="verde" titulo="Aprobados" valor="9" etiqueta="Aprobados del periodo" />);
    const grupo = screen.getByRole('group', { name: 'Aprobados del periodo' });
    expect(getComputedStyle(grupo).borderColor).not.toBe(hexARgb(COLOR.light.estadoErrorBorde));
  });

  it('la rejilla es una región con nombre solo si lo tiene, y puede marcarse ocupada', () => {
    const { rerender } = conTema(
      <GrillaKpi columnas={5} etiqueta="Resumen" ocupada>
        <TarjetaKpi icono={CircleX} tono="cian" titulo="A" valor="1" />
      </GrillaKpi>,
    );
    expect(screen.getByRole('region', { name: 'Resumen' })).toHaveAttribute('aria-busy', 'true');
    rerender(
      <ThemeProvider theme={createValidaloTheme('light')}>
        <GrillaKpi>
          <TarjetaKpi icono={CircleX} tono="cian" titulo="A" valor="1" />
        </GrillaKpi>
      </ThemeProvider>,
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('el esqueleto es una región ocupada con una tarjeta gris por cifra', () => {
    const { container } = conTema(<EsqueletoKpis etiqueta="Cargando el resumen" cantidad={5} />);
    const region = screen.getByRole('status', { name: 'Cargando el resumen' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(5);
  });
});

describe('TarjetaKpi como enlace', () => {
  it('con `to` la tarjeta entera es un enlace con su rótulo, su cifra y un chevron oculto a los lectores; sin él sigue siendo un grupo', () => {
    conTema(
      <>
        <TarjetaKpi icono={CircleX} tono="cian" titulo="Con lista" valor="4" detalle="Ver la lista" to="/lista" />
        <TarjetaKpi icono={CircleX} tono="cian" titulo="Sin lista" valor="9" />
      </>,
    );
    const enlace = screen.getByRole('link', { name: /^Con lista/ });
    expect(enlace).toHaveAttribute('href', '/lista');
    expect(enlace).toHaveTextContent('4');
    expect(enlace).toHaveTextContent('Ver la lista');
    // El ícono del rótulo y el chevron son decorativos.
    for (const icono of enlace.querySelectorAll('svg')) expect(icono.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('group', { name: 'Con lista' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sin lista' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sin lista/ })).not.toBeInTheDocument();
  });

  it('usa el componente de enlace que se le dé (el del enrutador) y, en rojo, conserva el borde y la cifra de alerta', () => {
    const Enlace = ({ to, children, ...resto }: { to: string; children?: ReactNode; className?: string }) => (
      <a data-enrutador="" href={`#${to}`} {...resto}>
        {children}
      </a>
    );
    conTema(<TarjetaKpi icono={CircleX} tono="rojo" titulo="Vencidos" valor="5" componente={Enlace} to="/vencidos" etiqueta="Vencidos: 5" />);
    const enlace = screen.getByRole('link', { name: 'Vencidos: 5' });
    expect(enlace).toHaveAttribute('data-enrutador');
    expect(enlace).toHaveAttribute('href', '#/vencidos');
    expect(getComputedStyle(enlace).borderColor).toBe(hexARgb(COLOR.light.estadoErrorBorde));
    expect(getComputedStyle(within(enlace).getByText('5')).color).toBe(hexARgb(COLOR.light.estadoErrorTexto));
  });
});

describe('tonoDeAlerta, columnasKpi y esqueletos del tablero', () => {
  it('una cifra de alerta es roja si hay algo y verde si no', () => {
    expect(tonoDeAlerta(3)).toBe('rojo');
    expect(tonoDeAlerta(0)).toBe('verde');
  });

  it('las columnas dependen de cuántas tarjetas hay, sin dejar filas a medias donde se pueda evitar', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(columnasKpi)).toEqual([3, 3, 3, 4, 5, 3, 4, 4]);
  });

  it('el esqueleto acepta cualquier cantidad de tarjetas (6, en tres columnas)', () => {
    const { container } = conTema(<EsqueletoKpis etiqueta="Cargando" cantidad={6} />);
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(6);
  });

  it('el esqueleto de filas es una región ocupada con un círculo, dos líneas y la cifra por fila', () => {
    const { container } = conTema(<EsqueletoFilas etiqueta="Cargando las filas" cantidad={2} />);
    expect(screen.getByRole('status', { name: 'Cargando las filas' })).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.MuiSkeleton-circular')).toHaveLength(2);
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(2 * 4);
  });
});

describe('FiltroMenu a todo el ancho', () => {
  it('ocupa su contenedor, conserva rótulo y valor y sigue eligiendo opciones', async () => {
    const alCambiar = vi.fn();
    conTema(
      <div style={{ width: 300 }}>
        <FiltroMenu fullWidth etiqueta="Estado" textoTodos="Todos" valor="" onCambiar={alCambiar} opciones={[{ valor: 'a', etiqueta: 'Aprobado' }]} />
      </div>,
    );
    const boton = screen.getByRole('button', { name: /^Estado/ });
    expect(boton).toHaveTextContent('EstadoTodos');
    expect(getComputedStyle(boton).width).toBe('100%');
    await userEvent.click(boton);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Aprobado' }));
    expect(alCambiar).toHaveBeenCalledWith('a');
  });
});

/** `#RRGGBB` → `rgb(r, g, b)` (como lo devuelve `getComputedStyle`). */
function hexARgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}
