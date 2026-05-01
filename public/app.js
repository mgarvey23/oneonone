const daysEl = document.getElementById('days');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalSlot = document.getElementById('modal-slot');
const bookForm = document.getElementById('book-form');
const bookStatus = document.getElementById('book-status');
const altForm = document.getElementById('alt-form');
const altStatus = document.getElementById('alt-status');

async function loadSlots() {
  const res = await fetch('/api/slots');
  const { slots } = await res.json();
  renderSlots(slots);
}

function groupByDay(slots) {
  const order = [];
  const map = {};
  for (const s of slots) {
    const key = `${s.day}|${s.date}`;
    if (!map[key]) {
      map[key] = { day: s.day, date: s.date, slots: [] };
      order.push(key);
    }
    map[key].slots.push(s);
  }
  return order.map(k => map[k]);
}

function renderSlots(slots) {
  const groups = groupByDay(slots);
  daysEl.innerHTML = groups.map(g => `
    <div class="day-card">
      <h3>${g.day} <span class="date">${g.date}</span></h3>
      ${g.slots.map(renderSlot).join('')}
    </div>
  `).join('');

  daysEl.querySelectorAll('.book-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id, btn.dataset.label, btn.dataset.day, btn.dataset.date));
  });
}

function renderSlot(s) {
  if (s.booked) {
    return `
      <div class="slot booked">
        <span class="label">${s.label}</span>
        <span class="booked-tag">Booked</span>
      </div>`;
  }
  return `
    <div class="slot">
      <span class="label">${s.label}</span>
      <button class="book-btn"
        data-id="${s.id}"
        data-label="${escapeAttr(s.label)}"
        data-day="${s.day}"
        data-date="${s.date}">Book</button>
    </div>`;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function openModal(slotId, label, day, date) {
  bookForm.reset();
  bookForm.slotId.value = slotId;
  modalSlot.textContent = `${day} (${date}) — ${label}`;
  bookStatus.textContent = '';
  bookStatus.className = 'status';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => bookForm.name.focus(), 50);
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
});

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(bookForm);
  const payload = {
    slotId: fd.get('slotId'),
    name: fd.get('name'),
    email: fd.get('email'),
    notes: fd.get('notes'),
    betweenCamps: fd.get('betweenCamps') === 'on'
  };
  bookStatus.textContent = 'Booking...';
  bookStatus.className = 'status';
  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      bookStatus.textContent = data.error || 'Could not book that slot.';
      bookStatus.className = 'status err';
      loadSlots();
      return;
    }
    bookStatus.textContent = 'Booked! See you then.';
    bookStatus.className = 'status ok';
    setTimeout(() => {
      closeModal();
      loadSlots();
    }, 900);
  } catch (err) {
    bookStatus.textContent = 'Network error. Try again.';
    bookStatus.className = 'status err';
  }
});

altForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(altForm);
  const payload = {
    name: fd.get('name'),
    email: fd.get('email'),
    preference: fd.get('preference'),
    betweenCamps: fd.get('betweenCamps') === 'on'
  };
  altStatus.textContent = 'Sending...';
  altStatus.className = 'status';
  try {
    const res = await fetch('/api/alt-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      altStatus.textContent = data.error || 'Could not send request.';
      altStatus.className = 'status err';
      return;
    }
    altStatus.textContent = "Got it — I'll reach out to confirm.";
    altStatus.className = 'status ok';
    altForm.reset();
  } catch (err) {
    altStatus.textContent = 'Network error. Try again.';
    altStatus.className = 'status err';
  }
});

loadSlots();
