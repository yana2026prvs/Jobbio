/* Plan page: which plan is active (builtin vs. a shared uploaded plan vs. empty),
   task statuses/deadlines, the "Сьогодні" block, the collapsible phase/week/task
   board, the deadline calendar and hero summary card, and the status quick-filter
   (with counts).
   Depends on: js/utils.js (escapeHtml, truncateText, pluralize, UA_MONTHS_GENITIVE,
   formatUaDateShort), js/plan-data.js (WEEKBLOCKS, PHASE_ORDER, PHASE_SPANS,
   ALL_TASKS), js/learning-plan.js (learningPlans/learningStore, for a non-builtin
   active plan).
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
  renderTodayBlock();
}

/* ---------- active plan on the Plan tab: 'builtin' (the fixed 13-week WEEKBLOCKS,
   unchanged), 'none' (empty state, first launch), or a custom plan's id from the
   shared learningPlans library (js/learning-plan.js) — the same library the Skills
   tab's plan-switcher uses. Migration: an existing installation (any real data in
   any of the app's own keys) always resolves to 'builtin', so a returning user's
   view and progress never change; only a genuinely first-ever load starts empty. */
var PLAN_ACTIVE_KEY = 'job-plan-active-id-v1';
var planActiveId = 'builtin';
function loadPlanActiveId() {
  var stored;
  try { stored = localStorage.getItem(PLAN_ACTIVE_KEY); } catch (e) { stored = null; }
  if (!stored) {
    var hasExistingData = ['job-plan-statuses-v1', 'job-plan-deadlines-v1', 'job-applications-v1', 'job-skills-v1', 'job-profile-v1']
      .some(function (k) { try { return !!localStorage.getItem(k); } catch (e2) { return false; } });
    stored = hasExistingData ? 'builtin' : 'none';
    try { localStorage.setItem(PLAN_ACTIVE_KEY, stored); } catch (e) {}
  }
  if (stored !== 'builtin' && stored !== 'none' && !learningPlans.some(function (p) { return p.id === stored; })) {
    stored = 'builtin';
  }
  planActiveId = stored;
}
function setPlanActiveId(id) {
  if (id !== planActiveId) {
    try { localStorage.setItem(PLAN_START_DATE_KEY, todayDateStr()); } catch (e) {}
  }
  planActiveId = id;
  try { localStorage.setItem(PLAN_ACTIVE_KEY, id); } catch (e) {}
}
function isPlanBuiltin() { return planActiveId === 'builtin'; }
function isPlanEmpty() { return planActiveId === 'none'; }

/* Index (0-based) of the week-block holding the next not-done task — the week
   in view by default, and the anchor for the start-date guess below. Falls
   back to the last block once everything is done. */
function currentBlockIndex(meta) {
  if (!meta.weekblocks.length) return 0;
  var nextTask = meta.allTasks.filter(function (t) { return meta.store.getStatus(t.id) !== 'done'; })[0];
  if (!nextTask) return meta.weekblocks.length - 1;
  var idx = -1;
  meta.weekblocks.some(function (b, i) { if (b.tasks.indexOf(nextTask) !== -1) { idx = i; return true; } return false; });
  return idx === -1 ? 0 : idx;
}

/* When did "week 1" of the currently active plan start? Not something the app
   tracks explicitly — inferred once, then kept stable: picked so that today
   falls inside whichever week currentBlockIndex() says is "current" (so an
   existing user with real progress gets a sensible date range immediately,
   not a range starting today for a week they finished weeks ago). Reset to
   today whenever the active plan changes (js/plan.js setPlanActiveId). */
var PLAN_START_DATE_KEY = 'job-plan-start-date-v1';
function getPlanStartDate() {
  var stored;
  try { stored = localStorage.getItem(PLAN_START_DATE_KEY); } catch (e) { stored = null; }
  if (!stored) {
    var idx = isPlanEmpty() ? 0 : currentBlockIndex(currentPlanMeta());
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - idx * 7);
    stored = toDateStr(d);
    try { localStorage.setItem(PLAN_START_DATE_KEY, stored); } catch (e) {}
  }
  return stored;
}

