#!/usr/bin/env node
/**
 * Gerador estático do site Empregador em Dia.
 * Zero dependências: roda com Node 18+ e nada mais.
 *
 * Uso:  node build.mjs         -> gera o site em _site/
 *       node build.mjs --serve -> gera e sobe um servidor local em :4000
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  escapar,
  escaparAtributo,
  slugificar,
  markdown,
  lerFrontMatter,
  tempoLeitura,
} from './assets/markdown.js';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIR_CONTEUDO = path.join(RAIZ, 'conteudo');
const DIR_ARTIGOS = path.join(DIR_CONTEUDO, 'artigos');
const DIR_ASSETS = path.join(RAIZ, 'assets');
const DIR_SAIDA = path.join(RAIZ, '_site');

const avisos = [];

/* ------------------------------------------------------------------ *
 * utilidades
 * ------------------------------------------------------------------ */

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

function formatarMes(iso) {
  if (!iso) return '';
  const [ano, mes] = String(iso).split('-').map(Number);
  if (!ano || !mes) return '';
  return `${MESES[mes - 1]} de ${ano}`;
}

/* ------------------------------------------------------------------ *
 * ícones
 * ------------------------------------------------------------------ */

const svg = (traco) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${traco}</svg>`;

const ICONES = {
  empresa: svg('<path d="M3 21h18M6 21V4h9v17M15 10h4v11M9 8h3M9 12h3M9 16h3"/>'),
  domestico: svg('<path d="M3 10.6 12 3.5l9 7.1M5.6 9.6V20.5h12.8V9.6M10 20.5v-6h4v6"/>'),
  seta: svg('<path d="M5 12h13m-5.5-6 6 6-6 6"/>'),
  busca: svg('<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"/>'),
  sol: svg('<path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m11.32 0 1.42 1.42M4.92 4.92l1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>'),
  lua: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'),
  relogio: svg('<path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>'),
  livro: svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5V4.5ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
  balanca: svg('<path d="M12 3v18M7 21h10M12 6 5 9m7-3 7 3M5 9l-2.5 5a2.8 2.8 0 0 0 5 0L5 9Zm14 0-2.5 5a2.8 2.8 0 0 0 5 0L19 9Z"/>'),
  escudo: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>'),
  email: svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
  whats: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>',
};

const MARCA_SIMBOLO =
  '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M6 17.2 12.4 23.6 26 8.8" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ------------------------------------------------------------------ *
 * configuração e conteúdo
 * ------------------------------------------------------------------ */

const site = JSON.parse(fs.readFileSync(path.join(DIR_CONTEUDO, 'site.json'), 'utf8'));

// Rede de proteção: se algum campo sumir do site.json (por edição manual ou
// por um editor visual), o build avisa em vez de quebrar no meio.
for (const [chave, padrao] of [
  ['dominio', 'empregadoremdia.com.br'],
  ['url', 'https://empregadoremdia.com.br'],
  ['email', ''],
  ['whatsapp', ''],
]) {
  if (site[chave] === undefined) {
    avisos.push(`Campo "${chave}" ausente em conteudo/site.json — usando "${padrao}".`);
    site[chave] = padrao;
  }
}
if (!site.advogado || !site.advogado.nome) {
  avisos.push('Bloco "advogado" ausente ou incompleto em conteudo/site.json — a identificação profissional exigida pela OAB não vai aparecer no rodapé.');
  site.advogado = { nome: '', oab: '', ...site.advogado };
}

if (!site.whatsapp || /^0+$|9{6,}/.test(site.whatsapp)) {
  avisos.push('WhatsApp ainda com número de exemplo em conteudo/site.json — ajuste antes de publicar.');
}
if (!site.github || !site.github.usuario || !site.github.repositorio) {
  avisos.push('Bloco "github" incompleto em conteudo/site.json — o painel /publicar/ precisa dele.');
}

const TRILHAS = {
  empresa: {
    id: 'empresa',
    nome: 'Empresa',
    rotuloLongo: 'Tenho empresa e contrato pela CLT',
    rotuloCurto: 'Empresa (CLT)',
    caminho: '/empresa/',
    icone: ICONES.empresa,
    resumo: 'Rotina trabalhista de quem tem CNPJ: admissão, jornada, saúde e segurança, gestão de riscos e desligamento.',
    chamada: 'Da admissão ao desligamento, o que a lei cobra de quem tem CNPJ.',
  },
  domestico: {
    id: 'domestico',
    nome: 'Doméstico',
    rotuloLongo: 'Tenho empregado doméstico em casa',
    rotuloCurto: 'Empregador doméstico',
    caminho: '/domestico/',
    icone: ICONES.domestico,
    resumo: 'Regras da LC 150/2015 para quem emprega em casa: registro, eSocial, guia DAE, jornada, férias e rescisão.',
    chamada: 'Contratar em casa é uma relação de emprego formal. Veja o que ela exige.',
  },
};

// Arquivos .md que ficam na pasta de artigos mas não são artigos.
const NAO_E_ARTIGO = /^(leia-me|readme|_)/i;

function carregarArtigos() {
  if (!fs.existsSync(DIR_ARTIGOS)) return [];
  return fs
    .readdirSync(DIR_ARTIGOS, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !NAO_E_ARTIGO.test(e.name))
    .map((e) => e.name)
    .map((nome) => {
      const bruto = fs.readFileSync(path.join(DIR_ARTIGOS, nome), 'utf8');
      const { dados, corpo, arriscados = [] } = lerFrontMatter(bruto);

      if (arriscados.length) {
        avisos.push(
          `Em ${nome}, o campo ${arriscados.map((c) => `"${c}"`).join(' e ')} tem dois-pontos sem aspas. ` +
          'O site é gerado assim mesmo, mas um editor de YAML não consegue abrir o arquivo — ponha o valor entre aspas.'
        );
      }
      // A URL vem do NOME DO ARQUIVO (curta e estável), não do título.
      // Para forçar outra, basta declarar "slug:" no front matter.
      const slug = slugificar(dados.slug || nome.replace(/\.md$/, ''));

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
  return `<a class="${classe}" href="${escaparAtributo(urlWhats(mensagem))}" target="_blank" rel="noopener noreferrer">${ICONES.whats}${escapar(rotulo)}</a>`;
}

function whatsappFlutuante() {
  if (!site.whatsapp) return '';
  const mensagem = 'Olá! Vim pelo site Empregador em Dia e gostaria de orientação sobre uma questão trabalhista.';
  return `<a class="whatsapp-flutuante" href="${escaparAtributo(urlWhats(mensagem))}"
    target="_blank" rel="noopener noreferrer"
    aria-label="Falar com o escritório pelo WhatsApp — abre em nova aba">
    ${ICONES.whats}<span class="whatsapp-flutuante__texto">Fale no WhatsApp</span>
  </a>`;
}

function marca(classe = 'marca') {
  return `<span class="${classe}">
    <span class="marca__simbolo" aria-hidden="true">${MARCA_SIMBOLO}</span>
    <span class="marca__texto"><strong>Empregador</strong> em Dia</span>
  </span>`;
}

function cabecalho(atual = '', { progresso = false } = {}) {
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
    <a class="marca marca--link" href="/" aria-label="Empregador em Dia — página inicial">
      <span class="marca__simbolo" aria-hidden="true">${MARCA_SIMBOLO}</span>
      <span class="marca__texto"><strong>Empregador</strong> em Dia</span>
    </a>
    <nav class="navegacao" id="menu-principal" aria-label="Navegação principal">
      <ul>
        ${itens.map(([href, rotulo]) =>
          `<li><a href="${href}"${atual === href ? ' aria-current="page"' : ''}>${rotulo}</a></li>`
        ).join('\n        ')}
        <li class="navegacao__destaque"><a href="/contato/"${atual === '/contato/' ? ' aria-current="page"' : ''}>Contato</a></li>
      </ul>
    </nav>
    <button class="tema-botao" type="button" data-tema-alternar aria-label="Alternar entre tema claro e escuro">
      <span class="tema-botao__sol" aria-hidden="true">${ICONES.sol}</span>
      <span class="tema-botao__lua" aria-hidden="true">${ICONES.lua}</span>
    </button>
    <button class="menu-botao" type="button" aria-expanded="false" aria-controls="menu-principal">
      <span class="menu-botao__barras" aria-hidden="true"></span>
      <span class="sr">Abrir menu</span>
    </button>
  </div>
  ${progresso ? '<div class="progresso" aria-hidden="true"><span class="progresso__barra"></span></div>' : ''}
</header>`;
}

