/**
 * Empregador em Dia — painel de publicação (/publicar/).
 *
 * Escreve os arquivos .md direto no repositório pela API do GitHub.
 * O token fica só neste navegador; nenhuma outra máquina participa.
 * Depois do commit, o próprio GitHub Actions reconstrói e publica o site.
 */

import {
  markdown,
  escapar,
  slugificar,
  lerFrontMatter,
  escreverFrontMatter,
} from '/assets/markdown.js';

const CFG = window.EED || {};
const API = 'https://api.github.com';
const CHAVE_TOKEN = 'eed-token';
const CHAVE_RASCUNHO = 'eed-rascunho';

const TRILHAS = { empresa: 'Empresa', domestico: 'Doméstico' };

/* ------------------------------------------------------------------ *
 * atalhos
 * ------------------------------------------------------------------ */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const el = {
  telaConexao: $('[data-tela="conexao"]'),
  telaTrabalho: $('[data-tela="trabalho"]'),
  formToken: $('[data-form-token]'),
  campoToken: $('#token'),
  lembrar: $('[data-lembrar]'),
  estadoConexao: $('[data-estado-conexao]'),
  conta: $('[data-conta]'),
  avatar: $('[data-avatar]'),
  usuario: $('[data-usuario]'),
  repo: $('[data-repo]'),
  sair: $('[data-sair]'),
  lista: $('[data-lista]'),
  buscaArtigos: $('[data-busca-artigos]'),
  novo: $('[data-novo]'),
  editor: $('[data-editor]'),
  grade: $('[data-editor] .painel__editor__grade'),
  tituloEditor: $('[data-titulo-editor]'),
  form: $('[data-form-artigo]'),
  previa: $('[data-previa]'),
  estadoArtigo: $('[data-estado-artigo]'),
  cancelar: $('[data-cancelar]'),
  excluir: $('[data-excluir]'),
  publicar: $('[data-publicar]'),
  corpo: $('#a-corpo'),
};

const campos = {
  titulo: $('#a-titulo'),
  slug: $('#a-slug'),
  descricao: $('#a-descricao'),
  trilha: $('#a-trilha'),
  assunto: $('#a-assunto'),
  data: $('#a-data'),
  ordem: $('#a-ordem'),
  destaque: $('#a-destaque'),
  corpo: $('#a-corpo'),
};

/* estado da sessão */
let token = '';
let artigos = [];        // [{ nome, caminho, sha, dados, corpo }]
let editando = null;     // artigo em edição, ou null para um novo
let slugTocado = false;

/* ------------------------------------------------------------------ *
 * utilidades
 * ------------------------------------------------------------------ */

function deBase64(b64) {
  const binario = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario);
}

function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dizer(alvo, texto, tipo = '') {
  if (!alvo) return;
  alvo.textContent = texto;
  alvo.className = 'painel__estado' + (tipo ? ` painel__estado--${tipo}` : '');
}

/**
 * O token guardado vale por tempo limitado. Um token do GitHub com permissão de
 * escrita é uma chave do repositório: deixá-lo em localStorage sem prazo
 * significa que qualquer pessoa que sente depois nesta máquina publica no site.
 * A validade se renova a cada uso, então quem está trabalhando não é
 * interrompido — só expira mesmo quem parou.
 */
const VALIDADE_MS = 30 * 60 * 1000;

function guardarToken(valor, persistir) {
  const pacote = JSON.stringify({ t: valor, expira: Date.now() + VALIDADE_MS });
  try {
    (persistir ? localStorage : sessionStorage).setItem(CHAVE_TOKEN, pacote);
  } catch (e) { /* navegador sem armazenamento */ }
}

function lerTokenGuardado() {
  try {
    const bruto = localStorage.getItem(CHAVE_TOKEN) || sessionStorage.getItem(CHAVE_TOKEN);
    if (!bruto) return '';

    let pacote = null;
    try { pacote = JSON.parse(bruto); } catch (e) { pacote = null; }

    // Formato antigo (token cru, sem prazo) não é aceito: apaga e pede de novo.
    if (!pacote || typeof pacote.t !== 'string' || typeof pacote.expira !== 'number') {
      apagarToken();
      return '';
    }

    if (Date.now() > pacote.expira) {
      apagarToken();
      return '';
    }
    return pacote.t;
  } catch (e) { return ''; }
}