function weekDateRangeLabel(blockIndex) {
  var start = new Date(getPlanStartDate() + 'T00:00:00');
  start.setDate(start.getDate() + blockIndex * 7);
  var end = new Date(start);
  end.setDate(end.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return start.getDate() + '-' + end.getDate() + ' ' + UA_MONTHS_GENITIVE[start.getMonth()];
  }
  return start.getDate() + ' ' + UA_MONTHS_GENITIVE[start.getMonth()] + ' - ' + end.getDate() + ' ' + UA_MONTHS_GENITIVE[end.getMonth()];
}

/* Resolves what the Plan tab should currently render: the builtin job-search plan,
   or one of the shared custom plans, with a uniform {weekblocks, allTasks, store}
   shape so rendering code doesn't need to branch on which one it is. */
function currentPlanMeta() {
  if (isPlanBuiltin()) {
    return {
      phaseOrder: PHASE_ORDER, phaseSpans: PHASE_SPANS, weekblocks: WEEKBLOCKS, allTasks: ALL_TASKS,
      store: jobStore, name: 'Стратегія працевлаштування'
    };
  }
  var plan = learningPlans.filter(function (p) { return p.id === planActiveId; })[0];
  if (!plan) return { phaseOrder: [], phaseSpans: {}, weekblocks: [], allTasks: [], store: learningStore, name: 'План' };
  var allTasks = [];
  plan.weekblocks.forEach(function (b) { b.tasks.forEach(function (t) { allTasks.push(t); }); });
  return {
    phaseOrder: plan.phaseOrder, phaseSpans: plan.phaseSpans, weekblocks: plan.weekblocks, allTasks: allTasks,
    store: learningStore, name: plan.name
  };
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

/* Stricter than deadlineInfo().urgent (which also covers overdue and "+2 days",
   used for the 🔥 chips): the bell badge and reminders panel only care about
   deadlines due today or tomorrow. */
function isDueTodayOrTomorrow(dateStr) {
  if (!dateStr) return false;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var d = new Date(dateStr + 'T00:00:00');
  var diffDays = Math.round((d - today) / 86400000);
  return diffDays === 0 || diffDays === 1;
}

function collectReminders() {
  var items = [];
  if (!isPlanEmpty()) {
    var planMeta = currentPlanMeta();
    planMeta.allTasks.forEach(function (t) {
      if (planMeta.store.getStatus(t.id) === 'done') return;
      var dl = planMeta.store.getDeadline(t.id);
      if (isDueTodayOrTomorrow(dl)) items.push({ title: t.title, text: deadlineInfo(dl).text });
    });
  }
  apps.forEach(function (a) {
    if (isDueTodayOrTomorrow(a.deadline)) items.push({ title: a.company, text: deadlineInfo(a.deadline).text });
  });
  if (!isDefaultLearningPlan()) {
    getActiveLearningPlan().allTasks.forEach(function (t) {
      if (getLearningStatus(t.id) === 'done') return;
      var dl = learningDeadlines[learningPlanKey(t.id)];
      if (isDueTodayOrTomorrow(dl)) items.push({ title: t.title, text: deadlineInfo(dl).text });
    });
  }
  return items;
}

function updateNotifyDot() {
  var hasUrgent = collectReminders().length > 0;
  document.querySelectorAll('.notify-dot').forEach(function (dot) { dot.hidden = !hasUrgent; });
}

function renderRemindersPanel() {
  var body = document.getElementById('remindersBody');
  if (!body) return;
  var items = collectReminders();
  body.innerHTML = '';
  if (!items.length) {
    var empty = document.createElement('p');
    empty.className = 'hp-empty';
    empty.textContent = 'Нагадувань немає. Постав дедлайн у задачі — нагадаю за день до нього.';
    body.appendChild(empty);
    return;
  }
  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'hp-item';
    var title = document.createElement('span');
    title.className = 'hp-item-title';
    title.textContent = item.title;
    var due = document.createElement('span');
    due.className = 'hp-item-due';
    due.textContent = item.text;
    row.appendChild(title);
    row.appendChild(due);
    body.appendChild(row);
  });
}

var remindersBtnEl = document.getElementById('remindersBtn');
var remindersPanelEl = document.getElementById('remindersPanel');
setupHeaderPanel(remindersBtnEl, remindersPanelEl, renderRemindersPanel);

