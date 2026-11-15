import { Autocomplete, Box, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import type { CampoDeFichaDto, CondicionDto } from '@validasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBuscarEnCatalogo, useCamposDeFicha, useNombresDeCatalogo } from '../api';
import {
  condicionDeFichaCompleta,
  condicionDeFichaSimple,
  condicionDesdeFicha,
  modoLlevaValores,
  modosDeCampo,
  modoUnSoloValor,
  type CondicionDeFicha,
  type ModoDeFicha,
} from '../condiciones';

export interface CondicionDeFichaProps {
  /** La condición actual; si no es una comparación simple sobre la ficha, no se muestra nada (la describe quien la contiene). */
  condicion: CondicionDto;
  onCambiar: (condicion: CondicionDto) => void;
  deshabilitado: boolean;
  /** Texto de un error de la API sobre esta condición (p. ej. un código que no existe en el catálogo). */
  error?: string;
}

/**
 * «Según la ficha del tercero» (EF-1): arma una condición sobre un campo de la ficha. Se elige el campo (los ofrece la API: especialidades, actividad
 * económica, ciudad, responsabilidades del RUT…), cómo se compara (incluye alguno o todos, es, está declarado…) y los valores, que salen del catálogo
 * de plataforma del campo con su nombre. Es la misma condición del motor de los requisitos y de la selección del flujo.
 */
export function CondicionDeFicha({ condicion, onCambiar, deshabilitado, error }: CondicionDeFichaProps) {
  const { t } = useTranslation();
  const campos = useCamposDeFicha();
  const actual = condicionDeFichaSimple(condicion);
  if (!actual) return null;

  const cambiar = (cambio: Partial<CondicionDeFicha>) => onCambiar(condicionDesdeFicha({ ...actual, ...cambio }));
  const campo = campos.data?.find((c) => c.ruta === actual.campo);
  const incompleta = !condicionDeFichaCompleta(actual);

  const elegirCampo = (ruta: string) => {
    const nuevo = campos.data?.find((c) => c.ruta === ruta);
    const modos = nuevo ? modosDeCampo(nuevo) : [];
    // Los valores de un campo no valen en otro; el modo se conserva si el campo nuevo también lo admite.
    cambiar({ campo: ruta, modo: modos.includes(actual.modo) ? actual.modo : (modos[0] ?? actual.modo), valores: [] });
  };

  const elegirModo = (modo: ModoDeFicha) => {
    const valores = !modoLlevaValores(modo) ? [] : modoUnSoloValor(modo) ? actual.valores.slice(0, 1) : actual.valores;
    cambiar({ modo, valores });
  };

  return (
    <Box sx={{ mt: 1 }} data-condicion-de-ficha="">
      {campos.isPending ? (
        <Skeleton variant="rounded" height={40} />
      ) : campos.isError ? (
        <Typography color="error" sx={{ fontSize: 12 }}>
          {t('condicionDeFicha.noDisponible')}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(220px,1fr) minmax(180px,0.7fr) minmax(260px,1.6fr)' },
            gap: 1.5,
            alignItems: 'start',
          }}
        >
          <TextField
            select
            size="small"
            label={t('condicionDeFicha.campo')}
            value={campos.data.some((c) => c.ruta === actual.campo) ? actual.campo : ''}
            onChange={(ev) => elegirCampo(ev.target.value)}
            disabled={deshabilitado}
          >
            {campos.data.map((c) => (
              <MenuItem key={c.ruta} value={c.ruta}>
                {c.etiqueta}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('condicionDeFicha.seCumpleCuando')}
            value={campo && modosDeCampo(campo).includes(actual.modo) ? actual.modo : ''}
            onChange={(ev) => elegirModo(ev.target.value as ModoDeFicha)}
            disabled={deshabilitado || !campo}
          >
            {(campo ? modosDeCampo(campo) : []).map((m) => (
              <MenuItem key={m} value={m}>
                {t(`condicionDeFicha.modos.${m}`)}
              </MenuItem>
            ))}
          </TextField>
          {campo && modoLlevaValores(actual.modo) && (
            <ValoresDeFicha
              campo={campo}
              valores={actual.valores}
              unico={modoUnSoloValor(actual.modo)}
              onCambiar={(valores) => cambiar({ valores })}
              deshabilitado={deshabilitado}
              error={incompleta || Boolean(error)}
            />
          )}
        </Box>
      )}
      <Typography sx={{ color: error ? 'error.main' : 'text.secondary', fontSize: 12, mt: 0.75 }}>
        {error ?? (incompleta ? t('condicionDeFicha.incompleta') : t('condicionDeFicha.ayuda'))}
      </Typography>
      {campo?.jerarquica && !error && (
        <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
          {t('condicionDeFicha.jerarquica')}
          {campo.catalogo === 'actividades-economicas' ? ` ${t('condicionDeFicha.libre')}` : ''}
        </Typography>
      )}
    </Box>
  );
}

interface ValoresProps {
  campo: CampoDeFichaDto;
  valores: string[];
  unico: boolean;
  onCambiar: (valores: string[]) => void;
  deshabilitado: boolean;
  error: boolean;
}

/** Los valores de la comparación: sí/no en un booleano, entradas del catálogo con su nombre, o texto libre (un país) si el campo no tiene catálogo. */
function ValoresDeFicha({ campo, valores, unico, onCambiar, deshabilitado, error }: ValoresProps) {
  const { t } = useTranslation();
  if (campo.tipo === 'Booleano') {
    return (
      <TextField
        select
        size="small"
        label={t('condicionDeFicha.valor')}
        value={valores[0] ?? ''}
        onChange={(ev) => onCambiar([ev.target.value])}
        disabled={deshabilitado}
        error={error}
      >
        <MenuItem value="true">{t('condicionDeFicha.si')}</MenuItem>
        <MenuItem value="false">{t('condicionDeFicha.no')}</MenuItem>
      </TextField>
    );
  }

  return <ValoresDeCatalogo campo={campo} valores={valores} unico={unico} onCambiar={onCambiar} deshabilitado={deshabilitado} error={error} />;
}

function ValoresDeCatalogo({ campo, valores, unico, onCambiar, deshabilitado, error }: ValoresProps) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState('');
  const catalogo = campo.catalogo ?? null;
  const resultados = useBuscarEnCatalogo(catalogo, texto);
  const nombres = useNombresDeCatalogo(catalogo, valores);
  const entradas = resultados.data?.datos ?? [];
  const etiquetaDe = (codigo: string) => {
    const nombre = nombres.get(codigo) ?? entradas.find((e) => e.codigo === codigo)?.nombre;
    return nombre ? `${codigo} · ${nombre}` : codigo;
  };
  // Sin catálogo (un país) se escribe el código; la actividad económica admite además divisiones y grupos que el catálogo no trae.
  const libre = catalogo === null || catalogo === 'actividades-economicas';

  return (
    <Autocomplete<string, true, false, boolean>
      multiple
      freeSolo={libre}
      size="small"
      options={entradas.map((e) => e.codigo)}
      value={valores}
      inputValue={texto}
      onInputChange={(_, nuevo) => setTexto(nuevo)}
      onChange={(_, elegidos) => onCambiar(elegidos.map((v) => (catalogo === null ? v.trim().toUpperCase() : v.trim())).filter(Boolean))}
      filterOptions={(opciones) => opciones}
      getOptionLabel={(codigo) => etiquetaDe(codigo)}
      getOptionDisabled={() => unico && valores.length >= 1}
      loading={resultados.isFetching}
      noOptionsText={t('condicionDeFicha.sinResultados')}
      disabled={deshabilitado}
      renderInput={(parametros) => (
        <TextField {...parametros} label={unico ? t('condicionDeFicha.valor') : t('condicionDeFicha.valores')} placeholder={valores.length === 0 ? t('condicionDeFicha.buscar') : ''} error={error} />
      )}
    />
  );
}
