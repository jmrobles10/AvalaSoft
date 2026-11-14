import { abrirEmbebido } from '../../soporte/embebido';
import { crearEscenario, invitar, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { exigirAprobacionParaInvitar } from '../nucleo/semillas';

const ACEROS = 'Aceros del Norte S.A.S.';
const PACIFICO = 'Ferretería Pacífico S.A.S.';

recorrido(
  {
    dominio: 'operacion',
    actor: 'Oficial de cumplimiento',
    titulo: 'Aprueba o rechaza las invitaciones retenidas',
    resumen:
      'Constructora Norte exige que otra persona apruebe cada invitación a proveedores antes de que salga el correo. Olga, oficial de cumplimiento, abre la bandeja de invitaciones por aprobar, aprueba una: el correo sale al tercero. A otra la rechaza con un motivo, y el vínculo queda anulado sin escribirle al tercero.',
    precondiciones: [
      'Un grupo con Constructora Norte. El tipo de vínculo Proveedor exige aprobación antes de invitar y la aprueba el rol Oficial de cumplimiento.',
      'Dos invitaciones a proveedores retenidas, pedidas por una integración (no por una persona de la empresa).',
    ],
    relacionados: ['configuracion/tipos-de-vinculo', 'vinculos/lista-y-filtros'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    await exigirAprobacionParaInvitar(e, 'OficialCumplimiento');
    await invitar(e, e.norte, nuevoTercero(ACEROS));
    await invitar(e, e.norte, nuevoTercero(PACIFICO));

    const app = await abrirEmbebido(page, e, e.olga, e.norte, 'invitaciones/por-aprobar');
    await expect(app.getByRole('heading', { level: 1, name: 'Invitaciones por aprobar' })).toBeVisible();
    await expect(app.getByRole('row', { name: new RegExp(ACEROS) })).toBeVisible();

    await paso(page, {
      titulo: 'Abre la bandeja de invitaciones por aprobar',
      explicacion:
        'Aquí están las invitaciones que esperan a otra persona antes de salir: el tercero, el tipo, a qué correo se enviará, quién la pidió y desde cuándo. ' +
        'Quien la pidió no puede aprobarla, y la columna «Decisión» dice si la decides tú o la decide otra persona. «Solo las que puedo decidir» filtra la lista.',
      resaltar: [app.getByRole('table'), app.getByRole('checkbox', { name: 'Solo las que puedo decidir' })],
      variantes: [
        { cuando: 'Tu rol no es de los que aprueban este tipo de vínculo', entonces: 'Ves la lista pero no los botones de decisión: la decide otra persona.' },
        { cuando: 'Eres quien pidió la invitación', entonces: 'Ves «La pediste tú» y no puedes aprobarla ni rechazarla.' },
      ],
      configuracion: {
        ajuste: 'Quién aprueba las invitaciones del tipo de vínculo',
        ruta: 'Configuración › Tipos de vínculo (/tipos-vinculo)',
        efecto: 'Un rol o un área de la empresa: solo sus miembros ven los botones para decidir.',
      },
    });

    // 1) Aprobar: el correo sale al tercero.
    await app.getByRole('button', { name: `Aprobar la invitación a ${ACEROS}` }).click();
    await expect(app.getByText('Invitación aprobada: el correo ya salió.')).toBeVisible();
    await paso(page, {
      titulo: 'Aprueba una invitación',
      explicacion:
        'Al aprobar, el sistema envía el correo al tercero con el enlace y la vigencia que se pidieron, en la misma operación que registra tu aprobación. ' +
        'La invitación sale de la lista y el vínculo pasa a «Invitado», como cualquier otra invitación enviada.',
      resaltar: app.getByText('Invitación aprobada: el correo ya salió.'),
      avisos: true,
    });

    // 2) Rechazar: el vínculo se anula y no se escribe al tercero.
    await app.getByRole('button', { name: `Rechazar la invitación a ${PACIFICO}` }).click();
    const rechazo = app.getByRole('dialog', { name: 'Rechazar la invitación' });
    await rechazo.getByRole('textbox', { name: 'Motivo' }).fill('El proveedor ya está vinculado con otra empresa del grupo.');
    await paso(page, {
      titulo: 'Rechaza con un motivo',
      explicacion:
        'El rechazo anula el vínculo con el motivo que escribes, y ese motivo lo ve quien pidió la invitación. Nunca se escribe al tercero: no sale ningún correo.',
      resaltar: rechazo,
    });

    await rechazo.getByRole('button', { name: 'Rechazar', exact: true }).click();
    await expect(app.getByText('Invitación rechazada: el vínculo quedó anulado.')).toBeVisible();
    // Con «Solo las que puedo decidir» activo, la bandeja vacía dice que no tienes nada por decidir.
    await expect(app.getByText('No tienes invitaciones por decidir.')).toBeVisible();
    await paso(page, {
      titulo: 'Comprueba que la bandeja quedó vacía',
      explicacion:
        'La invitación rechazada sale de la bandeja y su vínculo queda anulado en la lista de vínculos. Si alguien la pidió de nuevo, vuelve a la bandeja como una invitación nueva. ' +
        'Apaga «Solo las que puedo decidir» para ver las que decide otra persona.',
      resaltar: app.getByText('No tienes invitaciones por decidir.'),
      avisos: true,
    });
  },
);