/** Estende o prazo do token já guardado, sem mudar de lugar de armazenamento. */
function renovarValidade() {
  try {
    for (const area of [localStorage, sessionStorage]) {
      const bruto = area.getItem(CHAVE_TOKEN);
      if (!bruto) continue;
      const pacote = JSON.parse(bruto);
      if (!pacote || typeof pacote.t !== 'string') continue;
      pacote.expira = Date.now() + VALIDADE_MS;
      area.setItem(CHAVE_TOKEN, JSON.stringify(pacote));
    }
  } catch (e) { /* sem armazenamento ou conteúdo inválido */ }
}

function apagarToken() {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
    sessionStorage.removeItem(CHAVE_TOKEN);
  } catch (e) { /* nada a fazer */ }
}

/* ------------------------------------------------------------------ *
 * chamadas ao GitHub
 * ------------------------------------------------------------------ */

async function gh(caminho, opcoes = {}) {
  const resposta = await fetch(API + caminho, {
    ...opcoes,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opcoes.headers || {}),
    },
  });

  if (resposta.status === 204) return null;

  let dados = null;
  try { dados = await resposta.json(); } catch (e) { dados = null; }

  if (!resposta.ok) {
    const erro = new Error((dados && dados.message) || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

function explicar(erro) {
  switch (erro.status) {
    case 401:
      return 'Token recusado. Ele pode ter expirado ou ter sido copiado incompleto.';
    case 403:
      return 'Sem permissão. Confira se o token dá acesso a este repositório com "Contents: Read and write".';
    case 404:
      return `Repositório ou pasta não encontrada (${CFG.usuario}/${CFG.repositorio}). Confira também se o token inclui este repositório.`;
    case 409:
      return 'O arquivo mudou no GitHub depois que você abriu esta página. Recarregue e tente de novo.';
    case 422:
      return 'O GitHub recusou os dados enviados: ' + erro.message;
    default:
      return erro.message || 'Não foi possível falar com o GitHub.';
  }
}

const caminhoDe = (slug) => `${CFG.pasta}/${slug}.md`;

async function conteudoDaPasta() {
  return gh(`/repos/${CFG.usuario}/${CFG.repositorio}/contents/${CFG.pasta}?ref=${CFG.ramo}`);
}

async function lerArquivo(caminho) {
  return gh(`/repos/${CFG.usuario}/${CFG.repositorio}/contents/${caminho}?ref=${CFG.ramo}`);
}

async function gravarArquivo(caminho, texto, mensagem, sha) {
  return gh(`/repos/${CFG.usuario}/${CFG.repositorio}/contents/${caminho}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: mensagem,
      content: paraBase64(texto),
      branch: CFG.ramo,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function apagarArquivo(caminho, sha, mensagem) {
  return gh(`/repos/${CFG.usuario}/${CFG.repositorio}/contents/${caminho}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: mensagem, sha, branch: CFG.ramo }),
  });
}

/**
 * Manda o GitHub reconstruir o site.
 *
 * Gravar o arquivo não basta: commits feitos pela API com token pessoal não
 * disparam o gatilho de "push" do workflow. Sem esta chamada, o artigo entra
 * no repositório e nunca chega ao ar. O workflow aceita `workflow_dispatch`
 * justamente para isso.
 */
async function pedirReconstrucao() {
  await gh(
    `/repos/${CFG.usuario}/${CFG.repositorio}/actions/workflows/${CFG.workflow}/dispatches`,
    { method: 'POST', body: JSON.stringify({ ref: CFG.ramo }) }
  );
}

/* ------------------------------------------------------------------ *
 * conexão
 * ------------------------------------------------------------------ */

