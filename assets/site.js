// Empregador em Dia — comportamento do site.
// Sem dependências. Tudo é opcional: se um trecho não existir na página,
// o bloco correspondente simplesmente não roda.
(function () {
  'use strict';

  var raiz = document.documentElement;

  /* ---------------------------------------------------------------- *
   * menu em telas pequenas
   * ---------------------------------------------------------------- */

  var botaoMenu = document.querySelector('.menu-botao');
  var menu = document.getElementById('menu-principal');

  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', function () {
      var aberto = menu.classList.toggle('aberto');
      botaoMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      botaoMenu.querySelector('.sr').textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    });

    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('aberto');
        botaoMenu.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('aberto')) {
        menu.classList.remove('aberto');
        botaoMenu.setAttribute('aria-expanded', 'false');
        botaoMenu.focus();
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * tema claro / escuro
   * ---------------------------------------------------------------- */

  var botaoTema = document.querySelector('[data-tema-alternar]');

  if (botaoTema) {
    botaoTema.addEventListener('click', function () {
      var prefereEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var atual = raiz.getAttribute('data-tema') || (prefereEscuro ? 'escuro' : 'claro');
      var novo = atual === 'escuro' ? 'claro' : 'escuro';

      raiz.classList.add('trocando-tema');
      raiz.setAttribute('data-tema', novo);
      try { localStorage.setItem('eed-tema', novo); } catch (e) { /* sem armazenamento */ }

      // devolve as transições depois que o novo tema já foi pintado
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { raiz.classList.remove('trocando-tema'); });
      });
    });
  }

  /* ---------------------------------------------------------------- *
   * barra de progresso da leitura
   * ---------------------------------------------------------------- */

  var barra = document.querySelector('.progresso__barra');

  if (barra) {
    var corpoArtigo = document.querySelector('.artigo__corpo');
    var atualizarProgresso = function () {
      if (!corpoArtigo) return;
      var topo = corpoArtigo.offsetTop;
      var altura = corpoArtigo.offsetHeight - window.innerHeight;
      var andado = window.scrollY - topo;
      var pct = altura > 0 ? (andado / altura) * 100 : 0;
      barra.style.width = Math.min(100, Math.max(0, pct)) + '%';
    };
    var pedido = false;
    window.addEventListener('scroll', function () {
      if (pedido) return;
      pedido = true;
      window.requestAnimationFrame(function () { atualizarProgresso(); pedido = false; });
    }, { passive: true });
    window.addEventListener('resize', atualizarProgresso, { passive: true });
    atualizarProgresso();
  }

  /* ---------------------------------------------------------------- *
   * sumário do artigo: fechado no celular, seção ativa no desktop
   * ---------------------------------------------------------------- */

  var sumario = document.querySelector('[data-sumario]');

  if (sumario) {
    var telaLarga = window.matchMedia('(min-width: 1080px)');
    if (!telaLarga.matches) sumario.open = false;

    var links = Array.prototype.slice.call(sumario.querySelectorAll('a'));
    var alvos = links
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    if (alvos.length && 'IntersectionObserver' in window) {
      var visiveis = new Set();
      var marcar = function () {
        var ativo = alvos.filter(function (s) { return visiveis.has(s.id); })[0];
        links.forEach(function (a) {
          a.classList.toggle('ativo', !!ativo && a.getAttribute('href') === '#' + ativo.id);
        });
      };
      var observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) visiveis.add(e.target.id);
          else visiveis.delete(e.target.id);
        });
        marcar();
      }, { rootMargin: '-80px 0px -70% 0px' });
      alvos.forEach(function (s) { observador.observe(s); });
    }

    // no celular, escolher um item fecha o sumário
    sumario.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && !telaLarga.matches) sumario.open = false;
    });
  }

  /* ---------------------------------------------------------------- *
   * filtro da página "Todo o conteúdo"
   * ---------------------------------------------------------------- */

  var filtros = document.querySelector('[data-filtros]');

  if (filtros) {
    var campoBusca = filtros.querySelector('[data-busca]');
    var botoes = Array.prototype.slice.call(filtros.querySelectorAll('[data-filtro]'));
    var cartoes = Array.prototype.slice.call(document.querySelectorAll('[data-cartao]'));
    var grupos = Array.prototype.slice.call(document.querySelectorAll('[data-grupo]'));
    var resultado = document.querySelector('[data-resultado]');
    var semNada = document.querySelector('[data-vazio]');
    var trilhaAtiva = 'tudo';

    var semAcento = function (t) {
      return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    };

    var aplicar = function () {
      var termo = semAcento((campoBusca && campoBusca.value ? campoBusca.value : '').trim());
      var visiveis = 0;

      cartoes.forEach(function (c) {
        var casaTrilha = trilhaAtiva === 'tudo' || c.dataset.trilha === trilhaAtiva;
        var casaTermo = !termo || semAcento(c.dataset.busca || '').indexOf(termo) !== -1;
        var mostrar = casaTrilha && casaTermo;
        c.hidden = !mostrar;
        if (mostrar) visiveis++;
      });

      grupos.forEach(function (g) {
        var algum = g.querySelector('[data-cartao]:not([hidden])');
        g.hidden = !algum;
      });

      if (semNada) semNada.hidden = visiveis > 0;
      if (resultado) {
        if (!termo && trilhaAtiva === 'tudo') resultado.textContent = '';
        else resultado.textContent = visiveis === 1
          ? '1 guia encontrado.'
          : visiveis + ' guias encontrados.';
      }
    };

    botoes.forEach(function (b) {
      b.addEventListener('click', function () {
        trilhaAtiva = b.dataset.filtro;
        botoes.forEach(function (o) {
          o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
        });
        aplicar();
      });
    });

    if (campoBusca) campoBusca.addEventListener('input', aplicar);
    aplicar();
  }
})();
