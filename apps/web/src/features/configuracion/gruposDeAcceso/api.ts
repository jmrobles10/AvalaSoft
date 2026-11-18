import { useQuery } from '@tanstack/react-query';
import { getListarGruposDeAccesoQueryOptions } from '@avalasoft/api-client';

/** Grupos de acceso del grupo empresarial, con los cuatro roles fijos como predefinidos (requiere `usuarios:administrar`). */
export function useGruposDeAcceso(habilitado = true) {
  return useQuery({ ...getListarGruposDeAccesoQueryOptions({ request: { empresa: null } }), enabled: habilitado });
}