async function conectar(valor, persistir) {
  token = valor.trim();
  dizer(el.estadoConexao, 'Verificando o token…', 'carregando');

  try {
    const usuario = await gh('/user');

    // O painel é de uma conta só. Sem esta checagem, qualquer token válido do
    // GitHub — de qualquer pessoa — abre a tela de trabalho; a gravação até
    // falharia depois, mas o conteúdo já teria sido listado e lido.
    const dono = String(CFG.usuario || '').toLowerCase();
    if (String(usuario.login || '').toLowerCase() !== dono) {
      const recusa = new Error(
        `Este painel pertence à conta ${CFG.usuario}. O token apresentado é da conta ${usuario.login}.`
      );
      recusa.status = 'conta';
      throw recusa;
    }

    const repo = await gh(`/repos/${CFG.usuario}/${CFG.repositorio}`);

    // Token só de leitura entra e parece funcionar, mas quebra na hora de
    // publicar — depois do artigo escrito. Melhor recusar na porta.
    if (!repo.permissions || !repo.permissions.push) {
      const recusa = new Error(
        'Este token abre o repositório, mas não pode gravar nele. Refaça o token com "Contents: Read and write".'
      );
      recusa.status = 'escrita';
      throw recusa;
    }

    if (persistir !== undefined) guardarToken(token, persistir);
    iniciarVigia();

    el.avatar.src = usuario.avatar_url || '';
    el.avatar.alt = `Foto de ${usuario.login}`;
    el.usuario.textContent = usuario.login;
    el.repo.textContent = `${CFG.usuario}/${CFG.repositorio}`;
    el.conta.hidden = false;
    el.telaConexao.hidden = true;
    el.telaTrabalho.hidden = false;
    dizer(el.estadoConexao, '');

    await carregarLista();
    await conferirPermissaoActions();
  } catch (erro) {
    token = '';
    // Token guardado que o GitHub recusa não serve mais para nada: apaga,
    // senão o erro reaparece a cada visita sem que ninguém saiba por quê.
    // O mesmo vale para token de outra conta — não vai passar a valer depois.
    if (erro.status === 401 || erro.status === 'conta') apagarToken();
    dizer(el.estadoConexao, explicar(erro), 'erro');
    el.telaConexao.hidden = false;
    el.telaTrabalho.hidden = true;
    el.conta.hidden = true;
  }
}

/**
 * Gravar e reconstruir são permissões diferentes. Um token só com "Contents"
 * publica no repositório e não leva nada ao ar — e o efeito só apareceria
 * depois, na forma de um artigo escrito que ninguém consegue ver.
 */
async function conferirPermissaoActions() {
  const alerta = $('[data-alerta-actions]');
  if (!alerta) return;
  try {
    await gh(`/repos/${CFG.usuario}/${CFG.repositorio}/actions/workflows/${CFG.workflow}`);
    alerta.hidden = true;
  } catch (erro) {
    alerta.innerHTML =
      'Este token grava artigos, mas não consegue reconstruir o site: falta a permissão ' +
      '<strong>Actions: Read and write</strong>. O que for publicado fica no repositório sem ir ao ar, ' +
      'até que a reconstrução seja iniciada na aba Actions do GitHub.';
    alerta.hidden = false;
  }
}

el.formToken.addEventListener('submit', (e) => {
  e.preventDefault();
  const valor = el.campoToken.value.trim();
  if (!valor) return;
  conectar(valor, el.lembrar.checked);
});

el.sair.addEventListener('click', () => {
  // Sair também descarta o rascunho: em máquina emprestada, o texto guardado
  // reapareceria inteiro para a próxima pessoa que abrisse a página.
  limparRascunho();
  encerrarSessao('Você saiu. O token e o rascunho foram apagados deste navegador.');
});

/* ------------------------------------------------------------------ *
 * expiração por inatividade
 * ------------------------------------------------------------------ */

let vigia = null;
let ultimaRenovacao = 0;

function encerrarSessao(mensagem) {
  apagarToken();
  token = '';
  pararVigia();
  el.campoToken.value = '';
  el.conta.hidden = true;
  el.telaTrabalho.hidden = true;
  el.telaConexao.hidden = false;
  dizer(el.estadoConexao, mensagem);
}

function pararVigia() {
  if (vigia) { clearInterval(vigia); vigia = null; }
}

