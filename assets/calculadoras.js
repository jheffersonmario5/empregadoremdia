/**
 * Calculadoras do Empregador em Dia.
 *
 * As funções de cálculo são exportadas para poderem ser verificadas sem DOM.
 * A camada de interface só é iniciada quando o arquivo roda no navegador.
 */

const CENTAVOS = 100;

export function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * CENTAVOS) / CENTAVOS;
}

export function numeroBrasileiro(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  const texto = String(valor == null ? '' : valor)
    .trim()
    .replace(/R\$/gi, '')
    .replace(/\s/g, '');
  if (!texto) return 0;

  let normalizado = texto;
  if (texto.includes(',')) {
    normalizado = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    normalizado = texto.replace(/\./g, '');
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

export function calcularCustoContratacao({
  salario,
  beneficios = 0,
  regime = 'simples',
  rat = 0.01,
  terceiros = 0.058,
  provisaoRescisao = false,
}) {
  salario = Number(salario);
  beneficios = Number(beneficios);
  rat = Number(rat);
  terceiros = Number(terceiros);

  const componentes = [];
  const adicionar = (rotulo, taxa) => {
    componentes.push({ rotulo, taxa });
    return taxa;
  };

  let aliquota = 0;
  if (regime === 'domestico') {
    aliquota += adicionar('INSS patronal', 0.08);
    aliquota += adicionar('GILRAT', 0.008);
    aliquota += adicionar('FGTS mensal', 0.08);
    aliquota += adicionar('FGTS compensatório', 0.032);
  } else {
    if (regime === 'simples4' || regime === 'normal') {
      aliquota += adicionar('INSS patronal', 0.20);
      aliquota += adicionar('RAT informado', rat);
    }
    if (regime === 'normal' && terceiros > 0) {
      aliquota += adicionar('Terceiros / Sistema S', terceiros);
    }
    aliquota += adicionar('FGTS mensal', 0.08);
    if (provisaoRescisao) aliquota += adicionar('Reserva estimada da multa do FGTS', 0.032);
  }

  const encargosMes = salario * aliquota;
  const provisao13 = salario / 12;
  const provisaoTercoFerias = salario / 36;
  const encargosProvisoes = (provisao13 + provisaoTercoFerias) * aliquota;
  const mesNormal = salario + beneficios + encargosMes;
  const mediaMensal = mesNormal + provisao13 + provisaoTercoFerias + encargosProvisoes;
  const anual = mediaMensal * 12;

  return {
    salario: arredondar(salario),
    beneficios: arredondar(beneficios),
    aliquota,
    componentes,
    encargosMes: arredondar(encargosMes),
    provisao13: arredondar(provisao13),
    provisaoTercoFerias: arredondar(provisaoTercoFerias),
    encargosProvisoes: arredondar(encargosProvisoes),
    mesNormal: arredondar(mesNormal),
    mediaMensal: arredondar(mediaMensal),
    anual: arredondar(anual),
  };
}

export function calcularFerias({
  salario,
  medias = 0,
  dias = 30,
  abono = false,
  adiantamento13 = false,
}) {
  const base = Number(salario) + Number(medias);
  const diasDireito = Number(dias);
  const diasAbono = abono ? diasDireito / 3 : 0;
  const diasGozo = diasDireito - diasAbono;
  const feriasGozo = base / 30 * diasGozo;
  const tercoGozo = feriasGozo / 3;
  const valorAbono = base / 30 * diasAbono;
  const tercoAbono = valorAbono / 3;
  const primeiraParcela13 = adiantamento13 ? base / 2 : 0;
  const pagamentoAntecipado = feriasGozo + tercoGozo + valorAbono + tercoAbono + primeiraParcela13;
  const salarioDiasTrabalhados = abono ? base / 30 * diasAbono : 0;

  return {
    base: arredondar(base),
    diasDireito,
    diasGozo,
    diasAbono,
    feriasGozo: arredondar(feriasGozo),
    tercoGozo: arredondar(tercoGozo),
    valorAbono: arredondar(valorAbono),
    tercoAbono: arredondar(tercoAbono),
    primeiraParcela13: arredondar(primeiraParcela13),
    pagamentoAntecipado: arredondar(pagamentoAntecipado),
    salarioDiasTrabalhados: arredondar(salarioDiasTrabalhados),
    custoPeriodo: arredondar(pagamentoAntecipado + salarioDiasTrabalhados),
  };
}

export function calcularDecimoTerceiro({ salario, medias = 0, avos = 12 }) {
  const base = Number(salario) + Number(medias);
  const meses = Number(avos);
  const total = base * meses / 12;
  const primeira = total / 2;
  const segundaBruta = total - primeira;
  return {
    base: arredondar(base),
    avos: meses,
    total: arredondar(total),
    primeira: arredondar(primeira),
    segundaBruta: arredondar(segundaBruta),
  };
}

export function diasAvisoPrevio(modalidade, anosCompletos) {
  if (modalidade === 'pedido') return 30;
  if (modalidade !== 'dispensa' && modalidade !== 'acordo') return 0;
  return Math.min(90, 30 + Math.max(0, Number(anosCompletos) || 0) * 3);
}

export function calcularRescisao({
  salario,
  medias = 0,
  diasSaldo = 0,
  modalidade = 'dispensa',
  aviso = 'indenizado',
  anosCompletos = 0,
  avos13 = 0,
  avosFerias = 0,
  feriasSimples = 0,
  feriasDobro = 0,
  saldoFgts = 0,
}) {
  const base = Number(salario) + Number(medias);
  const diasAviso = diasAvisoPrevio(modalidade, anosCompletos);
  const saldoSalario = base / 30 * Number(diasSaldo);

  let avisoPrevio = 0;
  if (aviso === 'indenizado' && (modalidade === 'dispensa' || modalidade === 'acordo')) {
    avisoPrevio = base / 30 * diasAviso * (modalidade === 'acordo' ? 0.5 : 1);
  } else if (aviso === 'descontado' && modalidade === 'pedido') {
    avisoPrevio = -base;
  }

  const decimo = base * Number(avos13) / 12;
  const feriasProporcionaisBase = base * Number(avosFerias) / 12;
  const feriasProporcionaisTerco = feriasProporcionaisBase / 3;
  const feriasSimplesBase = base * Number(feriasSimples);
  const feriasSimplesTerco = feriasSimplesBase / 3;
  const feriasDobroBase = base * Number(feriasDobro) * 2;
  const feriasDobroTerco = feriasDobroBase / 3;

  const totalDiretoAntesDoLimite = saldoSalario + avisoPrevio + decimo
    + feriasProporcionaisBase + feriasProporcionaisTerco
    + feriasSimplesBase + feriasSimplesTerco
    + feriasDobroBase + feriasDobroTerco;
  const ajustePagamentoNegativo = Math.max(0, -totalDiretoAntesDoLimite);
  const totalDireto = Math.max(0, totalDiretoAntesDoLimite);

  const baseFgtsRescisorio = saldoSalario + decimo + Math.max(0, avisoPrevio);
  const fgtsRescisorio = baseFgtsRescisorio * 0.08;
  const percentualMulta = modalidade === 'dispensa' ? 0.40 : (modalidade === 'acordo' ? 0.20 : 0);
  const multaFgts = (Number(saldoFgts) + fgtsRescisorio) * percentualMulta;
  const totalFgts = fgtsRescisorio + multaFgts;
  const custoEmpregador = totalDireto + totalFgts;

  return {
    base: arredondar(base),
    diasAviso,
    saldoSalario: arredondar(saldoSalario),
    avisoPrevio: arredondar(avisoPrevio),
    decimo: arredondar(decimo),
    feriasProporcionaisBase: arredondar(feriasProporcionaisBase),
    feriasProporcionaisTerco: arredondar(feriasProporcionaisTerco),
    feriasSimplesBase: arredondar(feriasSimplesBase),
    feriasSimplesTerco: arredondar(feriasSimplesTerco),
    feriasDobroBase: arredondar(feriasDobroBase),
    feriasDobroTerco: arredondar(feriasDobroTerco),
    totalDiretoAntesDoLimite: arredondar(totalDiretoAntesDoLimite),
    ajustePagamentoNegativo: arredondar(ajustePagamentoNegativo),
    totalDireto: arredondar(totalDireto),
    baseFgtsRescisorio: arredondar(baseFgtsRescisorio),
    fgtsRescisorio: arredondar(fgtsRescisorio),
    percentualMulta,
    multaFgts: arredondar(multaFgts),
    totalFgts: arredondar(totalFgts),
    custoEmpregador: arredondar(custoEmpregador),
  };
}

function dataIso(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) return null;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return Number.isNaN(data.getTime()) ? null : data;
}

function paraIso(data) {
  return data ? data.toISOString().slice(0, 10) : '';
}

function adicionarDias(data, dias) {
  const copia = new Date(data.getTime());
  copia.setUTCDate(copia.getUTCDate() + Number(dias));
  return copia;
}

function adicionarMeses(data, meses) {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + Number(meses);
  const dia = data.getUTCDate();
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo)));
}

