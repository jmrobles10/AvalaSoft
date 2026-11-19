import type { SistemaIntegradoDto, TenantDto, UsuarioDto } from '@validalo/api-client';
import { describe, expect, it } from 'vitest';
import {
  borradorDeAdministrador,
  borradorDeGrupo,
  borradorDeIngreso,
  cambiaElCorreo,
  cuerpoCorregirAdministrador,
  cuerpoCorregirGrupo,
  cuerpoIngreso,
  hayCambiosDeAdministrador,
  hayCambiosDeGrupo,
  sistemasDeLaPersona,
  validarAdministrador,
  validarGrupoEditable,
  zonaHorariaValida,
} from './modeloFicha';

const GRUPO: Pick<TenantDto, 'nombre' | 'region' | 'zonaHoraria'> = { nombre: 'Grupo Andino', region: 'co', zonaHoraria: 'America/Bogota' };

const ANA: Pick<UsuarioDto, 'nombre' | 'correo' | 'identidades'> = { nombre: 'Ana Rojas', correo: 'ana@andina.co', identidades: [{ sistemaId: 's1', idExterno: 'ana' }] };

describe('El grupo', () => {
  it('sin tocar nada no hay cambios y el cuerpo es el mismo grupo', () => {
    const b = borradorDeGrupo(GRUPO);
    expect(hayCambiosDeGrupo(b, GRUPO)).toBe(false);
    expect(cuerpoCorregirGrupo(b)).toEqual({ nombre: 'Grupo Andino', region: 'co', zonaHoraria: 'America/Bogota' });
  });

  it('recorta el nombre, pasa la región a minúsculas y vuelve a las del alta si la región o la zona quedan vacías', () => {
    expect(cuerpoCorregirGrupo({ nombre: '  Grupo Nuevo ', region: ' PA ', zonaHoraria: ' America/Panama ' })).toEqual({ nombre: 'Grupo Nuevo', region: 'pa', zonaHoraria: 'America/Panama' });
    expect(cuerpoCorregirGrupo({ nombre: 'Grupo', region: ' ', zonaHoraria: '' })).toEqual({ nombre: 'Grupo', region: 'co', zonaHoraria: 'America/Bogota' });
    expect(hayCambiosDeGrupo({ nombre: ' Grupo Andino ', region: 'CO', zonaHoraria: '' }, GRUPO)).toBe(false);
    expect(hayCambiosDeGrupo({ nombre: 'Grupo Andino', region: 'co', zonaHoraria: 'America/Lima' }, GRUPO)).toBe(true);
  });

  it('pide el nombre y una zona horaria IANA que exista', () => {
    expect(validarGrupoEditable({ nombre: ' ', region: 'co', zonaHoraria: 'Marte/Olimpo' })).toEqual(['nombre-requerido', 'zona-invalida']);
    expect(validarGrupoEditable({ nombre: 'Grupo', region: '', zonaHoraria: '' })).toEqual([]);
    expect(zonaHorariaValida('America/Bogota')).toBe(true);
    expect(zonaHorariaValida('Marte/Olimpo')).toBe(false);
  });
});

describe('Quien administra', () => {
  it('pide el nombre y un correo con forma de correo', () => {
    expect(validarAdministrador({ nombre: ' ', correo: 'sin-arroba', ids: {} })).toEqual(['nombre-requerido', 'correo-invalido']);
    expect(validarAdministrador({ nombre: 'Ana', correo: 'ana@andina.co', ids: {} })).toEqual([]);
  });

  it('el correo cambia aunque solo cambien las mayúsculas del otro lado: se compara como lo guarda la API', () => {
    const b = borradorDeAdministrador(ANA);
    expect(cambiaElCorreo(b, ANA)).toBe(false);
    expect(cambiaElCorreo({ ...b, correo: ' ANA@Andina.CO ' }, ANA)).toBe(false);
    expect(cambiaElCorreo({ ...b, correo: 'ana.rojas@andina.co' }, ANA)).toBe(true);
    expect(hayCambiosDeAdministrador(b, ANA)).toBe(false);
  });

  it('solo manda las identidades si cambiaron, y solo pide invitar si cambia el correo', () => {
    const b = borradorDeAdministrador(ANA);
    expect(cuerpoCorregirAdministrador(b, ANA, true)).toEqual({ nombre: 'Ana Rojas', correo: 'ana@andina.co' });
    expect(cuerpoCorregirAdministrador({ ...b, correo: 'ana.rojas@andina.co' }, ANA, false)).toEqual({ nombre: 'Ana Rojas', correo: 'ana.rojas@andina.co' });
    expect(cuerpoCorregirAdministrador({ ...b, correo: 'ana.rojas@andina.co' }, ANA, true)).toEqual({ nombre: 'Ana Rojas', correo: 'ana.rojas@andina.co', invitar: true });
    expect(cuerpoCorregirAdministrador({ ...b, ids: { s1: ' ana.rojas ' } }, ANA, true)).toEqual({
      nombre: 'Ana Rojas',
      correo: 'ana@andina.co',
      identidades: [{ sistemaId: 's1', idExterno: 'ana.rojas' }],
    });
  });

  it('un id vacío quita la identidad y uno nuevo en otro sistema la agrega', () => {
    const b = borradorDeAdministrador(ANA);
    expect(cuerpoCorregirAdministrador({ ...b, ids: { s1: '  ' } }, ANA, false).identidades).toEqual([]);
    expect(cuerpoCorregirAdministrador({ ...b, ids: { s1: 'ana', s2: 'a-77' } }, ANA, false).identidades).toEqual([
      { sistemaId: 's1', idExterno: 'ana' },
      { sistemaId: 's2', idExterno: 'a-77' },
    ]);
    expect(hayCambiosDeAdministrador({ ...b, ids: { s1: 'ana', s2: '' } }, ANA)).toBe(false);
  });

  it('los campos de identidad son los sistemas del grupo y, si la persona está enlazada a otro, ese también (no se pierde al guardar)', () => {
    const sistemas = [{ id: 's1', codigo: 'ERP', nombre: 'ERP de Andina' }] as SistemaIntegradoDto[];
    expect(sistemasDeLaPersona(sistemas, ANA)).toEqual([{ id: 's1', nombre: 'ERP de Andina', codigo: 'ERP' }]);
    expect(sistemasDeLaPersona(sistemas, { identidades: [...ANA.identidades, { sistemaId: 's9', idExterno: 'x' }] })).toEqual([
      { id: 's1', nombre: 'ERP de Andina', codigo: 'ERP' },
      { id: 's9', nombre: 's9', codigo: null },
    ]);
  });
});

describe('Cómo entran', () => {
  it('ida y vuelta de los modos, y el cierre por inactividad nunca supera la sesión', () => {
    const inicial = { modos: ['Delegado', 'Directo'], sesionHoras: 8, inactividadMinutos: 30, passkeyParaTodos: true };
    expect(cuerpoIngreso(borradorDeIngreso(inicial))).toEqual(inicial);
    expect(cuerpoIngreso({ delegado: false, directo: true, sesionHoras: 1, inactividadMinutos: 120, passkeyParaTodos: false })).toEqual({
      modos: ['Directo'],
      sesionHoras: 1,
      inactividadMinutos: 60,
      passkeyParaTodos: false,
    });
  });
});
