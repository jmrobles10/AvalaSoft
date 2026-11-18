import { Alert, Box, Button, Chip, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { esErrorApi, SCOPES, type CuestionarioDto, type CuestionarioVersionDto, type DefinicionDeCuestionarioDto, type QuienResponde } from '@avalasoft/api-client';
import { CampoNumero, EsqueletoTarjeta, PaginaEstado } from '@avalasoft/ui';
import { Pencil, Plus, Rocket, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { DialogoConfirmacion, EncabezadoPagina, EnlaceVolver, ErrorRecuperable, IconoCarga, SinPermiso, Tarjeta } from '../../../shared/componentes';
import { usePermisos } from '../../../shared/usePermisos';
import { useAvisos } from '../../../shared/useAvisos';
import { useEmpresaActiva } from '../../empresas/useEmpresas';
import { useCuestionario, useEditarCuestionario, usePublicarCuestionario } from '../api';
import { CampoDecimal } from '../CampoDecimal';
import { errorDeCuestionario, mover, numero, seccionNueva, siguienteCodigo, validarDefinicion } from '../modelo';
import { EditorDeSeccion } from './EditorDeSeccion';

interface Borrador {
  nombre: string;
  definicion: DefinicionDeCuestionarioDto;
}

/** Lo que se edita: el borrador si lo hay; si no, la publicada (al guardar nace el borrador siguiente). */
function ultimaVersion(c: CuestionarioDto): CuestionarioVersionDto | null {
  return c.borrador ?? c.publicada ?? null;
}

/** El borrador tal como lo guardó el servidor (que normaliza al guardar), o nada si el cuestionario no tiene borrador. */
function delServidor(c: CuestionarioDto): Borrador | null {
  return c.borrador ? { nombre: c.nombre, definicion: c.borrador.definicion } : null;
}

/** Orden de campos y valores vacíos no cuentan: `{ a: 1, b: null }` y `{ b: undefined, a: 1 }` dicen lo mismo. */
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor === null || typeof valor !== 'object') return valor;
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonico(v)]),
  );
}

/** Huella para saber si el editor difiere del servidor: se compara el contenido, no cómo lo escribió cada lado (orden de campos, nulos explícitos u omitidos). */
function firma(b: Borrador): string {
  return JSON.stringify(canonico({ nombre: b.nombre.trim(), definicion: b.definicion }));
}

/**
 * Editor del cuestionario de evaluación (CE-1, CE-2): ajustes generales (quién responde, umbral, reevaluación) y secciones con sus preguntas. Se edita el borrador;
 * con solo versión publicada, «Editar» prepara el borrador siguiente. Publicar congela la versión: las evaluaciones ya asignadas conservan la que copiaron.
 */
