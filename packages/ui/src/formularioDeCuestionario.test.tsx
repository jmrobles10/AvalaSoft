import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  estaRespondida,
  FormularioDeCuestionario,
  leerNumero,
  preguntasQueFaltan,
  respuestasParaEnviar,
  type BorradorDeRespuestas,
  type SeccionDeFormulario,
  type TextosDelFormulario,
  type VisibilidadDeFormulario,
} from './formularioDeCuestionario';
import { createAvalasoftTheme } from './tema';

const TEXTOS: TextosDelFormulario = {
  comentario: 'Comentario',
  subirArchivo: 'Subir archivo',
  quitarArchivo: (nombre) => `Quitar ${nombre}`,
  subiendo: 'Subiendo…',
  numero: 'Número',
  obligatoria: 'Obligatoria',
};

const SECCIONES: SeccionDeFormulario[] = [
  {
    codigo: 'S1',
    nombre: 'Legal',
    descripcion: 'Datos legales',
    preguntas: [
      {
        codigo: 'P1',
        texto: '¿Cuenta con SG-SST?',
        tipo: 'SiNo',
        obligatoria: true,
        permiteComentario: true,
        opciones: [
          { codigo: 'si', texto: 'Sí' },
          { codigo: 'no', texto: 'No' },
        ],
      },
      { codigo: 'P2', texto: '¿Por qué no?', tipo: 'Texto', obligatoria: true, permiteComentario: false },
      {
        codigo: 'P3',
        texto: 'Certificaciones',
        tipo: 'OpcionMultiple',
        obligatoria: false,
        permiteComentario: false,
        opciones: [
          { codigo: 'iso9001', texto: 'ISO 9001' },
          { codigo: 'iso14001', texto: 'ISO 14001' },
        ],
      },
    ],
  },
  {
    codigo: 'S2',
    nombre: 'Operación',
    preguntas: [
      { codigo: 'P4', texto: 'Calidad', tipo: 'Escala', obligatoria: true, permiteComentario: false, escala: { minimo: 1, maximo: 5 } },
      { codigo: 'P5', texto: 'Años de experiencia', tipo: 'Numero', obligatoria: false, permiteComentario: false },
      { codigo: 'P6', texto: 'Evidencia', tipo: 'Adjunto', obligatoria: false, permiteComentario: false },
    ],
  },
];

const TODAS: VisibilidadDeFormulario = { preguntas: new Set(['P1', 'P3', 'P4', 'P5', 'P6']), secciones: new Set(['S1', 'S2']) };

