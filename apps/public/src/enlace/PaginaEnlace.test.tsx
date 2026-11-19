import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { configurarCliente, reiniciarCliente, type SesionTerceroDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../app/Shell';
import { useSesionTercero } from '../sesion/sesionTercero';
import { olvidarCanjes } from './canje';
import { PaginaEnlace } from './PaginaEnlace';

// Sin el puente del iframe (no es una prueba del modo embebido). El resto del shell es el real: si la campana o los avisos se montaran antes de
// verificar el código, consultarían la API con la sesión anterior y la prueba lo vería en las peticiones.
vi.mock('../embebido/usePuenteEmbebido', () => ({ usePuenteEmbebido: () => undefined }));

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });

/** Una sesión que el navegador conservó de otra visita (la cookie `vs_tercero` la restaura al abrir la página). */
const SESION_ANTERIOR: SesionTerceroDto = {
  accessToken: 'anterior',
  expira: '2099-01-01T00:00:00Z',
  terceroId: 'ter-anterior',
  otpVerificado: true,
  vinculos: [],
  aislada: false,
  terceroEnmascarado: null,
};

// El vencimiento del código: 18 de noviembre de 2026, 03:08 UTC = 10:08 p. m. del 17 en Bogotá.
const EXPIRA = '2026-11-18T03:08:00Z';

function montar(canje: Record<string, unknown>) {
  const peticiones: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(entrada instanceof Request ? entrada.url : entrada.toString(), 'http://localhost');
      peticiones.push(`${init?.method ?? 'GET'} ${url.pathname}`);
      return Promise.resolve(json(202, canje));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e/tok123']}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="e/:token" element={<PaginaEnlace />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return peticiones;
}

afterEach(() => {
  reiniciarCliente();
  olvidarCanjes();
  useSesionTercero.setState({ estado: 'sin-sesion', sesion: null });
});

describe('PaginaEnlace: la pantalla del código', () => {
  it('dice a cuál buzón llegó el código (con el correo tapado) y a qué hora vence, sin suponer que el enlace viene de una invitación', async () => {
    useSesionTercero.setState({ estado: 'sin-sesion', sesion: null });
    montar({ requiereOtp: true, expira: EXPIRA, correoEnmascarado: 'j•••••@aceros.co' });

    expect(await screen.findByRole('heading', { name: 'Escribe el código' })).toBeInTheDocument();
    const texto = screen.getByText(/Lo enviamos a/);
    expect(texto).toHaveTextContent(/^Lo enviamos a j•••••@aceros\.co y vence a las 10:08/);
    expect(texto).not.toHaveTextContent(/invitaci/i);
    // La ayuda habla del código y del enlace del correo, no de «se venció» a secas.
    expect(screen.getByText(/Si el código se venció, abre de nuevo el enlace de tu correo/)).toBeInTheDocument();
  });

  it('si el servidor no dice el correo, lo describe como el correo al que llegó el enlace', async () => {
    montar({ requiereOtp: true, expira: EXPIRA });

    await screen.findByRole('heading', { name: 'Escribe el código' });
    const texto = screen.getByText(/Lo enviamos al correo al que llegó el enlace/);
    expect(texto).toHaveTextContent(/y vence a las 10:08/);
    expect(texto).not.toHaveTextContent(/invitaci/i);
  });

  it('antes de verificar el código no hay navegación, campana ni «Salir» ni se consulta nada autenticado, aunque haya una sesión anterior', async () => {
    useSesionTercero.setState({ estado: 'activa', sesion: SESION_ANTERIOR });
    const peticiones = montar({ requiereOtp: true, expira: EXPIRA, correoEnmascarado: 'j•••••@aceros.co' });

    await screen.findByRole('heading', { name: 'Escribe el código' });
    const barra = screen.getByRole('banner');
    expect(within(barra).queryAllByRole('link')).toHaveLength(0);
    expect(within(barra).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Salir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notificaciones/i })).not.toBeInTheDocument();
    expect(document.querySelector('.MuiBottomNavigation-root')).toBeNull();

    // Deja correr lo que el shell hubiera lanzado al montarse (la campana abre su consulta y su stream al primer render).
    await new Promise((resolver) => setTimeout(resolver, 50));
    expect(peticiones).toEqual(['POST /public/v1/enlaces/tok123/canjear']);
  });
});
