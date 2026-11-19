import { Autocomplete, TextField } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buscarPorNombre, type OpcionDeEmpresa } from './resumenEmpresas';

/** «Todas» no es una empresa: es la opción que quita el filtro (su id vacío no coincide con ninguna empresa). */
const ID_TODAS = '';

/**
 * El filtro «Empresa: Todas | …» de arriba de la bóveda, para los terceros con dos o más empresas. Con una elegida, cada documento muestra
 * solo el estado de esa empresa y «Por renovar» se limita a ella. Es un autocompletar porque pueden ser 20 o 30 empresas.
 */
export function FiltroEmpresa({ opciones, elegida, onElegir }: { opciones: readonly OpcionDeEmpresa[]; elegida: OpcionDeEmpresa | null; onElegir: (empresaId: string | null) => void }) {
  const { t } = useTranslation();
  const todas = useMemo<OpcionDeEmpresa>(() => ({ id: ID_TODAS, nombre: t('boveda.filtro.todas') }), [t]);
  const lista = useMemo(() => [todas, ...opciones], [todas, opciones]);
  return (
    <Autocomplete
      options={lista}
      value={elegida ?? todas}
      onChange={(_e, opcion) => onElegir(opcion.id === ID_TODAS ? null : opcion.id)}
      disableClearable
      autoHighlight
      getOptionLabel={(o) => o.nombre}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(opcionesDelMenu, estado) => buscarPorNombre(opcionesDelMenu, estado.inputValue, (o) => o.nombre)}
      noOptionsText={t('boveda.filtro.sinResultados')}
      sx={{ width: { xs: '100%', sm: 360 }, mb: 2 }}
      renderInput={(params) => <TextField {...params} label={t('boveda.filtro.etiqueta')} />}
    />
  );
}
