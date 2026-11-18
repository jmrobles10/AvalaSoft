import type { AtributoPermitidoDto, CondicionDto } from '@avalasoft/api-client';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import {
  atajoDe,
  CAMPO_DE_FICHA_POR_DEFECTO,
  condicionDe,
  condicionDeAtributoCompleta,
  condicionDeAtributoSimple,
  condicionDeFichaCompleta,
  condicionDeFichaSimple,
  condicionDesdeAtributo,
  condicionDesdeFicha,
  describirCondicion,
  modosDeAtributo,
  modosDeCampo,
  type CondicionDeAtributo,
  type ModoDeAtributo,
  type ModoDeFicha,
} from './condiciones';
import { borradorDesdeVersion, requisitoNuevo, requisitosADto, validarRequisitos } from './editor';
import { validarSeleccion } from './seleccion';

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

describe('«Según un atributo del vínculo»', () => {
  const ATRIBUTOS: AtributoPermitidoDto[] = [
    { clave: 'nivelRiesgo', tipo: 'Opcion', obligatorio: false, opciones: ['Bajo', 'Medio', 'Alto'] },
    { clave: 'categorias', tipo: 'ListaOpciones', obligatorio: false, opciones: ['Materiales', 'Servicios'] },
    { clave: 'montoEstimado', tipo: 'Numero', obligatorio: false, opciones: null },
    { clave: 'critico', tipo: 'Booleano', obligatorio: false, opciones: null },
  ];
  const riesgo = (modo: ModoDeAtributo, ...valores: string[]) => condicionDesdeAtributo({ clave: 'nivelRiesgo', modo, valores });

  it('el atajo arranca con el primer atributo del tipo de vínculo del flujo y su primer modo, sin valores', () => {
    expect(condicionDe('atributo', null, ATRIBUTOS)).toEqual(predicado('vinculo.atributos.nivelRiesgo', 'Igual'));
    expect(atajoDe(condicionDe('atributo', null, ATRIBUTOS))).toBe('atributo');
    // Con la condición ya armada la conserva; sin atributos que ofrecer no inventa nada.
    const armada = riesgo('esUnoDe', 'Alto', 'Medio');
    expect(condicionDe('atributo', armada, ATRIBUTOS)).toBe(armada);
    expect(condicionDe('atributo', null, [])).toBeNull();
  });

  it('genera exactamente el predicado `vinculo.atributos.{clave}` que evalúa la API y lo reconoce al cargar (no es «personalizada»)', () => {
    const casos: [CondicionDeAtributo, CondicionDto][] = [
      [{ clave: 'nivelRiesgo', modo: 'es', valores: ['Alto'] }, predicado('vinculo.atributos.nivelRiesgo', 'Igual', 'Alto')],
      [{ clave: 'nivelRiesgo', modo: 'noEs', valores: ['Bajo'] }, predicado('vinculo.atributos.nivelRiesgo', 'Distinto', 'Bajo')],
      [{ clave: 'nivelRiesgo', modo: 'esUnoDe', valores: ['Alto', 'Medio'] }, predicado('vinculo.atributos.nivelRiesgo', 'En', 'Alto', 'Medio')],
      [{ clave: 'nivelRiesgo', modo: 'noEsNingunoDe', valores: ['Bajo'] }, predicado('vinculo.atributos.nivelRiesgo', 'NoEn', 'Bajo')],
      [{ clave: 'categorias', modo: 'alguno', valores: ['Servicios'] }, predicado('vinculo.atributos.categorias', 'ContieneAlguno', 'Servicios')],
      [{ clave: 'categorias', modo: 'todos', valores: ['Materiales', 'Servicios'] }, predicado('vinculo.atributos.categorias', 'ContieneTodos', 'Materiales', 'Servicios')],
      [{ clave: 'montoEstimado', modo: 'mayor', valores: ['1500000'] }, predicado('vinculo.atributos.montoEstimado', 'Mayor', '1500000')],
      [{ clave: 'montoEstimado', modo: 'menor', valores: ['10.5'] }, predicado('vinculo.atributos.montoEstimado', 'Menor', '10.5')],
      [{ clave: 'montoEstimado', modo: 'entre', valores: ['100', '200'] }, predicado('vinculo.atributos.montoEstimado', 'Entre', '100', '200')],
      [{ clave: 'critico', modo: 'es', valores: ['true'] }, predicado('vinculo.atributos.critico', 'Igual', 'true')],
      [{ clave: 'nivelRiesgo', modo: 'declarado', valores: [] }, predicado('vinculo.atributos.nivelRiesgo', 'Existe')],
    ];
    for (const [comparacion, esperada] of casos) {
      const generada = condicionDesdeAtributo(comparacion);
      expect(generada).toEqual(esperada);
      expect(condicionDeAtributoSimple(generada)).toEqual(comparacion);
      expect(atajoDe(generada)).toBe('atributo');
    }
  });

  it('«no incluye ninguno de» y «no tiene valor» son la negación del predicado y se reconocen igual', () => {
    const ninguno = condicionDesdeAtributo({ clave: 'categorias', modo: 'ninguno', valores: ['Servicios'] });
    expect(ninguno).toEqual({ tipo: 'No', nodos: [predicado('vinculo.atributos.categorias', 'ContieneAlguno', 'Servicios')], atributo: null, operador: null, valores: null });
    expect(condicionDeAtributoSimple(ninguno)).toEqual({ clave: 'categorias', modo: 'ninguno', valores: ['Servicios'] });
    const sinValor = condicionDesdeAtributo({ clave: 'nivelRiesgo', modo: 'noDeclarado', valores: ['x'] });
    expect(sinValor).toEqual({ tipo: 'No', nodos: [predicado('vinculo.atributos.nivelRiesgo', 'Existe')], atributo: null, operador: null, valores: null });
    expect(atajoDe(sinValor)).toBe('atributo');
  });

  it('lo que no es una comparación simple sobre un atributo del vínculo sigue siendo ficha, personalizada o de otro atajo', () => {
    expect(atajoDe({ tipo: 'Y', nodos: [riesgo('es', 'Alto'), riesgo('es', 'Medio')] })).toBe('personalizada');
    expect(atajoDe(predicado('tercero.pais', 'Igual', 'CO'))).toBe('personalizada');
    expect(atajoDe(predicado('vinculo.tipo', 'Igual', 'PROVEEDOR'))).toBe('personalizada');
    expect(atajoDe(predicado('vinculo.atributos.', 'Igual', 'x'))).toBe('personalizada');
    expect(atajoDe(predicado('ficha.general.ciiu', 'ContieneAlguno', '41'))).toBe('ficha');
    expect(condicionDeAtributoSimple({ tipo: 'No', nodos: [riesgo('es', 'Alto'), riesgo('es', 'Bajo')] })).toBeNull();
  });

  it('ofrece los modos que la API admite para cada tipo de atributo', () => {
    expect(modosDeAtributo('Opcion')).toEqual(['es', 'noEs', 'esUnoDe', 'noEsNingunoDe', 'declarado', 'noDeclarado']);
    expect(modosDeAtributo('Texto')).toEqual(modosDeAtributo('Opcion'));
    expect(modosDeAtributo('ListaOpciones')).toEqual(['alguno', 'todos', 'ninguno', 'declarado', 'noDeclarado']);
    expect(modosDeAtributo('Booleano')).toEqual(['es', 'noEs', 'declarado', 'noDeclarado']);
    expect(modosDeAtributo('Numero')).toEqual(['es', 'noEs', 'mayor', 'menor', 'entre', 'declarado', 'noDeclarado']);
    expect(modosDeAtributo('Fecha')).toEqual(modosDeAtributo('Numero'));
  });

  it('está completa con su valor (dos con «entre», el primero no mayor que el segundo) y sin él solo si el modo no lo lleva', () => {
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'es', valores: [] }, 'Opcion')).toBe(false);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'es', valores: ['Alto'] }, 'Opcion')).toBe(true);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'esUnoDe', valores: [] }, 'Opcion')).toBe(false);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'declarado', valores: [] }, 'Opcion')).toBe(true);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'mayor', valores: ['abc'] }, 'Numero')).toBe(false);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'mayor', valores: ['12.5'] }, 'Numero')).toBe(true);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['9', '10'] }, 'Numero')).toBe(true);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['10', '9'] }, 'Numero')).toBe(false);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['10', '9'] })).toBe(false); // sin tipo: compara como números
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['2026-01-01', '2026-12-31'] }, 'Fecha')).toBe(true);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['2026-12-31', '2026-01-01'] }, 'Fecha')).toBe(false);
    expect(condicionDeAtributoCompleta({ clave: 'a', modo: 'entre', valores: ['5'] }, 'Numero')).toBe(false);
  });

  it('se describe con la clave del atributo y los sí/no de un booleano', () => {
    expect(describirCondicion(riesgo('es', 'Alto'), t)).toBe('nivelRiesgo es Alto');
    expect(describirCondicion(condicionDesdeAtributo({ clave: 'critico', modo: 'es', valores: ['true'] }), t)).toBe('critico es sí');
    expect(describirCondicion(condicionDesdeAtributo({ clave: 'montoEstimado', modo: 'mayor', valores: ['1500000'] }), t)).toBe('montoEstimado mayor que 1500000');
    expect(describirCondicion(condicionDesdeAtributo({ clave: 'categorias', modo: 'ninguno', valores: ['Servicios'] }), t)).toBe('no se cumple (categorias incluye alguno de Servicios)');
  });

  it('una condición de atributo sin valores no se puede guardar (requisito y selección) y una completa sí, tal cual', () => {
    const vacia = condicionDe('atributo', null, ATRIBUTOS);
    const completa = riesgo('es', 'Alto');
    const conVacia = { ...requisitoNuevo('camara'), condicion: vacia };
    const conCompleta = { ...requisitoNuevo('camara'), condicion: completa };

    expect(validarRequisitos({ etapas: [], requisitos: [conVacia] }, []).map((e) => [e.codigo, e.campo])).toContainEqual(['condicion-invalida', 'requisito.0']);
    expect(validarRequisitos({ etapas: [], requisitos: [conCompleta] }, []).map((e) => e.codigo)).not.toContain('condicion-invalida');
    expect(requisitosADto([conCompleta])[0]?.condicion).toEqual(completa);
    expect(validarSeleccion({ seleccionCondicion: vacia, seleccionPrioridad: '1' })).toEqual([{ codigo: 'condicion-invalida', campo: 'seleccion.condicion' }]);
    expect(validarSeleccion({ seleccionCondicion: completa, seleccionPrioridad: '1' })).toEqual([]);
  });
});
