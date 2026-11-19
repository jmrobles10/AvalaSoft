import { Box, Button } from '@mui/material';
import { EstadoVacio } from '@validalo/ui';
import { Landmark, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCuentasBancarias, useVinculosPublicos } from '../shared/api';
import { CabeceraPagina, ErrorRecuperable, EsqueletoTarjetas } from '../shared/componentes';
import { CuentasPorEmpresa } from './CuentasPorEmpresa';
import { DialogoAgregarCuenta } from './DialogoAgregarCuenta';
import { TarjetaCuenta } from './TarjetaCuenta';

/**
 * Mis cuentas bancarias (CB-1, CB-2): las cuentas del tercero con las empresas a las que las designó, y la cuenta en la
 * que le paga cada empresa con la que tiene la invitación aceptada.
 */
export function PaginaCuentas() {
  const { t } = useTranslation();
  const cuentas = useCuentasBancarias();
  const vinculos = useVinculosPublicos();
  const [agregando, setAgregando] = useState(false);
  const agregar = (
    <Button variant="contained" onClick={() => setAgregando(true)} startIcon={<Plus size={18} aria-hidden />} sx={{ width: { xs: '100%', sm: 'auto' } }}>
      {t('cuentas.agregar')}
    </Button>
  );

  return (
    <>
      <CabeceraPagina titulo={t('cuentas.titulo')} sub={t('cuentas.sub')} accion={agregar} />
      {cuentas.isPending ? (
        <EsqueletoTarjetas />
      ) : cuentas.isError ? (
        <ErrorRecuperable error={cuentas.error} onReintentar={() => void cuentas.refetch()} />
      ) : (
        <>
          {cuentas.data.length === 0 ? (
            <EstadoVacio icono={Landmark} titulo={t('cuentas.vacio')} texto={t('cuentas.vacioTexto')} />
          ) : (
            // En pantalla ancha las cuentas van en dos columnas (una sola ocupa todo el ancho): el panel llega a 1440 y una lista de una columna quedaba vacía a la derecha.
            <Box
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
                columnGap: { lg: 5 },
                '& > article:only-child': { gridColumn: '1 / -1' },
              }}
            >
              {cuentas.data.map((c) => (
                <TarjetaCuenta key={c.id} cuenta={c} />
              ))}
            </Box>
          )}
          {vinculos.isPending ? (
            <Box sx={{ mt: 3 }}>
              <EsqueletoTarjetas cantidad={1} />
            </Box>
          ) : vinculos.isError ? (
            <Box sx={{ mt: 3 }}>
              <ErrorRecuperable error={vinculos.error} onReintentar={() => void vinculos.refetch()} />
            </Box>
          ) : (
            <CuentasPorEmpresa vinculos={vinculos.data} cuentas={cuentas.data} />
          )}
        </>
      )}
      {agregando && <DialogoAgregarCuenta onCerrar={() => setAgregando(false)} />}
    </>
  );
}
