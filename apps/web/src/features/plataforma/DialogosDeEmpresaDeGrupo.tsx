import type { EmpresaDeGrupoDto, GrupoDto } from '@avalasoft/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogoEmpresa } from '../configuracion/empresas/DialogoEmpresa';
import { borradorDeEmpresa } from '../configuracion/empresas/modelo';
import { useCorregirEmpresaDeGrupo, useCrearEmpresaDeGrupo } from './apiIdentidad';

/** Agregar una empresa a un grupo que ya existe (PI-9): el mismo formulario del grupo, con la clave de idempotencia de este diálogo. */
export function DialogoNuevaEmpresa({ grupo, onCerrar }: { grupo: GrupoDto; onCerrar: () => void }) {
  const { t } = useTranslation();
  const [clave] = useState(() => crypto.randomUUID());
  const mutacion = useCrearEmpresaDeGrupo(grupo.tenant.id, clave);
  return <DialogoEmpresa claveIdempotencia={clave} mutacion={mutacion} subtitulo={t('consola.empresa.paraElGrupo', { grupo: grupo.tenant.nombre })} onCerrar={onCerrar} onGuardada={onCerrar} />;
}

/** Corregir la identificación, la razón social y el prefijo de folio de una empresa del grupo, siempre: el mismo formulario del alta, precargado. */
export function DialogoCorregirEmpresa({ grupo, empresa, onCerrar }: { grupo: GrupoDto; empresa: EmpresaDeGrupoDto; onCerrar: () => void }) {
  const { t } = useTranslation();
  const mutacion = useCorregirEmpresaDeGrupo(grupo.tenant.id, empresa.id);
  return <DialogoEmpresa mutacion={mutacion} inicial={borradorDeEmpresa(empresa)} subtitulo={t('consola.empresa.paraElGrupo', { grupo: grupo.tenant.nombre })} onCerrar={onCerrar} onGuardada={onCerrar} />;
}
