// Backend mínimo del sistema anfitrión ficticio (IO-5, docs/integracion.md §8.1). Sirve index.html y expone POST /sesion: canjea con la API key del
// sistema (que solo vive aquí, en el servidor) una sesión del tercero en AvalaSoft y devuelve a la página únicamente el resultado.
//
//   AVALASOFT_URL=http://localhost:5080 AVALASOFT_API_KEY=vsk_… AVALASOFT_EMPRESA=<id> AVALASOFT_VINCULO=<id> \
//   ORIGEN_ANFITRION=http://localhost:5199 PUERTO=5199 node servidor.mjs
//
// Requisitos en AvalaSoft: un sistema integrador cuyo `origenesPermitidos` incluya ORIGEN_ANFITRION, una API key suya con el permiso
// `sesiones-tercero:crear` y un vínculo (de la empresa) con la invitación aceptada que lleve la referencia de ese sistema.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { AVALASOFT_URL, AVALASOFT_API_KEY, AVALASOFT_EMPRESA, AVALASOFT_VINCULO, ORIGEN_ANFITRION = 'http://localhost:5199', PUERTO = '5199' } = process.env;
if (!AVALASOFT_URL || !AVALASOFT_API_KEY || !AVALASOFT_EMPRESA || !AVALASOFT_VINCULO) {
  console.error('Faltan AVALASOFT_URL, AVALASOFT_API_KEY, AVALASOFT_EMPRESA o AVALASOFT_VINCULO.');
  process.exit(1);
}

const pagina = await readFile(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

/** POST /api/v1/sesiones-tercero con la API key del sistema; el vínculo lo decide el sistema, no la página. */
async function abrirSesion(componente) {
  const respuesta = await fetch(`${AVALASOFT_URL}/api/v1/sesiones-tercero`, {
    method: 'POST',
    headers: { 'X-Api-Key': AVALASOFT_API_KEY, 'X-Empresa': AVALASOFT_EMPRESA, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ vinculoId: AVALASOFT_VINCULO, componente, origen: ORIGEN_ANFITRION, minutos: 10 }),
  });
  if (!respuesta.ok) throw new Error(`AvalaSoft respondió ${respuesta.status}: ${await respuesta.text()}`);
  return respuesta.json();
}

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/sesion') {
      let cuerpo = '';
      for await (const trozo of req) cuerpo += trozo;
      const { componente } = JSON.parse(cuerpo || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await abrirSesion(componente)));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(pagina);
    }
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(error));
  }
}).listen(Number(PUERTO), () => console.log(`Anfitrión ficticio en ${ORIGEN_ANFITRION}`));
