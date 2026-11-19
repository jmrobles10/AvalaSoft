import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { EsqueletoKpis, SeccionPlana } from '@validalo/ui';
import { FolderOpen, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ErrorRecuperable } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { ResumenKpis } from '../../shared/ResumenKpis';
import { rutaInformeDeVentana } from '../informes/modelo';
import { useIndicadores } from './api';
import { kpisCertificados, kpisExpedientes, kpisVinculos } from './kpisIndicadores';
import { leerVentana, VENTANA_POR_DEFECTO, type Ventana } from './modelo';
import { RepartoVinculos } from './RepartoVinculos';
import { SelectorVentana } from './SelectorVentana';

/** Un grupo de indicadores: su título con ícono en el acento y, debajo, lo que lo compone (las tarjetas de cifras y, si hay, más). */
function Grupo({ titulo, icono, children }: { titulo: string; icono: typeof Users; children: ReactNode }) {
  return (
    <Box>
      <SeccionPlana titulo={titulo} icono={icono} nivel="h3">
        {children}
      </SeccionPlana>
    </Box>
  );
}

/** Los tres grupos con la forma de lo que llega: el rótulo del grupo y sus tarjetas grises (5 de vínculos, 6 de expedientes y 3 de certificados como mínimo). */
function EsqueletoIndicadores({ etiqueta }: { etiqueta: string }) {
  return (
    <Stack spacing={2.5} role="status" aria-busy aria-label={etiqueta}>
      {[5, 6, 3].map((cantidad) => (
        <Box key={cantidad}>
          <Skeleton variant="rounded" width={140} height={18} sx={{ mb: 1.25 }} />
          <EsqueletoKpis cantidad={cantidad} />
        </Box>
      ))}
    </Stack>
  );
}

/**
 * Indicadores de la empresa (INI-2) como tarjetas de cifras del tablero: vínculos y certificados al momento; expedientes en curso al momento y,
 * en la ventana elegida (7, 30 o 90 días, en la URL), los aprobados, rechazados y el tiempo de la apertura a la aprobación. Las cifras de alerta
 * (vencidos, bloqueados, observados, rechazados, con pendientes, no válidos) van en rojo si hay alguna.
 */
export function Indicadores({ empresaId, puedeVerVinculos, puedeVerCertificados = false }: { empresaId: string; puedeVerVinculos: boolean; puedeVerCertificados?: boolean }) {
  const { t } = useTranslation();
  const [parametros, setParametros] = useSearchParams();
  const dias = leerVentana(parametros);
  const consulta = useIndicadores(empresaId, dias);
  const datos = consulta.data;

  // La ventana por defecto no se escribe en la URL.
  const cambiarVentana = (valor: Ventana) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        if (valor === VENTANA_POR_DEFECTO) nuevos.delete('dias');
        else nuevos.set('dias', String(valor));
        return nuevos;
      },
      { replace: true },
    );
  const aVinculos = (estado: string) => (puedeVerVinculos ? `/e/${empresaId}/vinculos?estado=${estado}` : null);
  const aCertificados = (estado: string) => (puedeVerCertificados ? `/e/${empresaId}/certificados?estado=${estado}` : null);
  // Los aprobados y su tiempo llevan al informe de estado con la misma ventana y medida (IF-7).
  const aInforme = rutaInformeDeVentana(empresaId, dias);

  return (
    <Box component="section" aria-labelledby="titulo-indicadores">
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Typography variant="h6" component="h2" id="titulo-indicadores">
          {t('inicio.indicadores.titulo')}
        </Typography>
        <SelectorVentana valor={dias} onCambiar={cambiarVentana} />
      </Stack>

      {consulta.isError && !datos ? (
        <ErrorRecuperable mensaje={`${t('inicio.indicadores.error')} ${mensajeDeError(consulta.error, t)}`} onReintentar={() => void consulta.refetch()} />
      ) : !datos ? (
        <EsqueletoIndicadores etiqueta={t('inicio.indicadores.cargando')} />
      ) : (
        <Stack spacing={2.5} sx={{ opacity: consulta.isPlaceholderData ? 0.6 : 1, transition: 'opacity 120ms' }} aria-busy={consulta.isPlaceholderData || undefined}>
          <Grupo titulo={t('inicio.indicadores.vinculos')} icono={Users}>
            <ResumenKpis kpis={kpisVinculos(datos, t, aVinculos)} />
            <Box sx={{ mt: 1.5 }}>
              <RepartoVinculos indicadores={datos} />
            </Box>
          </Grupo>
          <Grupo titulo={t('inicio.indicadores.expedientes')} icono={FolderOpen}>
            <ResumenKpis kpis={kpisExpedientes(datos, t, aInforme)} />
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              {t('inicio.indicadores.enLaVentana', { count: datos.dias })}
            </Typography>
          </Grupo>
          <Grupo titulo={t('inicio.indicadores.certificados')} icono={ShieldCheck}>
            <ResumenKpis kpis={kpisCertificados(datos, t, aCertificados)} />
          </Grupo>
        </Stack>
      )}
    </Box>
  );
}
