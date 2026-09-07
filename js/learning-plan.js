/* Learning plans (uploaded/pasted roadmaps, shown on the "Навички" tab): parsing
   .docx/.txt/.md into plan data, the plan-switcher bottom sheet, and rendering the
   learning-plan board (reuses taskEl()/board markup from js/plan.js).
   Depends on: js/utils.js (pluralize, truncateText), js/plan.js (taskEl, deadlineInfo,
   saveDeadlines-style notify refresh). */

var LEARNING_PLANS_KEY = 'job-learning-plans-v1';
var ACTIVE_LEARNING_PLAN_KEY = 'job-active-learning-plan-v1';
var learningPlans = [];
var activeLearningPlanId = 'default';

function loadLearningPlans() {
  try {
    var raw = localStorage.getItem(LEARNING_PLANS_KEY);
    learningPlans = raw ? JSON.parse(raw) : [];
  } catch (e) { learningPlans = []; }
}
function saveLearningPlans() {
  try { localStorage.setItem(LEARNING_PLANS_KEY, JSON.stringify(learningPlans)); } catch (e) {}
}
function loadActiveLearningPlanId() {
  try { activeLearningPlanId = localStorage.getItem(ACTIVE_LEARNING_PLAN_KEY) || 'default'; } catch (e) { activeLearningPlanId = 'default'; }
  if (activeLearningPlanId !== 'default' && !learningPlans.some(function (p) { return p.id === activeLearningPlanId; })) {
    activeLearningPlanId = 'default';
  }
}
function setActiveLearningPlanId(id) {
  activeLearningPlanId = id;
  try { localStorage.setItem(ACTIVE_LEARNING_PLAN_KEY, id); } catch (e) {}
}
function learningPlanKey(id) { return activeLearningPlanId === 'default' ? id : (activeLearningPlanId + '::' + id); }
function isDefaultLearningPlan() { return activeLearningPlanId === 'default'; }

function getActiveLearningPlan() {
  if (activeLearningPlanId === 'default') {
    return { id: 'default', name: 'Навички і скіли', eyebrow: 'На основі 7 вакансій', isDefault: true };
  }
  var plan = learningPlans.filter(function (p) { return p.id === activeLearningPlanId; })[0];
  if (!plan) { activeLearningPlanId = 'default'; return getActiveLearningPlan(); }
  var allTasks = [];
  plan.weekblocks.forEach(function (b) { b.tasks.forEach(function (t) { allTasks.push(t); }); });
  return {
    id: plan.id, name: plan.name, isDefault: false,
    eyebrow: plan.weekblocks.length + ' ' + pluralize(plan.weekblocks.length, ['розділ', 'розділи', 'розділів']) + ' · власний план',
    phaseOrder: plan.phaseOrder, phaseSpans: plan.phaseSpans, weekblocks: plan.weekblocks, allTasks: allTasks
  };
}

function renderSkillsHeader() {
  var active = getActiveLearningPlan();
  document.getElementById('skillsTitle').textContent = active.name;
  document.getElementById('skillsEyebrow').textContent = active.eyebrow;
}

/* ---------- plan import: turn an uploaded/pasted roadmap into plan data ---------- */
function shortPhaseLabel(phase) {
  var head = phase.split(/\s+[—–-]\s+/)[0];
  return truncateText(head, 22);
}

var JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
var jszipLoadPromise = null;
function ensureJSZip() {
  if (window.JSZip) return Promise.resolve();
  if (jszipLoadPromise) return jszipLoadPromise;
  jszipLoadPromise = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = JSZIP_URL;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error('Не вдалося завантажити бібліотеку для .docx — потрібне інтернет-з’єднання (або встав текст замість файлу).')); };
    document.head.appendChild(s);
  });
  return jszipLoadPromise;
}

var HEADING_STYLE_LEVEL = { title: 0, heading1: 1, heading2: 2, heading3: 3, heading4: 4, heading5: 5, heading6: 6 };
function styleLevel(styleId) {
  if (!styleId) return null;
  var key = styleId.replace(/\s+/g, '').toLowerCase();
  return HEADING_STYLE_LEVEL.hasOwnProperty(key) ? HEADING_STYLE_LEVEL[key] : null;
}
function isListStyle(styleId) { return !!styleId && /list/i.test(styleId); }

var WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function docxXmlToParagraphs(xmlText) {
  var xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  var pNodes = xml.getElementsByTagNameNS(WORD_NS, 'p');
  var paragraphs = [];
  for (var i = 0; i < pNodes.length; i++) {
    var p = pNodes[i];
    var styleEl = p.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
    var styleId = styleEl ? styleEl.getAttributeNS(WORD_NS, 'val') : null;
    var tNodes = p.getElementsByTagNameNS(WORD_NS, 't');
    var text = '';
    for (var j = 0; j < tNodes.length; j++) text += tNodes[j].textContent;
    text = text.replace(/\s+/g, ' ').trim();
    var numPr = p.getElementsByTagNameNS(WORD_NS, 'numPr')[0];
    paragraphs.push({ style: styleId, text: text, isList: isListStyle(styleId) || !!numPr });
  }
  return paragraphs;
}

function textToParagraphs(text) {
  var lines = text.split(/\r\n|\r|\n/);
  var paragraphs = [];
  var MD_H_RE = /^(#{1,6})\s+(.*)/;
  var MONTH_RE = /^(місяць|місяц|month|фаза|phase|module|модуль|частина|розділ|section)\s*\d+/i;
  var WEEK_RE = /^(тиждень|тиж\.?|week|sprint|спринт|day|день|unit|topic|lesson|урок)\s*\d+/i;
  var BULLET_RE = /^[-*•●▪]\s+(.*)/;
  lines.forEach(function (raw) {
    var line = raw.trim();
    if (!line) return;
    var mdMatch = line.match(MD_H_RE);
    if (mdMatch) {
      var lvl = mdMatch[1].length;
      var style = lvl === 1 ? 'Title' : ('Heading' + Math.min(lvl - 1, 6));
      paragraphs.push({ style: style, text: mdMatch[2].trim(), isList: false });
      return;
    }
    if (line.length < 90 && MONTH_RE.test(line)) { paragraphs.push({ style: 'Heading1', text: line, isList: false }); return; }
    if (line.length < 90 && WEEK_RE.test(line)) { paragraphs.push({ style: 'Heading2', text: line, isList: false }); return; }
    var bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) { paragraphs.push({ style: 'ListBullet', text: bulletMatch[1].trim(), isList: true }); return; }
    paragraphs.push({ style: null, text: line, isList: false });
  });
  return paragraphs;
}

var GOAL_RE = /^(ціль|мета|goal|objective)\s*:\s*/i;
var RESULT_RE = /^(артефакт|результат|result|deliverable|outcome|checkpoint|чекпоінт|middle checkpoint)\s*:?\s*/i;

function paragraphsToPlan(paragraphs, fallbackName) {
  var titlePara = paragraphs.filter(function (p) { return styleLevel(p.style) === 0 && p.text; })[0];
  var name = titlePara ? titlePara.text : fallbackName;

  var weekblocks = [];
  var phaseOrder = [];
  var phaseIntros = {};
  var currentPhase = null;
  var currentBlock = null;

  paragraphs.forEach(function (p) {
    var lvl = styleLevel(p.style);
    var text = p.text;
    if (!text) return;
    if (lvl === 0) return;

    if (lvl === 1) {
      currentPhase = text;
      if (phaseOrder.indexOf(currentPhase) === -1) phaseOrder.push(currentPhase);
      currentBlock = null;
      return;
    }
    if (lvl === 2) {
      if (!currentPhase) {
        currentPhase = 'План';
        if (phaseOrder.indexOf(currentPhase) === -1) phaseOrder.push(currentPhase);
      }
      currentBlock = { phase: currentPhase, label: text, _descLines: [], _resultLines: [], _checklist: [], _goal: null };
      weekblocks.push(currentBlock);
      return;
    }
    if (lvl >= 3) {
      if (currentBlock) currentBlock._descLines.push('— ' + text);
      else if (currentPhase && phaseIntros[currentPhase] == null) phaseIntros[currentPhase] = text;
      return;
    }

    if (!currentBlock) {
      if (currentPhase && phaseIntros[currentPhase] == null) phaseIntros[currentPhase] = text;
      return;
    }
    if (!p.isList && GOAL_RE.test(text) && !currentBlock._goal) {
      currentBlock._goal = text.replace(GOAL_RE, '').trim();
      currentBlock._descLines.push(text);
      return;
    }
    if (!p.isList && RESULT_RE.test(text)) {
      currentBlock._resultLines.push(text);
      return;
    }
    if (p.isList) {
      currentBlock._checklist.push(text);
    } else {
      currentBlock._descLines.push(text);
    }
  });

  var taskCounter = 0;
  weekblocks.forEach(function (block) {
    taskCounter++;
    block.tasks = [{
      id: 'imp' + taskCounter,
      title: block._goal || block.label,
      desc: block._descLines.join('\n'),
      result: block._resultLines.join(' '),
      checklist: block._checklist
    }];
    delete block._descLines; delete block._resultLines; delete block._checklist; delete block._goal;
  });

  phaseOrder = phaseOrder.filter(function (ph) { return weekblocks.some(function (b) { return b.phase === ph; }); });
  var phaseSpans = {};
  phaseOrder.forEach(function (ph) {
    var count = weekblocks.filter(function (b) { return b.phase === ph; }).length;
    phaseSpans[ph] = phaseIntros[ph] ? truncateText(phaseIntros[ph], 60) : (count + ' ' + pluralize(count, ['тиждень', 'тижні', 'тижнів']));
  });

  return { name: name, phaseOrder: phaseOrder, phaseSpans: phaseSpans, weekblocks: weekblocks };
}