function diferencaDias(inicio, fim) {
  return Math.floor((fim.getTime() - inicio.getTime()) / 86400000);
}

function anosCompletos(inicio, fim) {
  let anos = fim.getUTCFullYear() - inicio.getUTCFullYear();
  const aniversario = new Date(Date.UTC(
    fim.getUTCFullYear(),
    inicio.getUTCMonth(),
    Math.min(inicio.getUTCDate(), new Date(Date.UTC(fim.getUTCFullYear(), inicio.getUTCMonth() + 1, 0)).getUTCDate())
  ));
  if (fim < aniversario) anos--;
  return Math.max(0, anos);
}

function contarAvos13(inicio, fim, anoReferencia) {
  let avos = 0;
  for (let mes = 0; mes < 12; mes++) {
    const inicioMes = new Date(Date.UTC(anoReferencia, mes, 1));
    const fimMes = new Date(Date.UTC(anoReferencia, mes + 1, 0));
    const de = inicio > inicioMes ? inicio : inicioMes;
    const ate = fim < fimMes ? fim : fimMes;
    if (ate >= de && diferencaDias(de, ate) + 1 >= 15) avos++;
  }
  return Math.min(12, avos);
}

function inicioPeriodoAquisitivo(admissao, fim) {
  const ano = fim.getUTCFullYear();
  const ultimo = new Date(Date.UTC(ano, admissao.getUTCMonth() + 1, 0)).getUTCDate();
  let inicio = new Date(Date.UTC(ano, admissao.getUTCMonth(), Math.min(admissao.getUTCDate(), ultimo)));
  if (inicio > fim) {
    const anoAnterior = ano - 1;
    const ultimoAnterior = new Date(Date.UTC(anoAnterior, admissao.getUTCMonth() + 1, 0)).getUTCDate();
    inicio = new Date(Date.UTC(anoAnterior, admissao.getUTCMonth(), Math.min(admissao.getUTCDate(), ultimoAnterior)));
  }
  return inicio;
}

