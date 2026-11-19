import { FormControlLabel, Switch, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlineadoConCampo, medidasDeCampo } from './campos';
import { createValidaloTheme } from './tema';
import { COLOR } from './tokens';
import { contraste } from './marcaEmpresa';

function celda(app: 'web' | 'public', conEtiqueta = true) {
  render(
    <ThemeProvider theme={createValidaloTheme('light', { app })}>
      <AlineadoConCampo conEtiqueta={conEtiqueta}>
        <span data-testid="contenido">x</span>
      </AlineadoConCampo>
    </ThemeProvider>,
  );
  const contenedor = screen.getByTestId('contenido').parentElement;
  if (!contenedor) throw new Error('AlineadoConCampo no envolvió el contenido');
  return contenedor;
}

describe('AlineadoConCampo', () => {
  it('centra en el alto del control, sin reservar línea de etiqueta (va sobre el borde): 36 en las dos apps', () => {
    expect(medidasDeCampo()).toEqual({ etiqueta: 0, control: 36 });
    expect(celda('web')).toHaveStyle({ paddingTop: '0px', minHeight: '36px', alignItems: 'center', boxSizing: 'content-box' });
  });

  it('en filas sin etiqueta solo centra en el control', () => {
    expect(celda('public', false)).toHaveStyle({ paddingTop: '0px', minHeight: '36px' });
  });
});

describe('switch del tema', () => {
  it('apagado se lee como «no»: perilla en texto secundario con contraste suficiente sobre la pista', () => {
    for (const modo of ['light', 'dark'] as const) {
      const c = COLOR[modo];
      // La perilla apagada (texto secundario) contra la pista (superficie nivel 1): ≥ 3:1 para un control no textual.
      expect(contraste(c.textoSecundario, c.superficieNivel1)).toBeGreaterThanOrEqual(3);
      // Y el borde de la pista contra la superficie, también ≥ 3:1 en claro (en oscuro lo apoya la perilla).
      if (modo === 'light') expect(contraste(c.bordeControlFuerte, c.superficieNivel1)).toBeGreaterThanOrEqual(3);
    }
  });

  it('el switch apagado se renderiza habilitado y con su etiqueta', () => {
    render(
      <ThemeProvider theme={createValidaloTheme('light')}>
        <FormControlLabel control={<Switch checked={false} onChange={() => undefined} />} label="Automática" />
      </ThemeProvider>,
    );
    const interruptor = screen.getByRole('switch', { name: 'Automática' });
    expect(interruptor).not.toBeChecked();
    expect(interruptor).toBeEnabled();
  });

  it('size="small" y "medium" comparten la geometría: pista 36 × 20 y perilla 14 centrada con 3 px por lado', () => {
    const tema = createValidaloTheme('light');
    const raiz = tema.components?.MuiSwitch?.styleOverrides?.root as Record<string, Record<string, unknown>>;
    const geometria = raiz['&, &.MuiSwitch-sizeSmall, &.MuiSwitch-sizeMedium'];
    expect(geometria).toMatchObject({ width: 36, height: 20, padding: 0 });
    expect(geometria?.['& .MuiSwitch-thumb']).toEqual({ width: 14, height: 14 });
    expect(geometria?.['& .MuiSwitch-switchBase']).toMatchObject({ top: 0, left: 0, padding: 3, '&.Mui-checked': { transform: 'translateX(16px)' } });
    // 3 + 14 + 3 = 20 de alto; encendida queda a 3 px del borde derecho: 16 + 3 + 14 + 3 = 36.
  });
});

describe('avisos (Alert) con botón de cerrar', () => {
  it('ícono, primera línea y botón comparten la fila de 32 px: el aviso no se ve descentrado', () => {
    const tema = createValidaloTheme('light');
    const raiz = tema.components?.MuiAlert?.styleOverrides?.root;
    if (typeof raiz !== 'function') throw new Error('MuiAlert.root debería ser una función del ownerState');
    const conCerrar = raiz({ ownerState: { severity: 'success', onClose: () => undefined }, theme: tema }) as Record<string, Record<string, unknown>>;
    expect(conCerrar['& .MuiAlert-icon']).toMatchObject({ padding: '7px 0' });
    expect(conCerrar['& .MuiAlert-message']).toEqual({ padding: '6px 0' });
    const sinCerrar = raiz({ ownerState: { severity: 'info' }, theme: tema }) as Record<string, Record<string, unknown>>;
    expect(sinCerrar['& .MuiAlert-icon']).toMatchObject({ padding: '2px 0' });
    expect(sinCerrar['& .MuiAlert-message']).toBeUndefined();
    expect(tema.components?.MuiAlert?.styleOverrides?.action).toMatchObject({ alignItems: 'flex-start' });
  });
});