function flatFallbackPlan(paragraphs, fallbackName) {
  var items = paragraphs.filter(function (p) { return p.text; });
  var weekblocks = items.map(function (p, i) {
    return { phase: 'План', label: truncateText(p.text, 40), tasks: [{ id: 'imp' + (i + 1), title: truncateText(p.text, 60), desc: p.text, result: '' }] };
  });
  return {
    name: fallbackName,
    phaseOrder: weekblocks.length ? ['План'] : [],
    phaseSpans: { 'План': weekblocks.length + ' ' + pluralize(weekblocks.length, ['пункт', 'пункти', 'пунктів']) },
    weekblocks: weekblocks
  };
}

function buildPlanFromParagraphs(paragraphs, fallbackName) {
  var plan = paragraphsToPlan(paragraphs, fallbackName);
  if (!plan.weekblocks.length) plan = flatFallbackPlan(paragraphs, fallbackName);
  return plan;
}

function buildPlanFromDocx(arrayBuffer, fallbackName) {
  return ensureJSZip()
    .then(function () { return window.JSZip.loadAsync(arrayBuffer); })
    .then(function (zip) {
      var docFile = zip.file('word/document.xml');
      if (!docFile) throw new Error('Це не схоже на файл .docx (не знайдено word/document.xml).');
      return docFile.async('text');
    })
    .then(function (xmlText) { return buildPlanFromParagraphs(docxXmlToParagraphs(xmlText), fallbackName); });
}

function buildPlanFromText(text, fallbackName) {
  return Promise.resolve(buildPlanFromParagraphs(textToParagraphs(text), fallbackName));
}

function buildPlanFromFile(file) {
  var fallbackName = file.name.replace(/\.[^.]+$/, '');
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') {
    return file.arrayBuffer().then(function (buf) { return buildPlanFromDocx(buf, fallbackName); });
  }
  return file.text().then(function (text) { return buildPlanFromText(text, fallbackName); });
}

/* ---------- learning-plan board (replaces the checklist above when a custom plan is active) ---------- */
var LEARNING_STATE_KEY = 'job-learning-plan-statuses-v1';
var learningState = {};
function loadLearningState() {
  try {
    var raw = localStorage.getItem(LEARNING_STATE_KEY);
    learningState = raw ? JSON.parse(raw) : {};
  } catch (e) { learningState = {}; }
}
function saveLearningState() {
  try { localStorage.setItem(LEARNING_STATE_KEY, JSON.stringify(learningState)); } catch (e) {}
}
function getLearningStatus(id) { return learningState[learningPlanKey(id)] || 'queue'; }
function setLearningStatus(id, s) { learningState[learningPlanKey(id)] = s; saveLearningState(); renderLearningOverview(); updateNotifyDot(); }

var LEARNING_DEADLINES_KEY = 'job-learning-plan-deadlines-v1';
var learningDeadlines = {};
function loadLearningDeadlines() {
  try {
    var raw = localStorage.getItem(LEARNING_DEADLINES_KEY);
    learningDeadlines = raw ? JSON.parse(raw) : {};
  } catch (e) { learningDeadlines = {}; }
}
function saveLearningDeadlines() {
  try { localStorage.setItem(LEARNING_DEADLINES_KEY, JSON.stringify(learningDeadlines)); } catch (e) {}
  updateNotifyDot();
}

