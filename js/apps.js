/* Applications (job-application tracker): stages/funnel, cards, filters, add-form.
   Depends on: js/plan.js (deadlineInfo, saveDeadlines-adjacent renderCalendar/updateNotifyDot). */

var APPS_KEY = 'job-applications-v1';
var STAGES = [
  { id: 'sent', label: 'Надіслано' },
  { id: 'replied', label: 'Відповіли' },
  { id: 'interview', label: 'Співбесіда' },
  { id: 'offer', label: 'Офер' }
];
function stageIndex(id) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
  return 0;
}
var apps = [];
function loadApps() {
  try {
    var raw = localStorage.getItem(APPS_KEY);
    apps = raw ? JSON.parse(raw) : [];
  } catch (e) { apps = []; }
  apps.forEach(function (a) {
    if (!a.stage) a.stage = a.status === 'replied' ? 'replied' : 'sent';
    if (a.deadline === undefined) a.deadline = '';
    if (!a.source) a.source = 'manual';
  });
}
function saveApps() {
  try { localStorage.setItem(APPS_KEY, JSON.stringify(apps)); } catch (e) {}
  updateNotifyDot();
  renderCalendar();
  renderSkillsPageContent();
}

function shortLink(url) {
  try {
    var u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch (e) { return url; }
}

function sourceFromUrl(url) {
  if (!url) return 'manual';
  try {
    var host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'djinni.co') return 'djinni';
    if (host.endsWith('linkedin.com')) return 'linkedin';
    if (host === 'dou.ua') return 'dou';
    if (host === 'work.ua' || host === 'rabota.ua') return 'work';
  } catch (e) {}
  return 'manual';
}

var SOURCE_META = {
  djinni:  { label: 'Djinni',   cls: 'src-djinni' },
  linkedin: { label: 'LinkedIn', cls: 'src-linkedin' },
  dou:     { label: 'DOU',      cls: 'src-dou' },
  work:    { label: 'Work.ua',  cls: 'src-work' }
};
function sourceMeta(src) { return SOURCE_META[src] || null; }

function appCardEl(a) {
  var el = document.createElement('article');
  el.className = 'app-card';
  el.dataset.id = a.id;

  var top = document.createElement('div');
  top.className = 'app-top';
  var topLeft = document.createElement('div');
  topLeft.className = 'app-card-left';
  var name = document.createElement('div');
  name.className = 'app-company';
  name.textContent = a.company;
  topLeft.appendChild(name);
  var sm = sourceMeta(a.source);
  if (sm) {
    var badge = document.createElement('span');
    badge.className = 'app-source-badge ' + sm.cls;
    badge.textContent = sm.label;
    topLeft.appendChild(badge);
  }
  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'app-del';
  del.setAttribute('aria-label', 'Видалити');
  del.textContent = '×';
  del.addEventListener('click', function () {
    apps = apps.filter(function (x) { return x.id !== a.id; });
    saveApps();
    renderApps();
  });
  top.appendChild(topLeft);
  top.appendChild(del);
  el.appendChild(top);

  if (a.link) {
    var link = document.createElement('a');
    link.className = 'app-link';
    link.href = a.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '🔗 ' + shortLink(a.link);
    el.appendChild(link);
  }

  if (a.desc) {
    var d = document.createElement('p');
    d.className = 'app-desc';
    d.textContent = a.desc;
    el.appendChild(d);
  }

  var deadlineRow = document.createElement('div');
  deadlineRow.className = 'app-deadline';
  var dlLabel = document.createElement('span');
  dlLabel.className = 'app-deadline-label';
  var dlInput = document.createElement('input');
  dlInput.type = 'date';
  dlInput.value = a.deadline || '';
  function refreshDeadlineLabel() {
    var info = deadlineInfo(a.deadline);
    if (!info) {
      dlLabel.textContent = 'Дедлайн';
      dlLabel.classList.remove('is-urgent');
    } else {
      dlLabel.textContent = (info.urgent ? '🔥 ' : '📅 ') + info.text;
      dlLabel.classList.toggle('is-urgent', info.urgent);
    }
  }
  refreshDeadlineLabel();
  dlInput.addEventListener('change', function () {
    a.deadline = dlInput.value;
    saveApps();
    refreshDeadlineLabel();
  });
  deadlineRow.appendChild(dlLabel);
  deadlineRow.appendChild(dlInput);
  el.appendChild(deadlineRow);

  var seg = document.createElement('div');
  seg.className = 'app-seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Етап: ' + a.company);
  STAGES.forEach(function (s) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = s.id;
    btn.textContent = s.label;
    btn.setAttribute('aria-pressed', String(a.stage === s.id));
    btn.addEventListener('click', function () {
      a.stage = s.id;
      saveApps();
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === s.id));
      });
      renderAppsFunnel();
    });
    seg.appendChild(btn);
  });
  el.appendChild(seg);

  return el;
}

