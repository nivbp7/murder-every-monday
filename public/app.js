const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const $ = (id) => document.getElementById(id);

function fmtLocal(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Given a Date in local time, return the Monday (00:00 local) of that week
function mondayOfWeek(d) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // move back to Monday
  const m = new Date(d);
  m.setHours(0,0,0,0);
  m.setDate(m.getDate() + diff);
  return m;
}
function nextMonday(d) {
  const day = d.getDay();
  const delta = day === 1 ? 7 : ((8 - day) % 7);
  const n = new Date(d);
  n.setHours(0,0,0,0);
  n.setDate(n.getDate() + delta);
  return n;
}
function toISODate(d) { return d.toISOString().slice(0,10); }

function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderBlock(node, label, record) {
  if (!record) {
    node.innerHTML = `<div class="date">${label}</div><div class="theme">No theme found.</div>`;
    return;
  }
  node.innerHTML = `<div class="date">${label}: ${fmtLocal(record.date)}</div><div class="theme">${record.theme}</div>`;
}

async function loadThemes() {
  const res = await fetch('./themes.json', { cache: 'no-store' });
  return res.ok ? res.json() : [];
}
function findByDate(list, iso) {
  return list.find(x => x.date === iso) || null;
}

async function init() {
  $('zoneRow').textContent = `Your timezone: ${tz}`;
  const list = await loadThemes();

  const now = new Date();
  const curMon = mondayOfWeek(now);
  const nextMon = nextMonday(now);

renderBlock($('currentBlock'), 'Current Monday', findByDate(list, toISODateLocal(curMon)));
renderBlock($('nextBlock'), 'Next Monday', findByDate(list, toISODateLocal(nextMon)));

  const todayISO = toISODate(now);
  $('datePicker').value = todayISO;

  $('datePicker').addEventListener('change', (e) => {
  const picked = new Date(`${e.target.value}T00:00:00`);
  const mon = mondayOfWeek(picked);
  const item = findByDate(list, toISODateLocal(mon));
  renderBlock($('dateResult'), 'Selected date (its Monday)', item);
});
}
init();