function chamadaContato(contexto = 'o site') {
  const msg = `Olá! Vim pelo site Empregador em Dia (${contexto}) e gostaria de orientação sobre uma questão trabalhista.`;
  return `<section class="faixa-contato">
  <div class="conteiner faixa-contato__grade">
    <div>
      <p class="faixa-contato__olho">Análise individualizada</p>
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
    <div class="rodape__bloco rodape__bloco--marca">
      ${marca('marca marca--rodape')}
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
    <p class="rodape__assinatura"><strong>${escapar(site.advogado.nome)}</strong> — ${escapar(site.advogado.oab)}</p>
    <p>Este site tem caráter exclusivamente informativo, nos termos do Provimento nº 205/2021 do Conselho Federal da OAB. O conteúdo aqui publicado não constitui consulta jurídica, não substitui a análise individualizada de cada caso e não implica garantia de qualquer resultado.</p>
    <p class="rodape__creditos">© ${anoAtual} Empregador em Dia · empregadoremdia.com.br · <a href="/publicar/">Área de publicação</a></p>
  </div>
</footer>`;
}

function pagina({
  titulo,
  descricao,
  corpo,
  caminho = '/',
  classe = '',
  tipo = 'website',
  dataArtigo = '',
  robots = '',
  progresso = false,
  scripts = '',
}) {
  const tituloCompleto = caminho === '/' ? `${titulo}` : `${titulo} · Empregador em Dia`;
  const canonica = `${site.url.replace(/\/$/, '')}${caminho}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(tituloCompleto)}</title>
<meta name="description" content="${escaparAtributo(descricao)}">
${robots ? `<meta name="robots" content="${escaparAtributo(robots)}">` : ''}
<link rel="canonical" href="${escaparAtributo(canonica)}">
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="Empregador em Dia">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${escaparAtributo(tituloCompleto)}">
<meta property="og:description" content="${escaparAtributo(descricao)}">
<meta property="og:url" content="${escaparAtributo(canonica)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1620" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/assets/icone.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&display=swap">
<link rel="stylesheet" href="/assets/estilo.css">
<script>try{var t=localStorage.getItem('eed-tema');if(t==='escuro'||t==='claro')document.documentElement.setAttribute('data-tema',t);}catch(e){}</script>
${dataArtigo ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titulo,
    description: descricao,
    datePublished: dataArtigo,
    dateModified: dataArtigo,
    inLanguage: 'pt-BR',
    author: { '@type': 'Person', name: site.advogado.nome },
    publisher: { '@type': 'Organization', name: 'Empregador em Dia' },
    mainEntityOfPage: canonica,
  })}</script>` : ''}