function contarAvosFerias(admissao, fim) {
  let cursor = inicioPeriodoAquisitivo(admissao, fim);
  let avos = 0;
  while (avos < 12) {
    const proximo = adicionarMeses(cursor, 1);
    if (proximo > fim) break;
    avos++;
    cursor = proximo;
  }
  if (avos < 12 && diferencaDias(cursor, fim) + 1 >= 15) avos++;
  return Math.min(12, avos);
}

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroMoeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });

function moeda(valor) {
  return dinheiro.format(Number(valor) || 0).replace(/\u00a0/g, ' ');
}

function percentual(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor);
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[caractere]));
}

function rotuloCampo(form, campo) {
  const label = form.querySelector(`label[for="${campo.id}"]`);
  return label ? label.childNodes[0].textContent.trim() : campo.name;
}

function mensagemCampo(campo) {
  const valor = String(campo.value || '').trim();
  if (campo.required && !valor) return 'Preencha este campo.';
  if (campo.matches('[data-numero]')) {
    const numero = numeroBrasileiro(valor);
    if (valor && !Number.isFinite(numero)) return 'Informe um valor válido, como 1.621,00.';
    if (campo.required && numero <= 0) return 'Informe um valor maior que zero.';
    if (!campo.required && Number.isFinite(numero) && numero < 0) return 'O valor não pode ser negativo.';
  }
  if (campo.type === 'number' && valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return 'Informe um número válido.';
    if (campo.min !== '' && numero < Number(campo.min)) return `O mínimo é ${campo.min}.`;
    if (campo.max !== '' && numero > Number(campo.max)) return `O máximo é ${campo.max}.`;
  }
  return '';
}

function marcarCampo(form, campo, mensagem) {
  const erro = form.querySelector(`[data-erro-campo="${campo.name}"]`);
  campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  if (erro) {
    erro.textContent = mensagem;
    erro.hidden = !mensagem;
  }
  return !mensagem;
}

