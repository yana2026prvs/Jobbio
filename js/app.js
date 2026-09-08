/* Bootstrap: runs the initial load/render sequence for every page, in the same
   order the app has always used, once all feature scripts have finished loading.
   Must be the last app script in index.html. */

// Shared plan library (uploaded/pasted roadmaps) + their progress — both the Plan
// tab's active plan and the Skills tab's active plan can point into this, so it
// has to be loaded before either of those sections resolves its active plan.
loadLearningPlans();
loadLearningState();
loadLearningDeadlines();

// Plan
loadPlanState();
loadDeadlines();
loadPlanActiveId();
renderBoard();
renderCalendar();
renderHeroCard();
applyStatusFilter();
renderPlanHeader();
if (document.getElementById('planEmptyState')) document.getElementById('planEmptyState').hidden = !isPlanEmpty();

// Applications
buildStageFilterChips();
buildSourceFilterChips();
loadApps();
renderApps();
renderCalendar();

// Skills (default checklist)
loadSkills();

// Learning plans (custom roadmaps shown on the Skills tab)
loadActiveLearningPlanId();
renderSkillsHeader();
renderSkillsPageContent();

// Profile
loadProfile();
renderProfile();

updateNotifyDot();

/* Test hook: exposes pure logic for tests/index.html. No effect on app behavior. */
window.__jobAppTest = {
  deadlineInfo: deadlineInfo, STAGES: STAGES, stageIndex: stageIndex,
  sourceFromUrl: sourceFromUrl,
  buildPlanFromDocx: buildPlanFromDocx, buildPlanFromText: buildPlanFromText, buildPlanFromFile: buildPlanFromFile,
  getActiveLearningPlan: getActiveLearningPlan, setActiveLearningPlanId: setActiveLearningPlanId
};