</head>
<body class="${[classe, site.whatsapp ? 'tem-whatsapp' : ''].filter(Boolean).join(' ')}">
${cabecalho(caminho, { progresso })}
<main id="principal">
${corpo}
</main>
${whatsappFlutuante()}
${rodape()}
<script src="/assets/site.js" defer></script>
${scripts}
</body>
</html>`;
}

function cartaoArtigo(artigo, { mostrarTrilha = false, filtravel = false } = {}) {
  const t = TRILHAS[artigo.trilha];
  const busca = `${artigo.titulo} ${artigo.descricao} ${artigo.assunto} ${t.nome}`.toLowerCase();
  const attrs = filtravel
    ? ` data-cartao data-trilha="${t.id}" data-busca="${escaparAtributo(busca)}"`
    : '';
  return `<article class="cartao"${attrs}>
  <div class="cartao__topo">
    ${mostrarTrilha
      ? `<span class="etiqueta etiqueta--${t.id}">${escapar(t.nome)}</span>`
      : (artigo.assunto ? `<span class="cartao__assunto">${escapar(artigo.assunto)}</span>` : '<span></span>')}
  </div>
  <h3><a href="${artigo.url}">${escapar(artigo.titulo)}</a></h3>
  <p>${escapar(artigo.descricao)}</p>
  <span class="cartao__meta">${ICONES.relogio}${artigo.leitura} min de leitura</span>
</article>`;
}

/* ------------------------------------------------------------------ *
 * páginas
 * ------------------------------------------------------------------ */

function paginaInicial(artigos) {
  const destaques = artigos.filter((a) => a.destaque).slice(0, 3);
  const maisRecente = artigos.map((a) => a.data).filter(Boolean).sort().pop();

  const porta = (t) => {
    const daTrilha = artigos.filter((a) => a.trilha === t.id);
    const assuntos = [...new Set(daTrilha.map((a) => a.assunto).filter(Boolean))];
    return `<a class="porta porta--${t.id}" href="${t.caminho}">
      <span class="porta__icone" aria-hidden="true">${t.icone}</span>
      <span class="porta__rotulo">${escapar(t.rotuloLongo)}</span>
      <span class="porta__resumo">${escapar(t.resumo)}</span>
      ${assuntos.length ? `<span class="porta__assuntos">${assuntos.map((s) => `<span>${escapar(s)}</span>`).join('')}</span>` : ''}
      <span class="porta__rodape">${daTrilha.length} ${daTrilha.length === 1 ? 'guia' : 'guias'} <span class="porta__seta" aria-hidden="true">${ICONES.seta}</span></span>
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
      <p class="capa__olho"><span class="ponto" aria-hidden="true"></span>Informação trabalhista para quem contrata</p>
      <h1>Estar em dia com a lei trabalhista começa por <em>entender</em> o que ela pede.</h1>
      <p class="capa__linha">A maior parte dos passivos trabalhistas não nasce de má-fé: nasce de obrigação desconhecida, prazo perdido ou registro mal feito. Este site reúne, em linguagem direta, o que a legislação exige de quem emprega.</p>
      <div class="capa__acoes">
        <a class="botao botao--principal" href="#trilhas">Ver as trilhas ${ICONES.seta}</a>
        <a class="botao botao--fantasma" href="/conteudo/">Todos os artigos</a>
      </div>
      <dl class="capa__numeros">
        <div><dt>Guias publicados</dt><dd>${artigos.length}</dd></div>
        <div><dt>Trilhas</dt><dd>2</dd></div>
        ${maisRecente ? `<div><dt>Última atualização</dt><dd class="capa__numeros__texto">${escapar(formatarMes(maisRecente))}</dd></div>` : ''}
      </dl>
    </div>
    <aside class="capa__cartao">
      <span class="capa__cartao__selo" aria-hidden="true">${ICONES.balanca}</span>
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
    <p class="secao__olho">Trilhas</p>
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
    <p class="secao__olho">Em pauta agora</p>
    <h2 class="secao__titulo">Temas com mudança recente</h2>
    <p class="secao__linha">Assuntos em que a norma ou a fiscalização mudaram e que pedem atenção imediata de quem contrata.</p>
    <div class="grade-cartoes">
      ${destaques.map((a) => cartaoArtigo(a, { mostrarTrilha: true })).join('\n      ')}
    </div>
  </div>
