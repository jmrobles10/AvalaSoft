import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import type { DocumentoDePersonaDto, RelacionEntreTercerosDto } from '@validalo/api-client';
import { ChipEstado, formatearFecha } from '@validalo/ui';
import { FileText, Upload, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { comoNumero, documentosPorSubir, enlaceDeSubidaDePersona, esRol } from './modelo';

const ESTADOS_DE_VERSION = ['Actual', 'EnAnalisis', 'Recibida', 'Devuelta', 'Superada', 'Vencida', 'Retirada'] as const;
type EstadoDeVersion = (typeof ESTADOS_DE_VERSION)[number];
const esEstadoDeVersion = (valor: string): valor is EstadoDeVersion => (ESTADOS_DE_VERSION as readonly string[]).includes(valor);

/** Un documento de la bóveda de la persona: su estado y la acción de subirlo (o subir otra versión). Lo que pide una empresa va destacado. */
function FilaDeDocumento({ documento, personaId }: { documento: DocumentoDePersonaDto; personaId: string }) {
  const { t } = useTranslation();
  const nombre = documento.tipoCanonico === 'CEDULA' || documento.tipoCanonico === 'PASAPORTE' || documento.tipoCanonico === 'CERTIFICADO_ANTECEDENTES'
    ? t(`personas.documentos.${documento.tipoCanonico}`)
    : documento.nombre;
  const tiene = documento.version !== null && documento.estado !== null;
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', py: 0.75, minHeight: 44 }} component="li">
      <Box sx={{ color: 'text.secondary', display: 'flex' }} aria-hidden>
        <FileText size={16} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 14, lineHeight: '20px' }}>{nombre}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: 12, lineHeight: '16px' }}>
          {tiene && documento.cargadaEn
            ? t('personas.documentos.cargado', { n: String(documento.version), fecha: formatearFecha(documento.cargadaEn) })
            : documento.pedido
              ? t('personas.documentos.pedido')
              : t('personas.documentos.sinCargar')}
        </Typography>
      </Box>
      {tiene && documento.estado && (
        <Chip size="small" variant="outlined" label={esEstadoDeVersion(documento.estado) ? t(`personas.documentos.estado.${documento.estado}`) : documento.estado} />
      )}
      <Button
        component={RouterLink}
        to={enlaceDeSubidaDePersona(personaId, documento.tipoCanonico, nombre)}
        size="small"
        variant={documento.pedido && documento.estado !== 'Actual' ? 'contained' : 'text'}
        startIcon={<Upload size={16} aria-hidden />}
        aria-label={`${t(tiene ? 'personas.documentos.reemplazar' : 'personas.documentos.subir')}: ${nombre}`}
      >
        {t(tiene ? 'personas.documentos.reemplazar' : 'personas.documentos.subir')}
      </Button>
    </Stack>
  );
}

/**
 * Una persona relacionada con el tercero: quién es, cómo se relaciona (principal, participación, cargo) y los documentos de su bóveda.
 * «Quitar» solo se ofrece si la declaró el tercero a mano: la que viene de su información legal se quita de la ficha.
 */
export function TarjetaPersona({ relacion, onQuitar }: { relacion: RelacionEntreTercerosDto; onQuitar: (relacion: RelacionEntreTercerosDto) => void }) {
  const { t } = useTranslation();
  const rol = esRol(relacion.tipo) ? t(`personas.roles.${relacion.tipo}`) : relacion.tipo;
  const participacion = comoNumero(relacion.participacion);
  const faltan = documentosPorSubir(relacion);
  const documento = `${relacion.identificacion.tipo} ${relacion.identificacion.numero}`;

  return (
    <Paper variant="outlined" component="li" sx={{ p: { xs: 1.5, sm: 2 }, listStyle: 'none' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 0.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
            {relacion.nombre}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            {documento} · {rol}
            {participacion !== null && ` · ${t('personas.participacion', { valor: participacion.toLocaleString('es-CO') })}`}
            {relacion.cargo && ` · ${t('personas.cargo', { cargo: relacion.cargo })}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {relacion.principal && <ChipEstado estado="Activo" size="medium" etiqueta={t('personas.principal')} />}
          {faltan > 0 && <Chip size="small" color="warning" variant="outlined" label={t('personas.documentos.pedido')} />}
        </Stack>
      </Stack>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, borderTop: 1, borderColor: 'divider' }} aria-label={t('personas.documentos.titulo', { nombre: relacion.nombre })}>
        {relacion.documentos.map((d) => (
          <FilaDeDocumento key={d.tipoCanonico} documento={d} personaId={relacion.personaId} />
        ))}
      </Box>

      {relacion.deFicha ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 12, mt: 0.5 }}>{t('personas.deFicha')}</Typography>
      ) : (
        <Button color="error" size="small" startIcon={<UserRoundX size={16} aria-hidden />} onClick={() => onQuitar(relacion)} sx={{ mt: 0.5 }}>
          {t('personas.terminar.boton')}
        </Button>
      )}
    </Paper>
  );
}
