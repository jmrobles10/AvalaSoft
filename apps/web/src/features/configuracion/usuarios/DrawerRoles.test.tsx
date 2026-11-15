import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EmpresaDto, GrupoDeAccesoDto, UsuarioDto } from '@validasoft/api-client';
import { createValidasoftTheme } from '@validasoft/ui';
import { describe, expect, it, vi } from 'vitest';
import { DrawerRoles } from './DrawerRoles';

const EMPRESAS: EmpresaDto[] = [
  { id: 'e1', tenantId: 't1', identificacion: { pais: 'CO', tipo: 'NIT', numero: '800197268' }, nombre: 'Norte S.A.S.', logoUrl: null, replyTo: null, prefijoFolio: 'NORTE', activa: true },
  { id: 'e2', tenantId: 't1', identificacion: { pais: 'CO', tipo: 'NIT', numero: '900123456' }, nombre: 'Sur S.A.S.', logoUrl: null, replyTo: null, prefijoFolio: 'SUR', activa: true },
];

const USUARIO: UsuarioDto = {
  id: 'u1',
  nombre: 'Camila Admin',
  correo: 'camila@norte.co',
  identificacion: null,
  activo: true,
  identidades: [],
  roles: [
    { rol: 'Administrador', empresaId: 'e1' },
    { rol: 'Revisor', empresaId: 'e2' },
    { rol: 'Auditor', empresaId: null },
  ],
  creadoEn: '2026-11-01T10:00:00Z',
  ultimoAcceso: null,
};

describe('DrawerRoles', () => {
  it('cada fila de roles tiene el nombre accesible de sus dos selectores, no solo la primera', () => {
    render(
      <ThemeProvider theme={createValidasoftTheme('light')}>
        <DrawerRoles usuario={USUARIO} empresas={EMPRESAS} guardando={false} error={null} onGuardar={vi.fn()} onCerrar={vi.fn()} />
      </ThemeProvider>,
    );

    const selectores = screen.getAllByRole('combobox');
    expect(selectores.map((s) => s.getAttribute('aria-label') ?? s.getAttribute('aria-labelledby'))).not.toContain(null);
    expect(selectores).toHaveLength(6);
    expect(screen.getByRole('combobox', { name: 'Empresa de la fila 2' })).toHaveTextContent('Sur S.A.S.');
    expect(screen.getByRole('combobox', { name: 'Rol de la fila 2' })).toHaveTextContent('Revisor');
    expect(screen.getByRole('combobox', { name: 'Empresa de la fila 3' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rol de la fila 3' })).toBeInTheDocument();
    for (const selector of selectores) expect(selector).toHaveAccessibleName();
  });

  it('sin grupos propios en el grupo empresarial solo asigna roles y manda a crearlos', () => {
    render(
      <ThemeProvider theme={createValidasoftTheme('light')}>
        <DrawerRoles usuario={USUARIO} empresas={EMPRESAS} grupos={[]} guardando={false} error={null} onGuardar={vi.fn()} onCerrar={vi.fn()} />
      </ThemeProvider>,
    );

    expect(screen.getByText(/Sin grupos propios/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar grupo' })).not.toBeInTheDocument();
  });

  it('asigna grupos propios junto a los roles (por empresa o para todo el grupo) y los envía al guardar', () => {
    const onGuardar = vi.fn();
    const grupos: GrupoDeAccesoDto[] = [
      { id: 'p-revisor', codigo: 'REVISOR', nombre: 'Revisor', descripcion: null, activo: true, predefinido: true, rol: 'Revisor', permisos: [], sectores: [], usuarios: 1, creadoEn: null, actualizadoEn: null },
      { id: 'g1', codigo: 'TESORERIA', nombre: 'Tesorería', descripcion: null, activo: true, predefinido: false, rol: null, permisos: ['expedientes:leer'], sectores: [], usuarios: 0, creadoEn: null, actualizadoEn: null },
      { id: 'g2', codigo: 'LEGAL', nombre: 'Jurídica', descripcion: null, activo: false, predefinido: false, rol: null, permisos: ['expedientes:leer'], sectores: [], usuarios: 0, creadoEn: null, actualizadoEn: null },
    ];
    const usuario: UsuarioDto = { ...USUARIO, roles: [{ rol: 'Auditor', empresaId: null }], grupos: [{ grupoId: 'g2', empresaId: 'e1' }] };
    render(
      <ThemeProvider theme={createValidasoftTheme('light')}>
        <DrawerRoles usuario={usuario} empresas={EMPRESAS} grupos={grupos} guardando={false} error={null} onGuardar={onGuardar} onCerrar={vi.fn()} />
      </ThemeProvider>,
    );

    // El grupo que ya tenía (aunque se desactivó) sigue en su fila; los predefinidos no se eligen aquí (son los roles).
    expect(screen.getByRole('combobox', { name: /^Grupo/ })).toHaveTextContent('Jurídica (desactivado)');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar grupo' }));
    expect(screen.getByRole('combobox', { name: 'Grupo de la fila 2' })).toHaveTextContent('Tesorería');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar roles' }));

    expect(onGuardar).toHaveBeenCalledWith({
      nombre: '',
      correo: '',
      roles: [{ rol: 'Auditor', empresaId: null }],
      grupos: [
        { grupoId: 'g2', empresaId: 'e1' },
        { grupoId: 'g1', empresaId: 'e1' },
      ],
      invitar: false,
    });
  });
});
