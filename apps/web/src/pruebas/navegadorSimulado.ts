import { vi } from 'vitest';

/**
 * Un navegador con passkeys para las pruebas: `PublicKeyCredential` y `navigator.credentials` falsos. `get` devuelve una firma de verdad (con binarios) para que
 * el código que la serializa corra completo; los tests ven lo que se le pidió (`mediation`, `signal`) en `llamadas`.
 *
 * Imita a Chrome en lo que importa para el ingreso: solo admite una petición de passkey a la vez. Mientras otra no se haya asentado (resuelta o rechazada),
 * una nueva se rechaza con `OperationError: A request is already pending.`; abortar la señal de una condicional no la libera al instante, sino cuando el
 * navegador termina de cancelarla (una tarea después), así que quien quiera pedir otra debe esperar a que se asiente.
 */
export interface NavegadorSimulado {
  llamadas: { mediation: string | undefined; conSenal: boolean }[];
  /** Las señales de aborto con que se pidió cada firma, para comprobar que se cancelan al salir de la pantalla. */
  senales: AbortSignal[];
  get: ReturnType<typeof vi.fn>;
  restaurar: () => void;
}

class CredencialFalsa {
  id = 'cred-1';
  rawId = new Uint8Array([1, 2, 3]).buffer;
  type = 'public-key';
  response = {
    authenticatorData: new Uint8Array([4, 5]).buffer,
    clientDataJSON: new Uint8Array([6, 7]).buffer,
    signature: new Uint8Array([8, 9]).buffer,
    userHandle: null,
  };
}

export const OPCIONES_DE_FIRMA = { challenge: 'AQID', rpId: 'localhost', userVerification: 'required', allowCredentials: [] };

export interface OpcionesDelNavegadorSimulado {
  /** Responde a `isConditionalMediationAvailable` (si no se indica, el navegador no la tiene). */
  condicional?: boolean;
  /** La petición condicional queda abierta hasta que se aborta (como el navegador) en vez de resolverse con una passkey. */
  esperaLaFirma?: boolean;
  /** La primera petición modal (sin `mediation`) falla con este error del navegador (p. ej. `NotAllowedError` si la persona cierra la ventana). */
  falloDeLaModal?: string;
}

export function simularNavegadorConPasskeys(opciones: OpcionesDelNavegadorSimulado = {}): NavegadorSimulado {
  const llamadas: NavegadorSimulado['llamadas'] = [];
  const senales: AbortSignal[] = [];
  const anterior = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential');
  const credenciales = Object.getOwnPropertyDescriptor(navigator, 'credentials');

  const clase = CredencialFalsa as unknown as { isConditionalMediationAvailable?: () => Promise<boolean> };
  if (opciones.condicional !== undefined) clase.isConditionalMediationAvailable = () => Promise.resolve(opciones.condicional === true);
  else delete clase.isConditionalMediationAvailable;

  // Peticiones sin asentar: el navegador solo admite una a la vez.
  let sinAsentar = 0;
  let modalPorFallar = opciones.falloDeLaModal;
  const get = vi.fn((peticion: { mediation?: string; signal?: AbortSignal }) => {
    llamadas.push({ mediation: peticion.mediation, conSenal: peticion.signal !== undefined });
    if (peticion.signal) senales.push(peticion.signal);
    if (peticion.signal?.aborted) return Promise.reject(new DOMException('abortada', 'AbortError'));
    if (sinAsentar > 0) return Promise.reject(new DOMException('A request is already pending.', 'OperationError'));
    const condicional = peticion.mediation === 'conditional';
    // Como el navegador: la petición condicional queda abierta hasta que la persona elige o se aborta; al abortar, se libera una tarea después.
    if (opciones.esperaLaFirma && condicional) {
      sinAsentar += 1;
      return new Promise((_resolver, rechazar) => {
        peticion.signal?.addEventListener('abort', () =>
          setTimeout(() => {
            sinAsentar -= 1;
            rechazar(new DOMException('abortada', 'AbortError'));
          }, 0),
        );
      });
    }
    if (!condicional && modalPorFallar) {
      const nombre = modalPorFallar;
      modalPorFallar = undefined;
      return Promise.reject(new DOMException('rechazada', nombre));
    }
    return Promise.resolve(new CredencialFalsa());
  });
  Object.defineProperty(window, 'PublicKeyCredential', { value: CredencialFalsa, configurable: true, writable: true });
  Object.defineProperty(navigator, 'credentials', { value: { create: vi.fn(), get }, configurable: true });

  return {
    llamadas,
    senales,
    get,
    restaurar: () => {
      if (anterior) Object.defineProperty(window, 'PublicKeyCredential', anterior);
      else delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
      if (credenciales) Object.defineProperty(navigator, 'credentials', credenciales);
      else delete (navigator as { credentials?: unknown }).credentials;
    },
  };
}
