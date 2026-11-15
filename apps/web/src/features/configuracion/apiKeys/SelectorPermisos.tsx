import { Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import { SCOPES } from '@validasoft/api-client';
import { useTranslation } from 'react-i18next';
import { alternarGrupo, alternarScope, GRUPOS_PERMISOS, type ClavePermiso } from './scopes';

export interface SelectorPermisosProps {
  valor: readonly string[];
  onCambiar: (scopes: string[]) => void;
  /** Permisos que no se ofrecen (un grupo de acceso no lleva el de abrir sesiones del tercero, que es solo de una API key). */
  excluir?: readonly ClavePermiso[];
  /** Título y ayuda propios; por omisión los de las API keys. */
  etiqueta?: string;
  ayuda?: string;
  soloLectura?: boolean;
}

/** Multiselección de permisos agrupada: cada grupo se marca entero o permiso por permiso (con su scope en mono). */
export function SelectorPermisos({ valor, onCambiar, excluir = [], etiqueta, ayuda, soloLectura = false }: SelectorPermisosProps) {
  const { t } = useTranslation();
  const grupos = GRUPOS_PERMISOS.map(({ grupo, claves }) => ({ grupo, claves: claves.filter((c) => !excluir.includes(c)) })).filter((g) => g.claves.length > 0);
  return (
    <Box component="fieldset" disabled={soloLectura} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <Typography component="legend" sx={{ fontSize: 14, fontWeight: 600 }}>
        {etiqueta ?? t('apiKeys.campos.permisos')}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {ayuda ?? t('apiKeys.campos.permisosAyuda', { n: String(valor.length) })}
      </Typography>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: (th) => `${String(th.radio.sm)}px` }}>
        {grupos.map(({ grupo, claves }, i) => {
          const marcados = claves.filter((c) => valor.includes(SCOPES[c])).length;
          return (
            <Box key={grupo} sx={{ px: 1.5, py: 0.75, borderTop: i === 0 ? 0 : 1, borderColor: 'divider' }}>
              <FormControlLabel
                sx={{ mx: 0, '& .MuiFormControlLabel-label': { fontSize: 13, fontWeight: 600 } }}
                control={
                  <Checkbox
                    size="small"
                    checked={marcados === claves.length}
                    indeterminate={marcados > 0 && marcados < claves.length}
                    onChange={() => {
                      const delGrupo: string[] = claves.map((c) => SCOPES[c]);
                      const completo = delGrupo.every((s) => valor.includes(s));
                      // Sin exclusiones es el mismo comportamiento de siempre (marca o desmarca todo el grupo).
                      onCambiar(excluir.length === 0 ? alternarGrupo(valor, grupo) : completo ? valor.filter((s) => !delGrupo.includes(s)) : [...valor, ...delGrupo.filter((s) => !valor.includes(s))]);
                    }}
                  />
                }
                label={t(`apiKeys.grupos.${grupo}`)}
              />
              <Stack sx={{ pl: 3.5 }}>
                {claves.map((clave) => {
                  const scope = SCOPES[clave];
                  return (
                    <FormControlLabel
                      key={clave}
                      sx={{ mx: 0, minHeight: 32 }}
                      control={<Checkbox size="small" checked={valor.includes(scope)} onChange={() => onCambiar(alternarScope(valor, scope))} />}
                      label={
                        <Box component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1 }}>
                          <Typography component="span" variant="body2">
                            {t(`apiKeys.permisos.${clave}`)}
                          </Typography>
                          <Typography component="span" variant="monoTabla" sx={{ color: 'text.secondary' }}>
                            {scope}
                          </Typography>
                        </Box>
                      }
                    />
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
