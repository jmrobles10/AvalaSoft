import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actualizarIngresoGrupo,
  corregirGrupo,
  corregirUsuarioDeGrupo,
  invitarUsuarioDeGrupo,
  listarAdministradoresDeGrupo,
  type ConfiguracionDeIngresoDto,
  type CorregirGrupoDto,
  type CorregirUsuarioDto,
} from '@validasoft/api-client';
import { invalidarRuta } from '../../shared/consultas';

/** La consola de Plataforma no tiene empresa activa ni tenant (PT-4). */
const SIN_EMPRESA = { empresa: null } as const;

const rutaDeAdministradores = (tenantId: string) => `/api/v1/plataforma/tenants/${tenantId}/administradores`;

/** Lo que cambia la ficha del grupo se ve también en la lista de grupos y en el detalle de cada uno. */
function invalidarGrupos(cliente: ReturnType<typeof useQueryClient>): Promise<unknown> {
  return Promise.all([invalidarRuta(cliente, '/api/v1/plataforma/grupos'), invalidarRuta(cliente, '/api/v1/plataforma/tenants')]);
}

/** Las personas con el rol Administrador del grupo (decisión FG): nombre, correo, id externo, estado, último ingreso y passkeys. */
export function useAdministradoresDeGrupo(tenantId: string) {
  return useQuery({ queryKey: [rutaDeAdministradores(tenantId)], queryFn: ({ signal }) => listarAdministradoresDeGrupo(tenantId, SIN_EMPRESA, signal) });
}

/** Corrige el nombre, la región y la zona horaria del grupo, siempre (PUT; repetirlo no hace daño). El identificador no se corrige. */
export function useCorregirGrupo(tenantId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CorregirGrupoDto) => corregirGrupo(tenantId, cuerpo, SIN_EMPRESA),
    onSuccess: () => invalidarGrupos(cliente),
  });
}

/** La misma política de ingreso que edita el administrador del grupo, desde la consola (`PUT …/ingreso`). */
export function useCambiarIngresoDelGrupo(tenantId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: ConfiguracionDeIngresoDto) => actualizarIngresoGrupo(tenantId, cuerpo, SIN_EMPRESA),
    onSuccess: () => invalidarGrupos(cliente),
  });
}

/**
 * Corrige a una persona del grupo: nombre, correo e identidades externas. Cambiar el correo cierra sus sesiones y revoca sus passkeys en el servidor, así
 * que también se vuelve a pedir la lista de administradores.
 */
export function useCorregirAdministrador(tenantId: string, usuarioId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CorregirUsuarioDto) => corregirUsuarioDeGrupo(tenantId, usuarioId, cuerpo, SIN_EMPRESA),
    onSuccess: () => invalidarRuta(cliente, rutaDeAdministradores(tenantId)),
  });
}

/** «Reenviar invitación»: el correo con la dirección de la app para entrar directo. */
export function useInvitarAdministrador(tenantId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => invitarUsuarioDeGrupo(tenantId, usuarioId, SIN_EMPRESA),
    onSuccess: () => invalidarRuta(cliente, rutaDeAdministradores(tenantId)),
  });
}
