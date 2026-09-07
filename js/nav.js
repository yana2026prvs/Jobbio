/* Bottom-nav page switching between Plan / Apps / Skills / Profile. */

var pages = { plan: document.getElementById('plan'), apps: document.getElementById('apps'), skills: document.getElementById('skills'), profile: document.getElementById('profile') };
var navBtns = { plan: document.getElementById('navPlan'), apps: document.getElementById('navApps'), skills: document.getElementById('navSkills'), profile: document.getElementById('navProfile') };
function showPage(key) {
  Object.keys(pages).forEach(function (k) {
    pages[k].hidden = k !== key;
    navBtns[k].setAttribute('aria-current', String(k === key));
  });
  pages[key].closest('.phone-screen').scrollTop = 0;
}
navBtns.plan.addEventListener('click', function () { showPage('plan'); });
navBtns.apps.addEventListener('click', function () { showPage('apps'); });
navBtns.skills.addEventListener('click', function () { showPage('skills'); });
navBtns.profile.addEventListener('click', function () { showPage('profile'); });
