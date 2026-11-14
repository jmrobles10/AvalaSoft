/** Textos es-CO de la autoevaluación del tercero (CE-4, se integran en `es-CO.ts`). El tercero nunca ve puntajes, pesos ni el resultado. */

export const evaluaciones = {
  tarjeta: {
    titulo: 'Evaluaciones que te pide {{empresa}}',
    pendiente: 'Pendiente',
    enviada: 'Enviada',
    enviadaEl: 'Enviada el {{fecha}}',
    pedidaEl: 'Pedida el {{fecha}}',
    responder: 'Responder',
    responderA: 'Responder la evaluación {{cuestionario}}',
    ver: 'Ver',
    verA: 'Ver la evaluación {{cuestionario}}',
  },
  aviso: {
    titulo_one: '{{empresa}} te pide responder una evaluación',
    titulo_other: '{{empresa}} te pide responder {{count}} evaluaciones',
    texto: 'Es un cuestionario corto sobre tu empresa. Lo que respondas lo revisa {{empresa}}; tú no necesitas hacer nada más después de enviarlo.',
  },
  pagina: {
    sub: 'Evaluación pedida por {{empresa}}',
    ayuda: 'Responde con calma: puedes subir archivos como evidencia en las preguntas que lo piden. Al enviar, {{empresa}} recibe tus respuestas.',
    noEncontrada: 'No encontramos esa evaluación',
    noEncontradaTexto: 'Puede que ya no se espere o que sea de otra empresa. Vuelve a «Mis empresas» para ver lo que te toca.',
    volver: 'Volver a Mis empresas',
    volverARevision: 'Volver a mi revisión',
    laEmpresa: 'la empresa',
  },
  responder: {
    comentario: 'Comentario (opcional)',
    subirArchivo: 'Subir archivo',
    quitarArchivo: 'Quitar el archivo {{nombre}}',
    subiendo: 'Subiendo…',
    numero: 'Número',
    obligatoria: 'Obligatoria',
    enviar: 'Enviar evaluación',
    faltan_one: 'Falta {{count}} pregunta obligatoria',
    faltan_other: 'Faltan {{count}} preguntas obligatorias',
    enviada: 'Enviaste tu evaluación. {{empresa}} la revisa.',
  },
  enviada: {
    titulo: 'Enviaste tu evaluación',
    texto: '{{empresa}} recibió tus respuestas el {{fecha}} y las revisa. No necesitas hacer nada más; si te falta algo, te avisa.',
  },
};
