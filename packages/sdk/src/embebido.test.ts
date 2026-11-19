import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { interpretarMensajeDelEmbebido, montarEmbebido, origenDeUrl, type MensajeDelEmbebido, type SesionEmbebidaDto } from './embebido';

const ORIGEN_VALIDALO = 'https://valida.acme.co';

const sesion = (token = 'cabecera.carga.firma'): SesionEmbebidaDto => ({
  token,
  expira: '2026-11-11T12:10:00Z',
  url: `${ORIGEN_VALIDALO}/embed/boveda`,
  origen: 'https://anfitrion.test',
  componente: 'boveda',
  vinculoId: 'v1',
  terceroId: 't1',
});

describe('interpretarMensajeDelEmbebido', () => {
  it('acepta solo los tres mensajes del protocolo con su forma', () => {
    expect(interpretarMensajeDelEmbebido({ tipo: 'validalo:ready', version: 1 })).toEqual({ tipo: 'validalo:ready', version: 1 });
    expect(interpretarMensajeDelEmbebido({ tipo: 'validalo:sesion-requerida', motivo: 'por-vencer' })).toEqual({ tipo: 'validalo:sesion-requerida', motivo: 'por-vencer' });
    expect(interpretarMensajeDelEmbebido({ tipo: 'validalo:resize', height: 480.2 })).toEqual({ tipo: 'validalo:resize', height: 481 });
  });

  it.each([
    null,
    'texto',
    [],
    {},
    { tipo: 5 },
    { tipo: 'otra:cosa' },
    { tipo: 'validalo:ready' },
    { tipo: 'validalo:sesion-requerida', motivo: 'quien-sabe' },
    { tipo: 'validalo:resize', height: -1 },
    { tipo: 'validalo:resize', height: Number.NaN },
    { tipo: 'validalo:resize', height: '400' },
  ])('ignora %j', (datos) => {
    expect(interpretarMensajeDelEmbebido(datos)).toBeNull();
  });

  it('origenDeUrl da esquema, host y puerto', () => {
    expect(origenDeUrl('https://valida.acme.co/embed/boveda?x=1')).toBe(ORIGEN_VALIDALO);
    expect(origenDeUrl('http://localhost:5173/a')).toBe('http://localhost:5173');
    expect(() => origenDeUrl('/relativa')).toThrow();
  });
});

/** Un `window` y un `document` mínimos: lo justo para montar el iframe y probar el protocolo sin un navegador. */
function entornoFalso() {
  const escuchas = new Map<string, (evento: unknown) => void>();
  const enviados: { mensaje: unknown; origen: string }[] = [];
  const iframe = {
    title: '',
    src: '',
    style: { cssText: '', height: '' },
    contentWindow: { postMessage: (mensaje: unknown, origen: string) => enviados.push({ mensaje, origen }) },
    atributos: {} as Record<string, string>,
    setAttribute(nombre: string, valor: string) {
      this.atributos[nombre] = valor;
    },
    quitado: false,
    remove() {
      this.quitado = true;
    },
  };
  const hijos: unknown[] = [];
  vi.stubGlobal('document', { createElement: () => iframe });
  vi.stubGlobal('window', {
    addEventListener: (tipo: string, f: (evento: unknown) => void) => escuchas.set(tipo, f),
    removeEventListener: (tipo: string) => escuchas.delete(tipo),
  });
  const contenedor = { appendChild: (nodo: unknown) => hijos.push(nodo) } as unknown as HTMLElement;
  const recibir = (datos: unknown, origen = ORIGEN_VALIDALO, origenDeLaVentana: unknown = iframe.contentWindow) =>
    escuchas.get('message')?.({ data: datos, origin: origen, source: origenDeLaVentana });
  return { iframe, enviados, hijos, contenedor, escuchas, recibir };
}

