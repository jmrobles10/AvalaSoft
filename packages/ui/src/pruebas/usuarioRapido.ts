import userEvent from '@testing-library/user-event';

/**
 * `userEvent.setup()` espera un macrotask (`setTimeout`, `delay: 0`) entre cada pulsación, clic y tecla. En los formularios de MUI eso suma
 * segundos por prueba sin comprobar nada más. Con `delay: null` no espera: las aserciones ya esperan lo que haga falta con `findBy*` y `waitFor`.
 * Una prueba que de verdad necesite el retardo lo pide: `userEvent.setup({ delay: 0 })`. Las tres apps lo cargan desde su `preparar.ts`.
 */
const original = userEvent.setup.bind(userEvent);
Object.defineProperty(userEvent, 'setup', {
  configurable: true,
  value: (opciones?: Parameters<typeof original>[0]) => original({ delay: null, ...opciones }),
});
