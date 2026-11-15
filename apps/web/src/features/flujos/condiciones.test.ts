import type { CondicionDto } from '@validasoft/api-client';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import {
  atajoDe,
  CAMPO_DE_FICHA_POR_DEFECTO,
  condicionDe,
  condicionDeFichaCompleta,
  condicionDeFichaSimple,
  condicionDesdeFicha,
  describirCondicion,
  modosDeCampo,
  type ModoDeFicha,
} from './condiciones';
import { borradorDesdeVersion, requisitoNuevo, requisitosADto, validarRequisitos } from './editor';

const predicado = (atributo: string, operador: string, ...valores: string[]): CondicionDto => ({ tipo: 'Predicado', nodos: null, atributo, operador, valores });

const t = i18n.t.bind(i18n);

describe('«Se pide a» (RQ-12)', () => {
  it('reconoce los atajos sin distinguir mayúsculas y lo demás es personalizado', () => {
    expect(atajoDe(null)).toBe('siempre');
    expect(atajoDe({ tipo: 'Y', nodos: [] })).toBe('siempre');
    expect(atajoDe(predicado('tercero.tipoPersona', 'Igual', 'Juridica'))).toBe('juridica');
    expect(atajoDe(predicado('tercero.tipoPersona', 'Igual', 'natural'))).toBe('natural');
    expect(atajoDe(predicado('tercero.tipoPersona', 'En', 'Juridica', 'Consorcio'))).toBe('personalizada');
    expect(atajoDe(predicado('tercero.pais', 'Igual', 'CO'))).toBe('personalizada');
  });

  it('un atajo arma su condición y «personalizada» conserva la que había', () => {
    const pais = predicado('tercero.pais', 'Igual', 'CO');
    expect(condicionDe('siempre', pais)).toBeNull();
    expect(condicionDe('juridica', null)).toEqual(predicado('tercero.tipoPersona', 'Igual', 'Juridica'));
    expect(condicionDe('personalizada', pais)).toBe(pais);
  });

  it('describe una condición compuesta en palabras', () => {
    const condicion: CondicionDto = {
      tipo: 'Y',
      nodos: [
        predicado('tercero.tipoPersona', 'Igual', 'Juridica'),
        { tipo: 'O', nodos: [predicado('vinculo.atributos.montoAnual', 'Mayor', '500000000'), predicado('tercero.pais', 'En', 'PE', 'EC')] },
      ],
    };
    expect(describirCondicion(condicion, t)).toBe('tipo de persona es Jurídica y (montoAnual mayor que 500000000 o país es uno de PE, EC)');
  });

  it('la condición sobrevive a la ida y vuelta del editor y al menos un documento se pide siempre', () => {
    const pais = predicado('tercero.pais', 'Igual', 'CO');
    const borrador = borradorDesdeVersion({ codigo: 'P', nombre: 'P', tipoVinculo: 'PROVEEDOR' }, {
      id: 'v', version: 1, estado: 'Borrador', etapas: [], politicaDevolucion: 'Inmediata', separacionDeFunciones: false, creadaEn: '2026-11-09T00:00:00Z', publicadaEn: null, retiradaEn: null,
      requisitos: [{ id: 'r1', tipoDocumentoTenantId: 'rut', obligatorio: true, areasQueRevisan: [], condicion: pais }],
    });
    expect(requisitosADto(borrador.requisitos)[0]?.condicion).toEqual(pais);

    const errores = validarRequisitos({ etapas: [], requisitos: borrador.requisitos }, []);
    expect(errores).toContainEqual({ codigo: 'requisito-siempre-requerido', campo: 'requisito.0' });
    expect(validarRequisitos({ etapas: [], requisitos: [...borrador.requisitos, requisitoNuevo('camara')] }, []).map((e) => e.codigo))
      .not.toContain('requisito-siempre-requerido');
  });
});

