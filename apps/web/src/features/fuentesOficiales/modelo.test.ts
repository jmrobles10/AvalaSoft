import { describe, expect, it } from 'vitest';
import { campo } from './datosPrueba';
import { borradorDeCredenciales, credencialesADto, diasDeMonitoreo, esFuenteOficial, FUENTES, ordenarCotejo, puedeDecidirCampo, resumenDeCotejo } from './modelo';

describe('Fuentes oficiales: reglas de la pantalla (FO-4)', () => {
  it('las fuentes son el RUES y la DIAN y nada más', () => {
    expect(FUENTES).toEqual(['Rues', 'Dian']);
    expect(esFuenteOficial('Rues')).toBe(true);
    expect(esFuenteOficial('Dian')).toBe(true);
    expect(esFuenteOficial('ListasRestrictivas')).toBe(false);
    expect(esFuenteOficial('EstudioDeCumplimiento')).toBe(false);
  });

  it('solo una diferencia sin decidir pide decisión; lo que coincide, no se pudo verificar o ya se decidió no', () => {
    expect(puedeDecidirCampo(campo({ resultado: 'Discrepa' }))).toBe(true);
    expect(puedeDecidirCampo(campo({ resultado: 'Discrepa', decision: 'Descartada' }))).toBe(false);
    expect(puedeDecidirCampo(campo({ resultado: 'Discrepa', decision: 'Confirmada' }))).toBe(false);
    expect(puedeDecidirCampo(campo({ resultado: 'Coincide' }))).toBe(false);
    expect(puedeDecidirCampo(campo({ resultado: 'NoVerificable' }))).toBe(false);
  });

  it('el resumen cuenta lo que coincide, las diferencias (con o sin decisión), lo que no se verificó y lo que falta decidir', () => {
    const resumen = resumenDeCotejo([
      campo({ id: 'a', resultado: 'Coincide' }),
      campo({ id: 'b', resultado: 'Coincide' }),
      campo({ id: 'c', resultado: 'Discrepa' }),
      campo({ id: 'd', resultado: 'Discrepa', decision: 'Descartada' }),
      campo({ id: 'e', resultado: 'NoVerificable' }),
    ]);
    expect(resumen).toEqual({ coinciden: 2, diferencias: 2, sinVerificar: 1, porRevisar: 1 });
    expect(resumenDeCotejo([])).toEqual({ coinciden: 0, diferencias: 0, sinVerificar: 0, porRevisar: 0 });
  });

  it('el cotejo se ordena: primero lo que pide decisión, luego lo decidido, lo que coincide y lo que no se verificó; dentro, fuente, ficha y documento', () => {
    const orden = ordenarCotejo([
      campo({ id: 'sin-verificar', resultado: 'NoVerificable', contra: 'Ficha' }),
      campo({ id: 'coincide-doc', resultado: 'Coincide', contra: 'Documento' }),
      campo({ id: 'coincide-fuente', resultado: 'Coincide', contra: 'Fuente' }),
      campo({ id: 'decidida', resultado: 'Discrepa', decision: 'Descartada', contra: 'Ficha' }),
      campo({ id: 'pendiente-doc', resultado: 'Discrepa', contra: 'Documento' }),
      campo({ id: 'pendiente-fuente', resultado: 'Discrepa', contra: 'Fuente' }),
    ]).map((c) => c.id);

    expect(orden).toEqual(['pendiente-fuente', 'pendiente-doc', 'decidida', 'coincide-fuente', 'coincide-doc', 'sin-verificar']);
  });

  it('ordenar conserva el orden de la API entre iguales y no cambia la lista original', () => {
    const original = [campo({ id: 'x', contra: 'Ficha' }), campo({ id: 'y', contra: 'Ficha' }), campo({ id: 'z', contra: 'Ficha' })];

    expect(ordenarCotejo(original).map((c) => c.id)).toEqual(['x', 'y', 'z']);
    expect(original.map((c) => c.id)).toEqual(['x', 'y', 'z']);
  });
});

describe('Fuentes oficiales: credenciales (FO-5)', () => {
  it('el borrador parte de lo guardado y nunca trae la clave', () => {
    expect(borradorDeCredenciales({ usuario: 'convenio', urlBase: 'https://api.example/', notas: 'Plan anual' })).toEqual({
      usuario: 'convenio',
      clave: '',
      urlBase: 'https://api.example/',
      notas: 'Plan anual',
    });
    expect(borradorDeCredenciales({})).toEqual({ usuario: '', clave: '', urlBase: '', notas: '' });
  });

  it('la clave vacía no se envía (la API conserva la actual) y lo demás vacío va nulo', () => {
    expect(credencialesADto('Rues', 'Contrato', { usuario: ' convenio ', clave: '', urlBase: '', notas: '  ' })).toEqual({
      fuente: 'Rues',
      proveedor: 'Contrato',
      usuario: 'convenio',
      clave: null,
      urlBase: null,
      notas: null,
    });
    expect(credencialesADto('Dian', 'Contrato', { usuario: '', clave: 'token-nuevo', urlBase: 'https://api.example/', notas: 'x' }).clave).toBe('token-nuevo');
  });

  it('quitar las credenciales envía la clave vacía y nada más', () => {
    expect(credencialesADto('Rues', 'DatosAbiertos', { usuario: 'u', clave: 'abc', urlBase: '', notas: '' }, true)).toEqual({ fuente: 'Rues', proveedor: 'DatosAbiertos', clave: '' });
  });

  it('la reconsulta periódica: vacía es 0 (apagada) y lo que no es número pasa tal cual para que la API responda 422', () => {
    expect(diasDeMonitoreo('')).toBe(0);
    expect(diasDeMonitoreo('  ')).toBe(0);
    expect(diasDeMonitoreo('45')).toBe(45);
    expect(Number.isNaN(diasDeMonitoreo('abc'))).toBe(true);
  });
});
