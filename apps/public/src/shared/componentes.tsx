import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { ErrorEnLinea, PanelFlotante, sxComoLista, VARIABLE_FONDO } from '@validalo/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { mensajeDeError } from './errores';

/**
 * Panel blanco flotante del contenido del tercero, con su relleno de siempre. Lo usa el Shell para casi todas las páginas y, en una sección de
 * Mi información, la propia página (el panel del formulario va aparte del de las secciones). Las capas fijas del contenido (el título, la barra
 * de acciones) toman el color del panel para tapar lo que pasa por debajo.
 */
export function PanelDelTercero({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <PanelFlotante
      sx={[
        {
          px: { xs: 1.5, sm: 3 },
          pt: { xs: 1.5, sm: 2.5 },
          pb: { xs: 2, sm: 3 },
          [VARIABLE_FONDO]: (th: Theme) => th.palette.superficie.panel,
        },
        ...sxComoLista(sx),
      ]}
    >
      {children}
    </PanelFlotante>
  );
}

/** Título de página del tercero (20/26 en móvil, 22/30 en escritorio) con su explicación y, a la derecha en escritorio, la acción principal. */
export function CabeceraPagina({ titulo, sub, accion }: { titulo: string; sub?: ReactNode; accion?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'space-between', mb: 2.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h2" component="h1">
          {titulo}
        </Typography>
        {sub && (
          <Typography sx={{ color: 'text.secondary', mt: 0.5, fontSize: { xs: 15, sm: 14 }, lineHeight: { xs: '22px', sm: '20px' } }}>
            {sub}
          </Typography>
        )}
      </Box>
      {accion && <Box sx={{ flex: 'none' }}>{accion}</Box>}
    </Stack>
  );
}

/** Esqueleto de tarjetas mientras carga (ver `esqueletos.tsx` de `@validalo/ui`). */
export { EsqueletoTarjetas } from '@validalo/ui';

export function ErrorRecuperable({ error, onReintentar }: { error: unknown; onReintentar: () => void }) {
  const { t } = useTranslation();
  return <ErrorEnLinea mensaje={mensajeDeError(error, t)} onReintentar={onReintentar} textoReintentar={t('comun.reintentar')} />;
}

/**
 * Fila ligera «Empresa · estado · detalle · acción» de una lista (TarjetaDocumentoBoveda, Mis empresas y las cuentas): sin caja ni divisor
 * propios —la lista que la contiene decide el marco—, en texto secundario y con el estado como chips pequeños. En móvil el detalle y la
 * acción van debajo; en escritorio, en la misma línea (empresa 200 px, estado, detalle, acción).
 */
export function FilaEmpresa({ nombre, estado, detalle, accion }: { nombre: string; estado?: ReactNode; detalle?: ReactNode; accion?: ReactNode }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: '200px max-content minmax(0, 1fr) auto' },
        alignItems: 'center',
        columnGap: { xs: 1, sm: 2 },
        rowGap: 0.25,
        py: 0.5,
        listStyle: 'none',
      }}
    >
      <Typography component="span" sx={{ fontWeight: 500, fontSize: 13, lineHeight: '18px', minWidth: 0 }}>
        {nombre}
      </Typography>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, justifySelf: { xs: 'end', sm: 'start' } }}>{estado}</Box>
      {detalle ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: '18px', gridColumn: { xs: '1 / -1', sm: 3 } }}>
          {detalle}
        </Typography>
      ) : (
        <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
      )}
      {accion && <Box sx={{ gridColumn: { xs: '1 / -1', sm: 4 } }}>{accion}</Box>}
    </Box>
  );
}

/** Logo de la empresa o su inicial en un cuadro de 36 px. */
export function LogoEmpresa({ nombre, logoUrl, tamano = 36 }: { nombre: string; logoUrl?: string | null; tamano?: number }) {
  if (logoUrl) return <Box component="img" src={logoUrl} alt="" sx={{ width: tamano, height: tamano, borderRadius: 1, objectFit: 'contain', flex: 'none' }} />;
  return (
    <Box
      aria-hidden
      sx={{
        width: tamano,
        height: tamano,
        borderRadius: 1,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'superficie.nivel2',
        color: 'text.secondary',
        fontWeight: 600,
        fontSize: 15,
      }}
    >
      {nombre.trim().charAt(0).toUpperCase()}
    </Box>
  );
}
