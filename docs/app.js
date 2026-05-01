// =====================================================================
// CONFIG — edit these to your taste
// =====================================================================

// Login credentials. Anyone viewing source can read these — fine for a
// gym signup, but don't reuse these passwords for anything sensitive.
const CREDENTIALS = {
  jordan: { password: 'trainer123', role: 'jordan', display: 'Jordan' },
  guest:  { password: 'burn',       role: 'guest',  display: 'Guest'  }
};

// GitHub repo info
const GITHUB_OWNER  = 'mgarvey23';
const GITHUB_REPO   = 'oneonone';
const GITHUB_BRANCH = 'claude/trainer-booking-signup-T3w2x';
const BOOKINGS_PATH = 'docs/bookings.json';

// Scrambled GitHub token. Generate with setup.html and paste the line here.
const GITHUB_TOKEN_CIPHER = '';

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
let session = null;
let bookings = { confirmed: {}, customApproved: [], customRequests: [] };
let bookingsSha = null;

// =====================================================================
// Helpers
// =====================================================================
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const escapeHtml = s => String(s||'')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const KEY = 'BURNBLUE-SECRET-KEY';
function deobfuscate(cipher) {
  if (!cipher) return '';
  const raw = atob(cipher);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length));
  }
  return out;
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

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
  refresh();
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
  sessionStorage.setItem('burn_session', JSON.stringify(session));
  status.textContent = '';
  showApp();
});

$('#logout').addEventListener('click', () => {
  sessionStorage.removeItem('burn_session');
  session = null;
  showLogin();
});

// =====================================================================
// GitHub API: read + write bookings.json
// =====================================================================
async function apiGetBookings() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BOOKINGS_PATH}?ref=${GITHUB_BRANCH}`;
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  const token = deobfuscate(GITHUB_TOKEN_CIPHER);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load bookings (${res.status}).`);
  const data = await res.json();
  bookingsSha = data.sha;
  const parsed = JSON.parse(base64ToUtf8(data.content.replace(/\n/g, '')));
  bookings = {
    confirmed: parsed.confirmed || {},
    customApproved: parsed.customApproved || [],
    customRequests: parsed.customRequests || []
  };
}

