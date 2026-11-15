import { abrirEmbebido } from '../../soporte/embebido';
import { crearEscenario } from '../../soporte/semilla';
import { expect, paso, recorrido } from '../nucleo';
import { usarProveedorSimuladoParaFuentes } from '../nucleo/semillas';

recorrido(
  {
    dominio: 'configuracion',
    actor: 'Administrador de empresa',
    titulo: 'Pide el RUES y la DIAN en el flujo de proveedores y revisa cómo se consultan',
    resumen:
      'La administradora agrega al flujo de proveedores el registro mercantil (RUES), como bloqueante, y el estado del RUT (DIAN), solo informativo. Después revisa con qué proveedor se consulta en su empresa y cada cuánto se reconsultan los vínculos activos.',
    precondiciones: [
      'Un grupo con la empresa «Constructora Sur S.A.S.», su área «Revisión» con miembros, y Constructora Norte con la configuración de fuentes oficiales.',
      'La plataforma tiene el proveedor simulado como predeterminado del RUES y de la DIAN.',
      'Una persona con el rol Administrador que entra a Validasoft desde el sistema integrado.',
    ],
    relacionados: ['plataforma/fuentes-oficiales', 'revision/cotejo-con-fuentes-oficiales', 'configuracion/flujo-verificaciones-de-cumplimiento'],
  },
  async ({ page }) => {
    const e = await crearEscenario();
    await usarProveedorSimuladoParaFuentes();

    // 1. El flujo pide las dos fuentes.
    const app = await abrirEmbebido(page, e, e.ana, e.sur, 'flujos');
    await expect(app.getByRole('heading', { level: 1, name: `Flujos aprobatorios de ${e.sur.nombre}` })).toBeVisible();
    await app.getByRole('button', { name: 'Nuevo flujo' }).click();
    await app.getByRole('textbox', { name: /^Código/ }).fill('PROV_FUENTES');
    await app.getByRole('textbox', { name: /^Nombre/ }).fill('Proveedores con RUES y DIAN');
    await app.getByRole('combobox', { name: /^Tipo de vínculo/ }).click();
    await app.getByRole('option', { name: 'Proveedor', exact: true }).click();
    await app.getByRole('region', { name: 'Etapa 1' }).getByRole('combobox', { name: 'Área' }).click();
    await app.getByRole('option', { name: /^Revisión/ }).click();

    const rues = app.getByRole('region', { name: 'Registro mercantil (RUES)', exact: true });
    const dian = app.getByRole('region', { name: 'Estado del RUT (DIAN)', exact: true });
    await rues.getByRole('checkbox', { name: /^Pedir/ }).check();
    await dian.getByRole('checkbox', { name: /^Pedir/ }).check();
    await paso(page, {
      titulo: 'Pide el RUES y la DIAN por tipo de vínculo',
      explicacion:
        'Cada fuente es una verificación del expediente. El RUES corrobora la razón social, el estado y la renovación de la matrícula, y el representante legal, contra la ficha y el certificado de Cámara. ' +
        'La DIAN corrobora el estado del RUT, la razón social, las responsabilidades y la dirección. Ambas se consultan solas al pasar el expediente a revisión; las diferencias son para el revisor.',
      resaltar: [rues.getByRole('checkbox', { name: /^Pedir/ }), dian.getByRole('checkbox', { name: /^Pedir/ })],
      configuracion: {
        ajuste: 'Verificaciones que pide el flujo',
        ruta: 'Configuración › Flujos aprobatorios (/flujos)',
        efecto: 'Se piden por tipo de vínculo: un flujo de clientes puede no pedir ninguna.',
      },
      variantes: [
        { cuando: 'Ninguna fuente marcada', entonces: 'El expediente no consulta el RUES ni la DIAN; se aprueba solo con las áreas.' },
        { cuando: 'El flujo es de clientes', entonces: 'Cada tipo de vínculo tiene su propio flujo: marcar aquí no pide nada en los demás.' },
      ],
    });

    // 2. Bloqueante o informativa, con su vigencia.
    await rues.getByRole('checkbox', { name: 'Bloquea la aprobación' }).check();
    await rues.getByLabel('Vigencia (días)').fill('60');
    await dian.getByRole('checkbox', { name: 'Bloquea la aprobación' }).uncheck();
    await paso(page, {
      titulo: 'Decide cuál bloquea y cuánto vale cada consulta',
      explicacion:
        'El RUES queda bloqueante: mientras su resultado no esté conforme y vigente, el expediente no se aprueba aunque aprueben todas las áreas. ' +
        'La DIAN queda informativa: se muestra al revisor, pero no frena la aprobación. «Vigencia (días)» dice cuánto vale una consulta; vacío son 30 días.',
      resaltar: [rues.getByRole('checkbox', { name: 'Bloquea la aprobación' }), rues.getByLabel('Vigencia (días)'), dian.getByRole('checkbox', { name: 'Bloquea la aprobación' })],
      variantes: [
        { cuando: 'La fuente no bloquea', entonces: 'Aparece como «Informativa»: si hay una diferencia o un fallo, el expediente igual puede aprobarse.' },
        { cuando: 'Un fallo del proveedor', entonces: 'Si es bloqueante, el expediente espera la verificación y se reintenta solo; nunca se aprueba en silencio.' },
      ],
    });

    await app.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(app.getByRole('button', { name: 'Publicar v1' })).toBeVisible();
    await paso(page, {
      titulo: 'Guarda el flujo en el borrador',
      explicacion:
        'Con «Crear borrador» las fuentes quedan en el borrador v1. Las consultas no se hacen al guardar: se hacen cuando el expediente de un tercero que usa este flujo pasa a revisión. ' +
        'El flujo empieza a usarse al publicarlo.',
      resaltar: app.getByRole('button', { name: 'Publicar v1' }),
      avisos: true,
    });

    // 3. Con qué proveedor se consulta y la reconsulta periódica.
    const ajustes = await abrirEmbebido(page, e, e.ana, e.norte, 'fuentes-oficiales');
    await expect(ajustes.getByRole('heading', { level: 1, name: 'Fuentes oficiales' })).toBeVisible();
    const registro = ajustes.getByRole('region', { name: 'Registro mercantil (RUES)' });
    await expect(registro).toContainText('Se consulta con Simulado (pruebas).');
    await paso(page, {
      titulo: 'Revisa con qué proveedor se consulta en tu empresa',
      explicacion:
        'En Configuración › Fuentes oficiales ves, por fuente, el proveedor que se usa. Si eliges «El de la plataforma o la instalación», la consulta sigue el predeterminado de Plataforma. ' +
        'Puedes elegir otro proveedor disponible o cargar credenciales propias, que mandan sobre las de la plataforma. Las credenciales se escriben y nunca se muestran de vuelta.',
      resaltar: registro.getByText('Se consulta con Simulado (pruebas).', { exact: true }),
      configuracion: {
        ajuste: 'Proveedor del RUES y de la DIAN',
        ruta: 'Configuración › Fuentes oficiales (/configuracion/fuentes-oficiales)',
        efecto: 'Con qué registro se corrobora al tercero. Sin proveedor disponible, las verificaciones que lo piden no pueden consultarse.',
      },
      variantes: [
        { cuando: 'No hay proveedor disponible', entonces: 'Ves «No hay un proveedor disponible»: pídele a Plataforma que habilite uno o configura el tuyo.' },
      ],
    });

    await ajustes.getByLabel('Reconsultar cada (días)').fill('90');
    await ajustes.getByRole('button', { name: 'Guardar reconsulta' }).click();
    await expect(ajustes.getByText('Cambios guardados.', { exact: true })).toBeVisible();
    await paso(page, {
      titulo: 'Decide si se reconsultan los vínculos activos',
      explicacion:
        'La reconsulta periódica es opcional y está apagada por omisión. Con «Reconsultar cada (días)» se vuelve a consultar el RUES o la DIAN de los vínculos aprobados que las consultaron, cada tantos días, sin que nadie lo pida. ' +
        'Una diferencia nueva avisa a Cumplimiento. Vacío o 0 la apaga; el máximo es 365 días.',
      resaltar: ajustes.getByLabel('Reconsultar cada (días)'),
      configuracion: {
        ajuste: 'Reconsultar cada (días)',
        ruta: 'Configuración › Fuentes oficiales (/configuracion/fuentes-oficiales)',
        efecto: 'Un hallazgo nuevo solo lo decide un administrador: bloquear o desvincular nunca es automático.',
      },
    });
  },
);
