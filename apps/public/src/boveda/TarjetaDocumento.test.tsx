import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  configurarCliente,
  reiniciarCliente,
  type ComparticionPublicaDto,
  type DocumentoBovedaDto,
  type DocumentoDto,
  type VersionDocumentoDto,
  type VigenciaDto,
} from '@validalo/api-client';
import { createValidaloTheme } from '@validalo/ui';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TarjetaDocumento } from './TarjetaDocumento';

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

const vigencia = (vigenteHasta: string, base = 'FechaExpedicion'): VigenciaDto => ({
  vigenteHasta,
  base,
  estado: 'Vigente',
  diasAviso: [30],
  diasGracia: 0,
  finDeGracia: vigenteHasta,
  vencidaEn: null,
});

const version = (n: number, estado: VersionDocumentoDto['estado'], cambios: Partial<VersionDocumentoDto> = {}): VersionDocumentoDto => ({
  documentoId: 'd1',
  n,
  estado,
  cargadaEn: '2026-11-10T15:00:00Z',
  cargadaPor: 'tercero',
  clase: 'Archivo',
  nombreOriginal: `rut-v${String(n)}.pdf`,
  mime: 'application/pdf',
  tamanoBytes: 1000,
  paginas: 1,
  sha256: `sha${String(n)}`,
  motivoDevolucion: null,
  detalleDevolucion: null,
  hechos: null,
  ...cambios,
});

const empresa = (id: string, nombre: string, cambios: Partial<ComparticionPublicaDto>): ComparticionPublicaDto => ({
  vinculoId: `v-${id}`,
  empresa: { id, nombre, logoUrl: null },
  compartido: true,
  version: 7,
  versionActualCompartida: true,
  compartidaEn: '2026-11-10T15:00:00Z',
  vigencia: vigencia('2027-11-09'),
  situacion: 'TieneVigente',
  otraVersion: null,
  ...cambios,
});

const NO_EXIGE: Partial<ComparticionPublicaDto> = { compartido: false, version: null, versionActualCompartida: false, vigencia: null, situacion: 'NoRecibe' };

/** El caso de la captura del usuario: la 8 se retiró, la vigente es la 7 y cada empresa tiene su vencimiento. */
const NORTE = empresa('norte', 'Constructora Norte S.A.S.', { situacion: 'RevalidaRetirada', otraVersion: 8, vigencia: vigencia('2027-11-10') });
const SUR = empresa('sur', 'Constructora Sur', { situacion: 'Revisando' });
const PONIENTE = empresa('poniente', 'Constructora Poniente', NO_EXIGE);

/** `cantidad` empresas «Constructora <prefijo> 01…» con la misma situación. */
const generar = (cantidad: number, prefijo: string, cambios: Partial<ComparticionPublicaDto>): ComparticionPublicaDto[] =>
  Array.from({ length: cantidad }, (_, i) => empresa(`${prefijo}-${String(i + 1)}`, `Constructora ${prefijo} ${String(i + 1).padStart(2, '0')}`, cambios));

const DOCUMENTO: DocumentoBovedaDto = {
  id: 'd1',
  tipo: { codigo: 'RUT', nombre: 'Registro Único Tributario', tipoDocumentoTenantId: null },
  ambito: 'Global',
  clase: 'Archivo',
  vinculoId: null,
  versionActual: version(7, 'Actual', { vigencia: vigencia('2027-11-09') }),
  versiones: 3,
  porEmpresa: [NORTE, SUR, PONIENTE],
};

/** Treinta empresas: 1 sin versión, 3 que revalidan, 24 aprobadas y 2 que no lo exigen. */
const MUCHAS: DocumentoBovedaDto = {
  ...DOCUMENTO,
  porEmpresa: [
    ...generar(1, 'Sin', { situacion: 'SinVigente', otraVersion: 6, version: null, versionActualCompartida: false }),
    ...generar(3, 'Revalida', { situacion: 'Revalida', otraVersion: 6 }),
    ...generar(24, 'Aprobada', { situacion: 'AproboVigente' }),
    ...generar(2, 'Ajena', NO_EXIGE),
  ],
};

