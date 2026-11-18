import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getObtenerVersionTextoLegalQueryOptions, type EventoHistorialDto } from '@validasoft/api-client';
import { EstadoVacio, formatearFecha, formatearFechaHora } from '@validasoft/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorRecuperable, Tarjeta } from '../../../shared/componentes';
import { conEmpresa } from '../../../shared/consultas';
import { mensajeDeError } from '../../../shared/errores';
import { useHistorialVinculo } from '../api';

interface Aceptado {
  id: string;
  tipo: string;
  version: number;
  hash: string;
}

interface Aceptacion {
  fecha: string;
  consentimientos: Aceptado[];
  correo: string | null;
  otpVerificado: boolean;
}

const TIPOS = ['AvisoPlataforma', 'AutorizacionEmpresa', 'TerminosEmpresa'] as const;
const esTipo = (tipo: string): tipo is (typeof TIPOS)[number] => (TIPOS as readonly string[]).includes(tipo);

/** Lee las aceptaciones del evento `ConsentimientosRegistrados` del historial (la evidencia vive en el evento, no en otro recurso). */
function aceptacionesDe(eventos: readonly EventoHistorialDto[] | undefined): Aceptacion[] {
  const objeto = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null);
  return (eventos ?? [])
    .filter((e) => e.tipo.replace(/_/g, '').toLowerCase() === 'consentimientosregistrados')
    .map((e) => {
      const lista = Array.isArray(e.datos.consentimientos) ? (e.datos.consentimientos as unknown[]) : [];
      const evidencia = objeto(e.datos.evidencia);
      return {
        fecha: e.fecha,
        consentimientos: lista
          .map(objeto)
          .filter((c): c is Record<string, unknown> => c !== null)
          .map((c) => ({ id: typeof c.textoLegalId === 'string' ? c.textoLegalId : '', tipo: typeof c.tipo === 'string' ? c.tipo : '', version: Number(c.version ?? 0), hash: typeof c.hash === 'string' ? c.hash : '' })),
        correo: typeof evidencia?.correo === 'string' ? evidencia.correo : null,
        otpVerificado: evidencia?.otpVerificado === true,
      };
    })
    .reverse();
}

/**
 * Lo que el tercero aceptó al entrar (autorización de datos, términos de la empresa y el aviso de la plataforma), con la versión del
 * texto, la fecha y la evidencia (correo y si lo verificó con un código). Es el «Autorización y declaración» del SRM.
 */
export function AceptacionesDelTercero({ empresaId, vinculoId }: { empresaId: string; vinculoId: string }) {
  const { t } = useTranslation();
  const consulta = useHistorialVinculo(empresaId, vinculoId);
  const aceptaciones = useMemo(() => aceptacionesDe(consulta.data), [consulta.data]);
  const [abierto, setAbierto] = useState<Aceptado | null>(null);
  const nombreDe = (tipo: string) => (esTipo(tipo) ? t(`vinculos.ficha.aceptaciones.tipos.${tipo}`) : tipo);

  return (
    <Tarjeta titulo={t('vinculos.ficha.aceptaciones.titulo')}>
      {consulta.isError && <ErrorRecuperable mensaje={t('vinculos.detalle.errorHistorial')} onReintentar={() => void consulta.refetch()} />}
      {consulta.data && aceptaciones.length === 0 && <EstadoVacio compacto titulo={t('vinculos.ficha.aceptaciones.vacio')} texto={t('vinculos.ficha.aceptaciones.vacioAyuda')} />}
      <Stack spacing={1.5}>
        {aceptaciones.map((a) => (
          <Box key={a.fecha}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
              {t('vinculos.ficha.aceptaciones.cuando', { fecha: formatearFechaHora(a.fecha) })}
              {a.correo && ` · ${a.correo}`}
              {a.otpVerificado && ` · ${t('vinculos.ficha.aceptaciones.conCodigo')}`}
            </Typography>
            <Stack component="ul" spacing={0.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {a.consentimientos.map((c) => (
                <Typography component="li" key={`${c.tipo}-${String(c.version)}`} sx={{ fontSize: 14, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 0.5 }} title={c.hash ? `SHA-256 ${c.hash}` : undefined}>
                  {nombreDe(c.tipo)}
                  <Typography component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>
                    {' · '}
                    {t('vinculos.ficha.aceptaciones.version', { n: String(c.version) })}
                  </Typography>
                  {c.id && (
                    <Button size="small" variant="text" sx={{ ml: 0.5, minWidth: 0, py: 0 }} onClick={() => setAbierto(c)} aria-label={t('vinculos.ficha.aceptaciones.verAccesible', { texto: nombreDe(c.tipo), n: String(c.version) })}>
                      {t('vinculos.ficha.aceptaciones.ver')}
                    </Button>
                  )}
                </Typography>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
      {abierto && <DialogoTextoAceptado empresaId={empresaId} aceptado={abierto} titulo={nombreDe(abierto.tipo)} onCerrar={() => setAbierto(null)} />}
    </Tarjeta>
  );
}

/** El texto exacto que el tercero aceptó (esa versión, aunque ya haya otra vigente). */
function DialogoTextoAceptado({ empresaId, aceptado, titulo, onCerrar }: { empresaId: string; aceptado: Aceptado; titulo: string; onCerrar: () => void }) {
  const { t } = useTranslation();
  const opciones = getObtenerVersionTextoLegalQueryOptions(aceptado.id, { request: { empresa: empresaId } });
  const consulta = useQuery({ ...opciones, queryKey: conEmpresa(opciones.queryKey, empresaId), staleTime: Infinity });
  return (
    <Dialog open onClose={onCerrar} maxWidth="md" fullWidth aria-labelledby="titulo-texto-aceptado">
      <DialogTitle id="titulo-texto-aceptado">
        {titulo}
        <Typography component="span" sx={{ display: 'block', color: 'text.secondary', fontSize: 13 }}>
          {t('vinculos.ficha.aceptaciones.version', { n: String(aceptado.version) })}
          {consulta.data && ` · ${t('vinculos.ficha.aceptaciones.publicado', { fecha: formatearFecha(consulta.data.publicadoEn) })}`}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {consulta.isPending && <Skeleton variant="rounded" height={160} />}
        {consulta.isError && <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />}
        {consulta.data && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {consulta.data.contenido}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar}>{t('comun.cerrar')}</Button>
      </DialogActions>
    </Dialog>
  );
}
