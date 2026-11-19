import { Autocomplete, Box, MenuItem, TextField } from '@mui/material';
import type { AtributoPermitidoDto } from '@validalo/api-client';
import { CampoFecha } from '@validalo/ui';
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

interface CampoDeValorProps {
  tipo: AtributoPermitidoDto['tipo'] | undefined;
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  deshabilitado: boolean;
  error: boolean;
}

/** Un valor escrito de la condición: la fecha con el selector de la aplicación (`aaaa-mm-dd`), y lo demás (números, texto) con un campo de texto. */
function CampoDeValor({ tipo, etiqueta, valor, onCambiar, deshabilitado, error }: CampoDeValorProps) {
  if (tipo === 'Fecha') {
    return <CampoFecha etiqueta={etiqueta} valor={valor} onCambiar={onCambiar} deshabilitado={deshabilitado} error={error} fullWidth />;
  }
  return (
    <TextField
      size="small"
      label={etiqueta}
      value={valor}
      onChange={(ev) => onCambiar(ev.target.value)}
      disabled={deshabilitado}
      error={error}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: tipo === 'Numero' ? 'decimal' : undefined, autoComplete: 'off' } }}
    />
  );
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
  // Un número solo admite dígitos, el punto decimal y el signo (así viaja a la API); una fecha la da el selector de fechas (`CampoFecha`).
  const limpiar = (texto: string) => (tipo === 'Numero' ? texto.replace(/[^0-9.-]/g, '') : texto);

  if (modo === 'entre') {
    const cambiar = (indice: number, valor: string) => onCambiar([indice === 0 ? limpiar(valor) : (valores[0] ?? ''), indice === 1 ? limpiar(valor) : (valores[1] ?? '')]);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {(['desde', 'hasta'] as const).map((rango, i) => (
          <CampoDeValor key={rango} tipo={tipo} etiqueta={t(`condicionDeAtributo.${rango}`)} valor={valores[i] ?? ''} onCambiar={(valor) => cambiar(i, valor)} deshabilitado={deshabilitado} error={error} />
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
    return <CampoDeValor tipo={tipo} etiqueta={rotulo} valor={valores[0] ?? ''} onCambiar={(valor) => onCambiar(limpiar(valor) === '' ? [] : [limpiar(valor)])} deshabilitado={deshabilitado} error={error} />;
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
