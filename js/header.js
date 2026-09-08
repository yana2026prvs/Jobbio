/* Shared "screen header" chrome: the sticky compact bar that fades in its
   inline title (and a hairline/blur) once the page scrolls past the large
   title, plus a generic open/close helper for the header dropdowns
   (reminders panel on Plan, "Ще" menu on Skills). One scroll listener drives
   whichever page is currently visible, since all four pages share a single
   scroll container (js/nav.js resets it on every tab switch).
   Depends on: nothing (pure DOM chrome) — js/plan.js and js/skills.js call
   setupHeaderPanel() to wire their own dropdowns. */

var HEADER_SCROLL_THRESHOLD = 4;

function updateHeaderScrollState() {
  var screen = document.querySelector('.phone-screen');
  if (!screen) return;
  screen.classList.toggle('is-scrolled', screen.scrollTop > HEADER_SCROLL_THRESHOLD);
}

function closeAllHeaderPanels() {
  document.querySelectorAll('.header-panel, .header-menu').forEach(function (p) { p.hidden = true; });
  document.querySelectorAll('.sh-action[aria-expanded="true"]').forEach(function (b) {
    b.setAttribute('aria-expanded', 'false');
  });
}

function setupHeaderPanel(btn, panel, onOpen) {
  if (!btn || !panel) return;
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var opening = panel.hidden;
    closeAllHeaderPanels();
    panel.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    if (opening && typeof onOpen === 'function') onOpen();
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
}

document.addEventListener('click', closeAllHeaderPanels);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllHeaderPanels(); });

var phoneScreenForHeader = document.querySelector('.phone-screen');
if (phoneScreenForHeader) {
  phoneScreenForHeader.addEventListener('scroll', updateHeaderScrollState, { passive: true });
}
