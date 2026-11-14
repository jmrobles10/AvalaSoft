import { pdf } from '../../soporte/archivos';
import { abrirEmbebido } from '../../soporte/embebido';
import { abrirDesdeBandeja, aprobarArea } from '../../soporte/empresa';
import { abrirEmbebidoConLlave } from '../../soporte/derechos';
import { completarInvitacion } from '../../soporte/proveedor';
import { crearEscenario, invitar, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { llaveConEximir } from '../nucleo/semillas';

const RUT = 'Registro Único Tributario';
const CAMARA = 'Certificado de existencia y representación legal';

recorrido(
  {
    dominio: 'vinculos',
    actor: 'Administrador de empresa',
    titulo: 'Exime a un vínculo aprobado de una renovación',
    resumen:
      'Ana, administradora de Constructora Norte, exime a un proveedor aprobado de la renovación de su Cámara de comercio. Lo eximido no se avisa ni vence el vínculo, el expediente nuevo lo trae ya eximido y la exención se puede revocar con una justificación.',
    precondiciones: [
      'Un grupo con Constructora Norte, cuyo flujo de proveedores pide RUT y Cámara de comercio, y Ana como administradora.',
      'Un proveedor jurídico aprobado por las áreas de Norte (vínculo Activo).',
    ],
    relacionados: ['revision/eximir-un-documento', 'vinculos/detalle-del-vinculo', 'documentos/vencimientos'],
  },
  async ({ page, browser }) => {
    const e = await crearEscenario();
    const tercero = nuevoTercero('Aceros del Norte S.A.S.');
    const invitacion = await invitar(e, e.norte, tercero, 'PROVEEDOR');
    await completarInvitacion(page, invitacion, [
      { nombre: RUT, archivo: pdf('RUT') },
      { nombre: CAMARA, archivo: pdf('Camara') },
    ]);
    // Siembra: las dos áreas aprueban por la interfaz (la API exige la versión de cada documento).
    for (const [persona, area] of [
      [e.ruben, 'Compras'],
      [e.olga, 'Cumplimiento'],
    ] as const) {
      const pagina = await (await browser.newContext()).newPage();
      const app = await abrirEmbebido(pagina, e, persona, e.norte, 'bandeja');
      await abrirDesdeBandeja(app, tercero.nombre, area);
      await aprobarArea(app, area);
    }

    // La llave de la siembra no trae `vinculos:eximir`: la de esta prueba sí (como la que tendría el sistema de la empresa).
    const paginaAna = await (await browser.newContext()).newPage();
    const app = await abrirEmbebidoConLlave(paginaAna, e, await llaveConEximir(e), e.ana, e.norte, 'vinculos');
    await app.getByRole('row', { name: `Abrir vínculo de ${tercero.correo}` }).click();
    await expect(app.getByRole('heading', { level: 1 })).toBeVisible();
    // La tarjeta es una sección sin nombre accesible: se llega por su título.
    const tarjeta = app.locator('section').filter({ has: app.getByRole('heading', { name: 'Exenciones', exact: true }) });
    await expect(app.getByRole('heading', { name: 'Exenciones', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(tarjeta.getByText('Este vínculo no tiene exenciones.')).toBeVisible();
    await paso(paginaAna, {
      titulo: 'Abre las exenciones del vínculo aprobado',
      explicacion:
        'En el detalle del vínculo, la tarjeta «Exenciones» muestra las decisiones de la empresa para este tercero. Aquí no hay ninguna: el vínculo se rige por sus vigencias. ' +
        'La exención es privada de la empresa: el tercero y las demás empresas del grupo no la ven.',
      resaltar: tarjeta,
      variantes: [
        { cuando: 'Tu rol solo puede leer vínculos', entonces: 'El botón «Eximir» no aparece y la tarjeta es de solo lectura.' },
        { cuando: 'El vínculo no está aprobado', entonces: 'No se puede eximir: solo se exime un vínculo que ya fue aprobado.' },
      ],
      configuracion: {
        ajuste: 'Permiso «vinculos:eximir»',
        ruta: 'Configuración › Usuarios y roles (/usuarios)',
        efecto: 'Lo tienen el administrador y las llaves de API a las que se les marque al crearlas; ningún otro rol.',
      },
    });

    // 1) Eximir de un requisito concreto, con justificación.
    await tarjeta.getByRole('button', { name: 'Eximir', exact: true }).click();
    const dialogo = app.getByRole('dialog', { name: 'Eximir al vínculo' });
    await dialogo.getByLabel(CAMARA).check();
    await dialogo.getByRole('textbox', { name: /Justificación/ }).fill('Es persona jurídica inscrita en otro país: su Cámara no se renueva aquí.');
    await paso(paginaAna, {
      titulo: 'Elige de qué se exime y escribe la justificación',
      explicacion:
        'Puedes eximir de algunos requisitos (documentos o secciones de la ficha que elijas) o de todo, incluida la vigencia del vínculo. La justificación es obligatoria y es interna: no sale en el certificado ni la ve el tercero. ' +
        '«Hasta» es opcional: sin fecha, la exención rige hasta que la revoques.',
      resaltar: [dialogo.getByRole('radiogroup'), dialogo.getByRole('textbox', { name: /Justificación/ })],
      variantes: [{ cuando: 'Eliges «De todo»', entonces: 'La exención cubre todos los requisitos y la vigencia periódica, y el vínculo no vence mientras rija.' }],
    });

    await dialogo.getByRole('button', { name: 'Eximir', exact: true }).click();
    await expect(app.getByText('Vínculo eximido. Quedó en su historial.')).toBeVisible();
    await expect(app.getByText('Exento', { exact: true }).first()).toBeVisible();
    await paso(paginaAna, {
      titulo: 'Comprueba la exención en el vínculo',
      explicacion:
        'La tarjeta lista la exención como «Vigente» con quién la hizo y hasta cuándo rige. El detalle del vínculo muestra la insignia «Exento» junto a su estado. ' +
        'Mientras rija no sale ningún aviso de vencimiento de lo eximido, y los expedientes nuevos traen ese requisito ya eximido.',
      resaltar: [tarjeta, app.getByText('Exento', { exact: true }).first()],
      avisos: true,
    });

    // 2) Revocar: lo que venza mientras tanto vuelve a exigirse.
    await tarjeta.getByRole('button', { name: /^Revocar la exención de/ }).click();
    const revocacion = app.getByRole('dialog', { name: 'Revocar la exención' });
    await revocacion.getByRole('textbox', { name: 'Justificación' }).fill('La empresa vuelve a pedir la Cámara de comercio.');
    await paso(paginaAna, {
      titulo: 'Revoca la exención con una justificación',
      explicacion:
        'Revocar devuelve el vínculo a sus vigencias: a partir de ese momento el documento vuelve a vencer y a avisarse, y si ya venció mientras estuvo eximido, abre su renovación. Queda en el historial con tu nombre.',
      resaltar: revocacion,
    });
    await revocacion.getByRole('button', { name: 'Revocar exención' }).click();
    await expect(app.getByText('Exención revocada. El vínculo vuelve a regirse por sus vigencias.')).toBeVisible();
    await expect(tarjeta.getByText('Revocada', { exact: true }).first()).toBeVisible();
    await paso(paginaAna, {
      titulo: 'Confirma que la exención quedó revocada',
      explicacion:
        'La exención figura como «Revocada» con la justificación y la fecha. El historial del vínculo guarda la exención, su revocación y quién las hizo.',
      resaltar: tarjeta,
      avisos: true,
    });
  },
);
