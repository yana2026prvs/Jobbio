/* Plan page: task statuses/deadlines, the phase/week/task board, the deadline
   calendar and hero summary card, and the status quick-filter.
   Depends on: js/utils.js (escapeHtml, truncateText), js/plan-data.js (WEEKBLOCKS,
   PHASE_ORDER, PHASE_SPANS, ALL_TASKS).
   taskEl()/getStatus()-shaped "store" objects are also used by js/learning-plan.js
   to render the learning-plan board with the same card markup. */

var STATE_KEY = 'job-plan-statuses-v1';

var STATUSES = [
  { id: 'queue', label: 'В черзі' },
  { id: 'doing', label: 'В роботі' },
  { id: 'done',  label: 'Готово'  }
];

var DEADLINES_KEY = 'job-plan-deadlines-v1';
var deadlines = {};
function loadDeadlines() {
  try {
    var raw = localStorage.getItem(DEADLINES_KEY);
    deadlines = raw ? JSON.parse(raw) : {};
  } catch (e) { deadlines = {}; }
}
function saveDeadlines() {
  try { localStorage.setItem(DEADLINES_KEY, JSON.stringify(deadlines)); } catch (e) {}
  updateNotifyDot();
  renderCalendar();
}

function deadlineInfo(dateStr) {
  if (!dateStr) return null;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var d = new Date(dateStr + 'T00:00:00');
  var diffDays = Math.round((d - today) / 86400000);
  var text;
  if (diffDays < 0) text = 'Прострочено на ' + Math.abs(diffDays) + ' дн.';
  else if (diffDays === 0) text = 'Сьогодні';
  else if (diffDays === 1) text = 'Завтра';
  else text = 'Через ' + diffDays + ' дн.';
  return { urgent: diffDays <= 2, text: text };
}

function updateNotifyDot() {
  var hasUrgent = false;
  ALL_TASKS.forEach(function (t) {
    if (hasUrgent || getStatus(t.id) === 'done') return;
    var info = deadlineInfo(deadlines[t.id]);
    if (info && info.urgent) hasUrgent = true;
  });
  if (!hasUrgent) {
    apps.forEach(function (a) {
      if (hasUrgent) return;
      var info = deadlineInfo(a.deadline);
      if (info && info.urgent) hasUrgent = true;
    });
  }
  if (!hasUrgent && !isDefaultLearningPlan()) {
    getActiveLearningPlan().allTasks.forEach(function (t) {
      if (hasUrgent || getLearningStatus(t.id) === 'done') return;
      var info = deadlineInfo(learningDeadlines[learningPlanKey(t.id)]);
      if (info && info.urgent) hasUrgent = true;
    });
  }
  document.querySelectorAll('.notify-dot').forEach(function (dot) { dot.hidden = !hasUrgent; });
}

var state = {};
function loadPlanState() {
  try {
    var raw = localStorage.getItem(STATE_KEY);
    state = raw ? JSON.parse(raw) : {};
  } catch (e) { state = {}; }
}
function savePlanState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
}
function getStatus(id) { return state[id] || 'queue'; }
function setStatus(id, s) {
  state[id] = s; savePlanState(); renderOverview(); updateNotifyDot();
  renderCalendar(); renderHeroCard(); applyStatusFilter();
}
var jobStore = {
  getStatus: getStatus,
  setStatus: setStatus,
  getDeadline: function (id) { return deadlines[id] || ''; },
  setDeadline: function (id, val) { if (val) deadlines[id] = val; else delete deadlines[id]; saveDeadlines(); },
  getItemChecked: function (id, i) { return state[id + '__c' + i] === true; },
  setItemChecked: function (id, i, checked) { state[id + '__c' + i] = checked; savePlanState(); }
};