describe('montarEmbebido', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('inserta el iframe con la URL sin token y entrega la sesión solo al origen de Valídalo cuando está listo', () => {
    const e = entornoFalso();
    const alMensaje = vi.fn<(m: MensajeDelEmbebido) => void>();
    montarEmbebido({ contenedor: e.contenedor, sesion: sesion(), alMensaje, titulo: 'Mi bóveda' });

    expect(e.hijos).toEqual([e.iframe]);
    expect(e.iframe.src).toBe(`${ORIGEN_VALIDALO}/embed/boveda`);
    expect(e.iframe.src).not.toContain('cabecera.carga.firma');
    expect(e.iframe.title).toBe('Mi bóveda');
    expect(e.iframe.atributos.referrerpolicy).toBe('origin');
    expect(e.enviados).toEqual([]); // nada se envía antes de que el iframe diga que está listo

    e.recibir({ tipo: 'validalo:ready', version: 1 });
    expect(e.enviados).toEqual([{ mensaje: { tipo: 'validalo:sesion', token: 'cabecera.carga.firma' }, origen: ORIGEN_VALIDALO }]);
    expect(alMensaje).toHaveBeenCalledWith({ tipo: 'validalo:ready', version: 1 });
  });

  it('ignora mensajes de otro origen, de otra ventana o con forma inválida: nunca entrega el token', () => {
    const e = entornoFalso();
    const alMensaje = vi.fn();
    montarEmbebido({ contenedor: e.contenedor, sesion: sesion(), alMensaje });

    e.recibir({ tipo: 'validalo:ready', version: 1 }, 'https://intruso.test'); // otro origen
    e.recibir({ tipo: 'validalo:ready', version: 1 }, ORIGEN_VALIDALO, {}); // otra ventana
    e.recibir({ tipo: 'validalo:ready' }); // forma inválida
    e.recibir('validalo:ready');
    expect(e.enviados).toEqual([]);
    expect(alMensaje).not.toHaveBeenCalled();
  });

  it('pide otra sesión a su backend cuando Valídalo la requiere y la entrega al mismo origen', async () => {
    const e = entornoFalso();
    const renovarSesion = vi.fn(() => Promise.resolve(sesion('nuevo.token.firma')));
    montarEmbebido({ contenedor: e.contenedor, sesion: sesion(), renovarSesion });

    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'por-vencer' });
    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'por-vencer' }); // una renovación a la vez
    await vi.runAllTimersAsync();
    expect(renovarSesion).toHaveBeenCalledTimes(1);
    expect(renovarSesion).toHaveBeenCalledWith('por-vencer');
    expect(e.enviados).toEqual([{ mensaje: { tipo: 'validalo:sesion', token: 'nuevo.token.firma' }, origen: ORIGEN_VALIDALO }]);

    // La inicial no pide otra: entrega la que ya tiene (la última).
    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'inicial' });
    expect(e.enviados.at(-1)?.mensaje).toEqual({ tipo: 'validalo:sesion', token: 'nuevo.token.firma' });
    expect(renovarSesion).toHaveBeenCalledTimes(1);
  });

  it('sin renovarSesion no inventa una sesión y deja que el anfitrión decida con alMensaje', () => {
    const e = entornoFalso();
    const alMensaje = vi.fn();
    montarEmbebido({ contenedor: e.contenedor, sesion: sesion(), alMensaje });
    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'vencida' });
    expect(e.enviados).toEqual([]);
    expect(alMensaje).toHaveBeenCalledWith({ tipo: 'validalo:sesion-requerida', motivo: 'vencida' });
  });

  it('si el backend no renueva, el iframe no recibe nada y se puede volver a pedir', async () => {
    const e = entornoFalso();
    const renovarSesion = vi.fn().mockRejectedValueOnce(new Error('sin red')).mockResolvedValueOnce(sesion('otro.token.firma'));
    montarEmbebido({ contenedor: e.contenedor, sesion: sesion(), renovarSesion });
    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'vencida' });
    await vi.runAllTimersAsync();
    expect(e.enviados).toEqual([]);
    e.recibir({ tipo: 'validalo:sesion-requerida', motivo: 'vencida' });
    await vi.runAllTimersAsync();
    expect(e.enviados).toHaveLength(1);
  });

  it('ajusta el alto al del contenido salvo que se pida lo contrario, envía el tema y se desmonta', () => {
    const e = entornoFalso();
    const montado = montarEmbebido({ contenedor: e.contenedor, sesion: sesion() });
    e.recibir({ tipo: 'validalo:resize', height: 733 });
    expect(e.iframe.style.height).toBe('733px');

    montado.enviarTema('dark');
    expect(e.enviados.at(-1)).toEqual({ mensaje: { tipo: 'validalo:tema', mode: 'dark' }, origen: ORIGEN_VALIDALO });

    montado.cerrar();
    expect(e.iframe.quitado).toBe(true);
    expect(e.escuchas.has('message')).toBe(false);

    const fijo = entornoFalso();
    montarEmbebido({ contenedor: fijo.contenedor, sesion: sesion(), ajustarAlto: false });
    fijo.recibir({ tipo: 'validalo:resize', height: 900 });
    expect(fijo.iframe.style.height).toBe('');
  });
});
