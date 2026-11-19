import { Box, Typography, type Theme } from '@mui/material';
import type { PendientesDeAreaDto } from '@validalo/api-client';
import { coloresDeKpi, FilaAtencion, type TonoKpi } from '@validalo/ui';
import { CalendarClock, CalendarX, CircleCheck, FolderClock, Landmark, RefreshCw, Workflow, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { antiguedadDeArea, formatearConteo, textoArea, tonoDeAcceso, type Acceso, type ClaveAcceso } from './modelo';

const ICONOS: Readonly<Record<ClaveAcceso, LucideIcon>> = {
  revalidaciones: RefreshCw,
  cuentas: Landmark,
  aperturas: FolderClock,
  porVencer: CalendarClock,
  vencidos: CalendarX,
};

/** El color de la cifra de una fila: el acento si es un pendiente normal; el tono de alerta (ámbar, rojo) si lo es. */
const colorDeCifra = (t: Theme, tono: TonoKpi) => (tono === 'cian' ? t.palette.acento.main : coloresDeKpi(t, tono).texto);

/** La cifra destacada a la derecha de una fila, con su rótulo debajo si lo necesita. */
function CifraDeFila({ valor, unidad, tono }: { valor: string; unidad?: string; tono: TonoKpi }) {
  return (
    <Box sx={{ flex: 'none', textAlign: 'right' }}>
      <Typography variant="h2" component="span" sx={(t) => ({ display: 'block', color: colorDeCifra(t, tono) })}>
        {valor}
      </Typography>
      {unidad && (
        <Typography variant="caption" component="span" sx={{ display: 'block', color: 'text.secondary' }}>
          {unidad}
        </Typography>
      )}
    </Box>
  );
}

/** Una línea de apoyo bajo el título de una fila. */
function Nota({ children, alerta = false }: { children: ReactNode; alerta?: boolean }) {
  return (
    <Typography
      component="span"
      variant="body2"
      sx={(t) => ({ display: 'block', color: alerta ? t.palette.estado.error.texto : t.palette.text.secondary })}
    >
      {children}
    </Typography>
  );
}

/**
 * Fila de un área: con expedientes por revisar es un enlace a la bandeja filtrada por esa área (el nombre, cuánto lleva el más antiguo y la cifra);
 * al día es una fila informativa con el «Al día» en tono de éxito.
 */
export function FilaArea({ area, empresaId }: { area: PendientesDeAreaDto; empresaId: string }) {
  const { t } = useTranslation();
  if (area.cantidad === 0) {
    return (
      <FilaAtencion
        icono={CircleCheck}
        tono="verde"
        truncar={false}
        titulo={area.nombre}
        chip={
          <Typography variant="body2" component="span" sx={(th) => ({ flex: 'none', color: th.palette.estado.exito.texto })}>
            {t('inicio.pendientes.alDia')}
          </Typography>
        }
      />
    );
  }
  return (
    <FilaAtencion
      componente={RouterLink}
      to={`/e/${empresaId}/bandeja?area=${encodeURIComponent(area.areaId)}`}
      aria-label={textoArea(area, t)}
      icono={Workflow}
      truncar={false}
      titulo={area.nombre}
      subtitulo={antiguedadDeArea(area, t)}
      chip={<CifraDeFila valor={formatearConteo(area.cantidad)} unidad={t('inicio.pendientes.cifraPorRevisar')} tono="cian" />}
    />
  );
}

/**
 * Fila de un pendiente que no es de un área (revalidaciones, cuentas, aperturas, documentos): su título, la cifra destacada y, debajo, el aviso
 * en rojo de lo que ya bloquea o la ayuda. Es un enlace a su pantalla cuando la tiene; si no (las cuentas), una fila informativa. El nombre
 * accesible del enlace es la frase completa con la cifra.
 */
export function FilaAcceso({ acceso, empresaId }: { acceso: Acceso; empresaId: string }) {
  const { t } = useTranslation();
  const tono = tonoDeAcceso(acceso);
  const bloqueantes = acceso.bloqueantes ?? 0;
  const textoBloqueantes = bloqueantes > 0 ? t('inicio.pendientes.bloqueantes', { count: bloqueantes }) : null;
  const propiedades = {
    icono: ICONOS[acceso.clave],
    tono,
    truncar: false,
    titulo: t(`inicio.pendientes.etiquetas.${acceso.clave}`),
    chip: <CifraDeFila valor={formatearConteo(acceso.cantidad)} tono={tono} />,
    notas:
      textoBloqueantes || acceso.clave === 'cuentas' ? (
        <>
          {textoBloqueantes && <Nota alerta>{textoBloqueantes}</Nota>}
          {acceso.clave === 'cuentas' && <Nota>{t('inicio.pendientes.cuentasAyuda')}</Nota>}
        </>
      ) : undefined,
  };
  if (!acceso.ruta) return <FilaAtencion {...propiedades} />;
  const frase = t(`inicio.pendientes.${acceso.clave}`, { count: acceso.cantidad });
  return <FilaAtencion {...propiedades} componente={RouterLink} to={`/e/${empresaId}/${acceso.ruta}`} aria-label={[frase, textoBloqueantes].filter(Boolean).join('. ')} />;
}
