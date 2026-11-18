import { Autocomplete, Box, MenuItem, TextField } from '@mui/material';
import type { AtributoPermitidoDto } from '@validasoft/api-client';
import { useTranslation } from 'react-i18next';
import { modoUnSoloValor, type ModoDeAtributo } from '../condiciones';

interface Props {
  /** El atributo que se compara; `undefined` si el tipo de vínculo ya no lo tiene (el valor se escribe como texto). */
  atributo: AtributoPermitidoDto | undefined;
  modo: ModoDeAtributo;
  valores: string[];
  onCambiar: (valores: string[]) => void;
  deshabilitado: boolean;
  error: boolean;
}

/**
 * Los valores de una condición sobre un atributo del vínculo, con el control de su tipo: sí/no y opciones se eligen, los números y las fechas se escriben
 * (con «entre» van dos) y el texto es libre. Los valores viajan como texto invariante: números con punto, fechas `AAAA-MM-DD`, sí/no como `true`/`false`.
 */
export function ValoresDeAtributo({ atributo, modo, valores, onCambiar, deshabilitado, error }: Props) {
  const { t } = useTranslation();
  const tipo = atributo?.tipo;
  const unico = modoUnSoloValor(modo);
  const rotulo = t(unico ? 'condicionDeAtributo.valor' : 'condicionDeAtributo.valores');
  // Un número solo admite dígitos, el punto decimal y el signo (así viaja a la API); una fecha la da el selector de fechas.
  const limpiar = (texto: string) => (tipo === 'Numero' ? texto.replace(/[^0-9.-]/g, '') : texto);

  if (modo === 'entre') {
    const cambiar = (indice: number, valor: string) => onCambiar([indice === 0 ? limpiar(valor) : (valores[0] ?? ''), indice === 1 ? limpiar(valor) : (valores[1] ?? '')]);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {(['desde', 'hasta'] as const).map((rango, i) => (
          <TextField
            key={rango}
            size="small"
            type={tipo === 'Fecha' ? 'date' : 'text'}
            label={t(`condicionDeAtributo.${rango}`)}
            value={valores[i] ?? ''}
            onChange={(ev) => cambiar(i, ev.target.value)}
            disabled={deshabilitado}
            error={error}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: tipo === 'Numero' ? 'decimal' : undefined, autoComplete: 'off' } }}
          />
        ))}
      </Box>
    );
  }

  if (tipo === 'Booleano' || ((tipo === 'Opcion' || tipo === 'ListaOpciones') && unico)) {
    const opciones = tipo === 'Booleano' ? ['true', 'false'] : (atributo?.opciones ?? []);
    return (
      <TextField select size="small" label={rotulo} value={opciones.includes(valores[0] ?? '') ? (valores[0] ?? '') : ''} onChange={(ev) => onCambiar([ev.target.value])} disabled={deshabilitado} error={error}>
        {opciones.map((o) => (
          <MenuItem key={o} value={o}>
            {tipo === 'Booleano' ? t(`condicionDeAtributo.${o === 'true' ? 'si' : 'no'}`) : o}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  if (unico) {
    return (
      <TextField
        size="small"
        type={tipo === 'Fecha' ? 'date' : 'text'}
        label={rotulo}
        value={valores[0] ?? ''}
        onChange={(ev) => onCambiar(limpiar(ev.target.value) === '' ? [] : [limpiar(ev.target.value)])}
        disabled={deshabilitado}
        error={error}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: tipo === 'Numero' ? 'decimal' : undefined, autoComplete: 'off' } }}
      />
    );
  }

  // Varios valores: las opciones del atributo, o texto libre (se pulsa Intro por cada uno) si es de texto.
  const libre = tipo !== 'Opcion' && tipo !== 'ListaOpciones';
  return (
    <Autocomplete<string, true, false, boolean>
      multiple
      freeSolo={libre}
      size="small"
      options={atributo?.opciones ?? []}
      value={valores}
      onChange={(_, elegidos) => onCambiar(elegidos.map((v) => v.trim()).filter(Boolean))}
      disabled={deshabilitado}
      renderInput={(parametros) => <TextField {...parametros} label={rotulo} placeholder={valores.length === 0 && libre ? t('condicionDeAtributo.escribe') : ''} error={error} />}
    />
  );
}