/**
 * Confere de minuto em minuto se o prazo do token venceu. Só entra em ação
 * quando há token guardado — em navegador sem armazenamento (aba anônima com
 * tudo bloqueado) a sessão simplesmente dura enquanto a aba estiver aberta,
 * em vez de o vigia derrubar quem está trabalhando.
 */
function iniciarVigia() {
  pararVigia();
  if (!lerTokenGuardado()) return;
  vigia = setInterval(() => {
    if (!token) return;
    if (!lerTokenGuardado()) {
      encerrarSessao('Sessão encerrada por inatividade. Conecte-se novamente para continuar.');
    }
  }, 60 * 1000);
}

function marcarAtividade() {
  if (!token) return;
  const agora = Date.now();
  if (agora - ultimaRenovacao < 60 * 1000) return;
  ultimaRenovacao = agora;
  renovarValidade();
}

for (const evento of ['pointerdown', 'keydown']) {
  document.addEventListener(evento, marcarAtividade, { passive: true });
}

/* ------------------------------------------------------------------ *
 * lista de artigos
 * ------------------------------------------------------------------ */

const NAO_E_ARTIGO = /^(leia-me|readme|_)/i;

async function carregarLista() {
  el.lista.innerHTML = '<p class="painel__estado painel__estado--carregando">Carregando artigos…</p>';

  try {
    const itens = await conteudoDaPasta();
    const arquivos = (Array.isArray(itens) ? itens : []).filter(
      (i) => i.type === 'file' && i.name.endsWith('.md') && !NAO_E_ARTIGO.test(i.name)
    );

    artigos = await Promise.all(
      arquivos.map(async (arquivo) => {
        const detalhe = await lerArquivo(arquivo.path);
        const { dados, corpo } = lerFrontMatter(deBase64(detalhe.content));
        return {
          nome: arquivo.name,
          caminho: arquivo.path,
          sha: detalhe.sha,
          slug: arquivo.name.replace(/\.md$/, ''),
          dados,
          corpo,
        };
      })
    );

    artigos.sort((a, b) => String(b.dados.data || '').localeCompare(String(a.dados.data || '')));
    desenharLista();
  } catch (erro) {
    el.lista.innerHTML = `<p class="painel__estado painel__estado--erro">${escapar(explicar(erro))}</p>`;
  }
}

function desenharLista() {
  const termo = (el.buscaArtigos.value || '').trim().toLowerCase();
  const visiveis = artigos.filter((a) =>
    !termo || `${a.dados.titulo || ''} ${a.dados.assunto || ''} ${a.slug}`.toLowerCase().includes(termo)
  );

  if (!visiveis.length) {
    el.lista.innerHTML = `<p class="vazio">${
      artigos.length ? 'Nenhum artigo com esse termo.' : 'Ainda não há artigos publicados.'
    }</p>`;
    return;
  }

  el.lista.innerHTML = visiveis
    .map((a) => {
      const trilha = TRILHAS[a.dados.trilha] || '—';
      const classe = a.dados.trilha === 'domestico' ? 'domestico' : 'empresa';
      return `<div class="painel__item">
        <div class="painel__item__texto">
          <p class="painel__item__titulo">${escapar(a.dados.titulo || a.slug)}</p>
          <p class="painel__item__meta">
            <span class="etiqueta etiqueta--${classe}">${escapar(trilha)}</span>
            <span>${escapar(a.dados.assunto || 'sem assunto')}</span>
            <span>${escapar(a.dados.data || 'sem data')}</span>
            ${a.dados.destaque === 'sim' ? '<span>· em pauta</span>' : ''}
          </p>
        </div>
        <div class="painel__item__acoes">
          <a class="botao botao--secundario botao--curto" href="${CFG.dominio}/artigos/${encodeURIComponent(a.slug)}/" target="_blank" rel="noopener noreferrer">Ver</a>
          <button type="button" class="botao botao--principal botao--curto" data-editar="${escapar(a.slug)}">Editar</button>
        </div>
      </div>`;
    })
    .join('');
}

el.buscaArtigos.addEventListener('input', desenharLista);

el.lista.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-editar]');
  if (!botao) return;
  const artigo = artigos.find((a) => a.slug === botao.dataset.editar);
  if (artigo) abrirEditor(artigo);
});

