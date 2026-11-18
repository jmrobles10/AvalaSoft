import { pdf } from '../../soporte/archivos';
import { abrirEmbebido } from '../../soporte/embebido';
import { completarInvitacion } from '../../soporte/proveedor';
import { crearEscenario, expedienteAbierto, invitar, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { abrirHistorial, irASector, tarjeta } from '../nucleo/ficha';

const RUT = 'Registro Único Tributario';
const CAMARA = 'Certificado de existencia y representación legal';

recorrido(
  {
    dominio: 'vinculos',
    actor: 'Administrador de empresa',
    titulo: 'Recorre la ficha del vínculo por sectores',
    resumen:
      'La administradora abre la ficha de un proveedor que ya aceptó la invitación y tiene su expediente abierto. Recorre la barra de sectores: lo que pide el expediente y lo que declaró el tercero, sus contactos, lo que aceptó con el texto exacto, el cumplimiento y el historial.',
    precondiciones: [
      'Un grupo con Constructora Norte, su flujo de Proveedor por defecto y una administradora.',
      'Un proveedor que aceptó la invitación, subió su RUT y su Cámara, y tiene el expediente abierto.',
    ],
    relacionados: ['vinculos/detalle-del-vinculo', 'revision/historial-del-expediente'],
  },
  async ({ page, browser }) => {
    // Siembra: el proveedor acepta la invitación y sube sus documentos; el expediente queda abierto.
    const e = await crearEscenario();
    const tercero = nuevoTercero('Aceros del Norte S.A.S.');
    const invitacion = await invitar(e, e.norte, tercero, 'PROVEEDOR');
    await completarInvitacion(await (await browser.newContext()).newPage(), invitacion, [
      { nombre: RUT, archivo: pdf('RUT ficha por sectores') },
      { nombre: CAMARA, archivo: pdf('Camara ficha por sectores') },
    ]);
    await expedienteAbierto(e, invitacion);

    const app = await abrirEmbebido(page, e, e.ana, e.norte, `vinculos/${invitacion.vinculoId}`);
    await expect(app.getByRole('heading', { level: 1, name: tercero.nombre })).toBeVisible();

    // 1) La barra de sectores: tres grupos y, en cada sector, cuántos requisitos siguen pendientes.
    const barra = app.getByRole('navigation', { name: 'Sectores de la ficha' });
    await expect(barra.getByText('Proceso', { exact: true })).toBeVisible();
    await expect(barra.getByText('Información', { exact: true })).toBeVisible();
    await expect(barra.getByText('Registro', { exact: true })).toBeVisible();
    await expect(barra.getByRole('button', { name: /^Aprobaciones: \d+ pendientes?$/ })).toBeVisible();
    await paso(page, {
      titulo: 'Lee la barra de sectores de la ficha',
      explicacion:
        'La ficha del vínculo se recorre por sectores, como la ficha del tercero del SRM. La barra tiene tres grupos: «Proceso» con las aprobaciones, «Información» con lo que pide el expediente y lo que declaró el tercero, y «Registro» con los documentos, la evaluación, el certificado y el historial. ' +
        'El número junto a cada sector son los requisitos que siguen pendientes; en rojo o en ámbar, si alguno está observado o rechazado. El sector abierto va marcado a la izquierda.',
      resaltar: barra,
      configuracion: {
        ajuste: 'Requisitos del flujo de cada tipo de vínculo',
        ruta: 'Configuración › Flujos aprobatorios (/flujos)',
        efecto: 'Cada requisito aparece en el sector que le corresponde y suma en su contador.',
      },
    });

    // 2) Un sector de Información: lo que pide el expediente y lo que declaró el tercero.
    await irASector(app, 'Información tributaria');
    const tributaria = app.getByRole('region', { name: 'Información tributaria' });
    await expect(tributaria.getByText('Lo que pide el expediente', { exact: true })).toBeVisible();
    await expect(tributaria.getByText('El tercero no ha llenado nada de este sector', { exact: true })).toBeVisible();
    await paso(page, {
      titulo: 'Revisa lo que pide el expediente en Información tributaria',
      explicacion:
        'Cada requisito aparece en el sector al que pertenece: el RUT va en «Información tributaria», no en la lista general. La tarjeta «Lo que pide el expediente» dice qué falta, qué está en revisión y qué respalda cada requisito. ' +
        'Debajo, «Lo que declaró el tercero» muestra lo que llenó en esta sección; si no ha llenado nada, lo dice.',
      resaltar: [tributaria.getByText('Lo que pide el expediente', { exact: true }), tributaria.getByText(RUT).first()],
      variantes: [
        { cuando: 'El requisito está observado o rechazado', entonces: 'La tarjeta del requisito muestra un solo aviso con lo que corregir, y el sector se marca en advertencia.' },
      ],
    });

    // 3) Datos de contacto: el correo del vínculo, lo declarado y los contactos.
    await irASector(app, 'Datos de contacto');
    const contacto = tarjeta(app, 'Contacto del tercero');
    await expect(contacto).toBeVisible();
    await paso(page, {
      titulo: 'Revisa los datos de contacto del tercero',
      explicacion:
        'En «Contacto del tercero» está el correo del vínculo, al que llegan las invitaciones y los avisos, con su verificación, y los datos de contacto que declaró el tercero: correo, teléfono y dirección. ' +
        'Debajo están los contactos de la empresa para esta relación. Si el correo del vínculo no está verificado, lo dice: nada prueba todavía que sea del tercero.',
      resaltar: contacto,
    });

    // 4) Autorización y declaración: lo que aceptó, con el texto exacto que se abre con «Ver».
    await irASector(app, 'Autorización y declaración');
    const aceptaciones = tarjeta(app, 'Lo que aceptó el tercero');
    await expect(aceptaciones.getByRole('button', { name: /^Ver / }).first()).toBeVisible();
    await paso(page, {
      titulo: 'Revisa lo que aceptó el tercero',
      explicacion:
        '«Lo que aceptó el tercero» lista los textos que aceptó al entrar: la autorización de tratamiento de datos, los términos de la empresa y el aviso de la plataforma. Cada uno dice su versión y la fecha, y si lo confirmó con un código enviado a su correo. ' +
        'El botón «Ver» abre el texto exacto que aceptó, aunque ya exista una versión más nueva.',
      resaltar: aceptaciones,
      variantes: [{ cuando: 'El tercero aún no aceptó los textos legales', entonces: 'La tarjeta dice que el tercero no ha aceptado nada y explica dónde quedará lo que acepte.' }],
    });

    await aceptaciones.getByRole('button', { name: /^Ver / }).first().click();
    const texto = app.getByRole('dialog');
    await expect(texto).toBeVisible();
    await paso(page, {
      titulo: 'Abre el texto que aceptó el tercero',
      explicacion:
        'El diálogo muestra el texto tal como lo aceptó el tercero, con su versión y la fecha de publicación. Sirve como evidencia de qué se autorizó, aunque después se haya publicado otra versión del texto. ' +
        'Ciérralo con «Cerrar»; no cambia nada del vínculo.',
      resaltar: texto,
    });
    await texto.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(texto).toBeHidden();

    // 5) Oficial de cumplimiento: las verificaciones de listas y del estudio.
    await irASector(app, 'Oficial de cumplimiento');
    const cumplimiento = tarjeta(app, 'Verificaciones de cumplimiento');
    await expect(cumplimiento).toBeVisible();
    await paso(page, {
      titulo: 'Revisa las verificaciones de cumplimiento',
      explicacion:
        'El sector «Oficial de cumplimiento» reúne las verificaciones de listas restrictivas y el estudio de cumplimiento del expediente, o las del último expediente que las tuvo. ' +
        'Más abajo, lo que el tercero declaró sobre cumplimiento (por ejemplo, el beneficiario final o el formulario SARLAFT). Las coincidencias se analizan en el módulo de cumplimiento, no aquí.',
      resaltar: cumplimiento,
    });

    // 6) El historial: un panel lateral desde el encabezado, con una pestaña por expediente y otra del vínculo.
    const panel = await abrirHistorial(app);
    await expect(app.getByRole('tab', { name: /^Expediente / })).toBeVisible();
    await expect(app.getByRole('tab', { name: 'Vínculo', exact: true })).toBeVisible();
    await paso(page, {
      titulo: 'Abre el historial desde el encabezado',
      explicacion:
        'El botón «Historial» del encabezado abre un panel a la derecha, desde cualquier sector. Tiene dos pestañas: la del expediente que se revisa, con su folio, y la del vínculo. ' +
        'Así no tienes que cambiar de sector para ver qué pasó mientras estabas en otra parte de la ficha.',
      resaltar: panel,
    });
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();

    // 7) El mismo historial como sector: la página completa, para leerlo sin el panel.
    await irASector(app, 'Historial');
    const historial = tarjeta(app, 'Historial');
    await expect(historial.getByRole('tab', { name: 'Vínculo', exact: true })).toBeVisible();
    await paso(page, {
      titulo: 'Lee el historial como sector de la ficha',
      explicacion:
        'El sector «Historial» de la barra (en el grupo «Registro») muestra la misma línea de tiempo en la página completa, con las mismas pestañas. Ahí se lee cuando hace falta revisar muchos eventos seguidos, y el botón del encabezado no aparece porque ya está abierto.',
      resaltar: historial,
    });
  },
);