describe('«Según la ficha del tercero» (EF-1)', () => {
  const especialidades = predicado('ficha.especialidades.especialidades', 'ContieneAlguno', 'OG', 'AC');

  it('una comparación sobre la ficha es el atajo «ficha», sea cual sea su modo', () => {
    expect(atajoDe(especialidades)).toBe('ficha');
    expect(atajoDe(predicado('ficha.tributaria.responsable_ica', 'Igual', 'true'))).toBe('ficha');
    expect(atajoDe({ tipo: 'No', nodos: [predicado('ficha.general.ciiu', 'ContieneAlguno', '41')] })).toBe('ficha');
    expect(atajoDe({ tipo: 'No', nodos: [predicado('ficha.general.ciiu', 'Existe')] })).toBe('ficha');
  });

  it('lo que el editor no sabe armar sigue siendo personalizado y se conserva: grupos, negar un «es» o mezclar atributos', () => {
    const grupo: CondicionDto = { tipo: 'Y', nodos: [predicado('tercero.tipoPersona', 'Igual', 'Juridica'), especialidades] };
    expect(atajoDe(grupo)).toBe('personalizada');
    expect(atajoDe({ tipo: 'No', nodos: [predicado('ficha.general.ciudad', 'Igual', '11001')] })).toBe('personalizada');
    expect(atajoDe({ tipo: 'No', nodos: [predicado('tercero.pais', 'Igual', 'CO')] })).toBe('personalizada');
    expect(condicionDeFichaSimple(grupo)).toBeNull();
    expect(condicionDe('personalizada', grupo)).toBe(grupo);
  });

  it('elegir el atajo arranca con las especialidades sin valores y, si ya era una condición de la ficha, la conserva', () => {
    const nueva = condicionDe('ficha', null);
    expect(condicionDeFichaSimple(nueva)).toEqual({ campo: CAMPO_DE_FICHA_POR_DEFECTO, modo: 'alguno', valores: [] });
    expect(condicionDe('ficha', predicado('tercero.pais', 'Igual', 'CO'))).toEqual(nueva);
    expect(condicionDe('ficha', especialidades)).toBe(especialidades);
  });

  const modos: [ModoDeFicha, string, boolean, string[]][] = [
    ['alguno', 'ContieneAlguno', false, ['OG']],
    ['todos', 'ContieneTodos', false, ['OG', 'AC']],
    ['ninguno', 'ContieneAlguno', true, ['OG']],
    ['es', 'Igual', false, ['CO']],
    ['noEs', 'Distinto', false, ['CO']],
    ['esUnoDe', 'En', false, ['CO', 'PE']],
    ['noEsNingunoDe', 'NoEn', false, ['CO', 'PE']],
    ['declarado', 'Existe', false, []],
    ['noDeclarado', 'Existe', true, []],
  ];

  it.each(modos)('el modo «%s» se arma con el operador %s (negado: %s) y se lee de vuelta igual', (modo, operador, negado, valores) => {
    const condicion = condicionDesdeFicha({ campo: 'ficha.general.pais', modo, valores });

    expect(condicion.tipo).toBe(negado ? 'No' : 'Predicado');
    expect(negado ? condicion.nodos?.[0] : condicion).toMatchObject({ tipo: 'Predicado', atributo: 'ficha.general.pais', operador, valores });
    expect(condicionDeFichaSimple(condicion)).toEqual({ campo: 'ficha.general.pais', modo, valores });
  });

  it('«declarado» y «no declarado» no llevan valores aunque queden en el estado', () => {
    expect(condicionDesdeFicha({ campo: 'ficha.general.ciiu', modo: 'declarado', valores: ['41'] })).toMatchObject({ valores: [] });
  });

  it('cada tipo de campo ofrece los modos que la API admite para él', () => {
    expect(modosDeCampo({ tipo: 'ListaOpciones' })).toEqual(['alguno', 'todos', 'ninguno', 'declarado', 'noDeclarado']);
    expect(modosDeCampo({ tipo: 'Booleano' })).toEqual(['es', 'declarado', 'noDeclarado']);
    expect(modosDeCampo({ tipo: 'Opcion' })).toEqual(['es', 'noEs', 'esUnoDe', 'noEsNingunoDe', 'declarado', 'noDeclarado']);
    expect(modosDeCampo({ tipo: 'Texto' })).toEqual(modosDeCampo({ tipo: 'Opcion' }));
  });

  it('está completa con valores (uno solo con «es» y «no es») y sin ellos solo si el modo no los lleva', () => {
    expect(condicionDeFichaCompleta({ campo: 'ficha.general.ciiu', modo: 'alguno', valores: [] })).toBe(false);
    expect(condicionDeFichaCompleta({ campo: 'ficha.general.ciiu', modo: 'alguno', valores: ['41'] })).toBe(true);
    expect(condicionDeFichaCompleta({ campo: 'ficha.general.pais', modo: 'es', valores: ['CO', 'PE'] })).toBe(false);
    expect(condicionDeFichaCompleta({ campo: 'ficha.general.pais', modo: 'noEs', valores: ['CO'] })).toBe(true);
    expect(condicionDeFichaCompleta({ campo: 'ficha.general.ciiu', modo: 'noDeclarado', valores: [] })).toBe(true);
  });

  it('se describe con el nombre del campo y los sí/no de un booleano', () => {
    expect(describirCondicion(especialidades, t)).toBe('especialidades declaradas incluye alguno de OG, AC');
    expect(describirCondicion(predicado('ficha.tributaria.responsable_ica', 'Igual', 'true'), t)).toBe('responsable de ICA es sí');
    expect(describirCondicion(predicado('ficha.tributaria.responsable_ica', 'Igual', 'false'), t)).toBe('responsable de ICA es no');
    expect(describirCondicion({ tipo: 'No', nodos: [predicado('ficha.general.ciiu', 'ContieneAlguno', '41')] }, t)).toBe(
      'no se cumple (actividad económica (CIIU) incluye alguno de 41)',
    );
  });

  it('una condición de la ficha sin valores no se puede guardar y una completa sí; el requisito la conserva tal cual', () => {
    const vacia = condicionDe('ficha', null);
    const completa = predicado('ficha.especialidades.especialidades', 'ContieneAlguno', 'OG');
    const conVacia = { ...requisitoNuevo('camara'), condicion: vacia };
    const conCompleta = { ...requisitoNuevo('camara'), condicion: completa };
    const siempre = requisitoNuevo('rut');

    expect(validarRequisitos({ etapas: [], requisitos: [siempre, conVacia] }, []).map((e) => [e.codigo, e.campo])).toContainEqual(['condicion-invalida', 'requisito.1']);
    expect(validarRequisitos({ etapas: [], requisitos: [siempre, conCompleta] }, []).map((e) => e.codigo)).not.toContain('condicion-invalida');
    expect(requisitosADto([conCompleta])[0]?.condicion).toEqual(completa);
  });
});
