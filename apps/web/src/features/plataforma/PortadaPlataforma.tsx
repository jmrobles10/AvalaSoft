import { PaginaGrupos } from './PaginaGrupos';
import { TableroPlataforma } from './TableroPlataforma';

/** La portada de la consola (`/plataforma/grupos`): el tablero —saludo, cifras y lo que necesita atención— y, debajo, la lista de grupos. */
export function PortadaPlataforma() {
  return (
    <>
      <TableroPlataforma />
      <PaginaGrupos />
    </>
  );
}
