/**
 * Ancho máximo (px) del marco del tercero: la barra superior y el panel. Es **el mismo en todas las páginas**, así el logotipo, las secciones
 * y el borde del panel no se mueven al navegar. Por debajo de este ancho no cambia nada; en pantallas más anchas el marco se centra.
 */
export const ANCHO_PANEL = 1440;

/** Una sección de Mi información (`/ficha/:seccion`): trae sus propios paneles flotantes en lugar de ir dentro del panel del Shell. */
export const esSeccionDeFicha = (pathname: string): boolean => /^\/ficha\/[^/]+/.test(pathname);