/* ------------------------------------------------------------------ *
 * editor
 * ------------------------------------------------------------------ */

function abrirEditor(artigo) {
  editando = artigo || null;
  slugTocado = !!artigo;

  if (artigo) {
    el.tituloEditor.textContent = 'Editar artigo';
    campos.titulo.value = artigo.dados.titulo || '';
    campos.slug.value = artigo.slug;
    campos.descricao.value = artigo.dados.descricao || '';
    campos.trilha.value = TRILHAS[artigo.dados.trilha] ? artigo.dados.trilha : 'empresa';
    campos.assunto.value = artigo.dados.assunto || '';
    campos.data.value = artigo.dados.data || hoje();
    campos.ordem.value = artigo.dados.ordem || 9;
    campos.destaque.value = artigo.dados.destaque === 'sim' ? 'sim' : 'nao';
    campos.corpo.value = artigo.corpo;
    el.excluir.hidden = false;
  } else {
    el.tituloEditor.textContent = 'Novo artigo';
    el.form.reset();
    campos.data.value = hoje();
    campos.ordem.value = 9;
    el.excluir.hidden = true;

    const rascunho = recuperarRascunho();
    if (rascunho && confirm('Há um rascunho não publicado neste navegador. Quer continuar de onde parou?')) {
      Object.keys(campos).forEach((k) => { if (rascunho[k] !== undefined) campos[k].value = rascunho[k]; });
      slugTocado = true;
    }
  }

  el.editor.hidden = false;
  dizer(el.estadoArtigo, '');
  atualizarPrevia();
  el.editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  campos.titulo.focus();
}

function fecharEditor() {
  el.editor.hidden = true;
  editando = null;
  el.form.reset();
  el.previa.innerHTML = '';
  dizer(el.estadoArtigo, '');
}

el.novo.addEventListener('click', () => abrirEditor(null));
el.cancelar.addEventListener('click', () => {
  if (campos.corpo.value.trim() && !confirm('Descartar as alterações e fechar o editor?')) return;
  fecharEditor();
});

/* título gera o endereço enquanto o campo não for editado à mão */
campos.titulo.addEventListener('input', () => {
  if (!slugTocado) campos.slug.value = slugificar(campos.titulo.value).slice(0, 60);
  atualizarPrevia();
});
campos.slug.addEventListener('input', () => {
  slugTocado = true;
  campos.slug.value = slugificar(campos.slug.value);
});

['descricao', 'trilha', 'corpo'].forEach((k) => {
  campos[k].addEventListener('input', atualizarPrevia);
});

/* ------------------------------------------------------------------ *
 * pré-visualização (mesmo renderizador que gera o site)
 * ------------------------------------------------------------------ */

function atualizarPrevia() {
  const { html } = markdown(campos.corpo.value);
  const trilha = TRILHAS[campos.trilha.value] || '';
  const classe = campos.trilha.value === 'domestico' ? 'domestico' : 'empresa';
  el.previa.innerHTML =
    (campos.titulo.value
      ? `<span class="etiqueta etiqueta--${classe}">${escapar(trilha)}</span>
         <h1>${escapar(campos.titulo.value)}</h1>`
      : '') +
    (campos.descricao.value ? `<p class="artigo__resumo">${escapar(campos.descricao.value)}</p><hr>` : '') +
    html;

  guardarRascunho();
}

/* ------------------------------------------------------------------ *
 * rascunho local
 * ------------------------------------------------------------------ */

function guardarRascunho() {
  if (editando) return; // rascunho só para artigo novo
  try {
    const dados = {};
    Object.keys(campos).forEach((k) => { dados[k] = campos[k].value; });
    if (!dados.titulo && !dados.corpo) return;
    localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados));
  } catch (e) { /* sem armazenamento */ }
}

function recuperarRascunho() {
  try {
    const bruto = localStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    return (dados.titulo || dados.corpo) ? dados : null;
  } catch (e) { return null; }
}

function limparRascunho() {
  try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) { /* nada */ }
}

