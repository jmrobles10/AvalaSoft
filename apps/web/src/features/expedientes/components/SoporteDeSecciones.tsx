import { Alert, Chip, Stack, Typography } from '@mui/material';
import type { SeccionRespaldadaDto, SoporteDeSeccionesDto } from '@validalo/api-client';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SeccionFicha } from '../../terceros/SeccionesVinculo';
import { TablaCruce } from './CruceSeccion';

/**
 * Lo que un documento exigido respalda de la ficha del tercero (F5, «Usar como soporte»): por cada sección que respalda, su
 * versión vigente y el resultado del cruce con esta versión del documento. Sin la lectura automática para la empresa, el aviso
 * de comparar a mano. Es evidencia: no decide nada.
 */
export function SoporteDeSecciones({ soporte, compacto = false }: { soporte: SoporteDeSeccionesDto; compacto?: boolean }) {
  const { t } = useTranslation();
  if (soporte.secciones.length === 0 && !soporte.sinAnalisis) return null;
  // En la tarjeta del requisito los avisos (sin lectura, discrepancia crítica) van en su aviso único; sin cruces, las secciones caben en una línea.
  if (compacto) {
    if (soporte.secciones.length === 0) return null;
    const conCruce = soporte.secciones.filter((s) => s.cruce);
    return (
      <Stack component="section" aria-label={t('cruce.soporte.titulo')} spacing={1}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('cruce.soporte.respalda', { secciones: soporte.secciones.map((s) => nombreDe(s, t, true)).join(' · ') })}
        </Typography>
        {conCruce.length > 0 && (
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {conCruce.map((s) => (
              <FilaDeSeccion key={`${s.seccion}-${String(s.periodo ?? '')}`} respaldada={s} />
            ))}
          </Stack>
        )}
      </Stack>
    );
  }
  return (
    <SeccionFicha titulo={t('cruce.soporte.titulo')}>
      <Stack spacing={1.25}>
        {soporte.discrepanciaCritica && <Alert severity="error">{t('cruce.discrepanciaCritica')}</Alert>}
        {soporte.sinAnalisis && <Alert severity="info">{t('cruce.soporte.sinAnalisis')}</Alert>}
        <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {soporte.secciones.map((s) => (
            <FilaDeSeccion key={`${s.seccion}-${String(s.periodo ?? '')}`} respaldada={s} />
          ))}
        </Stack>
      </Stack>
    </SeccionFicha>
  );
}

/** Las cuentas no son una sección con versiones: su nombre ya dice cuál es («Cuenta de Bancolombia ****5678», FD-5). */
function nombreDe(respaldada: SeccionRespaldadaDto, t: TFunction, corto = false): string {
  if (respaldada.seccion === 'CUENTAS_BANCARIAS') return respaldada.nombre;
  return respaldada.version === null
    ? t(corto ? 'cruce.soporte.seccionSinDiligenciarCorta' : 'cruce.soporte.seccionSinDiligenciar', { seccion: respaldada.nombre })
    : t('cruce.soporte.seccion', { seccion: respaldada.nombre, n: String(respaldada.version) });
}

function FilaDeSeccion({ respaldada }: { respaldada: SeccionRespaldadaDto }) {
  const { t } = useTranslation();
  const { cruce } = respaldada;
  const esCuenta = respaldada.seccion === 'CUENTAS_BANCARIAS';
  const nombre = nombreDe(respaldada, t);
  return (
    <Stack component="li" spacing={0.75} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {nombre}
        </Typography>
        {cruce === null && (respaldada.version !== null || esCuenta) && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('cruce.soporte.sinCruce')}
          </Typography>
        )}
        {cruce && (
          <>
            <Chip
              size="small"
              variant="outlined"
              color={cruce.discrepanciaCritica ? 'error' : cruce.discrepancias > 0 ? 'warning' : 'success'}
              label={cruce.discrepanciaCritica ? t('cruce.soporte.criticas') : cruce.discrepancias > 0 ? t('cruce.soporte.difiere', { count: cruce.discrepancias }) : t('cruce.soporte.coincide')}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('cruce.resumen', { coinciden: String(cruce.coincidencias), difieren: String(cruce.discrepancias), noVerificables: String(cruce.noVerificables) })}
            </Typography>
          </>
        )}
      </Stack>
      {cruce && <TablaCruce cruce={cruce} />}
    </Stack>
  );
}
