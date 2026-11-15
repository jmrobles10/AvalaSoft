import { abrirEmbebido } from '../../soporte/embebido';
import { abrirConsolaDePlataforma } from '../../soporte/plataforma';
import { crearEscenario } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';

const CUENTA_DE_PRUEBA = 'token-de-prueba-1234';

recorrido(
  {
    dominio: 'plataforma',
    actor: 'Plataforma',
    titulo: 'Configura las fuentes oficiales RUES y DIAN de la plataforma',
    resumen:
      'El operador de Plataforma elige el proveedor predeterminado del RUES y de la DIAN y guarda la cuenta del registro mercantil. Las empresas consultan con esa cuenta sin verla ni cargar la suya, y la clave nunca vuelve a mostrarse.',
    precondiciones: ['Un operador de Plataforma con la consola abierta.', 'Una empresa del grupo Constructora Norte que pida el RUES en su flujo.'],
    relacionados: ['configuracion/fuentes-oficiales-de-la-empresa', 'revision/cotejo-con-fuentes-oficiales', 'plataforma/listas-restrictivas-de-la-plataforma'],
  },
  async ({ page, browser }) => {
    const e = await crearEscenario();

    const consola = await abrirConsolaDePlataforma(page);
    await consola.getByRole('link', { name: 'Fuentes oficiales', exact: true }).click();
    await expect(consola.getByRole('heading', { level: 1, name: 'Fuentes oficiales' })).toBeVisible();
    const rues = consola.getByRole('region', { name: 'Registro mercantil (RUES)' });
    await expect(rues).toBeVisible();

    await paso(page, {
      titulo: 'Abre las fuentes oficiales de la plataforma',
      explicacion:
        'Hay una tarjeta por fuente: el registro mercantil (RUES) y el estado del RUT (DIAN). Son cuentas de la plataforma: todas las empresas consultan con ellas. ' +
        'Cada fuente tiene un proveedor predeterminado y una cuenta por proveedor; si una fuente no tiene proveedor disponible, las empresas que la piden no pueden consultarla.',
      resaltar: [consola.getByRole('heading', { level: 1, name: 'Fuentes oficiales' }), rues],
      variantes: [
        { cuando: 'El proveedor no está habilitado en la instalación', entonces: 'La cuenta aparece como «No habilitado en la instalación» y ninguna empresa puede usarla todavía.' },
      ],
    });

    await rues.getByRole('combobox', { name: 'Proveedor predeterminado' }).click();
    await consola.getByRole('option', { name: 'Simulado (pruebas)', exact: true }).click();
    await expect(consola.getByText('Cuenta guardada.', { exact: true })).toBeVisible();
    await paso(page, {
      titulo: 'Elige el proveedor predeterminado del RUES',
      explicacion:
        'El predeterminado es el proveedor que usan las empresas que no eligen otro. Si queda en «El de la instalación», la plataforma usa el que la instalación tenga configurado. ' +
        'El proveedor simulado solo sirve para pruebas: devuelve lo declarado y no consulta ningún registro real.',
      resaltar: rues.getByRole('combobox', { name: 'Proveedor predeterminado' }),
      configuracion: {
        ajuste: 'Proveedor predeterminado del RUES',
        ruta: 'Plataforma › Fuentes oficiales (/plataforma/fuentes)',
        efecto: 'Las empresas que no elijan otro proveedor consultan el RUES con este.',
      },
    });

    const cuenta = rues.getByRole('region', { name: 'Cuenta de Datos abiertos de Confecámaras' });
    await cuenta.getByLabel('Clave o token').fill(CUENTA_DE_PRUEBA);
    await cuenta.getByRole('button', { name: 'Guardar cuenta' }).click();
    await expect(cuenta.getByText('Configurada · …1234', { exact: true })).toBeVisible();
    await expect(cuenta.getByLabel('Clave o token')).toHaveValue('');
    await paso(page, {
      titulo: 'Guarda la cuenta de datos abiertos',
      explicacion:
        'Los datos abiertos de Confecámaras funcionan sin cuenta; el token de la aplicación sube el límite de consultas. La clave se cifra con la clave maestra: al guardar, el campo queda vacío y la cuenta aparece como «Configurada» con los últimos cuatro caracteres. ' +
        'Dejar la clave vacía al editar conserva la actual.',
      resaltar: [cuenta.getByLabel('Clave o token'), cuenta.getByText('Configurada · …1234', { exact: true })],
      configuracion: {
        ajuste: 'Cuenta de datos abiertos del RUES',
        efecto: 'Quitarla deja sin cuenta a las empresas que consultan con ella hasta que se configure otra.',
      },
    });

    // Lo que ve una empresa del grupo: el proveedor que usa su expediente, sin ver la cuenta de la plataforma.
    const ventana = await (await browser.newContext()).newPage();
    const empresa = await abrirEmbebido(ventana, e, e.ana, e.norte, 'fuentes-oficiales');
    await expect(empresa.getByRole('heading', { level: 1, name: 'Fuentes oficiales' })).toBeVisible();
    const deLaEmpresa = empresa.getByRole('region', { name: 'Registro mercantil (RUES)' });
    await expect(deLaEmpresa).toContainText('Se consulta con Simulado (pruebas).');
    await paso(ventana, {
      titulo: 'Así la ve una empresa del grupo',
      explicacion:
        'La empresa ve que el RUES se consulta con el proveedor de la plataforma, y nada más: no pide ni muestra la cuenta de la plataforma. ' +
        'Si quiere usar una cuenta propia, la configura en su propia pantalla de Fuentes oficiales, y entonces manda la suya.',
      resaltar: deLaEmpresa.getByText('Se consulta con Simulado (pruebas).', { exact: true }),
      variantes: [
        {
          cuando: 'La plataforma no tiene proveedor disponible para la fuente',
          entonces: 'La empresa ve «No hay un proveedor disponible» y pedirle a Plataforma que habilite uno.',
        },
      ],
    });
  },
);
