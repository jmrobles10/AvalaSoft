import { SCOPES, type AreaExpedienteDto, type ExpedienteDto, type MotivoTipificadoDto } from '@validalo/api-client';
import { useCallback, useMemo, useState } from 'react';
import { useSesion } from '../../sesion/sesionStore';
import { usePermisos } from '../../shared/usePermisos';
import { useAreas } from '../configuracion/areas/api';
import { useNombresUsuarios } from '../configuracion/usuarios/api';
import { useMotivos } from './api';
import { usuariosDelExpediente } from './requisitos';
import type { ContextoRevisor, DialogoExpediente } from './reglas';

/** Lo que necesitan las piezas del expediente repartidas por los sectores de la ficha: quién revisa, nombres, motivos y el diálogo abierto. */
export interface ControlExpediente {
  expediente: ExpedienteDto;
  contexto: (area: AreaExpedienteDto | null) => ContextoRevisor;
  nombres: ReadonlyMap<string, string>;
  nombresMotivos: ReadonlyMap<string, string>;
  motivos: readonly MotivoTipificadoDto[];
  vinculoBloqueado: boolean;
  dialogo: DialogoExpediente | null;
  abrirDialogo: (dialogo: DialogoExpediente | null) => void;
}

/** Arma el {@link ControlExpediente} de un expediente ya cargado (antes vivía en la página del expediente). */
export function useControlExpediente(expediente: ExpedienteDto | undefined, vinculoBloqueado: boolean): ControlExpediente | null {
  const empresaId = expediente?.empresaId ?? '';
  const permisos = usePermisos(empresaId);
  const usuarioId = useSesion((s) => s.sesion?.usuarioId ?? null);
  const areas = useAreas(empresaId, Boolean(expediente) && permisos.puede(SCOPES.configuracionLeer));
  const motivos = useMotivos(empresaId, Boolean(expediente) && permisos.puede(SCOPES.configuracionLeer));
  const nombres = useNombresUsuarios(empresaId, useMemo(() => (expediente ? usuariosDelExpediente(expediente) : []), [expediente]));
  const [dialogo, setDialogo] = useState<DialogoExpediente | null>(null);

  const contexto = useCallback(
    (area: AreaExpedienteDto | null): ContextoRevisor => {
      const delArea = area ? areas.data?.find((a) => a.id === area.areaId) : undefined;
      return {
        scopes: permisos.scopes,
        usuarioId,
        esMiembro: delArea && usuarioId ? delArea.activa && delArea.miembros.includes(usuarioId) : null,
        vinculoBloqueado,
      };
    },
    [areas.data, permisos.scopes, usuarioId, vinculoBloqueado],
  );
  const nombresMotivos = useMemo(() => new Map((motivos.data ?? []).map((m) => [m.codigo, m.nombre])), [motivos.data]);

  if (!expediente) return null;
  return { expediente, contexto, nombres, nombresMotivos, motivos: motivos.data ?? [], vinculoBloqueado, dialogo, abrirDialogo: setDialogo };
}

