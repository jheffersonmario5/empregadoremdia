import test from 'node:test';
import assert from 'node:assert/strict';

import {
  numeroBrasileiro,
  calcularCustoContratacao,
  calcularFerias,
  calcularDecimoTerceiro,
  diasAvisoPrevio,
  limiteDiasRescisao,
  calcularRescisao,
} from '../assets/calculadoras.js';

test('interpreta valores no formato brasileiro', () => {
  assert.equal(numeroBrasileiro('3.000,50'), 3000.5);
  assert.equal(numeroBrasileiro('3000.50'), 3000.5);
  assert.equal(numeroBrasileiro('3.000'), 3000);
  assert.equal(numeroBrasileiro(''), 0);
});

test('custo médio no Simples inclui FGTS, 13º e terço de férias sem duplicar o salário de férias', () => {
  const calculo = calcularCustoContratacao({ salario: 3000, regime: 'simples' });
  assert.equal(calculo.mesNormal, 3240);
  assert.equal(calculo.mediaMensal, 3600);
  assert.equal(calculo.anual, 43200);
});

test('custo doméstico usa os 20% patronais do DAE', () => {
  const calculo = calcularCustoContratacao({ salario: 3000, regime: 'domestico' });
  assert.ok(Math.abs(calculo.aliquota - 0.20) < Number.EPSILON);
  assert.equal(calculo.mesNormal, 3600);
  assert.equal(calculo.mediaMensal, 4000);
});

test('férias de 30 dias com abono separam recibo antecipado e salário dos dias trabalhados', () => {
  const calculo = calcularFerias({ salario: 3000, dias: 30, abono: true });
  assert.equal(calculo.diasGozo, 20);
  assert.equal(calculo.diasAbono, 10);
  assert.equal(calculo.pagamentoAntecipado, 4000);
  assert.equal(calculo.salarioDiasTrabalhados, 1000);
  assert.equal(calculo.custoPeriodo, 5000);
});

test('13º proporcional considera um doze avos por mês informado', () => {
  const calculo = calcularDecimoTerceiro({ salario: 3000, avos: 9 });
  assert.equal(calculo.total, 2250);
  assert.equal(calculo.primeira, 1125);
  assert.equal(calculo.segundaBruta, 1125);
});

test('aviso proporcional cresce três dias por ano e para em 90 dias', () => {
  assert.equal(diasAvisoPrevio('dispensa', 0), 30);
  assert.equal(diasAvisoPrevio('dispensa', 1), 33);
  assert.equal(diasAvisoPrevio('dispensa', 20), 90);
  assert.equal(diasAvisoPrevio('pedido', 20), 30);
});

test('rescisão reproduz o exemplo editorial de dispensa sem justa causa', () => {
  const calculo = calcularRescisao({
    salario: 3000,
    diasSaldo: 19,
    modalidade: 'dispensa',
    aviso: 'indenizado',
    anosCompletos: 2,
    avos13: 9,
    avosFerias: 8,
    feriasSimples: 1,
    saldoFgts: 8400,
  });

  assert.equal(calculo.diasAviso, 36);
  assert.equal(calculo.totalDireto, 14416.67);
  assert.equal(calculo.fgtsRescisorio, 620);
  assert.equal(calculo.multaFgts, 3608);
  assert.equal(calculo.custoEmpregador, 18644.67);
});

test('pedido de demissão sem aviso não gera pagamento direto negativo', () => {
  const calculo = calcularRescisao({
    salario: 3000,
    diasSaldo: 2,
    modalidade: 'pedido',
    aviso: 'descontado',
  });

  assert.equal(calculo.totalDiretoAntesDoLimite, -2800);
  assert.equal(calculo.ajustePagamentoNegativo, 2800);
  assert.equal(calculo.totalDireto, 0);
});

test('limite de dias remunerados acompanha a data da saída e aceita o dia 31', () => {
  assert.equal(limiteDiasRescisao('2026-08-20'), 20);
  assert.equal(limiteDiasRescisao('2026-08-31'), 31);
  assert.equal(limiteDiasRescisao('2026-02-28'), 28);
  assert.equal(limiteDiasRescisao(''), 31);
});
