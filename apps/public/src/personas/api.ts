import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmarRelacionDelTercero,
  declararRelacionDelTercero,
  descartarRelacionDelTercero,
  getListarRelacionesDelTerceroQueryKey,
  getListarRelacionesDelTerceroQueryOptions,
  getObtenerBovedaQueryKey,
  terminarRelacionDelTercero,
  type DeclararRelacionDto,
} from '@validasoft/api-client';

/** Las personas relacionadas del tercero (vigentes y propuestas de la IA). Se pide solo con acceso completo: una sesión aislada no alcanza este grupo. */
export const useRelaciones = (habilitada = true) => useQuery({ ...getListarRelacionesDelTerceroQueryOptions(), enabled: habilitada });

/** Cambiar una relación cambia lo que piden los expedientes y lo que ve la bóveda: se vuelve a pedir lo que depende de ella. */
function useAlCambiarRelaciones() {
  const cliente = useQueryClient();
  return () => Promise.all([cliente.invalidateQueries({ queryKey: getListarRelacionesDelTerceroQueryKey() }), cliente.invalidateQueries({ queryKey: getObtenerBovedaQueryKey() })]);
}

export function useDeclararRelacion() {
  const alCambiar = useAlCambiarRelaciones();
  return useMutation({ mutationFn: (cuerpo: DeclararRelacionDto) => declararRelacionDelTercero(cuerpo), onSuccess: alCambiar });
}

export function useConfirmarRelacion() {
  const alCambiar = useAlCambiarRelaciones();
  return useMutation({ mutationFn: (id: string) => confirmarRelacionDelTercero(id), onSuccess: alCambiar });
}

export function useDescartarRelacion() {
  const alCambiar = useAlCambiarRelaciones();
  return useMutation({ mutationFn: (id: string) => descartarRelacionDelTercero(id), onSuccess: alCambiar });
}

export function useTerminarRelacion() {
  const alCambiar = useAlCambiarRelaciones();
  return useMutation({ mutationFn: (id: string) => terminarRelacionDelTercero(id), onSuccess: alCambiar });
}
