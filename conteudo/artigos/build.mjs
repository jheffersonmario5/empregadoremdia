#!/usr/bin/env node
/**
 * Gerador estático do site Empregador em Dia.
 * Zero dependências: roda com Node 18+ e nada mais.
 *
 * Uso:  node build.mjs        -> gera o site em _site/
 *       node build.mjs --serve -> gera e sobe um servidor local em :4000
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIR_CONTEUDO = path.join(RAIZ, 'conteudo');
const DIR_ARTIGOS = path.join(DIR_CONTEUDO, 'artigos');
const DIR_ASSETS = path.join(RAIZ, 'assets');
const DIR_SAIDA = path.join(RAIZ, '_site');

const avisos = [];

/* ------------------------------------------------------------------ *
 * utilidades
 * ------------------------------------------------------------------ */

const escapar = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escaparAtributo = (s = '') => escapar(s).replace(/'/g, '&#39;');

function slugificar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dia} de ${meses[mes - 1]} de ${ano}`;
}

function tempoLeitura(markdown) {
  const palavras = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/* ------------------------------------------------------------------ *
 * front matter
 * ------------------------------------------------------------------ */

function lerFrontMatter(bruto) {
  const texto = bruto.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!texto.startsWith('---')) return { dados: {}, corpo: texto };

  const fim = texto.indexOf('\n---', 3);
  if (fim === -1) return { dados: {}, corpo: texto };

  const bloco = texto.slice(4, fim);
  const corpo = texto.slice(fim + 4).replace(/^\n+/, '');
  const dados = {};
  const arriscados = [];

  for (const linha of bloco.split('\n')) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue;
    const sep = linha.indexOf(':');
    if (sep === -1) continue;
    const chave = linha.slice(0, sep).trim();
    let valor = linha.slice(sep + 1).trim();

    const citado =
      (valor.startsWith('"') && valor.endsWith('"') && valor.length > 1) ||
      (valor.startsWith("'") && valor.endsWith("'") && valor.length > 1);

    if (citado) {
      valor = valor.slice(1, -1).replace(/\\(["'\\])/g, '$1');
    } else if (/:\s/.test(valor) || /^[[{>|*&!%@`]/.test(valor)) {
      // Este gerador é tolerante, mas editores visuais usam YAML estrito e
      // rejeitam dois-pontos sem aspas. Avisar antes que quebre lá.
      arriscados.push(chave);
    }

    dados[chave] = valor;
  }
  return { dados, corpo, arriscados };
}

/* ------------------------------------------------------------------ *
 * markdown -> html  (subconjunto suficiente e previsível)
 * ------------------------------------------------------------------ */

function inline(texto) {
  let saida = escapar(texto);

  // código `assim`
  saida = saida.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // negrito **assim**
  saida = saida.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // itálico *assim*
  saida = saida.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // link [texto](url)
  saida = saida.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, rotulo, url) => {
    const externo = /^https?:\/\//.test(url);
    const extras = externo ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escaparAtributo(url)}"${extras}>${rotulo}</a>`;
  });

  return saida;
}

