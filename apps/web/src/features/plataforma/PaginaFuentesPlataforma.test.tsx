import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reiniciarCliente, type FuentesDePlataformaDto } from '@avalasoft/api-client';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPantalla } from '../../pruebas/montar';
import { simularApi } from '../../pruebas/simularApi';
import { PaginaFuentesPlataforma } from './PaginaFuentesPlataforma';

vi.setConfig({ testTimeout: 60_000 });

afterEach(() => reiniciarCliente());

const RUTA = '/api/v1/plataforma/fuentes-oficiales';

function cuenta(parcial: Partial<FuentesDePlataformaDto['fuentes'][number]['proveedores'][number]> = {}): FuentesDePlataformaDto['fuentes'][number]['proveedores'][number] {
  return { nombre: 'Contrato', habilitadoEnInstalacion: false, configurado: false, usuario: null, ultimosCuatroClave: null, urlBase: null, notas: null, actualizadasEn: null, ...parcial };
}

function datos(parcial: Partial<FuentesDePlataformaDto> = {}, dian = cuenta()): FuentesDePlataformaDto {
  return {
    fuentes: [
      {
        fuente: 'Rues',
        nombre: 'RUES',
        descripcion: 'Registro mercantil.',
        predeterminado: null,
        proveedores: [cuenta({ nombre: 'DatosAbiertos', habilitadoEnInstalacion: true }), cuenta()],
      },
      { fuente: 'Dian', nombre: 'DIAN', descripcion: 'Estado del RUT.', predeterminado: null, proveedores: [dian] },
    ],
    actualizadaEn: null,
    actualizadaPor: null,
    ...parcial,
  };
}

function montar(inicial: FuentesDePlataformaDto, extra: Parameters<typeof simularApi>[0] = {}) {
  const peticiones = simularApi({ [`GET ${RUTA}`]: inicial, ...extra });
  montarPantalla(
    <Routes>
      <Route path="/plataforma/fuentes" element={<PaginaFuentesPlataforma />} />
    </Routes>,
    '/plataforma/fuentes',
  );
  return peticiones;
}

describe('Consola de Plataforma › Fuentes oficiales (FO-5)', () => {
  it('muestra cada fuente con sus cuentas, avisa lo que no se puede automatizar y lo no habilitado en la instalación', async () => {
    montar(datos());

    const rues = within(await screen.findByRole('region', { name: 'RUES' }));
    expect(rues.getByText(/Los datos abiertos funcionan sin cuenta/)).toBeInTheDocument();
    expect(rues.getByRole('region', { name: 'Cuenta de Datos abiertos de Confecámaras' })).toBeInTheDocument();
    expect(within(rues.getByRole('region', { name: 'Cuenta de API contratada' })).getByText('No habilitado en la instalación')).toBeInTheDocument();
    const dian = within(screen.getByRole('region', { name: 'DIAN' }));
    expect(dian.getByText(/La DIAN no publica una API del estado del RUT/)).toBeInTheDocument();
    expect(dian.queryByRole('region', { name: 'Cuenta de Datos abiertos de Confecámaras' })).not.toBeInTheDocument();
  });

  it('guardar la cuenta envía la clave solo si se escribió; la clave nunca vuelve al formulario', async () => {
    const guardada = datos({}, cuenta({ configurado: true, usuario: 'convenio-dian', ultimosCuatroClave: '7788', habilitadoEnInstalacion: true }));
    const peticiones = montar(datos(), { [`PUT ${RUTA}`]: guardada });

    const dian = within(within(await screen.findByRole('region', { name: 'DIAN' })).getByRole('region', { name: 'Cuenta de API contratada' }));
    await userEvent.type(dian.getByLabelText('Usuario'), 'convenio-dian');
    await userEvent.type(dian.getByLabelText(/Clave o token/), 'clave-de-la-plataforma-7788');
    await userEvent.type(dian.getByLabelText(/URL del contrato/), 'https://api.proveedor.example/');
    await userEvent.click(dian.getByRole('button', { name: 'Guardar cuenta' }));

    await vi.waitFor(() => expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(true));
    expect(peticiones.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({
      credenciales: { fuente: 'Dian', proveedor: 'Contrato', usuario: 'convenio-dian', clave: 'clave-de-la-plataforma-7788', urlBase: 'https://api.proveedor.example/', notas: null },
    });
  });

  it('elegir el proveedor predeterminado de una fuente lo envía en Predeterminados', async () => {
    const peticiones = montar(datos(), { [`PUT ${RUTA}`]: datos() });

    const rues = within(await screen.findByRole('region', { name: 'RUES' }));
    await userEvent.click(rues.getByRole('combobox', { name: 'Proveedor predeterminado' }));
    await userEvent.click(screen.getByRole('option', { name: 'Datos abiertos de Confecámaras' }));

    await vi.waitFor(() => expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(true));
    expect(peticiones.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({ predeterminados: [{ fuente: 'Rues', proveedor: 'DatosAbiertos' }] });
  });

  it('quitar una cuenta configurada pide confirmación y envía la clave vacía', async () => {
    const configurada = datos({ actualizadaEn: '2026-11-10T14:00:00Z', actualizadaPor: 'operador' }, cuenta({ configurado: true, usuario: 'convenio', ultimosCuatroClave: '7788', actualizadasEn: '2026-11-10T14:00:00Z' }));
    const peticiones = montar(configurada, { [`PUT ${RUTA}`]: datos() });

    const dian = within(within(await screen.findByRole('region', { name: 'DIAN' })).getByRole('region', { name: 'Cuenta de API contratada' }));
    expect(dian.getByText('Configurada · …7788')).toBeInTheDocument();
    expect(dian.getByLabelText(/Clave o token/)).toHaveValue('');
    await userEvent.click(dian.getByRole('button', { name: 'Quitar cuenta' }));
    const dialogo = within(await screen.findByRole('dialog'));
    expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(false);
    await userEvent.click(dialogo.getByRole('button', { name: 'Quitar cuenta' }));

    await vi.waitFor(() => expect(peticiones.some((p) => p.metodo === 'PUT')).toBe(true));
    expect(peticiones.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({ credenciales: { fuente: 'Dian', proveedor: 'Contrato', clave: '' } });
  });
});
