import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configurarCliente, reiniciarCliente, SCOPES, type IndicadoresDto, type MisPendientesDto } from '@validalo/api-client';
import { COLOR, createValidaloTheme } from '@validalo/ui';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaginaInicio } from './PaginaInicio';

const permisos = vi.hoisted(() => ({ scopes: new Set<string>() }));
vi.mock('../empresas/useEmpresas', () => ({ useEmpresaActiva: () => ({ empresa: { id: 'emp', nombre: 'Constructora Norte' }, empresas: [] }) }));
vi.mock('../../shared/usePermisos', () => ({ usePermisos: () => ({ scopes: permisos.scopes, puede: (s: string) => permisos.scopes.has(s) }) }));

const AL_DIA: MisPendientesDto = {
  porArea: [],
  revalidaciones: 0,
  revalidacionesBloqueantes: 0,
  cuentasPorAprobar: 0,
  aperturasPendientes: 0,
  documentosPorVencer: 0,
  documentosVencidos: 0,
};

const PENDIENTES: MisPendientesDto = {
  porArea: [
    { areaId: 'a-compras', codigo: 'COMPRAS', nombre: 'Compras', cantidad: 3, masAntiguoDias: 5 },
    { areaId: 'a-juridica', codigo: 'JURIDICA', nombre: 'Jurídica', cantidad: 0, masAntiguoDias: 0 },
  ],
  revalidaciones: 4,
  revalidacionesBloqueantes: 1,
  cuentasPorAprobar: 2,
  aperturasPendientes: 0,
  documentosPorVencer: 0,
  documentosVencidos: 3,
};

const INDICADORES: IndicadoresDto = {
  dias: 30,
  vinculosActivos: 1234,
  vinculosEnValidacion: 8,
  vinculosInvitados: 5,
  vinculosVencidos: 2,
  vinculosBloqueados: 1,
  expedientesEnCurso: 9,
  expedientesObservados: 3,
  expedientesAprobados: 12,
  expedientesRechazados: 1,
  tiempoPromedioDias: 4.25,
  tiempoMedianaDias: null,
  certificadosVigentes: 40,
  certificadosConPendientes: 6,
  certificadosNoValidos: 2,
};

const json = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } });

function UbicacionActual() {
  const { pathname, search } = useLocation();
  return <p>{`Ubicación: ${pathname}${search}`}</p>;
}

