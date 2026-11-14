import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { CampoCotejadoDto, DatosOficialesDto, DecisionCoincidencia, FuenteOficialDto } from '@validasoft/api-client';
import { Dato, formatearDiaCivil, formatearFecha, RejillaDatos } from '@validasoft/ui';
import { useTranslation } from 'react-i18next';
import { ordenarCotejo, puedeDecidirCampo, resumenDeCotejo } from '../modelo';

export interface ResultadoDeFuenteProps {
  resultado: FuenteOficialDto;
  /** Quien mira puede aceptar o confirmar las diferencias (`cumplimiento:decidir`, expediente abierto). */
  puedeDecidir: boolean;
  onResolver: (campo: CampoCotejadoDto, decision: DecisionCoincidencia) => void;
  /** Nombre de quien decidió (los ids de usuario llegan sueltos). */
  quien: (id: string | null | undefined) => string;
}

/**
 * Lo que dijo la fuente oficial del tercero y su cotejo (FO-3, FO-4): los datos normalizados, y cada campo frente a la ficha maestra, a un
 * documento o al propio estado de la fuente. Lo que discrepa pide la decisión de un revisor (aceptarlo o confirmarlo, con justificación); lo
 * que coincide o no se pudo verificar no pide nada. Lo comparten el expediente y el monitoreo del vínculo.
 */