var learningStore = {
  getStatus: getLearningStatus,
  setStatus: setLearningStatus,
  getDeadline: function (id) { return learningDeadlines[learningPlanKey(id)] || ''; },
  setDeadline: function (id, val) {
    var k = learningPlanKey(id);
    if (val) learningDeadlines[k] = val; else delete learningDeadlines[k];
    saveLearningDeadlines();
  },
  getItemChecked: function (id, i) { return learningState[learningPlanKey(id + '__c' + i)] === true; },
  setItemChecked: function (id, i, checked) { learningState[learningPlanKey(id + '__c' + i)] = checked; saveLearningState(); }
};

function renderLearningOverview() {
  var ov = document.getElementById('skillsOverview');
  ov.innerHTML = '';
  var active = getActiveLearningPlan();
  if (active.isDefault) return;
  active.phaseOrder.forEach(function (phase, i) {
    var tasks = active.allTasks.filter(function (t) {
      return active.weekblocks.some(function (b) { return b.phase === phase && b.tasks.indexOf(t) !== -1; });
    });
    var done = tasks.filter(function (t) { return getLearningStatus(t.id) === 'done'; }).length;
    var card = document.createElement('div');
    card.className = 'ov-card' + (done === tasks.length ? ' ov-complete' : '');
    card.dataset.phase = String(i);
    var name = document.createElement('div');
    name.className = 'ov-name';
    name.textContent = shortPhaseLabel(phase);
    name.title = phase;
    var progress = document.createElement('div');
    progress.className = 'ov-progress';
    progress.innerHTML = '<span class="ov-count">' + done + '/' + tasks.length + '</span><span class="ov-check">✓</span>';
    card.appendChild(name);
    card.appendChild(progress);
    ov.appendChild(card);
  });
}

function renderLearningBoard() {
  var board = document.getElementById('skillsBoard');
  board.innerHTML = '';
  var active = getActiveLearningPlan();
  if (active.isDefault) return;
  var lastPhase = null;
  active.weekblocks.forEach(function (block) {
    if (block.phase !== lastPhase) {
      var head = document.createElement('div');
      head.className = 'phase-head';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = block.phase;
      var span = document.createElement('span');
      span.className = 'span';
      span.textContent = active.phaseSpans[block.phase] || '';
      head.appendChild(name);
      head.appendChild(span);
      board.appendChild(head);
      lastPhase = block.phase;
    }
    var wrap = document.createElement('div');
    wrap.className = 'week-block';
    var h2 = document.createElement('h2');
    h2.textContent = block.label;
    wrap.appendChild(h2);
    var list = document.createElement('div');
    list.className = 'task-list';
    block.tasks.forEach(function (t) { list.appendChild(taskEl(t, learningStore)); });
    wrap.appendChild(list);
    board.appendChild(wrap);
  });
}

function renderSkillsPageContent() {
  var isDefault = isDefaultLearningPlan();
  document.getElementById('skillsDefaultView').hidden = !isDefault;
  document.getElementById('skillsPlanView').hidden = isDefault;
  if (isDefault) {
    renderSkills();
  } else {
    renderLearningOverview();
    renderLearningBoard();
  }
}

/* ---------- learning plan switcher sheet (on the "Навички" tab) ---------- */
var planSheetOverlay = document.getElementById('planSheetOverlay');
var planFileInput = document.getElementById('planFile');
var planPasteText = document.getElementById('planPasteText');
var planNameInput = document.getElementById('planName');
var planParseStatus = document.getElementById('planParseStatus');
var planUploadForm = document.getElementById('planUploadForm');
var planUploadToggle = document.getElementById('planUploadToggle');

function setPlanStatus(msg, kind) {
  planParseStatus.hidden = !msg;
  planParseStatus.textContent = msg || '';
  planParseStatus.className = 'plan-status' + (kind ? ' is-' + kind : '');
}

function resetPlanUploadForm() {
  planUploadForm.hidden = true;
  planUploadToggle.hidden = false;
  planFileInput.value = '';
  planPasteText.value = '';
  planNameInput.value = '';
  setPlanStatus('');
}

function refreshAfterLearningPlanChange() {
  renderSkillsHeader();
  renderSkillsPageContent();
  updateNotifyDot();
}

