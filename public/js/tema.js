// Modo claro por defecto. Si la persona elige el oscuro, se recuerda solo en su navegador.
(function () {
  var raiz = document.documentElement;
  var guardado = null;
  try { guardado = localStorage.getItem('tema'); } catch (e) {}
  if (guardado === 'oscuro') raiz.setAttribute('data-theme', 'dark');

  function pintarBoton(boton) {
    var oscuro = raiz.getAttribute('data-theme') === 'dark';
    boton.setAttribute('aria-pressed', oscuro ? 'true' : 'false');
    boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var boton = document.getElementById('boton-tema');
    if (!boton) return;
    pintarBoton(boton);
    boton.addEventListener('click', function () {
      var oscuro = raiz.getAttribute('data-theme') === 'dark';
      if (oscuro) {
        raiz.removeAttribute('data-theme');
        try { localStorage.setItem('tema', 'claro'); } catch (e) {}
      } else {
        raiz.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('tema', 'oscuro'); } catch (e) {}
      }
      pintarBoton(boton);
    });
  });
})();
