import { Box, Button, Chip, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import type { ComparticionPublicaDto, DocumentoBovedaDto, VersionDocumentoDto } from '@validalo/api-client';
import { formatearFecha, visualmenteOculto } from '@validalo/ui';
import { Archive, Download, EllipsisVertical, FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { estadoDeVigencia, textoVigencia } from '../vigencia/vigencia';
import { ChipDeVersion } from './ChipDeVersion';
import { COLUMNAS_DOCUMENTO } from './columnas';
import { DialogoRetirar } from './DialogoRetirar';
import { useDescargar } from './useDescargar';
import {
  detalleComparticion,
  empresaConLaFechaMasProxima,
  enlaceSubirVersion,
  resumenCorto,
  sePuedeDescargar,
  sePuedeRetirar,
  sePuedeSubirVersion,
  venceEnCabecera,
} from './versiones';
import { VersionesDocumento } from './VersionesDocumento';

/**
 * Un documento de la bóveda como **una fila** de la lista, alineada en columnas como una tabla: el documento (con su versión, cuándo se
 * cargó y cuándo vence en una línea gris), su estado en un solo chip, las empresas como chips compactos («Norte · aprobada v1») con la
 * frase larga en el tooltip y las acciones («Subir versión» y el menú «…»). Solo cuando una empresa pide algo del tercero (corregir,
 * revalidar, subir) se explica en una línea breve bajo su chip. En el celular las columnas se apilan. El aviso de «por vencer» vive en el
 * bloque «Por renovar» de arriba: aquí solo está el chip.
 */
export function TarjetaDocumento({ documento }: { documento: DocumentoBovedaDto }) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [retirando, setRetirando] = useState<VersionDocumentoDto | null>(null);
  const [verVersiones, setVerVersiones] = useState(false);
  const descargar = useDescargar();
  const actual = documento.versionActual;
  const titulo = documento.tipo.nombre;
  const subible = sePuedeSubirVersion(documento);
  // Cada empresa cuenta la vigencia con su regla: si las fechas difieren, la cabecera dice la más próxima y por qué.
  const referencia = venceEnCabecera(documento);
  const masProxima = empresaConLaFechaMasProxima(documento);
  const vigencia = actual?.vigencia;
  const vence = !vigencia ? null : estadoDeVigencia(vigencia) === 'SinVencimiento' ? t('vigencia.estados.SinVencimiento') : textoVigencia(vigencia, t);

  return (
    <Box
      component="article"
      aria-labelledby={`doc-${documento.id}`}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', ...COLUMNAS_DOCUMENTO },
        gridTemplateAreas: { xs: '"doc doc" "est acc" "emp emp"', md: '"doc est emp acc"' },
        columnGap: 2,
        rowGap: 1,
        alignItems: 'center',
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack sx={{ gridArea: 'doc', minWidth: 0 }} direction="row" spacing={1.5}>
        <Box
          aria-hidden
          sx={(th) => ({ display: 'grid', placeItems: 'center', flex: 'none', width: 32, height: 32, borderRadius: '9px', bgcolor: th.palette.acento.tinte, color: th.palette.acento.main })}
        >
          <FileText size={17} strokeWidth={1.75} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={`doc-${documento.id}`} component="h2" sx={{ fontWeight: 500, fontSize: 14, lineHeight: '20px' }}>
            {titulo}
          </Typography>
          <Typography component="div" sx={{ color: 'text.secondary', fontSize: 13, lineHeight: '18px' }}>
            {actual ? t('boveda.cargadaEl', { n: String(actual.n), fecha: formatearFecha(actual.cargadaEn) }) : t('boveda.sinVigente')}
            {vence && ` · ${vence}`}
          </Typography>
          {/* En su propia línea: junto a la meta quedaba un «·» suelto al partirse la línea. */}
          {documento.versiones > 1 && (
            <Button variant="text" size="small" onClick={() => setVerVersiones((v) => !v)} aria-expanded={verVersiones} sx={{ display: 'block', minHeight: 20, p: 0, fontSize: 13, lineHeight: '18px' }}>
              {verVersiones ? t('boveda.ocultarVersiones') : t('boveda.versiones', { n: String(documento.versiones) })}
            </Button>
          )}
          {masProxima && <Typography sx={{ color: 'text.secondary', fontSize: 12, lineHeight: '16px', mt: 0.25 }}>{t('boveda.venceDistinto', { empresa: masProxima })}</Typography>}
        </Box>
      </Stack>

      <Box sx={{ gridArea: 'est', justifySelf: 'start' }}>{actual && <ChipDeVersion version={actual} />}</Box>

      {/* Las empresas: un chip por empresa; la frase completa va en su tooltip (y para lectores de pantalla). */}
      <Box component="ul" aria-label={t('boveda.empresas')} sx={{ gridArea: 'emp', display: 'flex', flexWrap: 'wrap', gap: 0.75, p: 0, m: 0, minWidth: 0, listStyle: 'none' }}>
        {documento.porEmpresa.length === 0 ? (
          <Typography component="li" sx={{ color: 'text.secondary', fontSize: 13, lineHeight: '18px', listStyle: 'none' }}>
            {t('boveda.sinEmpresas')}
          </Typography>
        ) : (
          documento.porEmpresa.map((c) => <EmpresaDelDocumento key={c.vinculoId} comparticion={c} referencia={referencia} />)
        )}
      </Box>

      <Stack direction="row" sx={{ gridArea: 'acc', alignItems: 'center', justifySelf: 'end' }}>
        {subible && (
          <Button component={RouterLink} to={enlaceSubirVersion(documento)} variant="text" size="small" startIcon={<Upload size={16} aria-hidden />}>
            {t('boveda.nuevaVersion')}
          </Button>
        )}
        {actual && (
          <IconButton aria-label={`${t('comun.version', { n: String(actual.n) })}: ${titulo}`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
            <EllipsisVertical size={20} strokeWidth={3} />
          </IconButton>
        )}
      </Stack>

      {actual && (
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {sePuedeDescargar(actual) && (
            <MenuItem
              onClick={() => {
                setMenu(null);
                descargar(documento.id, actual.n);
              }}
            >
              <ListItemIcon>
                <Download size={18} aria-hidden />
              </ListItemIcon>
              <ListItemText primary={t('boveda.descargar')} />
            </MenuItem>
          )}
          {sePuedeRetirar(actual) && (
            <MenuItem
              onClick={() => {
                setMenu(null);
                setRetirando(actual);
              }}
            >
              <ListItemIcon>
                <Archive size={18} aria-hidden />
              </ListItemIcon>
              <ListItemText primary={t('boveda.retirar')} />
            </MenuItem>
          )}
        </Menu>
      )}

      {verVersiones && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <VersionesDocumento documentoId={documento.id} onRetirar={setRetirando} />
        </Box>
      )}
      {retirando && (
        <DialogoRetirar
          documentoId={documento.id}
          tipo={titulo}
          version={retirando}
          enlaceSubir={subible ? enlaceSubirVersion(documento) : null}
          onCerrar={() => setRetirando(null)}
        />
      )}
    </Box>
  );
}

/**
 * Una empresa del documento: chip «Empresa · aprobada v1» (verde si ya aprobó, ámbar si falta algo —revisa, corregir, revalidar—, gris si no
 * la exige) con la frase completa en el tooltip. Si pide algo del tercero, una línea breve la explica debajo.
 */
function EmpresaDelDocumento({ comparticion: c, referencia }: { comparticion: ComparticionPublicaDto; referencia: string | null }) {
  const { t } = useTranslation();
  const { texto, tono, pideAccion } = resumenCorto(c, t);
  const largo = detalleComparticion(c, t, referencia);
  return (
    <Box component="li" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '100%', listStyle: 'none' }}>
      <Tooltip title={largo} placement="top-start" enterDelay={300}>
        <Chip
          size="small"
          aria-hidden
          label={
            <>
              <Box component="span" sx={{ fontWeight: 500 }}>
                {c.empresa.nombre}
              </Box>
              {` · ${texto}`}
            </>
          }
          sx={(th) => ({ maxWidth: '100%', bgcolor: th.palette.estado[tono].fondo, color: th.palette.estado[tono].texto, border: `1px solid ${th.palette.estado[tono].borde}`, '& .MuiChip-label': { px: 1.25 } })}
        />
      </Tooltip>
      {/* Para lectores de pantalla: el nombre de la empresa y la frase completa de lo que tiene. */}
      <Box component="span" sx={visualmenteOculto}>{`${c.empresa.nombre}: ${largo}`}</Box>
      {pideAccion && (
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12, lineHeight: '16px', mt: 0.25 }}>
          {largo}
        </Typography>
      )}
    </Box>
  );
}