function renderPlanList() {
  var wrap = document.getElementById('planList');
  wrap.innerHTML = '';
  var rows = [{ id: 'default', name: 'Базовий чекліст навичок', meta: '9 навичок · вбудований', builtin: true }]
    .concat(learningPlans.map(function (p) {
      return { id: p.id, name: p.name, meta: p.weekblocks.length + ' ' + pluralize(p.weekblocks.length, ['розділ', 'розділи', 'розділів']) + ' · власний', builtin: false };
    }));
  rows.forEach(function (r) {
    var row = document.createElement('div');
    row.className = 'plan-row' + (r.id === activeLearningPlanId ? ' is-active' : '');

    var main = document.createElement('button');
    main.type = 'button';
    main.className = 'plan-row-main';
    var nameEl = document.createElement('span');
    nameEl.className = 'plan-row-name';
    nameEl.textContent = r.name;
    var metaEl = document.createElement('span');
    metaEl.className = 'plan-row-meta';
    metaEl.textContent = r.meta;
    main.appendChild(nameEl);
    main.appendChild(metaEl);
    main.addEventListener('click', function () {
      setActiveLearningPlanId(r.id);
      renderPlanList();
      refreshAfterLearningPlanChange();
    });
    row.appendChild(main);

    if (r.builtin) {
      var check = document.createElement('span');
      check.className = 'plan-row-check';
      row.appendChild(check);
    } else {
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'plan-del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Видалити план ' + r.name);
      del.addEventListener('click', function () {
        learningPlans = learningPlans.filter(function (p) { return p.id !== r.id; });
        saveLearningPlans();
        var prefix = r.id + '::';
        Object.keys(learningState).forEach(function (k) { if (k.indexOf(prefix) === 0) delete learningState[k]; });
        Object.keys(learningDeadlines).forEach(function (k) { if (k.indexOf(prefix) === 0) delete learningDeadlines[k]; });
        saveLearningState();
        saveLearningDeadlines();
        if (activeLearningPlanId === r.id) setActiveLearningPlanId('default');
        renderPlanList();
        refreshAfterLearningPlanChange();
      });
      row.appendChild(del);
    }
    wrap.appendChild(row);
  });
}

function openPlanSheet() {
  renderPlanList();
  resetPlanUploadForm();
  planSheetOverlay.hidden = false;
}
function closePlanSheet() { planSheetOverlay.hidden = true; }

document.getElementById('learningPlanOpenBtn').addEventListener('click', openPlanSheet);
document.getElementById('planSheetClose').addEventListener('click', closePlanSheet);
planSheetOverlay.addEventListener('click', function (e) { if (e.target === planSheetOverlay) closePlanSheet(); });

planUploadToggle.addEventListener('click', function () {
  planUploadForm.hidden = false;
  planUploadToggle.hidden = true;
});
document.getElementById('planUploadCancel').addEventListener('click', resetPlanUploadForm);

document.getElementById('planUploadSave').addEventListener('click', function () {
  var file = planFileInput.files && planFileInput.files[0];
  var pasted = planPasteText.value.trim();
  if (!file && !pasted) { setPlanStatus('Обери файл або встав текст плану.', 'error'); return; }

  setPlanStatus('Розбираю…', null);
  var work = file ? buildPlanFromFile(file) : buildPlanFromText(pasted, 'Мій план');
  work.then(function (plan) {
    if (!plan.weekblocks.length) {
      setPlanStatus('Не вдалося знайти жодного розділу в файлі. Спробуй файл із чіткими заголовками тижнів/розділів.', 'error');
      return;
    }
    var customName = planNameInput.value.trim();
    if (customName) plan.name = customName;
    var id = 'p' + Date.now();
    learningPlans.push({ id: id, name: plan.name, createdAt: Date.now(), phaseOrder: plan.phaseOrder, phaseSpans: plan.phaseSpans, weekblocks: plan.weekblocks });
    saveLearningPlans();
    setActiveLearningPlanId(id);
    setPlanStatus('Готово: ' + plan.weekblocks.length + ' ' + pluralize(plan.weekblocks.length, ['розділ', 'розділи', 'розділів']) + '. План збережено і обрано.', 'ok');
    renderPlanList();
    refreshAfterLearningPlanChange();
    setTimeout(closePlanSheet, 1000);
  }).catch(function (err) {
    setPlanStatus('Помилка: ' + err.message, 'error');
  });
});