function Prueba({ inicial = {}, visibilidad = TODAS, subir }: { inicial?: BorradorDeRespuestas; visibilidad?: VisibilidadDeFormulario | null; subir?: (p: string, a: File) => void }) {
  const [respuestas, setRespuestas] = useState<BorradorDeRespuestas>(inicial);
  return (
    <ThemeProvider theme={createAvalasoftTheme('light', { app: 'web' })}>
      <FormularioDeCuestionario
        secciones={SECCIONES}
        respuestas={respuestas}
        onCambiar={setRespuestas}
        visibilidad={visibilidad}
        textos={TEXTOS}
        adjuntos={[{ id: 'a1', nombre: 'certificado.pdf' }]}
        onSubirAdjunto={subir}
        errores={{ P1: 'Responde esta pregunta.' }}
      />
      <output data-testid="estado">{JSON.stringify(respuestasParaEnviar(respuestas, visibilidad))}</output>
    </ThemeProvider>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent) as unknown[];

describe('FormularioDeCuestionario', () => {
  it('muestra solo las secciones y preguntas visibles, con la obligatoria marcada y el error de la pregunta', () => {
    render(<Prueba visibilidad={{ preguntas: new Set(['P1', 'P3']), secciones: new Set(['S1']) }} />);

    expect(screen.getByRole('heading', { name: 'Legal' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Operación' })).not.toBeInTheDocument();
    expect(screen.getByText('¿Cuenta con SG-SST?')).toBeInTheDocument();
    expect(screen.queryByText('¿Por qué no?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Obligatoria')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Responde esta pregunta.');
  });

  it('sin visibilidad (aún no se pidió) muestra todo', () => {
    render(<Prueba visibilidad={null} />);

    expect(screen.getByText('¿Por qué no?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operación' })).toBeInTheDocument();
  });

  it('cada tipo guarda su respuesta: sí/no, múltiple, escala, número, texto y comentario', async () => {
    const usuario = userEvent.setup();
    render(<Prueba visibilidad={null} />);

    await usuario.click(screen.getByRole('radio', { name: 'No' }));
    await usuario.type(screen.getByRole('textbox', { name: /por qué no/i }), 'Aún no.');
    await usuario.click(screen.getByRole('checkbox', { name: 'ISO 9001' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'ISO 14001' }));
    await usuario.click(screen.getByRole('button', { name: '4' }));
    await usuario.type(screen.getByRole('textbox', { name: /años de experiencia/i }), '12,5');
    await usuario.type(screen.getByLabelText('Comentario'), ' Con soporte ');

    expect(estado()).toEqual([
      { pregunta: 'P1', opciones: ['no'], comentario: 'Con soporte' },
      { pregunta: 'P2', texto: 'Aún no.' },
      { pregunta: 'P3', opciones: ['iso9001', 'iso14001'] },
      { pregunta: 'P4', numero: 4 },
      { pregunta: 'P5', numero: 12.5 },
    ]);

    // Desmarcar una opción múltiple la quita y la escala se puede limpiar.
    await usuario.click(screen.getByRole('checkbox', { name: 'ISO 9001' }));
    await usuario.click(screen.getByRole('button', { name: '4' }));
    expect(estado()).toContainEqual({ pregunta: 'P3', opciones: ['iso14001'] });
    expect(estado()).not.toContainEqual(expect.objectContaining({ pregunta: 'P4' }));
  });

  it('el campo numérico solo admite dígitos, signo y coma o punto', async () => {
    const usuario = userEvent.setup();
    render(<Prueba visibilidad={null} />);
    const campo = screen.getByRole('textbox', { name: /años de experiencia/i });

    await usuario.type(campo, 'a1b-2,5c');

    expect(campo).toHaveValue('12,5');
  });

  it('un archivo de evidencia se sube con la función del llamador y los ya subidos se ven con su nombre y se pueden quitar', async () => {
    const usuario = userEvent.setup();
    const subir = vi.fn();
    render(<Prueba visibilidad={null} subir={subir} inicial={{ P6: { adjuntos: ['a1'] } }} />);

    expect(screen.getByText('certificado.pdf')).toBeInTheDocument();
    const archivo = new File(['x'], 'nuevo.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('archivo-P6'), { target: { files: [archivo] } });
    expect(subir).toHaveBeenCalledWith('P6', archivo);

    await usuario.click(screen.getByLabelText('Quitar certificado.pdf'));
    expect(screen.queryByText('certificado.pdf')).not.toBeInTheDocument();
    expect(estado()).toEqual([]);
  });

  it('solo lectura deshabilita los campos y no ofrece subir', () => {
    render(
      <ThemeProvider theme={createAvalasoftTheme('light', { app: 'web' })}>
        <FormularioDeCuestionario secciones={SECCIONES} respuestas={{ P1: { opciones: ['si'] } }} onCambiar={() => undefined} visibilidad={null} textos={TEXTOS} soloLectura onSubirAdjunto={() => undefined} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('radio', { name: 'Sí' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Subir archivo' })).not.toBeInTheDocument();
  });
});

describe('respuestas del formulario', () => {
  it('leerNumero entiende coma y punto y descarta lo incompleto', () => {
    expect(leerNumero('12,5')).toBe(12.5);
    expect(leerNumero('-3')).toBe(-3);
    expect(leerNumero('0')).toBe(0);
    expect(leerNumero('')).toBeNull();
    expect(leerNumero('-')).toBeNull();
    expect(leerNumero('.')).toBeNull();
    expect(leerNumero(undefined)).toBeNull();
  });

  it('un comentario suelto no es una respuesta y lo oculto no se envía', () => {
    expect(estaRespondida({ comentario: 'x' })).toBe(false);
    expect(estaRespondida({ numero: '0' })).toBe(true);
    const respuestas: BorradorDeRespuestas = { P1: { opciones: ['si'] }, P2: { texto: 'oculta' }, P3: { comentario: 'solo comentario' } };
    expect(respuestasParaEnviar(respuestas, { preguntas: new Set(['P1', 'P3']), secciones: new Set(['S1']) })).toEqual([{ pregunta: 'P1', opciones: ['si'] }]);
  });

  it('preguntasQueFaltan lista las obligatorias visibles sin responder', () => {
    expect(preguntasQueFaltan(SECCIONES, {}, TODAS)).toEqual(['P1', 'P4']);
    expect(preguntasQueFaltan(SECCIONES, { P1: { opciones: ['si'] }, P4: { numero: '3' } }, TODAS)).toEqual([]);
    expect(preguntasQueFaltan(SECCIONES, {}, null)).toEqual(['P1', 'P2', 'P4']);
    expect(preguntasQueFaltan(SECCIONES, {}, { preguntas: new Set(['P1']), secciones: new Set(['S1']) })).toEqual(['P1']);
  });
});
