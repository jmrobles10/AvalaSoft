import { TextField, type TextFieldProps } from '@mui/material';
import { useState } from 'react';

export interface CampoDecimalProps extends Pick<TextFieldProps, 'label' | 'disabled' | 'error' | 'helperText' | 'sx' | 'size'> {
  /** El número guardado; `null` es «vacío». */
  valor: number | null;
  onCambiar: (valor: number | null) => void;
  /** Con `true` el campo puede quedar vacío (sin límite); si no, vacío vale 0. */
  admiteVacio?: boolean;
}

const DECIMAL = /^\d*[.,]?\d{0,2}$/;

/**
 * Campo para un número no negativo con hasta dos decimales (pesos, puntajes, umbral): sin las flechas ni la rueda de `type="number"` (UI-7). Mientras se
 * escribe guarda el texto (`1.`, `0,`) y avisa solo cuando es un número completo, así no pelea con la persona por la coma.
 */
export function CampoDecimal({ valor, onCambiar, admiteVacio = false, size = 'small', ...resto }: CampoDecimalProps) {
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor === null ? '' : String(valor).replace('.', ','));

  return (
    <TextField
      {...resto}
      size={size}
      value={mostrado}
      onChange={(e) => {
        const nuevo = e.target.value;
        if (!DECIMAL.test(nuevo)) return;
        setTexto(nuevo);
        const numero = Number(nuevo.replace(',', '.'));
        onCambiar(nuevo === '' ? (admiteVacio ? null : 0) : Number.isFinite(numero) ? numero : null);
      }}
      onBlur={() => setTexto(null)}
      slotProps={{ htmlInput: { inputMode: 'decimal', autoComplete: 'off', maxLength: 8 } }}
    />
  );
}
