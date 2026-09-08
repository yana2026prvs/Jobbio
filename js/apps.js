/* Applications (job-application tracker): stages/funnel, cards, filters, add-form.
   Depends on: js/plan.js (deadlineInfo, renderCalendar/updateNotifyDot), js/header.js
   (showToast, for the "Відгук додано" confirmation), js/utils.js (pluralize,
   formatUaDateShort), js/learning-plan.js (renderSkillsPageContent, since the
   Skills empty state's "3+ applications" threshold depends on apps.length). */

var APPS_KEY = 'job-applications-v1';
/* The single stage dictionary. "rejected" is deliberately excluded from
   FUNNEL_STAGES below: it can happen after any of the other four, and since
   only the current stage is tracked (no history), counting it cumulatively
   into "test"/"interview"/"offer" would overstate how far those applications
   actually got — a rejected application only reliably counts as "sent". */
var STAGES = [
  { id: 'sent', label: 'Надіслано' },
  { id: 'test', label: 'Тестове' },
  { id: 'interview', label: 'Співбесіда' },
  { id: 'offer', label: 'Оффер' },
  { id: 'rejected', label: 'Відмова' }
];
var FUNNEL_STAGES = STAGES.slice(0, 4);
function stageIndex(id) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
  return 0;
}
function funnelStageIndex(id) {
  if (id === 'rejected') return 0;
  for (var i = 0; i < FUNNEL_STAGES.length; i++) if (FUNNEL_STAGES[i].id === id) return i;
  return 0;
}
var apps = [];
function loadApps() {
  try {
    var raw = localStorage.getItem(APPS_KEY);
    apps = raw ? JSON.parse(raw) : [];
  } catch (e) { apps = []; }
  apps.forEach(function (a) {
    if (!a.stage) a.stage = 'sent';
    if (a.stage === 'replied') a.stage = 'sent'; // "Відповіли" retired from the stage dictionary
    if (a.position === undefined) a.position = '';
    if (a.deadline === undefined) a.deadline = '';
    if (!a.source) a.source = sourceFromUrl(a.link);
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
  if (!url) return 'company';
  try {
    var host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'djinni.co') return 'djinni';
    if (host.endsWith('linkedin.com')) return 'linkedin';
  } catch (e) {}
  return 'company';
}

var SOURCE_META = {
  djinni:   { label: 'Djinni',        cls: 'src-djinni' },
  linkedin: { label: 'LinkedIn',       cls: 'src-linkedin' },
  company:  { label: 'Сайт компанії',  cls: 'src-company' },
  referral: { label: 'Рекомендація',   cls: 'src-referral' }
};
function sourceMeta(src) { return SOURCE_META[src] || null; }

/* The app's creation timestamp is embedded in its id ('a' + Date.now()) —
   used to compute how many days it's been since applying, for the "Без
   відповіді N днів" silence line. */
function daysSinceCreated(a) {
  var match = /^a(\d+)/.exec(a.id);
  if (!match) return null;
  var createdMs = Number(match[1]);
  return createdMs ? Math.floor((Date.now() - createdMs) / 86400000) : null;
}
var SILENCE_THRESHOLD_DAYS = 7;

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
  if (a.position) {
    var position = document.createElement('div');
    position.className = 'app-position';
    position.textContent = a.position;
    topLeft.appendChild(position);
  }
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

  var stageChip = document.createElement('span');
  stageChip.className = 'app-stage-chip stage-' + a.stage;
  stageChip.textContent = STAGES[stageIndex(a.stage)].label;
  el.appendChild(stageChip);

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
    if (a.deadline) {
      var info = deadlineInfo(a.deadline);
      dlLabel.textContent = 'Наступний крок: ' + formatUaDateShort(a.deadline);
      dlLabel.classList.toggle('is-urgent', !!(info && info.urgent));
      return;
    }
    var days = a.stage === 'sent' ? daysSinceCreated(a) : null;
    if (days !== null && days >= SILENCE_THRESHOLD_DAYS) {
      dlLabel.textContent = 'Без відповіді ' + days + ' ' + pluralize(days, ['день', 'дні', 'днів']);
      dlLabel.classList.add('is-urgent');
    } else {
      dlLabel.textContent = 'Наступний крок';
      dlLabel.classList.remove('is-urgent');
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
      stageChip.className = 'app-stage-chip stage-' + a.stage;
      stageChip.textContent = s.label;
      refreshDeadlineLabel();
      renderAppsFunnel();
    });
    seg.appendChild(btn);
  });
  el.appendChild(seg);

  return el;
}

