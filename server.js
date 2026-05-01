const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'bookings.json');

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SLOTS = [
  { id: 'mon-0900', day: 'Monday', date: '5/4', label: '9:00 AM – 10:00 AM' },
  { id: 'mon-1300', day: 'Monday', date: '5/4', label: '1:00 PM – 2:00 PM' },
  { id: 'mon-1400', day: 'Monday', date: '5/4', label: '2:00 PM – 3:00 PM' },
  { id: 'mon-1500', day: 'Monday', date: '5/4', label: '3:00 PM – 4:00 PM' },
  { id: 'tue-mids', day: 'Tuesday', date: '5/5', label: 'MIDS only: 8:30 AM – 12:15 PM (pick a start time in notes)' },
  { id: 'wed-1030', day: 'Wednesday', date: '5/6', label: '10:30 AM – 11:30 AM' },
  { id: 'wed-1130', day: 'Wednesday', date: '5/6', label: '11:30 AM – 12:30 PM' },
  { id: 'wed-1400', day: 'Wednesday', date: '5/6', label: '2:00 PM – 3:00 PM' },
  { id: 'wed-1500', day: 'Wednesday', date: '5/6', label: '3:00 PM – 4:00 PM' },
  { id: 'thu-open', day: 'Thursday', date: '5/7', label: 'Anytime after 9:00 AM (pick a start time in notes)' },
  { id: 'fri-open', day: 'Friday', date: '5/8', label: 'Anytime BEFORE 2:00 PM (pick a start time in notes)' },
  { id: 'sat-1000', day: 'Saturday', date: '5/9', label: '10:00 AM – 11:00 AM' }
];

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: {}, altRequests: [] }, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sanitize(str, max = 200) {
  return String(str || '').replace(/[<>]/g, '').trim().slice(0, max);
}

app.get('/api/slots', (req, res) => {
  const data = readData();
  const slots = SLOTS.map(s => {
    const b = data.bookings[s.id];
    return {
      ...s,
      booked: !!b,
      bookedBy: b ? b.name : null
    };
  });
  res.json({ slots });
});

app.post('/api/book', (req, res) => {
  const slotId = sanitize(req.body.slotId, 50);
  const name = sanitize(req.body.name, 80);
  const email = sanitize(req.body.email, 120);
  const notes = sanitize(req.body.notes, 500);
  const betweenCamps = !!req.body.betweenCamps;

  if (!SLOTS.find(s => s.id === slotId)) {
    return res.status(400).json({ error: 'Invalid slot.' });
  }
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const data = readData();
  if (data.bookings[slotId]) {
    return res.status(409).json({ error: 'That slot was just booked. Please pick another.' });
  }
  data.bookings[slotId] = {
    name,
    email,
    notes,
    betweenCamps,
    bookedAt: new Date().toISOString()
  };
  writeData(data);
  res.json({ ok: true });
});

app.post('/api/alt-request', (req, res) => {
  const name = sanitize(req.body.name, 80);
  const email = sanitize(req.body.email, 120);
  const preference = sanitize(req.body.preference, 500);
  const betweenCamps = !!req.body.betweenCamps;

  if (!name || !email || !preference) {
    return res.status(400).json({ error: 'Name, email, and preferred time are required.' });
  }
  const data = readData();
  data.altRequests.push({
    name,
    email,
    preference,
    betweenCamps,
    submittedAt: new Date().toISOString()
  });
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Sign-up sheet running on http://localhost:${PORT}`);
});
