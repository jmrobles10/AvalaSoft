import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarSemilla, interpretarSemilla } from './semilla';

const DEMO = {
  apiKey: 'vs_demo',
  clavePrivadaPem: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  sistema: { id: 's1', codigo: 'DEMO' },
  empresas: [{ id: 'e1', nombre: 'Constructora Norte' }],
  usuarios: [{ sub: 'u-admin', nombre: 'Ana Administradora', correo: 'ana@demo.co', descripcion: 'Administradora de todo el tenant' }],
};

const PLATAFORMA = {
  clavePlataforma: 'clave-de-plataforma',
  sistema: 'CONSOLA_DEV',
  clavePrivadaPem: '-----BEGIN PRIVATE KEY-----\nxyz\n-----END PRIVATE KEY-----',
  persona: { sub: 'op-paula', nombre: 'Paula Plataforma', correo: 'paula@avalasoft.local' },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('interpretarSemilla', () => {
  it('lee la semilla completa: personas de la demostración y operador de Plataforma', () => {
    const semilla = interpretarSemilla({ generadoEn: '2026-11-17T10:00:00Z', apiUrl: 'http://localhost:5080', tenant: { id: 't1', slug: 'demo' }, ...DEMO, plataforma: PLATAFORMA });
    expect(semilla?.demo).toEqual(DEMO);
    expect(semilla?.plataforma).toEqual(PLATAFORMA);
  });

  it('acepta el archivo parcial de `semilla:plataforma`: sin tenant ni sistema, solo el operador', () => {
    const semilla = interpretarSemilla({ generadoEn: '2026-11-17T10:00:00Z', apiUrl: 'http://localhost:5080', plataforma: PLATAFORMA });
    expect(semilla).toEqual({ demo: null, plataforma: PLATAFORMA });
  });

  it('acepta una semilla anterior a la consola de Plataforma: solo la demostración', () => {
    expect(interpretarSemilla(DEMO)).toEqual({ demo: DEMO, plataforma: null });
  });

  it('no inventa la parte de personas si falta algo de ella, pero conserva el operador', () => {
    expect(interpretarSemilla({ ...DEMO, apiKey: '', plataforma: PLATAFORMA })).toEqual({ demo: null, plataforma: PLATAFORMA });
    expect(interpretarSemilla({ ...DEMO, sistema: undefined, plataforma: PLATAFORMA })).toEqual({ demo: null, plataforma: PLATAFORMA });
    expect(interpretarSemilla({ ...DEMO, usuarios: [{ sub: 'u1' }], plataforma: PLATAFORMA })).toEqual({ demo: null, plataforma: PLATAFORMA });
  });

  it('descarta un operador incompleto', () => {
    expect(interpretarSemilla({ ...DEMO, plataforma: { ...PLATAFORMA, persona: { sub: 'op' } } })).toEqual({ demo: DEMO, plataforma: null });
  });

  it('devuelve null si no trae ninguna de las dos partes o no es un objeto', () => {
    expect(interpretarSemilla({ generadoEn: '2026-11-17T10:00:00Z', apiUrl: 'http://localhost:5080' })).toBeNull();
    expect(interpretarSemilla({})).toBeNull();
    expect(interpretarSemilla(null)).toBeNull();
    expect(interpretarSemilla([DEMO])).toBeNull();
    expect(interpretarSemilla('semilla')).toBeNull();
  });
});

describe('cargarSemilla', () => {
  it('pide /__dev/semilla.json e interpreta el archivo parcial', async () => {
    const fetchFalso = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ plataforma: PLATAFORMA }), { status: 200 })));
    vi.stubGlobal('fetch', fetchFalso);
    await expect(cargarSemilla()).resolves.toEqual({ demo: null, plataforma: PLATAFORMA });
    expect(fetchFalso).toHaveBeenCalledWith('/__dev/semilla.json');
  });

  it('devuelve null si el archivo no existe (404) o la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 404 }))));
    await expect(cargarSemilla()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fallo de red'))));
    await expect(cargarSemilla()).resolves.toBeNull();
  });
});