async function apiPutBookings(message) {
  const token = deobfuscate(GITHUB_TOKEN_CIPHER);
  if (!token) throw new Error('Setup needed: scramble + paste a GitHub token (see setup.html).');
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${BOOKINGS_PATH}`;
  const body = {
    message,
    content: utf8ToBase64(JSON.stringify(bookings, null, 2) + '\n'),
    sha: bookingsSha,
    branch: GITHUB_BRANCH
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message || `Save failed (${res.status}).`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  bookingsSha = data.content.sha;
}

// Apply a delta to bookings, retrying on SHA conflict.
async function applyChange(changeFn, message) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await apiGetBookings();
    changeFn(bookings);
    try {
      await apiPutBookings(message);
      return;
    } catch (err) {
      if (err.status === 409 && attempt < 2) continue;
      throw err;
    }
  }
}

// =====================================================================
// Render
// =====================================================================
async function refresh() {
  try {
    await apiGetBookings();
  } catch (err) {
    console.warn(err);
  }
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
  order.sort((a, b) => DAY_ORDER.indexOf(a.split('|')[0]) - DAY_ORDER.indexOf(b.split('|')[0]));
  return order.map(k => map[k]);
}

function allSlotsForRender() {
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
  $('#days').innerHTML = groups.map(g => `
    <div class="day-card">
      <h3>${escapeHtml(g.day)} <span class="date">${escapeHtml(g.date)}</span></h3>
      ${g.slots.map(s => renderSlot(s, isJordan)).join('')}
    </div>
  `).join('') || '<p class="muted">No slots.</p>';

  $$('.book-btn').forEach(btn => {
    btn.addEventListener('click', () => openBookingModal(btn.dataset));
  });
}

function renderSlot(s, isJordan) {
  const customClass = s.isCustom ? ' custom' : '';
  if (s.booking) {
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
// Booking modal (any user)
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
  const slotId = fd.get('slotId');
  const name = String(fd.get('name')).trim();
  const notes = String(fd.get('notes') || '').trim();
  const betweenCamps = fd.get('betweenCamps') === 'on';
  const slotLabel = fd.get('slotLabel');

  bookStatus.textContent = 'Booking...';
  bookStatus.className = 'status';
  try {
    await applyChange((b) => {
      const isCustom = !SLOTS.find(s => s.id === slotId);
      if (isCustom) {
        const c = (b.customApproved || []).find(x => x.id === slotId);
        if (!c) throw new Error('Slot no longer exists.');
        if (c.name) throw new Error('That slot was just booked. Refresh and pick another.');
        c.name = name;
        c.notes = notes;
        c.betweenCamps = betweenCamps;
        c.bookedAt = new Date().toISOString();
      } else {
        if (b.confirmed[slotId]) throw new Error('That slot was just booked. Refresh and pick another.');
        b.confirmed[slotId] = { name, notes, betweenCamps, bookedAt: new Date().toISOString() };
      }
    }, `Book: ${slotLabel} — ${name}`);

    bookStatus.textContent = 'Booked! See you then.';
    bookStatus.className = 'status ok';
    setTimeout(() => { closeModal(); refresh(); }, 900);
  } catch (err) {
    bookStatus.textContent = err.message || 'Could not book that slot.';
    bookStatus.className = 'status err';
    refresh();
  }
});

// =====================================================================
// Custom-time request (guest flow) — adds to pending list
// =====================================================================
const altForm = $('#alt-form');
const altStatus = $('#alt-status');

altForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(altForm);
  const name = String(fd.get('name')).trim();
  const preference = String(fd.get('preference')).trim();
  const betweenCamps = fd.get('betweenCamps') === 'on';

  altStatus.textContent = 'Sending...';
  altStatus.className = 'status';
  try {
    await applyChange((b) => {
      b.customRequests = b.customRequests || [];
      b.customRequests.push({
        id: `req-${Date.now()}`,
        name, preference, betweenCamps,
        submittedAt: new Date().toISOString()
      });
    }, `Custom request from ${name}`);
    altStatus.textContent = "Got it — Jordan will review and confirm.";
    altStatus.className = 'status ok';
    altForm.reset();
  } catch (err) {
    altStatus.textContent = err.message || 'Could not send request.';
    altStatus.className = 'status err';
  }
});

// =====================================================================
// Jordan admin
// =====================================================================
function renderAdmin() {
  // Pending custom requests
  const pendingEl = $('#admin-pending');
  const pending = bookings.customRequests || [];
  pendingEl.innerHTML = pending.length ? pending.map((r, i) => `
    <div class="admin-row" data-i="${i}">
      <div>
        <div class="when">Pending</div>
        <div class="who">${escapeHtml(r.name)}${r.betweenCamps ? ' • between-camps OK' : ''}</div>
        <div class="note">"${escapeHtml(r.preference)}"</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input data-role="day"   placeholder="Day (Monday)" />
          <input data-role="date"  placeholder="Date (5/8)" style="width:80px;" />
          <input data-role="label" placeholder="Time label (7:30 AM – 8:30 AM)" style="flex:1;min-width:160px;" />
          <button class="btn approve" data-i="${i}">Approve</button>
          <button class="remove deny" data-i="${i}">Deny</button>
        </div>
      </div>
    </div>
  `).join('') : '<div class="admin-row empty">No pending requests.</div>';

  // Wire pending buttons
  $$('#admin-pending .approve').forEach(btn => {
    btn.addEventListener('click', () => approvePending(parseInt(btn.dataset.i, 10), btn.closest('.admin-row')));
  });
  $$('#admin-pending .deny').forEach(btn => {
    btn.addEventListener('click', () => denyPending(parseInt(btn.dataset.i, 10)));
  });

  // Confirmed list
  const list = $('#admin-confirmed');
  const rows = [];
  for (const s of SLOTS) {
    const b = bookings.confirmed[s.id];
    if (!b) continue;
    rows.push(adminRowHtml(`${s.day} (${s.date}) — ${s.label}`, b, 'listed', s.id));
  }
  (bookings.customApproved || []).forEach((c) => {
    if (c.name) rows.push(adminRowHtml(`${c.day} (${c.date}) — ${c.label}  ⚡custom`, c, 'custom', c.id));
  });
  list.innerHTML = rows.length ? rows.join('') : '<div class="admin-row empty">No bookings yet.</div>';

  $$('#admin-confirmed .remove').forEach(btn => {
    btn.addEventListener('click', () => removeBooking(btn.dataset.kind, btn.dataset.id));
  });
}

function adminRowHtml(when, b, kind, id) {
  return `
    <div class="admin-row">
      <div>
        <div class="when">${escapeHtml(when)}</div>
        <div class="who">${escapeHtml(b.name)}${b.betweenCamps ? ' • between-camps' : ''}</div>
        ${b.notes ? `<div class="note">"${escapeHtml(b.notes)}"</div>` : ''}
      </div>
      <button class="remove" data-kind="${kind}" data-id="${escapeHtml(id)}">Remove</button>
    </div>`;
}

async function approvePending(index, rowEl) {
  const day = rowEl.querySelector('[data-role=day]').value.trim();
  const date = rowEl.querySelector('[data-role=date]').value.trim();
  const label = rowEl.querySelector('[data-role=label]').value.trim();
  if (!day || !date || !label) {
    alert('Fill in day, date, and time label first.');
    return;
  }
  try {
    await applyChange((b) => {
      const req = b.customRequests[index];
      if (!req) return;
      b.customApproved = b.customApproved || [];
      b.customApproved.push({
        id: `custom-${Date.now()}`,
        day, date, label,
        name: req.name,
        notes: `(custom request) ${req.preference}`,
        betweenCamps: !!req.betweenCamps,
        bookedAt: new Date().toISOString()
      });
      b.customRequests.splice(index, 1);
    }, `Approve custom request from row ${index}`);
    refresh();
  } catch (err) {
    alert(err.message || 'Could not approve.');
  }
}

async function denyPending(index) {
  if (!confirm('Remove this pending request?')) return;
  try {
    await applyChange((b) => {
      b.customRequests.splice(index, 1);
    }, `Deny custom request row ${index}`);
    refresh();
  } catch (err) {
    alert(err.message || 'Could not remove.');
  }
}

async function removeBooking(kind, id) {
  if (!confirm('Remove this booking? The slot will reopen.')) return;
  try {
    await applyChange((b) => {
      if (kind === 'listed') {
        delete b.confirmed[id];
      } else if (kind === 'custom') {
        b.customApproved = (b.customApproved || []).filter(c => c.id !== id);
      }
    }, `Remove booking ${id}`);
    refresh();
  } catch (err) {
    alert(err.message || 'Could not remove.');
  }
}

// =====================================================================
// Boot
// =====================================================================
try {
  session = JSON.parse(sessionStorage.getItem('burn_session') || 'null');
} catch { session = null; }
if (session && CREDENTIALS[session.username]) {
  showApp();
} else {
  showLogin();
}
