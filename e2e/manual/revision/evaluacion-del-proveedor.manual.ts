import { abrirEmbebidoConLlave } from '../../soporte/derechos';
import { crearEscenario, invitar, nuevoTercero } from '../../soporte/semilla';
import { llamar } from '../../soporte/api';
import { expect, paso, recorrido } from '../nucleo';
import { llaveConCuestionarios } from '../nucleo/semillas';

const CUESTIONARIO = 'Evaluación de proveedor nuevo';

recorrido(
  {
    dominio: 'revision',
    actor: 'Revisor/área',
    titulo: 'Califica una evaluación de proveedor que quedó bajo el umbral',
    resumen:
      'Olga, oficial de cumplimiento de Constructora Norte, responde como evaluadora interna la evaluación de un proveedor. Sus respuestas dan un puntaje bajo el umbral del cuestionario, así que la evaluación sale reprobada y el resultado queda registrado con su puntaje.',
    precondiciones: [
      'Un grupo con Constructora Norte. Hay un cuestionario publicado que responde una persona de la empresa (evaluador), con umbral 70.',
      'Un proveedor invitado a Norte con esa evaluación asignada y pendiente de responder.',
    ],
    relacionados: ['configuracion/cuestionario-de-evaluacion', 'vinculos/detalle-del-vinculo'],
  },
  async ({ browser }) => {
    const e = await crearEscenario();
    const llave = await llaveConCuestionarios(e);
    const cuestionario = await llamar<{ id: string }>('POST', '/api/v1/cuestionarios', {
      llave: e.admin,
      empresa: e.norte.id,
      cuerpo: {
        codigo: 'PROV_EVAL',
        nombre: CUESTIONARIO,
        definicion: {
          umbralDeAprobacion: 70,
          responde: 'Evaluador',
          secciones: [
            {
              codigo: null,
              nombre: 'Cumplimiento',
              peso: 1,
              preguntas: [
                {
                  codigo: null,
                  texto: '¿Entrega a tiempo?',
                  tipo: 'OpcionUnica',
                  obligatoria: true,
                  peso: 1,
                  eliminatoria: false,
                  opciones: [
                    { codigo: 'SI', texto: 'Siempre', puntaje: 10 },
                    { codigo: 'NO', texto: 'Nunca', puntaje: 0 },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    await llamar('POST', `/api/v1/cuestionarios/${cuestionario.id}/publicar`, { llave: e.admin, empresa: e.norte.id });
    const tercero = nuevoTercero('Aceros del Norte S.A.S.');
    const invitacion = await invitar(e, e.norte, tercero, 'PROVEEDOR');
    await llamar('POST', `/api/v1/vinculos/${invitacion.vinculoId}/evaluaciones`, {
      llave: e.admin,
      empresa: e.norte.id,
      cuerpo: { cuestionarioId: cuestionario.id },
    });

    // 1. La evaluación pendiente en la lista de Evaluaciones.
    const pagina = await (await browser.newContext()).newPage();
    const app = await abrirEmbebidoConLlave(pagina, e, llave, e.olga, e.norte, 'evaluaciones');
    await expect(app.getByRole('heading', { level: 1, name: 'Evaluaciones' })).toBeVisible();
    const fila = app.getByRole('row', { name: new RegExp(`Abrir la evaluación de ${tercero.nombre}`) });
    await expect(fila).toBeVisible();
    await paso(pagina, {
      titulo: 'Abre la evaluación pendiente',
      explicacion:
        'En «Evaluaciones» aparecen las evaluaciones de los proveedores de la empresa: las que pide el flujo, las periódicas y las asignadas a mano. La columna «Quién responde» dice si la contesta el tercero o una persona de la empresa. ' +
        'Esta la responde una persona de la empresa, así que aparece con tu nombre para responderla.',
      resaltar: [app.getByRole('table'), fila],
      variantes: [
        { cuando: 'El cuestionario lo responde el tercero', entonces: 'La evaluación no se responde aquí: el proveedor la contesta desde su portal y tú ves el resultado cuando la envía.' },
        { cuando: 'Tu rol no tiene permiso para responder evaluaciones', entonces: 'La evaluación se ve, pero no aparece el botón «Responder».' },
      ],
      configuracion: {
        ajuste: 'Quién responde (del cuestionario)',
        ruta: 'Configuración › Cuestionarios (/cuestionarios)',
        efecto: 'Un cuestionario de evaluador lo contesta una persona de la empresa; uno de tercero, el proveedor.',
      },
    });

    // 2. Responder: una respuesta que suma poco.
    await fila.click();
    await app.getByRole('radio', { name: 'Nunca', exact: true }).check();
    await paso(pagina, {
      titulo: 'Responde cada pregunta',
      explicacion:
        'Cada pregunta trae sus opciones con su puntaje: la mejor vale el 100 % de la pregunta. Las obligatorias no se pueden dejar sin responder, y si la pregunta permite comentario, puedes dejar una nota. ' +
        'Quien responde no ve el umbral mientras responde; el puntaje se calcula al enviar.',
      resaltar: app.getByRole('radio', { name: 'Nunca', exact: true }),
      variantes: [{ cuando: 'Hay preguntas obligatorias sin responder', entonces: 'Enviar muestra «Faltan N preguntas obligatorias» y no envía nada.' }],
    });

    // 3. Enviar: el puntaje queda bajo el umbral.
    await app.getByRole('button', { name: 'Enviar evaluación' }).click();
    await expect(app.getByText('Evaluación enviada: reprobada.')).toBeVisible();
    await paso(pagina, {
      titulo: 'Envía la evaluación y mira el resultado',
      explicacion:
        'El puntaje se compara con el umbral del cuestionario (70 en este caso). Con 0 puntos la evaluación sale reprobada, y el detalle dice el puntaje, el umbral y el motivo. ' +
        'Una pregunta eliminatoria reprobaría sin importar el puntaje; esta no lo es.',
      resaltar: app.getByText('Evaluación enviada: reprobada.'),
      avisos: true,
    });
  },
);