function taskEl(t, store) {
  var el = document.createElement('article');
  el.className = 'task';
  el.dataset.id = t.id;
  el.dataset.status = store.getStatus(t.id);

  var head = document.createElement('div');
  head.className = 'task-head';

  var sum = document.createElement('span');
  sum.className = 'detail-btn-wrap';

  var body = document.createElement('div');
  if (t.flag) {
    var f = document.createElement('span');
    f.className = 'flag';
    f.textContent = t.flag;
    body.appendChild(f);
  }
  var title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = t.title;
  body.appendChild(title);
  head.appendChild(body);

  var detailBtn = document.createElement('span');
  detailBtn.className = 'detail-btn';
  detailBtn.textContent = 'Деталі';
  sum.appendChild(detailBtn);
  head.appendChild(sum);
  el.appendChild(head);

  var chip = document.createElement('span');
  chip.className = 'task-deadline';
  chip.hidden = true;
  el.appendChild(chip);

  function refreshChip() {
    var info = deadlineInfo(store.getDeadline(t.id));
    if (!info) { chip.hidden = true; return; }
    var urgent = info.urgent && store.getStatus(t.id) !== 'done';
    chip.hidden = false;
    chip.classList.toggle('is-urgent', urgent);
    chip.textContent = (urgent ? '🔥 ' : '📅 ') + info.text;
  }
  refreshChip();

  var d = null, r = null;
  if (t.desc) {
    d = document.createElement('p');
    d.className = 'task-desc';
    d.textContent = t.desc;
    el.appendChild(d);
  }
  var cl = null;
  if (t.checklist && t.checklist.length) {
    cl = document.createElement('ul');
    cl.className = 'task-checklist';
    cl.hidden = true;
    t.checklist.forEach(function (item, i) {
      var li = document.createElement('li');
      li.className = 'tc-item';
      var checked = store.getItemChecked(t.id, i);
      li.dataset.checked = String(checked);
      var box = document.createElement('button');
      box.type = 'button';
      box.className = 'tc-box';
      box.setAttribute('aria-pressed', String(checked));
      box.setAttribute('aria-label', item);
      var span = document.createElement('span');
      span.className = 'tc-text';
      span.textContent = item;
      box.addEventListener('click', function () {
        var next = !store.getItemChecked(t.id, i);
        store.setItemChecked(t.id, i, next);
        li.dataset.checked = String(next);
        box.setAttribute('aria-pressed', String(next));
      });
      li.appendChild(box);
      li.appendChild(span);
      cl.appendChild(li);
    });
    el.appendChild(cl);
  }

  if (t.result) {
    r = document.createElement('p');
    r.className = 'task-result';
    r.hidden = true;
    r.innerHTML = '<b>Результат:</b> ';
    r.appendChild(document.createTextNode(t.result));
    el.appendChild(r);
  }

  var deadlineEdit = document.createElement('div');
  deadlineEdit.className = 'task-deadline-edit';
  deadlineEdit.hidden = true;
  var dLabel = document.createElement('label');
  dLabel.appendChild(document.createTextNode('Дедлайн'));
  var dInput = document.createElement('input');
  dInput.type = 'date';
  dInput.value = store.getDeadline(t.id);
  dInput.addEventListener('change', function () {
    store.setDeadline(t.id, dInput.value);
    refreshChip();
  });
  dLabel.appendChild(dInput);
  var dClear = document.createElement('button');
  dClear.type = 'button';
  dClear.className = 'tde-clear';
  dClear.textContent = 'Прибрати';
  dClear.addEventListener('click', function () {
    dInput.value = '';
    store.setDeadline(t.id, '');
    refreshChip();
  });
  deadlineEdit.appendChild(dLabel);
  deadlineEdit.appendChild(dClear);
  el.appendChild(deadlineEdit);

  if (d || r || cl) {
    sum.addEventListener('click', function () {
      var opening = !sum.classList.contains('is-open');
      if (r) r.hidden = !opening;
      if (cl) cl.hidden = !opening;
      if (d) d.classList.toggle('is-expanded', opening);
      deadlineEdit.hidden = !opening;
      sum.classList.toggle('is-open', opening);
    });
  }

  var seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Статус: ' + t.title);
  STATUSES.forEach(function (s) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = s.id;
    btn.textContent = s.label;
    btn.setAttribute('aria-pressed', String(store.getStatus(t.id) === s.id));
    btn.addEventListener('click', function () {
      el.dataset.status = s.id;
      store.setStatus(t.id, s.id);
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === s.id));
      });
      refreshChip();
    });
    seg.appendChild(btn);
  });
  el.appendChild(seg);

  return el;
}

