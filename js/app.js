/* Bootstrap: runs the initial load/render sequence for every page, in the same
   order the app has always used, once all feature scripts have finished loading.
   Must be the last app script in index.html. */

// Plan
loadPlanState();
loadDeadlines();
renderOverview();
renderBoard();
renderCalendar();
renderHeroCard();
applyStatusFilter();

// Applications
buildStageFilterChips();
buildSourceFilterChips();
loadApps();
renderApps();
renderCalendar();

// Skills (default checklist)
loadSkills();

// Learning plans (custom roadmaps shown on the Skills tab)
loadLearningPlans();
loadActiveLearningPlanId();
loadLearningState();
loadLearningDeadlines();
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
