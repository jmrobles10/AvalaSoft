import { Box, Stack, Typography } from '@mui/material';
import type { MisPendientesDto } from '@validalo/api-client';
import { coloresDeKpi, EsqueletoFilas, Sobretitulo } from '@validalo/ui';
import { CircleCheck, ListChecks } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorRecuperable, Tarjeta } from '../../shared/componentes';
import { mensajeDeError } from '../../shared/errores';
import { useMisPendientes } from './api';
import { FilaAcceso, FilaArea } from './FilasPendientes';
import { accesosPendientes, estaAlDia } from './modelo';

/** Una columna de «Lo que te toca»: su sobretítulo y la lista de filas. */
function Columna({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Sobretitulo sx={{ px: 1.5, pb: 0.75 }}>{titulo}</Sobretitulo>
      <Stack component="ul" spacing={0.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {children}
      </Stack>
    </Box>
  );
}

/** Todo en cero: un mensaje en tono de éxito (ícono verde en su círculo), sin sonar a error ni a vacío. */
function TodoAlDia() {
  const { t } = useTranslation();
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 2, px: { xs: 2, sm: 2.5 }, py: { xs: 2, sm: 2.25 } }}>
      <Box
        aria-hidden
        sx={(th) => ({ display: 'grid', placeItems: 'center', flex: 'none', width: 44, height: 44, borderRadius: '50%', bgcolor: coloresDeKpi(th, 'verde').fondo, color: coloresDeKpi(th, 'verde').texto })}
      >
        <CircleCheck size={22} strokeWidth={1.75} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" component="p">
          {t('inicio.pendientes.vacio')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('inicio.pendientes.vacioAyuda')}
        </Typography>
      </Box>
    </Stack>
  );
}

function Pendientes({ datos, empresaId }: { datos: MisPendientesDto; empresaId: string }) {
  const { t } = useTranslation();
  const accesos = accesosPendientes(datos);
  const dosColumnas = datos.porArea.length > 0 && accesos.length > 0;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: dosColumnas ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }, columnGap: 3, rowGap: 2, p: { xs: 1, sm: 1.5 } }}>
      {datos.porArea.length > 0 && (
        <Columna titulo={t('inicio.pendientes.porArea')}>
          {datos.porArea.map((a) => (
            <li key={a.areaId}>
              <FilaArea area={a} empresaId={empresaId} />
            </li>
          ))}
        </Columna>
      )}
      {accesos.length > 0 && (
        <Columna titulo={t('inicio.pendientes.otros')}>
          {accesos.map((a) => (
            <li key={a.clave}>
              <FilaAcceso acceso={a} empresaId={empresaId} />
            </li>
          ))}
        </Columna>
      )}
    </Box>
  );
}

/**
 * «Lo que te toca» (INI-1): expedientes por revisar en tus áreas y los demás pendientes, cada uno con su pantalla, en un panel con filas de
 * ícono, nombre, cifra destacada y chevron. Carga con esqueletos de filas; si todo está en cero, un vacío en tono de éxito.
 */
export function LoQueTeToca({ empresaId }: { empresaId: string }) {
  const { t } = useTranslation();
  const consulta = useMisPendientes(empresaId);
  const datos = consulta.data;
  const titulo = t('inicio.pendientes.titulo');

  let contenido: ReactNode;
  let sinRelleno = true;
  if (consulta.isError && !datos) {
    sinRelleno = false;
    contenido = <ErrorRecuperable mensaje={`${t('inicio.pendientes.error')} ${mensajeDeError(consulta.error, t)}`} onReintentar={() => void consulta.refetch()} />;
  } else if (!datos) {
    contenido = <EsqueletoFilas cantidad={3} etiqueta={t('inicio.pendientes.cargando')} sx={{ p: { xs: 1, sm: 1.5 } }} />;
  } else if (estaAlDia(datos)) {
    contenido = <TodoAlDia />;
  } else {
    contenido = <Pendientes datos={datos} empresaId={empresaId} />;
  }

  return (
    <Tarjeta titulo={titulo} etiqueta={titulo} icono={ListChecks} sinRelleno={sinRelleno}>
      {contenido}
    </Tarjeta>
  );
}
