import { Box, MenuItem, TextField, Typography } from '@mui/material';
import type { AtributoPermitidoDto, CondicionDto } from '@avalasoft/api-client';
import { useTranslation } from 'react-i18next';
import {
  condicionDeAtributoCompleta,
  condicionDeAtributoSimple,
  condicionDesdeAtributo,
  describirCondicion,
  modoLlevaValores,
  modosDeAtributo,
  modoUnSoloValor,
  type CondicionDeAtributo as Comparacion,
  type ModoDeAtributo,
} from '../condiciones';
import { ValoresDeAtributo } from './ValoresDeAtributo';

export interface CondicionDeAtributoProps {
  /** La condición actual; si no es una comparación simple sobre un atributo del vínculo, no se muestra nada (la describe quien la contiene). */
  condicion: CondicionDto;
  /** Los atributos permitidos del tipo de vínculo del flujo: los que se pueden mirar. */
  atributos: readonly AtributoPermitidoDto[];
  onCambiar: (condicion: CondicionDto) => void;
  deshabilitado: boolean;
  /** Texto de un error de la API sobre esta condición. */
  error?: string;
  /** La condición dicha en una frase de la pantalla que la usa («Se pide cuando …», «Se escoge cuando …»). */
  resumen: (condicion: string) => string;
}

/**
 * «Según un atributo del vínculo»: arma una condición sobre uno de los atributos permitidos del tipo de vínculo del flujo (nivel de riesgo, monto estimado…). Se elige el
 * atributo, cómo se compara —los operadores que la API admite para su tipo— y el valor con el control de su tipo. Es la misma condición del motor de los requisitos y de la
 * selección del flujo (`vinculo.atributos.{clave}`).
 */
export function CondicionDeAtributo({ condicion, atributos, onCambiar, deshabilitado, error, resumen }: CondicionDeAtributoProps) {
  const { t } = useTranslation();
  const actual = condicionDeAtributoSimple(condicion);
  if (!actual) return null;

  const atributo = atributos.find((a) => a.clave === actual.clave);
  const modos = modosDeAtributo(atributo?.tipo);
  const completa = condicionDeAtributoCompleta(actual, atributo?.tipo);
  const cambiar = (cambio: Partial<Comparacion>) => onCambiar(condicionDesdeAtributo({ ...actual, ...cambio }));

  const elegirAtributo = (clave: string) => {
    const nuevos = modosDeAtributo(atributos.find((a) => a.clave === clave)?.tipo);
    // Los valores de un atributo no valen en otro; el modo se conserva si el atributo nuevo también lo admite.
    cambiar({ clave, modo: nuevos.includes(actual.modo) ? actual.modo : (nuevos[0] ?? 'es'), valores: [] });
  };

  const elegirModo = (modo: ModoDeAtributo) => {
    const valores = !modoLlevaValores(modo) ? [] : modo === 'entre' ? actual.valores.slice(0, 2) : modoUnSoloValor(modo) ? actual.valores.slice(0, 1) : actual.valores;
    cambiar({ modo, valores });
  };

  return (
    <Box sx={{ mt: 1 }} data-condicion-de-atributo="">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(220px,1fr) minmax(180px,0.7fr) minmax(260px,1.6fr)' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <TextField select size="small" label={t('condicionDeAtributo.atributo')} value={actual.clave} onChange={(ev) => elegirAtributo(ev.target.value)} disabled={deshabilitado}>
          {!atributo && (
            <MenuItem value={actual.clave} disabled>
              {t('condicionDeAtributo.yaNoExiste', { clave: actual.clave })}
            </MenuItem>
          )}
          {atributos.map((a) => (
            <MenuItem key={a.clave} value={a.clave}>
              {a.clave}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('condicionDeAtributo.seCumpleCuando')}
          value={modos.includes(actual.modo) ? actual.modo : ''}
          onChange={(ev) => elegirModo(ev.target.value as ModoDeAtributo)}
          disabled={deshabilitado}
        >
          {modos.map((m) => (
            <MenuItem key={m} value={m}>
              {t(`condicionDeAtributo.modos.${m}`)}
            </MenuItem>
          ))}
        </TextField>
        {modoLlevaValores(actual.modo) && (
          <ValoresDeAtributo atributo={atributo} modo={actual.modo} valores={actual.valores} onCambiar={(valores) => cambiar({ valores })} deshabilitado={deshabilitado} error={!completa || Boolean(error)} />
        )}
      </Box>
      <Typography sx={{ color: error || !completa ? 'error.main' : 'text.secondary', fontSize: 12, mt: 0.75 }}>
        {error ?? (completa ? resumen(describirCondicion(condicion, t)) : t('condicionDeAtributo.incompleta'))}
      </Typography>
    </Box>
  );
}