/* ------------------------------------------------------------------ *
 * barra de ferramentas do texto
 * ------------------------------------------------------------------ */

const MOLDES = {
  h2: { antes: '\n## ', depois: '\n', vazio: 'Título da seção' },
  h3: { antes: '\n### ', depois: '\n', vazio: 'Subtítulo' },
  negrito: { antes: '**', depois: '**', vazio: 'texto' },
  italico: { antes: '*', depois: '*', vazio: 'texto' },
  lista: { antes: '\n- ', depois: '\n', vazio: 'primeiro item' },
  numerada: { antes: '\n1. ', depois: '\n', vazio: 'primeiro item' },
  link: { antes: '[', depois: '](https://)', vazio: 'texto do link' },
  tabela: {
    bloco: '\n| Coluna | Coluna |\n| --- | --- |\n| valor | valor |\n',
  },
  norma: { bloco: '\n::: norma Onde conferir\nCLT, art. 000. Texto em [planalto.gov.br](https://www.planalto.gov.br).\n:::\n' },
  atencao: { bloco: '\n::: atencao Atenção\nO erro que costuma acontecer aqui.\n:::\n' },
  prazo: { bloco: '\n::: prazo Prazo\nA data ou o prazo que precisa ser cumprido.\n:::\n' },
  dica: { bloco: '\n::: dica Na prática\nUma orientação objetiva.\n:::\n' },
};

$$('[data-md]').forEach((botao) => {
  botao.addEventListener('click', () => {
    const molde = MOLDES[botao.dataset.md];
    if (!molde) return;

    const area = campos.corpo;
    const ini = area.selectionStart;
    const fim = area.selectionEnd;
    const selecionado = area.value.slice(ini, fim);
    let novoTexto;
    let cursorIni;
    let cursorFim;

    if (molde.bloco) {
      novoTexto = molde.bloco;
      cursorIni = ini + novoTexto.length;
      cursorFim = cursorIni;
    } else {
      const miolo = selecionado || molde.vazio;
      novoTexto = molde.antes + miolo + molde.depois;
      cursorIni = ini + molde.antes.length;
      cursorFim = cursorIni + miolo.length;
    }

    area.setRangeText(novoTexto, ini, fim, 'end');
    area.focus();
    area.setSelectionRange(cursorIni, cursorFim);
    atualizarPrevia();
  });
});

/* abas escrever / pré-visualizar (telas estreitas) */
$$('[data-aba]').forEach((botao) => {
  botao.addEventListener('click', () => {
    el.grade.dataset.modo = botao.dataset.aba;
    $$('[data-aba]').forEach((o) => o.setAttribute('aria-pressed', o === botao ? 'true' : 'false'));
  });
});

/* ------------------------------------------------------------------ *
 * publicar e excluir
 * ------------------------------------------------------------------ */

el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!el.form.reportValidity()) return;

  const slug = slugificar(campos.slug.value);
  if (!slug) {
    dizer(el.estadoArtigo, 'Defina o endereço da página.', 'erro');
    return;
  }

  const renomeando = editando && editando.slug !== slug;
  const conflito = artigos.find((a) => a.slug === slug && (!editando || editando.slug !== slug));
  if (conflito && !editando) {
    dizer(el.estadoArtigo, `Já existe um artigo em /artigos/${slug}/. Escolha outro endereço.`, 'erro');
    return;
  }
  if (renomeando && !confirm(
    `O endereço mudou de /artigos/${editando.slug}/ para /artigos/${slug}/.\n\n` +
    'O link antigo deixará de funcionar. Continuar?'
  )) return;

  const texto = escreverFrontMatter(
    {
      slug,
      titulo: campos.titulo.value.trim(),
      descricao: campos.descricao.value.trim(),
      trilha: campos.trilha.value,
      assunto: campos.assunto.value.trim(),
      data: campos.data.value,
      ordem: campos.ordem.value || '9',
      destaque: campos.destaque.value,
    },
    campos.corpo.value
  );

  el.publicar.disabled = true;
  dizer(el.estadoArtigo, 'Enviando para o GitHub…', 'carregando');

  try {
    const mensagem = editando
      ? `Atualiza artigo: ${campos.titulo.value.trim()}`
      : `Publica artigo: ${campos.titulo.value.trim()}`;

    await gravarArquivo(
      caminhoDe(slug),
      texto,
      mensagem,
      editando && !renomeando ? editando.sha : undefined
    );

    if (renomeando) {
      await apagarArquivo(editando.caminho, editando.sha, `Remove endereço antigo: ${editando.slug}`);
    }

    let reconstruindo = true;
    try { await pedirReconstrucao(); } catch (e) { reconstruindo = false; }

    limparRascunho();
    mostrarSucesso(slug, !!editando, reconstruindo);
    await carregarLista();
  } catch (erro) {
    dizer(el.estadoArtigo, explicar(erro), 'erro');
  } finally {
    el.publicar.disabled = false;
  }
});

