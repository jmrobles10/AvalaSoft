import { entrarPorInvitacion, aceptarInvitacion } from '../../soporte/proveedor';
import { crearEscenario, invitar, nuevoTercero } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';

recorrido(
  {
    dominio: 'tercero',
    actor: 'Tercero',
    titulo: 'Agrega a su representante legal como persona relacionada',
    resumen:
      'El proveedor abre «Personas relacionadas», ve que aún no tiene a nadie, y agrega a su representante legal con su número de documento. Cada persona tiene su propia bóveda: su cédula se sube una vez y sirve a todas las empresas con las que trabaja.',
    precondiciones: [
      'Un grupo con Constructora Norte, que invitó a un proveedor jurídico. El proveedor aceptó la invitación.',
      'El proveedor no tiene personas relacionadas todavía.',
    ],
    relacionados: ['tercero/declaracion-pep-personas-relacionadas', 'tercero/aceptar-invitacion-persona-juridica'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    const tercero = nuevoTercero('Aceros del Norte S.A.S.');
    const invitacion = await invitar(e, e.norte, tercero, 'PROVEEDOR');
    await entrarPorInvitacion(page, invitacion);
    await aceptarInvitacion(page, invitacion);

    await page.goto('/personas');
    await expect(page.getByRole('heading', { level: 1, name: 'Personas relacionadas' })).toBeVisible();
    await expect(page.getByText('Aún no hay personas relacionadas')).toBeVisible();
    await paso(page, {
      titulo: 'Abre tus personas relacionadas',
      explicacion:
        'Aquí están las personas que representan a tu empresa o son sus socios y beneficiarios finales. Cada una tiene su propia bóveda: su cédula se valida una vez y sirve a todas las empresas con las que trabajas. ' +
        'Algunas aparecen solas, a partir de tu información legal; otras las agregas aquí.',
      resaltar: page.getByRole('button', { name: 'Agregar persona' }),
      configuracion: {
        ajuste: 'Información legal (de donde salen las personas)',
        ruta: 'Mi información › Información legal (/ficha)',
        efecto: 'Lo que declaras como representante o socio en tu información legal alimenta esta lista.',
      },
    });

    await page.getByRole('button', { name: 'Agregar persona' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Agregar una persona relacionada' });
    await dialogo.getByRole('combobox', { name: 'Cómo se relaciona' }).click();
    await page.getByRole('option', { name: 'Representante legal', exact: true }).click();
    await dialogo.getByRole('textbox', { name: 'Nombre completo' }).fill('Marta Lucía Ríos Duarte');
    await dialogo.getByRole('textbox', { name: 'Número de documento' }).fill('1020304050');
    await paso(page, {
      titulo: 'Escribe quién es y cómo se relaciona',
      explicacion:
        'Elige cómo se relaciona con tu empresa (representante legal, suplente, socio, beneficiario final o miembro del consorcio), su nombre y su documento. ' +
        'Si la persona ya tiene bóveda por otra empresa, se reutiliza: no vuelve a empezar.',
      resaltar: dialogo,
      variantes: [
        { cuando: 'Ya hay un representante legal principal', entonces: 'Puedes marcar esta persona como «Principal» solo si es la que piden las empresas para su tipo.' },
      ],
    });

    await dialogo.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.getByText('Agregamos a Marta Lucía Ríos Duarte como Representante legal.')).toBeVisible();
    await paso(page, {
      titulo: 'Comprueba que la persona quedó agregada',
      explicacion:
        'La persona aparece en su grupo, con su documento y su estado. Sus documentos se cargan en su propia bóveda; las empresas que lo piden se los solicitan a ella por esta relación.',
      resaltar: page.getByText('Marta Lucía Ríos Duarte').first(),
      avisos: true,
    });
  },
);
