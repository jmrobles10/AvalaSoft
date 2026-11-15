import { abrirConsolaDePlataforma } from '../../soporte/plataforma';
import { abrirEmbebido } from '../../soporte/embebido';
import { crearEscenario, invitar, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';

recorrido(
  {
    dominio: 'acceso',
    actor: 'Plataforma',
    titulo: 'Verifica un contacto y decide la cola de accesos a terceros',
    resumen:
      'Un correo que no es contacto de un tercero sin contactos verificados pide acceso. Nadie de su lado puede decidir, así que la solicitud llega a la cola de Plataforma. El operador revisa la evidencia, verifica el correo del RUT o de la Cámara y la decisión vuelve a los contactos del tercero.',
    precondiciones: [
      'Un grupo con Constructora Norte y Constructora Sur, cada una con su flujo de proveedores.',
      'Un tercero que Norte invitó con un correo, sin contactos verificados, y que Sur invita después con otro correo.',
    ],
    relacionados: ['vinculos/detalle-del-vinculo', 'tercero/aceptar-invitacion-persona-juridica'],
  },
  async ({ page, browser }) => {
    const e = await crearEscenario();
    const primero = nuevoTercero('Aceros Sin Verificar S.A.S.');
    await invitar(e, e.norte, primero);
    const extrano = { ...primero, correo: `otro.${primero.identificacion.numero}@e2e.validasoft.co` };
    const invitacionSur = await invitar(e, e.sur, extrano);

    const consola = await abrirConsolaDePlataforma(page);
    await consola.getByRole('link', { name: 'Accesos a terceros', exact: true }).click();
    await expect(consola.getByRole('heading', { level: 1, name: 'Solicitudes de acceso a terceros' })).toBeVisible();
    const tarjeta = consola.getByRole('listitem', { name: extrano.correo });
    await expect(tarjeta).toBeVisible();

    await paso(page, {
      titulo: 'Abre las solicitudes en cola',
      explicacion:
        'La cola reúne las solicitudes que nadie del tercero puede decidir: su correo no es contacto y el tercero no tiene ningún contacto verificado. ' +
        'Cada tarjeta muestra el tercero con su identificación, la fecha en que pidió acceso y la lista de solicitudes con su estado. Ninguna se decide sola: la decides tú o verificas un contacto.',
      resaltar: consola.getByRole('list', { name: 'Solicitudes de acceso' }),
      variantes: [
        {
          cuando: 'El tercero tiene un contacto verificado',
          entonces: 'La solicitud no llega a la cola: la decide ese contacto desde su portal y la consola solo la muestra en «Pendientes».',
        },
      ],
    });

    await expect(tarjeta.getByRole('region', { name: 'Empresas que invitaron a ese correo' })).toContainText('Constructora Sur');
    await expect(tarjeta.getByRole('region', { name: 'Contactos del tercero' })).toContainText('Sin verificar');
    await paso(page, {
      titulo: 'Revisa la evidencia antes de decidir',
      explicacion:
        'La tarjeta lista las empresas que invitaron a ese correo y los contactos del tercero con su verificación: «Verificado», «Sin verificar» o «En acceso aislado». ' +
        'Si el RUT o la Cámara de comercio del tercero traen un correo oficial, se muestra con la versión y quién lo subió. Ese correo solo verifica a un contacto si lo respalda alguien que no es el propio candidato.',
      resaltar: [tarjeta.getByRole('region', { name: 'Empresas que invitaron a ese correo' }), tarjeta.getByRole('region', { name: 'Contactos del tercero' })],
      configuracion: {
        ajuste: 'Verificación de un contacto',
        ruta: 'Plataforma › Accesos a terceros (/plataforma/accesos-a-terceros)',
        efecto: 'Verificar un contacto lo convierte en contacto verificado por la plataforma: desde entonces decide los accesos de otros correos.',
      },
    });

    await tarjeta.getByRole('button', { name: `Verificar el correo ${primero.correo}` }).click();
    await expect(consola.getByText(`Verificaste el correo ${primero.correo}.`, { exact: true })).toBeVisible();
    await consola.getByRole('button', { name: 'Pendientes', exact: true }).click();
    const pendiente = consola.getByRole('listitem', { name: extrano.correo });
    await expect(pendiente).toContainText('Esta solicitud la decide un contacto verificado del tercero.');
    await paso(page, {
      titulo: 'Verifica el correo del contacto',
      explicacion:
        'Al verificar el correo del primer contacto, la plataforma lo deja como contacto verificado por la plataforma. La solicitud sale de la cola y pasa a «Pendientes»: ahora la decide ese contacto desde su portal. ' +
        'Desde la consola no puedes aprobar ni rechazar mientras haya un contacto verificado; la decisión queda en manos del tercero y su historial.',
      resaltar: pendiente,
    });

    // Lo que ve la empresa que invitó al correo nuevo: el chip de verificación en el detalle del vínculo.
    const ventana = await (await browser.newContext()).newPage();
    const empresa = await abrirEmbebido(ventana, e, e.ana, e.sur, `vinculos/${invitacionSur.vinculoId}`);
    await expect(empresa.getByText('Aún no es contacto', { exact: true })).toBeVisible();
    await paso(ventana, {
      titulo: 'Así lo ve la empresa que invitó al correo',
      explicacion:
        'En el detalle del vínculo, el correo invitado aparece como «Aún no es contacto»: entra con acceso aislado hasta que un contacto verificado, o la plataforma, lo apruebe. ' +
        'La empresa no ve la evidencia ni la bandeja de la plataforma; solo sabe en qué estado está su correo.',
      resaltar: empresa.getByText('Aún no es contacto', { exact: true }),
      variantes: [
        { cuando: 'El correo es contacto sin verificar', entonces: 'El chip dice «Sin verificar»: entra a lo suyo, pero no decide los accesos de otros correos.' },
        { cuando: 'El correo está verificado', entonces: 'El chip dice «Verificado» con su medio, como «verificado por la plataforma».' },
      ],
    });
  },
);
