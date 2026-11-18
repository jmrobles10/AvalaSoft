import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { SCOPES, type CuestionarioDto, type QuienResponde } from '@avalasoft/api-client';
import { EstadoVacio, FormularioDeDialogo, MarcoTabla } from '@avalasoft/ui';
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { EncabezadoPagina, ErrorRecuperable, IconoCarga, SinPermiso } from '../../../shared/componentes';
import { usePermisos } from '../../../shared/usePermisos';
import { useEmpresaActiva } from '../../empresas/useEmpresas';
import { useCrearCuestionario, useCuestionarios } from '../api';
import { definicionInicial, errorDeCuestionario, numero } from '../modelo';

/** Cuestionarios de evaluación de la empresa activa (CE-1): el código, quién responde, el umbral y qué versiones tienen publicadas y en borrador. */
export function PaginaCuestionarios() {
  const { t } = useTranslation();
  const navegar = useNavigate();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puedeLeer = permisos.puede(SCOPES.cuestionariosLeer);
  const puedeEscribir = permisos.puede(SCOPES.cuestionariosEscribir);
  const consulta = useCuestionarios(empresa.id, puedeLeer);
  const [creando, setCreando] = useState(false);

  if (!puedeLeer) return <SinPermiso seccion={t('nav.cuestionarios')} />;
  const cuestionarios = consulta.data ?? [];
  const abrir = (c: CuestionarioDto) => void navegar(`/e/${empresa.id}/cuestionarios/${c.id}`);

  return (
    <>
      <EncabezadoPagina
        titulo={t('evaluaciones.cuestionarios.titulo', { empresa: empresa.nombre })}
        subtitulo={t('evaluaciones.cuestionarios.ayuda')}
        acciones={
          puedeEscribir ? (
            <Button variant="contained" startIcon={<Plus size={16} aria-hidden />} onClick={() => setCreando(true)}>
              {t('evaluaciones.cuestionarios.nuevo')}
            </Button>
          ) : undefined
        }
      />
      {consulta.isError && <ErrorRecuperable mensaje={errorDeCuestionario(consulta.error, t)} onReintentar={() => void consulta.refetch()} />}
      <MarcoTabla>
        <Table size="small" aria-label={t('nav.cuestionarios')}>
          <TableHead>
            <TableRow>
              <TableCell>{t('evaluaciones.cuestionarios.columnas.cuestionario')}</TableCell>
              <TableCell sx={{ width: 220 }}>{t('evaluaciones.cuestionarios.columnas.responde')}</TableCell>
              <TableCell sx={{ width: 100 }}>{t('evaluaciones.cuestionarios.columnas.umbral')}</TableCell>
              <TableCell sx={{ width: 130 }}>{t('evaluaciones.cuestionarios.columnas.publicada')}</TableCell>
              <TableCell sx={{ width: 110 }}>{t('evaluaciones.cuestionarios.columnas.borrador')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consulta.isPending &&
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  {[0, 1, 2, 3, 4].map((j) => (
                    <TableCell key={j}>
                      <Skeleton variant="rounded" height={12} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {cuestionarios.map((c) => {
              const vigente = c.publicada ?? c.borrador;
              return (
                <TableRow
                  key={c.id}
                  hover
                  tabIndex={0}
                  aria-label={t('evaluaciones.cuestionarios.abrir', { nombre: c.nombre })}
                  onClick={() => abrir(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') abrir(c);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography component="span" sx={{ fontWeight: 500 }}>
                        {c.nombre}
                      </Typography>
                      <Typography component="span" variant="monoTabla" sx={{ color: 'text.secondary' }}>
                        {c.codigo}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{vigente ? t(`evaluaciones.responde.${vigente.definicion.responde}`) : '—'}</TableCell>
                  <TableCell>{vigente ? numero(vigente.definicion.umbralDeAprobacion) : '—'}</TableCell>
                  <TableCell>
                    <Typography component="span" variant="monoTabla" color={c.publicada ? 'text.primary' : 'text.secondary'}>
                      {c.publicada ? t('evaluaciones.cuestionarios.version', { version: String(c.publicada.version) }) : t('evaluaciones.cuestionarios.sinPublicar')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography component="span" variant="monoTabla" color={c.borrador ? 'text.primary' : 'text.secondary'}>
                      {c.borrador ? t('evaluaciones.cuestionarios.version', { version: String(c.borrador.version) }) : '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {consulta.isSuccess && cuestionarios.length === 0 && (
          <EstadoVacio compacto titulo={t('evaluaciones.cuestionarios.vacio', { empresa: empresa.nombre })} texto={t('evaluaciones.cuestionarios.vacioAyuda')} />
        )}
      </MarcoTabla>
      {creando && <DialogoNuevoCuestionario empresaId={empresa.id} onCerrar={() => setCreando(false)} onCreado={(id) => void navegar(`/e/${empresa.id}/cuestionarios/${id}`)} />}
    </>
  );
}

function DialogoNuevoCuestionario({ empresaId, onCerrar, onCreado }: { empresaId: string; onCerrar: () => void; onCreado: (id: string) => void }) {
  const { t } = useTranslation();
  const crear = useCrearCuestionario(empresaId);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [responde, setResponde] = useState<QuienResponde>('Tercero');
  const valido = /^[A-Z][A-Z0-9_]{1,39}$/.test(codigo) && nombre.trim().length > 0;

  const enviar = (evento: SubmitEvent) => {
    evento.preventDefault();
    if (!valido) return;
    crear.mutate(
      { codigo, nombre: nombre.trim(), definicion: definicionInicial(responde, { seccion: t('evaluaciones.cuestionarios.seccionInicial'), pregunta: t('evaluaciones.cuestionarios.preguntaInicial') }) },
      { onSuccess: (c) => onCreado(c.id) },
    );
  };

  return (
    <Dialog open onClose={crear.isPending ? undefined : onCerrar} maxWidth={false} slotProps={{ paper: { sx: { width: 460, maxWidth: 'calc(100% - 32px)' } } }} aria-labelledby="titulo-nuevo-cuestionario">
      <FormularioDeDialogo onSubmit={enviar}>
        <DialogTitle id="titulo-nuevo-cuestionario">{t('evaluaciones.cuestionarios.nuevoTitulo')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">{t('evaluaciones.cuestionarios.nuevoAyuda')}</Alert>
            {crear.isError && <Alert severity="error">{errorDeCuestionario(crear.error, t)}</Alert>}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: '160px minmax(0,1fr)' }, alignItems: 'start' }}>
              <TextField
                size="small"
                label={t('evaluaciones.cuestionarios.codigo')}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                helperText={t('evaluaciones.cuestionarios.codigoAyuda')}
                slotProps={{ htmlInput: { maxLength: 40, autoComplete: 'off' } }}
              />
              <TextField size="small" label={t('evaluaciones.cuestionarios.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} slotProps={{ htmlInput: { maxLength: 150 } }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" component="h3">
                {t('evaluaciones.editor.quienResponde')}
              </Typography>
              <RadioGroup value={responde} onChange={(e) => setResponde(e.target.value as QuienResponde)}>
                {(['Tercero', 'Evaluador'] as const).map((quien) => (
                  <FormControlLabel key={quien} value={quien} control={<Radio size="small" />} label={t(`evaluaciones.editor.responde.${quien}`)} />
                ))}
              </RadioGroup>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onCerrar} disabled={crear.isPending} sx={{ color: 'text.primary' }}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" variant="contained" disabled={!valido || crear.isPending} startIcon={crear.isPending ? <IconoCarga /> : undefined}>
            {t('evaluaciones.cuestionarios.crear')}
          </Button>
        </DialogActions>
      </FormularioDeDialogo>
    </Dialog>
  );
}