function markdown(fonte) {
  const linhas = fonte.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const sumario = [];
  let i = 0;

  const ehTabela = (n) =>
    linhas[n]?.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(linhas[n + 1] || '');

  while (i < linhas.length) {
    const linha = linhas[i];
    const cru = linha.trim();

    // linha em branco
    if (!cru) { i++; continue; }

    // separador
    if (/^(-{3,}|\*{3,})$/.test(cru)) { html.push('<hr>'); i++; continue; }

    // caixa de destaque:  :::tipo Título
    const caixa = cru.match(/^:::\s*(\w+)\s*(.*)$/);
    if (caixa) {
      const [, tipo, titulo] = caixa;
      const dentro = [];
      i++;
      while (i < linhas.length && linhas[i].trim() !== ':::') { dentro.push(linhas[i]); i++; }
      i++; // pula o :::
      const { html: interno } = markdown(dentro.join('\n'));
      html.push(
        `<aside class="caixa caixa--${escaparAtributo(tipo)}">` +
        (titulo ? `<p class="caixa__titulo">${inline(titulo)}</p>` : '') +
        interno +
        `</aside>`
      );
      continue;
    }

    // títulos
    const titulo = cru.match(/^(#{2,4})\s+(.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      const texto = titulo[2].trim();
      const id = slugificar(texto);
      if (nivel === 2) sumario.push({ id, texto });
      html.push(`<h${nivel} id="${escaparAtributo(id)}">${inline(texto)}</h${nivel}>`);
      i++;
      continue;
    }

    // citação
    if (cru.startsWith('>')) {
      const dentro = [];
      while (i < linhas.length && linhas[i].trim().startsWith('>')) {
        dentro.push(linhas[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote><p>${inline(dentro.join(' '))}</p></blockquote>`);
      continue;
    }

    // tabela
    if (ehTabela(i)) {
      const celulas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const cabecalho = celulas(linhas[i]);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) {
        corpo.push(celulas(linhas[i]));
        i++;
      }
      html.push(
        '<div class="tabela-rolagem"><table><thead><tr>' +
        cabecalho.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        corpo.map((l) => `<tr>${l.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
        '</tbody></table></div>'
      );
      continue;
    }

    // lista não ordenada
    if (/^[-*]\s+/.test(cru)) {
      const itens = [];
      while (i < linhas.length && /^[-*]\s+/.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      html.push(`<ul>${itens.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    // lista ordenada
    if (/^\d+[.)]\s+/.test(cru)) {
      const itens = [];
      while (i < linhas.length && /^\d+[.)]\s+/.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      html.push(`<ol>${itens.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    // parágrafo
    const paragrafo = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{2,4}\s|[-*]\s|\d+[.)]\s|>|\||:::)/.test(linhas[i].trim()) && !/^(-{3,}|\*{3,})$/.test(linhas[i].trim())) {
      paragrafo.push(linhas[i].trim());
      i++;
    }
    if (paragrafo.length) html.push(`<p>${inline(paragrafo.join(' '))}</p>`);
    else i++;
  }

  return { html: html.join('\n'), sumario };
}

/* ------------------------------------------------------------------ *
 * carregamento
 * ------------------------------------------------------------------ */

const site = JSON.parse(fs.readFileSync(path.join(DIR_CONTEUDO, 'site.json'), 'utf8'));

// Rede de proteção: se algum campo sumir do site.json (por edição manual ou
// por um editor visual), o build avisa em vez de quebrar no meio.
for (const [chave, padrao] of [
  ['dominio', 'empregadoremdia.com.br'],
  ['url', 'https://empregadoremdia.com.br'],
  ['email', ''],
  ['whatsapp', ''],
  ['formularioEndpoint', ''],
]) {
  if (site[chave] === undefined) {
    avisos.push(`Campo "${chave}" ausente em conteudo/site.json — usando "${padrao}".`);
    site[chave] = padrao;
  }
}
if (!site.advogado || !site.advogado.nome) {
  avisos.push('Bloco "advogado" ausente ou incompleto em conteudo/site.json — a identificação profissional exigida pela OAB não vai aparecer no rodapé.');
  site.advogado = { nome: site.advogado?.nome || '', oab: site.advogado?.oab || '', ...site.advogado };
}
if (site.advogadaParceira && !site.advogadaParceira.nome) site.advogadaParceira = null;

if (!site.whatsapp || /^0+$|9{6,}/.test(site.whatsapp)) {
  avisos.push('WhatsApp ainda com número de exemplo em conteudo/site.json — ajuste antes de publicar.');
}
if (!site.formularioEndpoint) {
  avisos.push('Formulário sem endpoint em conteudo/site.json — ele será exibido desativado.');
}

const TRILHAS = {
  empresa: {
    id: 'empresa',
    nome: 'Empresa',
    rotuloLongo: 'Tenho empresa e contrato pela CLT',
    caminho: '/empresa/',
    resumo: 'Rotina trabalhista de quem tem CNPJ: admissão, jornada, saúde e segurança, gestão de riscos e desligamento.',
    chamada: 'Da admissão ao desligamento, o que a lei cobra de quem tem CNPJ.',
  },
  domestico: {
    id: 'domestico',
    nome: 'Doméstico',
    rotuloLongo: 'Tenho empregado doméstico em casa',
    caminho: '/domestico/',
    resumo: 'Regras da LC 150/2015 para quem emprega em casa: registro, eSocial, guia DAE, jornada, férias e rescisão.',
    chamada: 'Contratar em casa é uma relação de emprego formal. Veja o que ela exige.',
  },
};

function carregarArtigos() {
  if (!fs.existsSync(DIR_ARTIGOS)) return [];
  return fs
    .readdirSync(DIR_ARTIGOS)
    .filter((n) => n.endsWith('.md'))
    .map((nome) => {
      const bruto = fs.readFileSync(path.join(DIR_ARTIGOS, nome), 'utf8');
      const { dados, corpo, arriscados = [] } = lerFrontMatter(bruto);

      if (arriscados.length) {
        avisos.push(
          `Em ${nome}, o campo ${arriscados.map((c) => `"${c}"`).join(' e ')} tem dois-pontos sem aspas. ` +
          `O site é gerado assim mesmo, mas o editor visual não consegue abrir o arquivo — ponha o valor entre aspas.`
        );
      }
      // A URL vem do NOME DO ARQUIVO (curta e estável), não do título.
      // Para forçar outra, basta declarar "slug:" no front matter.
      const slug = dados.slug || slugificar(nome.replace(/\.md$/, ''));

      if (!dados.titulo) avisos.push(`Artigo ${nome} sem "titulo" no front matter.`);
      if (!TRILHAS[dados.trilha]) avisos.push(`Artigo ${nome} com trilha inválida: "${dados.trilha}".`);

      const { html, sumario } = markdown(corpo);
      return {
        arquivo: nome,
        slug,
        url: `/artigos/${slug}/`,
        titulo: dados.titulo || slug,
        descricao: dados.descricao || '',
        trilha: TRILHAS[dados.trilha] ? dados.trilha : 'empresa',
        data: dados.data || '',
        ordem: Number(dados.ordem || 99),
        destaque: String(dados.destaque || '').toLowerCase() === 'sim',
        assunto: dados.assunto || '',
        html,
        sumario,
        leitura: tempoLeitura(corpo),
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

/* ------------------------------------------------------------------ *
 * componentes
 * ------------------------------------------------------------------ */

const urlWhats = (mensagem) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(mensagem)}`;

function botaoWhats(mensagem, rotulo = 'Falar pelo WhatsApp', classe = 'botao botao--principal') {
  return `<a class="${classe}" href="${escaparAtributo(urlWhats(mensagem))}" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>
      ${escapar(rotulo)}</a>`;
}

function cabecalho(atual = '') {
  const itens = [
    ['/', 'Início'],
    ['/empresa/', 'Empresa'],
    ['/domestico/', 'Doméstico'],
    ['/conteudo/', 'Conteúdo'],
    ['/sobre/', 'Sobre'],
  ];
  return `<a class="pular" href="#principal">Pular para o conteúdo</a>
<header class="cabecalho">
  <div class="conteiner cabecalho__linha">
    <a class="marca" href="/">
      <span class="marca__simbolo" aria-hidden="true">
        <svg viewBox="0 0 32 32"><path d="M6 17.5 13 24.5 26 8.5" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="marca__texto"><strong>Empregador</strong> em Dia</span>
    </a>
    <button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu-principal">
      <span class="menu-botao__barras" aria-hidden="true"></span>
      <span class="sr">Abrir menu</span>
    </button>
    <nav class="navegacao" id="menu-principal" aria-label="Navegação principal">
      <ul>
        ${itens.map(([href, rotulo]) =>
          `<li><a href="${href}"${atual === href ? ' aria-current="page"' : ''}>${rotulo}</a></li>`
        ).join('\n        ')}
        <li class="navegacao__destaque"><a href="/contato/"${atual === '/contato/' ? ' aria-current="page"' : ''}>Contato</a></li>
      </ul>
    </nav>
  </div>
</header>`;
}

function chamadaContato(contexto = 'o site') {
  const msg = `Olá! Vim pelo site Empregador em Dia (${contexto}) e gostaria de orientação sobre uma questão trabalhista.`;
  return `<section class="faixa-contato">
  <div class="conteiner faixa-contato__grade">
    <div>
      <h2>Sua situação não está no conteúdo?</h2>
      <p>O material deste site é informativo e geral. Cada relação de trabalho tem particularidades que só aparecem na análise do caso concreto. Se preferir tratar da sua situação específica, fale com o escritório.</p>
    </div>
    <div class="faixa-contato__acoes">
      ${botaoWhats(msg, 'Falar pelo WhatsApp')}
      <a class="botao botao--secundario" href="/contato/">Enviar uma mensagem</a>
    </div>
  </div>
</section>`;
}

function rodape() {
  const anoAtual = new Date().getFullYear();
  return `<footer class="rodape">
  <div class="conteiner rodape__grade">
    <div class="rodape__bloco">
      <span class="marca marca--rodape">
        <span class="marca__simbolo" aria-hidden="true">
          <svg viewBox="0 0 32 32"><path d="M6 17.5 13 24.5 26 8.5" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="marca__texto"><strong>Empregador</strong> em Dia</span>
      </span>
      <p class="rodape__sobre">Conteúdo informativo sobre obrigações trabalhistas para quem contrata — empresas e empregadores domésticos.</p>
    </div>
    <div class="rodape__bloco">
      <h3>Conteúdo</h3>
      <ul>
        <li><a href="/empresa/">Trilha Empresa</a></li>
        <li><a href="/domestico/">Trilha Doméstico</a></li>
        <li><a href="/conteudo/">Todos os artigos</a></li>
      </ul>
    </div>
    <div class="rodape__bloco">
      <h3>Escritório</h3>
      <ul>
        <li><a href="/sobre/">Quem responde pelo conteúdo</a></li>
        <li><a href="/contato/">Contato</a></li>
      </ul>
    </div>
  </div>
  <div class="conteiner rodape__legal">
    <p><strong>${escapar(site.advogado.nome)}</strong> — ${escapar(site.advogado.oab)}${site.advogadaParceira ? `<br><strong>${escapar(site.advogadaParceira.nome)}</strong> — ${escapar(site.advogadaParceira.oab)}` : ''}</p>
    <p>Este site tem caráter exclusivamente informativo, nos termos do Provimento nº 205/2021 do Conselho Federal da OAB. O conteúdo aqui publicado não constitui consulta jurídica, não substitui a análise individualizada de cada caso e não implica garantia de qualquer resultado.</p>
    <p class="rodape__creditos">© ${anoAtual} Empregador em Dia · empregadoremdia.com.br</p>
  </div>
</footer>`;
}

function pagina({ titulo, descricao, corpo, caminho = '/', classe = '', tipo = 'website', dataArtigo = '' }) {
  const tituloCompleto = caminho === '/' ? `${titulo}` : `${titulo} · Empregador em Dia`;
  const canonica = `${site.url.replace(/\/$/, '')}${caminho}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(tituloCompleto)}</title>
<meta name="description" content="${escaparAtributo(descricao)}">
<link rel="canonical" href="${escaparAtributo(canonica)}">
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="Empregador em Dia">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${escaparAtributo(tituloCompleto)}">
<meta property="og:description" content="${escaparAtributo(descricao)}">
<meta property="og:url" content="${escaparAtributo(canonica)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0f1d2b">
<link rel="icon" href="/assets/icone.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/estilo.css">
${dataArtigo ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titulo,
    description: descricao,
    datePublished: dataArtigo,
    inLanguage: 'pt-BR',
    author: { '@type': 'Person', name: site.advogado.nome },
    publisher: { '@type': 'Organization', name: 'Empregador em Dia' },
    mainEntityOfPage: canonica,
  })}</script>` : ''}
</head>
<body class="${classe}">
${cabecalho(caminho)}
<main id="principal">
${corpo}
</main>
${rodape()}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function cartaoArtigo(artigo, { mostrarTrilha = false } = {}) {
  const t = TRILHAS[artigo.trilha];
  return `<article class="cartao">
  ${mostrarTrilha ? `<span class="etiqueta etiqueta--${t.id}">${escapar(t.nome)}</span>` : (artigo.assunto ? `<span class="cartao__assunto">${escapar(artigo.assunto)}</span>` : '')}
  <h3><a href="${artigo.url}">${escapar(artigo.titulo)}</a></h3>
  <p>${escapar(artigo.descricao)}</p>
  <span class="cartao__meta">${artigo.leitura} min de leitura</span>
</article>`;
}

/* ------------------------------------------------------------------ *
 * páginas
 * ------------------------------------------------------------------ */

function paginaInicial(artigos) {
  const destaques = artigos.filter((a) => a.destaque).slice(0, 3);
  const msg = 'Olá! Vim pelo site Empregador em Dia e gostaria de orientação sobre uma questão trabalhista.';

  const porta = (t) => {
    const total = artigos.filter((a) => a.trilha === t.id).length;
    return `<a class="porta porta--${t.id}" href="${t.caminho}">
      <span class="porta__rotulo">${escapar(t.rotuloLongo)}</span>
      <span class="porta__resumo">${escapar(t.resumo)}</span>
      <span class="porta__rodape">${total} ${total === 1 ? 'guia' : 'guias'} <span class="porta__seta" aria-hidden="true">→</span></span>
    </a>`;
  };

  return pagina({
    titulo: 'Empregador em Dia — obrigações trabalhistas explicadas para quem contrata',
    descricao: 'Conteúdo informativo sobre as obrigações trabalhistas de empresas e de empregadores domésticos: admissão, jornada, eSocial, saúde e segurança, férias e rescisão.',
    caminho: '/',
    classe: 'pagina-inicial',
    corpo: `
<section class="capa">
  <div class="conteiner capa__grade">
    <div class="capa__texto">
      <p class="capa__olho">Informação trabalhista para quem contrata</p>
      <h1>Estar em dia com a lei trabalhista começa por entender o que ela pede.</h1>
      <p class="capa__linha">A maior parte dos passivos trabalhistas não nasce de má-fé: nasce de obrigação desconhecida, prazo perdido ou registro mal feito. Este site reúne, em linguagem direta, o que a legislação exige de quem emprega.</p>
      <div class="capa__acoes">
        <a class="botao botao--principal" href="#trilhas">Ver as trilhas</a>
        <a class="botao botao--fantasma" href="/conteudo/">Todos os artigos</a>
      </div>
    </div>
    <aside class="capa__cartao">
      <h2>Por onde começar</h2>
      <p>O conteúdo é dividido por tipo de contratação, porque as regras são diferentes.</p>
      <ul class="lista-marcada">
        <li>Empresa que contrata pela CLT</li>
        <li>Família que emprega em casa</li>
      </ul>
      <p class="capa__cartao__nota">Escolha a sua situação logo abaixo.</p>
    </aside>
  </div>
</section>

<section class="secao" id="trilhas">
  <div class="conteiner">
    <h2 class="secao__titulo">Qual é a sua situação?</h2>
    <p class="secao__linha">As obrigações de uma empresa e as de um empregador doméstico são reguladas por normas distintas. Escolher a trilha certa evita aplicar a regra errada.</p>
    <div class="portas">
      ${porta(TRILHAS.empresa)}
      ${porta(TRILHAS.domestico)}
    </div>
  </div>
</section>

${destaques.length ? `<section class="secao secao--clara">
  <div class="conteiner">
    <h2 class="secao__titulo">Em pauta agora</h2>
    <p class="secao__linha">Temas com mudança recente de norma ou de fiscalização.</p>
    <div class="grade-cartoes">
      ${destaques.map((a) => cartaoArtigo(a, { mostrarTrilha: true })).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<section class="secao">
  <div class="conteiner">
    <h2 class="secao__titulo">Como o conteúdo é organizado</h2>
    <div class="grade-tres">
      <div class="bloco">
        <span class="bloco__numero">01</span>
        <h3>Obrigação por obrigação</h3>
        <p>Cada guia trata de uma exigência concreta: o que a lei determina, a quem se aplica, qual o prazo e o que costuma dar errado na prática.</p>
      </div>
      <div class="bloco">
        <span class="bloco__numero">02</span>
        <h3>Com a norma à vista</h3>
        <p>Os textos indicam o dispositivo legal correspondente — CLT, LC 150/2015, NRs, leis específicas — para que você possa conferir a fonte.</p>
      </div>
      <div class="bloco">
        <span class="bloco__numero">03</span>
        <h3>Sem substituir a análise do caso</h3>
        <p>Conteúdo geral orienta a rotina, mas não decide casos concretos. Quando a situação exigir, o caminho é a análise individualizada.</p>
      </div>
    </div>
  </div>
</section>

${chamadaContato('página inicial')}
`,
  });
}

function paginaTrilha(trilha, artigos) {
  const daTrilha = artigos.filter((a) => a.trilha === trilha.id);
  const porAssunto = new Map();
  for (const a of daTrilha) {
    const chave = a.assunto || 'Geral';
    if (!porAssunto.has(chave)) porAssunto.set(chave, []);
    porAssunto.get(chave).push(a);
  }

  return pagina({
    titulo: `Trilha ${trilha.nome}`,
    descricao: trilha.resumo,
    caminho: trilha.caminho,
    classe: `trilha trilha--${trilha.id}`,
    corpo: `
<section class="capa-trilha capa-trilha--${trilha.id}">
  <div class="conteiner">
    <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> <span aria-hidden="true">/</span> <span>${escapar(trilha.nome)}</span></nav>
    <h1>${escapar(trilha.rotuloLongo)}</h1>
    <p class="capa-trilha__linha">${escapar(trilha.chamada)}</p>
  </div>
</section>

<section class="secao">
  <div class="conteiner">
    ${daTrilha.length === 0
      ? '<p class="vazio">Os guias desta trilha estão sendo publicados.</p>'
      : [...porAssunto.entries()].map(([assunto, lista]) => `
    <div class="grupo">
      <h2 class="grupo__titulo">${escapar(assunto)}</h2>
      <div class="grade-cartoes">
        ${lista.map((a) => cartaoArtigo(a)).join('\n        ')}
      </div>
    </div>`).join('\n')}
  </div>
</section>

${chamadaContato(`trilha ${trilha.nome}`)}
`,
  });
}

function paginaConteudo(artigos) {
  return pagina({
    titulo: 'Todo o conteúdo',
    descricao: 'Índice completo dos guias informativos sobre obrigações trabalhistas para empresas e empregadores domésticos.',
    caminho: '/conteudo/',
    corpo: `
<section class="capa-interna">
  <div class="conteiner">
    <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> <span aria-hidden="true">/</span> <span>Conteúdo</span></nav>
    <h1>Todo o conteúdo</h1>
    <p class="capa-interna__linha">${artigos.length} ${artigos.length === 1 ? 'guia publicado' : 'guias publicados'}, organizados por tipo de contratação.</p>
  </div>
</section>

<section class="secao">
  <div class="conteiner">
    ${Object.values(TRILHAS).map((t) => {
      const lista = artigos.filter((a) => a.trilha === t.id);
      if (!lista.length) return '';
      return `<div class="grupo">
      <h2 class="grupo__titulo"><span class="etiqueta etiqueta--${t.id}">${escapar(t.nome)}</span></h2>
      <div class="grade-cartoes">
        ${lista.map((a) => cartaoArtigo(a)).join('\n        ')}
      </div>
    </div>`;
    }).join('\n')}
  </div>
</section>

${chamadaContato('índice de conteúdo')}
`,
  });
}

function paginaArtigo(artigo, artigos) {
  const t = TRILHAS[artigo.trilha];
  const relacionados = artigos
    .filter((a) => a.trilha === artigo.trilha && a.slug !== artigo.slug)
    .slice(0, 3);
  const msg = `Olá! Li o conteúdo "${artigo.titulo}" no site Empregador em Dia e gostaria de orientação sobre a minha situação.`;

  return pagina({
    titulo: artigo.titulo,
    descricao: artigo.descricao,
    caminho: artigo.url,
    classe: 'pagina-artigo',
    tipo: 'article',
    dataArtigo: artigo.data,
    corpo: `
<article class="artigo">
  <div class="conteiner conteiner--estreito">
    <nav class="migalhas" aria-label="Você está em">
      <a href="/">Início</a> <span aria-hidden="true">/</span>
      <a href="${t.caminho}">${escapar(t.nome)}</a> <span aria-hidden="true">/</span>
      <span>${escapar(artigo.assunto || 'Guia')}</span>
    </nav>
    <span class="etiqueta etiqueta--${t.id}">${escapar(t.nome)}</span>
    <h1>${escapar(artigo.titulo)}</h1>
    <p class="artigo__resumo">${escapar(artigo.descricao)}</p>
    <p class="artigo__meta">
      ${artigo.data ? `<span>Atualizado em ${formatarData(artigo.data)}</span>` : ''}
      <span>${artigo.leitura} min de leitura</span>
    </p>
  </div>

  <div class="conteiner conteiner--estreito artigo__corpo">
    ${artigo.sumario.length > 2 ? `<nav class="sumario" aria-label="Nesta página">
      <p class="sumario__titulo">Nesta página</p>
      <ul>${artigo.sumario.map((s) => `<li><a href="#${escaparAtributo(s.id)}">${escapar(s.texto)}</a></li>`).join('')}</ul>
    </nav>` : ''}
    ${artigo.html}

    <aside class="aviso-artigo">
      <p><strong>Conteúdo informativo.</strong> Este texto explica a regra geral e não considera as particularidades da sua contratação, de norma coletiva aplicável ou de decisão específica do seu caso. Ele não substitui a análise individualizada.</p>
    </aside>

    <div class="artigo__acoes">
      ${botaoWhats(msg, 'Tratar da minha situação')}
      <a class="botao botao--secundario" href="/contato/">Enviar uma mensagem</a>
    </div>
  </div>
</article>

${relacionados.length ? `<section class="secao secao--clara">
  <div class="conteiner">
    <h2 class="secao__titulo">Continue na trilha ${escapar(t.nome)}</h2>
    <div class="grade-cartoes">
      ${relacionados.map((a) => cartaoArtigo(a)).join('\n      ')}
    </div>
  </div>
</section>` : ''}
`,
  });
}

function paginaSobre() {
  const a = site.advogado;
  const p = site.advogadaParceira;
  return pagina({
    titulo: 'Quem responde pelo conteúdo',
    descricao: `Identificação profissional responsável pelo conteúdo do Empregador em Dia: ${a.nome}, ${a.oab}.`,
    caminho: '/sobre/',
    corpo: `
<section class="capa-interna">
  <div class="conteiner conteiner--estreito">
    <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> <span aria-hidden="true">/</span> <span>Sobre</span></nav>
    <h1>Quem responde pelo conteúdo</h1>
    <p class="capa-interna__linha">Identificação profissional, finalidade do site e limites do que aqui se publica.</p>
  </div>
</section>

<section class="secao">
  <div class="conteiner conteiner--estreito prosa">
    <h2 id="identificacao">Identificação profissional</h2>
    <div class="ficha">
      <p class="ficha__nome">${escapar(a.nome)}</p>
      <p class="ficha__oab">${escapar(a.oab)}</p>
    </div>
    ${p ? `<div class="ficha">
      <p class="ficha__nome">${escapar(p.nome)}</p>
      <p class="ficha__oab">${escapar(p.oab)}</p>
    </div>` : ''}

    <h2 id="finalidade">Para que serve este site</h2>
    <p>O Empregador em Dia reúne conteúdo técnico-informativo sobre as obrigações trabalhistas de quem contrata. A proposta é simples: quem emprega costuma descobrir a regra depois do problema, e boa parte do contencioso trabalhista tem origem em exigência ignorada, prazo perdido ou documentação frágil.</p>
    <p>Os textos tratam da norma em tese — o que a lei determina, a quem se aplica e como a obrigação se cumpre. São dirigidos tanto a empresas que contratam pela CLT quanto a famílias que empregam em casa, público que raramente encontra material organizado sobre o assunto.</p>

    <h2 id="limites">O que este site não é</h2>
    <p>Este site não presta consulta jurídica e não estabelece relação de patrocínio entre o leitor e os profissionais aqui identificados. O conteúdo é geral e não considera as particularidades de cada contratação, de convenção ou acordo coletivo aplicável, nem de eventual processo em curso.</p>
    <p>Nenhum texto publicado aqui promete resultado, compara serviços ou divulga honorários. A publicação observa o Provimento nº 205/2021 do Conselho Federal da OAB, que admite a publicidade de caráter informativo e veda a mercantilização da advocacia.</p>

    <h2 id="atualizacao">Atualização</h2>
    <p>Cada guia indica a data da última atualização. A legislação trabalhista muda com frequência, e valores como o salário mínimo são reajustados anualmente. Ao consultar um texto, confira a data e, em caso de dúvida sobre a vigência, verifique a norma citada.</p>
  </div>
</section>

${chamadaContato('página sobre')}
`,
  });
}

function paginaContato() {
  const msg = 'Olá! Vim pelo site Empregador em Dia e gostaria de orientação sobre uma questão trabalhista.';
  const formulario = site.formularioEndpoint
    ? `<form class="formulario" action="${escaparAtributo(site.formularioEndpoint)}" method="POST">
      <div class="campo">
        <label for="nome">Nome</label>
        <input id="nome" name="nome" type="text" autocomplete="name" required>
      </div>
      <div class="campo">
        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="campo">
        <label for="telefone">Telefone <span class="campo__opcional">(opcional)</span></label>
        <input id="telefone" name="telefone" type="tel" autocomplete="tel">
      </div>
      <div class="campo">
        <label for="perfil">Você contrata como</label>
        <select id="perfil" name="perfil">
          <option value="empresa">Empresa (CLT)</option>
          <option value="domestico">Empregador doméstico</option>
          <option value="outro">Outro / ainda não contratei</option>
        </select>
      </div>
      <div class="campo">
        <label for="mensagem">Sobre o que você precisa de orientação</label>
        <textarea id="mensagem" name="mensagem" rows="6" required></textarea>
      </div>
      <input type="text" name="_gotcha" class="sr" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="hidden" name="_subject" value="Contato pelo site Empregador em Dia">
      <p class="formulario__nota">Ao enviar, você concorda que os dados informados sejam usados exclusivamente para responder a este contato. O envio não cria relação profissional e não deve conter informações sigilosas.</p>
      <button class="botao botao--principal" type="submit">Enviar mensagem</button>
    </form>`
    : `<div class="formulario formulario--inativo">
      <p><strong>Formulário ainda não configurado.</strong></p>
      <p>Defina <code>formularioEndpoint</code> em <code>conteudo/site.json</code> para ativar o envio. Enquanto isso, use o WhatsApp ou o e-mail ao lado.</p>
    </div>`;

  return pagina({
    titulo: 'Contato',
    descricao: 'Canais de contato com o escritório para tratar de questões trabalhistas de forma individualizada.',
    caminho: '/contato/',
    corpo: `
<section class="capa-interna">
  <div class="conteiner">
    <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> <span aria-hidden="true">/</span> <span>Contato</span></nav>
    <h1>Falar com o escritório</h1>
    <p class="capa-interna__linha">O conteúdo do site é geral. Situações concretas — uma fiscalização em curso, uma rescisão específica, uma reclamação recebida — pedem análise individualizada.</p>
  </div>
</section>

<section class="secao">
  <div class="conteiner grade-contato">
    <div class="grade-contato__form">
      <h2>Enviar uma mensagem</h2>
      ${formulario}
    </div>
    <aside class="grade-contato__lado">
      <h2>Canais diretos</h2>
      <div class="canal">
        <p class="canal__rotulo">WhatsApp</p>
        ${botaoWhats(msg, 'Abrir conversa')}
      </div>
      <div class="canal">
        <p class="canal__rotulo">E-mail</p>
        <p><a href="mailto:${escaparAtributo(site.email)}">${escapar(site.email)}</a></p>
      </div>
      ${site.atendimento ? `<div class="canal">
        <p class="canal__rotulo">Atendimento</p>
        <p>${escapar(site.atendimento)}</p>
      </div>` : ''}
      <div class="canal canal--nota">
        <p>O primeiro contato serve para entender a demanda e verificar se o escritório pode atuar. Evite enviar documentos ou dados sigilosos antes disso.</p>
      </div>
    </aside>
  </div>
</section>
`,
  });
}

function pagina404() {
  return pagina({
    titulo: 'Página não encontrada',
    descricao: 'O endereço acessado não existe ou foi movido.',
    caminho: '/404.html',
    corpo: `
<section class="secao secao--centro">
  <div class="conteiner conteiner--estreito">
    <p class="erro__codigo">404</p>
    <h1>Essa página não existe</h1>
    <p>O endereço pode ter mudado ou o conteúdo pode ter sido reorganizado.</p>
    <div class="capa__acoes">
      <a class="botao botao--principal" href="/">Ir para o início</a>
      <a class="botao botao--secundario" href="/conteudo/">Ver todo o conteúdo</a>
    </div>
  </div>
</section>`,
  });
}

/* ------------------------------------------------------------------ *
 * escrita
 * ------------------------------------------------------------------ */

function gravar(rota, html) {
  const destino = rota.endsWith('.html')
    ? path.join(DIR_SAIDA, rota)
    : path.join(DIR_SAIDA, rota, 'index.html');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html, 'utf8');
  return destino;
}

function copiarPasta(origem, destino) {
  if (!fs.existsSync(origem)) return;
  fs.mkdirSync(destino, { recursive: true });
  for (const item of fs.readdirSync(origem, { withFileTypes: true })) {
    const de = path.join(origem, item.name);
    const para = path.join(destino, item.name);
    if (item.isDirectory()) copiarPasta(de, para);
    else fs.copyFileSync(de, para);
  }
}

function construir() {
  fs.rmSync(DIR_SAIDA, { recursive: true, force: true });
  fs.mkdirSync(DIR_SAIDA, { recursive: true });

  const artigos = carregarArtigos();
  const rotas = [];

  gravar('/', paginaInicial(artigos)); rotas.push('/');
  for (const t of Object.values(TRILHAS)) {
    gravar(t.caminho, paginaTrilha(t, artigos));
    rotas.push(t.caminho);
  }
  gravar('/conteudo/', paginaConteudo(artigos)); rotas.push('/conteudo/');
  gravar('/sobre/', paginaSobre()); rotas.push('/sobre/');
  gravar('/contato/', paginaContato()); rotas.push('/contato/');
  gravar('404.html', pagina404());

  for (const artigo of artigos) {
    gravar(artigo.url, paginaArtigo(artigo, artigos));
    rotas.push(artigo.url);
  }

  copiarPasta(DIR_ASSETS, path.join(DIR_SAIDA, 'assets'));

  // sitemap
  const base = site.url.replace(/\/$/, '');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rotas.map((r) => `  <url><loc>${base}${r}</loc></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIR_SAIDA, 'sitemap.xml'), sitemap, 'utf8');

  fs.writeFileSync(
    path.join(DIR_SAIDA, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
    'utf8'
  );

  // GitHub Pages: não processar com Jekyll + domínio próprio
  fs.writeFileSync(path.join(DIR_SAIDA, '.nojekyll'), '', 'utf8');
  if (site.dominio) fs.writeFileSync(path.join(DIR_SAIDA, 'CNAME'), `${site.dominio}\n`, 'utf8');

  console.log(`\n  Empregador em Dia — build concluído`);
  console.log(`  ${artigos.length} artigos · ${rotas.length} páginas · saída em _site/`);
  if (avisos.length) {
    console.log('\n  Avisos:');
    for (const a of avisos) console.log(`   ! ${a}`);
  }
  console.log('');
  return { artigos, rotas };
}

const resultado = construir();

/* ------------------------------------------------------------------ *
 * servidor local opcional
 * ------------------------------------------------------------------ */

if (process.argv.includes('--serve')) {
  const { createServer } = await import('node:http');
  const porta = Number(process.env.PORTA || 4000);
  const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };

  createServer((req, res) => {
    let rota = decodeURIComponent(req.url.split('?')[0]);
    let alvo = path.join(DIR_SAIDA, rota);
    if (!alvo.startsWith(DIR_SAIDA)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) alvo = path.join(alvo, 'index.html');
    if (!fs.existsSync(alvo)) {
      const err = path.join(DIR_SAIDA, '404.html');
      res.writeHead(404, { 'Content-Type': tipos['.html'] });
      res.end(fs.existsSync(err) ? fs.readFileSync(err) : 'não encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(alvo)] || 'application/octet-stream' });
    res.end(fs.readFileSync(alvo));
  }).listen(porta, () => console.log(`  servindo em http://localhost:${porta}\n`));
}

export { resultado };
