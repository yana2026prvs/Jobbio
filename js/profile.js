/* Personal profile (особистий кабінет): name, email, role, bio — saved on input. */

var PROFILE_KEY = 'job-profile-v1';
var PROFILE_DEFAULTS = { name: '', email: '', role: '', bio: '' };
var profile = PROFILE_DEFAULTS;
function loadProfile() {
  try {
    var raw = localStorage.getItem(PROFILE_KEY);
    profile = raw ? Object.assign({}, PROFILE_DEFAULTS, JSON.parse(raw)) : Object.assign({}, PROFILE_DEFAULTS);
  } catch (e) { profile = Object.assign({}, PROFILE_DEFAULTS); }
}
function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) {}
}

var profileFields = {
  name: document.getElementById('profileName'),
  email: document.getElementById('profileEmail'),
  role: document.getElementById('profileRole'),
  bio: document.getElementById('profileBio')
};
var profileAvatar = document.getElementById('profileAvatar');
function renderProfileHeader() {
  var subtitle = document.getElementById('profileSubtitle');
  if (!subtitle) return;
  var parts = [profile.name.trim(), profile.role.trim()].filter(Boolean);
  subtitle.hidden = parts.length === 0;
  subtitle.textContent = parts.join(' · ');
}
function renderProfile() {
  Object.keys(profileFields).forEach(function (key) {
    profileFields[key].value = profile[key] || '';
  });
  profileAvatar.textContent = profile.name.trim().charAt(0).toUpperCase() || '?';
  renderProfileHeader();
}
Object.keys(profileFields).forEach(function (key) {
  profileFields[key].addEventListener('input', function () {
    profile[key] = profileFields[key].value;
    saveProfile();
    if (key === 'name') profileAvatar.textContent = profile.name.trim().charAt(0).toUpperCase() || '?';
    if (key === 'name' || key === 'role') renderProfileHeader();
  });
});
document.getElementById('profileForm').addEventListener('submit', function (e) { e.preventDefault(); });

document.getElementById('profileReplacePlanBtn').addEventListener('click', function () {
  openPlanSheet('skills', true);
});
