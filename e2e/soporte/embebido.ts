import type { FrameLocator, Page } from '@playwright/test';
import { API, llamar } from './api';
import { ORIGEN_SISTEMA, type Empresa, type Escenario, type Persona } from './semilla';

/**
 * Página del sistema integrado (otro origen) que aloja la app de Valídalo en un iframe, como lo haría el SRM: cuando
 * Valídalo pide sesión, «su backend» (la prueba, en Node) firma la aserción de la persona y canjea el token en
 * `POST /api/v1/sesiones-usuario`; la página se lo pasa al iframe por postMessage (contrato de sesion/puenteEmbed.ts).
 * El iframe ocupa el alto de la ventana (no crece con `validalo:resize`): así los diálogos, centrados en el iframe,
 * siempre quedan a la vista y el contenido largo se desplaza dentro del iframe.
 */
function paginaAnfitriona(rutaInicial: string, empresaId: string | null): string {
  return `<!doctype html>
<html lang="es-CO"><head><meta charset="utf-8"><title>Sistema integrado E2E</title>
<style>html,body{margin:0;background:#eef1f5;font-family:sans-serif} header{height:48px;display:flex;align-items:center;padding:0 16px;background:#263238;color:#fff}
iframe{display:block;width:100%;height:calc(100vh - 48px);border:0}</style></head>
<body><header>Sistema integrado E2E</header>
<iframe id="validalo" title="Valídalo" src="${API}/app/#/${empresaId ? `e/${empresaId}/` : ''}${rutaInicial}"></iframe>
<script>
  const marco = document.getElementById('validalo');
  window.mensajesDeValidalo = [];
  window.addEventListener('message', async (evento) => {
    if (evento.origin !== ${JSON.stringify(API)} || !evento.data || typeof evento.data.tipo !== 'string') return;
    window.mensajesDeValidalo.push(evento.data);
    if (evento.data.tipo === 'validalo:sesion-requerida') {
      const token = await window.sesionDeValidalo();
      marco.contentWindow.postMessage({ tipo: 'validalo:sesion', token, empresaId: ${JSON.stringify(empresaId)} }, ${JSON.stringify(API)});
    }
  });
</script></body></html>`;
}

/** Abre Valídalo embebido como `persona` en `empresa` (Norte por defecto); devuelve el iframe para usarlo. */
export async function abrirEmbebido(page: Page, e: Escenario, persona: Persona, empresa: Empresa = e.norte, rutaInicial = 'bandeja'): Promise<FrameLocator> {
  return abrirEmbebidoCon(page, { empresaId: empresa.id, rutaInicial, sesion: () => sesionDeUsuario(e.llave, e.delegado(persona)) });
}

/** Token de la sesión embebida de una persona: API key del sistema + su aserción (lo que hace el backend del sistema). */
export async function sesionDeUsuario(llave: string, delegado: string): Promise<string> {
  return (await llamar<{ token: string }>('POST', '/api/v1/sesiones-usuario', { llave, delegado })).token;
}

/**
 * Página anfitriona con el iframe en `#/{e/empresaId/}rutaInicial`; `sesion` es lo que «el backend del sistema» canjea cada
 * vez que Valídalo pide sesión (una persona de un tenant o, sin empresa, un operador de Plataforma).
 */
export async function abrirEmbebidoCon(
  page: Page,
  { empresaId, rutaInicial, sesion }: { empresaId: string | null; rutaInicial: string; sesion: () => Promise<string> },
): Promise<FrameLocator> {
  await page.route(`${ORIGEN_SISTEMA}/**`, (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: paginaAnfitriona(rutaInicial, empresaId) }),
  );
  await page.exposeFunction('sesionDeValidalo', sesion);
  await page.goto(`${ORIGEN_SISTEMA}/`);
  return page.frameLocator('#validalo');
}
