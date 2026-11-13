// Anti-clickjacking portátil: impede que a loja seja mostrada dentro de um iframe de outro site.
// Funciona em qualquer alojamento (o Cloudflare também envia X-Frame-Options: DENY).
(function () {
  if (window.top === window.self) return;
  document.documentElement.style.display = "none";
  try { window.top.location.replace(window.self.location.href); } catch (e) { /* iframe com sandbox: fica escondida */ }
})();
