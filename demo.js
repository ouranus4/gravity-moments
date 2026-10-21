/*
  Захист від копіювання (без видимих водяних знаків).
  Щоб прибрати — видаліть рядок <script src="demo.js" ...> з index.html і сам цей файл.
*/
(() => {
  const style = document.createElement('style');
  style.textContent = `
    img,video{-webkit-user-drag:none;user-select:none}
    body{-webkit-user-select:none;user-select:none}
    input,select,textarea{-webkit-user-select:text;user-select:text}
    @media print{body{display:none!important}}
  `;
  document.head.appendChild(style);

  const block = e => e.preventDefault();
  document.addEventListener('contextmenu', block);
  document.addEventListener('dragstart', e => { if (e.target.closest('img,video')) e.preventDefault(); });
  document.addEventListener('copy', block);
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(k)) e.preventDefault();
  });
})();