function mostrarSucesso(slug, atualizacao, reconstruindo) {
  dizer(el.estadoArtigo, '');
  const antigo = $('.painel__resumo-publicado');
  if (antigo) antigo.remove();

  const acoes = `<p>
      <a href="https://github.com/${CFG.usuario}/${CFG.repositorio}/actions" target="_blank" rel="noopener noreferrer">Acompanhar a publicação</a>
      ·
      <a href="${CFG.dominio}/artigos/${encodeURIComponent(slug)}/" target="_blank" rel="noopener noreferrer">Abrir a página</a>
    </p>`;

  const caixa = document.createElement('div');
  caixa.className = reconstruindo
    ? 'painel__resumo-publicado'
    : 'painel__resumo-publicado painel__resumo-publicado--parcial';
  caixa.innerHTML = reconstruindo
    ? `<p><strong>${atualizacao ? 'Alteração enviada.' : 'Artigo enviado.'}</strong> O site está sendo reconstruído — leva de um a dois minutos.</p>${acoes}`
    : `<p><strong>${atualizacao ? 'Alteração gravada.' : 'Artigo gravado.'}</strong> O texto já está no repositório, mas não foi possível iniciar a reconstrução do site — ele continua no ar na versão anterior.</p>
       <p>Isso acontece quando o token não tem a permissão <strong>Actions: Read and write</strong>. Gere um token novo com essa permissão, ou abra a aba Actions do repositório e clique em <em>Run workflow</em> para publicar agora.</p>${acoes}`;
  el.estadoArtigo.after(caixa);
  caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

el.excluir.addEventListener('click', async () => {
  if (!editando) return;
  if (!confirm(
    `Excluir definitivamente "${editando.dados.titulo || editando.slug}"?\n\n` +
    'A página sai do ar na próxima publicação. O arquivo continua no histórico do GitHub.'
  )) return;

  el.excluir.disabled = true;
  dizer(el.estadoArtigo, 'Excluindo…', 'carregando');

  try {
    await apagarArquivo(editando.caminho, editando.sha, `Remove artigo: ${editando.dados.titulo || editando.slug}`);

    let reconstruindo = true;
    try { await pedirReconstrucao(); } catch (e) { reconstruindo = false; }

    fecharEditor();
    await carregarLista();
    dizer(
      el.estadoArtigo,
      reconstruindo
        ? 'Artigo excluído. O site está sendo reconstruído.'
        : 'Artigo excluído do repositório, mas a reconstrução não foi iniciada — o token precisa da permissão Actions: Read and write.',
      reconstruindo ? 'ok' : 'erro'
    );
  } catch (erro) {
    dizer(el.estadoArtigo, explicar(erro), 'erro');
  } finally {
    el.excluir.disabled = false;
  }
});

/* ------------------------------------------------------------------ *
 * início
 * ------------------------------------------------------------------ */

if (!CFG.usuario || !CFG.repositorio) {
  dizer(
    el.estadoConexao,
    'Falta preencher o bloco "github" em conteudo/site.json (usuário e repositório).',
    'erro'
  );
} else {
  const guardado = lerTokenGuardado();
  if (guardado) conectar(guardado);
}

window.addEventListener('beforeunload', (e) => {
  if (!el.editor.hidden && campos.corpo.value.trim() && editando) {
    e.preventDefault();
    e.returnValue = '';
  }
});