/** API falsa: `/mis-pendientes` devuelve `pendientes`; `/indicadores`, los indicadores con la ventana pedida. */
function montar(pendientes: MisPendientesDto, indicadores: IndicadoresDto = INDICADORES, ruta = '/e/emp/inicio') {
  const urls: string[] = [];
  configurarCliente({
    fetch: vi.fn((entrada: RequestInfo | URL) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      urls.push(url);
      if (url.startsWith('/api/v1/mis-pendientes')) return Promise.resolve(json(pendientes));
      const dias = Number(new URL(url, 'http://local').searchParams.get('dias'));
      return Promise.resolve(json({ ...indicadores, dias }));
    }),
  });
  render(
    <ThemeProvider theme={createValidaloTheme('light')}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/e/:empresaId/inicio" element={<PaginaInicio />} />
            <Route path="*" element={<UbicacionActual />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return urls;
}

/** `#RRGGBB` → `rgb(r, g, b)` (como lo devuelve `getComputedStyle`). */
function hexARgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${String((n >> 16) & 255)}, ${String((n >> 8) & 255)}, ${String(n & 255)})`;
}

const ROJO_TEXTO = hexARgb(COLOR.light.estadoErrorTexto);
const ROJO_BORDE = hexARgb(COLOR.light.estadoErrorBorde);
const colorDe = (nodo: HTMLElement) => getComputedStyle(nodo).color;

afterEach(() => {
  reiniciarCliente();
  permisos.scopes = new Set();
  vi.restoreAllMocks();
});

describe('Inicio', () => {
  it('sin expedientes:leer no consulta nada', () => {
    const urls = montar(PENDIENTES);
    expect(screen.queryByRole('region', { name: 'Lo que te toca' })).not.toBeInTheDocument();
    expect(urls).toEqual([]);
  });

  it('lista las áreas con pendientes (enlace a la bandeja filtrada, con la cifra destacada) y las que están al día, y los demás pendientes', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    const usuario = userEvent.setup();
    montar(PENDIENTES);

    const toca = await screen.findByRole('region', { name: 'Lo que te toca' });
    // El nombre accesible del enlace sigue siendo la frase completa; por fuera se ve el área, su antigüedad y la cifra.
    const compras = await within(toca).findByRole('link', { name: 'Compras: 3 expedientes por revisar · el más antiguo hace 5 días' });
    expect(compras).toHaveAttribute('href', '/e/emp/bandeja?area=a-compras');
    expect(within(compras).getByText('Compras')).toBeInTheDocument();
    expect(within(compras).getByText('el más antiguo hace 5 días')).toBeInTheDocument();
    expect(within(compras).getByText('3')).toBeInTheDocument();
    expect(within(compras).getByText('por revisar')).toBeInTheDocument();
    // Un área al día es una fila informativa: su nombre y «Al día» en tono de éxito, sin enlace.
    expect(within(toca).getByText('Jurídica')).toBeInTheDocument();
    expect(colorDe(within(toca).getByText('Al día'))).toBe(hexARgb(COLOR.light.estadoExitoTexto));
    expect(within(toca).queryByRole('link', { name: /Jurídica/ })).not.toBeInTheDocument();

    const revalidaciones = within(toca).getByRole('link', { name: '4 revalidaciones por revisar. 1 ya bloquea el certificado' });
    expect(revalidaciones).toHaveAttribute('href', '/e/emp/revalidaciones');
    expect(within(revalidaciones).getByText('Revalidaciones por revisar')).toBeInTheDocument();
    expect(within(revalidaciones).getByText('4')).toBeInTheDocument();
    // Lo que ya bloquea un certificado va en rojo.
    expect(colorDe(within(toca).getByText('1 ya bloquea el certificado'))).toBe(ROJO_TEXTO);
    // Las cuentas no tienen pantalla propia: fila sin enlace, con su ayuda.
    expect(within(toca).getByText('Cuentas bancarias por aprobar')).toBeInTheDocument();
    expect(within(toca).getByText('Se aprueban desde el vínculo de cada tercero.')).toBeInTheDocument();
    expect(within(toca).queryByRole('link', { name: /cuentas bancarias/ })).not.toBeInTheDocument();
    const vencidos = within(toca).getByRole('link', { name: '3 documentos vencidos' });
    expect(vencidos).toHaveAttribute('href', '/e/emp/vencimientos?estado=Vencida');
    expect(colorDe(within(vencidos).getByText('3'))).toBe(ROJO_TEXTO);
    // Lo que está en cero no se muestra.
    expect(within(toca).queryByText(/Aperturas pendientes/)).not.toBeInTheDocument();
    expect(within(toca).queryByText(/Documentos que vencen/)).not.toBeInTheDocument();

    await usuario.click(compras);
    expect(await screen.findByText('Ubicación: /e/emp/bandeja?area=a-compras')).toBeInTheDocument();
  });

  it('lo que está por vencer va en ámbar y las aperturas pendientes llevan a la bandeja', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar({ ...AL_DIA, documentosPorVencer: 2, aperturasPendientes: 1 });
    const toca = await screen.findByRole('region', { name: 'Lo que te toca' });
    const porVencer = await within(toca).findByRole('link', { name: '2 documentos vencen en los próximos 30 días' });
    expect(porVencer).toHaveAttribute('href', '/e/emp/vencimientos');
    expect(colorDe(within(porVencer).getByText('2'))).toBe(hexARgb(COLOR.light.estadoAdvertenciaTexto));
    expect(within(toca).getByRole('link', { name: '1 apertura pendiente' })).toHaveAttribute('href', '/e/emp/bandeja');
  });

  it('mientras carga «Lo que te toca» muestra esqueletos de filas y luego las filas', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar(PENDIENTES);
    const cargando = screen.getByRole('status', { name: 'Cargando lo que te toca' });
    expect(cargando).toHaveAttribute('aria-busy', 'true');
    expect(cargando.querySelectorAll('.MuiSkeleton-circular')).toHaveLength(3);
    await screen.findByRole('link', { name: /^Compras:/ });
    expect(screen.queryByRole('status', { name: 'Cargando lo que te toca' })).not.toBeInTheDocument();
  });

  it('si todo está en cero dice «Estás al día»', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar({ ...AL_DIA, porArea: [{ areaId: 'a1', codigo: 'C', nombre: 'Compras', cantidad: 0, masAntiguoDias: 0 }] });
    const toca = await screen.findByRole('region', { name: 'Lo que te toca' });
    expect(await within(toca).findByText('Estás al día')).toBeInTheDocument();
    expect(within(toca).queryByText('Compras')).not.toBeInTheDocument();
  });

  it('muestra los indicadores como tarjetas, con «—» donde no hay dato, y enlaza los vínculos a su lista filtrada', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    const urls = montar(AL_DIA);

    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    // Activos suma los que están por vencer: una cifra sin enlace a un estado único.
    const activos = within(vinculos).getByRole('group', { name: 'Activos' });
    expect(within(activos).getByText('1.234')).toBeInTheDocument();
    expect(within(activos).getByText('Incluye los por vencer')).toBeInTheDocument();
    expect(within(vinculos).queryByRole('link', { name: /^Activos/ })).not.toBeInTheDocument();
    // Cada cifra con lista propia es una tarjeta entera que enlaza a ella.
    expect(within(vinculos).getByRole('link', { name: /^Vencidos/ })).toHaveAttribute('href', '/e/emp/vinculos?estado=Vencido');
    expect(within(vinculos).getByRole('link', { name: /^Bloqueados/ })).toHaveAttribute('href', '/e/emp/vinculos?estado=Bloqueado');
    expect(within(vinculos).getByRole('link', { name: /^En validación/ })).toHaveAttribute('href', '/e/emp/vinculos?estado=EnValidacion');
    expect(within(vinculos).getByRole('link', { name: /^Invitados/ })).toHaveAttribute('href', '/e/emp/vinculos?estado=Invitado');
    expect(within(vinculos).getByText('Sin aceptar la invitación')).toBeInTheDocument();

    const expedientes = screen.getByRole('region', { name: 'Expedientes' });
    expect(within(expedientes).getByText('4,3')).toBeInTheDocument();
    expect(within(expedientes).getByText('—')).toBeInTheDocument();
    expect(within(expedientes).getByText('Sin expedientes aprobados en la ventana')).toBeInTheDocument();
    expect(within(expedientes).getByText(/los últimos 30 días/)).toBeInTheDocument();
    expect(within(expedientes).getByText('Observados')).toBeInTheDocument();
    expect(within(expedientes).getByText('Esperando al tercero')).toBeInTheDocument();
    expect(within(within(expedientes).getByRole('link', { name: /^Aprobados/ })).getByText('de 13 cerrados')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Certificados' })).getByText('40')).toBeInTheDocument();
    expect(urls).toContain('/api/v1/indicadores?dias=30');
  });

  it('los aprobados y los días en promedio llevan al informe de estado con la misma ventana; las demás cifras de expedientes no enlazan', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar(AL_DIA);
    const expedientes = await screen.findByRole('region', { name: 'Expedientes' });
    const ruta = /^\/e\/emp\/informes\/estado-expedientes\?fecha=Cierre&estado=Aprobado&desde=\d{4}-\d{2}-\d{2}$/;
    expect(within(expedientes).getByRole('link', { name: /^Aprobados/ })).toHaveAttribute('href', expect.stringMatching(ruta));
    expect(within(expedientes).getByRole('link', { name: /^Días en promedio/ })).toHaveAttribute('href', expect.stringMatching(ruta));
    expect(within(expedientes).getAllByRole('link')).toHaveLength(2);
    for (const nombre of ['En curso', 'Observados', 'Rechazados', 'Mediana de días']) expect(within(expedientes).getByRole('group', { name: nombre })).toBeInTheDocument();
  });

  it('las alertas van en rojo si hay alguna', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA);
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    const vencidos = within(vinculos).getByRole('link', { name: /^Vencidos/ });
    expect(colorDe(within(vencidos).getByText('2'))).toBe(ROJO_TEXTO);
    expect(getComputedStyle(vencidos).borderColor).toBe(ROJO_BORDE);
    expect(colorDe(within(within(vinculos).getByRole('link', { name: /^Bloqueados/ })).getByText('1'))).toBe(ROJO_TEXTO);

    const expedientes = screen.getByRole('region', { name: 'Expedientes' });
    expect(colorDe(within(within(expedientes).getByRole('group', { name: 'Observados' })).getByText('3'))).toBe(ROJO_TEXTO);
    expect(colorDe(within(within(expedientes).getByRole('group', { name: 'Rechazados' })).getByText('1'))).toBe(ROJO_TEXTO);
    const certificados = screen.getByRole('region', { name: 'Certificados' });
    expect(colorDe(within(within(certificados).getByRole('group', { name: 'Con pendientes' })).getByText('6'))).toBe(ROJO_TEXTO);
    expect(colorDe(within(within(certificados).getByRole('group', { name: 'No válidos' })).getByText('2'))).toBe(ROJO_TEXTO);
    // Lo que no es una alerta conserva su color normal.
    expect(colorDe(within(within(certificados).getByRole('group', { name: 'Vigentes' })).getByText('40'))).not.toBe(ROJO_TEXTO);
    expect(colorDe(within(within(expedientes).getByRole('group', { name: 'En curso' })).getByText('9'))).not.toBe(ROJO_TEXTO);
  });

  it('con las alertas en cero no se pintan de rojo', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, {
      ...INDICADORES,
      vinculosVencidos: 0,
      vinculosBloqueados: 0,
      expedientesObservados: 0,
      expedientesRechazados: 0,
      certificadosConPendientes: 0,
      certificadosNoValidos: 0,
    });
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    const vencidos = within(vinculos).getByRole('link', { name: /^Vencidos/ });
    expect(colorDe(within(vencidos).getByText('0'))).not.toBe(ROJO_TEXTO);
    expect(getComputedStyle(vencidos).borderColor).not.toBe(ROJO_BORDE);
    expect(colorDe(within(within(screen.getByRole('region', { name: 'Certificados' })).getByRole('group', { name: 'No válidos' })).getByText('0'))).not.toBe(ROJO_TEXTO);
  });

  it('reparte los vínculos en una barra con su leyenda: activos al día, por vencer y en proceso; el grupo en cero no se lista', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosActivos: 100, vinculosPorVencer: 20, vinculosEnRevision: 2, vinculosEnValidacion: 8, vinculosInvitados: 5, vinculosVencidos: 0, vinculosBloqueados: 0 });
    const reparto = await screen.findByRole('region', { name: 'Reparto de los vínculos' });
    // Activos suma los por vencer: al día son 80 y por vencer 20; en proceso, 8 + 2 + 5; total 115.
    expect(within(reparto).getByText('Cada vínculo cuenta en un solo grupo; en total hay 115.')).toBeInTheDocument();
    expect(within(reparto).getByRole('img', { name: 'Reparto de los vínculos: Activos al día 80, Por vencer 20, En proceso 15' })).toBeInTheDocument();
    expect(within(reparto).getAllByRole('term').map((t) => t.textContent)).toEqual(['Activos al día', 'Por vencer', 'En proceso']);
    expect(within(reparto).getByText('Invitados, en validación y en revisión')).toBeInTheDocument();
    expect(within(reparto).queryByText('Vencidos o bloqueados')).not.toBeInTheDocument();
  });

  it('sin ningún vínculo no se dibuja el reparto', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosActivos: 0, vinculosEnValidacion: 0, vinculosInvitados: 0, vinculosVencidos: 0, vinculosBloqueados: 0 });
    await screen.findByRole('region', { name: 'Vínculos' });
    expect(screen.queryByRole('region', { name: 'Reparto de los vínculos' })).not.toBeInTheDocument();
  });

  it('mientras cargan los indicadores muestra esqueletos con la forma de las tarjetas y luego las cifras', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar(AL_DIA);
    const cargando = screen.getByRole('status', { name: 'Cargando los indicadores' });
    expect(cargando).toHaveAttribute('aria-busy', 'true');
    // Cinco tarjetas de vínculos, seis de expedientes y tres de certificados, más el rótulo de cada grupo.
    expect(cargando.querySelectorAll('.MuiSkeleton-root')).toHaveLength(5 + 6 + 3 + 3);
    await screen.findByRole('region', { name: 'Vínculos' });
    expect(screen.queryByRole('status', { name: 'Cargando los indicadores' })).not.toBeInTheDocument();
  });

  it('muestra cuántos vínculos están por vencer (vigencia periódica) y enlaza a su lista; en cero no hay tarjeta', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosPorVencer: 7 });
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    const tarjeta = within(vinculos).getByRole('link', { name: /^Por vencer/ });
    expect(tarjeta).toHaveAttribute('href', '/e/emp/vinculos?estado=PorVencer');
    expect(within(tarjeta).getByText('7')).toBeInTheDocument();
  });

  it('muestra cuántos vínculos están en revisión por una actualización y enlaza a su lista; en cero no hay tarjeta', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosEnRevision: 3 });
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    const tarjeta = within(vinculos).getByRole('link', { name: /^En revisión/ });
    expect(tarjeta).toHaveAttribute('href', '/e/emp/vinculos?estado=EnRevision');
    expect(within(tarjeta).getByText('3')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Con una actualización abierta')).toBeInTheDocument();
  });

  it('muestra cuántos certificados siguen vigentes en verificación y enlaza a su lista; en cero no hay tarjeta', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.certificadosLeer]);
    montar(AL_DIA, { ...INDICADORES, certificadosEnVerificacion: 7 });
    const certificados = await screen.findByRole('region', { name: 'Certificados' });
    const tarjeta = within(certificados).getByRole('link', { name: /^En verificación/ });
    expect(tarjeta).toHaveAttribute('href', '/e/emp/certificados?estado=EnVerificacion');
    expect(within(tarjeta).getByText('7')).toBeInTheDocument();
  });

  it('sin certificados en verificación no aparece la tarjeta «En verificación»', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.certificadosLeer]);
    montar(AL_DIA, { ...INDICADORES, certificadosEnVerificacion: 0 });
    const certificados = await screen.findByRole('region', { name: 'Certificados' });
    expect(within(certificados).queryByText('En verificación')).not.toBeInTheDocument();
  });

  it('sin vínculos en revisión no aparece la tarjeta «En revisión»', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosEnRevision: 0 });
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    expect(within(vinculos).queryByText('En revisión')).not.toBeInTheDocument();
  });

  it('sin vínculos por vencer no aparece la tarjeta «Por vencer»', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer, SCOPES.vinculosLeer]);
    montar(AL_DIA, { ...INDICADORES, vinculosPorVencer: 0 });
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    expect(within(vinculos).queryByText('Por vencer')).not.toBeInTheDocument();
  });

  it('sin vinculos:leer los indicadores de vínculos no enlazan y siguen siendo tarjetas con su cifra', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar(AL_DIA);
    const vinculos = await screen.findByRole('region', { name: 'Vínculos' });
    expect(within(vinculos).queryByRole('link')).not.toBeInTheDocument();
    expect(within(within(vinculos).getByRole('group', { name: 'Vencidos' })).getByText('2')).toBeInTheDocument();
  });

  it('al cambiar la ventana pide los indicadores de 7 días', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    const usuario = userEvent.setup();
    const urls = montar(AL_DIA);
    await screen.findByRole('region', { name: 'Expedientes' });

    const ventana = screen.getByRole('group', { name: 'Ventana de los indicadores' });
    expect(within(ventana).getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(within(ventana).getByRole('button', { name: '7 días' }));

    await waitFor(() => expect(urls).toContain('/api/v1/indicadores?dias=7'));
    expect(await screen.findByText(/los últimos 7 días/)).toBeInTheDocument();
    expect(within(ventana).getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(ventana).getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('el selector de ventana son píldoras como las de Informes: la elegida es blanca con sombra, las demás no', async () => {
    permisos.scopes = new Set([SCOPES.expedientesLeer]);
    montar(AL_DIA, INDICADORES, '/e/emp/inicio?dias=90');
    await screen.findByRole('region', { name: 'Expedientes' });
    const ventana = screen.getByRole('group', { name: 'Ventana de los indicadores' });
    const elegida = within(ventana).getByRole('button', { name: '90 días' });
    const otra = within(ventana).getByRole('button', { name: '7 días' });
    expect(getComputedStyle(elegida).backgroundColor).toBe(hexARgb(COLOR.light.superficieNivel1));
    expect(getComputedStyle(elegida).boxShadow).not.toBe('none');
    expect(getComputedStyle(elegida).borderTopWidth).toBe('0px');
    expect(getComputedStyle(otra).backgroundColor).not.toBe(hexARgb(COLOR.light.superficieNivel1));
  });
});