const COMPLETO: DocumentoDto = {
  id: 'd1',
  terceroId: 't1',
  tipo: DOCUMENTO.tipo,
  clase: 'Archivo',
  ambito: 'Global',
  vinculoId: null,
  versionActual: 7,
  versiones: [version(6, 'Superada'), version(7, 'Actual', { vigencia: vigencia('2027-11-09') }), version(8, 'Retirada')],
  porEmpresa: DOCUMENTO.porEmpresa,
};

function montar(documento: DocumentoBovedaDto = DOCUMENTO, empresaId: string | null = null) {
  configurarCliente({ fetch: vi.fn(() => Promise.resolve(json(COMPLETO))) });
  render(
    <ThemeProvider theme={createValidaloTheme('light', { app: 'public' })}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <TarjetaDocumento documento={documento} empresaId={empresaId} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return screen.getByRole('article', { name: 'Registro Único Tributario' });
}

afterEach(() => reiniciarCliente());

describe('tarjeta de un documento de la bóveda', () => {
  it('la cabecera dice la versión vigente y cada empresa, qué tiene y qué falta, sin contradecirla', () => {
    const tarjeta = montar();

    expect(tarjeta).toHaveTextContent('Versión 7 · cargada el 10/11/2026');
    expect(within(tarjeta).getAllByText('Vigente').length).toBeGreaterThan(0);
    expect(tarjeta).toHaveTextContent('Vence el 09/11/2027');

    const filas = within(screen.getByRole('list', { name: 'Con tus empresas' })).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Constructora Norte S.A.S.');
    expect(filas[0]).toHaveTextContent('Aprobó la versión 8, que retiraste. Debe revisar la versión 7: revalidación abierta.');
    expect(filas[1]).toHaveTextContent('Revisando la versión 7.');

    // Nada de «recibirá la nueva cuando la exija»: era una versión más vieja que la que dice la cabecera.
    expect(tarjeta).not.toHaveTextContent(/recibirá la nueva|cuando la exija|v8/);
  });

  it('en la línea gris de la versión el vencimiento es un segmento aparte y ninguno de los dos se parte por dentro', () => {
    const tarjeta = montar();

    const cargada = within(tarjeta).getByText(/Versión 7 · cargada el 10\/11\/2026/);
    const vence = within(tarjeta).getByText('Vence el 09/11/2027');
    expect(cargada.parentElement).toBe(vence.parentElement);
    expect(getComputedStyle(cargada).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(vence).whiteSpace).toBe('nowrap');
  });

  it('es una fila: un solo chip de estado y una empresa por chip («Empresa · aprobada v1»), sin aviso amarillo dentro', () => {
    const tarjeta = montar();

    // Los chips de empresa resumen lo que tiene cada una; la frase completa queda para lectores de pantalla y tooltip.
    expect(tarjeta).toHaveTextContent('Constructora Norte S.A.S. · revalida v7');
    expect(tarjeta).toHaveTextContent('Constructora Sur · revisa v7');
    // El aviso «Vence pronto…» vive en el bloque «Por renovar» de la página, no en la fila.
    expect(within(tarjeta).queryByRole('alert')).not.toBeInTheDocument();
    // Solo quien pide algo del tercero lleva su línea explicativa visible (aquí, Norte: revalidar).
    const lineas = within(tarjeta).getAllByText('Aprobó la versión 8, que retiraste. Debe revisar la versión 7: revalidación abierta. Vence el 10/11/2027: su regla de vigencia cuenta desde la fecha de expedición.');
    expect(lineas.length).toBeGreaterThan(0);
  });

  it('una empresa que no exige el documento no aparece en la columna', () => {
    const tarjeta = montar();

    expect(tarjeta).not.toHaveTextContent('Constructora Poniente');
    expect(tarjeta).not.toHaveTextContent(/no la exige/);
  });

  it('si ninguna empresa lo exige, la columna dice solo un texto gris, sin chips', () => {
    const tarjeta = montar({ ...DOCUMENTO, porEmpresa: [PONIENTE, empresa('ajena', 'Constructora Ajena', NO_EXIGE)] });

    expect(within(tarjeta).getByText('Ninguna empresa la exige.')).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('list', { name: 'Con tus empresas' })).not.toBeInTheDocument();
    expect(tarjeta).not.toHaveTextContent('Constructora Poniente');
  });

  it('el vencimiento de una empresa solo aparece si difiere de la cabecera y dice por qué', () => {
    montar();

    const filas = within(screen.getByRole('list', { name: 'Con tus empresas' })).getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('Vence el 10/11/2027: su regla de vigencia cuenta desde la fecha de expedición.');
    expect(filas[1]).not.toHaveTextContent(/Vence/);
    // Y la cabecera explica por qué no todas coinciden.
    expect(screen.getByText('Cada empresa cuenta la vigencia con su propia regla: la fecha de arriba es la más próxima, la de Constructora Sur.')).toBeInTheDocument();
  });

  it('sin fechas distintas no se explica nada de más', () => {
    montar({ ...DOCUMENTO, porEmpresa: DOCUMENTO.porEmpresa.map((c) => ({ ...c, vigencia: c.vigencia ? vigencia('2027-11-09') : null })) });

    expect(screen.queryByText(/Cada empresa cuenta la vigencia/)).not.toBeInTheDocument();
    expect(screen.queryByText(/su regla de vigencia/)).not.toBeInTheDocument();
  });

  it('el listado de versiones usa «Vigente» para la que vale hoy, en vez de «Actual»', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole('button', { name: 'Ver versiones (3)' }));

    const items = await screen.findAllByText(/^Versión [678]$/);
    expect(items).toHaveLength(3);
    const de = (n: number) => items.find((i) => i.textContent === `Versión ${String(n)}`)?.closest('li') as HTMLElement;
    expect(de(7)).toHaveTextContent('Vigente');
    expect(de(6)).toHaveTextContent('Superada');
    expect(de(8)).toHaveTextContent('Retirada');
    expect(screen.queryByText('Actual')).not.toBeInTheDocument();
  });

  it('cada versión es una fila compacta con su archivo, tamaño, fecha y acciones, la más reciente primero', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole('button', { name: 'Ver versiones (3)' }));

    const filas = within(await screen.findByRole('list', { name: 'Versiones del documento' })).getAllByRole('listitem');
    expect(filas.map((f) => within(f).getByText(/^rut-v\d\.pdf$/).textContent)).toEqual(['rut-v8.pdf', 'rut-v7.pdf', 'rut-v6.pdf']);
    // La vigente: archivo, fecha y las dos acciones, cada una con su versión en el nombre accesible.
    const vigente = filas[1]!;
    expect(vigente).toHaveTextContent('10/11/2026');
    expect(within(vigente).getByRole('button', { name: 'Descargar la versión 7' })).toHaveTextContent('Descargar');
    expect(within(vigente).getByRole('button', { name: 'Retirar la versión 7' })).toHaveTextContent('Retirar');
    // Una versión ya retirada ni se descarga ni se vuelve a retirar.
    const retirada = filas[0]!;
    expect(within(retirada).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('columna «Empresas» con muchas empresas', () => {
  it('se resume por estado: los que piden algo primero, y las que no lo exigen no cuentan', () => {
    const tarjeta = montar(MUCHAS);

    const resumen = within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ });
    expect(resumen).toHaveAttribute('aria-expanded', 'false');
    expect(resumen.textContent).toMatch(/1 sin versión.*3 revalidan.*24 aprobadas/);
    expect(tarjeta).not.toHaveTextContent(/no la exig/);
    // Ni una sola empresa por nombre hasta que se abre el detalle.
    expect(tarjeta).not.toHaveTextContent('Constructora Aprobada 01');
    expect(within(tarjeta).queryByRole('list', { name: 'Con tus empresas' })).not.toBeInTheDocument();
  });

  it('sin nada pendiente es un solo chip «Al día con N empresas»', () => {
    const tarjeta = montar({ ...DOCUMENTO, porEmpresa: [...generar(5, 'Aprobada', { situacion: 'AproboVigente' }), ...generar(2, 'Ajena', NO_EXIGE)] });

    const resumen = within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ });
    expect(resumen).toHaveTextContent('Al día con 5 empresas');
    expect(resumen).not.toHaveTextContent(/aprobadas|exig/);
  });

  it('al tocar el resumen se abre el detalle por estado con la frase de cada empresa, y al tocarlo de nuevo se cierra', async () => {
    const usuario = userEvent.setup();
    const tarjeta = montar(MUCHAS);

    await usuario.click(within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ }));

    expect(within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ })).toHaveAttribute('aria-expanded', 'true');
    const revalidan = within(tarjeta).getByRole('region', { name: '3 revalidan' });
    const filas = within(revalidan).getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('Constructora Revalida 01');
    expect(filas[0]).toHaveTextContent('Aprobó la versión 6. Debe revisar la versión 7, la vigente: revalidación abierta.');
    expect(within(tarjeta).getByRole('region', { name: '1 sin versión' })).toHaveTextContent('Tenía la versión 6, que retiraste. Sube una nueva para que la reciba.');
    expect(within(within(tarjeta).getByRole('region', { name: '24 aprobadas' })).getAllByRole('listitem')).toHaveLength(24);
    // Las que no lo exigen tampoco están en el detalle.
    expect(tarjeta).not.toHaveTextContent('Constructora Ajena');

    await usuario.click(within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ }));
    expect(within(tarjeta).queryByRole('region', { name: '3 revalidan' })).not.toBeInTheDocument();
  });

  it('con más de 8 empresas el detalle trae un buscador por nombre, sin tildes ni mayúsculas', async () => {
    const usuario = userEvent.setup();
    const paramo = empresa('paramo', 'Cimentación del Páramo', { situacion: 'AproboVigente' });
    const tarjeta = montar({ ...DOCUMENTO, porEmpresa: [...MUCHAS.porEmpresa, paramo] });

    await usuario.click(within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ }));
    await usuario.type(within(tarjeta).getByRole('searchbox', { name: 'Buscar empresa' }), 'PARAMO');

    const aprobadas = within(tarjeta).getByRole('region', { name: '1 aprobada' });
    expect(within(aprobadas).getAllByRole('listitem')).toHaveLength(1);
    expect(aprobadas).toHaveTextContent('Cimentación del Páramo');
    expect(within(tarjeta).queryByRole('region', { name: /revalidan|sin versión/ })).not.toBeInTheDocument();

    await usuario.clear(within(tarjeta).getByRole('searchbox', { name: 'Buscar empresa' }));
    await usuario.type(within(tarjeta).getByRole('searchbox', { name: 'Buscar empresa' }), 'zzz');
    expect(within(tarjeta).getByText('Ninguna empresa coincide con «zzz».')).toBeInTheDocument();
  });

  it('con pocas empresas en el detalle no hay buscador', async () => {
    const usuario = userEvent.setup();
    const tarjeta = montar({ ...DOCUMENTO, porEmpresa: generar(5, 'Aprobada', { situacion: 'AproboVigente' }) });

    await usuario.click(within(tarjeta).getByRole('button', { name: /Ver el detalle por empresa/ }));

    expect(within(tarjeta).getAllByRole('listitem')).toHaveLength(5);
    expect(within(tarjeta).queryByRole('searchbox')).not.toBeInTheDocument();
  });
});

describe('filtro por empresa en la fila', () => {
  it('con una empresa elegida la columna muestra solo el estado de esa empresa, como con una sola', () => {
    const tarjeta = montar(MUCHAS, 'Revalida-2');

    const filas = within(within(tarjeta).getByRole('list', { name: 'Con tus empresas' })).getAllByRole('listitem');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveTextContent('Constructora Revalida 02 · revalida v7');
    expect(within(tarjeta).queryByRole('button', { name: /Ver el detalle por empresa/ })).not.toBeInTheDocument();
  });

  it('si la empresa elegida no exige el documento, dice que no aplica para ella', () => {
    const tarjeta = montar(MUCHAS, 'Ajena-1');

    expect(within(tarjeta).getByText('No aplica para esta empresa.')).toBeInTheDocument();
    expect(tarjeta).not.toHaveTextContent('Constructora Ajena');
  });
});
