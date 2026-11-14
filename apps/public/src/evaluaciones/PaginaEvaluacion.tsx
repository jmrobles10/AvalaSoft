import { Alert, AlertTitle, Button, Card } from '@mui/material';
import { esErrorApi } from '@validasoft/api-client';
import { formatearFecha, PaginaEstado } from '@validasoft/ui';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router';
import { CabeceraPagina, ErrorRecuperable, EsqueletoTarjetas } from '../shared/componentes';
import { MarcaDeEmpresa } from '../shared/MarcaDeEmpresa';
import { useVinculosPublicos } from '../shared/api';
import { useEvaluacionDelTercero } from './api';
import { FormularioDeEvaluacion } from './FormularioDeEvaluacion';

/**
 * La autoevaluación que una empresa le pide al tercero (CE-4): si está pendiente, el cuestionario; si ya la envió, solo la confirmación. El tercero no ve nunca el puntaje, el
 * veredicto ni lo que pesa cada pregunta: eso es de la empresa (CE-9).
 */
export function PaginaEvaluacion() {
  const { t } = useTranslation();
  const { vinculoId = '', id = '' } = useParams();
  const consulta = useEvaluacionDelTercero(vinculoId, id);
  const vinculos = useVinculosPublicos();

  if (consulta.isPending) return <EsqueletoTarjetas />;
  if (consulta.isError) {
    if (esErrorApi(consulta.error) && consulta.error.esNoEncontrado) {
      return (
        <PaginaEstado
          icono={SearchX}
          titulo={t('evaluaciones.pagina.noEncontrada')}
          texto={t('evaluaciones.pagina.noEncontradaTexto')}
          acciones={
            <Button component={RouterLink} to="/empresas" variant="contained">
              {t('evaluaciones.pagina.volver')}
            </Button>
          }
        />
      );
    }
    return <ErrorRecuperable error={consulta.error} onReintentar={() => void consulta.refetch()} />;
  }

  const evaluacion = consulta.data;
  const vinculo = vinculos.data?.find((v) => v.id === vinculoId);
  const empresa = vinculo?.empresa.nombre ?? '';
  const pendiente = evaluacion.estado === 'Pendiente';
  const contenido = (
    <>
      <CabeceraPagina
        titulo={evaluacion.cuestionario}
        sub={empresa ? t('evaluaciones.pagina.sub', { empresa }) : undefined}
        accion={
          vinculo?.expedienteId && !pendiente ? (
            <Button component={RouterLink} to={`/expediente/${vinculo.expedienteId}`} variant="outlined">
              {t('evaluaciones.pagina.volverARevision')}
            </Button>
          ) : undefined
        }
      />
      {pendiente ? (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('evaluaciones.pagina.ayuda', { empresa: empresa || t('evaluaciones.pagina.laEmpresa') })}
          </Alert>
          <FormularioDeEvaluacion evaluacion={evaluacion} vinculoId={vinculoId} empresa={empresa || t('evaluaciones.pagina.laEmpresa')} />
        </>
      ) : (
        <Card sx={{ p: 2 }}>
          <Alert severity="success">
            <AlertTitle>{t('evaluaciones.enviada.titulo')}</AlertTitle>
            {t('evaluaciones.enviada.texto', { empresa: empresa || t('evaluaciones.pagina.laEmpresa'), fecha: evaluacion.respondidaEn ? formatearFecha(evaluacion.respondidaEn) : '—' })}
          </Alert>
        </Card>
      )}
    </>
  );
  return vinculo ? <MarcaDeEmpresa empresa={vinculo.empresa}>{contenido}</MarcaDeEmpresa> : contenido;
}
