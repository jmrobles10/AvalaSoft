import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createValidaloTheme } from '@validalo/ui';
import { CircleCheck, Clock } from 'lucide-react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResumenKpis, type KpiResumen } from './ResumenKpis';

const KPIS: KpiResumen[] = [
  { clave: 'a', icono: CircleCheck, tono: 'verde', titulo: 'Aprobados', valor: '12', detalle: 'de 13 cerrados', a: '/e/emp/informes' },
  { clave: 'b', icono: Clock, tono: 'ambar', titulo: 'Por vencer', valor: '3' },
  { clave: 'c', icono: Clock, tono: 'rojo', titulo: 'Vencidos', valor: '2', a: null },
];

function Ubicacion() {
  const { pathname } = useLocation();
  return <p>{`Ubicación: ${pathname}`}</p>;
}

function montar(nodo: React.ReactNode) {
  return render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route path="/inicio" element={nodo} />
          <Route path="*" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('ResumenKpis', () => {
  it('dibuja una tarjeta por cifra: con `a` es un enlace del enrutador; sin `a` (o con null) es solo una cifra', async () => {
    const usuario = userEvent.setup();
    montar(<ResumenKpis etiqueta="Resumen" kpis={KPIS} />);
    const region = screen.getByRole('region', { name: 'Resumen' });
    const enlace = within(region).getByRole('link', { name: /^Aprobados/ });
    expect(enlace).toHaveAttribute('href', '/e/emp/informes');
    expect(enlace).toHaveTextContent('de 13 cerrados');
    expect(within(region).getAllByRole('link')).toHaveLength(1);
    expect(within(region).getByRole('group', { name: 'Por vencer' })).toHaveTextContent('3');
    expect(within(region).getByRole('group', { name: 'Vencidos' })).toHaveTextContent('2');

    await usuario.click(enlace);
    expect(await screen.findByText('Ubicación: /e/emp/informes')).toBeInTheDocument();
  });

  it('sin `etiqueta` no es una región, y `actualizando` la marca ocupada', () => {
    montar(<ResumenKpis kpis={KPIS} actualizando />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Por vencer' }).parentElement).toHaveAttribute('aria-busy', 'true');
  });

  it('sin cifras (carga) dibuja los esqueletos de las tarjetas, tantos como se pidan', () => {
    const { container } = montar(<ResumenKpis etiqueta="Cargando el resumen" kpis={undefined} cantidadEsqueleto={3} />);
    expect(screen.getByRole('status', { name: 'Cargando el resumen' })).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.MuiSkeleton-root')).toHaveLength(3);
  });
});