function renderBoard() {
  var board = document.getElementById('board');
  board.innerHTML = '';
  var lastPhase = null;
  WEEKBLOCKS.forEach(function (block, blockIndex) {
    if (block.phase !== lastPhase) {
      var head = document.createElement('div');
      head.className = 'phase-head';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = block.phase;
      var span = document.createElement('span');
      span.className = 'span';
      span.textContent = PHASE_SPANS[block.phase] || '';
      head.appendChild(name);
      head.appendChild(span);
      board.appendChild(head);
      lastPhase = block.phase;
    }
    var wrap = document.createElement('div');
    wrap.className = 'week-block';
    wrap.dataset.blockIndex = String(blockIndex);
    var h2 = document.createElement('h2');
    h2.textContent = block.label;
    wrap.appendChild(h2);
    var list = document.createElement('div');
    list.className = 'task-list';
    block.tasks.forEach(function (t) { list.appendChild(taskEl(t, jobStore)); });
    wrap.appendChild(list);
    board.appendChild(wrap);
  });
}

function renderOverview() {
  var ov = document.getElementById('overview');
  ov.innerHTML = '';
  PHASE_ORDER.forEach(function (phase, i) {
    var tasks = ALL_TASKS.filter(function (t) {
      return WEEKBLOCKS.some(function (b) { return b.phase === phase && b.tasks.indexOf(t) !== -1; });
    });
    var done = tasks.filter(function (t) { return getStatus(t.id) === 'done'; }).length;
    var card = document.createElement('div');
    card.className = 'ov-card' + (done === tasks.length ? ' ov-complete' : '');
    card.dataset.phase = String(i);
    card.innerHTML =
      '<div class="ov-name">' + phase + '</div>' +
      '<div class="ov-progress"><span class="ov-count">' + done + '/' + tasks.length + '</span><span class="ov-check">✓</span></div>';
    ov.appendChild(card);
  });
}

/* ---------- deadline calendar + hero summary card (Plan page) ---------- */
var MONTH_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

function deadlineStateForDate(dateStr) {
  var matchTasks = ALL_TASKS.filter(function (t) { return deadlines[t.id] === dateStr; });
  var matchApps = (apps || []).filter(function (a) { return a.deadline === dateStr; });
  if (!matchTasks.length && !matchApps.length) return null;
  var allDone = matchApps.length === 0 && matchTasks.length > 0 &&
    matchTasks.every(function (t) { return getStatus(t.id) === 'done'; });
  return allDone ? 'resolved' : 'pending';
}

