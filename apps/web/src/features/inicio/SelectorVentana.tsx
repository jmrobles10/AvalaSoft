import { Stack, ToggleButton } from '@mui/material';
import { sxPildora } from '@validalo/ui';
import { useTranslation } from 'react-i18next';
import { VENTANAS, type Ventana } from './modelo';

/**
 * Selector de la ventana de los indicadores (7, 30 o 90 días): tres píldoras como las pestañas de Informes (la elegida, blanca con sombra suave
 * sobre el lienzo; las demás, texto gris). Es un grupo de botones con `aria-pressed`, no pestañas: no cambia de pantalla.
 */
export function SelectorVentana({ valor, onCambiar }: { valor: Ventana; onCambiar: (ventana: Ventana) => void }) {
  const { t } = useTranslation();
  return (
    <Stack role="group" aria-label={t('inicio.indicadores.ventana')} direction="row" sx={{ gap: 0.5, flex: 'none' }}>
      {VENTANAS.map((v) => (
        <ToggleButton
          key={v}
          value={v}
          selected={v === valor}
          onChange={() => onCambiar(v)}
          sx={(th) => ({ ...sxPildora(th), border: 0, textTransform: 'none', fontSize: 14, lineHeight: '20px', color: th.palette.text.secondary })}
        >
          {t(`inicio.indicadores.ventanas.${v}`)}
        </ToggleButton>
      ))}
    </Stack>
  );
}
