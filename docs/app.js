// =====================================================================
// CONFIG — edit these to your taste
// =====================================================================

// Login credentials. Anyone viewing source can read these — fine for a
// gym signup, but don't reuse these passwords for anything sensitive.
const CREDENTIALS = {
  jordan: { password: 'trainer123', role: 'jordan', display: 'Jordan' },
  guest:  { password: 'burn',       role: 'guest',  display: 'Guest'  }
};

// Formspree endpoint — create a free form at https://formspree.io and
// paste the URL here. Until you do, submissions show a friendly notice.
const FORMSPREE_ENDPOINT = ''; // e.g. 'https://formspree.io/f/abcd1234'

// GitHub repo info — used for the "Edit on GitHub" link in admin.
const GITHUB_OWNER  = 'mgarvey23';
const GITHUB_REPO   = 'oneonone';
const GITHUB_BRANCH = 'claude/trainer-booking-signup-T3w2x';

// Slot list — week of 5/4
const SLOTS = [
  { id: 'mon-0900', day: 'Monday',    date: '5/4', label: '9:00 AM – 10:00 AM' },
  { id: 'mon-1300', day: 'Monday',    date: '5/4', label: '1:00 PM – 2:00 PM' },
  { id: 'mon-1400', day: 'Monday',    date: '5/4', label: '2:00 PM – 3:00 PM' },
  { id: 'mon-1500', day: 'Monday',    date: '5/4', label: '3:00 PM – 4:00 PM' },
  { id: 'tue-mids', day: 'Tuesday',   date: '5/5', label: 'MIDS only: 8:30 AM – 12:15 PM (pick a start time in notes)' },
  { id: 'wed-1030', day: 'Wednesday', date: '5/6', label: '10:30 AM – 11:30 AM' },
  { id: 'wed-1130', day: 'Wednesday', date: '5/6', label: '11:30 AM – 12:30 PM' },
  { id: 'wed-1400', day: 'Wednesday', date: '5/6', label: '2:00 PM – 3:00 PM' },
  { id: 'wed-1500', day: 'Wednesday', date: '5/6', label: '3:00 PM – 4:00 PM' },
  { id: 'thu-open', day: 'Thursday',  date: '5/7', label: 'Anytime after 9:00 AM (pick a start time in notes)' },
  { id: 'fri-open', day: 'Friday',    date: '5/8', label: 'Anytime BEFORE 2:00 PM (pick a start time in notes)' },
  { id: 'sat-1000', day: 'Saturday',  date: '5/9', label: '10:00 AM – 11:00 AM' }
];

const DAY_ORDER = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// =====================================================================
// State
// =====================================================================
let session = null;          // { username, role, display }
let bookings = { confirmed: {}, customApproved: [] };
let workingBookings = null;  // Jordan's in-progress edits

// =====================================================================
// Helpers
// =====================================================================
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function saveSession(s) { sessionStorage.setItem('burn_session', JSON.stringify(s)); }
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem('burn_session') || 'null'); }
  catch { return null; }
}
function clearSession() { sessionStorage.removeItem('burn_session'); }

// =====================================================================
// Auth
// =====================================================================
function showLogin() {
  $('#login-screen').classList.remove('hidden');
  $('#app').classList.add('hidden');
  document.body.classList.remove('role-guest', 'role-jordan');
}

function showApp() {
  $('#login-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  document.body.classList.add(`role-${session.role}`);
  $('#who').textContent = `${session.display} (${session.role})`;
  loadBookings().then(renderAll);
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const u = String(fd.get('username') || '').trim().toLowerCase();
  const p = String(fd.get('password') || '');
  const status = $('#login-status');
  const cred = CREDENTIALS[u];
  if (!cred || cred.password !== p) {
    status.textContent = 'Invalid username or password.';
    status.className = 'status err';
    return;
  }
  session = { username: u, role: cred.role, display: cred.display };
  saveSession(session);
  status.textContent = '';
  showApp();
});

$('#logout').addEventListener('click', () => {
  clearSession();
  session = null;
  showLogin();
});

