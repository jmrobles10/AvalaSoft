import { Stack } from '@mui/material';
import type { PerfilDeFichaDto } from '@validalo/api-client';
import { useTranslation } from 'react-i18next';
import { CampoFechaFicha, CampoSiNo, CampoTexto, Rejilla, Subtitulo } from '../campos';
import { SelectorUnico } from '../selectores';
import type { DatosTributarios, PropsFormulario, Resolucion } from '../tipos';

/**
 * Información tributaria fuera de Colombia (`FICHA_TRIBUTARIA`, RG-3): sin la casilla 53 del RUT ni ICA. El régimen sale de la lista del
 * país (la API la manda en el perfil de la ficha) y las preguntas nombran el impuesto del país (ITBMS en Panamá, ITBIS en República Dominicana,
 * «IVA o equivalente» en los demás). La exención pide su certificado; sin exención no se envía.
 */
export function FormularioTributariaGenerica({ datos, onCambiar, mensaje, deshabilitado, perfil }: PropsFormulario<DatosTributarios> & { perfil: PerfilDeFichaDto }) {
  const { t } = useTranslation();
  const certificado: Resolucion = datos.certificado_exencion ?? {};
  const cambiarCertificado = (cambio: Resolucion) => {
    const nuevo = { ...certificado, ...cambio };
    onCambiar({ certificado_exencion: nuevo.numero || nuevo.fecha ? nuevo : null });
  };

  return (
    <Stack spacing={2.5}>
      <SelectorUnico
        etiqueta={t('ficha.tributaria.regimen')}
        ayuda={t('ficha.tributaria.regimenAyuda')}
        opciones={perfil.regimenes}
        valor={datos.regimen}
        onCambiar={(regimen) => onCambiar({ regimen })}
        mensaje={mensaje('regimen')}
        deshabilitado={deshabilitado}
      />
      <CampoSiNo
        etiqueta={t('ficha.tributaria.contribuyenteImpuestoVentas', { impuesto: perfil.impuestoVentas })}
        valor={datos.contribuyente_impuesto_ventas}
        onCambiar={(v) => onCambiar({ contribuyente_impuesto_ventas: v })}
        mensaje={mensaje('contribuyente_impuesto_ventas')}
        deshabilitado={deshabilitado}
      />
      <CampoSiNo
        etiqueta={t('ficha.tributaria.agenteDeRetencion')}
        valor={datos.agente_de_retencion}
        onCambiar={(v) => onCambiar({ agente_de_retencion: v })}
        mensaje={mensaje('agente_de_retencion')}
        deshabilitado={deshabilitado}
      />
      <CampoSiNo
        etiqueta={t('ficha.tributaria.exentoDeRetenciones')}
        valor={datos.exento_de_retenciones}
        // Sin exención no hay certificado que enviar: la regla del servidor lo rechaza.
        onCambiar={(v) => onCambiar(!v && datos.certificado_exencion ? { exento_de_retenciones: false, certificado_exencion: null } : { exento_de_retenciones: v })}
        mensaje={mensaje('exento_de_retenciones')}
        deshabilitado={deshabilitado}
      />
      {(datos.exento_de_retenciones === true || datos.certificado_exencion) && (
        <Stack spacing={1.5}>
          <Subtitulo>{t('ficha.tributaria.certificadoExencion')}</Subtitulo>
          <Rejilla>
            <CampoTexto etiqueta={t('ficha.tributaria.numeroCertificado')} valor={certificado.numero} onCambiar={(numero) => cambiarCertificado({ numero })} mensaje={mensaje('certificado_exencion.numero')} maxLength={50} deshabilitado={deshabilitado} />
            <CampoFechaFicha etiqueta={t('ficha.tributaria.fechaCertificado')} valor={certificado.fecha} onCambiar={(fecha) => cambiarCertificado({ fecha })} mensaje={mensaje('certificado_exencion.fecha')} deshabilitado={deshabilitado} />
          </Rejilla>
        </Stack>
      )}
      <CampoSiNo
        etiqueta={t('ficha.tributaria.emisorComprobantesElectronicos')}
        valor={datos.emisor_comprobantes_electronicos}
        onCambiar={(v) => onCambiar({ emisor_comprobantes_electronicos: v })}
        mensaje={mensaje('emisor_comprobantes_electronicos')}
        deshabilitado={deshabilitado}
      />
    </Stack>
  );
}
