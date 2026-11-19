import { Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actualizarGrupoDeAcceso, crearGrupoDeAcceso, desactivarGrupoDeAcceso, reactivarGrupoDeAcceso, SCOPES, type GrupoDeAccesoDto } from '@validalo/api-client';
import { BarraFiltros, CampoBusqueda, EstadoVacio, FilasEsqueleto, FiltroMenu, MarcoTabla, visualmenteOculto } from '@validalo/ui';
import { Ban, CircleCheck, Eye, Lock, Pencil, Plus, RotateCcw, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogoConfirmacion, EncabezadoPagina, ErrorRecuperable, SinPermiso } from '../../../shared/componentes';
import { invalidarRuta } from '../../../shared/consultas';
import { mensajeDeError } from '../../../shared/errores';
import { MenuFila } from '../../../shared/MenuFila';
import { useAvisos } from '../../../shared/useAvisos';
import { usePermisos } from '../../../shared/usePermisos';
import { useEmpresaActiva } from '../../empresas/useEmpresas';
import { nombreSeccion, type CodigoRespaldo } from '../../terceros/ficha/secciones';
import { SCOPES_DEL_TENANT } from '../apiKeys/scopes';
import { useGruposDeAcceso } from './api';
import { DrawerGrupo } from './DrawerGrupo';
import { enOrdenDeLaFicha, normalizarCodigoDeGrupo, sectoresADto, type GrupoEnEditor } from './modelo';

type Edicion = { tipo: 'crear'; clave: string } | { tipo: 'editar'; grupo: GrupoDeAccesoDto } | { tipo: 'ver'; grupo: GrupoDeAccesoDto };

function EstadoDelGrupo({ activo }: { activo: boolean }) {
  const { t } = useTranslation();
  return (
    <Box component="span" sx={{ typography: 'body2', display: 'inline-flex', alignItems: 'center', gap: 0.75, '& svg': { color: activo ? 'estado.exito.texto' : 'text.secondary' } }}>
      {activo ? <CircleCheck size={14} strokeWidth={1.75} aria-hidden /> : <Ban size={14} strokeWidth={1.75} aria-hidden />}
      {activo ? t('gruposDeAcceso.activo') : t('gruposDeAcceso.desactivado')}
    </Box>
  );
}