// =====================================================================
// Load / render bookings
// =====================================================================
async function loadBookings() {
  try {
    // Cache-bust so changes show up immediately after Jordan commits.
    const res = await fetch(`bookings.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      bookings = {
        confirmed: data.confirmed || {},
        customApproved: data.customApproved || []
      };
    }
  } catch (err) {
    console.warn('Could not load bookings.json', err);
  }
  workingBookings = JSON.parse(JSON.stringify(bookings));
}

function renderAll() {
  renderSlots();
  if (session.role === 'jordan') renderAdmin();
}

function groupByDay(allSlots) {
  const order = [];
  const map = {};
  for (const s of allSlots) {
    const key = `${s.day}|${s.date}`;
    if (!map[key]) {
      map[key] = { day: s.day, date: s.date, slots: [] };
      order.push(key);
    }
    map[key].slots.push(s);
  }
  // Sort days by week order
  order.sort((a, b) => {
    const [da] = a.split('|'); const [db] = b.split('|');
    return DAY_ORDER.indexOf(da) - DAY_ORDER.indexOf(db);
  });
  return order.map(k => map[k]);
}

function allSlotsForRender() {
  // Combine listed slots with Jordan-approved custom slots
  const customSlots = (bookings.customApproved || []).map((c, i) => ({
    id: c.id || `custom-${i}`,
    day: c.day,
    date: c.date,
    label: c.label,
    isCustom: true,
    booking: { name: c.name, notes: c.notes, betweenCamps: c.betweenCamps }
  }));
  const listed = SLOTS.map(s => ({
    ...s,
    booking: bookings.confirmed[s.id] || null
  }));
  return [...listed, ...customSlots];
}

function renderSlots() {
  const groups = groupByDay(allSlotsForRender());
  const isJordan = session.role === 'jordan';

  const html = groups.map(g => `
    <div class="day-card">
      <h3>${escapeHtml(g.day)} <span class="date">${escapeHtml(g.date)}</span></h3>
      ${g.slots.map(s => renderSlot(s, isJordan)).join('')}
    </div>
  `).join('');
  $('#days').innerHTML = html || '<p class="muted">No slots configured.</p>';

  $$('.book-btn').forEach(btn => {
    btn.addEventListener('click', () => openBookingModal(btn.dataset));
  });
}

function renderSlot(s, isJordan) {
  const booked = !!s.booking;
  const customClass = s.isCustom ? ' custom' : '';
  if (booked) {
    const detail = isJordan
      ? `<span class="booked-by">${escapeHtml(s.booking.name)}${s.booking.betweenCamps ? ' • between-camps' : ''}</span>${
           s.booking.notes ? `<div class="booked-notes">"${escapeHtml(s.booking.notes)}"</div>` : ''
         }`
      : '';
    return `
      <div class="slot booked${customClass}">
        <span>
          <span class="label">${escapeHtml(s.label)}</span>
          ${detail}
        </span>
        <span class="booked-tag">Booked</span>
      </div>`;
  }
  return `
    <div class="slot${customClass}">
      <span class="label">${escapeHtml(s.label)}</span>
      <button class="book-btn"
        data-id="${escapeHtml(s.id)}"
        data-label="${escapeHtml(s.label)}"
        data-day="${escapeHtml(s.day)}"
        data-date="${escapeHtml(s.date)}">Book</button>
    </div>`;
}

// =====================================================================
// Booking modal (guest flow)
// =====================================================================
const modal = $('#modal');
const bookForm = $('#book-form');
const bookStatus = $('#book-status');

function openBookingModal({ id, label, day, date }) {
  bookForm.reset();
  bookForm.slotId.value = id;
  bookForm.slotLabel.value = label;
  bookForm.slotDay.value = day;
  bookForm.slotDate.value = date;
  $('#modal-slot').textContent = `${day} (${date}) — ${label}`;
  bookStatus.textContent = '';
  bookStatus.className = 'status';
  modal.classList.remove('hidden');
  setTimeout(() => bookForm.name.focus(), 50);
}
function closeModal() { modal.classList.add('hidden'); }

$('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(bookForm);
  const payload = {
    _subject: `New 1:1 booking — ${fd.get('slotDay')} ${fd.get('slotDate')} ${fd.get('slotLabel')}`,
    type: 'booking',
    slotId: fd.get('slotId'),
    slot: `${fd.get('slotDay')} (${fd.get('slotDate')}) — ${fd.get('slotLabel')}`,
    name: fd.get('name'),
    notes: fd.get('notes') || '',
    betweenCamps: fd.get('betweenCamps') === 'on' ? 'yes' : 'no'
  };
  await sendToFormspree(payload, bookStatus,
    "Sent! Jordan will lock this in shortly. Refresh in a few minutes to see it confirmed.");
  setTimeout(closeModal, 1400);
});

// =====================================================================
// Alternate-time request (guest flow)
// =====================================================================
const altForm = $('#alt-form');
const altStatus = $('#alt-status');
altForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(altForm);
  const payload = {
    _subject: `Custom 1:1 time request — ${fd.get('name')}`,
    type: 'custom-request',
    name: fd.get('name'),
    preference: fd.get('preference'),
    betweenCamps: fd.get('betweenCamps') === 'on' ? 'yes' : 'no'
  };
  await sendToFormspree(payload, altStatus,
    "Got it — Jordan will reach out and add it to the schedule once approved.");
  altForm.reset();
});

async function sendToFormspree(payload, statusEl, okMessage) {
  if (!FORMSPREE_ENDPOINT) {
    statusEl.textContent = 'Setup needed: paste your Formspree URL into app.js (FORMSPREE_ENDPOINT).';
    statusEl.className = 'status err';
    return;
  }
  statusEl.textContent = 'Sending...';
  statusEl.className = 'status';
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('non-2xx');
    statusEl.textContent = okMessage;
    statusEl.className = 'status ok';
  } catch (err) {
    statusEl.textContent = "Couldn't send. Try again, or text Jordan directly.";
    statusEl.className = 'status err';
  }
}

// =====================================================================
// Jordan admin
// =====================================================================
function renderAdmin() {
  // Confirmed list
  const list = $('#admin-confirmed');
  const rows = [];

  for (const s of SLOTS) {
    const b = workingBookings.confirmed[s.id];
    if (!b) continue;
    rows.push(adminRowHtml(`${s.day} (${s.date}) — ${s.label}`, b, () => {
      delete workingBookings.confirmed[s.id];
      renderAdmin();
    }, `c:${s.id}`));
  }
  (workingBookings.customApproved || []).forEach((c, i) => {
    rows.push(adminRowHtml(`${c.day} (${c.date}) — ${c.label}  ⚡custom`, c, () => {
      workingBookings.customApproved.splice(i, 1);
      renderAdmin();
    }, `cu:${i}`));
  });

  list.innerHTML = rows.length
    ? rows.join('')
    : '<div class="admin-row empty">No bookings yet.</div>';

  // Wire remove buttons
  $$('.admin-row .remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const handlerKey = btn.dataset.handler;
      removeHandlers[handlerKey]?.();
      delete removeHandlers[handlerKey];
    });
  });

  // Slot select for the "add" form
  const sel = $('#admin-slot-select');
  sel.innerHTML = SLOTS.map(s =>
    `<option value="${escapeHtml(s.id)}">${escapeHtml(`${s.day} ${s.date} — ${s.label}`)}</option>`
  ).join('');

  // JSON preview + GitHub link
  $('#admin-json-preview').value = JSON.stringify(workingBookings, null, 2);
  $('#edit-on-github').href =
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/docs/bookings.json`;
}

const removeHandlers = {};
function adminRowHtml(when, b, removeFn, key) {
  removeHandlers[key] = removeFn;
  return `
    <div class="admin-row">
      <div>
        <div class="when">${escapeHtml(when)}</div>
        <div class="who">${escapeHtml(b.name)}${b.betweenCamps ? ' • between-camps' : ''}</div>
        ${b.notes ? `<div class="note">"${escapeHtml(b.notes)}"</div>` : ''}
      </div>
      <button class="remove" data-handler="${key}">Remove</button>
    </div>`;
}

$('#admin-add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const slotId = fd.get('slotId');
  if (workingBookings.confirmed[slotId]) {
    alert('That slot already has a booking. Remove the existing one first.');
    return;
  }
  workingBookings.confirmed[slotId] = {
    name: String(fd.get('name')).trim(),
    startTime: String(fd.get('startTime') || '').trim(),
    notes: String(fd.get('notes') || '').trim(),
    betweenCamps: false,
    addedAt: new Date().toISOString()
  };
  e.target.reset();
  renderAdmin();
});

$('#admin-custom-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  workingBookings.customApproved = workingBookings.customApproved || [];
  const day = fd.get('day');
  const date = fd.get('date');
  const id = `custom-${day.toLowerCase()}-${Date.now()}`;
  workingBookings.customApproved.push({
    id,
    day,
    date,
    label: String(fd.get('label')).trim(),
    name: String(fd.get('name')).trim(),
    notes: String(fd.get('notes') || '').trim(),
    betweenCamps: fd.get('betweenCamps') === 'on',
    addedAt: new Date().toISOString()
  });
  e.target.reset();
  renderAdmin();
});

$('#copy-json').addEventListener('click', async () => {
  const text = $('#admin-json-preview').value;
  const status = $('#copy-status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied. Now paste it into bookings.json on GitHub.';
    status.className = 'status ok';
  } catch {
    $('#admin-json-preview').select();
    status.textContent = 'Press Cmd/Ctrl+C to copy the highlighted JSON.';
    status.className = 'status';
  }
});

// =====================================================================
// Boot
// =====================================================================
session = loadSession();
if (session && CREDENTIALS[session.username]) {
  showApp();
} else {
  showLogin();
}
