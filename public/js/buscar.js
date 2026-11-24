// Buscador Pagefind: funciona dentro del navegador y no envía las búsquedas a ningún servidor.
window.addEventListener('DOMContentLoaded', function () {
  if (!window.PagefindUI) return;
  var ui = new window.PagefindUI({ element: '#buscador', showSubResults: true, showImages: false });
  var consulta = new URLSearchParams(window.location.search).get('q');
  if (consulta) ui.triggerSearch(consulta);
});
