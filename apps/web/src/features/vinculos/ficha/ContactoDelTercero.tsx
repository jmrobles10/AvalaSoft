import type { FichaTerceroDto, VinculoDto } from '@avalasoft/api-client';
import { Dato, RejillaDatos, ValorLargo } from '@avalasoft/ui';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../../shared/componentes';
import { ChipVerificacionDelCorreo } from '../components/ChipVerificacionDelCorreo';

/** Un texto de los datos de una sección (JSON libre), o `null`. */
function texto(datos: unknown, campo: string): string | null {
  if (typeof datos !== 'object' || datos === null) return null;
  const valor = (datos as Record<string, unknown>)[campo];
  return typeof valor === 'string' && valor.trim() ? valor : null;
}

/**
 * «Datos de contacto» del tercero: lo que declaró en su información general (correo, teléfono y dirección) y el correo del vínculo, al
 * que llegan las invitaciones y los avisos de esta empresa.
 */
export function ContactoDelTercero({ vinculo, ficha }: { vinculo: VinculoDto; ficha: FichaTerceroDto | undefined }) {
  const { t } = useTranslation();
  const general = ficha?.secciones?.find((s) => s.seccion === 'FICHA_GENERAL')?.datos;
  const correo = texto(general, 'correo');
  const telefono = texto(general, 'telefono');
  const direccion = texto(general, 'direccion');

  return (
    <Tarjeta titulo={t('vinculos.ficha.contacto.titulo')}>
      <RejillaDatos>
        <Dato etiqueta={t('vinculos.ficha.contacto.correoVinculo')}>
          <ValorLargo valor={vinculo.invitacion?.correoDestino ?? vinculo.correoTercero} partirEn="@" />
          <ChipVerificacionDelCorreo verificacion={vinculo.verificacionDelCorreo} />
        </Dato>
        <Dato etiqueta={t('vinculos.ficha.contacto.correo')}>{correo ? <ValorLargo valor={correo} partirEn="@" /> : '—'}</Dato>
        <Dato etiqueta={t('vinculos.ficha.contacto.telefono')}>{telefono ?? '—'}</Dato>
        <Dato etiqueta={t('vinculos.ficha.contacto.direccion')} ancho>
          {direccion ?? '—'}
        </Dato>
      </RejillaDatos>
    </Tarjeta>
  );
}
