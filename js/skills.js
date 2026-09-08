/* Skills page: default checklist, built from a frequency analysis of 7 vacancies. */

var SKILLS_KEY = 'job-skills-v1';
var SKILLS = [
  { id: 's1', title: 'Figma як система, не полотно', freq: '6 з 7',
    desc: 'Auto layout, component properties, variants, variables, team libraries. На співбесіді просять показати структуру файлу: чи компонент перевикористовується і не ламається при зміні контенту.' },
  { id: 's2', title: 'Портфоліо з процесом', freq: '5 з 7',
    desc: 'Для кожного кейсу — бізнес-задача, розглянуті альтернативи й чому відкинуті, результат. Перевіряють питанням "а чому не інакше" по конкретному екрану.' },
  { id: 's3', title: 'Робота в чужій дизайн-системі', freq: '5 з 7',
    desc: 'Розширення existing-системи без порушення її правил, а не створення з нуля. Типове питання — ситуація, коли компонент не покривав задачу.' },
  { id: 's4', title: 'Mobile окремо від "адаптивності"', freq: '5 з 7',
    desc: 'Конкретно iOS Human Interface Guidelines і Android Material: touch-target 44pt/48dp, жести, нативні патерни навігації (tab bar проти sidebar).' },
  { id: 's5', title: 'User flows і дослідницьке мислення', freq: '5 з 7',
    desc: 'Уміння побудувати шлях користувача до екранів, а не навпаки. Перевіряють проханням намалювати flow для незнайомого сценарію.' },
  { id: 's6', title: 'Аргументація рішень перед бізнесом', freq: '4 з 7',
    desc: 'Структура: контекст → варіанти → чому цей → трейдофф → що зробила б інакше. Перевіряють витримку при незгоді співрозмовника.' },
  { id: 's7', title: 'iOS/Android guideline-нюанси', freq: '3 з 7',
    desc: 'Safe area, gesture navigation, platform-specific компоненти. Часто перевіряють усно, без макета.' },
  { id: 's8', title: 'Стани інтерфейсу як системна робота', freq: '2 з 7 · діра', flag: 'Найбільша діра',
    desc: 'Loading, empty, error, validation, disabled, conflict — задокументовані для всього компонента, а не для одного екрана. Жоден готовий кейс поки цього явно не показує.' },
  { id: 's9', title: 'Складні дані: таблиці, календарі, фільтри', freq: '2 з 7 · діра', flag: 'Найбільша діра',
    desc: 'Проєктування календарів записів, таблиць клієнтів, фільтрів і форм на малому екрані — переструктурування, а не стиснення desktop-сітки.' }
];

var skillState = {};
function loadSkills() {
  try {
    var raw = localStorage.getItem(SKILLS_KEY);
    skillState = raw ? JSON.parse(raw) : {};
  } catch (e) { skillState = {}; }
}
function saveSkills() {
  try { localStorage.setItem(SKILLS_KEY, JSON.stringify(skillState)); } catch (e) {}
}
function getSkillStatus(id) { return skillState[id] || 'queue'; }

function skillCardEl(s) {
  var el = document.createElement('article');
  el.className = 'skill-card';

  var top = document.createElement('div');
  top.className = 'skill-top';
  var body = document.createElement('div');
  if (s.flag) {
    var f = document.createElement('span');
    f.className = 'flag';
    f.textContent = s.flag;
    body.appendChild(f);
  }
  var title = document.createElement('div');
  title.className = 'skill-title';
  title.textContent = s.title;
  body.appendChild(title);
  top.appendChild(body);
  var freq = document.createElement('span');
  freq.className = 'skill-freq';
  freq.textContent = s.freq;
  top.appendChild(freq);
  el.appendChild(top);

  var desc = document.createElement('p');
  desc.className = 'skill-desc';
  desc.textContent = s.desc;
  el.appendChild(desc);

  var seg = document.createElement('div');
  seg.className = 'skill-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Рівень впевненості: ' + s.title);
  [{ id: 'queue', label: 'Не впевнена' }, { id: 'doing', label: 'Розвиваю' }, { id: 'done', label: 'Впевнена' }].forEach(function (opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = opt.id;
    btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(getSkillStatus(s.id) === opt.id));
    btn.addEventListener('click', function () {
      skillState[s.id] = opt.id;
      saveSkills();
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === opt.id));
      });
    });
    seg.appendChild(btn);
  });
  el.appendChild(seg);

  return el;
}

function renderSkills() {
  var list = document.getElementById('skillsList');
  list.innerHTML = '';
  SKILLS.forEach(function (s) { list.appendChild(skillCardEl(s)); });
}

/* ---------- header: "оновлено {дата}" timestamp for the default analysis ---------- */
var SKILLS_ANALYSIS_UPDATED_KEY = 'job-skills-analysis-updated-v1';
var UA_MONTHS_GENITIVE = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

function todayDateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatUaDateShort(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + ' ' + UA_MONTHS_GENITIVE[d.getMonth()];
}
function getSkillsAnalysisUpdated() {
  var stored;
  try { stored = localStorage.getItem(SKILLS_ANALYSIS_UPDATED_KEY); } catch (e) { stored = null; }
  if (!stored) {
    stored = todayDateStr();
    try { localStorage.setItem(SKILLS_ANALYSIS_UPDATED_KEY, stored); } catch (e) {}
  }
  return stored;
}
function setSkillsAnalysisUpdatedNow() {
  try { localStorage.setItem(SKILLS_ANALYSIS_UPDATED_KEY, todayDateStr()); } catch (e) {}
}

/* ---------- header actions: "Оновити аналіз" + "Ще" menu ---------- */
document.getElementById('skillsRefreshBtn').addEventListener('click', function () {
  setSkillsAnalysisUpdatedNow();
  renderSkillsHeader();
});

function exportSkillsAnalysis() {
  var lines = ['Навички — аналіз за вакансіями', 'Оновлено: ' + formatUaDateShort(getSkillsAnalysisUpdated()), ''];
  var LEVEL_LABEL = { queue: 'Не впевнена', doing: 'Розвиваю', done: 'Впевнена' };
  SKILLS.forEach(function (s) {
    lines.push('— ' + s.title + ' (' + s.freq + ') — ' + LEVEL_LABEL[getSkillStatus(s.id)]);
  });
  var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'navychky-analiz.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('skillsReplacePlanItem').addEventListener('click', function () {
  closeAllHeaderPanels();
  openPlanSheet();
});
document.getElementById('skillsExportAnalysisItem').addEventListener('click', function () {
  closeAllHeaderPanels();
  exportSkillsAnalysis();
});
setupHeaderPanel(document.getElementById('skillsMoreBtn'), document.getElementById('skillsMoreMenu'));

document.getElementById('skillsEmptyGoToAppsBtn').addEventListener('click', function () {
  showPage('apps');
});