function renderAppsFunnel() {
  var counts = STAGES.map(function (stage, i) {
    return apps.filter(function (a) { return stageIndex(a.stage) >= i; }).length;
  });
  var base = counts[0] || 0;
  var wrap = document.getElementById('appsFunnel');
  wrap.innerHTML = '';
  STAGES.forEach(function (stage, i) {
    var row = document.createElement('div');
    row.className = 'funnel-row';

    var topRow = document.createElement('div');
    topRow.className = 'funnel-top';
    var name = document.createElement('span');
    name.className = 'funnel-name';
    name.textContent = stage.label;
    var count = document.createElement('span');
    count.className = 'funnel-count';
    count.textContent = String(counts[i]);
    topRow.appendChild(name);
    topRow.appendChild(count);
    row.appendChild(topRow);

    var track = document.createElement('div');
    track.className = 'funnel-bar-track';
    var fill = document.createElement('div');
    fill.className = 'funnel-bar-fill';
    fill.style.width = (base ? Math.round(counts[i] / base * 100) : 0) + '%';
    track.appendChild(fill);
    row.appendChild(track);

    if (i > 0) {
      var conv = document.createElement('div');
      conv.className = 'funnel-conv';
      conv.textContent = counts[i - 1] ? 'Конверсія з попереднього етапу: ' + Math.round(counts[i] / counts[i - 1] * 100) + '%' : 'Немає даних';
      row.appendChild(conv);
    }

    wrap.appendChild(row);
  });
}

var appsFilter = { search: '', stage: 'all', source: 'all' };
function matchesFilter(a) {
  if (appsFilter.stage !== 'all' && a.stage !== appsFilter.stage) return false;
  if (appsFilter.source !== 'all' && (a.source || 'manual') !== appsFilter.source) return false;
  if (appsFilter.search && a.company.toLowerCase().indexOf(appsFilter.search) === -1) return false;
  return true;
}
function buildStageFilterChips() {
  var wrap = document.getElementById('appsStageFilter');
  var options = [{ id: 'all', label: 'Всі' }].concat(STAGES);
  options.forEach(function (opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = opt.id;
    btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(appsFilter.stage === opt.id));
    btn.addEventListener('click', function () {
      appsFilter.stage = opt.id;
      wrap.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === opt.id));
      });
      renderApps();
    });
    wrap.appendChild(btn);
  });
}
function buildSourceFilterChips() {
  var wrap = document.getElementById('appsSourceFilter');
  var sources = Object.keys(SOURCE_META).map(function (k) {
    return { id: k, label: SOURCE_META[k].label };
  });
  var options = [{ id: 'all', label: 'Всі джерела' }].concat(sources);
  options.forEach(function (opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = opt.id;
    btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(appsFilter.source === opt.id));
    btn.addEventListener('click', function () {
      appsFilter.source = opt.id;
      wrap.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === opt.id));
      });
      renderApps();
    });
    wrap.appendChild(btn);
  });
}
function refreshSourceFilter() {
  var usedSources = apps.reduce(function (acc, a) {
    var s = a.source || 'manual';
    if (s !== 'manual') acc[s] = true;
    return acc;
  }, {});
  var wrap = document.getElementById('appsSourceFilter');
  var hasNonManual = Object.keys(usedSources).length > 0;
  wrap.hidden = !hasNonManual;
  if (!hasNonManual && appsFilter.source !== 'all') {
    appsFilter.source = 'all';
    wrap.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.key === 'all'));
    });
  }
}

