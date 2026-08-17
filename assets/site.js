// Empregador em Dia — comportamento mínimo do site.
(function () {
  'use strict';

  // Menu em telas pequenas
  var botao = document.querySelector('.menu-botao');
  var menu = document.getElementById('menu-principal');

  if (botao && menu) {
    botao.addEventListener('click', function () {
      var aberto = menu.classList.toggle('aberto');
      botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      botao.querySelector('.sr').textContent = aberto ? 'Fechar menu' : 'Abrir menu';
    });

    // fecha ao navegar ou ao apertar Esc
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('aberto');
        botao.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('aberto')) {
        menu.classList.remove('aberto');
        botao.setAttribute('aria-expanded', 'false');
        botao.focus();
      }
    });
  }
})();
