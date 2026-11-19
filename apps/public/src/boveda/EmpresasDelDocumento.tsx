import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { BotonResumenEmpresas } from './BotonResumenEmpresas';
import { EmpresaDelDocumento } from './EmpresaDelDocumento';
import type { ResumenDeEmpresas } from './resumenEmpresas';

interface Props {
  resumen: ResumenDeEmpresas;
  /** La fecha de vencimiento que dice la cabecera del documento (para que cada empresa diga la suya solo si difiere). */
  referencia: string | null;
  /** Hay una empresa elegida en el filtro de la bóveda: si no exige el documento, el texto dice que no aplica para ella. */
  filtrada: boolean;
  abierto: boolean;
  onAlternar: () => void;
  idDetalle: string;
}

/**
 * La columna «Empresas» de un documento: sin empresas (o sin ninguna que lo exija), un texto gris; con pocas, un chip por empresa (con su
 * frase); con muchas, el resumen por estado que abre el detalle. Las empresas que no exigen el documento no se listan ni se cuentan. Así la
 * fila mide lo mismo con una que con treinta empresas.
 */
export function EmpresasDelDocumento({ resumen, referencia, filtrada, abierto, onAlternar, idDetalle }: Props) {
  const { t } = useTranslation();
  if (resumen.modo === 'vacio' || resumen.modo === 'ninguna') {
    const texto = filtrada ? t('boveda.filtro.sinEstaEmpresa') : resumen.modo === 'vacio' ? t('boveda.sinEmpresas') : t('boveda.ningunaLaExige');
    return (
      <Typography variant="caption" component="p" sx={{ m: 0, color: 'text.secondary' }}>
        {texto}
      </Typography>
    );
  }
  if (resumen.modo === 'resumen') return <BotonResumenEmpresas chips={resumen.chips} abierto={abierto} onAlternar={onAlternar} idDetalle={idDetalle} />;
  return (
    <Box component="ul" aria-label={t('boveda.empresas')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, p: 0, m: 0, minWidth: 0, listStyle: 'none' }}>
      {resumen.empresas.map((c) => (
        <EmpresaDelDocumento key={c.vinculoId} comparticion={c} referencia={referencia} />
      ))}
    </Box>
  );
}