function renderAppsFunnel() {
  var counts = FUNNEL_STAGES.map(function (stage, i) {
    return apps.filter(function (a) { return funnelStageIndex(a.stage) >= i; }).length;
  });
  var base = counts[0] || 0;
  var wrap = document.getElementById('appsFunnel');
  wrap.innerHTML = '';
  FUNNEL_STAGES.forEach(function (stage, i) {
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
  if (appsFilter.source !== 'all' && a.source !== appsFilter.source) return false;
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
  var usedSources = {};
  apps.forEach(function (a) { if (sourceMeta(a.source)) usedSources[a.source] = true; });
  var wrap = document.getElementById('appsSourceFilter');
  var hasVariety = Object.keys(usedSources).length > 1;
  wrap.hidden = !hasVariety;
  if (!hasVariety && appsFilter.source !== 'all') {
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
  return apps.filter(function (a) { return a.stage === 'test' || a.stage === 'interview'; }).length;
}

function renderAppsHeader() {
  var subtitle = document.getElementById('appsSubtitle');
  if (!subtitle) return;
  var total = apps.length;
  subtitle.textContent = total + ' ' + pluralize(total, ['компанія', 'компанії', 'компаній']) +
    ' · ' + appsInProgressCount() + ' в роботі';
}

var APPS_FILTER_MIN = 5;
function renderApps() {
  var hasAny = apps.length > 0;
  document.getElementById('appsEmptyState').hidden = hasAny;
  document.getElementById('appsFunnel').hidden = !hasAny;
  document.querySelector('#apps .apps-filter').hidden = apps.length < APPS_FILTER_MIN;
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
var appStageSelect = document.getElementById('appStage');
var appSourceSelect = document.getElementById('appSource');
var appCompanyInput = document.getElementById('appCompany');
var appCompanyError = document.getElementById('appCompanyError');
var appLinkInput = document.getElementById('appLink');
var appSourceTouched = false;

STAGES.forEach(function (s) {
  var opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = s.label;
  appStageSelect.appendChild(opt);
});
Object.keys(SOURCE_META).forEach(function (id) {
  var opt = document.createElement('option');
  opt.value = id;
  opt.textContent = SOURCE_META[id].label;
  appSourceSelect.appendChild(opt);
});
appSourceSelect.addEventListener('change', function () { appSourceTouched = true; });
appLinkInput.addEventListener('input', function () {
  if (!appSourceTouched) appSourceSelect.value = sourceFromUrl(appLinkInput.value.trim());
});

function openAppForm() {
  appForm.hidden = false;
  appCompanyInput.focus();
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
function resetAppForm() {
  appForm.reset();
  appForm.hidden = true;
  appCompanyError.hidden = true;
  appSourceSelect.value = 'company';
  appSourceTouched = false;
}
document.getElementById('appCancelBtn').addEventListener('click', resetAppForm);
appForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var company = appCompanyInput.value.trim();
  if (!company) {
    appCompanyError.hidden = false;
    appCompanyInput.focus();
    return;
  }
  appCompanyError.hidden = true;
  var newApp = {
    id: 'a' + Date.now(),
    company: company,
    position: document.getElementById('appPosition').value.trim(),
    link: appLinkInput.value.trim(),
    desc: document.getElementById('appDesc').value.trim(),
    stage: appStageSelect.value || 'sent',
    source: appSourceSelect.value || 'company',
    deadline: document.getElementById('appDeadline').value
  };
  apps.push(newApp);
  saveApps();
  resetAppForm();
  renderApps();
  showToast('Відгук додано', 'Скасувати', function () {
    apps = apps.filter(function (x) { return x.id !== newApp.id; });
    saveApps();
    renderApps();
  });
});