function planCurrentWeekNumber() {
  var nextTask = ALL_TASKS.filter(function (t) { return getStatus(t.id) !== 'done'; })[0];
  var block = nextTask
    ? WEEKBLOCKS.filter(function (b) { return b.tasks.indexOf(nextTask) !== -1; })[0]
    : WEEKBLOCKS[WEEKBLOCKS.length - 1];
  var match = block && block.label.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function renderPlanHeader() {
  var titleEl = document.getElementById('planTitle');
  var subtitle = document.getElementById('planSubtitle');
  if (!subtitle) return;
  if (isPlanEmpty()) {
    subtitle.hidden = true;
    if (titleEl) titleEl.textContent = 'Стратегія працевлаштування';
    return;
  }
  subtitle.hidden = false;
  if (isPlanBuiltin()) {
    if (titleEl) titleEl.textContent = 'Стратегія працевлаштування';
    subtitle.textContent = 'Тиждень ' + planCurrentWeekNumber() + ' з ' + PLAN_TOTAL_WEEKS + ' · ' + PLAN_TRACK_LABEL;
  } else {
    var meta = currentPlanMeta();
    if (titleEl) titleEl.textContent = meta.name;
    subtitle.textContent = meta.weekblocks.length + ' ' +
      pluralize(meta.weekblocks.length, ['розділ', 'розділи', 'розділів']) + ' · власний план';
  }
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
  state[id] = s; savePlanState(); updateNotifyDot();
  renderCalendar(); renderHeroCard(); applyStatusFilter(); renderPlanHeader(); renderTodayBlock();
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

var WK_CHEVRON_SVG = '<svg class="wk-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
  '<path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderBoard() {
  var board = document.getElementById('board');
  board.innerHTML = '';
  if (isPlanEmpty()) return;
  var meta = currentPlanMeta();
  var expandedIndex = currentBlockIndex(meta);
  var lastPhase = null;
  meta.weekblocks.forEach(function (block, blockIndex) {
    if (block.phase !== lastPhase) {
      var head = document.createElement('div');
      head.className = 'phase-head';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = block.phase;
      var span = document.createElement('span');
      span.className = 'span';
      span.textContent = meta.phaseSpans[block.phase] || '';
      head.appendChild(name);
      head.appendChild(span);
      board.appendChild(head);
      lastPhase = block.phase;
    }
    var wrap = document.createElement('div');
    wrap.className = 'week-block';
    wrap.dataset.blockIndex = String(blockIndex);
    var collapsed = blockIndex !== expandedIndex;
    wrap.classList.toggle('is-collapsed', collapsed);

    var list = document.createElement('div');
    list.className = 'task-list';
    list.hidden = collapsed;
    block.tasks.forEach(function (t) { list.appendChild(taskEl(t, meta.store)); });

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'week-toggle';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    var weekName = block.label.split(' — ')[0];
    var doneCount = block.tasks.filter(function (t) { return meta.store.getStatus(t.id) === 'done'; }).length;
    toggle.innerHTML =
      '<span class="wk-title">' + escapeHtml(weekName) + ' · ' + escapeHtml(weekDateRangeLabel(blockIndex)) + '</span>' +
      '<span class="wk-right"><span class="wk-count">' + doneCount + '/' + block.tasks.length + '</span>' + WK_CHEVRON_SVG + '</span>';
    toggle.addEventListener('click', function () {
      var nowCollapsed = !wrap.classList.contains('is-collapsed');
      wrap.classList.toggle('is-collapsed', nowCollapsed);
      list.hidden = nowCollapsed;
      toggle.setAttribute('aria-expanded', String(!nowCollapsed));
    });

    wrap.appendChild(toggle);
    wrap.appendChild(list);
    board.appendChild(wrap);
  });
}

/* ---------- deadline calendar + hero summary card (Plan page) ---------- */
var MONTH_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

function deadlineStateForDate(dateStr) {
  var meta = isPlanEmpty() ? null : currentPlanMeta();
  var matchTasks = meta ? meta.allTasks.filter(function (t) { return meta.store.getDeadline(t.id) === dateStr; }) : [];
  var matchApps = (apps || []).filter(function (a) { return a.deadline === dateStr; });
  if (!matchTasks.length && !matchApps.length) return null;
  var allDone = matchApps.length === 0 && matchTasks.length > 0 &&
    matchTasks.every(function (t) { return meta.store.getStatus(t.id) === 'done'; });
  return allDone ? 'resolved' : 'pending';
}

function scrollToDeadlineDate(dateStr) {
  if (isPlanEmpty()) return;
  var meta = currentPlanMeta();
  var task = meta.allTasks.filter(function (t) { return meta.store.getDeadline(t.id) === dateStr; })[0];
  if (!task) return;
  var blockIndex = -1;
  meta.weekblocks.some(function (b, i) {
    if (b.tasks.indexOf(task) !== -1) { blockIndex = i; return true; }
    return false;
  });
  if (blockIndex === -1) return;
  var target = document.querySelector('.week-block[data-block-index="' + blockIndex + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

var WEEKDAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function renderCalendar() {
  var cal = document.getElementById('deadlineCalendar');
  var sectionHead = document.getElementById('deadlinesSectionHead');
  if (!cal) return;
  cal.innerHTML = '';
  cal.hidden = isPlanEmpty();
  if (sectionHead) sectionHead.hidden = isPlanEmpty();
  if (isPlanEmpty()) return;

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayStr = toDateStr(today);

  var planMeta = currentPlanMeta();
  var allDeadlineDates = planMeta.allTasks.map(function (t) { return planMeta.store.getDeadline(t.id); })
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
    var topLabel = d.getDate() === 1
      ? '<span class="cal-month">' + MONTH_SHORT[d.getMonth()] + '</span>'
      : '<span class="cal-weekday">' + WEEKDAY_SHORT[d.getDay()] + '</span>';
    btn.innerHTML = topLabel + '<span class="cal-num">' + d.getDate() + '</span>' +
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
  hero.hidden = isPlanEmpty();
  if (isPlanEmpty()) return;
  var meta = currentPlanMeta();
  var done = meta.allTasks.filter(function (t) { return meta.store.getStatus(t.id) === 'done'; }).length;
  var total = meta.allTasks.length;
  var pct = total ? Math.round(done / total * 100) : 0;
  var nextTask = meta.allTasks.filter(function (t) { return meta.store.getStatus(t.id) !== 'done'; })[0];
  var nextLabel = nextTask ? truncateText(nextTask.title, 30) : 'Усе готово 🎉';

  var ticks = '';
  for (var i = 0; i < total; i++) {
    ticks += '<span class="hc-tick' + (i < done ? ' is-filled' : '') + '"></span>';
  }

  var caption = isPlanBuiltin()
    ? 'Тиждень ' + planCurrentWeekNumber() + ' з ' + PLAN_TOTAL_WEEKS + ' · ' + pct + '% задач готово'
    : 'Розділ ' + (currentBlockIndex(meta) + 1) + ' з ' + meta.weekblocks.length + ' · ' + pct + '% задач готово';

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
    '<div class="hc-caption">' + escapeHtml(caption) + '</div>' +
    '<div class="hc-ticks">' + ticks + '</div>';
}

var STATUS_FILTER = 'all';
var FILTER_LABELS = { all: 'Всі', queue: 'В черзі', doing: 'В роботі', done: 'Готово' };

function updateFilterCounts() {
  var filterWrap = document.getElementById('statusFilter');
  if (!filterWrap || isPlanEmpty()) return;
  var meta = currentPlanMeta();
  var counts = { all: meta.allTasks.length, queue: 0, doing: 0, done: 0 };
  meta.allTasks.forEach(function (t) { counts[meta.store.getStatus(t.id)]++; });
  filterWrap.querySelectorAll('button').forEach(function (b) {
    b.textContent = FILTER_LABELS[b.dataset.key] + ' ' + counts[b.dataset.key];
  });
}

function applyStatusFilter() {
  var board = document.getElementById('board');
  var filterWrap = document.getElementById('statusFilter');
  var emptyMsg = document.getElementById('boardFilterEmpty');
  if (filterWrap) filterWrap.hidden = isPlanEmpty();
  if (!board) return;
  board.hidden = isPlanEmpty();
  if (isPlanEmpty()) { if (emptyMsg) emptyMsg.hidden = true; return; }
  updateFilterCounts();

  board.querySelectorAll('.task').forEach(function (task) {
    task.hidden = STATUS_FILTER !== 'all' && task.dataset.status !== STATUS_FILTER;
  });
  var currentPhaseHead = null;
  var phaseHasVisible = false;
  var anyVisible = false;
  Array.prototype.forEach.call(board.children, function (el) {
    if (el.classList.contains('phase-head')) {
      if (currentPhaseHead) currentPhaseHead.hidden = !phaseHasVisible;
      currentPhaseHead = el;
      phaseHasVisible = false;
      return;
    }
    if (el.classList.contains('week-block')) {
      var visible = false;
      el.querySelectorAll('.task').forEach(function (t) { if (!t.hidden) { visible = true; anyVisible = true; } });
      el.hidden = !visible;
      if (visible) phaseHasVisible = true;
      // Filtering to a specific status always shows matching weeks' contents,
      // regardless of their collapsed/expanded state — that state only applies
      // when the "Всі" filter is active.
      var list = el.querySelector('.task-list');
      var toggle = el.querySelector('.week-toggle');
      if (list) {
        list.hidden = STATUS_FILTER === 'all' ? el.classList.contains('is-collapsed') : false;
        if (toggle) toggle.setAttribute('aria-expanded', String(!list.hidden));
      }
    }
  });
  if (currentPhaseHead) currentPhaseHead.hidden = !phaseHasVisible;

  var showFilterEmpty = STATUS_FILTER !== 'all' && !anyVisible;
  if (emptyMsg) {
    emptyMsg.hidden = !showFilterEmpty;
    if (showFilterEmpty) {
      emptyMsg.querySelector('.bfe-text').textContent =
        'У «' + (FILTER_LABELS[STATUS_FILTER] || '') + '» поки порожньо. Візьми задачу з черги.';
    }
  }
  board.hidden = showFilterEmpty;
}

/* ---------- "Сьогодні" block ---------- */
function nearestUpcomingDeadline(meta) {
  var todayStr = toDateStr(new Date());
  var dates = meta.allTasks
    .filter(function (t) { return meta.store.getStatus(t.id) !== 'done'; })
    .map(function (t) { return meta.store.getDeadline(t.id); })
    .filter(function (d) { return d && d >= todayStr; });
  if (!dates.length) return null;
  dates.sort();
  return dates[0];
}

function renderTodayBlock() {
  var wrap = document.getElementById('todayBlock');
  var list = document.getElementById('todayList');
  var empty = document.getElementById('todayEmpty');
  if (!wrap) return;
  wrap.hidden = isPlanEmpty();
  if (isPlanEmpty()) return;

  var meta = currentPlanMeta();
  var todayStr = toDateStr(new Date());
  var todayTasks = meta.allTasks.filter(function (t) {
    return meta.store.getStatus(t.id) !== 'done' && meta.store.getDeadline(t.id) === todayStr;
  }).slice(0, 3);

  list.innerHTML = '';
  if (!todayTasks.length) {
    list.hidden = true;
    empty.hidden = false;
    var nearest = nearestUpcomingDeadline(meta);
    empty.textContent = nearest
      ? 'На сьогодні задач немає. Найближчий дедлайн — ' + formatUaDateShort(nearest) + '.'
      : 'На сьогодні задач немає.';
    return;
  }
  empty.hidden = true;
  list.hidden = false;
  todayTasks.forEach(function (t) { list.appendChild(taskEl(t, meta.store)); });
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
var boardFilterEmptyShowAllBtn = document.getElementById('boardFilterEmptyShowAll');
if (boardFilterEmptyShowAllBtn) {
  boardFilterEmptyShowAllBtn.addEventListener('click', function () {
    STATUS_FILTER = 'all';
    if (statusFilterEl) {
      statusFilterEl.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.key === 'all'));
      });
    }
    applyStatusFilter();
  });
}

/* ---------- empty state (first launch, no active plan yet) ---------- */
function refreshPlanTab() {
  renderTodayBlock();
  renderBoard();
  renderCalendar();
  renderHeroCard();
  applyStatusFilter();
  renderPlanHeader();
  updateNotifyDot();
  var emptyState = document.getElementById('planEmptyState');
  if (emptyState) emptyState.hidden = !isPlanEmpty();
}

var planEmptyTemplateBtn = document.getElementById('planEmptyTemplateBtn');
if (planEmptyTemplateBtn) {
  planEmptyTemplateBtn.addEventListener('click', function () {
    setPlanActiveId('builtin');
    refreshPlanTab();
  });
}
var planEmptyUploadBtn = document.getElementById('planEmptyUploadBtn');
if (planEmptyUploadBtn) {
  planEmptyUploadBtn.addEventListener('click', function () {
    openPlanSheet('plan', true);
  });
}
