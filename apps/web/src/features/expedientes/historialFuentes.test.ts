import type { EventoHistorialDto } from '@avalasoft/api-client';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { eventoExpedienteATimeline } from './historial';

const t = i18n.t.bind(i18n);
const contexto = { usuarioActual: null, areas: new Map([['a1', 'Cumplimiento']]) };

const evento = (tipo: string, datos: Record<string, unknown>): EventoHistorialDto => ({
  version: 9,
  tipo,
  fecha: '2026-11-14T12:00:00Z',
  actorTipo: 'Sistema',
  actorId: 'verificaciones',
  sistema: null,
  datos,
});

describe('historial: fuentes oficiales (FO-4)', () => {
  it('«fuente_oficial_consultada» dice qué fuente, con qué proveedor y cuántas diferencias dejó por revisar (sin contar las ya aceptadas)', () => {
    const campos = [
      { resultado: 'Coincide', heredada: null },
      { resultado: 'Discrepa', heredada: null },
      { resultado: 'Discrepa', heredada: { decision: 'Descartada' } },
      { resultado: 'NoVerificable', heredada: null },
    ];

    const entrada = eventoExpedienteATimeline(evento('fuente_oficial_consultada', { tipo: 'Rues', proveedor: 'DatosAbiertos', campos }), contexto, t);
    expect(entrada.titulo).toBe('Fuente oficial consultada');
    expect(entrada.detalle).toBe('Registro mercantil (RUES) · DatosAbiertos · 1 diferencia por revisar');

    const conforme = eventoExpedienteATimeline(evento('fuente_oficial_consultada', { tipo: 'Dian', proveedor: 'Contrato', campos: [{ resultado: 'Coincide', heredada: null }] }), contexto, t);
    expect(conforme.detalle).toBe('Estado del RUT (DIAN) · Contrato · 0 diferencias por revisar');
  });

  it('«diferencia_de_fuente_resuelta» dice la decisión y deja la justificación como motivo', () => {
    const entrada = eventoExpedienteATimeline(evento('diferencia_de_fuente_resuelta', { tipo: 'Dian', decision: 'Confirmada', justificacion: 'El RUT figura suspendido.' }), contexto, t);

    expect(entrada.titulo).toBe('Diferencia con la fuente resuelta');
    expect(entrada.detalle).toBe('Estado del RUT (DIAN) · Confirmada');
    expect(entrada.motivo).toBe('El RUT figura suspendido.');
  });

  it('las verificaciones que pide el flujo nombran también el RUES y la DIAN', () => {
    const entrada = eventoExpedienteATimeline(
      evento('verificaciones_requeridas', { verificaciones: [{ tipo: 'ListasRestrictivas' }, { tipo: 'Rues' }, { tipo: 'Dian' }] }),
      contexto,
      t,
    );

    expect(entrada.detalle).toBe('Listas restrictivas · Registro mercantil (RUES) · Estado del RUT (DIAN)');
  });
});
