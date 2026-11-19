import type { EstadoFichaDto } from '@validalo/api-client';
import { SeccionPlana } from '@validalo/ui';
import { Layers, Receipt, Scale, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FormularioEspecialidades } from './especialidades/FormularioEspecialidades';
import { FormularioFinanciera } from './formularios/FormularioFinanciera';
import { FormularioGeneral } from './formularios/FormularioGeneral';
import { FormularioSst } from './formularios/FormularioSst';
import { FormularioTributaria } from './formularios/FormularioTributaria';
import { FormularioLegal } from './legal/FormularioLegal';
import type { CodigoSeccion } from './secciones';
import type { EditorSeccion } from './useEditorSeccion';

/** El formulario de cada sección sobre el mismo editor (datos en snake_case, mensajes del servidor por ruta). */
export function FormularioDeSeccion({ codigo, estado, editor, selectorPeriodo }: { codigo: CodigoSeccion; estado: EstadoFichaDto; editor: EditorSeccion; selectorPeriodo?: ReactNode }) {
  const { t } = useTranslation();
  const tarjeta = (clave: 'tributaria' | 'legal' | 'financiera' | 'especialidades', icono: typeof Receipt, contenido: ReactNode) => (
    <SeccionPlana titulo={t(`ficha.bloques.${clave}.titulo`)} ayuda={t(`ficha.bloques.${clave}.ayuda`)} etiqueta={t(`ficha.bloques.${clave}.titulo`)} icono={icono}>
      {contenido}
    </SeccionPlana>
  );
  const comun = { onCambiar: editor.cambiar, mensaje: editor.mensaje, hayEnRuta: editor.hayEnRuta, deshabilitado: editor.guardando };
  switch (codigo) {
    case 'FICHA_GENERAL':
      return <FormularioGeneral {...comun} datos={editor.datos} tipoPersona={estado.tipoPersona} perfil={estado.perfil} />;
    case 'FICHA_TRIBUTARIA':
      return tarjeta('tributaria', Receipt, <FormularioTributaria {...comun} datos={editor.datos} perfil={estado.perfil} />);
    case 'FICHA_LEGAL':
      return tarjeta('legal', Scale, <FormularioLegal {...comun} datos={editor.datos} perfil={estado.perfil} />);
    case 'FICHA_FINANCIERA':
      return tarjeta('financiera', TrendingUp, <FormularioFinanciera {...comun} datos={editor.datos} selectorPeriodo={selectorPeriodo} />);
    case 'FICHA_SST':
      return <FormularioSst {...comun} datos={editor.datos} />;
    case 'FICHA_ESPECIALIDADES':
      return tarjeta('especialidades', Layers, <FormularioEspecialidades {...comun} datos={editor.datos} />);
  }
}
