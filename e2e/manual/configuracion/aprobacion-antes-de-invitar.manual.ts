import { abrirEmbebido } from '../../soporte/embebido';
import { crearEscenario, nuevaPersonaNatural, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';

const ACEROS = nuevoTercero('Aceros del Lote S.A.S.');
const CSV = (persona: ReturnType<typeof nuevaPersonaNatural>) =>
  [
    'Tipo de identificación;Número de identificación;DV;Razón social o nombres;Correo;Tipo de vínculo',
    `NIT;${ACEROS.identificacion.numero};${ACEROS.identificacion.digitoVerificacion};${ACEROS.nombre};${ACEROS.correo};PROVEEDOR`,
    `CC;${persona.identificacion.numero};;${persona.nombre};${persona.correo};PROVEEDOR`,
  ].join('\r\n');

recorrido(
  {
    dominio: 'configuracion',
    actor: 'Administrador de empresa',
    titulo: 'Exige aprobar cada invitación antes de que salga el correo',
    resumen:
      'Ana, administradora de Constructora Norte, activa en el tipo Proveedor que cada invitación espere la aprobación de otra persona. Luego invita a un lote: el lote queda «Por aprobar» y el correo no sale hasta que el oficial de cumplimiento lo apruebe.',
    precondiciones: [
      'Un grupo con Constructora Norte, el tipo de vínculo Proveedor y el rol Oficial de cumplimiento con una persona asignada (Olga).',
      'Una administradora (Ana) que entra desde el sistema integrado.',
    ],
    relacionados: ['operacion/invitaciones-por-aprobar', 'operacion/invitacion-por-lotes'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    const persona = nuevaPersonaNatural('Ana Lote Pérez');
    const app = await abrirEmbebido(page, e, e.ana, e.norte, 'tipos-vinculo');
    await expect(app.getByRole('row', { name: /Proveedor/ })).toBeVisible();

    // 1. Activar la exigencia en el tipo Proveedor.
    await app.getByRole('button', { name: 'Acciones de Proveedor' }).click();
    await app.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    const panel = app.locator('[aria-labelledby="titulo-tipo-vinculo"]');
    await expect(panel.getByRole('heading', { name: /Editar Proveedor/ })).toBeVisible();
    await panel.getByRole('checkbox', { name: /Exige aprobación antes de invitar/ }).check();
    await paso(page, {
      titulo: 'Activa la aprobación antes de invitar',
      explicacion:
        'Con «Exige aprobación antes de invitar», cada invitación a un tercero de este tipo se retiene: el correo y el enlace no salen hasta que otra persona la apruebe. ' +
        'Quien la pidió no puede aprobarla, y el tercero no ve el vínculo mientras tanto.',
      resaltar: panel.getByRole('checkbox', { name: /Exige aprobación antes de invitar/ }),
      configuracion: {
        ajuste: 'Exige aprobación antes de invitar (por tipo de vínculo)',
        ruta: 'Configuración › Tipos de vínculo (/tipos-vinculo)',
        efecto: 'Las invitaciones nuevas de este tipo esperan una aprobación; las ya enviadas no cambian.',
      },
    });

    // 2. Quién aprueba: un rol o un área.
    await panel.getByRole('radio', { name: 'Un rol' }).check();
    await panel.getByRole('combobox', { name: 'Rol que aprueba' }).click();
    await app.getByRole('option', { name: 'Oficial de cumplimiento' }).click();
    await paso(page, {
      titulo: 'Elige quién aprueba',
      explicacion:
        '«Quién aprueba» puede ser un rol de la empresa o un área. Con un rol, cualquier persona con ese rol que no haya pedido la invitación puede aprobarla. ' +
        'Con un área, se busca el área con ese código en la empresa de cada vínculo: si una empresa no la tiene, no podrá invitar con este tipo.',
      resaltar: [panel.getByRole('radiogroup', { name: 'Quién aprueba' }), panel.getByRole('combobox', { name: 'Rol que aprueba' })],
      variantes: [
        { cuando: 'Eliges «Un área»', entonces: 'Aparecen las áreas de la empresa activa; si no hay ninguna, se pide crearlas en Configuración › Áreas.' },
        { cuando: 'No eliges quién aprueba', entonces: 'No se puede guardar: «Indica quién aprueba las invitaciones».' },
      ],
    });

    await panel.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(app.getByRole('row', { name: /Proveedor/ }).getByText(/aprobación/i).first()).toBeVisible();

    // 3. Una invitación por lote queda por aprobar.
    await app.getByRole('link', { name: 'Vínculos' }).first().click();
    await app.getByRole('button', { name: 'Invitar por lote' }).click();
    await app.getByRole('button', { name: 'Nuevo lote' }).click();
    await app.locator('input[type="file"]').setInputFiles({ name: 'lote.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV(persona), 'utf8') });
    await expect(app.getByText(/2 filas: 2 válidas/)).toBeVisible();
    await app.getByLabel('Nombre del lote').fill('Proveedores que esperan aprobación');
    await paso(page, {
      titulo: 'Invita a un lote con el tipo que exige aprobación',
      explicacion:
        'El lote se crea, pero ninguna fila se procesa todavía. Como el tipo PROVEEDOR exige aprobación, el lote nace «Por aprobar»: el aviso dice que no se envía ninguna invitación hasta que otra persona lo apruebe o lo rechace. ' +
        'Quien crea el lote no puede aprobarlo.',
      resaltar: app.getByRole('button', { name: /^Invitar a 2 terceros$/ }),
      variantes: [{ cuando: 'El lote solo tiene tipos que no exigen aprobación', entonces: 'El lote empieza a enviar las invitaciones de inmediato, como siempre.' }],
    });
    await app.getByRole('button', { name: /^Invitar a 2 terceros$/ }).click();
    await expect(app.getByText('Lote creado: espera la aprobación de otra persona antes de enviar las invitaciones.')).toBeVisible();
    await paso(page, {
      titulo: 'Comprueba que el lote espera aprobación',
      explicacion:
        'El lote aparece como «Por aprobar» y el correo no ha salido a ningún tercero. La decisión la toma otra persona de las que aprueban este tipo, desde «Invitaciones por aprobar».',
      resaltar: app.getByText('Lote creado: espera la aprobación de otra persona antes de enviar las invitaciones.'),
      avisos: true,
    });
  },
);
