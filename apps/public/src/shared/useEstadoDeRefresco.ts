import type { EstadoConexion } from '@validalo/api-client';
import { create } from 'zustand';

/** Cuánto se espera, tras subir un documento, a que la cola lo ponga en el expediente (RQ-2) antes de dejar de sondear rápido. */
export const ESPERA_DE_SUBIDA_MS = 30_000;

interface EstadoDeRefrescoState {
  /** Estado del stream en vivo del tercero (`useStreamDelTercero`); `null` mientras no hay (la sesión no está activa o no se monta la campana). */
  stream: EstadoConexion | null;
  /** Instante (ms) hasta el que se espera lo recién subido; 0 = nada en espera. */
  esperandoSubidaHasta: number;
  fijarStream: (estado: EstadoConexion | null) => void;
  /** Se acaba de subir una versión o enviar un formulario: el expediente la recibe por una cola, así que se sondea rápido un rato. */
  esperarSubida: () => void;
}

/**
 * Lo que `useExpedientePublico` necesita para no sondear de más: con el stream conectado los avisos refrescan el expediente solos y solo se
 * sondea rápido mientras se espera lo que el tercero acaba de subir.
 */
export const useEstadoDeRefresco = create<EstadoDeRefrescoState>()((set) => ({
  stream: null,
  esperandoSubidaHasta: 0,
  fijarStream: (stream) => set({ stream }),
  esperarSubida: () => set({ esperandoSubidaHasta: Date.now() + ESPERA_DE_SUBIDA_MS }),
}));