</section>` : ''}

<section class="secao">
  <div class="conteiner">
    <p class="secao__olho">Método</p>
    <h2 class="secao__titulo">Como o conteúdo é organizado</h2>
    <div class="grade-tres">
      <div class="bloco">
        <span class="bloco__icone" aria-hidden="true">${ICONES.livro}</span>
        <span class="bloco__numero">01</span>
        <h3>Obrigação por obrigação</h3>
        <p>Cada guia trata de uma exigência concreta: o que a lei determina, a quem se aplica, qual o prazo e o que costuma dar errado na prática.</p>
      </div>
      <div class="bloco">
        <span class="bloco__icone" aria-hidden="true">${ICONES.balanca}</span>
        <span class="bloco__numero">02</span>
        <h3>Com a norma à vista</h3>
        <p>Os textos indicam o dispositivo legal correspondente — CLT, LC 150/2015, NRs, leis específicas — para que você possa conferir a fonte.</p>
      </div>
      <div class="bloco">
        <span class="bloco__icone" aria-hidden="true">${ICONES.escudo}</span>
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
  const outra = trilha.id === 'empresa' ? TRILHAS.domestico : TRILHAS.empresa;

  return pagina({
    titulo: `Trilha ${trilha.nome}`,
    descricao: trilha.resumo,
    caminho: trilha.caminho,
    classe: `trilha trilha--${trilha.id}`,
    corpo: `
<section class="capa-trilha capa-trilha--${trilha.id}">
  <div class="conteiner capa-trilha__grade">
    <div>
      <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a> <span aria-hidden="true">/</span> <span>${escapar(trilha.nome)}</span></nav>
      <h1>${escapar(trilha.rotuloLongo)}</h1>
      <p class="capa-trilha__linha">${escapar(trilha.chamada)}</p>
      <p class="capa-trilha__conta">${daTrilha.length} ${daTrilha.length === 1 ? 'guia' : 'guias'} · ${porAssunto.size} ${porAssunto.size === 1 ? 'assunto' : 'assuntos'}</p>
    </div>
    <span class="capa-trilha__icone" aria-hidden="true">${trilha.icone}</span>
  </div>
</section>

