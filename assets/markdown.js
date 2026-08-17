/**
 * Empregador em Dia — renderizador de Markdown.
 *
 * Este arquivo é usado nos dois lados:
 *   - pelo build.mjs, no Node, para gerar as páginas do site;
 *   - pelo painel /publicar/, no navegador, para a pré-visualização ao vivo.
 *
 * Ter uma implementação só garante que o que você vê ao escrever é
 * exatamente o que vai para o ar.
 */

export const escapar = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const escaparAtributo = (s = '') => escapar(s).replace(/'/g, '&#39;');

export function slugificar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ *
 * caixas de destaque
 * ------------------------------------------------------------------ */

const ICONE = {
  norma:
    '<path d="M12 3v18M7 21h10M12 6 5 9m7-3 7 3M5 9l-2.5 5a2.8 2.8 0 0 0 5 0L5 9Zm14 0-2.5 5a2.8 2.8 0 0 0 5 0L19 9Z"/>',
  atencao:
    '<path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  prazo:
    '<path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
  dica:
    '<path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8.9.9 1.5l.1.7h5.2l.1-.7c.1-.6.4-1.1.9-1.5A6 6 0 0 0 12 3Z"/>',
};

export const TIPOS_CAIXA = Object.keys(ICONE);

function svgCaixa(tipo) {
  const traco = ICONE[tipo] || ICONE.dica;
  return `<svg class="caixa__icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${traco}</svg>`;
}

/* ------------------------------------------------------------------ *
 * trechos dentro da linha
 * ------------------------------------------------------------------ */

export function inline(texto) {
  let saida = escapar(texto);

  // código `assim`
  saida = saida.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);

  // imagem ![alt](src) — antes do link, senão o link engole a sintaxe
  saida = saida.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) =>
      `<img src="${escaparAtributo(src)}" alt="${escaparAtributo(alt)}" loading="lazy" decoding="async">`
  );

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

/* ------------------------------------------------------------------ *
 * documento
 * ------------------------------------------------------------------ */

/**
 * Converte o subconjunto de Markdown aceito pelo site em HTML.
 * Devolve também o sumário formado pelos títulos de nível 2.
 */
export function markdown(fonte, opcoes = {}) {
  const usados = opcoes.usados || new Set();
  const linhas = String(fonte || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const sumario = [];
  let i = 0;

  const idUnico = (base) => {
    let id = base || 'secao';
    let n = 2;
    while (usados.has(id)) id = `${base}-${n++}`;
    usados.add(id);
    return id;
  };

  const ehTabela = (n) =>
    linhas[n]?.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(linhas[n + 1] || '');

  while (i < linhas.length) {
    const cru = linhas[i].trim();

    // linha em branco
    if (!cru) { i++; continue; }

    // separador
    if (/^(-{3,}|\*{3,})$/.test(cru)) { html.push('<hr>'); i++; continue; }

    // caixa de destaque:  ::: tipo Título
    const caixa = cru.match(/^:::\s*(\w+)\s*(.*)$/);
    if (caixa) {
      const [, tipoBruto, titulo] = caixa;
      const tipo = slugificar(tipoBruto) || 'dica';
      const dentro = [];
      i++;
      while (i < linhas.length && linhas[i].trim() !== ':::') { dentro.push(linhas[i]); i++; }
      i++; // pula o ::: de fechamento
      const { html: interno } = markdown(dentro.join('\n'), { usados });
      html.push(
        `<aside class="caixa caixa--${escaparAtributo(tipo)}">` +
        `<div class="caixa__cabeca">${svgCaixa(tipo)}` +
        (titulo ? `<p class="caixa__titulo">${inline(titulo)}</p>` : '') +
        `</div>` +
        `<div class="caixa__corpo">${interno}</div>` +
        `</aside>`
      );
      continue;
    }

    // títulos
    const titulo = cru.match(/^(#{2,4})\s+(.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      const texto = titulo[2].trim();
      const id = idUnico(slugificar(texto));
      if (nivel === 2) sumario.push({ id, texto });
      html.push(
        `<h${nivel} id="${escaparAtributo(id)}" class="ancorado">` +
        `${inline(texto)}` +
        `<a class="ancora" href="#${escaparAtributo(id)}" aria-label="Link para esta seção">#</a>` +
        `</h${nivel}>`
      );
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
        '<div class="tabela-rolagem" tabindex="0" role="region" aria-label="Tabela"><table><thead><tr>' +
        cabecalho.map((c) => `<th>${inline(c)}</th>`).join('') +
        '</tr></thead><tbody>' +
        corpo
          .map((l) =>
            `<tr>${l
              .map((c, n) => `<td data-rotulo="${escaparAtributo(cabecalho[n] || '')}">${inline(c)}</td>`)
              .join('')}</tr>`
          )
          .join('') +
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
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !/^(#{2,4}\s|[-*]\s|\d+[.)]\s|>|\||:::)/.test(linhas[i].trim()) &&
      !/^(-{3,}|\*{3,})$/.test(linhas[i].trim())
    ) {
      paragrafo.push(linhas[i].trim());
      i++;
    }
    if (paragrafo.length) html.push(`<p>${inline(paragrafo.join(' '))}</p>`);
    else i++;
  }

  return { html: html.join('\n'), sumario };
}

/* ------------------------------------------------------------------ *
 * front matter
 * ------------------------------------------------------------------ */

/**
 * Lê o cabeçalho entre --- e devolve { dados, corpo, arriscados }.
 *
 * "arriscados" lista campos que este gerador aceita mas que quebrariam num
 * editor de YAML estrito — dois-pontos ou caractere especial fora de aspas.
 */
export function lerFrontMatter(bruto) {
  const texto = String(bruto || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!texto.startsWith('---')) return { dados: {}, corpo: texto, arriscados: [] };

  const fim = texto.indexOf('\n---', 3);
  if (fim === -1) return { dados: {}, corpo: texto, arriscados: [] };

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
      arriscados.push(chave);
    }

    dados[chave] = valor;
  }
  return { dados, corpo, arriscados };
}

/** Monta o cabeçalho a partir de um objeto, escapando o que for preciso. */
export function escreverFrontMatter(dados, corpo) {
  const linhas = Object.entries(dados)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
    .map(([chave, valor]) => {
      const texto = String(valor).replace(/\r?\n/g, ' ').trim();
      if (/^\d+$/.test(texto) || /^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${chave}: ${texto}`;
      return `${chave}: "${texto.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    });
  return `---\n${linhas.join('\n')}\n---\n\n${String(corpo || '').trim()}\n`;
}

/** Estimativa de tempo de leitura, em minutos. */
export function tempoLeitura(texto) {
  const palavras = String(texto || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}
