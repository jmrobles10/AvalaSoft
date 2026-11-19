import { generateKeyPairSync } from 'node:crypto';
import { ThemeProvider } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormularioSesionDev } from './FormularioSesionDev';
import { useSesion } from './sesionStore';

const { privateKey: CLAVE_PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const PLATAFORMA = {
  clavePlataforma: 'clave-de-plataforma',
  sistema: 'CONSOLA_DEV',
  clavePrivadaPem: CLAVE_PEM,
  persona: { sub: 'op-paula', nombre: 'Paula Plataforma', correo: 'paula@validalo.local' },
};

const DEMO = {
  apiKey: 'vs_demo',
  clavePrivadaPem: CLAVE_PEM,
  sistema: { id: 's1', codigo: 'DEMO' },
  empresas: [{ id: 'e1', nombre: 'Constructora Norte' }],
  usuarios: [
    { sub: 'u-admin', nombre: 'Ana Administradora', correo: 'ana@demo.co', descripcion: 'Administradora de todo el tenant' },
    { sub: 'u-revisor', nombre: 'Rubén Revisor', correo: 'ruben@demo.co', descripcion: 'Revisor en Constructora Norte' },
  ],
};

/** Token de la sesión de un operador de Plataforma: sin tenant, con el tipo de actor `Plataforma`. */
function tokenDeOperador(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `e30.${Buffer.from(JSON.stringify({ sub: 'op-paula', exp, 'validalo:actor-tipo': 'Plataforma' })).toString('base64url')}.firma`;
}

interface Llamada {
  url: string;
  metodo: string;
  cabeceras: Headers;
}

/** `/__dev/semilla.json` responde con `semilla` (o 404 si es null) y `POST /api/v1/plataforma/sesiones` con una sesión de operador. */
function prepararFetch(semilla: unknown) {
  const llamadas: Llamada[] = [];
  const fetchFalso = vi.fn((entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    llamadas.push({ url, metodo: init?.method ?? 'GET', cabeceras: new Headers(init?.headers) });
    if (url.endsWith('/__dev/semilla.json')) {
      return Promise.resolve(semilla === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(semilla), { status: 200 }));
    }
    const sesion = { token: tokenDeOperador(), expira: new Date(Date.now() + 3600_000).toISOString() };
    return Promise.resolve(new Response(JSON.stringify(sesion), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
  vi.stubGlobal('fetch', fetchFalso);
  configurarCliente({ fetch: fetchFalso });
  return llamadas;
}

const montar = () =>
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <FormularioSesionDev />
    </ThemeProvider>,
  );

beforeEach(() => {
  useSesion.setState({ sesion: null, estado: 'sin-sesion' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  reiniciarCliente();
});

describe('Formulario de sesión de desarrollo con la semilla solo de Plataforma (`pnpm semilla:plataforma`)', () => {
  it('ofrece entrar como operador y no muestra las personas de la demostración; el resto del formulario queda para llenarlo a mano', async () => {
    prepararFetch({ generadoEn: '2026-11-17T10:00:00Z', apiUrl: 'http://localhost:5080', plataforma: PLATAFORMA });
    montar();

    expect(await screen.findByRole('button', { name: /Entrar como operador de Plataforma · Paula Plataforma/ })).toBeEnabled();
    expect(screen.getByText(/solo trae el operador de Plataforma/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Persona')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /API key del sistema integrado/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /Código del sistema/ })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Abrir sesión' })).toBeDisabled();
  });

  it('con una API key escrita a mano el ingreso con aserción sigue disponible', async () => {
    prepararFetch({ plataforma: PLATAFORMA });
    montar();
    await screen.findByRole('button', { name: /Entrar como operador de Plataforma/ });

    await userEvent.type(screen.getByRole('textbox', { name: /API key del sistema integrado/ }), 'vs_escrita_a_mano');
    expect(screen.getByRole('button', { name: 'Abrir sesión' })).toBeEnabled();
  });

  it('«Entrar como operador de Plataforma» canjea con la clave de Plataforma y abre la sesión sin tenant', async () => {
    const llamadas = prepararFetch({ plataforma: PLATAFORMA });
    montar();

    await userEvent.click(await screen.findByRole('button', { name: /Entrar como operador de Plataforma/ }));

    await waitFor(() => expect(useSesion.getState().estado).toBe('activa'));
    expect(useSesion.getState().sesion?.tenantId).toBeNull();
    const canje = llamadas.find((l) => l.url.endsWith('/api/v1/plataforma/sesiones'));
    expect(canje?.metodo).toBe('POST');
    expect(canje?.cabeceras.get('X-Api-Key')).toBe('clave-de-plataforma');
    expect(canje?.cabeceras.get('X-Usuario-Delegado')?.split('.')).toHaveLength(3);
  });
});

describe('Formulario de sesión de desarrollo con la semilla completa o sin semilla', () => {
  it('con la semilla completa prellena el sistema, elige la primera persona y también ofrece al operador', async () => {
    prepararFetch({ ...DEMO, plataforma: PLATAFORMA });
    montar();

    expect(await screen.findByRole('button', { name: /Entrar como operador de Plataforma · Paula Plataforma/ })).toBeEnabled();
    expect(screen.getByText('Credenciales de `pnpm semilla:dev` cargadas.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Persona' })).toHaveTextContent('Ana Administradora');
    expect(screen.getByRole('textbox', { name: /API key del sistema integrado/ })).toHaveValue('vs_demo');
    expect(screen.getByRole('textbox', { name: /Código del sistema/ })).toHaveValue('DEMO');
    expect(screen.getByRole('textbox', { name: 'Correo' })).toHaveValue('ana@demo.co');
  });

  it('una semilla sin operador (anterior a la consola) lo avisa y no ofrece el botón', async () => {
    prepararFetch(DEMO);
    montar();

    expect(await screen.findByText(/no trae operador de Plataforma/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar como operador de Plataforma/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Persona' })).toBeInTheDocument();
  });

  it('sin archivo de semilla explica cómo generarlo y el formulario sigue siendo utilizable', async () => {
    prepararFetch(null);
    montar();

    expect(await screen.findByText(/pnpm semilla:plataforma/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar como operador de Plataforma/ })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /API key del sistema integrado/ })).toBeEnabled();
  });
});
