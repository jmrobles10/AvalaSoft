import { useSearchParams } from 'react-router';

/**
 * Los filtros de un informe viven en la URL (se comparte el enlace y la descarga lleva los mismos): `cambiar` fija o quita un parámetro (vacío
 * lo quita) y `limpiar` los quita todos. Ninguno apila entradas en el historial.
 */
export function useFiltrosEnUrl() {
  const [, setParametros] = useSearchParams();
  const cambiar = (clave: string, valor: string) =>
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
        return nuevos;
      },
      { replace: true },
    );
  const limpiar = () => setParametros(new URLSearchParams(), { replace: true });
  return { cambiar, limpiar };
}
