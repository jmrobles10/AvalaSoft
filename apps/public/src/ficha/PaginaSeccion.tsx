import { Box, Button } from '@mui/material';
import type { EstadoFichaDto } from '@validalo/api-client';
import { PaginaEstado } from '@validalo/ui';
import { ClipboardX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router';
import { ErrorRecuperable, EsqueletoTarjetas, PanelDelTercero } from '../shared/componentes';
import { useEstadoFicha, useSeccionFicha } from './api';
import { EditorSeccion } from './EditorSeccion';
import { NavegacionFicha } from './NavegacionFicha';
import { periodoPorOmision, seccionPorRuta, type DefinicionSeccion } from './secciones';

/** Ancho de la columna del panel de secciones (escritorio). */
const ANCHO_NAVEGACION = 272;

/**
 * Formulario de una sección del wizard (`/ficha/:seccion`, la financiera con `?periodo=`). Lee el estado de la ficha
 * (tipo de persona y orden) y la versión vigente de la sección; una sección que no está en el orden (la persona
 * natural no diligencia Legal ni Financiera) no se abre. Sobre el lienzo van dos paneles flotantes separados: a la izquierda el de las
 * secciones y su estado (`NavegacionFicha`) y a la derecha el del formulario. El Shell no pone panel a esta ruta: lo ponen sus estados.
 */
export function PaginaSeccion() {
  const { t } = useTranslation();
  const { seccion: ruta } = useParams();
  const [parametros] = useSearchParams();
  const definicion = seccionPorRuta(ruta);
  const estado = useEstadoFicha();

  const volver = (
    <Button component={RouterLink} to="/ficha" variant="contained">
      {t('ficha.volverResumen')}
    </Button>
  );
  if (!definicion) return <EnPanel><PaginaEstado icono={ClipboardX} titulo={t('ficha.noExisteTitulo')} texto={t('ficha.noAplicaTexto')} acciones={volver} /></EnPanel>;
  if (estado.isPending) return <EnPanel><EsqueletoTarjetas cantidad={3} /></EnPanel>;
  if (estado.isError) return <EnPanel><ErrorRecuperable error={estado.error} onReintentar={() => void estado.refetch()} /></EnPanel>;
  if (!estado.data.orden.includes(definicion.codigo)) {
    return <EnPanel><PaginaEstado icono={ClipboardX} titulo={t('ficha.noAplicaTitulo')} texto={t('ficha.noAplicaTexto')} acciones={volver} /></EnPanel>;
  }

  const pedido = Number(parametros.get('periodo'));
  const periodo = definicion.porPeriodo ? (Number.isInteger(pedido) && pedido >= 1990 ? pedido : periodoPorOmision(estado.data)) : null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: `${String(ANCHO_NAVEGACION)}px minmax(0, 1fr)` }, gap: { xs: 1.5, md: 2 }, alignItems: 'start' }}>
      <NavegacionFicha estado={estado.data} seccion={definicion.codigo} periodo={periodo} />
      <PanelDelTercero sx={{ minWidth: 0 }}>
        <CargaSeccion key={`${definicion.codigo}-${String(periodo)}`} definicion={definicion} periodo={periodo} estado={estado.data} />
      </PanelDelTercero>
    </Box>
  );
}

/** Los estados de la página (cargando, error, no aplica) en un panel flotante, como el formulario. */
function EnPanel({ children }: { children: ReactNode }) {
  return <PanelDelTercero>{children}</PanelDelTercero>;
}

function CargaSeccion({ definicion, periodo, estado }: { definicion: DefinicionSeccion; periodo: number | null; estado: EstadoFichaDto }) {
  const consulta = useSeccionFicha(definicion.codigo, periodo);
  // «Actualizar» ante un cambio nuevo con lo escrito sin guardar: el formulario se arma de nuevo con lo del servidor.
  const [reinicios, setReinicios] = useState(0);
  if (consulta.isPending) return <EsqueletoTarjetas cantidad={3} />;
  if (consulta.isError) return <ErrorRecuperable error={consulta.error} onReintentar={() => void consulta.refetch()} />;
  return <EditorSeccion key={reinicios} definicion={definicion} periodo={periodo} estado={estado} inicial={consulta.data} onReiniciar={() => setReinicios((n) => n + 1)} />;
}
