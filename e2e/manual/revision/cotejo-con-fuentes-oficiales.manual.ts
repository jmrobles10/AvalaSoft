import type { FrameLocator } from '@playwright/test';
import { pedirVerificaciones, enRevision, personaEmbebida } from '../../soporte/cumplimiento';
import { abrirDesdeBandeja, aprobarArea } from '../../soporte/empresa';
import { esperarEstadoDelTercero } from '../../soporte/proveedor';
import { crearEscenario } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { irASector } from '../nucleo/ficha';
import { usarProveedorSimuladoParaFuentes } from '../nucleo/semillas';

const NOMBRE = 'Aceros Cancelados del Norte S.A.S.';

/** Recarga el expediente desde la bandeja hasta que el RUES muestre el estado esperado: la consulta corre sola al pasar a revisión. */
async function esperarRues(app: FrameLocator, tercero: string, area: string, estado: string): Promise<void> {
  await expect(async () => {
    await abrirDesdeBandeja(app, tercero, area);
    await irASector(app, 'Oficial de cumplimiento');
    await expect(app.getByRole('region', { name: 'Registro mercantil (RUES)' })).toContainText(estado, { timeout: 1500 });
  }).toPass({ timeout: 45_000 });
}

recorrido(
  {
    dominio: 'revision',
    actor: 'Revisor/área',
    titulo: 'Resuelve una diferencia con el registro mercantil (RUES)',
    resumen:
      'Un proveedor cuya matrícula figura cancelada en el RUES llega a revisión. El oficial de cumplimiento lee lo que dijo el registro, revisa el cotejo campo por campo, acepta la diferencia con su justificación y guarda la constancia con la respuesta de la fuente.',
    precondiciones: [
      'Un grupo con Constructora Norte y el flujo de proveedores que pide el RUES como bloqueante.',
      'Un proveedor cuya matrícula el registro figura cancelada (con el proveedor simulado).',
      'Rubén (Compras) y Olga (Cumplimiento) como miembros de sus áreas.',
    ],
    relacionados: ['configuracion/fuentes-oficiales-de-la-empresa', 'plataforma/fuentes-oficiales', 'revision/aprobar-un-area'],
  },
  async ({ page, browser }) => {
    const e = await crearEscenario();
    await usarProveedorSimuladoParaFuentes();
    await pedirVerificaciones(e, [{ tipo: 'Rues', bloqueante: true }]);

    const pTercero = await (await browser.newContext()).newPage();
    await enRevision(pTercero, e, NOMBRE);
    const ruben = await personaEmbebida(browser, e, e.ruben);
    await abrirDesdeBandeja(ruben, NOMBRE, 'Compras');
    await aprobarArea(ruben, 'Compras');

    const olga = await personaEmbebida(browser, e, e.olga);
    await esperarRues(olga, NOMBRE, 'Cumplimiento', 'Diferencias por revisar');
    const rues = olga.getByRole('region', { name: 'Registro mercantil (RUES)' });
    await expect(rues).toContainText('Diferencias por revisar');

    await paso(page, {
      titulo: 'Lee lo que dice el registro mercantil',
      explicacion:
        'La sección del RUES muestra la fuente consultada, la fecha y el proveedor, y lo que dijo el registro: el estado de la matrícula, la razón social y los representantes. ' +
        'El estado «Diferencias por revisar» quiere decir que hay un dato que no coincide con la ficha o con el certificado de Cámara: lo decides tú. La verificación es bloqueante, así que el expediente no cierra hasta resolverla.',
      resaltar: rues.getByRole('region', { name: 'Lo que dice la fuente' }),
      variantes: [
        { cuando: 'El RUES coincide con la ficha', entonces: 'La sección dice «Conforme» y no hay nada que decidir: el expediente sigue su curso.' },
        { cuando: 'El tercero no figura en el registro', entonces: 'La fuente dice «La fuente no tiene al tercero» y es una diferencia crítica.' },
      ],
    });

    const cotejo = rues.getByRole('region', { name: 'Cotejo con la ficha y los documentos' });
    await expect(cotejo.getByText('Diferencia', { exact: true }).first()).toBeVisible();
    await paso(page, {
      titulo: 'Revisa el cotejo campo por campo',
      explicacion:
        'El cotejo compara cada campo de la fuente con la ficha maestra y con lo que extrajo la IA del certificado de Cámara. Cada fila dice qué dice la fuente, contra qué se compara y el resultado: «Coincide», «Diferencia» o «No verificable». ' +
        'Una diferencia en el estado de la matrícula es crítica. Lo que la fuente no trae o la ficha no tiene se marca como «No verificable» y no te pide decisión.',
      resaltar: [cotejo.getByText('Crítica', { exact: true }).first(), cotejo.getByText('Diferencia', { exact: true }).first()],
      configuracion: {
        ajuste: 'Campos que se cotejan',
        ruta: 'Configuración › Flujos aprobatorios (/flujos)',
        efecto: 'Se coteja la matrícula, la renovación, la razón social, el NIT y los representantes del RUES contra la ficha y el certificado de Cámara.',
      },
    });

    // Aceptar la diferencia: justificación obligatoria; vale 12 meses.
    await cotejo.getByRole('button', { name: 'Aceptar diferencia' }).first().click();
    const dialogo = olga.getByRole('dialog', { name: 'Aceptar la diferencia' });
    await dialogo.getByRole('textbox', { name: /Justificación/ }).fill('En liquidación voluntaria: la empresa lo confirmó por escrito con su certificado.');
    await paso(page, {
      titulo: 'Acepta la diferencia con tu justificación',
      explicacion:
        'Aceptar una diferencia quiere decir que el dato de la fuente no impide aprobar, por una razón que tú documentas. La justificación es obligatoria y queda en el historial y en la auditoría. ' +
        'Vale 12 meses: una reconsulta que encuentre la misma diferencia no la vuelve a pedir. Si en cambio es un hallazgo real, eliges «Confirmar hallazgo»: el expediente no se aprueba y Cumplimiento puede rechazarlo.',
      resaltar: dialogo.getByRole('textbox', { name: /Justificación/ }),
      variantes: [
        { cuando: 'Confirmar hallazgo', entonces: 'La verificación queda fallida y el expediente no se aprueba. Nunca se hereda a otra consulta ni rechaza el expediente sola.' },
      ],
    });
    await dialogo.getByRole('button', { name: 'Guardar decisión' }).click();
    await expect(dialogo).toBeHidden();
    await expect(rues).toContainText('Conforme');

    await paso(page, {
      titulo: 'La fuente queda conforme y guardas la constancia',
      explicacion:
        'Con la diferencia aceptada, el RUES queda «Conforme» y vigente hasta la fecha que muestra. «Constancia» descarga la evidencia: la respuesta cruda del registro, la fecha, quién consultó y su huella SHA-256, para que el registro pueda verificarse después. ' +
        'Las consultas anteriores quedan debajo, cada una con su constancia.',
      resaltar: [rues.getByText('Conforme', { exact: true }).first(), rues.getByRole('button', { name: 'Constancia' }).first()],
    });

    // La última área aprueba y el expediente cierra.
    await irASector(olga, 'Aprobaciones');
    await aprobarArea(olga, 'Cumplimiento');
    await esperarEstadoDelTercero(pTercero, 'Aprobado');
    await paso(page, {
      titulo: 'Aprueba tu área y el expediente cierra',
      explicacion:
        'Con la diferencia resuelta y el resto de las áreas aprobadas, el expediente se aprueba y el tercero lo ve en su portal. Si una diferencia siguiera sin decidir, el expediente quedaría en revisión y la bandeja de Cumplimiento lo mostraría.',
      resaltar: olga.getByRole('heading', { level: 1, name: NOMBRE }),
    });
  },
);
