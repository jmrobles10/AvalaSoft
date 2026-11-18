import { Box, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type { EmpresaDeGrupoDto, GrupoDto } from '@avalasoft/api-client';
import { FilaAtencion, formatearFecha, MiniBarra, TarjetaBloque, TarjetaKpi } from '@avalasoft/ui';
import { Bell, Building2, Factory, KeyRound, ShieldQuestion, Sparkles, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useSesion } from '../../sesion/sesionStore';
import { useGrupos } from './api';
import { useSolicitudesDeAcceso } from './apiAccesos';
import { estadoPlanIa } from './modelo';

/** Cuántas filas de «Necesita atención» de cada clase se muestran (el resto está en su pantalla). */
const MAXIMO_POR_CLASE = 3;

interface Atencion {
  clave: string;
  icono: LucideIcon;
  tono: 'cian' | 'ambar';
  titulo: string;
  subtitulo: string;
  chip: string;
  a: string;
}

/** «Buenos días» / «Buenas tardes» / «Buenas noches» según la hora de quien mira (no se inventa nada: es el reloj). */
function saludoDeLaHora(ahora: Date): 'dias' | 'tardes' | 'noches' {
  const hora = ahora.getHours();
  return hora < 12 ? 'dias' : hora < 19 ? 'tardes' : 'noches';
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

/**
 * Portada de la consola (encabezado de «Grupos y empresas»): el saludo con una frase que resume lo que hay, cuatro cifras y la lista «Necesita
 * atención». Todo sale de lo que la API ya entrega para esta pantalla (los grupos con sus empresas y la cola de solicitudes de acceso): sin
 * cifras inventadas ni gráficas de series que no existen. Si los grupos no cargan, no se muestra nada (la lista de abajo ya da el error).
 */
export function TableroPlataforma() {
  const { t } = useTranslation();
  const sesion = useSesion((s) => s.sesion);
  const grupos = useGrupos('');
  const cola = useSolicitudesDeAcceso('cola');

  const datos = useMemo(() => {
    const lista: GrupoDto[] = (grupos.data?.pages ?? []).flatMap((p) => p.datos);
    const empresas: { grupo: GrupoDto; empresa: EmpresaDeGrupoDto }[] = lista.flatMap((grupo) => grupo.empresas.map((empresa) => ({ grupo, empresa })));
    return {
      grupos: lista.length,
      empresas: empresas.length,
      conPlan: empresas.filter(({ empresa }) => estadoPlanIa(empresa) === 'activo').length,
      sinPlan: empresas.filter(({ empresa }) => estadoPlanIa(empresa) === 'sin-plan'),
    };
  }, [grupos.data]);

  if (grupos.isError) return null;
  const hayMas = grupos.hasNextPage;
  const mas = hayMas ? '+' : '';
  const solicitudes = cola.data ?? [];
  const nombre = primerNombre(sesion?.nombre ?? sesion?.usuarioId ?? '');

  const atencion: Atencion[] = [
    ...solicitudes.slice(0, MAXIMO_POR_CLASE).map((s) => ({
      clave: `solicitud-${s.id}`,
      icono: KeyRound,
      tono: 'ambar' as const,
      titulo: s.tercero,
      subtitulo: t('plataforma.tablero.atencion.solicitud', { fecha: formatearFecha(s.desde) }),
      chip: t('plataforma.tablero.atencion.chipSolicitud'),
      a: '/plataforma/accesos-a-terceros',
    })),
    ...datos.sinPlan.slice(0, MAXIMO_POR_CLASE).map(({ grupo, empresa }) => ({
      clave: `plan-${empresa.id}`,
      icono: Sparkles,
      tono: 'cian' as const,
      titulo: empresa.nombre,
      subtitulo: t('plataforma.tablero.atencion.sinPlan', { grupo: grupo.tenant.nombre }),
      chip: t('plataforma.tablero.atencion.chipSinPlan'),
      a: `/plataforma/grupos/${grupo.tenant.id}/empresas/${empresa.id}/plan-ia`,
    })),
  ];

  const resumen = [
    t('plataforma.tablero.resumen', {
      grupos: t('plataforma.tablero.nGrupos', { count: datos.grupos, n: `${String(datos.grupos)}${mas}` }),
      empresas: t('plataforma.tablero.nEmpresas', { count: datos.empresas, n: `${String(datos.empresas)}${mas}` }),
    }),
    solicitudes.length > 0 ? t('plataforma.tablero.resumenSolicitudes', { count: solicitudes.length }) : t('plataforma.tablero.resumenAlDia'),
  ].join(' ');

  return (
    <Box component="section" aria-label={t('plataforma.tablero.etiqueta')} sx={{ mb: 4 }}>
      <Typography component="p" sx={{ m: 0, fontSize: { xs: 24, sm: 28 }, lineHeight: { xs: '32px', sm: '36px' }, fontWeight: 500, letterSpacing: '-0.02em' }}>
        {t(`plataforma.tablero.saludo.${saludoDeLaHora(new Date())}`, { nombre })}
      </Typography>
      {grupos.isPending ? (
        <Skeleton variant="rounded" width={420} height={16} sx={{ mt: 1, maxWidth: '90%' }} />
      ) : (
        <Typography component="p" sx={{ m: 0, mt: 0.5, color: 'text.secondary', fontSize: 14, lineHeight: '20px' }}>
          {resumen}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2, mt: 2.5 }}>
        {grupos.isPending ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: (th) => `${String(th.radio.md)}px` }} />)
        ) : (
          <>
            <TarjetaKpi icono={Building2} tono="cian" titulo={t('plataforma.tablero.kpi.grupos')} valor={`${String(datos.grupos)}${mas}`} detalle={t('plataforma.tablero.kpi.gruposDetalle')} />
            <TarjetaKpi icono={Factory} tono="violeta" titulo={t('plataforma.tablero.kpi.empresas')} valor={`${String(datos.empresas)}${mas}`} detalle={t('plataforma.tablero.kpi.empresasDetalle')} />
            <TarjetaKpi
              icono={Sparkles}
              tono="verde"
              titulo={t('plataforma.tablero.kpi.planes')}
              valor={`${String(datos.conPlan)}${mas}`}
              detalle={t('plataforma.tablero.kpi.planesDetalle', { total: String(datos.empresas) })}
              grafica={<MiniBarra valor={datos.conPlan} total={datos.empresas} tono="verde" etiqueta={t('plataforma.tablero.kpi.planesBarra', { activas: String(datos.conPlan), total: String(datos.empresas) })} />}
            />
            <TarjetaKpi
              icono={ShieldQuestion}
              tono="ambar"
              titulo={t('plataforma.tablero.kpi.solicitudes')}
              valor={cola.isPending ? '—' : String(solicitudes.length)}
              detalle={t('plataforma.tablero.kpi.solicitudesDetalle')}
            />
          </>
        )}
      </Box>

      {atencion.length > 0 && (
        <TarjetaBloque titulo={t('plataforma.tablero.atencion.titulo')} ayuda={t('plataforma.tablero.atencion.ayuda')} icono={Bell} etiqueta={t('plataforma.tablero.atencion.titulo')} sx={{ mt: 2 }} sinRelleno>
          <Stack component="ul" spacing={0.25} sx={{ listStyle: 'none', m: 0, p: 1 }}>
            {atencion.map((a) => (
              <li key={a.clave}>
                <FilaAtencion
                  componente={RouterLink}
                  to={a.a}
                  icono={a.icono}
                  tono={a.tono}
                  titulo={a.titulo}
                  subtitulo={a.subtitulo}
                  chip={<Chip size="small" color={a.tono === 'ambar' ? 'warning' : 'primary'} label={a.chip} />}
                />
              </li>
            ))}
          </Stack>
        </TarjetaBloque>
      )}
    </Box>
  );
}
