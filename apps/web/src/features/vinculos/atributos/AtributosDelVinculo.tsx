import { Box, Button, Chip } from '@mui/material';
import { SCOPES, type VinculoDto } from '@validasoft/api-client';
import { Dato } from '@validasoft/ui';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermisos } from '../../../shared/usePermisos';
import { useTiposVinculo } from '../api';
import { DialogoEditarAtributos } from './DialogoEditarAtributos';

/** Un vínculo terminado (anulado o desvinculado) ya no admite cambios: la API lo rechaza. */
const ESTADOS_TERMINALES: ReadonlySet<string> = new Set(['Anulado', 'Desvinculado']);

const comoTexto = (valor: unknown): string => (typeof valor === 'string' ? valor : Array.isArray(valor) ? valor.join(', ') : JSON.stringify(valor));

/**
 * Los atributos del vínculo en su detalle, con «Editar atributos» si la persona puede escribir vínculos y el tipo de vínculo tiene atributos permitidos (sin ellos no hay qué
 * editar y el botón no se muestra). Sin valores ni atributos permitidos no ocupa lugar.
 */
export function AtributosDelVinculo({ vinculo, empresaId }: { vinculo: VinculoDto; empresaId: string }) {
  const { t } = useTranslation();
  const permisos = usePermisos(empresaId);
  const tipos = useTiposVinculo(empresaId, permisos.puede(SCOPES.configuracionLeer));
  const [editando, setEditando] = useState(false);
  const valores = Object.entries(vinculo.atributos);
  const tipo = tipos.data?.find((x) => x.id === vinculo.tipoVinculo.id);
  const puedeEditar = permisos.puede(SCOPES.vinculosEscribir) && !ESTADOS_TERMINALES.has(vinculo.estado) && (tipo?.atributosPermitidos.length ?? 0) > 0;

  if (valores.length === 0 && !puedeEditar) return null;

  return (
    <Dato etiqueta={t('vinculos.detalle.atributos')} ancho>
      <Box component="span" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {valores.map(([clave, valor]) => (
          <Chip key={clave} size="small" variant="outlined" label={`${clave}: ${comoTexto(valor)}`} />
        ))}
        {valores.length === 0 && <span>{t('atributosVinculo.sinValores')}</span>}
        {puedeEditar && (
          <Button size="small" variant="text" startIcon={<Pencil size={14} aria-hidden />} onClick={() => setEditando(true)}>
            {t('atributosVinculo.editar')}
          </Button>
        )}
      </Box>
      {editando && tipo && <DialogoEditarAtributos vinculo={vinculo} tipo={tipo} empresaId={empresaId} onCerrar={() => setEditando(false)} />}
    </Dato>
  );
}
