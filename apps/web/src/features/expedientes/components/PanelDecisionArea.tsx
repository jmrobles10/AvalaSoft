import { Box, Stack, Typography } from '@mui/material';
import { SCOPES, type AreaExpedienteDto, type ExpedienteDto } from '@validalo/api-client';
import { ChipEstado } from '@validalo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tarjeta } from '../../../shared/componentes';
import { ChipVigencia } from '../../documentos/VigenciaDocumento';
import { VisorDocumento, type DocumentoEnVisor } from '../../documentos/VisorDocumento';
import { ChipEstadoArea } from '../componentes';
import { bloqueoDecisionArea, documentosDelArea } from '../decisionArea';
import { puedeRechazar, type ContextoRevisor, type DialogoExpediente } from '../reglas';
import { documentoEnVisor, requisitosDe, tieneRequisitos } from '../requisitos';
import { AccionesDecisionArea } from './AccionesDecisionArea';
import { BotonVerVersion } from './BotonVerVersion';
import { VisorSeccionRequisito } from './VisorSeccionRequisito';

/**
 * «Lo que te toca decidir»: el acceso rápido a las áreas de la etapa en curso donde la persona puede decidir ahora, como en
 * el SRM. De cada una, sus documentos con versión, vigencia y «Ver» (o «Ver datos» si la versión es solo un formulario o una
 * sección de la ficha: esta abre el detalle de la sección), y su decisión: «Aprobar área (n documentos)», «Observar» y, si el
 * área puede, «Rechazar». Las áreas donde no puede decidir (y por qué) están en «Etapas y áreas»; si no hay ninguna por decidir,
 * el panel no se pinta. El detalle por documento queda en «Documentos que pide el flujo» («Decidir por documento»). Solo en
 * flujos con requisitos.
 */
export function PanelDecisionArea({
  expediente,
  contexto,
  onAccion,
}: {
  expediente: ExpedienteDto;
  contexto: (area: AreaExpedienteDto | null) => ContextoRevisor;
  onAccion: (dialogo: DialogoExpediente) => void;
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState<DocumentoEnVisor | null>(null);
  // Los datos de una sección de la ficha no son un archivo ni un formulario de documento: van en su propio detalle.
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null);
  if (!tieneRequisitos(expediente) || !['EnRevision', 'Observado'].includes(expediente.estado)) return null;
  const etapa = expediente.etapas.find((e) => e.orden === expediente.etapaActual);
  // Solo las áreas donde la persona puede decidir ahora: las demás se leen (con su motivo) en «Etapas y áreas».
  const areas = (etapa?.areas ?? []).filter((a) => documentosDelArea(expediente, a.areaId).length > 0 && bloqueoDecisionArea(expediente, a, contexto(a)) === null);
  const puedeVer = contexto(null).scopes.has(SCOPES.documentosDescargar);
  const puedeLeerDocumentos = contexto(null).scopes.has(SCOPES.documentosLeer);
  const requisitoAbierto = seccionAbierta ? requisitosDe(expediente).find((r) => r.id === seccionAbierta) : undefined;
  if (areas.length === 0) return null;

  return (
    <Tarjeta titulo={t('expedientes.decisionArea.titulo')}>
      <Stack spacing={1.5}>
        {areas.map((area) => (
          <Box key={area.areaId} component="section" aria-label={area.nombre} sx={{ border: 1, borderColor: 'divider', borderRadius: (th) => `${String(th.radio.sm)}px`, p: 1.5 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', mb: 1 }}>
              <Typography component="h4" sx={{ fontWeight: 600, fontSize: 14 }}>
                {area.nombre}
              </Typography>
              <Box sx={{ ml: 'auto' }}>
                <ChipEstadoArea estado={area.estado} desde={area.pendienteDesde} />
              </Box>
            </Stack>
            <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {documentosDelArea(expediente, area.areaId).map(({ requisito, areaRequisito }) => {
                const version = requisito.versionActual;
                const documento = documentoEnVisor(requisito);
                return (
                  <Stack component="li" key={requisito.id} direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 13, flex: '1 1 auto', minWidth: 0 }} noWrap>
                      {requisito.tipoDocumento.nombre}
                      {version && (
                        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                          {` · v${String(version.n)}`}
                        </Typography>
                      )}
                    </Typography>
                    {version?.vigencia && <ChipVigencia vigencia={version.vigencia} />}
                    {/* «Pendiente» ya lo dice el chip del área: el del documento solo aparece cuando ya tiene una decisión. */}
                    {areaRequisito.estado !== 'Esperando' && areaRequisito.estado !== 'Pendiente' && <ChipEstado estado={areaRequisito.estado} />}
                    {documento && <BotonVerVersion documento={documento} puedeVerArchivo={puedeVer} variante="text" onVer={requisito.seccion ? () => setSeccionAbierta(requisito.id) : setAbierto} />}
                  </Stack>
                );
              })}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
              <AccionesDecisionArea area={area} puedeDecidir puedeRechazar={puedeRechazar(expediente, area, contexto(area))} onAccion={onAccion} />
            </Stack>
          </Box>
        ))}
      </Stack>
      {abierto && <VisorDocumento empresaId={expediente.empresaId} vinculoId={expediente.vinculoId} documento={abierto} onCerrar={() => setAbierto(null)} />}
      {requisitoAbierto?.seccion && (
        <VisorSeccionRequisito
          empresaId={expediente.empresaId}
          vinculoId={expediente.vinculoId}
          terceroId={expediente.tercero.id}
          requisito={requisitoAbierto}
          seccion={requisitoAbierto.seccion}
          puedeVerArchivo={puedeVer}
          puedeLeerDocumentos={puedeLeerDocumentos}
          onCerrar={() => setSeccionAbierta(null)}
        />
      )}
    </Tarjeta>
  );
}
