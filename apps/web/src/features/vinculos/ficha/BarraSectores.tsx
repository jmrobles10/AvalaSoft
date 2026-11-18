import { Box, ButtonBase, Typography } from '@mui/material';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONO_SECTOR, type IndicadorSector, type Sector } from './sectores';

/**
 * Grupos de la barra: el proceso en curso, la información del tercero (con los sectores y el orden de la ficha del proveedor del SRM)
 * y el registro de lo que ya pasó.
 */
const GRUPOS: { clave: 'proceso' | 'informacion' | 'registro'; sectores: Sector[] }[] = [
  { clave: 'proceso', sectores: ['aprobaciones'] },
  { clave: 'informacion', sectores: ['general', 'sst', 'cuenta', 'tributaria', 'financiera', 'contactos', 'autorizacion', 'legal', 'cumplimiento'] },
  { clave: 'registro', sectores: ['documentos', 'evaluaciones', 'certificado', 'historial'] },
];

interface Props {
  actual: Sector;
  indicadores: Partial<Record<Sector, IndicadorSector>>;
  onElegir: (sector: Sector) => void;
}

/**
 * Barra lateral de la ficha del vínculo: una tarjeta flotante (fija al desplazar) con los sectores agrupados, el actual resaltado y, en
 * cada uno, cuántos requisitos del expediente siguen pendientes (en advertencia si alguno está observado o rechazado). En pantallas
 * angostas se vuelve una fila desplazable arriba.
 */
export function BarraSectores({ actual, indicadores, onElegir }: Props) {
  const { t } = useTranslation();
  return (
    <Box
      component="nav"
      aria-label={t('vinculos.ficha.sectores')}
      sx={{
        position: { lg: 'sticky' },
        top: { lg: 'calc(var(--vs-tope, 0px) + var(--vs-alto-encabezado, 96px) + 12px)' },
        // Sin scroll propio (un solo scroll: el de la página). Es compacta para caber entera; en pantallas muy bajas deja de fijarse.
        '@media (max-height: 640px)': { position: 'static' },
        alignSelf: 'start',
        display: 'flex',
        flexDirection: { xs: 'row', lg: 'column' },
        gap: { xs: 0.5, lg: 0 },
        overflowX: { xs: 'auto', lg: 'visible' },
        p: { xs: 0.75, lg: 0.75 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: (th) => `${String(th.radio.md)}px`,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px -12px rgba(16, 24, 40, 0.18)',
      }}
    >
      {GRUPOS.map((grupo, i) => (
        <Fragment key={grupo.clave}>
          {/* Separador entre grupos: horizontal en la barra lateral, vertical en la fila de pantallas angostas. */}
          {i > 0 && <Box aria-hidden sx={{ flex: 'none', alignSelf: 'stretch', width: { xs: '1px', lg: 'auto' }, height: { xs: 'auto', lg: '1px' }, bgcolor: 'divider', mx: { xs: 0.5, lg: 1 }, my: { xs: 0.5, lg: 0.5 } }} />}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', lg: 'column' }, gap: '1px', flex: 'none' }}>
            <Typography
              component="span"
              sx={{ display: { xs: 'none', lg: 'block' }, px: 1, pt: 0.25, pb: 0.25, fontSize: 11, lineHeight: '16px', letterSpacing: 0.6, textTransform: 'uppercase', color: 'text.secondary' }}
            >
              {t(`vinculos.ficha.grupos.${grupo.clave}`)}
            </Typography>
            {grupo.sectores.map((sector) => (
              <ItemSector key={sector} sector={sector} activo={sector === actual} indicador={indicadores[sector]} onElegir={onElegir} />
            ))}
          </Box>
        </Fragment>
      ))}
    </Box>
  );
}

function ItemSector({ sector, activo, indicador, onElegir }: { sector: Sector; activo: boolean; indicador: IndicadorSector | undefined; onElegir: (s: Sector) => void }) {
  const { t } = useTranslation();
  const Icono = ICONO_SECTOR[sector];
  const nombre = t(`vinculos.ficha.sector.${sector}`);
  const pendientes = indicador?.pendientes ?? 0;
  return (
    <ButtonBase
      onClick={() => onElegir(sector)}
      aria-current={activo ? 'page' : undefined}
      aria-label={pendientes > 0 ? t('vinculos.ficha.conPendientes', { sector: nombre, count: pendientes }) : nombre}
      title={nombre}
      sx={{
        position: 'relative',
        flex: 'none',
        justifyContent: 'flex-start',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: (th) => `${String(th.radio.sm)}px`,
        fontSize: 13.5,
        lineHeight: '20px',
        minHeight: 30,
        textAlign: 'left',
        whiteSpace: 'nowrap',
        color: activo ? 'primary.main' : 'text.primary',
        bgcolor: activo ? (th) => `color-mix(in srgb, ${th.palette.primary.main} 9%, transparent)` : 'transparent',
        fontWeight: activo ? 600 : 400,
        transition: 'background-color 120ms, color 120ms',
        '&::before': activo
          ? { content: '""', position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, bgcolor: 'primary.main', display: { xs: 'none', lg: 'block' } }
          : undefined,
        '&:hover': { bgcolor: activo ? undefined : 'action.hover' },
        '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Icono size={16} strokeWidth={1.75} aria-hidden style={{ flex: 'none' }} />
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nombre}
      </Box>
      {pendientes > 0 && (
        <Box
          component="span"
          aria-hidden
          sx={{
            minWidth: 20,
            height: 20,
            px: 0.75,
            borderRadius: 10,
            fontSize: 11,
            lineHeight: '20px',
            textAlign: 'center',
            fontWeight: 600,
            bgcolor: indicador?.conProblema ? 'estado.advertencia.fondo' : 'action.hover',
            color: indicador?.conProblema ? 'estado.advertencia.texto' : 'text.secondary',
          }}
        >
          {pendientes}
        </Box>
      )}
    </ButtonBase>
  );
}
