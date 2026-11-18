import { Box, ButtonBase, Collapse, Divider, LinearProgress, Typography, useMediaQuery, useTheme, type Theme } from '@mui/material';
import type { EstadoFichaDto, EstadoSeccionFichaDto } from '@avalasoft/api-client';
import { PanelFlotante } from '@avalasoft/ui';
import { ArrowLeft, CheckCircle2, ChevronDown, Circle, CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { ALTO_CABECERA, cambioDeEstado } from './movimiento';
import { enlaceSeccion, estadoDeSeccion, filaActual, filasDelResumen, type EstadoDeSeccion } from './secciones';

interface Props {
  estado: EstadoFichaDto;
  /** Sección abierta (código) y su periodo, para marcarla. */
  seccion: string;
  periodo: number | null;
}

/**
 * Panel del wizard que acompaña cada sección: un panel flotante propio (separado del que lleva el formulario, como la barra lateral de la
 * consola de Plataforma) con el encabezado —volver a «Mi información», el avance «2 de 6 secciones completas» y su barra delgada— y debajo todas
 * las secciones con el estado que calculó el servidor (completa, con faltantes o sin diligenciar), marcando la abierta con una píldora blanca.
 * En escritorio va fijo a la izquierda, bajo la barra superior; en el celular es una barra arriba con el paso actual que se despliega. Se
 * actualiza solo: al guardar se vuelve a pedir el estado.
 */
export function NavegacionFicha({ estado, seccion, periodo }: Props) {
  const { t } = useTranslation();
  const escritorio = useMediaQuery(useTheme().breakpoints.up('md'));
  const [abierta, setAbierta] = useState(false);
  const idLista = useId();
  const idTitulo = useId();
  const filas = filasDelResumen(estado);
  const completas = filas.filter((f) => estadoDeSeccion(f) === 'completa').length;
  const todasCompletas = filas.length > 0 && completas === filas.length;
  const actual = filaActual(filas, seccion, periodo);
  const avance = t('ficha.avance', { completas: String(completas), total: String(filas.length) });
  const paso = estado.orden.indexOf(seccion) + 1;
  const nombre = (fila: EstadoSeccionFichaDto) => (fila.periodo ? t('ficha.nombreConPeriodo', { nombre: fila.nombre, periodo: String(fila.periodo) }) : fila.nombre);

  const lista = (
    <Box component="ol" aria-labelledby={escritorio ? idTitulo : undefined} sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {filas.map((fila) => (
        <ItemSeccion key={`${fila.seccion}-${String(fila.periodo)}`} fila={fila} nombre={nombre(fila)} actual={fila === actual} onElegir={() => setAbierta(false)} />
      ))}
    </Box>
  );

  return (
    <PanelFlotante
      component="nav"
      aria-label={t('ficha.navegacion')}
      sx={{
        position: 'sticky',
        // Pegado justo bajo la barra superior, como el panel del formulario al desplazarse.
        top: ALTO_CABECERA,
        zIndex: 2,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        p: 1,
        // Si las secciones no caben en pantallas bajas, la lista desplaza dentro del panel (el encabezado se queda).
        maxHeight: { md: `calc(100dvh - ${String(ALTO_CABECERA + 16)}px)` },
      }}
    >
      {/* Encabezado: volver (con el nombre del apartado como título) y el avance. */}
      <Box sx={{ flex: 'none', pb: escritorio ? 1.25 : 1 }}>
        <ButtonBase
          component={RouterLink}
          to="/ficha"
          sx={(th: Theme) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 1,
            width: '100%',
            minHeight: 40,
            // El centro del recuadro de la flecha queda en la misma vertical que el de los íconos de estado de la lista (10 + 9 = 5 + 14 px).
            px: '5px',
            borderRadius: '10px',
            textAlign: 'left',
            '&:hover': { bgcolor: th.palette.superficie.nivel2 },
          })}
        >
          <Box
            aria-hidden
            sx={(th: Theme) => ({ display: 'grid', placeItems: 'center', flex: 'none', width: 28, height: 28, borderRadius: '8px', bgcolor: th.palette.acento.tinte, color: th.palette.acento.main })}
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </Box>
          <Typography component="span" sx={{ fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>
            {t('ficha.volverResumen')}
          </Typography>
        </ButtonBase>
        <Box sx={{ px: 1.25, pt: 0.75 }}>
          <Typography sx={{ color: todasCompletas ? 'success.dark' : 'text.secondary', fontSize: 13, lineHeight: '18px', mb: 0.75 }}>{avance}</Typography>
          <LinearProgress
            variant="determinate"
            color={todasCompletas ? 'success' : 'primary'}
            value={filas.length > 0 ? (completas / filas.length) * 100 : 0}
            aria-label={avance}
            sx={{ height: 3, borderRadius: '2px' }}
          />
        </Box>
      </Box>

      {!escritorio && (
        <ButtonBase
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-controls={idLista}
          sx={(th: Theme) => ({ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: '10px', bgcolor: th.palette.superficie.nivel2, textAlign: 'left' })}
        >
          <Box sx={{ minWidth: 0 }}>
            {paso > 0 && <Typography sx={{ color: 'text.secondary', fontSize: 12, lineHeight: '16px' }}>{t('ficha.paso', { n: String(paso), total: String(estado.orden.length) })}</Typography>}
            <Typography sx={{ fontWeight: 500, fontSize: 15, lineHeight: '22px' }}>{actual ? nombre(actual) : ''}</Typography>
          </Box>
          <Box component="span" sx={{ display: 'inline-flex', flex: 'none', transition: 'transform 150ms', transform: abierta ? 'rotate(180deg)' : 'none' }}>
            <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
          </Box>
        </ButtonBase>
      )}

      {escritorio ? (
        <>
          <Divider sx={{ flex: 'none', mb: 1 }} />
          <Typography id={idTitulo} component="p" sx={{ flex: 'none', m: 0, px: 1.25, pb: 0.5, fontSize: 12, lineHeight: '16px', fontWeight: 500, color: 'text.secondary' }}>
            {t('ficha.secciones')}
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{lista}</Box>
        </>
      ) : (
        <Collapse in={abierta} id={idLista} sx={{ mt: abierta ? 0.5 : 0 }}>
          {lista}
        </Collapse>
      )}
    </PanelFlotante>
  );
}

const COLOR: Record<EstadoDeSeccion, string> = { completa: 'success.main', incompleta: 'warning.main', 'sin-diligenciar': 'text.disabled' };
const ICONO = { completa: CheckCircle2, incompleta: CircleAlert, 'sin-diligenciar': Circle } as const;

function ItemSeccion({ fila, nombre, actual, onElegir }: { fila: EstadoSeccionFichaDto; nombre: string; actual: boolean; onElegir: () => void }) {
  const { t } = useTranslation();
  const estado = estadoDeSeccion(fila);
  const Icono = ICONO[estado];
  const detalle = estado === 'incompleta' ? t('ficha.estados.incompleta', { count: fila.faltantes.length }) : t(`ficha.estados.${estado}`);

  return (
    <Box component="li">
      <ButtonBase
        component={RouterLink}
        to={enlaceSeccion(fila.seccion, fila.periodo)}
        onClick={onElegir}
        aria-current={actual ? 'step' : undefined}
        aria-label={t('ficha.itemNavegacion', { seccion: nombre, estado: detalle })}
        sx={(th: Theme) => ({
          display: 'flex',
          width: '100%',
          minHeight: 40,
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 1.25,
          px: 1.25,
          py: 0.5,
          textAlign: 'left',
          borderRadius: '10px',
          // El activo es una píldora blanca con sombra suave (como la barra de la consola); sin barras de color ni divisores.
          bgcolor: actual ? th.palette.background.paper : 'transparent',
          boxShadow: actual ? th.sombra.pildora : 'none',
          '&:hover': { bgcolor: actual ? th.palette.background.paper : th.palette.superficie.nivel2 },
          transition: 'background-color 200ms',
        })}
      >
        <Box key={estado} component="span" sx={{ display: 'inline-flex', flex: 'none', color: COLOR[estado], animation: `${cambioDeEstado} 320ms ease-out` }}>
          <Icono size={18} strokeWidth={1.75} aria-hidden />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, lineHeight: '20px', fontWeight: actual ? 500 : 400, color: actual ? 'text.primary' : 'text.secondary' }}>{nombre}</Typography>
          {/* El ícono ya dice «completa» o «sin diligenciar»: el texto solo para lo que pide acción. */}
          {estado === 'incompleta' && <Typography sx={{ fontSize: 12, lineHeight: '16px', color: 'warning.dark' }}>{detalle}</Typography>}
        </Box>
      </ButtonBase>
    </Box>
  );
}