document.getElementById('appsSearch').addEventListener('input', function (e) {
  appsFilter.search = e.target.value.trim().toLowerCase();
  renderApps();
});

function appsInProgressCount() {
  return apps.filter(function (a) {
    var idx = stageIndex(a.stage);
    return idx > 0 && idx < STAGES.length - 1;
  }).length;
}

function renderAppsHeader() {
  var subtitle = document.getElementById('appsSubtitle');
  if (!subtitle) return;
  var total = apps.length;
  subtitle.textContent = total + ' ' + pluralize(total, ['компанія', 'компанії', 'компаній']) +
    ' · ' + appsInProgressCount() + ' в роботі';
}

function renderApps() {
  var hasAny = apps.length > 0;
  document.getElementById('appsEmptyState').hidden = hasAny;
  document.getElementById('appsFunnel').hidden = !hasAny;
  document.querySelector('#apps .apps-filter').hidden = !hasAny;
  document.getElementById('appAddBtn').hidden = !hasAny;

  renderAppsFunnel();
  refreshSourceFilter();
  renderAppsHeader();
  var list = document.getElementById('appsList');
  list.innerHTML = '';
  var filtered = apps.filter(matchesFilter);
  filtered.forEach(function (a) { list.appendChild(appCardEl(a)); });

  var emptyEl = document.getElementById('appsEmpty');
  var showSearchEmpty = hasAny && filtered.length === 0;
  emptyEl.hidden = !showSearchEmpty;
  if (showSearchEmpty) {
    emptyEl.querySelector('.bfe-text').textContent = appsFilter.search
      ? 'Нічого не знайшлося за «' + appsFilter.search + '». Перевір назву або очисти фільтри.'
      : 'Нічого не знайшлося за цим фільтром. Спробуй очистити фільтри.';
  }
}

var appForm = document.getElementById('appForm');
function openAppForm() {
  appForm.hidden = false;
  document.getElementById('appCompany').focus();
}
document.getElementById('appAddBtn').addEventListener('click', openAppForm);
document.getElementById('appAddHeaderBtn').addEventListener('click', openAppForm);
document.getElementById('appsEmptyAddBtn').addEventListener('click', openAppForm);
document.getElementById('appsClearFiltersBtn').addEventListener('click', function () {
  appsFilter = { search: '', stage: 'all', source: 'all' };
  document.getElementById('appsSearch').value = '';
  document.getElementById('appsStageFilter').querySelectorAll('button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.key === 'all'));
  });
  document.getElementById('appsSourceFilter').querySelectorAll('button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.key === 'all'));
  });
  renderApps();
});
document.getElementById('appCancelBtn').addEventListener('click', function () {
  appForm.reset();
  appForm.hidden = true;
});
appForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var company = document.getElementById('appCompany').value.trim();
  if (!company) return;
  var link = document.getElementById('appLink').value.trim();
  var desc = document.getElementById('appDesc').value.trim();
  var deadline = document.getElementById('appDeadline').value;
  apps.push({ id: 'a' + Date.now(), company: company, link: link, desc: desc, stage: 'sent', deadline: deadline, source: sourceFromUrl(link) });
  saveApps();
  appForm.reset();
  appForm.hidden = true;
  renderApps();
});