function validarFormulario(form) {
  if (form.dataset.calculadoraForm === 'rescisao') atualizarLimiteDiasRescisao(form);
  const campos = Array.from(form.querySelectorAll('input:not([type="checkbox"]), select'))
    .filter((campo) => !campo.disabled && !campo.closest('[hidden]'));
  const erros = [];

  campos.forEach((campo) => {
    const mensagem = mensagemCampo(campo);
    if (!marcarCampo(form, campo, mensagem)) erros.push({ campo, mensagem });
  });

  if (form.dataset.calculadoraForm === 'rescisao') {
    const admissao = dataIso(form.elements.admissao.value);
    const saida = dataIso(form.elements.dataSaida.value);
    if (admissao && saida && admissao > saida) {
      const campo = form.elements.dataSaida;
      const mensagem = 'A data do desligamento deve ser posterior à admissão.';
      marcarCampo(form, campo, mensagem);
      const existente = erros.find((erro) => erro.campo === campo);
      if (existente) existente.mensagem = mensagem;
      else erros.push({ campo, mensagem });
    }
  }

  const resumo = form.querySelector('[data-calculadora-erros]');
  if (erros.length) {
    const lista = resumo.querySelector('ul');
    lista.textContent = '';
    erros.forEach(({ campo, mensagem }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${campo.id}`;
      link.textContent = `${rotuloCampo(form, campo)}: ${mensagem}`;
      link.addEventListener('click', (evento) => {
        evento.preventDefault();
        campo.focus();
      });
      item.appendChild(link);
      lista.appendChild(item);
    });
    resumo.hidden = false;
    resumo.focus();
    return false;
  }

  resumo.hidden = true;
  return true;
}

function linhaResultado(linha) {
  const classe = linha.destaque ? ' calculadora-memoria__linha--destaque' : '';
  return `<div class="calculadora-memoria__linha${classe}">
    <dt>${escaparHtml(linha.rotulo)}</dt>
    <dd>${escaparHtml(typeof linha.valor === 'number' ? moeda(linha.valor) : linha.valor)}</dd>
  </div>`;
}

function renderizarResultado(elemento, dados) {
  const grupos = dados.grupos.map((grupo) => `<section class="calculadora-memoria">
    ${grupo.titulo ? `<h4>${escaparHtml(grupo.titulo)}</h4>` : ''}
    <dl>${grupo.linhas.map(linhaResultado).join('')}</dl>
  </section>`).join('');
  const metricas = (dados.metricas || []).map((metrica) => `<div>
    <dt>${escaparHtml(metrica.rotulo)}</dt>
    <dd>${escaparHtml(typeof metrica.valor === 'number' ? moeda(metrica.valor) : metrica.valor)}</dd>
  </div>`).join('');
  const notas = (dados.notas || []).map((nota) => `<li>${escaparHtml(nota)}</li>`).join('');
  const alerta = dados.alerta ? `<p class="calculadora-resultado__alerta">${escaparHtml(dados.alerta)}</p>` : '';
  const cfg = window.EED_CALCULADORAS || {};
  const mensagem = `Olá! Usei a calculadora de ${dados.nome} no Empregador em Dia e gostaria de conferir a estimativa para o meu caso.`;
  const whatsapp = cfg.whatsapp
    ? `<a class="botao botao--secundario botao--bloco" href="https://wa.me/${encodeURIComponent(cfg.whatsapp)}?text=${encodeURIComponent(mensagem)}" target="_blank" rel="noopener noreferrer">Conferir esta estimativa</a>`
    : '';

  elemento.innerHTML = `<div class="calculadora-resultado__conteudo" tabindex="-1">
    <p class="calculadora-resultado__sobre">${escaparHtml(dados.sobre)}</p>
    <h3>${escaparHtml(dados.rotuloTotal)}</h3>
    <p class="calculadora-resultado__total">${escaparHtml(moeda(dados.total))}</p>
    ${metricas ? `<dl class="calculadora-metricas">${metricas}</dl>` : ''}
    ${alerta}
    ${grupos}
    ${notas ? `<div class="calculadora-premissas"><h4>Premissas e limites</h4><ul>${notas}</ul></div>` : ''}
    <div class="calculadora-resultado__acoes">
      <button class="botao botao--fantasma" type="button" data-imprimir-resultado>Imprimir memória</button>
      ${whatsapp}
    </div>
  </div>`;

  const imprimir = elemento.querySelector('[data-imprimir-resultado]');
  if (imprimir) imprimir.addEventListener('click', () => window.print());
  const conteudo = elemento.querySelector('.calculadora-resultado__conteudo');
  if (conteudo && window.matchMedia('(max-width: 860px)').matches) conteudo.focus({ preventScroll: true });
}

function dadosFormulario(form) {
  const dados = new FormData(form);
  const valor = (nome) => numeroBrasileiro(dados.get(nome));
  return { dados, valor };
}

function calcularFormularioCusto(form, resultado) {
  const { dados, valor } = dadosFormulario(form);
  const regime = dados.get('regime');
  const calculo = calcularCustoContratacao({
    salario: valor('salario'),
    beneficios: valor('beneficios'),
    regime,
    rat: Number(dados.get('rat') || 0.01),
    terceiros: Number(dados.get('terceiros') || 0) / 100,
    provisaoRescisao: dados.has('provisaoRescisao'),
  });
  const nomesRegime = {
    simples: 'Simples Nacional com CPP no DAS',
    simples4: 'Simples Nacional — Anexo IV',
    normal: 'Lucro Presumido ou Lucro Real',
    domestico: 'Empregador doméstico — DAE',
  };
  const composicao = calculo.componentes
    .map((item) => `${item.rotulo} ${percentual(item.taxa)}`)
    .join(' · ');

  renderizarResultado(resultado, {
    nome: 'custo de contratação',
    sobre: nomesRegime[regime],
    rotuloTotal: 'Custo médio mensal estimado',
    total: calculo.mediaMensal,
    metricas: [
      { rotulo: 'Mês normal, sem provisões', valor: calculo.mesNormal },
      { rotulo: 'Custo anual estimado', valor: calculo.anual },
    ],
    grupos: [{
      titulo: 'Memória mensal',
      linhas: [
        { rotulo: 'Salário', valor: calculo.salario },
        { rotulo: 'Benefícios informados', valor: calculo.beneficios },
        { rotulo: `Encargos sobre o mês (${percentual(calculo.aliquota)})`, valor: calculo.encargosMes },
        { rotulo: 'Provisão de 13º (1/12)', valor: calculo.provisao13 },
        { rotulo: 'Provisão do 1/3 de férias (1/36)', valor: calculo.provisaoTercoFerias },
        { rotulo: 'Encargos sobre as provisões', valor: calculo.encargosProvisoes },
        { rotulo: 'Custo médio mensal', valor: calculo.mediaMensal, destaque: true },
      ],
    }],
    notas: [
      `Encargos considerados: ${composicao}.`,
      'O salário pago durante o mês de férias já está dentro dos 12 salários anuais; a provisão adicional mostrada é apenas do terço constitucional.',
      'Não entram vale-transporte descontado, afastamentos, FAP, desoneração, adicionais variáveis ou regras da convenção coletiva.',
    ],
  });
}

function calcularFormularioFerias(form, resultado) {
  const { dados, valor } = dadosFormulario(form);
  const calculo = calcularFerias({
    salario: valor('salario'),
    medias: valor('medias'),
    dias: Number(dados.get('dias')),
    abono: dados.has('abono'),
    adiantamento13: dados.has('adiantamento13'),
  });
  const linhas = [
    { rotulo: `Férias — ${calculo.diasGozo} dias de descanso`, valor: calculo.feriasGozo },
    { rotulo: '1/3 sobre os dias de descanso', valor: calculo.tercoGozo },
  ];
  if (calculo.diasAbono) {
    linhas.push(
      { rotulo: `Abono pecuniário — ${calculo.diasAbono} dias`, valor: calculo.valorAbono },
      { rotulo: '1/3 sobre o abono', valor: calculo.tercoAbono }
    );
  }
  if (calculo.primeiraParcela13) linhas.push({ rotulo: 'Adiantamento estimado da 1ª parcela do 13º', valor: calculo.primeiraParcela13 });
  linhas.push({ rotulo: 'Pagamento antes das férias', valor: calculo.pagamentoAntecipado, destaque: true });

  const metricas = [
    { rotulo: 'Base remuneratória usada', valor: calculo.base },
    { rotulo: 'Dias de descanso', valor: `${calculo.diasGozo} dias` },
  ];
  if (calculo.diasAbono) metricas.push({ rotulo: 'Dias convertidos em abono', valor: `${calculo.diasAbono} dias` });

  renderizarResultado(resultado, {
    nome: 'férias',
    sobre: 'Estimativa bruta do recibo',
    rotuloTotal: 'Pagamento antes das férias',
    total: calculo.pagamentoAntecipado,
    metricas,
    grupos: [{ titulo: 'Memória do recibo', linhas }],
    notas: [
      'O pagamento das férias e do abono, quando houver, deve ocorrer até dois dias antes do início do período.',
      calculo.diasAbono
        ? `A remuneração aproximada dos ${calculo.diasAbono} dias trabalhados, estimada em ${moeda(calculo.salarioDiasTrabalhados)}, segue na folha normal e não integra o recibo antecipado.`
        : 'Sem abono, não há remuneração adicional por dias trabalhados durante o período.',
      'INSS, imposto de renda, pensão, faltas que retiram o direito e médias apuradas de forma diferente não foram calculados.',
    ],
  });
}

function calcularFormularioDecimo(form, resultado) {
  const { dados, valor } = dadosFormulario(form);
  const calculo = calcularDecimoTerceiro({
    salario: valor('salario'),
    medias: valor('medias'),
    avos: Number(dados.get('avos')),
  });

  renderizarResultado(resultado, {
    nome: '13º salário',
    sobre: `${calculo.avos}/12 avos considerados`,
    rotuloTotal: '13º bruto estimado',
    total: calculo.total,
    metricas: [
      { rotulo: '1ª parcela estimada', valor: calculo.primeira },
      { rotulo: '2ª parcela antes dos descontos', valor: calculo.segundaBruta },
    ],
    grupos: [{
      titulo: 'Memória do cálculo',
      linhas: [
        { rotulo: 'Base remuneratória', valor: calculo.base },
        { rotulo: 'Proporção do ano', valor: `${calculo.avos}/12` },
        { rotulo: 'Direito bruto total', valor: calculo.total, destaque: true },
        { rotulo: 'Primeira parcela de planejamento', valor: calculo.primeira },
        { rotulo: 'Saldo bruto para a segunda parcela', valor: calculo.segundaBruta },
      ],
    }],
    notas: [
      'Cada mês com 15 dias ou mais conta como 1/12.',
      'A divisão em metades é uma estimativa de planejamento; médias variáveis podem exigir ajuste na segunda parcela.',
      'INSS e imposto de renda, quando incidentes, são descontados na segunda parcela e não aparecem neste valor bruto.',
    ],
  });
}

function calcularFormularioRescisao(form, resultado) {
  const { dados, valor } = dadosFormulario(form);
  const admissao = dataIso(dados.get('admissao'));
  const saida = dataIso(dados.get('dataSaida'));
  const modalidade = dados.get('modalidade');
  const aviso = dados.get('aviso');
  const anos = anosCompletos(admissao, saida);
  const diasAviso = diasAvisoPrevio(modalidade, anos);
  const projetada = aviso === 'indenizado' && (modalidade === 'dispensa' || modalidade === 'acordo')
    ? adicionarDias(saida, diasAviso)
    : saida;
  const saldoFgts = valor('saldoFgts');
  const calculo = calcularRescisao({
    salario: valor('salario'),
    medias: valor('medias'),
    diasSaldo: Number(dados.get('diasSaldo')),
    modalidade,
    aviso,
    anosCompletos: anos,
    avos13: Number(dados.get('avos13')),
    avosFerias: Number(dados.get('avosFerias')),
    feriasSimples: Number(dados.get('feriasSimples')),
    feriasDobro: Number(dados.get('feriasDobro')),
    saldoFgts,
  });
  const nomes = {
    dispensa: 'Dispensa sem justa causa',
    pedido: 'Pedido de demissão',
    acordo: 'Acordo do art. 484-A da CLT',
    termino: 'Término normal de contrato a prazo',
  };
  const verbas = [
    { rotulo: 'Saldo de salário', valor: calculo.saldoSalario },
  ];
  if (calculo.avisoPrevio) {
    verbas.push({
      rotulo: calculo.avisoPrevio < 0 ? 'Desconto estimado do aviso não cumprido' : `Aviso prévio indenizado — ${calculo.diasAviso} dias${modalidade === 'acordo' ? ', pela metade' : ''}`,
      valor: calculo.avisoPrevio,
    });
  }
  verbas.push({ rotulo: `13º proporcional — ${dados.get('avos13')}/12`, valor: calculo.decimo });
  if (calculo.feriasProporcionaisBase || calculo.feriasProporcionaisTerco) {
    verbas.push(
      { rotulo: `Férias proporcionais — ${dados.get('avosFerias')}/12`, valor: calculo.feriasProporcionaisBase },
      { rotulo: '1/3 sobre férias proporcionais', valor: calculo.feriasProporcionaisTerco }
    );
  }
  if (calculo.feriasSimplesBase) {
    verbas.push(
      { rotulo: 'Férias completas ainda não tiradas', valor: calculo.feriasSimplesBase },
      { rotulo: '1/3 correspondente', valor: calculo.feriasSimplesTerco }
    );
  }
  if (calculo.feriasDobroBase) {
    verbas.push(
      { rotulo: 'Férias não concedidas no prazo — em dobro', valor: calculo.feriasDobroBase },
      { rotulo: '1/3 correspondente', valor: calculo.feriasDobroTerco }
    );
  }
  if (calculo.ajustePagamentoNegativo) {
    verbas.push({ rotulo: 'Ajuste para não apresentar pagamento negativo', valor: calculo.ajustePagamentoNegativo });
  }
  verbas.push({ rotulo: 'Total bruto direto', valor: calculo.totalDireto, destaque: true });

  const fgts = [
    { rotulo: 'Base estimada do FGTS rescisório', valor: calculo.baseFgtsRescisorio },
    { rotulo: 'FGTS rescisório — 8%', valor: calculo.fgtsRescisorio },
  ];
  if (calculo.percentualMulta) {
    fgts.push({ rotulo: `Indenização de ${percentual(calculo.percentualMulta)} sobre saldo + depósitos rescisórios`, valor: calculo.multaFgts });
  }
  fgts.push({ rotulo: 'Total estimado em FGTS', valor: calculo.totalFgts, destaque: true });

  const notas = [
    `Foram considerados ${anos} ${anos === 1 ? 'ano completo' : 'anos completos'} de contrato e ${diasAviso} dias de aviso quando aplicável.`,
    aviso === 'indenizado' && diasAviso ? `A projeção usada para avos termina em ${dataLonga.format(projetada)}.` : 'A data informada foi usada como término do contrato, sem projeção indenizada.',
    'O FGTS não é pago diretamente junto com as verbas do termo; ele é recolhido na conta vinculada.',
    calculo.ajustePagamentoNegativo ? 'O desconto estimado do aviso superou os demais créditos; o resultado direto foi limitado a zero. Eventual cobrança exige análise própria.' : 'O desconto do aviso, quando selecionado, foi aplicado antes do total direto.',
    'INSS, imposto de renda, adiantamentos, faltas, pensão, benefícios, norma coletiva, estabilidade e parcelas especiais não foram calculados.',
  ];
  const alerta = calculo.percentualMulta && saldoFgts === 0
    ? 'Sem o saldo do extrato, a indenização do FGTS foi calculada apenas sobre os depósitos rescisórios e o desembolso total está incompleto.'
    : '';

  renderizarResultado(resultado, {
    nome: 'rescisão',
    sobre: nomes[modalidade],
    rotuloTotal: 'Desembolso bruto estimado',
    total: calculo.custoEmpregador,
    metricas: [
      { rotulo: 'Direto ao empregado', valor: calculo.totalDireto },
      { rotulo: 'Recolhimentos de FGTS', valor: calculo.totalFgts },
    ],
    alerta,
    grupos: [
      { titulo: 'Verbas pagas diretamente', linhas: verbas },
      { titulo: 'Conta vinculada do FGTS', linhas: fgts },
    ],
    notas,
  });
}

function atualizarCamposCusto(form) {
  const regime = form.elements.regime.value;
  const rat = form.querySelector('[data-custo-campo="rat"]');
  const terceiros = form.querySelector('[data-custo-campo="terceiros"]');
  const provisao = form.querySelector('[data-custo-campo="provisao"]');
  const mostrarRat = regime === 'simples4' || regime === 'normal';
  const mostrarTerceiros = regime === 'normal';
  rat.hidden = !mostrarRat;
  rat.querySelectorAll('input, select').forEach((campo) => { campo.disabled = !mostrarRat; });
  terceiros.hidden = !mostrarTerceiros;
  terceiros.querySelectorAll('input, select').forEach((campo) => { campo.disabled = !mostrarTerceiros; });
  provisao.hidden = regime === 'domestico';
  provisao.querySelector('input').disabled = regime === 'domestico';
}

function opcoesAviso(modalidade) {
  if (modalidade === 'pedido') return [
    ['trabalhado', 'Aviso trabalhado'],
    ['descontado', 'Aviso não cumprido — estimar desconto de 30 dias'],
    ['dispensado', 'Cumprimento dispensado, sem pagamento nem desconto'],
  ];
  if (modalidade === 'termino') return [['nenhum', 'Não há aviso prévio no término normal']];
  return [
    ['indenizado', modalidade === 'acordo' ? 'Aviso indenizado — pago pela metade' : 'Aviso indenizado'],
    ['trabalhado', 'Aviso trabalhado — já remunerado na folha'],
  ];
}

function atualizarAvisoRescisao(form) {
  const modalidade = form.elements.modalidade.value;
  const select = form.elements.aviso;
  const anterior = select.value;
  select.innerHTML = opcoesAviso(modalidade)
    .map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`)
    .join('');
  if (Array.from(select.options).some((opcao) => opcao.value === anterior)) select.value = anterior;
  form.querySelector('[data-rescisao-campo="aviso"]').hidden = modalidade === 'termino';
}

export function limiteDiasRescisao(valorDataSaida) {
  const saida = valorDataSaida instanceof Date ? valorDataSaida : dataIso(valorDataSaida);
  return saida ? saida.getUTCDate() : 31;
}

function atualizarLimiteDiasRescisao(form) {
  const campo = form.elements.diasSaldo;
  const limite = limiteDiasRescisao(form.elements.dataSaida.value);
  campo.max = String(limite);
  return limite;
}

function sugerirRescisao(form) {
  const admissao = dataIso(form.elements.admissao.value);
  const saida = dataIso(form.elements.dataSaida.value);
  const limiteDias = atualizarLimiteDiasRescisao(form);
  if (!saida) return;
  form.elements.diasSaldo.value = limiteDias;
  if (!admissao || admissao > saida) return;

  const modalidade = form.elements.modalidade.value;
  const aviso = form.elements.aviso.value;
  const anos = anosCompletos(admissao, saida);
  const dias = diasAvisoPrevio(modalidade, anos);
  const fim = aviso === 'indenizado' && (modalidade === 'dispensa' || modalidade === 'acordo')
    ? adicionarDias(saida, dias)
    : saida;
  form.elements.avos13.value = contarAvos13(admissao, fim, saida.getUTCFullYear());
  form.elements.avosFerias.value = contarAvosFerias(admissao, fim);
}

function prepararFormulario(form) {
  const resultado = form.closest('.calculadora-corpo').querySelector('[data-resultado]');
  resultado._htmlInicial = resultado.innerHTML;
  const tipo = form.dataset.calculadoraForm;

  form.querySelectorAll('input, select').forEach((campo) => {
    campo.addEventListener('blur', () => {
      if (campo.disabled || campo.closest('[hidden]')) return;
      const mensagem = mensagemCampo(campo);
      marcarCampo(form, campo, mensagem);
      if (campo.matches('[data-numero]') && !mensagem && String(campo.value || '').trim()) {
        campo.value = numeroMoeda.format(numeroBrasileiro(campo.value));
      }
    });
    campo.addEventListener('input', () => {
      if (campo.getAttribute('aria-invalid') === 'true') marcarCampo(form, campo, mensagemCampo(campo));
    });
  });

  if (tipo === 'custo') {
    atualizarCamposCusto(form);
    form.elements.regime.addEventListener('change', () => atualizarCamposCusto(form));
  }

  if (tipo === 'rescisao') {
    atualizarAvisoRescisao(form);
    form.elements.modalidade.addEventListener('change', () => {
      atualizarAvisoRescisao(form);
      sugerirRescisao(form);
    });
    form.elements.aviso.addEventListener('change', () => sugerirRescisao(form));
    form.elements.admissao.addEventListener('change', () => sugerirRescisao(form));
    form.elements.dataSaida.addEventListener('change', () => sugerirRescisao(form));
  }

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!validarFormulario(form)) return;
    if (tipo === 'custo') calcularFormularioCusto(form, resultado);
    if (tipo === 'ferias') calcularFormularioFerias(form, resultado);
    if (tipo === 'decimo') calcularFormularioDecimo(form, resultado);
    if (tipo === 'rescisao') calcularFormularioRescisao(form, resultado);
  });

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      form.querySelectorAll('[aria-invalid]').forEach((campo) => campo.setAttribute('aria-invalid', 'false'));
      form.querySelectorAll('[data-erro-campo]').forEach((erro) => { erro.hidden = true; erro.textContent = ''; });
      const resumo = form.querySelector('[data-calculadora-erros]');
      resumo.hidden = true;
      resultado.innerHTML = resultado._htmlInicial;
      if (tipo === 'custo') atualizarCamposCusto(form);
      if (tipo === 'rescisao') {
        atualizarAvisoRescisao(form);
        atualizarLimiteDiasRescisao(form);
      }
    }, 0);
  });
}

