import { Alert, TextField } from '@mui/material';
import type { TenantDto } from '@validasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from '../../shared/errores';
import { useAvisos } from '../../shared/useAvisos';
import { useCorregirGrupo } from './apiFicha';
import { MarcoDeDialogo } from './MarcoDeDialogo';
import { borradorDeGrupo, cuerpoCorregirGrupo, hayCambiosDeGrupo, validarGrupoEditable, type BorradorDeGrupo, type ErrorDeGrupo } from './modeloFicha';

const MONO = { '& input': { fontFamily: (th: { typography: { mono: { fontFamily?: string } } }) => th.typography.mono.fontFamily } };

/**
 * Corregir el nombre, la región y la zona horaria del grupo. El identificador se muestra pero no se edita (va en las API keys): su ayuda dice por qué.
 */
export function DialogoCorregirGrupo({ grupo, onCerrar }: { grupo: TenantDto; onCerrar: () => void }) {
  const { t } = useTranslation();
  const mostrar = useAvisos((s) => s.mostrar);
  const corregir = useCorregirGrupo(grupo.id);
  const [b, setB] = useState<BorradorDeGrupo>(() => borradorDeGrupo(grupo));
  const [tocados, setTocados] = useState<ReadonlySet<ErrorDeGrupo>>(new Set());
  const errores = validarGrupoEditable(b);
  const cambios = hayCambiosDeGrupo(b, grupo);
  const cambiar = (parcial: Partial<BorradorDeGrupo>) => setB((previo) => ({ ...previo, ...parcial }));
  const tocar = (e: ErrorDeGrupo) => setTocados((previos) => new Set([...previos, e]));
  const error = (e: ErrorDeGrupo) => (errores.includes(e) && tocados.has(e) ? t(`plataforma.ficha.grupo.errores.${e}`) : null);

  const enviar = () =>
    corregir.mutate(cuerpoCorregirGrupo(b), {
      onSuccess: (guardado) => {
        mostrar(t('plataforma.ficha.grupo.guardado', { grupo: guardado.nombre }));
        onCerrar();
      },
    });

  const errorNombre = error('nombre-requerido');
  const errorZona = error('zona-invalida');
  return (
    <MarcoDeDialogo
      idTitulo="titulo-corregir-grupo"
      titulo={t('plataforma.ficha.grupo.editar')}
      subtitulo={grupo.nombre}
      ocupado={corregir.isPending}
      sinEnviar={errores.length > 0 || !cambios}
      falta={errores[0] ? t(`plataforma.ficha.grupo.errores.${errores[0]}`) : undefined}
      textoEnviar={t('comun.guardar')}
      onEnviar={enviar}
      onCerrar={onCerrar}
    >
      {corregir.isError && <Alert severity="error">{mensajeDeError(corregir.error, t)}</Alert>}
      <TextField
        required
        label={t('plataforma.ficha.grupo.nombre')}
        value={b.nombre}
        onChange={(e) => cambiar({ nombre: e.target.value })}
        onBlur={() => tocar('nombre-requerido')}
        error={errorNombre !== null}
        helperText={errorNombre ?? t('plataforma.ficha.grupo.nombreAyuda')}
        slotProps={{ htmlInput: { autoComplete: 'off' } }}
      />
      <TextField
        label={t('plataforma.ficha.grupo.identificador')}
        value={grupo.slug}
        helperText={t('plataforma.ficha.grupo.identificadorAyuda')}
        slotProps={{ input: { readOnly: true }, htmlInput: { 'aria-readonly': true } }}
        sx={{ ...MONO, '& .MuiInputBase-root': { bgcolor: 'superficie.nivel2' } }}
      />
      <TextField
        label={t('plataforma.ficha.grupo.zona')}
        value={b.zonaHoraria}
        onChange={(e) => cambiar({ zonaHoraria: e.target.value })}
        onBlur={() => tocar('zona-invalida')}
        error={errorZona !== null}
        helperText={errorZona ?? t('plataforma.ficha.grupo.zonaAyuda')}
        slotProps={{ htmlInput: { spellCheck: false, autoComplete: 'off' } }}
        sx={MONO}
      />
      <TextField
        label={t('plataforma.ficha.grupo.region')}
        value={b.region}
        onChange={(e) => cambiar({ region: e.target.value.toLowerCase() })}
        helperText={t('plataforma.ficha.grupo.regionAyuda')}
        slotProps={{ htmlInput: { maxLength: 10, spellCheck: false, autoComplete: 'off' } }}
        sx={{ ...MONO, maxWidth: 160 }}
      />
      <Alert severity="info">{t('plataforma.ficha.grupo.sandboxAyuda')}</Alert>
    </MarcoDeDialogo>
  );
}
