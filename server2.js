require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------- JSON file storage ----------
const BOOKINGS_FILE = './bookings.json';

// load existing bookings at startup
let bookings = [];
if (fs.existsSync(BOOKINGS_FILE)) {
  try {
    bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
  } catch (err) {
    console.error('Failed to load bookings file:', err);
    bookings = [];
  }
}

let testimonials = []; // you can do same thing for testimonials if needed

// ---------- helper to save ----------
function saveBookings() {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

// ---------- your existing code ----------
function formatDateAndTime(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return { formattedDate: 'Invalid date', formattedTime: '' };
  }
  const pad = n => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return {
    formattedDate: `${year}-${month}-${day}`,
    formattedTime: `${pad(hours)}:${minutes} ${ampm}`
  };
}

async function sendTelegramNotification(booking) {
  const { formattedDate, formattedTime } = formatDateAndTime(booking.datetime);
  const message = `
✅ *New Booking*

Customer's name: ${booking.name}
Phone: ${booking.phone}
Service: ${booking.service}
Duration: ${booking.duration}
Price: ${booking.price}
Date: *${formattedDate}*
Time: *${formattedTime}*

Remarks:
1. Aroma Oil: ${booking.aroma_oil || 'Not specified'}
2. Pressure: ${booking.pressure || 'Not specified'}
3. Body area to focus: ${booking.focus_area || 'None'}
4. Body area to avoid: ${booking.avoid_area || 'None'}

🔔 Please prepare the room.
`;
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });
    console.log('✅ Telegram booking alert sent');
  } catch (error) {
    console.error('❌ Failed to send Telegram booking alert:', error.message);
  }
}

// ---------- endpoints ----------

// create booking
app.post('/booking', async (req, res) => {
  const { service, duration, price, name, phone, datetime, aromaOil, pressure, focusArea, avoidArea } = req.body;
  if (!service || !duration || !price || !name || !phone || !datetime) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const booking = {
    id: Date.now(),
    service,
    duration,
    price,
    name,
    phone,
    datetime,
    aroma_oil: aromaOil,
    pressure,
    focus_area: focusArea,
    avoid_area: avoidArea,
    bookedOn: new Date().toISOString()
  };

  await sendTelegramNotification(booking);

  bookings.push(booking);
  saveBookings(); // <<< save to file here
  res.status(201).json(booking);
});

// get all bookings
app.get('/booking', (req, res) => {
  res.json(bookings);
});

// delete booking
app.delete('/booking/:id', async (req, res) => {
  const { id } = req.params;
  const idx = bookings.findIndex(b => b.id === Number(id));
  if (idx === -1) return res.status(404).json({ error: 'Booking not found.' });

  const [removed] = bookings.splice(idx, 1);
  saveBookings(); // <<< also save after delete

  // optional: send Telegram cancel notification here…

  res.json({ message: `Booking with ID ${id} cancelled.` });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
