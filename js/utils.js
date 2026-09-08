/* Generic formatting helpers shared across pages. Loaded first — no dependencies. */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function truncateText(s, n) { return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }

function pluralize(n, forms) {
  var n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

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
