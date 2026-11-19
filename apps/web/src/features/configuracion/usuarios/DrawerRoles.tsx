import { Alert, Box, Button, Checkbox, Drawer, FormControlLabel, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { AsignacionDeGrupoDto, EmpresaDto, GrupoDeAccesoDto, RolAsignadoDto, UsuarioDto } from '@validalo/api-client';
import { AvatarActor, AlineadoConCampo } from '@validalo/ui';
import { Ban, Plus, X } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconoCarga } from '../../../shared/componentes';
import { mensajeDeError } from '../../../shared/errores';
import { aAsignaciones, aFilasDeGrupos, gruposElegibles, type FilaGrupo } from './grupos';
import { aFilas, ALCANCE_TENANT, aRoles, ROLES, type FilaRol } from './roles';

export interface DrawerRolesProps {
  /** `null` = persona nueva (pide nombre y correo). */
  usuario: UsuarioDto | null;
  empresas: readonly EmpresaDto[];
  /** Los grupos de acceso del grupo empresarial (GA-1…GA-9): de ellos se eligen los propios; sin ninguno, el drawer solo asigna roles. */
  grupos?: readonly GrupoDeAccesoDto[];
  guardando: boolean;
  error: unknown;
  onGuardar: (datos: { nombre: string; correo: string; roles: RolAsignadoDto[]; grupos: AsignacionDeGrupoDto[]; invitar: boolean }) => void;
  onDesactivar?: () => void;
  onCerrar: () => void;
  /** El grupo admite el ingreso directo: al agregar a una persona se le puede enviar la invitación por correo (ING-5). */
  puedeInvitar?: boolean;
}