function scrollToDeadlineDate(dateStr) {
  var task = ALL_TASKS.filter(function (t) { return deadlines[t.id] === dateStr; })[0];
  if (!task) return;
  var blockIndex = -1;
  WEEKBLOCKS.some(function (b, i) {
    if (b.tasks.indexOf(task) !== -1) { blockIndex = i; return true; }
    return false;
  });
  if (blockIndex === -1) return;
  var target = document.querySelector('.week-block[data-block-index="' + blockIndex + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCalendar() {
  var cal = document.getElementById('deadlineCalendar');
  if (!cal) return;
  cal.innerHTML = '';

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayStr = toDateStr(today);

  var allDeadlineDates = ALL_TASKS.map(function (t) { return deadlines[t.id]; })
    .concat((apps || []).map(function (a) { return a.deadline; }))
    .filter(Boolean);
  var rangeDays = 30;
  allDeadlineDates.forEach(function (ds) {
    var d = new Date(ds + 'T00:00:00');
    var diff = Math.round((d - today) / 86400000);
    if (diff > 0) rangeDays = Math.max(rangeDays, Math.min(diff + 2, 91));
  });

  var todayPill = null;
  for (var i = 0; i < rangeDays; i++) {
    var d = new Date(today);
    d.setDate(d.getDate() + i);
    var dateStr = toDateStr(d);
    var state = deadlineStateForDate(dateStr);
    var isToday = dateStr === todayStr;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    if (isToday) btn.dataset.today = 'true';
    if (state) btn.dataset.deadline = state;
    var monthLabel = d.getDate() === 1 ? '<span class="cal-month">' + MONTH_SHORT[d.getMonth()] + '</span>' : '';
    btn.innerHTML = monthLabel + '<span class="cal-num">' + d.getDate() + '</span>' +
      '<span class="cal-badge">' + (state === 'resolved' ? '✓' : '') + '</span>';
    var label = dateStr;
    if (isToday) label += ', сьогодні';
    if (state === 'pending') label += ', є дедлайн';
    else if (state === 'resolved') label += ', дедлайн виконано';
    btn.setAttribute('aria-label', label);
    if (state) btn.addEventListener('click', scrollToDeadlineDate.bind(null, dateStr));
    cal.appendChild(btn);
    if (isToday) todayPill = btn;
  }

  if (todayPill) {
    requestAnimationFrame(function () {
      todayPill.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    });
  }
}

var JOB_SEARCH_GOAL = 'Знайти роботу до 1.01.2027';

function renderHeroCard() {
  var hero = document.getElementById('heroCard');
  if (!hero) return;
  var done = ALL_TASKS.filter(function (t) { return getStatus(t.id) === 'done'; }).length;
  var total = ALL_TASKS.length;
  var pct = total ? Math.round(done / total * 100) : 0;
  var nextTask = ALL_TASKS.filter(function (t) { return getStatus(t.id) !== 'done'; })[0];
  var nextLabel = nextTask ? truncateText(nextTask.title, 30) : 'Усе готово 🎉';

  var ticks = '';
  for (var i = 0; i < total; i++) {
    ticks += '<span class="hc-tick' + (i < done ? ' is-filled' : '') + '"></span>';
  }

  hero.innerHTML =
    '<div class="hc-top">' +
      '<div class="hc-row"><span class="hc-label">Ціль</span><span class="hc-value">' +
        escapeHtml(JOB_SEARCH_GOAL) + '</span></div>' +
      '<div class="hc-row"><span class="hc-label">Наступне</span><span class="hc-value">' +
        escapeHtml(nextLabel) + '</span></div>' +
    '</div>' +
    '<div class="hc-progress">' +
      '<span class="hc-pct">' + pct + '%</span>' +
      '<span class="hc-status"><b>В процесі</b><span>' + done + ' з ' + total + ' задач</span></span>' +
    '</div>' +
    '<div class="hc-ticks">' + ticks + '</div>';
}

var STATUS_FILTER = 'all';
function applyStatusFilter() {
  var board = document.getElementById('board');
  if (!board) return;
  board.querySelectorAll('.task').forEach(function (task) {
    task.hidden = STATUS_FILTER !== 'all' && task.dataset.status !== STATUS_FILTER;
  });
  var currentPhaseHead = null;
  var phaseHasVisible = false;
  Array.prototype.forEach.call(board.children, function (el) {
    if (el.classList.contains('phase-head')) {
      if (currentPhaseHead) currentPhaseHead.hidden = !phaseHasVisible;
      currentPhaseHead = el;
      phaseHasVisible = false;
      return;
    }
    if (el.classList.contains('week-block')) {
      var visible = false;
      el.querySelectorAll('.task').forEach(function (t) { if (!t.hidden) visible = true; });
      el.hidden = !visible;
      if (visible) phaseHasVisible = true;
    }
  });
  if (currentPhaseHead) currentPhaseHead.hidden = !phaseHasVisible;
}

var statusFilterEl = document.getElementById('statusFilter');
if (statusFilterEl) {
  statusFilterEl.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      STATUS_FILTER = btn.dataset.key;
      statusFilterEl.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      applyStatusFilter();
    });
  });
}
