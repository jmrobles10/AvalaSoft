/* Valídalo: tokens del design system. No existe `tokens.json` en el repositorio: este archivo es la única fuente (antes se generaba desde un
 * `tokens.json` del artifact de diseño, ya retirado). Los de marca (`marcaAzul`, `marcaVerde`, `marcaProfundo`, `marcaSoft`, `marcaTexto`) son
 * los del logo «Anillo» y no cambian con la paleta de la interfaz (MA-1, docs/marca.md).
 *
 * Rework visual (2026-11): lienzo gris claro con paneles flotantes, acento único verde azulado (`accionPrimaria`, `acento`), radios grandes,
 * bordes muy sutiles y chips de estado tinteados. Los textos de estado y el texto del acento pasan 4,5:1 sobre sus fondos en los dos modos
 * (lo comprueba `componentes.test.tsx`). */

export type Modo = 'light' | 'dark';

export const COLOR = {
  light: {
    // Capas: el lienzo es el fondo de la ventana; el panel flota sobre él (barra lateral y contenido); la tarjeta (nivel 1) va dentro del panel.
    fondo: '#EEF1F4',
    superficiePanel: '#FAFBFC',
    superficieNivel1: '#FFFFFF',
    superficieNivel2: '#F3F5F7',
    superficieElevada: '#FFFFFF',
    textoPrimario: '#14202B',
    textoSecundario: '#52606D',
    textoDeshabilitado: '#8593A0',
    textoSobreAccion: '#FFFFFF',
    bordeSutil: '#E2E7EC',
    // Borde de los campos: sutil, como en la referencia; el foco lo marca con el acento. Para los controles pequeños cuyo único indicador es su
    // borde (casilla, radio, pista del interruptor) se usa `bordeControlFuerte` (≥ 3:1 sobre la superficie).
    bordeControl: '#C5CDD5',
    bordeControlFuerte: '#7E8B98',
    accionPrimaria: '#0E7C86',
    accionPrimariaHover: '#0B6770',
    accionDestructiva: '#C8283A',
    acento: '#0B7480',
    acentoTinte: '#E3F4F6',
    acentoBorde: '#8CCBD2',
    encabezadoTabla: '#E8F6F8',
    foco: '#0E7C86',
    marcaAzul: '#3D6BFF',
    marcaVerde: '#22D38A',
    marcaProfundo: '#0E2A6B',
    marcaSoft: '#2F55D9',
    marcaTexto: '#0A0F1C',
    scrim: 'rgba(20, 32, 43, 0.46)',
    tooltipFondo: '#1B2A38',
    tooltipTexto: '#FFFFFF',
    esqueleto: '#E4E9EE',
    estadoEncurso: '#0E8C9A',
    estadoEncursoTexto: '#0A6F7A',
    estadoEncursoFondo: '#E3F4F6',
    estadoEncursoBorde: '#B7E0E6',
    estadoExito: '#1F9D63',
    estadoExitoTexto: '#0C7448',
    estadoExitoFondo: '#E4F5EC',
    estadoExitoBorde: '#B4DFCD',
    estadoAdvertencia: '#D98E04',
    estadoAdvertenciaTexto: '#8A5A00',
    estadoAdvertenciaFondo: '#FCF1DA',
    estadoAdvertenciaBorde: '#EBD3A0',
    estadoError: '#D6303F',
    estadoErrorTexto: '#B42330',
    estadoErrorFondo: '#FBE9EB',
    estadoErrorBorde: '#F2BDC2',
    estadoInfo: '#2F6FD1',
    estadoInfoTexto: '#2A5CB8',
    estadoInfoFondo: '#E8F0FB',
    estadoInfoBorde: '#BFD2EE',
    estadoNeutro: '#6B7785',
    estadoNeutroTexto: '#4A5663',
    estadoNeutroFondo: '#EEF1F4',
    estadoNeutroBorde: '#D3DAE0',
    // Cuarto color del tablero (KPI de «automatizado»): no es un estado de dominio, solo un acento más para distinguir tarjetas.
    violeta: '#7C5CE0',
    violetaTexto: '#5B3FC0',
    violetaFondo: '#EFEBFC',
    violetaBorde: '#D5CBF4',
  },
  dark: {
    fondo: '#0A0F14',
    superficiePanel: '#0F151C',
    superficieNivel1: '#141C25',
    superficieNivel2: '#1A232E',
    superficieElevada: '#1A232E',
    textoPrimario: '#E8EEF3',
    textoSecundario: '#93A1AE',
    textoDeshabilitado: '#5F6C79',
    textoSobreAccion: '#FFFFFF',
    bordeSutil: '#243040',
    bordeControl: '#3A4757',
    bordeControlFuerte: '#6F7F8F',
    accionPrimaria: '#0E7C86',
    accionPrimariaHover: '#0B6A73',
    accionDestructiva: '#D6303F',
    acento: '#3FC1CE',
    acentoTinte: '#12303A',
    acentoBorde: '#2A7C87',
    encabezadoTabla: '#122E37',
    foco: '#3FC1CE',
    marcaAzul: '#6E8FFF',
    marcaVerde: '#2BE29A',
    marcaProfundo: '#0E2A6B',
    marcaSoft: '#7C9BFF',
    marcaTexto: '#F2F5FB',
    scrim: 'rgba(0, 0, 0, 0.64)',
    tooltipFondo: '#E6EAF0',
    tooltipTexto: '#0A0F14',
    esqueleto: '#1D2833',
    estadoEncurso: '#3FC1CE',
    estadoEncursoTexto: '#5FD0DB',
    estadoEncursoFondo: '#10303A',
    estadoEncursoBorde: '#1E5A66',
    estadoExito: '#34D399',
    estadoExitoTexto: '#4ADE9F',
    estadoExitoFondo: '#0F2D26',
    estadoExitoBorde: '#176650',
    estadoAdvertencia: '#F5B544',
    estadoAdvertenciaTexto: '#F5B544',
    estadoAdvertenciaFondo: '#2B2616',
    estadoAdvertenciaBorde: '#644F2E',
    estadoError: '#FF5C6C',
    estadoErrorTexto: '#FF7A87',
    estadoErrorFondo: '#2D1C2B',
    estadoErrorBorde: '#682E3D',
    estadoInfo: '#7BA7FF',
    estadoInfoTexto: '#8DB4FF',
    estadoInfoFondo: '#14263F',
    estadoInfoBorde: '#2E4A75',
    estadoNeutro: '#93A1AE',
    estadoNeutroTexto: '#A9B5C1',
    estadoNeutroFondo: '#1D2630',
    estadoNeutroBorde: '#364352',
    violeta: '#9B82F0',
    violetaTexto: '#B7A4F7',
    violetaFondo: '#221C40',
    violetaBorde: '#43397A',
  },
} as const;

