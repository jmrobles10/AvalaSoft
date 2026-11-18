import { MenuItem, TextField } from '@mui/material';
import type { AtributoPermitidoDto, CondicionDto } from '@validasoft/api-client';
import { atajoDe, condicionDe, type AtajoCondicion } from '../condiciones';

export interface SelectorDeCondicionProps {
  etiqueta: string;
  condicion: CondicionDto | null;
  onCambiar: (condicion: CondicionDto | null) => void;
  deshabilitado: boolean;
  /** Texto de cada opción; `personalizada` solo se ofrece cuando la condición la armó la API y no es un atajo. */
  textoDe: (atajo: AtajoCondicion) => string;
  ayuda?: string;
  /** Los atributos permitidos del tipo de vínculo del flujo: sin ninguno no se ofrece «según un atributo del vínculo» (salvo que la condición ya sea de ese tipo). */
  atributos?: readonly AtributoPermitidoDto[];
}

const ATAJOS = ['siempre', 'juridica', 'natural', 'ficha'] as const;

/**
 * Elige la condición entre los atajos del uso diario (sin condición, solo personas jurídicas, solo naturales, según la ficha del tercero, según un atributo del vínculo): el
 * mismo editor de condiciones de «Se pide a» de los requisitos (RQ-12) y de «Se escoge cuando» de la selección del flujo (FR-1). Una condición armada
 * por la API (país, combinaciones) aparece como «personalizada» y se conserva tal cual.
 */
export function SelectorDeCondicion({ etiqueta, condicion, onCambiar, deshabilitado, textoDe, ayuda, atributos = [] }: SelectorDeCondicionProps) {
  const atajo = atajoDe(condicion);
  return (
    <TextField
      select
      size="small"
      label={etiqueta}
      value={atajo}
      onChange={(ev) => onCambiar(condicionDe(ev.target.value as AtajoCondicion, condicion, atributos))}
      disabled={deshabilitado}
      helperText={ayuda}
    >
      {ATAJOS.map((a) => (
        <MenuItem key={a} value={a}>
          {textoDe(a)}
        </MenuItem>
      ))}
      {(atributos.length > 0 || atajo === 'atributo') && <MenuItem value="atributo">{textoDe('atributo')}</MenuItem>}
      {atajo === 'personalizada' && <MenuItem value="personalizada">{textoDe('personalizada')}</MenuItem>}
    </TextField>
  );
}