function iniciarCalculadoras() {
  const raiz = document.querySelector('[data-calculadoras]');
  if (!raiz) return;
  const abas = Array.from(raiz.querySelectorAll('[data-calculadora-aba]'));
  const paineis = Array.from(raiz.querySelectorAll('[data-calculadora-painel]'));

  const ativar = (nome, focar = false) => {
    if (!abas.some((aba) => aba.dataset.calculadoraAba === nome)) nome = 'custo';
    abas.forEach((aba) => {
      const ativa = aba.dataset.calculadoraAba === nome;
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      aba.tabIndex = ativa ? 0 : -1;
      if (ativa && focar) aba.focus();
    });
    paineis.forEach((painel) => { painel.hidden = painel.dataset.calculadoraPainel !== nome; });
    if (history.replaceState) history.replaceState(null, '', `#${nome}`);
  };

  abas.forEach((aba, indice) => {
    aba.addEventListener('click', () => ativar(aba.dataset.calculadoraAba));
    aba.addEventListener('keydown', (evento) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
      evento.preventDefault();
      let proxima = indice;
      if (evento.key === 'ArrowRight') proxima = (indice + 1) % abas.length;
      if (evento.key === 'ArrowLeft') proxima = (indice - 1 + abas.length) % abas.length;
      if (evento.key === 'Home') proxima = 0;
      if (evento.key === 'End') proxima = abas.length - 1;
      ativar(abas[proxima].dataset.calculadoraAba, true);
    });
  });

  raiz.querySelectorAll('[data-calculadora-form]').forEach(prepararFormulario);
  const hash = window.location.hash.replace('#', '');
  ativar(hash || 'custo');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarCalculadoras);
  else iniciarCalculadoras();
}