/** Editor lateral de roles por empresa o para todo el grupo (ID-2); también da de alta a una persona. */
export function DrawerRoles({ usuario, empresas, grupos = [], guardando, error, onGuardar, onDesactivar, onCerrar, puedeInvitar = false }: DrawerRolesProps) {
  const { t } = useTranslation();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  // Por omisión se invita (si el grupo lo admite); la persona lo desmarca si no quiere avisarle todavía.
  const [invitarElegido, setInvitar] = useState<boolean | null>(null);
  const invitar = puedeInvitar && (invitarElegido ?? true);
  const [filas, setFilas] = useState<FilaRol[]>(() => aFilas(usuario?.roles ?? []));
  const [filasGrupos, setFilasGrupos] = useState<FilaGrupo[]>(() => aFilasDeGrupos(usuario?.grupos ?? []));
  const hayGrupos = grupos.some((g) => !g.predefinido);

  // Solo la primera fila muestra la etiqueta: las demás nombran su control para quien no lo ve (lectores de pantalla).
  const nombreSinEtiqueta = (clave: 'usuarios.alcanceFila' | 'usuarios.rolFila', indice: number) => (indice === 0 ? undefined : t(clave, { numero: String(indice + 1) }));
  const cambiar = (indice: number, cambios: Partial<FilaRol>) => setFilas((actuales) => actuales.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    onGuardar({ nombre: nombre.trim(), correo: correo.trim(), roles: aRoles(filas), grupos: aAsignaciones(filasGrupos), invitar: !usuario && invitar });
  };

  return (
    <Drawer anchor="right" open onClose={guardando ? undefined : onCerrar} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } }, 'aria-labelledby': 'titulo-roles' } }}>
      <Box component="form" onSubmit={enviar} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', px: 3, pt: 2.5, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="h2" id="titulo-roles">
            {usuario ? t('usuarios.editarRoles') : t('usuarios.nuevo')}
          </Typography>
          {usuario && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {usuario.nombre}
            </Typography>
          )}
        </Box>
        <IconButton aria-label={t('comun.cerrar')} onClick={onCerrar} disabled={guardando}>
          <X size={16} />
        </IconButton>
      </Stack>

      <Stack spacing={2.5} sx={{ px: 3, py: 1.5, flex: 1, overflowY: 'auto' }}>
        {usuario ? (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <AvatarActor tipo="persona" nombre={usuario.nombre} tamano={40} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" component="p">{usuario.nombre}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                {usuario.correo}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <>
            <TextField required label={t('usuarios.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <TextField required type="email" label={t('usuarios.correo')} value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </>
        )}

        {error !== null && error !== undefined && <Alert severity="error">{mensajeDeError(error, t)}</Alert>}

        <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
          <Typography variant="subtitle2" component="legend" sx={{ mb: 1 }}>
            {t('usuarios.rolesPorEmpresa')}
          </Typography>
          <Stack spacing={1}>
            {filas.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('usuarios.sinRolesAyuda')}
              </Typography>
            )}
            {filas.map((fila, indice) => (
              <Stack key={indice} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  select
                  label={indice === 0 ? t('usuarios.alcance') : undefined}
                  slotProps={{ select: { SelectDisplayProps: { 'aria-label': nombreSinEtiqueta('usuarios.alcanceFila', indice) } } }}
                  value={fila.alcance}
                  onChange={(e) => cambiar(indice, { alcance: e.target.value })}
                  sx={{ flex: 1.3, minWidth: 0 }}
                >
                  <MenuItem value={ALCANCE_TENANT}>{t('comun.todoElTenant')}</MenuItem>
                  {empresas.map((e) => (
                    <MenuItem key={e.id} value={e.id}>
                      {e.nombre}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={indice === 0 ? t('usuarios.rol') : undefined}
                  slotProps={{ select: { SelectDisplayProps: { 'aria-label': nombreSinEtiqueta('usuarios.rolFila', indice) } } }}
                  value={fila.rol}
                  onChange={(e) => cambiar(indice, { rol: e.target.value as FilaRol['rol'] })}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {t(`usuarios.roles.${r}`)}
                    </MenuItem>
                  ))}
                </TextField>
                {/* Solo la primera fila lleva etiquetas: la X se centra en el control, no en la etiqueta. */}
                <AlineadoConCampo conEtiqueta={indice === 0}>
                  <Tooltip title={t('usuarios.quitarRol')}>
                    <IconButton size="small" aria-label={t('usuarios.quitarRol')} onClick={() => setFilas((a) => a.filter((_, i) => i !== indice))}>
                      <X size={16} />
                    </IconButton>
                  </Tooltip>
                </AlineadoConCampo>
              </Stack>
            ))}
          </Stack>
          <Button
            variant="text"
            startIcon={<Plus size={16} aria-hidden />}
            onClick={() => setFilas((a) => [...a, { rol: 'Revisor', alcance: empresas[0]?.id ?? ALCANCE_TENANT }])}
            sx={{ mt: 1 }}
          >
            {t('usuarios.agregarRol')}
          </Button>
        </Box>

        <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
          <Typography variant="subtitle2" component="legend" sx={{ mb: 0.5 }}>
            {t('gruposDeAcceso.asignacion.titulo')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            {hayGrupos || filasGrupos.length > 0 ? t('gruposDeAcceso.asignacion.ayuda') : t('gruposDeAcceso.asignacion.sinGrupos')}
          </Typography>
          <Stack spacing={1}>
            {filasGrupos.map((fila, indice) => {
              const opciones = gruposElegibles(grupos, fila.grupoId);
              return (
                <Stack key={indice} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField
                    select
                    label={indice === 0 ? t('usuarios.alcance') : undefined}
                    slotProps={{ select: { SelectDisplayProps: { 'aria-label': indice === 0 ? undefined : t('gruposDeAcceso.asignacion.alcanceFila', { numero: String(indice + 1) }) } } }}
                    value={fila.alcance}
                    onChange={(e) => setFilasGrupos((a) => a.map((f, i) => (i === indice ? { ...f, alcance: e.target.value } : f)))}
                    sx={{ flex: 1.3, minWidth: 0 }}
                  >
                    <MenuItem value={ALCANCE_TENANT}>{t('comun.todoElTenant')}</MenuItem>
                    {empresas.map((e) => (
                      <MenuItem key={e.id} value={e.id}>
                        {e.nombre}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={indice === 0 ? t('gruposDeAcceso.asignacion.grupo') : undefined}
                    slotProps={{ select: { SelectDisplayProps: { 'aria-label': indice === 0 ? undefined : t('gruposDeAcceso.asignacion.grupoFila', { numero: String(indice + 1) }) } } }}
                    value={fila.grupoId}
                    onChange={(e) => setFilasGrupos((a) => a.map((f, i) => (i === indice ? { ...f, grupoId: e.target.value } : f)))}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {opciones.map((g) => (
                      <MenuItem key={g.id} value={g.id}>
                        {g.activo ? g.nombre : t('gruposDeAcceso.asignacion.desactivadoMarca', { nombre: g.nombre })}
                      </MenuItem>
                    ))}
                  </TextField>
                  <AlineadoConCampo conEtiqueta={indice === 0}>
                    <Tooltip title={t('gruposDeAcceso.asignacion.quitar')}>
                      <IconButton size="small" aria-label={t('gruposDeAcceso.asignacion.quitar')} onClick={() => setFilasGrupos((a) => a.filter((_, i) => i !== indice))}>
                        <X size={16} />
                      </IconButton>
                    </Tooltip>
                  </AlineadoConCampo>
                </Stack>
              );
            })}
          </Stack>
          {hayGrupos && (
            <Button
              variant="text"
              startIcon={<Plus size={16} aria-hidden />}
              onClick={() => setFilasGrupos((a) => [...a, { grupoId: gruposElegibles(grupos, '')[0]?.id ?? '', alcance: empresas[0]?.id ?? ALCANCE_TENANT }])}
              sx={{ mt: 1 }}
            >
              {t('gruposDeAcceso.asignacion.agregar')}
            </Button>
          )}
        </Box>

        {!usuario && (
          <Box>
            <FormControlLabel
              control={<Checkbox checked={invitar} disabled={!puedeInvitar} onChange={(e) => setInvitar(e.target.checked)} />}
              label={t('usuariosIngreso.invitar')}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', ml: 4 }}>
              {puedeInvitar ? t('usuariosIngreso.invitarAyuda') : t('usuariosIngreso.invitarApagado')}
            </Typography>
          </Box>
        )}

        <Alert severity="info">{t('usuarios.aplicanAlIngresar')}</Alert>

        {usuario?.activo && onDesactivar && (
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 1.5, border: 1, borderColor: 'estado.error.borde', borderRadius: (th) => `${String(th.radio.md)}px` }}
          >
            <Box>
              <Typography variant="subtitle2" component="p">{t('usuarios.desactivarA', { nombre: usuario.nombre })}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('usuarios.desactivarAyuda')}
              </Typography>
            </Box>
            <Button variant="outlined" color="error" startIcon={<Ban size={16} aria-hidden />} onClick={onDesactivar} sx={{ flex: 'none', color: 'estado.error.texto', borderColor: 'estado.error.borde' }}>
              {t('comun.desactivar')}
            </Button>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="text" onClick={onCerrar} disabled={guardando} sx={{ color: 'text.primary' }}>
          {t('comun.cancelar')}
        </Button>
        <Button type="submit" variant="contained" disabled={guardando} startIcon={guardando ? <IconoCarga /> : undefined}>
          {usuario ? t('usuarios.guardarRoles') : t('usuarios.crear')}
        </Button>
      </Stack>
      </Box>
    </Drawer>
  );
}
