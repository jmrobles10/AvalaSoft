import { abrirEmbebido } from '../../soporte/embebido';
import { crearEscenario } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';

const GRUPO = 'Revisores de tributaria';

recorrido(
  {
    dominio: 'configuracion',
    actor: 'Administrador de empresa',
    titulo: 'Crea un grupo de acceso y asígnalo a una persona',
    resumen:
      'La administradora crea el grupo «Revisores de tributaria» con tres permisos de revisión y un solo sector de la ficha, la información tributaria, y se lo asigna a Rubén desde Usuarios y roles. ' +
      'Así Rubén revisa la tributaria de los terceros y no puede decidir sobre el resto de la ficha.',
    precondiciones: [
      'Un grupo empresarial con Constructora Sur S.A.S., su área «Revisión» y las personas Ana (administradora), Rubén y Sofía.',
      'Una persona con el rol Administrador que entra a AvalaSoft desde el sistema integrado.',
    ],
    relacionados: ['configuracion/usuarios-y-roles', 'configuracion/responsable-por-sector'],
  },
  async ({ page, browser }) => {
    const e = await crearEscenario();
    const app = await abrirEmbebido(page, e, e.ana, e.sur, 'grupos-de-acceso');
    await expect(app.getByRole('heading', { level: 1, name: 'Grupos de acceso' })).toBeVisible();
    await expect(app.getByRole('table', { name: 'Grupos de acceso' })).toBeVisible();

    // 1. La lista: los cuatro roles fijos como predefinidos.
    await expect(app.getByRole('table', { name: 'Grupos de acceso' }).getByRole('row').filter({ hasText: 'Administrador' }).first()).toBeVisible();
    await paso(page, {
      titulo: 'Abre Configuración › Grupos de acceso',
      explicacion:
        'Un grupo de acceso reúne permisos y, si quieres, los sectores de la ficha que puede ver o decidir. La lista muestra los cuatro roles de siempre —Administrador, Revisor, Oficial de cumplimiento y Auditor— como grupos predefinidos: ' +
        'con su candado no se editan ni se desactivan. Los grupos propios aparecen debajo, con sus permisos, sus sectores y cuántas personas los tienen.',
      resaltar: app.getByRole('table', { name: 'Grupos de acceso' }),
      configuracion: {
        ajuste: 'Grupos de acceso',
        ruta: 'Configuración › Grupos de acceso (/grupos-de-acceso)',
        efecto: 'Lo que puede una persona es la suma de sus roles y de sus grupos activos.',
      },
      variantes: [{ cuando: 'Aún no hay grupos propios', entonces: 'La lista muestra solo los predefinidos y la invitación a crear el primer grupo.' }],
    });

    // 2. Nuevo grupo: código, nombre y permisos.
    await app.getByRole('button', { name: 'Nuevo grupo' }).click();
    const drawer = app.locator('[aria-labelledby="titulo-grupo"]');
    await expect(drawer.getByRole('heading', { name: 'Nuevo grupo de acceso' })).toBeVisible();
    await drawer.getByRole('textbox', { name: /^Código/ }).fill('REVISION_TRIBUTARIA');
    await drawer.getByRole('textbox', { name: /^Nombre/ }).fill(GRUPO);
    await drawer.getByRole('textbox', { name: /^Descripción/ }).fill('Revisa la información tributaria de los terceros.');
    await drawer.getByRole('checkbox', { name: /^Leer terceros/ }).check();
    await drawer.getByRole('checkbox', { name: /^Leer expedientes/ }).check();
    await drawer.getByRole('checkbox', { name: /^Revisar expedientes/ }).check();
    await expect(drawer.getByText('Marcados: 3.', { exact: false })).toBeVisible();
    await paso(page, {
      titulo: 'Dale un código, un nombre y los permisos que necesita',
      explicacion:
        'El código identifica al grupo, empieza con una letra, usa solo mayúsculas, números y guion bajo, y no se puede cambiar después. ' +
        'Los permisos están agrupados por módulo, igual que en las API keys: marca solo lo que el grupo necesita. Aquí «Leer terceros», «Leer expedientes» y «Revisar expedientes» (veredictos) bastan para revisar.',
      resaltar: [drawer.getByRole('textbox', { name: /^Código/ }), drawer.getByRole('checkbox', { name: /^Revisar expedientes/ })],
      variantes: [
        { cuando: 'No marcas ningún permiso', entonces: 'El botón «Crear grupo» no deja guardar: pide elegir al menos un permiso.' },
        { cuando: 'El código ya existe', entonces: 'El campo se marca en rojo con la razón.' },
      ],
    });

    // 3. Sectores: solo la información tributaria, para revisar.
    await drawer.getByRole('checkbox', { name: 'Información tributaria', exact: true }).check();
    await drawer.getByRole('combobox', { name: 'Qué puede hacer en Información tributaria' }).click();
    await app.getByRole('option', { name: 'Ver y decidir', exact: true }).click();
    await expect(drawer.getByRole('combobox', { name: 'Qué puede hacer en Información tributaria' })).toContainText('Ver y decidir');
    await paso(page, {
      titulo: 'Acota el grupo a un sector de la ficha',
      explicacion:
        'Sin sectores marcados, el grupo vale para todos. Al marcar «Información tributaria», los permisos que miran la ficha por secciones solo valen para esa sección: el grupo ve y decide sobre la tributaria y no sobre la general, la financiera o las demás. ' +
        '«Ver» solo lee la sección; «Ver y decidir» además permite el veredicto, la observación o la exención.',
      resaltar: [
        drawer.getByRole('checkbox', { name: 'Información tributaria', exact: true }),
        drawer.getByRole('combobox', { name: 'Qué puede hacer en Información tributaria' }),
      ],
      configuracion: {
        ajuste: 'Sectores de la ficha del grupo',
        ruta: 'Configuración › Grupos de acceso (/grupos-de-acceso)',
        efecto: 'Un grupo acotado no ve ni decide sobre las secciones que no marcó; el servidor lo exige en cada consulta.',
      },
    });

    // 4. Crear el grupo.
    await drawer.getByRole('button', { name: 'Crear grupo' }).click();
    await expect(app.getByRole('table', { name: 'Grupos de acceso' }).getByText(GRUPO)).toBeVisible();
    await paso(page, {
      titulo: 'Revisa el grupo en la lista',
      explicacion:
        'El grupo aparece en la lista con sus tres permisos, el sector «Información tributaria» y «0» personas. Queda en la auditoría de configuración. ' +
        'Desactivarlo después no quita las asignaciones: quienes lo tienen dejan de recibir sus permisos desde su siguiente ingreso, y se conservan por si lo reactivas.',
      resaltar: app.getByRole('table', { name: 'Grupos de acceso' }).getByRole('row').filter({ hasText: GRUPO }),
      avisos: true,
    });

    // 5. Asignarlo a una persona desde Usuarios y roles.
    const paginaUsuarios = await browser.newPage();
    const usuarios = await abrirEmbebido(paginaUsuarios, e, e.ana, e.sur, 'usuarios');
    await expect(usuarios.getByRole('heading', { level: 1, name: 'Usuarios y roles' })).toBeVisible();
    await usuarios.getByRole('row').filter({ hasText: e.ruben.nombre }).getByRole('button', { name: `Acciones de ${e.ruben.nombre}` }).click();
    await usuarios.getByRole('menuitem', { name: 'Editar roles' }).click();
    const panel = usuarios.locator('[aria-labelledby="titulo-roles"]');
    await expect(panel.getByRole('heading', { name: 'Editar roles' })).toBeVisible();
    await panel.getByRole('button', { name: 'Agregar grupo' }).click();
    await panel.getByRole('combobox', { name: 'Grupo', exact: true }).click();
    await usuarios.getByRole('option', { name: GRUPO, exact: true }).click();
    await paso(paginaUsuarios, {
      titulo: 'Asigna el grupo a una persona',
      explicacion:
        'En el panel «Editar roles» de la persona, «Grupos de acceso» lista los grupos propios del grupo empresarial. Agregar un grupo y elegirlo lo suma a sus roles: no reemplaza los que ya tiene. ' +
        'Un grupo puede darse para todo el grupo o para una empresa; aquí Rubén lo recibe en la empresa por omisión.',
      resaltar: panel.getByRole('combobox', { name: 'Grupo', exact: true }),
      variantes: [
        { cuando: 'El grupo está desactivado', entonces: 'Aparece marcado «(desactivado)» y no se puede asignar de nuevo.' },
        { cuando: 'Quieres quitar el grupo', entonces: 'La X de la fila lo quita sin tocar sus roles.' },
      ],
    });

    // 6. Guardar la asignación.
    await panel.getByRole('button', { name: 'Guardar roles' }).click();
    await expect(usuarios.getByRole('row').filter({ hasText: e.ruben.nombre }).getByText(GRUPO)).toBeVisible();
    await paso(paginaUsuarios, {
      titulo: 'Confirma que la persona tiene el grupo',
      explicacion:
        'En la tabla, la fila de Rubén muestra el grupo «Revisores de tributaria» junto a sus roles. Desde su siguiente ingreso puede revisar la información tributaria de los expedientes y no el resto de la ficha.',
      resaltar: usuarios.getByRole('row').filter({ hasText: e.ruben.nombre }),
      avisos: true,
    });
  },
);