export type TokenColor = keyof (typeof COLOR)['light'];

export const SOMBRA = {
  light: {
    menu: '0 1px 2px rgba(20, 32, 43, 0.06), 0 8px 24px rgba(20, 32, 43, 0.10)',
    dialogo: '0 24px 64px rgba(20, 32, 43, 0.18)',
    // Panel flotante y tarjeta: casi nada, el borde sutil hace el trabajo.
    suave: '0 1px 2px rgba(20, 32, 43, 0.04)',
    // Ítem activo de la barra lateral (píldora blanca).
    pildora: '0 1px 3px rgba(20, 32, 43, 0.10), 0 0 0 1px rgba(20, 32, 43, 0.03)',
  },
  dark: {
    menu: '0 8px 24px rgba(0, 0, 0, 0.50)',
    dialogo: '0 24px 64px rgba(0, 0, 0, 0.64)',
    suave: '0 1px 2px rgba(0, 0, 0, 0.30)',
    pildora: '0 1px 3px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.04)',
  },
} as const;

/** `lg`: paneles flotantes y diálogos · `md`: tarjetas y avisos · `sm`: campos, botones, menús · `xs`: celdas y etiquetas pequeñas. */
export const RADIO = { "lg": 16, "md": 14, "sm": 8, "xs": 6, "pill": 999 } as const;
export const ESPACIO = { "e4": 4, "e8": 8, "e12": 12, "e16": 16, "e24": 24, "e32": 32, "e48": 48, "e64": 64 } as const;
export const DENSIDAD = { "filaCompacta": 36, "filaComoda": 48, "controlCompacto": 32, "controlComodo": 44, "controlMedio": 36, "controlAmplio": 40, "objetivoTactil": 44, "cabeceraEmbebida": 48, "barraSuperior": 64, "barraLateral": 248, "barraLateralColapsada": 64 } as const;
export const BORDE = { "grosorHairline": 1, "grosorCertificado": 1.5, "anilloFoco": 2, "separacionFoco": 2, "grosorIndicador": 2 } as const;
export const MOVIMIENTO = { "duracionCorta": '120ms', "duracionMedia": '200ms', "duracionLarga": '320ms', "curvaEstandar": 'cubic-bezier(0.2, 0, 0, 1)', "curvaSalida": 'cubic-bezier(0.3, 0, 1, 1)' } as const;

export const FUENTE = { sans: "'Geist Variable', 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif", mono: "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'Cascadia Mono', monospace" } as const;

export const TIPOGRAFIA = {
  titulo1: { fontSize: 28, lineHeight: '36px', fontWeight: 600, letterSpacing: '-0.02em' },
  titulo2: { fontSize: 22, lineHeight: '30px', fontWeight: 500, letterSpacing: '-0.01em' },
  titulo3: { fontSize: 16, lineHeight: '24px', fontWeight: 500 },
  titulo4: { fontSize: 15, lineHeight: '22px', fontWeight: 500 },
  cuerpo: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
  cuerpo2: { fontSize: 13, lineHeight: '18px', fontWeight: 400 },
  etiqueta: { fontSize: 12, lineHeight: '16px', fontWeight: 500 },
  boton: { fontSize: 14, lineHeight: '20px', fontWeight: 500 },
  sobretitulo: { fontSize: 11, lineHeight: '16px', fontWeight: 600, letterSpacing: '0.08em' },
  publicoTitulo: { fontSize: 20, lineHeight: '26px', fontWeight: 500, letterSpacing: '-0.01em' },
  publicoCuerpo: { fontSize: 16, lineHeight: '24px', fontWeight: 400 },
  publicoEtiqueta: { fontSize: 14, lineHeight: '20px', fontWeight: 500 },
  mono: { fontSize: 13, lineHeight: '18px', fontWeight: 400, fontFamily: FUENTE.mono, fontVariantNumeric: 'tabular-nums' },
  monoTabla: { fontSize: 12, lineHeight: '16px', fontWeight: 400, fontFamily: FUENTE.mono, fontVariantNumeric: 'tabular-nums' },
  monoKpi: { fontSize: 28, lineHeight: '32px', fontWeight: 500, letterSpacing: '-0.01em', fontFamily: FUENTE.mono, fontVariantNumeric: 'tabular-nums' },
} as const;
