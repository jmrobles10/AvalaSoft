import { abrirEmbebidoConLlave } from '../../soporte/derechos';
import { crearEscenario } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { llaveConCuestionarios } from '../nucleo/semillas';

const NOMBRE = 'Evaluación de proveedor nuevo';

recorrido(
  {
    dominio: 'configuracion',
    actor: 'Administrador de empresa',
    titulo: 'Crea y publica un cuestionario de evaluación de proveedores',
    resumen:
      'Ana, administradora de Constructora Norte, crea un cuestionario para evaluar a los proveedores nuevos: define el umbral de aprobación, quién responde, y una pregunta eliminatoria. Al publicarlo, la versión queda congelada y las evaluaciones nuevas la usan.',
    precondiciones: ['Un grupo con Constructora Norte y Ana como administradora, sin cuestionarios previos.'],
    relacionados: ['revision/evaluacion-bajo-el-umbral', 'tercero/autoevaluacion-del-proveedor', 'configuracion/flujo-verificaciones-de-cumplimiento'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    // La llave de la siembra no trae los scopes de cuestionarios: la de esta prueba sí.
    const app = await abrirEmbebidoConLlave(page, e, await llaveConCuestionarios(e), e.ana, e.norte, 'cuestionarios');
    await expect(app.getByRole('heading', { level: 1, name: `Cuestionarios de evaluación de ${e.norte.nombre}` })).toBeVisible();

    await paso(page, {
      titulo: 'Abre la lista de cuestionarios',
      explicacion:
        'Un cuestionario evalúa a un proveedor con preguntas que pesan, puntúan y pueden eliminar. Se edita como borrador y, al publicarlo, queda congelado: las evaluaciones ya hechas conservan su versión. ' +
        'Un flujo de validación lo pide, o se asigna a un proveedor a mano.',
      resaltar: app.getByRole('button', { name: 'Nuevo cuestionario' }),
      configuracion: {
        ajuste: 'Cuestionarios de evaluación',
        ruta: 'Configuración › Cuestionarios (/cuestionarios)',
        efecto: 'Ver o crear cuestionarios depende del permiso «cuestionarios:escribir» del rol.',
      },
    });

    // 1. Crear el cuestionario.
    await app.getByRole('button', { name: 'Nuevo cuestionario' }).click();
    const nuevo = app.getByRole('dialog', { name: 'Nuevo cuestionario de evaluación' });
    await nuevo.getByRole('textbox', { name: /^Código/ }).fill('PROVEEDOR-NUEVO');
    await nuevo.getByRole('textbox', { name: /^Nombre/ }).fill(NOMBRE);
    await paso(page, {
      titulo: 'Crea el cuestionario con su código',
      explicacion:
        'El código identifica el cuestionario dentro de la empresa: solo letras, números y guiones, y no se reutiliza después. El nombre es el que verás en la lista y en los flujos. ' +
        'El cuestionario nace con una sección y una pregunta de ejemplo que reescribes en el editor.',
      resaltar: nuevo,
    });
    await nuevo.getByRole('button', { name: 'Crear cuestionario' }).click();

    // 2. Configurar umbral y quién responde.
    const editor = app.getByRole('heading', { level: 1, name: new RegExp(`^${NOMBRE}`) });
    await expect(editor).toBeVisible();
    await app.getByRole('textbox', { name: 'Umbral de aprobación (0 a 100)' }).fill('70');
    await app.getByRole('radio', { name: 'El tercero (autoevaluación)' }).check();
    await paso(page, {
      titulo: 'Define el umbral y quién responde',
      explicacion:
        '«Umbral de aprobación» es el puntaje mínimo: con menos, la evaluación sale reprobada. «Quién responde» decide quién contesta. ' +
        'Si lo responde el tercero, es una autoevaluación desde su portal, y él no ve puntajes, pesos ni el resultado. Si lo responde una persona de la empresa, la contesta en esta consola.',
      resaltar: [app.getByRole('textbox', { name: 'Umbral de aprobación (0 a 100)' }), app.getByRole('radiogroup', { name: 'Quién responde' })],
      variantes: [
        { cuando: 'Eliges «Una persona de la empresa (evaluador)»', entonces: 'La evaluación se responde aquí y solo la ven quienes tienen permiso para responderla.' },
        { cuando: 'Activas «Repetir la evaluación periódicamente»', entonces: 'Cada cierto número de meses la evaluación vigente vence y se pide una nueva.' },
      ],
    });

    // 3. Una pregunta eliminatoria.
    await app.getByRole('button', { name: 'Agregar pregunta' }).click();
    await app.getByRole('textbox', { name: 'Texto de la pregunta' }).last().fill('¿Tiene sanciones vigentes de la superintendencia?');
    await app.getByLabel('Eliminatoria', { exact: true }).last().check();
    await app.getByLabel('Elimina', { exact: true }).last().check();
    await paso(page, {
      titulo: 'Marca una pregunta eliminatoria',
      explicacion:
        'Una pregunta eliminatoria reprueba la evaluación cuando la respuesta cae en lo que elimina, sin importar el puntaje. Por eso exige decir qué respuesta elimina: una eliminatoria sin criterio no se puede publicar. ' +
        'Las preguntas que no puntúan sirven para recoger información o evidencia.',
      resaltar: app.getByLabel('Eliminatoria', { exact: true }).last(),
      variantes: [{ cuando: 'La pregunta no tiene criterio de eliminación', entonces: 'Publicar falla con «Indica qué respuesta elimina».' }],
    });

    // 4. Guardar y publicar.
    await app.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(app.getByText('Borrador guardado.')).toBeVisible();
    await app.getByRole('button', { name: 'Publicar versión 1' }).click();
    const confirmar = app.getByRole('dialog', { name: 'Publicar la versión 1' });
    await paso(page, {
      titulo: 'Publica la versión',
      explicacion:
        'Al publicar, la versión queda congelada: no se puede modificar, y las evaluaciones nuevas la usan. Las evaluaciones que ya existen conservan la versión con la que se hicieron. Para cambiarla después, se edita y se crea una versión nueva.',
      resaltar: confirmar,
    });
    await confirmar.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(app.getByText('Versión 1 publicada.')).toBeVisible();
    await paso(page, {
      titulo: 'Comprueba que la versión está publicada',
      explicacion:
        'El encabezado muestra la versión publicada y ya no hay borrador pendiente. Desde ahora un flujo de validación puede pedir este cuestionario y asignarse a un proveedor.',
      resaltar: app.getByText('Versión 1 publicada.'),
      avisos: true,
    });
  },
);
