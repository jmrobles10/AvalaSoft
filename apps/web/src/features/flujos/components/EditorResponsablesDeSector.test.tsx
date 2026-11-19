import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AreaDto } from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { describe, expect, it, vi } from 'vitest';
import { areaNueva, type ResponsableDeSectorEnEditor } from '../editor';
import { EditorResponsablesDeSector } from './EditorResponsablesDeSector';

const area = (id: string, nombre: string): AreaDto => ({ id, empresaId: 'e', codigo: id.toUpperCase(), nombre, miembros: ['u1'], activa: true });
const AREAS = [area('compras', 'Compras'), area('cumplimiento', 'Cumplimiento'), area('tesoreria', 'Tesorería')];

function editor(responsables: ResponsableDeSectorEnEditor[], onCambiar = vi.fn(), opciones: { soloLectura?: boolean; enElFlujo?: string[] } = {}) {
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <EditorResponsablesDeSector
        responsables={responsables}
        etapas={[{ clave: 'e1', areas: (opciones.enElFlujo ?? ['compras', 'cumplimiento']).map((id) => areaNueva(id)) }]}
        areas={AREAS}
        onCambiar={onCambiar}
        soloLectura={opciones.soloLectura ?? false}
      />
    </ThemeProvider>,
  );
}

const selectorDe = (sector: string) => screen.getByRole('combobox', { name: new RegExp(`Área responsable de ${sector}`) });

describe('EditorResponsablesDeSector', () => {
  it('muestra los seis sectores de la ficha sin responsable y ofrece solo las áreas que participan en el flujo', () => {
    editor([]);

    expect(screen.getAllByRole('combobox')).toHaveLength(6);
    expect(selectorDe('Información tributaria')).toHaveTextContent('Sin responsable (como siempre)');
    fireEvent.mouseDown(selectorDe('Información tributaria'));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin responsable (como siempre)', 'Compras', 'Cumplimiento']);
  });

  it('elegir un área la deja como responsable del sector y no toca los demás', () => {
    const onCambiar = vi.fn();
    editor([{ sector: 'FICHA_GENERAL', areaId: 'compras' }], onCambiar);

    expect(selectorDe('Información general')).toHaveTextContent('Compras');
    fireEvent.mouseDown(selectorDe('Información tributaria'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Cumplimiento' }));

    expect(onCambiar).toHaveBeenCalledWith([
      { sector: 'FICHA_GENERAL', areaId: 'compras' },
      { sector: 'FICHA_TRIBUTARIA', areaId: 'cumplimiento' },
    ]);
  });

  it('cambiar de área reemplaza al responsable y «Sin responsable» lo quita', () => {
    const onCambiar = vi.fn();
    editor([{ sector: 'FICHA_TRIBUTARIA', areaId: 'compras' }], onCambiar);

    fireEvent.mouseDown(selectorDe('Información tributaria'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Cumplimiento' }));
    expect(onCambiar).toHaveBeenLastCalledWith([{ sector: 'FICHA_TRIBUTARIA', areaId: 'cumplimiento' }]);

    fireEvent.mouseDown(selectorDe('Información tributaria'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Sin responsable (como siempre)' }));
    expect(onCambiar).toHaveBeenLastCalledWith([]);
  });

  it('sin áreas en el flujo avisa y no deja elegir; en solo lectura tampoco', () => {
    editor([], vi.fn(), { enElFlujo: [] });
    expect(screen.getByText('Agrega áreas al flujo para elegir un responsable.')).toBeInTheDocument();
    screen.getAllByRole('combobox').forEach((c) => expect(c).toHaveAttribute('aria-disabled', 'true'));
  });

  it('en solo lectura muestra el responsable sin dejar cambiarlo', () => {
    editor([{ sector: 'FICHA_LEGAL', areaId: 'cumplimiento' }], vi.fn(), { soloLectura: true });
    expect(selectorDe('Información legal')).toHaveTextContent('Cumplimiento');
    expect(selectorDe('Información legal')).toHaveAttribute('aria-disabled', 'true');
  });
});