export function ResultadoDeFuente({ resultado, puedeDecidir, onResolver, quien }: ResultadoDeFuenteProps) {
  const { t } = useTranslation();
  const { datos, campos } = resultado;
  const resumen = resumenDeCotejo(campos);

  return (
    <Stack spacing={1.5}>
      <DatosDeLaFuente datos={datos} />
      <Box component="section" aria-label={t('fuentesOficiales.cotejo.titulo')}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'baseline', flexWrap: 'wrap', mb: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{t('fuentesOficiales.cotejo.titulo')}</Typography>
          <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
            {t('fuentesOficiales.cotejo.resumen', { coinciden: String(resumen.coinciden), diferencias: String(resumen.diferencias), sinVerificar: String(resumen.sinVerificar) })}
          </Typography>
        </Stack>
        {resumen.diferencias === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>{t('fuentesOficiales.panel.sinDiferencias')}</Typography>
        ) : null}
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {ordenarCotejo(campos).map((campo) => (
            <CampoDeCotejo key={campo.id} campo={campo} puedeDecidir={puedeDecidir} onResolver={onResolver} quien={quien} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function DatosDeLaFuente({ datos }: { datos: DatosOficialesDto }) {
  const { t } = useTranslation();
  if (!datos.encontrado) return <Alert severity="warning">{t('fuentesOficiales.datos.noEncontrado')}</Alert>;
  const celdas: { etiqueta: string; valor: string | null; ancho?: boolean }[] = [
    { etiqueta: t('fuentesOficiales.datos.razonSocial'), valor: datos.razonSocial },
    { etiqueta: t('fuentesOficiales.datos.nit'), valor: datos.nit ? (datos.dv ? `${datos.nit}-${datos.dv}` : datos.nit) : null },
    { etiqueta: t('fuentesOficiales.datos.matricula'), valor: datos.matricula },
    { etiqueta: t('fuentesOficiales.datos.camara'), valor: datos.camara },
    { etiqueta: t('fuentesOficiales.datos.organizacion'), valor: datos.tipoOrganizacion },
    {
      etiqueta: t('fuentesOficiales.datos.renovacion'),
      valor: datos.ultimoAnoRenovado
        ? t('fuentesOficiales.datos.renovacionDe', { ano: String(datos.ultimoAnoRenovado), fecha: datos.fechaRenovacion ? formatearDiaCivil(datos.fechaRenovacion) : '—' })
        : null,
    },
    { etiqueta: t('fuentesOficiales.datos.cancelada'), valor: datos.fechaCancelacion ? formatearDiaCivil(datos.fechaCancelacion) : null },
    { etiqueta: t('fuentesOficiales.datos.direccion'), valor: datos.direccion },
    { etiqueta: t('fuentesOficiales.datos.municipio'), valor: datos.municipio },
    { etiqueta: t('fuentesOficiales.datos.actividad'), valor: datos.actividadPrincipal },
    { etiqueta: t('fuentesOficiales.datos.responsabilidades'), valor: datos.responsabilidades.length > 0 ? datos.responsabilidades.join(', ') : null },
    {
      etiqueta: t('fuentesOficiales.datos.representantes'),
      valor: datos.representantes.length > 0 ? datos.representantes.map((r) => [r.nombre, r.identificacion ? `(${r.identificacion})` : null, r.cargo ? `— ${r.cargo}` : null].filter(Boolean).join(' ')).join(' · ') : null,
      ancho: true,
    },
    { etiqueta: t('fuentesOficiales.datos.actualizado'), valor: datos.actualizadoEnLaFuente ? formatearDiaCivil(datos.actualizadoEnLaFuente) : null },
  ];
  return (
    <Box component="section" aria-label={t('fuentesOficiales.datos.titulo')}>
      <RejillaDatos columnas={3}>
        <Dato etiqueta={t('fuentesOficiales.datos.estado')}>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{datos.estado ?? '—'}</span>
            <Chip
              size="small"
              variant="outlined"
              color={datos.estadoNormalizado === 'Vigente' ? 'success' : datos.estadoNormalizado === 'NoVigente' ? 'error' : 'default'}
              label={t(`fuentesOficiales.datos.estadosNormalizados.${datos.estadoNormalizado}`)}
            />
          </Stack>
        </Dato>
        {celdas
          .filter((c) => c.valor)
          .map((c) => (
            <Dato key={c.etiqueta} etiqueta={c.etiqueta} ancho={c.ancho}>
              {c.valor}
            </Dato>
          ))}
      </RejillaDatos>
    </Box>
  );
}

function CampoDeCotejo({ campo, puedeDecidir, onResolver, quien }: { campo: CampoCotejadoDto; puedeDecidir: boolean; onResolver: ResultadoDeFuenteProps['onResolver']; quien: ResultadoDeFuenteProps['quien'] }) {
  const { t } = useTranslation();
  const contra = campo.contra === 'Fuente' ? t('fuentesOficiales.cotejo.contra.Fuente') : (campo.referencia ?? t(`fuentesOficiales.cotejo.contra.${campo.contra}`));
  const pendiente = puedeDecidirCampo(campo);
  const color = campo.resultado === 'Coincide' ? 'success' : campo.resultado === 'Discrepa' ? (campo.decision === 'Descartada' ? 'default' : 'error') : 'default';
  const sinDato = t('fuentesOficiales.cotejo.sinDato');

  return (
    <Box
      component="li"
      aria-label={t('fuentesOficiales.cotejo.fila', { etiqueta: campo.etiqueta, contra })}
      sx={{ border: 1, borderColor: pendiente ? 'error.main' : 'divider', borderRadius: (th) => `${String(th.radio.sm)}px`, p: 1.25 }}
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontSize: 13, fontWeight: 500 }}>
          {campo.etiqueta}
        </Typography>
        <Chip size="small" variant="outlined" color={color} label={t(`fuentesOficiales.cotejo.resultados.${campo.resultado}`)} />
        {campo.critico && campo.resultado === 'Discrepa' && <Chip size="small" variant="outlined" color="warning" label={t('fuentesOficiales.cotejo.critica')} />}
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
          {contra}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {pendiente && puedeDecidir && (
          <>
            <Button size="small" variant="outlined" onClick={() => onResolver(campo, 'Descartada')}>
              {t('fuentesOficiales.cotejo.aceptar')}
            </Button>
            <Button size="small" variant="outlined" color="error" onClick={() => onResolver(campo, 'Confirmada')}>
              {t('fuentesOficiales.cotejo.confirmar')}
            </Button>
          </>
        )}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1, mt: 0.75 }}>
        <Typography sx={{ fontSize: 13 }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {t('fuentesOficiales.cotejo.columnas.fuente')}:{' '}
          </Box>
          {campo.oficial ?? sinDato}
        </Typography>
        {campo.contra !== 'Fuente' || campo.comparado ? (
          <Typography sx={{ fontSize: 13 }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {t('fuentesOficiales.cotejo.columnas.comparado')}:{' '}
            </Box>
            {campo.comparado ?? sinDato}
          </Typography>
        ) : null}
      </Box>
      {campo.detalle && <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>{campo.detalle}</Typography>}
      {campo.decision && (
        <Typography sx={{ fontSize: 12, mt: 0.5 }}>
          {campo.heredada && campo.vigenteHasta
            ? t('fuentesOficiales.cotejo.heredada', { fecha: formatearFecha(campo.vigenteHasta) })
            : t('fuentesOficiales.cotejo.decidida', {
                decision: t(`fuentesOficiales.cotejo.decisiones.${campo.decision as DecisionCoincidencia}`),
                quien: quien(campo.resueltaPor),
                fecha: campo.resueltaEn ? formatearFecha(campo.resueltaEn) : '—',
                justificacion: campo.justificacion ?? '',
              })}
        </Typography>
      )}
    </Box>
  );
}
