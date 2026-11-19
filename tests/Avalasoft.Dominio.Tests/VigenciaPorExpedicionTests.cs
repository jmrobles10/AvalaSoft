using Avalasoft.Dominio.Documentos;

namespace Avalasoft.Dominio.Tests;

/// <summary>
/// Vigencia de un documento que declara su fecha de expedición (TD-6): una regla de 30 días desde la expedición, aviso a los 10 días y 5 de gracia
/// (el certificado propio de Sur). El mismo día, según cuándo se expidió, el documento queda vigente, por vencer, en gracia o vencido.
/// </summary>
public class VigenciaPorExpedicionTests
{
    private static readonly DateTimeOffset Ahora = new(2026, 11, 12, 9, 0, 0, TimeSpan.FromHours(-5));
    private static readonly DateOnly Hoy = new(2026, 11, 12);
    private const int DiasDeVigencia = 30;
    private const int DiasDeAviso = 10;
    private const int DiasDeGracia = 5;

    [Theory]
    [InlineData(3, 27, EstadoVigencia.Vigente, 32)]
    [InlineData(25, 5, EstadoVigencia.PorVencer, 10)]
    [InlineData(32, -2, EstadoVigencia.EnGracia, 3)]
    [InlineData(40, -10, EstadoVigencia.Vencida, -5)]
    public void Expedido_hace_3_25_32_o_40_dias_queda_vigente_por_vencer_en_gracia_o_vencido_con_su_fecha_de_vencimiento_y_el_fin_de_su_gracia(
        int diasDesdeExpedicion, int diasParaVencer, EstadoVigencia estado, int diasParaElFinDeLaGracia)
    {
        var expedicion = new DatoDeclarado(EsquemaDeFormulario.FechaExpedicion, "Fecha de expedición", TipoCampo.Fecha,
            Hoy.AddDays(-diasDesdeExpedicion).ToString("yyyy-MM-dd"));

        var calculo = CalculadoraDeVigencia.Calcular(ReglaFrescura.DiasDesdeExpedicion(DiasDeVigencia), Ahora, [expedicion]);

        calculo.ShouldBe(new CalculoDeVigencia(Hoy.AddDays(diasParaVencer), BaseVigencia.FechaExpedicion));
        CalculadoraDeVigencia.FinDeGracia(calculo.VigenteHasta, DiasDeGracia).ShouldBe(Hoy.AddDays(diasParaElFinDeLaGracia));
        CalculadoraDeVigencia.Estado(calculo.VigenteHasta, [DiasDeAviso], DiasDeGracia, Hoy).ShouldBe(estado);
    }
}
