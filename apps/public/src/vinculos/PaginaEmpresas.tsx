import { Box, Button, Stack, Typography } from '@mui/material';
import type { VinculoPublicoDto } from '@validalo/api-client';
import { ChipEstado, EstadoVacio, formatearFecha } from '@validalo/ui';
import { Building2, ChevronRight, Contact, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useEvaluacionesDelVinculo } from '../evaluaciones/api';
import { AvisoEvaluacionesPendientes } from '../evaluaciones/TarjetaEvaluaciones';
import { useExpedientePublico, useVinculosPublicos } from '../shared/api';
import { CabeceraPagina, ErrorRecuperable, EsqueletoTarjetas, LogoEmpresa } from '../shared/componentes';
import { avanceDelTercero, type AvanceTercero } from './avance';
import { AvisoActualizacionNoAprobada } from './AvisoActualizacionNoAprobada';
import { AvisoRechazo } from './AvisoRechazo';
import { ChipAvance } from './ChipAvance';
import { DialogoContactos } from './DialogoContactos';
import { useTextoAvance } from './useTextoAvance';
import { situacionDelVinculo } from './situacion';

/** Mis empresas: las que invitaron al tercero, con lo que le toca con cada una y el siguiente paso. */
export function PaginaEmpresas() {
  const { t } = useTranslation();
  const consulta = useVinculosPublicos();

  return (
    <>
      <CabeceraPagina titulo={t('empresas.titulo')} sub={t('empresas.sub')} />
      {consulta.isPending ? (
        <EsqueletoTarjetas />
      ) : consulta.isError ? (
        <ErrorRecuperable error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : consulta.data.length === 0 ? (
        <EstadoVacio icono={Building2} titulo={t('empresas.vacio')} texto={t('empresas.vacioTexto')} />
      ) : (
        <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
          {consulta.data.map((v) => (
            <TarjetaEmpresa key={v.id} vinculo={v} />
          ))}
        </Box>
      )}
    </>
  );
}

/**
 * Una empresa: con la invitación aceptada se consulta su expediente para decir lo que falta («Faltan 3 documentos»,
 * «En revisión», «Tienes observaciones», «Aprobado») en vez del estado interno del vínculo («En validación»).
 */
function TarjetaEmpresa({ vinculo: v }: { vinculo: VinculoPublicoDto }) {
  const { t } = useTranslation();
  const textoAvance = useTextoAvance();
  const situacion = situacionDelVinculo(v.estado);
  const expedienteId = v.expedienteId ?? '';
  const conExpediente = expedienteId !== '' && situacion === 'vigente' && v.invitacionAceptada;
  const expediente = useExpedientePublico(expedienteId, conExpediente);
  // Las evaluaciones que la empresa le pide (del flujo o la reevaluación periódica): el aviso lleva a responderlas.
  const evaluaciones = useEvaluacionesDelVinculo(v.id, v.invitacionAceptada && situacion === 'vigente');
  const conocido = avanceDelTercero(v, conExpediente ? expediente.data : null);
  // Mientras llega el expediente no se muestra «En validación» ni «Por vencer»: la renovación abierta cambia lo que le toca (VV-3), y una
  // actualización abierta puede estar observada (VR-1), así que el chip espera en vez de mostrar un estado que luego se contradice.
  const esperando = conExpediente && expediente.isPending && (conocido === null || conocido.tipo === 'porVencer' || v.enRevision === true);
  const avance = esperando ? null : conocido;
  const [editandoContactos, setEditandoContactos] = useState(false);
  const textoDelBoton = (tipo: AvanceTercero['tipo'] | undefined) => {
    switch (tipo) {
      case 'faltan':
        return t('empresas.subirDocumentos');
      case 'observado':
        return t('empresas.verObservaciones');
      case 'preVencimiento':
      case 'ratificar':
        return t('empresas.ratificar');
      default:
        return t('empresas.verExpediente');
    }
  };

  const textoDeAvance =
    situacion !== 'vigente'
      ? t(`vinculoSituacion.${situacion}.corto`)
      : avance
        ? textoAvance(avance, v.empresa.nombre)
        : v.invitacionAceptada && v.invitacionAceptadaEn
          ? t('empresas.aceptada', { fecha: formatearFecha(v.invitacionAceptadaEn) })
          : t('empresas.pendienteAceptar');
  const conAviso = Boolean(v.reintento) || (Boolean(v.actualizacionNoAprobada) && situacion === 'vigente');

  // Una fila alineada en columnas, como una tabla: empresa y tipo · estado · lo que toca · acciones (en el celular se apilan).
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.1fr) 150px minmax(0, 1.4fr) auto' },
        columnGap: 2,
        rowGap: 1,
        alignItems: 'center',
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
        <LogoEmpresa nombre={v.empresa.nombre} logoUrl={v.empresa.logoUrl} tamano={32} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" component="h2">
            {v.empresa.nombre}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>{v.tipoVinculo.nombre}</Typography>
        </Box>
      </Stack>
      <Box sx={{ justifySelf: 'start' }}>
        {avance ? <ChipAvance avance={avance} /> : v.reintento ? <ChipEstado estado="Rechazado" /> : !esperando && <ChipEstado estado={v.estado} />}
      </Box>
      <Typography sx={{ color: 'text.secondary', display: conAviso ? 'none' : 'block' }}>{textoDeAvance}</Typography>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, justifyContent: { md: 'flex-end' } }}>
        {situacion === 'vigente' && !v.invitacionAceptada && (
          <Button component={RouterLink} to={`/empresas/${v.id}`} variant="contained" size="small" endIcon={<ChevronRight size={18} aria-hidden />}>
            {t('empresas.aceptar')}
          </Button>
        )}
        {v.expedienteId && situacion !== 'terminada' && !v.reintento && (
          <Button
            component={RouterLink}
            to={`/expediente/${v.expedienteId}`}
            variant={v.invitacionAceptada ? 'contained' : 'outlined'}
            size="small"
            startIcon={avance?.tipo === 'faltan' ? <Upload size={16} aria-hidden /> : undefined}
          >
            {textoDelBoton(avance?.tipo)}
          </Button>
        )}
        {v.invitacionAceptada && situacion !== 'terminada' && (
          <Button variant="text" size="small" startIcon={<Contact size={16} aria-hidden />} onClick={() => setEditandoContactos(true)} aria-label={t('contactos.abrirCon', { empresa: v.empresa.nombre })}>
            {t('contactos.abrir')}
            {(v.contactos?.length ?? 0) > 0 && ` · ${t('contactos.resumen', { count: v.contactos?.length ?? 0 })}`}
          </Button>
        )}
      </Stack>
      {(conAviso || evaluaciones.data) && (
        <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
          {v.reintento ? <AvisoRechazo vinculo={v} /> : v.actualizacionNoAprobada && situacion === 'vigente' ? <AvisoActualizacionNoAprobada vinculo={v} /> : null}
          {evaluaciones.data && <AvisoEvaluacionesPendientes evaluaciones={evaluaciones.data} vinculoId={v.id} empresa={v.empresa.nombre} />}
        </Box>
      )}
      {editandoContactos && <DialogoContactos vinculo={v} onCerrar={() => setEditandoContactos(false)} />}
    </Box>
  );
}
