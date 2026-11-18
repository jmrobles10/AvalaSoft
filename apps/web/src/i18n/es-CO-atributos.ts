/**
 * Atributos del vínculo (decisión IM): los valores que la empresa registra en un vínculo según los atributos permitidos de su tipo de vínculo. Se ponen al invitar a un tercero
 * (a mano o por lote), se editan desde el detalle del vínculo y los flujos los usan en sus condiciones.
 */
export const atributosVinculo = {
  titulo: 'Atributos del vínculo',
  ayuda: 'Los define el tipo de vínculo. Los flujos pueden usarlos en sus condiciones.',
  editar: 'Editar atributos',
  dialogoTitulo: 'Editar atributos del vínculo',
  dialogoAyuda: 'Los atributos que dejes vacíos se quitan del vínculo. Los flujos los usan en sus condiciones («según un atributo del vínculo»).',
  guardar: 'Guardar',
  cancelar: 'Cancelar',
  guardado: 'Atributos actualizados.',
  sinValores: 'Sin valores',
  sinDefinir: 'Sin definir',
  si: 'Sí',
  no: 'No',
  numeroAyuda: 'Un número, con punto decimal.',
  fechaAyuda: 'Una fecha.',
  listaAyuda: 'Elige una o varias opciones.',
  falta: 'Falta el atributo «{{atributo}}».',
  errores: {
    requerido: 'Este atributo es obligatorio.',
    'numero-invalido': 'Escribe un número, con punto decimal.',
    'fecha-invalida': 'Elige una fecha válida.',
    'opcion-invalida': 'Elige una de las opciones.',
  },
} as const;
