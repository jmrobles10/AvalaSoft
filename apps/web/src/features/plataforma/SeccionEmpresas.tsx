import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import type { EmpresaDeGrupoDto, GrupoDto } from '@avalasoft/api-client';
import { MarcoTabla, visualmenteOculto } from '@avalasoft/ui';
import { Factory, Pencil, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { Tarjeta } from '../../shared/componentes';
import { identificacionVisible } from '../configuracion/empresas/modelo';
import { EstadoActivo } from '../configuracion/EstadoActivo';
import { DialogoCorregirEmpresa, DialogoNuevaEmpresa } from './DialogosDeEmpresaDeGrupo';

/**
 * Las empresas del grupo en una lista corta, en solo lectura. «Editar» abre el mismo formulario de corrección de la lista de grupos (razón social,
 * identificación y prefijo de folio; no se duplica) y «Agregar empresa», el del alta.
 */
export function SeccionEmpresas({ grupo }: { grupo: GrupoDto }) {
  const { t } = useTranslation();
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState<EmpresaDeGrupoDto | null>(null);
  const titulo = t('plataforma.ficha.empresas.titulo');
  return (
    <Tarjeta
      titulo={titulo}
      icono={Factory}
      etiqueta={titulo}
      acciones={
        <Button size="small" variant="outlined" startIcon={<Plus size={14} aria-hidden />} onClick={() => setAgregando(true)} aria-label={t('consola.empresa.agregarA', { grupo: grupo.tenant.nombre })}>
          {t('plataforma.ficha.empresas.agregar')}
        </Button>
      }
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('plataforma.ficha.empresas.ayuda')}
      </Typography>
      {grupo.empresas.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('plataforma.ficha.empresas.vacio')}
        </Typography>
      ) : (
        <MarcoTabla>
          <TableContainer>
            <Table size="small" aria-label={t('plataforma.grupos.empresasDe', { grupo: grupo.tenant.nombre })}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('plataforma.grupos.columnas.empresa')}</TableCell>
                  <TableCell>{t('plataforma.grupos.columnas.identificacion')}</TableCell>
                  <TableCell>{t('plataforma.grupos.columnas.prefijo')}</TableCell>
                  <TableCell>
                    <Box component="span" sx={visualmenteOculto}>
                      {t('plataforma.grupos.columnas.acciones')}
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {grupo.empresas.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography component="span" sx={{ fontWeight: 500, fontSize: 14 }}>
                          {e.nombre}
                        </Typography>
                        {!e.activa && <EstadoActivo activo={false} texto={t('comun.inactiva')} />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="monoTabla">{identificacionVisible(e.identificacion)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="monoTabla">{e.prefijoFolio}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('plataforma.grupos.editarEmpresa')}>
                        <IconButton size="small" onClick={() => setEditando(e)} aria-label={t('plataforma.grupos.editarEmpresaDe', { empresa: e.nombre })}>
                          <Pencil size={14} aria-hidden />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('plataforma.ficha.empresas.planIa')}>
                        <IconButton
                          size="small"
                          component={RouterLink}
                          to={`/plataforma/grupos/${grupo.tenant.id}/empresas/${e.id}/plan-ia`}
                          aria-label={t('plataforma.grupos.configurarPlanDe', { empresa: e.nombre })}
                        >
                          <Sparkles size={14} aria-hidden />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MarcoTabla>
      )}
      {agregando && <DialogoNuevaEmpresa grupo={grupo} onCerrar={() => setAgregando(false)} />}
      {editando && <DialogoCorregirEmpresa grupo={grupo} empresa={editando} onCerrar={() => setEditando(null)} />}
    </Tarjeta>
  );
}
