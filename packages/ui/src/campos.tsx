import { Box, Typography, type Breakpoint } from '@mui/material';
import type { SubmitEvent, ReactNode } from 'react';
import { DENSIDAD } from './tokens';

/**
 * Medidas de un campo: la etiqueta va encogida sobre el borde (no ocupa una línea propia encima: `etiqueta` es 0) y el control mide
 * 36 px en las dos apps (40 en el celular del tercero, donde el área táctil manda).
 */
export function medidasDeCampo(): { etiqueta: number; control: number } {
  return { etiqueta: 0, control: DENSIDAD.controlMedio };
}

/**
 * Coloca switches, casillas y botones de icono de una fila de formulario a la altura de los **campos**: centra el contenido en el
 * alto del control (la etiqueta del campo va sobre su borde y no desplaza nada). El texto de ayuda
 * bajo un campo (p. ej. «1 miembro») no los desplaza porque la fila se alinea arriba. `desde`: el punto de quiebre en
 * que la fila deja de apilarse (antes no hace falta el espacio de la etiqueta).
 */
export function AlineadoConCampo({
  children,
  desde = 'xs',
  columna,
  conEtiqueta = true,
}: {
  children: ReactNode;
  desde?: Breakpoint;
  /** `false` en filas cuyos campos no llevan etiqueta (p. ej. las filas siguientes de una lista): solo centra en el control. */
  conEtiqueta?: boolean;
  /** `grid-column` de la celda (p. ej. `{ xs: '1 / -1', lg: 'auto' }`). */
  columna?: string | Partial<Record<Breakpoint, string>>;
}) {
  const { etiqueta, control } = medidasDeCampo();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: control,
        boxSizing: 'content-box',
        pt: !conEtiqueta ? 0 : desde === 'xs' ? `${String(etiqueta)}px` : { xs: 0, [desde]: `${String(etiqueta)}px` },
        gridColumn: columna,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Formulario dentro de un `Dialog`: deja que solo `DialogContent` desplace y que el título y las acciones (el botón de
 * enviar) queden siempre a la vista, aunque el contenido crezca.
 */
export function FormularioDeDialogo({ onSubmit, children }: { onSubmit: (evento: SubmitEvent<HTMLFormElement>) => void; children: ReactNode }) {
  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {children}
    </Box>
  );
}

/**
 * Junto al botón de envío deshabilitado, qué falta para poder enviar («Marca al menos un documento»). Va a la izquierda
 * de las acciones de un diálogo o formulario y se anuncia al cambiar (`role="status"`).
 */
export function FaltaParaEnviar({ children }: { children: ReactNode }) {
  return (
    <Typography role="status" variant="caption" sx={{ color: 'text.secondary', mr: 'auto', alignSelf: 'center' }}>
      {children}
    </Typography>
  );
}
