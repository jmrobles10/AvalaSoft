/** Selección automática del flujo (FR-1): sección del editor de flujos y explicación de por qué un expediente tiene su flujo. */
export const flujoSeleccion = {
  titulo: 'Selección automática',
  ayuda:
    'Cuando se abre un expediente sin indicar el flujo, el sistema revisa los flujos publicados de este tipo de vínculo por prioridad (la menor primero) y usa el primero cuya condición cumpla el tercero. Si ninguno la cumple, usa el flujo por defecto. La condición queda congelada con la versión publicada.',
  seEscogeCuando: 'Se escoge cuando',
  atajos: {
    siempre: 'Sin condición',
    juridica: 'El tercero es persona jurídica',
    natural: 'El tercero es persona natural',
    ficha: 'Según la ficha del tercero',
    personalizada: 'Condición personalizada',
  },
  prioridad: 'Prioridad',
  prioridadAyuda: '1 a 999; la menor se evalúa primero y no se repite en el tipo.',
  sinCondicion: 'Sin condición, este flujo solo se usa si lo eligen al abrir el expediente o si es el flujo por defecto del tipo de vínculo.',
  personalizada: 'Se escoge cuando {{condicion}}.',
  enLista: 'Regla {{prioridad}}',
} as const;

/**
 * Condición según la ficha del tercero (EF-1…EF-4): se arma en «Se pide a» de un documento y en «Se escoge cuando» de la selección del flujo. Un campo de
 * la ficha (especialidades, actividad económica, ciudad, responsabilidades del RUT…), cómo se compara y con qué valores.
 */
export const condicionDeFicha = {
  ayuda:
    'Se cumple según lo que el tercero declara en su ficha, y la empresa la ve desde que el tercero acepta su invitación: antes, la condición no se cumple. Si lo declarado cambia con el expediente abierto, los documentos se suman o dejan de aplicar solos.',
  campo: 'Campo de la ficha',
  seCumpleCuando: 'Se cumple cuando',
  valores: 'Valores',
  valor: 'Valor',
  buscar: 'Busca por código o por nombre',
  sinResultados: 'Sin resultados',
  buscando: 'Buscando…',
  si: 'Sí',
  no: 'No',
  jerarquica: 'Un valor de nivel superior cubre los de abajo: el grupo o la categoría de una especialidad, la división o el grupo de un CIIU.',
  libre: 'En la actividad económica puedes escribir también una división (2 dígitos) o un grupo (3) y pulsar Intro.',
  noDisponible: 'No se pudieron cargar los campos de la ficha. Recarga la página para volver a intentarlo.',
  incompleta: 'Elige al menos un valor (uno solo con «es» y «no es»).',
  modos: {
    alguno: 'incluye alguno de',
    todos: 'incluye todos',
    ninguno: 'no incluye ninguno de',
    es: 'es',
    noEs: 'no es',
    esUnoDe: 'es uno de',
    noEsNingunoDe: 'no es ninguno de',
    declarado: 'está declarado',
    noDeclarado: 'no está declarado',
  },
} as const;

/** Por qué el expediente tiene su flujo (detalle del expediente y del vínculo): explícito, por regla o por defecto. */
export const origenDelFlujo = {
  Explicito: 'Se eligió el flujo al abrir el expediente o al crear el vínculo.',
  Regla: 'Se escogió por regla: {{condicion}} (prioridad {{prioridad}}). Gana la primera que se cumple; esta fue la {{evaluadas}}.ª que se evaluó.',
  ReglaSinDetalle: 'Se escogió por una regla de selección.',
  PorDefecto: 'Ninguna regla de selección se cumplió, así que se usó el flujo por defecto del tipo de vínculo.',
} as const;
