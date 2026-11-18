import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarFuentesDePlataforma, getObtenerFuentesDePlataformaQueryOptions, type ActualizarFuentesDePlataformaDto } from '@avalasoft/api-client';
import { invalidarRuta } from '../../shared/consultas';

/** La consola de Plataforma no tiene empresa activa ni tenant (PT-4). */
const SIN_EMPRESA = { empresa: null } as const;

/** La cuenta de la plataforma con los proveedores de las fuentes oficiales (FO-5): una sola para todos los clientes. */
export function useFuentesDePlataforma() {
  return useQuery(getObtenerFuentesDePlataformaQueryOptions({ request: SIN_EMPRESA }));
}

/** Crea, cambia o quita (`clave: ''`) la cuenta de un proveedor y/o fija el predeterminado de una fuente; la clave solo se escribe y nunca vuelve. */
export function useActualizarFuentesDePlataforma() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dto: ActualizarFuentesDePlataformaDto) => actualizarFuentesDePlataforma(dto, SIN_EMPRESA),
    onSuccess: async () => {
      await invalidarRuta(cliente, '/api/v1/plataforma/fuentes-oficiales');
      await invalidarRuta(cliente, '/api/v1/plataforma/secretos');
    },
  });
}
