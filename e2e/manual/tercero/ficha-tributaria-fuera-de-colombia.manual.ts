import { abrirSeccion, elegirOpcion, guardarSeccionCompleta } from '../../soporte/ficha';
import { abrirEmpresa, aceptarInvitacion, entrarPorInvitacion, esperarEstadoDelTercero, fraseDeEstado } from '../../soporte/proveedor';
import { crearEscenario, invitar, nuevoTercero, type Tercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { areaDe, publicarFlujoPorDefecto } from '../nucleo/semillas';

recorrido(
  {
    dominio: 'tercero',
    actor: 'Tercero',
    titulo: 'Llena la información tributaria fuera de Colombia',
    resumen:
      'Una empresa invita a una sociedad panameña con su RUC. Como su identificación no es colombiana, «Información tributaria» no pide la casilla 53 del RUT ni el ICA: ' +
      'pide su régimen, si es contribuyente del ITBMS y su exención, con las preguntas de su país. La general le pide el dígito de verificación de su RUC, que ella declara.',
    precondiciones: [
      'Un grupo empresarial con la empresa «Constructora Sur S.A.S.» y un flujo de proveedores por defecto que pide la información general y la tributaria.',
      'Una sociedad panameña invitada como proveedora por el sistema integrado, con su RUC panameño (el correo de invitación ya llegó).',
    ],
    relacionados: ['tercero/aceptar-invitacion-persona-juridica', 'tercero/ficha-secciones-con-soporte'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    await publicarFlujoPorDefecto(e, e.sur, areaDe(e.sur, 'revision'), 'PROVEEDOR_PANAMA', 'PROVEEDOR', [{ seccion: 'FICHA_GENERAL' }, { seccion: 'FICHA_TRIBUTARIA' }]);
    const base = nuevoTercero('Comercial del Istmo S.A.');
    // RUC único por corrida: uno fijo ya existe en la base y su correo nuevo entraría con acceso aislado.
    const folio = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    const tercero: Tercero = { ...base, identificacion: { pais: 'PA', tipo: 'RUC', numero: `155${folio}-2-2019`, digitoVerificacion: null } };
    const invitacion = await invitar(e, e.sur, tercero);

    // 1. Entrar y aceptar la invitación.
    await entrarPorInvitacion(page, invitacion);
    await aceptarInvitacion(page, invitacion);
    await expect(fraseDeEstado(page, 'Abierto')).toBeVisible();
    await paso(page, {
      titulo: 'Acepta la invitación con tu RUC panameño',
      explicacion:
        'La invitación funciona igual que en Colombia: aceptas los textos legales y ves lo que te pide la empresa. Tu identificación es un RUC de Panamá, así que AvalaSoft aplica las reglas de tu país: ' +
        'la ficha pide el dígito de verificación de tu RUC y la información tributaria con las preguntas de tu país, no las de la DIAN.',
      resaltar: fraseDeEstado(page, 'Abierto'),
      variantes: [
        { cuando: 'Tu identificación es un RNC de República Dominicana', entonces: 'El formulario tributario es el mismo, pero nombra el impuesto de tu país (ITBIS) y pide su régimen.' },
        { cuando: 'Tu identificación es colombiana (NIT)', entonces: 'La información tributaria pide la casilla 53 del RUT y el ICA, como siempre.' },
      ],
    });

    // 2. Mi información: se llega desde la empresa, como en la pantalla de la invitación.
    await abrirEmpresa(page, e.sur.nombre);

    // 3. Información general con el DV declarado y el domicilio en Panamá.
    await abrirSeccion(page, 'general', 'Información general');
    await expect(page.getByRole('textbox', { name: 'Razón social', exact: true })).toHaveValue(tercero.nombre);
    await paso(page, {
      titulo: 'Entra a «Mi información» con tu RUC',
      explicacion:
        '«Mi información» es tu ficha, una sola para todas las empresas con las que te relacionas. Tu perfil tributario se define por el país de tu identificación: por eso verás las secciones que tu empresa pidió y no las de Colombia. ' +
        'La razón social llega prellenada con lo que la empresa registró al invitarte, y la información general y la tributaria son las que pide esta invitación.',
      resaltar: page.getByRole('textbox', { name: 'Razón social', exact: true }),
    });
    await page.getByRole('textbox', { name: 'Teléfono', exact: true }).fill('+507 555 1234');
    await elegirOpcion(page, 'País', 'Panamá', /^Panamá/);
    await page.getByRole('textbox', { name: 'Dirección', exact: true }).fill('Calle 50, Edificio Torre Istmo, Ciudad de Panamá');
    await elegirOpcion(page, 'Actividad económica principal (CIIU)', '4663', /^4663/);
    await page.getByRole('textbox', { name: 'Año de inicio de actividades' }).fill('2010');
    await page.getByRole('radiogroup', { name: '¿Tienes certificado ISO?' }).getByRole('radio', { name: 'No' }).check();
    const dv = page.getByRole('textbox', { name: /^Dígito de verificación/ });
    await dv.fill('56');
    await expect(page.getByText('Son 2 dígitos y figuran junto a tu RUC.')).toBeVisible();
    await paso(page, {
      titulo: 'Declara el dígito de verificación de tu RUC',
      explicacion:
        'Tu RUC panameño trae su dígito de verificación (DV), de 2 dígitos, que figura junto al RUC en tu certificado de la DGI. Lo escribes tú: AvalaSoft no lo calcula para RUC de Panamá, y ' +
        'el DV viaja con tu información a la empresa tal como lo declaraste. Los demás datos de contacto y domicilio se llenan como siempre.',
      resaltar: dv,
      variantes: [{ cuando: 'Dejas el DV vacío', entonces: 'La sección no se puede guardar: el DV es obligatorio para tu RUC.' }],
    });
    await guardarSeccionCompleta(page, 'Guardaste Información general: está completa.');

    // 4. Información tributaria genérica.
    await abrirSeccion(page, 'tributaria', 'Información tributaria');
    await expect(page.getByRole('combobox', { name: 'Responsabilidades (casilla 53 del RUT)' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Régimen tributario' }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('radiogroup', { name: '¿Eres contribuyente de ITBMS?' }).getByRole('radio', { name: 'Sí' }).check();
    await page.getByRole('radiogroup', { name: '¿Eres agente de retención?' }).getByRole('radio', { name: 'No' }).check();
    await page.getByRole('radiogroup', { name: '¿Estás exento de retenciones?' }).getByRole('radio', { name: 'No' }).check();
    await page.getByRole('radiogroup', { name: '¿Emites facturas o comprobantes fiscales electrónicos?' }).getByRole('radio', { name: 'Sí' }).check();
    await paso(page, {
      titulo: 'Completa la información tributaria de tu país',
      explicacion:
        'No hay casilla 53 ni ICA: el formulario trae tu régimen tributario, la pregunta sobre el ITBMS (el impuesto a las ventas de Panamá), si eres agente de retención, si estás exento de retenciones y si emites comprobantes electrónicos. ' +
        'Si respondes «Sí» a estar exento, pide el número y la fecha de tu certificado de exención.',
      resaltar: [
        page.getByRole('combobox', { name: 'Régimen tributario' }),
        page.getByRole('radiogroup', { name: '¿Eres contribuyente de ITBMS?' }),
      ],
      variantes: [
        { cuando: 'Estás exento de retenciones con «Sí»', entonces: 'Aparecen el número y la fecha del certificado de exención, obligatorios.' },
        { cuando: 'Eres persona de República Dominicana', entonces: 'La pregunta nombra el ITBIS y el régimen es el de tu país.' },
      ],
      configuracion: {
        ajuste: 'Régimen y preguntas tributarias por país',
        ruta: 'Configuración › Tipos de vínculo y flujos (/flujos)',
        efecto: 'El país de la identificación del tercero define el formulario; Colombia conserva la casilla 53 y el ICA.',
      },
    });
    await guardarSeccionCompleta(page, 'Guardaste Información tributaria: está completa.');

    // 5. En revisión.
    await esperarEstadoDelTercero(page, 'EnRevision');
    await paso(page, {
      titulo: 'Espera la revisión de la empresa',
      explicacion:
        'Con la información general y la tributaria guardadas, el expediente pasa solo a revisión. La empresa revisa tu información con la tributaria de tu país; no le llega la casilla 53 ni el ICA, porque tu RUC no es colombiano.',
      resaltar: fraseDeEstado(page, 'EnRevision'),
    });
  },
);