export function EditorCuestionario() {
  const { t } = useTranslation();
  const { cuestionarioId = '' } = useParams();
  const { empresa } = useEmpresaActiva();
  const permisos = usePermisos(empresa.id);
  const puedeEscribir = permisos.puede(SCOPES.cuestionariosEscribir);
  const mostrar = useAvisos((s) => s.mostrar);
  const consulta = useCuestionario(empresa.id, cuestionarioId);
  const editar = useEditarCuestionario(empresa.id, cuestionarioId);
  const publicar = usePublicarCuestionario(empresa.id, cuestionarioId);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const datos = consulta.data;
  const idBorradorServidor = datos?.borrador?.id;
  // Al cargar (o tras guardar por primera vez) el borrador del servidor pasa al editor.
  useEffect(() => {
    if (datos?.borrador) setBorrador({ nombre: datos.nombre, definicion: datos.borrador.definicion });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el borrador del servidor
  }, [idBorradorServidor]);

  if (!permisos.puede(SCOPES.cuestionariosLeer)) return <SinPermiso seccion={t('nav.cuestionarios')} />;
  const volver = <EnlaceVolver a={`/e/${empresa.id}/cuestionarios`}>{t('nav.cuestionarios')}</EnlaceVolver>;

  if (consulta.isPending) {
    return (
      <Box aria-busy>
        {volver}
        <Skeleton variant="rounded" width={320} height={28} sx={{ mb: 3 }} />
        <EsqueletoTarjeta alto={360} />
      </Box>
    );
  }
  if (consulta.isError || !datos) {
    if (esErrorApi(consulta.error) && consulta.error.esNoEncontrado)
      return <PaginaEstado icono={SearchX} titulo={t('evaluaciones.cuestionarios.noEncontrado')} texto={t('evaluaciones.cuestionarios.noEncontradoAyuda')} acciones={volver} />;
    return (
      <>
        {volver}
        <ErrorRecuperable mensaje={errorDeCuestionario(consulta.error, t)} onReintentar={() => void consulta.refetch()} />
      </>
    );
  }

  const ultima = ultimaVersion(datos);
  const mostrado: Borrador | null = borrador ?? (ultima ? { nombre: datos.nombre, definicion: ultima.definicion } : null);
  const editando = borrador !== null && puedeEscribir;
  const errores = borrador ? validarDefinicion(borrador.definicion) : [];
  const delServ = delServidor(datos);
  const sinGuardar = Boolean(borrador && (!delServ || firma(borrador) !== firma(delServ)));
  const ocupado = editar.isPending || publicar.isPending;
  const errorMutacion = editar.error ?? publicar.error;
  const preguntaConError = esErrorApi(errorMutacion) && typeof errorMutacion.extensiones.pregunta === 'string' ? errorMutacion.extensiones.pregunta : null;
  const erroresDeApi: Record<string, string> = preguntaConError && errorMutacion ? { [preguntaConError]: errorDeCuestionario(errorMutacion, t) } : {};
  const visibles = intentado || errores.some((e) => e.codigo === 'eliminatoria-sin-criterio') ? errores : [];

  const cambiarDefinicion = (cambio: Partial<DefinicionDeCuestionarioDto>) => borrador && setBorrador({ ...borrador, definicion: { ...borrador.definicion, ...cambio } });

  const guardar = () => {
    setIntentado(true);
    if (!borrador || errores.length > 0) return;
    const enviado = firma(borrador);
    editar.mutate(
      { nombre: borrador.nombre.trim(), definicion: borrador.definicion },
      {
        onSuccess: (guardado) => {
          // El servidor normaliza al guardar (recorta, completa y reordena): lo que queda guardado es lo suyo. Si el editor no cambió desde el envío, pasa a ser esa copia;
          // si la persona siguió editando mientras tanto, se conserva lo que escribió y sigue pendiente de guardar.
          const guardadoPorElServidor = delServidor(guardado);
          setBorrador((actual) => (guardadoPorElServidor && actual && firma(actual) === enviado ? guardadoPorElServidor : actual));
          mostrar(t('evaluaciones.editor.guardado'));
        },
      },
    );
  };
  const confirmarPublicacion = () =>
    publicar.mutate(undefined, {
      onSuccess: (c) => {
        mostrar(t('evaluaciones.editor.publicado', { version: String(c.publicada?.version ?? '') }));
        setConfirmar(false);
        setBorrador(null);
        setIntentado(false);
      },
      onError: () => setConfirmar(false),
    });

  const acciones = puedeEscribir ? (
    <>
      {!borrador && ultima && (
        <Button variant="contained" startIcon={<Pencil size={16} aria-hidden />} onClick={() => setBorrador({ nombre: datos.nombre, definicion: ultima.definicion })}>
          {t('evaluaciones.editor.editar')}
        </Button>
      )}
      {borrador && sinGuardar && datos.borrador && (
        <Button variant="text" onClick={() => setBorrador({ nombre: datos.nombre, definicion: datos.borrador?.definicion ?? borrador.definicion })} disabled={ocupado} sx={{ color: 'text.primary' }}>
          {t('evaluaciones.editor.descartar')}
        </Button>
      )}
      {borrador && sinGuardar && (
        <Button variant={datos.borrador ? 'outlined' : 'contained'} onClick={guardar} disabled={ocupado} startIcon={editar.isPending ? <IconoCarga /> : undefined}>
          {t('evaluaciones.editor.guardar')}
        </Button>
      )}
      {datos.borrador && !sinGuardar && (
        <Button variant="contained" startIcon={<Rocket size={16} aria-hidden />} onClick={() => setConfirmar(true)} disabled={ocupado || errores.length > 0}>
          {t('evaluaciones.editor.publicar', { version: String(datos.borrador.version) })}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <>
      <EncabezadoPagina
        antes={volver}
        titulo={datos.nombre}
        tituloCompleto={datos.nombre}
        subtitulo={`${datos.codigo} · ${t('evaluaciones.editor.versiones', { publicada: datos.publicada?.version ?? '—', borrador: datos.borrador?.version ?? '—' })}`}
        acciones={acciones}
      />
      {errorMutacion && <Alert severity="error" sx={{ mb: 2 }}>{errorDeCuestionario(errorMutacion, t)}</Alert>}
      {intentado && errores.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{t('evaluaciones.editor.revisa')}</Alert>}
      {!borrador && datos.publicada && puedeEscribir && (
        <Alert severity="info" sx={{ mb: 2 }}>{t('evaluaciones.editor.editarAyuda', { version: String(datos.publicada.version + 1) })}</Alert>
      )}
      {datos.publicada && datos.borrador && (
        <Alert severity="info" sx={{ mb: 2 }}>{t('evaluaciones.editor.seguiraVigente', { version: String(datos.publicada.version) })}</Alert>
      )}

      {mostrado && (
        <Stack spacing={2}>
          <Tarjeta titulo={t('evaluaciones.editor.general')}>
            <Stack spacing={2}>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 160px 200px' }, alignItems: 'start' }}>
                <TextField
                  size="small"
                  label={t('evaluaciones.editor.nombre')}
                  value={mostrado.nombre}
                  onChange={(e) => borrador && setBorrador({ ...borrador, nombre: e.target.value })}
                  disabled={!editando}
                  slotProps={{ htmlInput: { maxLength: 150 } }}
                />
                <CampoDecimal
                  label={t('evaluaciones.editor.umbral')}
                  valor={numero(mostrado.definicion.umbralDeAprobacion)}
                  disabled={!editando}
                  error={visibles.some((e) => e.codigo === 'umbral-invalido')}
                  helperText={t('evaluaciones.editor.umbralAyuda')}
                  onCambiar={(v) => cambiarDefinicion({ umbralDeAprobacion: v ?? 0 })}
                />
                <CampoNumero
                  etiqueta={t('evaluaciones.editor.reevaluar')}
                  valor={mostrado.definicion.reevaluarCadaMeses}
                  maxDigitos={2}
                  deshabilitado={!editando}
                  ayuda={t('evaluaciones.editor.reevaluarAyuda')}
                  onCambiar={(x) => cambiarDefinicion({ reevaluarCadaMeses: x === '' ? null : Number(x) })}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" component="h3">
                  {t('evaluaciones.editor.quienResponde')}
                </Typography>
                <RadioGroup row value={mostrado.definicion.responde} onChange={(e) => cambiarDefinicion({ responde: e.target.value as QuienResponde })}>
                  {(['Tercero', 'Evaluador'] as const).map((quien) => (
                    <FormControlLabel key={quien} value={quien} control={<Radio size="small" disabled={!editando} />} label={t(`evaluaciones.editor.responde.${quien}`)} />
                  ))}
                </RadioGroup>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t(`evaluaciones.editor.respondeAyuda.${mostrado.definicion.responde}`)}
                </Typography>
              </Box>
              <TextField
                size="small"
                multiline
                minRows={1}
                label={t('evaluaciones.editor.descripcion')}
                value={mostrado.definicion.descripcion ?? ''}
                onChange={(e) => cambiarDefinicion({ descripcion: e.target.value || null })}
                disabled={!editando}
                slotProps={{ htmlInput: { maxLength: 500 } }}
              />
            </Stack>
          </Tarjeta>

          {mostrado.definicion.secciones.map((seccion, indice) => (
            <EditorDeSeccion
              key={seccion.codigo}
              definicion={mostrado.definicion}
              indice={indice}
              soloLectura={!editando}
              errores={visibles}
              erroresDeApi={erroresDeApi}
              onCambiar={(s) => cambiarDefinicion({ secciones: mostrado.definicion.secciones.map((x, i) => (i === indice ? s : x)) })}
              onQuitar={() => cambiarDefinicion({ secciones: mostrado.definicion.secciones.filter((_, i) => i !== indice) })}
              onMover={(d) => {
                const destino = indice + d;
                if (destino < 0 || destino >= mostrado.definicion.secciones.length) return;
                cambiarDefinicion({ secciones: mover(mostrado.definicion.secciones, indice, destino) });
              }}
            />
          ))}
          {editando && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Plus size={14} aria-hidden />}
                onClick={() =>
                  cambiarDefinicion({
                    secciones: [...mostrado.definicion.secciones, seccionNueva(siguienteCodigo(mostrado.definicion, 'S'), siguienteCodigo(mostrado.definicion, 'P'))],
                  })
                }
              >
                {t('evaluaciones.editor.agregarSeccion')}
              </Button>
              {visibles.some((e) => e.codigo === 'sin-secciones') && (
                <Chip size="small" color="error" variant="outlined" label={t('evaluaciones.editor.errores.sin-secciones')} sx={{ ml: 1 }} />
              )}
            </Box>
          )}
        </Stack>
      )}

      {confirmar && datos.borrador && (
        <DialogoConfirmacion
          titulo={t('evaluaciones.editor.publicarTitulo', { version: String(datos.borrador.version) })}
          mensaje={t('evaluaciones.editor.publicarMensaje')}
          confirmar={t('evaluaciones.editor.publicarConfirmar')}
          tono="primary"
          ocupado={publicar.isPending}
          onConfirmar={confirmarPublicacion}
          onCerrar={() => setConfirmar(false)}
        />
      )}
    </>
  );
}