<section class="secao">
  <div class="conteiner">
    ${daTrilha.length === 0
      ? '<p class="vazio">Os guias desta trilha estão sendo publicados.</p>'
      : [...porAssunto.entries()].map(([assunto, lista]) => `
    <div class="grupo">
      <h2 class="grupo__titulo">${escapar(assunto)} <span class="grupo__conta">${lista.length}</span></h2>
      <div class="grade-cartoes">
        ${lista.map((a) => cartaoArtigo(a)).join('\n        ')}
      </div>
    </div>`).join('\n')}

    <a class="troca-trilha" href="${outra.caminho}">
      <span class="troca-trilha__icone" aria-hidden="true">${outra.icone}</span>
      <span class="troca-trilha__texto">
        <strong>Não é o seu caso?</strong>
        Veja a trilha ${escapar(outra.rotuloCurto.toLowerCase())}.
      </span>
      <span class="troca-trilha__seta" aria-hidden="true">${ICONES.seta}</span>
    </a>
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
    <div class="filtros" data-filtros>
      <div class="filtros__busca">
        <span class="filtros__lupa" aria-hidden="true">${ICONES.busca}</span>
        <label class="sr" for="busca">Buscar no conteúdo</label>
        <input id="busca" type="search" placeholder="Buscar por assunto, obrigação ou norma…" autocomplete="off" data-busca>
      </div>
      <div class="filtros__botoes" role="group" aria-label="Filtrar por trilha">
        <button type="button" class="pilula" data-filtro="tudo" aria-pressed="true">Tudo</button>
        ${Object.values(TRILHAS).map((t) =>
          `<button type="button" class="pilula" data-filtro="${t.id}" aria-pressed="false">${escapar(t.rotuloCurto)}</button>`
        ).join('\n        ')}
      </div>
    </div>

    <p class="filtros__resultado" data-resultado role="status"></p>

    ${Object.values(TRILHAS).map((t) => {
      const lista = artigos.filter((a) => a.trilha === t.id);
      if (!lista.length) return '';
      return `<div class="grupo" data-grupo="${t.id}">
      <h2 class="grupo__titulo"><span class="etiqueta etiqueta--${t.id}">${escapar(t.nome)}</span> <span class="grupo__conta">${lista.length}</span></h2>
      <div class="grade-cartoes">
        ${lista.map((a) => cartaoArtigo(a, { filtravel: true })).join('\n        ')}
      </div>
    </div>`;
    }).join('\n')}

    <p class="vazio" data-vazio hidden>Nenhum guia corresponde à sua busca. Tente outro termo ou <a href="/contato/">fale com o escritório</a>.</p>
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

  const sumario = artigo.sumario.length > 2
    ? `<details class="sumario" data-sumario open>
        <summary class="sumario__titulo">Nesta página</summary>
        <ul>${artigo.sumario.map((s) => `<li><a href="#${escaparAtributo(s.id)}">${escapar(s.texto)}</a></li>`).join('')}</ul>
      </details>`
    : '';

  return pagina({
    titulo: artigo.titulo,
    descricao: artigo.descricao,
    caminho: artigo.url,
    classe: 'pagina-artigo',
    tipo: 'article',
    dataArtigo: artigo.data,
    progresso: true,
    corpo: `
<article class="artigo">
  <div class="conteiner conteiner--artigo artigo__cabeca">
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
      <span>${ICONES.relogio}${artigo.leitura} min de leitura</span>
    </p>
  </div>

  <div class="conteiner conteiner--artigo artigo__grade">
    <aside class="artigo__lateral">
      ${sumario}
      <div class="artigo__lateral__acao">
        <p>Dúvida sobre o seu caso?</p>
        ${botaoWhats(msg, 'Falar pelo WhatsApp', 'botao botao--principal botao--bloco')}
      </div>
    </aside>

    <div class="artigo__corpo prosa">
      ${artigo.html}

      <aside class="aviso-artigo">
        <span class="aviso-artigo__icone" aria-hidden="true">${ICONES.escudo}</span>
        <p><strong>Conteúdo informativo.</strong> Este texto explica a regra geral e não considera as particularidades da sua contratação, de norma coletiva aplicável ou de decisão específica do seu caso. Ele não substitui a análise individualizada.</p>
      </aside>

      <div class="artigo__acoes">
        ${botaoWhats(msg, 'Tratar da minha situação')}
        <a class="botao botao--secundario" href="/contato/">Enviar uma mensagem</a>
      </div>
    </div>
  </div>
</article>

${relacionados.length ? `<section class="secao secao--clara">
  <div class="conteiner">
    <p class="secao__olho">Continue lendo</p>
    <h2 class="secao__titulo">Mais da trilha ${escapar(t.nome)}</h2>
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
    <div class="fichas">
      <div class="ficha">
        <p class="ficha__nome">${escapar(a.nome)}</p>
        <p class="ficha__oab">${escapar(a.oab)}</p>
      </div>
    </div>

    <h2 id="finalidade">Para que serve este site</h2>
    <p>O Empregador em Dia reúne conteúdo técnico-informativo sobre as obrigações trabalhistas de quem contrata. A proposta é simples: quem emprega costuma descobrir a regra depois do problema, e boa parte do contencioso trabalhista tem origem em exigência ignorada, prazo perdido ou documentação frágil.</p>
    <p>Os textos tratam da norma em tese — o que a lei determina, a quem se aplica e como a obrigação se cumpre. São dirigidos tanto a empresas que contratam pela CLT quanto a famílias que empregam em casa, público que raramente encontra material organizado sobre o assunto.</p>

    <h2 id="limites">O que este site não é</h2>
    <p>Este site não presta consulta jurídica e não estabelece relação de patrocínio entre o leitor e o profissional aqui identificado. O conteúdo é geral e não considera as particularidades de cada contratação, de convenção ou acordo coletivo aplicável, nem de eventual processo em curso.</p>
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
  const formulario = `<form class="formulario" data-contato-form
      data-whatsapp="${escaparAtributo(site.whatsapp)}"
      data-email="${escaparAtributo(site.email)}" novalidate>
      <p class="formulario__introducao">Preencha os dados uma vez e escolha por qual canal deseja continuar. A mensagem será preparada no seu dispositivo para você revisar antes de enviar.</p>
      <div class="formulario__resumo-erros" data-contato-erros role="alert" tabindex="-1" hidden>
        <strong>Revise os campos indicados:</strong>
        <ul></ul>
      </div>
      <div class="campo">
        <label for="nome">Nome <span class="campo__obrigatorio">(obrigatório)</span></label>
        <input id="nome" name="nome" type="text" autocomplete="name" minlength="2" maxlength="100"
          aria-describedby="erro-nome" data-erro-vazio="Informe seu nome." data-erro-curto="Informe pelo menos 2 caracteres." required>
        <p class="campo__erro" id="erro-nome" hidden></p>
      </div>
      <div class="campo">
        <label for="email">E-mail <span class="campo__opcional">(opcional)</span></label>
        <input id="email" name="email" type="email" autocomplete="email" maxlength="160"
          aria-describedby="erro-email" data-erro-formato="Informe um e-mail válido, como nome@exemplo.com.">
        <p class="campo__erro" id="erro-email" hidden></p>
      </div>
      <div class="campo">
        <label for="telefone">Telefone <span class="campo__opcional">(opcional)</span></label>
        <input id="telefone" name="telefone" type="tel" autocomplete="tel-national" inputmode="numeric"
          maxlength="16" aria-describedby="erro-telefone"
          data-erro-curto="Telefone incompleto. Digite o DDD e os 9 dígitos do celular.">
        <p class="campo__erro" id="erro-telefone" hidden></p>
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
        <label for="mensagem">Sobre o que você precisa de orientação <span class="campo__obrigatorio">(obrigatório)</span></label>
        <textarea id="mensagem" name="mensagem" rows="6" minlength="10" maxlength="1200"
          aria-describedby="mensagem-dica erro-mensagem" data-erro-vazio="Escreva brevemente o motivo do contato."
          data-erro-curto="Escreva pelo menos 10 caracteres." required></textarea>
        <p class="campo__dica" id="mensagem-dica">Descreva apenas o tema e eventual prazo. Não envie documentos, senhas, dados médicos ou informações sigilosas neste primeiro contato.</p>
        <p class="campo__erro" id="erro-mensagem" hidden></p>
      </div>
      <input type="text" name="empresa" class="sr" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="formulario__nota">O site não armazena estes dados. Ao continuar, o WhatsApp ou o aplicativo de e-mail mostrará a mensagem pronta; ela só será enviada depois da sua confirmação. O contato não cria relação profissional.</p>
      <div class="formulario__acoes" aria-label="Escolha como continuar">
        ${site.whatsapp ? `<button class="botao botao--principal" type="submit" name="canal" value="whatsapp">${ICONES.whats}<span>Continuar no WhatsApp</span></button>` : ''}
        ${site.email ? `<button class="botao botao--secundario" type="submit" name="canal" value="email">${ICONES.email}<span>Continuar por e-mail</span></button>` : ''}
      </div>
      <p class="formulario__estado" data-contato-estado role="status" aria-live="polite" tabindex="-1"></p>
    </form>`;

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
        ${botaoWhats(msg, 'Abrir conversa', 'botao botao--principal botao--bloco')}
      </div>
      <div class="canal">
        <p class="canal__rotulo">E-mail</p>
        <p class="canal__valor">${ICONES.email}<a href="mailto:${escaparAtributo(site.email)}">${escapar(site.email)}</a></p>
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

function paginaPublicar(artigos) {
  const gh = site.github || {};
  const assuntos = [...new Set(artigos.map((a) => a.assunto).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const config = JSON.stringify({
    usuario: gh.usuario || '',
    repositorio: gh.repositorio || '',
    ramo: gh.ramo || 'main',
    pasta: 'conteudo/artigos',
    dominio: site.url.replace(/\/$/, ''),
    workflow: gh.workflow || 'publicar.yml',
  });

  const ferramenta = (acao, rotulo, dica) =>
    `<button type="button" class="ferramenta" data-md="${escaparAtributo(acao)}" title="${escaparAtributo(dica)}">${escapar(rotulo)}</button>`;

  return pagina({
    titulo: 'Publicar',
    descricao: 'Área de publicação de artigos do site Empregador em Dia.',
    caminho: '/publicar/',
    classe: 'pagina-publicar',
    robots: 'noindex, nofollow',
    scripts: `<script>window.EED = ${config};</script>
<script type="module" src="/assets/publicar.js"></script>`,
    corpo: `
<section class="painel">
  <div class="conteiner">

    <div class="painel__cabeca">
      <div>
        <p class="secao__olho">Área restrita</p>
        <h1>Publicar no site</h1>
        <p class="painel__linha">Escreva aqui e o artigo vai direto para o repositório. O site se reconstrói sozinho e fica no ar em um ou dois minutos.</p>
      </div>
      <div class="painel__conta" data-conta hidden>
        <img class="painel__avatar" data-avatar alt="" width="40" height="40">
        <div class="painel__conta__texto">
          <strong data-usuario></strong>
          <span data-repo></span>
        </div>
        <button type="button" class="botao botao--secundario botao--curto" data-sair>Sair</button>
      </div>
    </div>

    <div class="painel__caixa" data-tela="conexao">
      <h2>Conectar ao repositório</h2>
      <p class="painel__ajuda">O acesso é feito por um token pessoal do GitHub, guardado apenas neste navegador. Ele não passa por nenhum outro servidor: a página fala direto com o GitHub.</p>

      <details class="painel__passos">
        <summary>Como gerar o token (só na primeira vez)</summary>
        <ol>
          <li>Abra <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">github.com/settings/personal-access-tokens/new</a>.</li>
          <li>Em <strong>Repository access</strong>, escolha <em>Only select repositories</em> e marque <strong>${escapar(gh.repositorio || 'o repositório do site')}</strong>.</li>
          <li>Em <strong>Permissions → Repository permissions</strong>, coloque <strong>Contents</strong> em <em>Read and write</em> — é o que permite gravar o artigo.</li>
          <li>Na mesma lista, coloque <strong>Actions</strong> em <em>Read and write</em> — é o que permite reconstruir o site depois de gravar. Sem ela o texto entra no repositório, mas não vai ao ar.</li>
          <li>Defina a validade, gere e copie o token (começa com <code>github_pat_</code>).</li>
        </ol>
      </details>

      <form class="formulario" data-form-token>
        <div class="campo">
          <label for="token">Token de acesso</label>
          <input id="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required>
        </div>
        <label class="caixa-marcar">
          <input type="checkbox" data-lembrar>
          <span>Continuar conectado neste computador</span>
        </label>
        <p class="painel__aviso">Marque apenas em computador seu. Desmarcado, o token some quando a aba fechar. Em qualquer caso a sessão expira após 30 minutos sem uso, e o painel só aceita a sua conta do GitHub.</p>
        <button class="botao botao--principal" type="submit">Conectar</button>
      </form>
      <p class="painel__estado" data-estado-conexao role="status"></p>
    </div>

    <div data-tela="trabalho" hidden>

      <p class="painel__aviso painel__aviso--bloco" data-alerta-actions hidden></p>

      <div class="painel__barra">
        <div class="filtros__busca">
          <span class="filtros__lupa" aria-hidden="true">${ICONES.busca}</span>
          <label class="sr" for="busca-artigos">Buscar artigo</label>
          <input id="busca-artigos" type="search" placeholder="Buscar artigo…" autocomplete="off" data-busca-artigos>
        </div>
        <button type="button" class="botao botao--principal" data-novo>Novo artigo</button>
      </div>

      <div class="painel__lista" data-lista></div>

      <div class="painel__editor" data-editor hidden>
        <div class="painel__editor__topo">
          <h2 data-titulo-editor>Novo artigo</h2>
          <div class="painel__editor__abas">
            <button type="button" class="pilula" data-aba="escrever" aria-pressed="true">Escrever</button>
            <button type="button" class="pilula" data-aba="ver" aria-pressed="false">Pré-visualizar</button>
          </div>
        </div>

        <div class="painel__editor__grade" data-modo="escrever">
          <form class="painel__form" data-form-artigo>
            <div class="campo">
              <label for="a-titulo">Título</label>
              <input id="a-titulo" name="titulo" type="text" required maxlength="120">
            </div>

            <div class="campo">
              <label for="a-slug">Endereço da página</label>
              <div class="campo__prefixado">
                <span>/artigos/</span>
                <input id="a-slug" name="slug" type="text" required
                       pattern="[a-z0-9]+(-[a-z0-9]+)*"
                       title="Minúsculas, números e hífens entre palavras. Ex.: banco-de-horas"
                       spellcheck="false">
              </div>
              <p class="campo__dica">Só minúsculas, números e hífens. Depois de publicado, mudar isso quebra o link antigo.</p>
            </div>

            <div class="campo">
              <label for="a-descricao">Resumo</label>
              <textarea id="a-descricao" name="descricao" rows="2" required maxlength="220"></textarea>
              <p class="campo__dica">Uma frase. É o que aparece no Google e no cartão do artigo.</p>
            </div>

            <div class="painel__form__dupla">
              <div class="campo">
                <label for="a-trilha">Trilha</label>
                <select id="a-trilha" name="trilha" required>
                  ${Object.values(TRILHAS).map((t) => `<option value="${t.id}">${escapar(t.rotuloCurto)}</option>`).join('')}
                </select>
              </div>
              <div class="campo">
                <label for="a-assunto">Assunto</label>
                <input id="a-assunto" name="assunto" type="text" list="lista-assuntos" placeholder="Contratação">
                <datalist id="lista-assuntos">${assuntos.map((s) => `<option value="${escaparAtributo(s)}"></option>`).join('')}</datalist>
              </div>
            </div>

            <div class="painel__form__tripla">
              <div class="campo">
                <label for="a-data">Data de atualização</label>
                <input id="a-data" name="data" type="date" required>
              </div>
              <div class="campo">
                <label for="a-ordem">Ordem</label>
                <input id="a-ordem" name="ordem" type="number" min="1" max="99" value="9">
              </div>
              <div class="campo">
                <label for="a-destaque">Em pauta agora</label>
                <select id="a-destaque" name="destaque">
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </div>

            <div class="campo campo--texto">
              <label for="a-corpo">Texto do artigo</label>
              <div class="ferramentas">
                ${ferramenta('h2', 'Título', 'Título de seção (##)')}
                ${ferramenta('h3', 'Subtítulo', 'Subtítulo (###)')}
                ${ferramenta('negrito', 'B', 'Negrito')}
                ${ferramenta('italico', 'I', 'Itálico')}
                ${ferramenta('lista', 'Lista', 'Lista com marcadores')}
                ${ferramenta('numerada', '1.', 'Lista numerada')}
                ${ferramenta('link', 'Link', 'Inserir link')}
                ${ferramenta('tabela', 'Tabela', 'Inserir tabela')}
                <span class="ferramentas__sep" aria-hidden="true"></span>
                ${ferramenta('norma', 'Norma', 'Caixa "Onde conferir"')}
                ${ferramenta('atencao', 'Atenção', 'Caixa de alerta')}
                ${ferramenta('prazo', 'Prazo', 'Caixa de prazo')}
                ${ferramenta('dica', 'Dica', 'Caixa de dica')}
              </div>
              <textarea id="a-corpo" name="corpo" rows="24" spellcheck="true" required></textarea>
            </div>

            <div class="painel__acoes">
              <button class="botao botao--principal" type="submit" data-publicar>Publicar no site</button>
              <button class="botao botao--secundario" type="button" data-cancelar>Cancelar</button>
              <button class="botao botao--perigo" type="button" data-excluir hidden>Excluir artigo</button>
            </div>
            <p class="painel__estado" data-estado-artigo role="status"></p>
          </form>

          <div class="painel__previa">
            <p class="painel__previa__rotulo">Pré-visualização</p>
            <article class="previa prosa" data-previa></article>
          </div>
        </div>
      </div>
    </div>

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
    robots: 'noindex',
    corpo: `
<section class="secao secao--centro">
  <div class="conteiner conteiner--estreito">
    <p class="erro__codigo">404</p>
    <h1>Essa página não existe</h1>
    <p class="secao__linha secao__linha--centro">O endereço pode ter mudado ou o conteúdo pode ter sido reorganizado.</p>
    <div class="capa__acoes capa__acoes--centro">
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
  const publicas = [];

  const publicar = (rota, html) => { gravar(rota, html); rotas.push(rota); publicas.push(rota); };

  publicar('/', paginaInicial(artigos));
  for (const t of Object.values(TRILHAS)) publicar(t.caminho, paginaTrilha(t, artigos));
  publicar('/conteudo/', paginaConteudo(artigos));
  publicar('/sobre/', paginaSobre());
  publicar('/contato/', paginaContato());
  for (const artigo of artigos) publicar(artigo.url, paginaArtigo(artigo, artigos));

  // fora dos buscadores e fora do sitemap
  gravar('/publicar/', paginaPublicar(artigos)); rotas.push('/publicar/');
  gravar('404.html', pagina404());

  copiarPasta(DIR_ASSETS, path.join(DIR_SAIDA, 'assets'));

  const base = site.url.replace(/\/$/, '');
  const dataDe = (rota) => {
    const artigo = artigos.find((a) => a.url === rota);
    return artigo && artigo.data ? `<lastmod>${artigo.data}</lastmod>` : '';
  };
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicas.map((r) => `  <url><loc>${base}${r}</loc>${dataDe(r)}</url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIR_SAIDA, 'sitemap.xml'), sitemap, 'utf8');

  fs.writeFileSync(
    path.join(DIR_SAIDA, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /publicar/\n\nSitemap: ${base}/sitemap.xml\n`,
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
    '.mjs': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };

  createServer((req, res) => {
    const rota = decodeURIComponent(req.url.split('?')[0]);
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