/** Grupos de acceso del grupo empresarial (GA-1…GA-9): los cuatro roles fijos como predefinidos y los propios, que se crean, se editan y se desactivan. */
export function PaginaGruposDeAcceso() {
  const { t } = useTranslation();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puede = permisos.puede(SCOPES.usuariosAdministrar);
  const consulta = useGruposDeAcceso(puede);
  const cliente = useQueryClient();
  const mostrar = useAvisos((s) => s.mostrar);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [porCambiar, setPorCambiar] = useState<GrupoDeAccesoDto | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');

  const guardar = useMutation({
    mutationFn: (datos: GrupoEnEditor) => {
      const sectores = sectoresADto(datos.sectores);
      const comun = { nombre: datos.nombre.trim(), descripcion: datos.descripcion.trim() || null, permisos: datos.permisos, sectores };
      if (edicion?.tipo === 'editar') return actualizarGrupoDeAcceso(edicion.grupo.id, comun, { empresa: null });
      return crearGrupoDeAcceso({ ...comun, codigo: normalizarCodigoDeGrupo(datos.codigo) }, { empresa: null, idempotencyKey: edicion?.tipo === 'crear' ? edicion.clave : undefined });
    },
    onSuccess: () => {
      mostrar(edicion?.tipo === 'editar' ? t('gruposDeAcceso.guardado') : t('gruposDeAcceso.creado'));
      setEdicion(null);
    },
    onSettled: () => invalidarRuta(cliente, '/api/v1/grupos-de-acceso'),
  });

  const cambiarEstado = useMutation({
    mutationFn: (grupo: GrupoDeAccesoDto) => (grupo.activo ? desactivarGrupoDeAcceso(grupo.id, { empresa: null }) : reactivarGrupoDeAcceso(grupo.id, { empresa: null })),
    onSuccess: (_, grupo) => mostrar(grupo.activo ? t('gruposDeAcceso.desactivadoAviso') : t('gruposDeAcceso.reactivadoAviso')),
    onError: (error) => mostrar(mensajeDeError(error, t), 'error'),
    onSettled: () => {
      setPorCambiar(null);
      return invalidarRuta(cliente, '/api/v1/grupos-de-acceso');
    },
  });

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (consulta.data ?? []).filter(
      (g) => (estado === '' || (estado === 'activos') === g.activo) && (!q || `${g.nombre} ${g.codigo}`.toLowerCase().includes(q)),
    );
  }, [consulta.data, busqueda, estado]);

  if (!puede) return <SinPermiso seccion={t('nav.grupos-de-acceso')} />;

  const resumenDePermisos = (g: GrupoDeAccesoDto) =>
    SCOPES_DEL_TENANT.every((s) => g.permisos.includes(s)) ? t('gruposDeAcceso.todosLosPermisos') : t('gruposDeAcceso.permisosN', { count: g.permisos.length });
  const resumenDeSectores = (g: GrupoDeAccesoDto) =>
    g.sectores.length === 0
      ? t('gruposDeAcceso.todosLosSectores')
      : enOrdenDeLaFicha(g.sectores)
          .map((s) => t('gruposDeAcceso.sectorNivel', { sector: nombreSeccion(s.sector as CodigoRespaldo, t), nivel: t(`gruposDeAcceso.niveles.${s.nivel}`) }))
          .join(', ');
  const abrir = (siguiente: Edicion) => {
    guardar.reset();
    setEdicion(siguiente);
  };

  return (
    <>
      <EncabezadoPagina
        titulo={t('gruposDeAcceso.titulo')}
        subtitulo={t('gruposDeAcceso.ayuda')}
        acciones={
          <Button variant="contained" startIcon={<Plus size={16} aria-hidden />} onClick={() => abrir({ tipo: 'crear', clave: crypto.randomUUID() })}>
            {t('gruposDeAcceso.nuevo')}
          </Button>
        }
      />
      <BarraFiltros>
        <CampoBusqueda valor={busqueda} onCambiar={setBusqueda} placeholder={t('gruposDeAcceso.buscar')} ancho={280} />
        <FiltroMenu
          etiqueta={t('gruposDeAcceso.columnas.estado')}
          textoTodos={t('comun.todas')}
          valor={estado}
          onCambiar={setEstado}
          opciones={[
            { valor: 'activos', etiqueta: t('gruposDeAcceso.activos') },
            { valor: 'desactivados', etiqueta: t('gruposDeAcceso.desactivados') },
          ]}
        />
      </BarraFiltros>
      {consulta.isError && (
        <Box sx={{ mb: 1.5 }}>
          <ErrorRecuperable mensaje={mensajeDeError(consulta.error, t)} onReintentar={() => void consulta.refetch()} />
        </Box>
      )}
      <MarcoTabla>
        <TableContainer>
          <Table size="small" aria-label={t('gruposDeAcceso.titulo')} aria-busy={consulta.isPending}>
            <TableHead>
              <TableRow>
                <TableCell>{t('gruposDeAcceso.columnas.grupo')}</TableCell>
                <TableCell sx={{ width: 150 }}>{t('gruposDeAcceso.columnas.permisos')}</TableCell>
                <TableCell>{t('gruposDeAcceso.columnas.sectores')}</TableCell>
                <TableCell sx={{ width: 100 }}>{t('gruposDeAcceso.columnas.personas')}</TableCell>
                <TableCell sx={{ width: 130 }}>{t('gruposDeAcceso.columnas.estado')}</TableCell>
                <TableCell sx={{ width: 48 }}>
                  <Box component="span" sx={visualmenteOculto}>
                    {t('comun.acciones')}
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consulta.isPending && <FilasEsqueleto columnas={6} alto={52} />}
              {consulta.data && visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ borderBottom: 0 }}>
                    <EstadoVacio compacto icono={UsersRound} titulo={t('gruposDeAcceso.sinCoincidencias')} />
                  </TableCell>
                </TableRow>
              )}
              {visibles.map((g) => (
                <TableRow key={g.id}>
                  <TableCell sx={{ height: 52 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" component="p" noWrap>
                          {g.nombre}
                        </Typography>
                        <Typography variant="monoTabla" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                          {g.codigo}
                        </Typography>
                      </Box>
                      {g.predefinido && (
                        <Box component="span" title={t('gruposDeAcceso.predefinidoAyuda')} sx={{ typography: 'caption', display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <Lock size={12} strokeWidth={1.75} aria-hidden />
                          {t('gruposDeAcceso.predefinido')}
                        </Box>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{resumenDePermisos(g)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: g.sectores.length === 0 ? 'text.secondary' : 'text.primary' }}>
                      {resumenDeSectores(g)}
                    </Typography>
                  </TableCell>
                  <TableCell>{g.usuarios}</TableCell>
                  <TableCell>
                    <EstadoDelGrupo activo={g.activo} />
                  </TableCell>
                  <TableCell align="right">
                    <MenuFila
                      etiqueta={t('comun.accionesDe', { nombre: g.nombre })}
                      acciones={
                        g.predefinido
                          ? [{ etiqueta: t('gruposDeAcceso.verPermisos'), icono: Eye, onClick: () => abrir({ tipo: 'ver', grupo: g }) }]
                          : [
                              { etiqueta: t('gruposDeAcceso.editar'), icono: Pencil, onClick: () => abrir({ tipo: 'editar', grupo: g }) },
                              g.activo
                                ? { etiqueta: t('gruposDeAcceso.desactivar'), icono: Ban, destructiva: true, onClick: () => setPorCambiar(g) }
                                : { etiqueta: t('gruposDeAcceso.reactivar'), icono: RotateCcw, onClick: () => setPorCambiar(g) },
                            ]
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </MarcoTabla>

      {porCambiar && (
        <DialogoConfirmacion
          titulo={t(porCambiar.activo ? 'gruposDeAcceso.desactivarA' : 'gruposDeAcceso.reactivarA', { nombre: porCambiar.nombre })}
          mensaje={t(porCambiar.activo ? 'gruposDeAcceso.desactivarAyuda' : 'gruposDeAcceso.reactivarAyuda')}
          confirmar={porCambiar.activo ? t('gruposDeAcceso.desactivar') : t('gruposDeAcceso.confirmarReactivar')}
          icono={porCambiar.activo ? <Ban size={16} aria-hidden /> : <RotateCcw size={16} aria-hidden />}
          ocupado={cambiarEstado.isPending}
          onConfirmar={() => cambiarEstado.mutate(porCambiar)}
          onCerrar={() => setPorCambiar(null)}
        />
      )}

      {edicion && (
        <DrawerGrupo
          key={edicion.tipo === 'crear' ? edicion.clave : edicion.grupo.id}
          grupo={edicion.tipo === 'crear' ? null : edicion.grupo}
          guardando={guardar.isPending}
          error={guardar.error}
          onGuardar={(datos) => guardar.mutate(datos)}
          onCerrar={() => setEdicion(null)}
        />
      )}
    </>
  );
}
